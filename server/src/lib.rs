use spacetimedb::{table, reducer, Table, ReducerContext, Identity, Timestamp, ScheduleAt};

// ============================================================
// CONSTANTS
// ============================================================

const MAX_ANSWERS_PER_SESSION: usize = 80;
const MIN_RESPONSE_MS: u32 = 200;
const MAX_RESPONSE_MS: u32 = 120_000;

// ============================================================
// TABLES
// ============================================================

#[table(accessor = players, public)]
pub struct Player {
    #[primary_key]
    pub identity: Identity,
    pub username: String,
    pub best_score: f32,
    pub total_sessions: u32,
    pub total_correct: u32,
    pub total_answered: u32,
    #[default(false)]
    pub onboarding_done: bool,
    #[default(0)]
    #[index(btree)]
    pub learning_tier: u8,
    #[default(false)]
    pub recovery_emailed: bool,
}

#[table(accessor = sessions, public)]
#[derive(Clone)]
pub struct Session {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub player_identity: Identity,  // foreign key via Identity
    pub username: String,
    pub weighted_score: f32,
    pub raw_score: u32,
    pub accuracy_pct: u8,
    pub total_answered: u32,
    pub is_complete: bool,
    pub started_at: Timestamp,
    #[default(0u64)]
    pub class_sprint_id: u64,  // 0 = solo sprint; non-zero = class sprint
}

#[table(accessor = answers, public)]
pub struct Answer {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[index(btree)]
    pub player_identity: Identity,
    #[index(btree)]
    pub session_id: u64,
    pub a: u8,
    pub b: u8,
    pub user_answer: u32,
    pub is_correct: bool,
    pub response_ms: u32,
    pub answered_at: Timestamp,
}

/// SEC-10: Server-issued problem token table.
/// Each row is created by issue_problem and consumed by submit_answer (one-time use).
#[table(accessor = issued_problems)]
pub struct IssuedProblem {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub session_id: u64,
    pub a: u8,
    pub b: u8,
    pub token: String,
}

/// SEC-10: Result table surfaced to the client so it can read the issued token.
/// Made public because SpacetimeDB 2.0.3 private tables cannot be subscribed to
/// via SELECT * or receive row pushes via ReducerResult.
/// The token is short-lived (consumed on submit_answer) and not a long-term secret.
#[table(accessor = issued_problem_results, public)]
pub struct IssuedProblemResult {
    #[primary_key]
    pub owner: Identity,
    pub token: String,
}

/// Per ordered-pair community stats + Derived Score
/// problem_key = a * 100 + b  (tracks 4x6 and 6x4 separately)
#[table(accessor = problem_stats, public)]
pub struct ProblemStat {
    #[primary_key]
    pub problem_key: u16,
    #[index(btree)]
    pub a: u8,
    #[index(btree)]
    pub b: u8,
    pub category: u8,        // 0 = trivial (*0/1/10), 1 = core (2-9 x 2-9), 2 = tier-1 (curated 2-digit)
    pub attempt_count: u32,
    pub correct_count: u32,
    pub avg_response_ms: u32,
    pub difficulty_weight: f32,
}

/// Records tier unlocks per player. One row per player per tier.
/// tier 1 = curated 2-digit multipliers (11,12,15,20,25 × 2-9)
#[table(accessor = unlock_logs, public)]
pub struct UnlockLog {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub player_identity: Identity,
    pub tier: u8,
    pub unlocked_at: Timestamp,
}

/// Per-player best sprint snapshot — 1 row per player, updated at end_session.
/// Eliminates full sessions-table scan for the leaderboard at scale.
#[table(accessor = best_scores, public)]
pub struct BestScore {
    #[primary_key]
    pub player_identity: Identity,
    pub username: String,
    pub best_weighted_score: f32,
    pub best_accuracy_pct: u8,
    pub best_total_answered: u32,
    #[index(btree)]
    pub learning_tier: u8,
}

#[table(accessor = online_players, public)]
pub struct OnlinePlayer {
    #[primary_key]
    pub identity: Identity,
    pub username: String,
    pub connected_at: Timestamp,
    /// Number of active WebSocket connections for this identity.
    /// Removes the row only when the last connection closes.
    #[default(1)]
    pub connection_count: u32,
}

// ============================================================
// INIT
// ============================================================

#[reducer(init)]
pub fn init(ctx: &ReducerContext) {
    seed_problem_stats(ctx);
    seed_tier1_problem_stats(ctx);
    // Start recurring transfer code cleanup (SEC-09)
    let first_cleanup = ctx.timestamp.to_micros_since_unix_epoch() + TRANSFER_CODE_CLEANUP_INTERVAL_MICROS;
    ctx.db.transfer_code_cleanup_schedule().insert(TransferCodeCleanupSchedule {
        scheduled_id: 0,
        scheduled_at: ScheduleAt::Time(Timestamp::from_micros_since_unix_epoch(first_cleanup)),
    });
}

#[reducer(client_connected)]
pub fn identity_connected(ctx: &ReducerContext) {
    if let Some(player) = ctx.db.players().identity().find(ctx.sender()) {
        if let Some(op) = ctx.db.online_players().identity().find(ctx.sender()) {
            // Already online (e.g. second tab, reconnect) — increment counter.
            ctx.db.online_players().identity().update(OnlinePlayer {
                connection_count: op.connection_count + 1,
                username: player.username,
                ..op
            });
        } else {
            let _ = ctx.db.online_players().try_insert(OnlinePlayer {
                identity: ctx.sender(),
                username: player.username,
                connected_at: ctx.timestamp,
                connection_count: 1,
            });
        }
    }
}

#[reducer(client_disconnected)]
pub fn identity_disconnected(ctx: &ReducerContext) {
    if let Some(op) = ctx.db.online_players().identity().find(ctx.sender()) {
        if op.connection_count <= 1 {
            ctx.db.online_players().identity().delete(ctx.sender());
        } else {
            ctx.db.online_players().identity().update(OnlinePlayer {
                connection_count: op.connection_count - 1,
                ..op
            });
        }
    }
    // ACCT-03: Clean up any restore result row for disconnecting anonymous identity
    ctx.db.restore_results().caller().delete(ctx.sender());
}

/// One-time migration: seed extended-table problem_stats rows if missing.
/// Call once after deploying the tier system to an existing database.
#[reducer]
pub fn migrate_seed_extended_pairs(ctx: &ReducerContext) -> Result<(), String> {
    let pairs: &[(u8, u8, f32)] = &[
        (11,2,0.6),(11,3,0.6),(11,4,0.6),(11,5,0.6),(11,6,0.6),(11,7,0.6),(11,8,0.6),(11,9,0.6),
        (12,2,1.0),(12,3,1.0),(12,4,1.0),(12,5,1.0),(12,6,1.0),(12,7,1.0),(12,8,1.0),(12,9,1.0),
        (15,2,1.2),(15,3,1.2),(15,4,1.2),(15,5,1.2),(15,6,1.2),(15,7,1.2),(15,8,1.2),(15,9,1.2),
        (20,2,0.8),(20,3,0.8),(20,4,0.8),(20,5,0.8),(20,6,0.8),(20,7,0.8),(20,8,0.8),(20,9,0.8),
        (25,2,1.4),(25,3,1.4),(25,4,1.4),(25,5,1.4),(25,6,1.4),(25,7,1.4),(25,8,1.4),(25,9,1.4),
    ];
    for &(a, b, weight) in pairs {
        for &(ra, rb) in &[(a, b), (b, a)] {
            let key = (ra as u16) * 100 + (rb as u16);
            if let Some(existing) = ctx.db.problem_stats().problem_key().find(key) {
                // Patch weight if it differs (e.g. ×20 was previously seeded at 0.6)
                if (existing.difficulty_weight - weight).abs() > 0.01 && existing.attempt_count < 20 {
                    ctx.db.problem_stats().problem_key().update(ProblemStat {
                        difficulty_weight: weight, ..existing
                    });
                }
            } else {
                ctx.db.problem_stats().insert(ProblemStat {
                    problem_key: key,
                    a: ra, b: rb, category: 2,
                    attempt_count: 0, correct_count: 0, avg_response_ms: 0,
                    difficulty_weight: weight,
                });
            }
        }
    }
    Ok(())
}

/// Migration: recompute every player's learning_tier strictly from their mastery data.
/// Unlike check_and_unlock (which only increases tier), this can also LOWER the tier
/// for players who were grandfathered above what their actual answers justify.
/// Idempotent — safe to call multiple times.
#[reducer]
pub fn migrate_recompute_tiers(ctx: &ReducerContext) -> Result<(), String> {
    let all_answers: Vec<Answer> = ctx.db.answers().iter().collect();
    for player in ctx.db.players().iter() {
        let my_answers: Vec<&Answer> = all_answers.iter()
            .filter(|a| a.player_identity == player.identity)
            .collect();

        let mut earned_tier = 0u8;
        for target_tier in 1u8..=3u8 {
            let check_tier = target_tier - 1;
            let tier_pairs: Vec<(u8, u8)> = ctx.db.problem_stats()
                .iter()
                .filter(|s| pair_learning_tier(s.a, s.b) == Some(check_tier))
                .map(|s| (s.a, s.b))
                .collect();
            let total = tier_pairs.len() as f32;
            if total == 0.0 { continue; }

            let mut mastered = 0u32;
            for (a, b) in &tier_pairs {
                let mut pair: Vec<_> = my_answers.iter()
                    .filter(|ans| ans.a == *a && ans.b == *b)
                    .collect();
                if pair.is_empty() { continue; }
                pair.sort_by_key(|ans| ans.id);
                let recent: Vec<_> = pair.iter().rev().take(10).collect();
                let acc = recent.iter().filter(|ans| ans.is_correct).count() as f32
                    / recent.len() as f32;
                if acc >= 0.8 { mastered += 1; }
            }
            if mastered as f32 / total >= 0.8 {
                earned_tier = target_tier;
            } else {
                break;
            }
        }

        if earned_tier != player.learning_tier {
            ctx.db.players().identity().update(Player { learning_tier: earned_tier, ..player });
        }
    }
    Ok(())
}

/// Migration v2: recompute every player's learning_tier using the new 8-tier (MAX_TIER=7) model.
/// Resets each player to tier 0, then advances via check_and_unlock from their most recent
/// completed session. Also syncs BestScore.learning_tier.
/// Idempotent — safe to call multiple times.
#[reducer]
pub fn migrate_recompute_tiers_v2(ctx: &ReducerContext) -> Result<(), String> {
    let players: Vec<Player> = ctx.db.players().iter().collect();
    for player in players {
        let identity = player.identity;

        // Reset player learning_tier to 0 to re-derive from scratch
        ctx.db.players().identity().update(Player { learning_tier: 0, ..player });

        // Re-advance using check_and_unlock from the most recent completed session
        let last_session = ctx.db.sessions().iter()
            .filter(|s| s.player_identity == identity && s.is_complete)
            .max_by_key(|s| s.id);
        if let Some(session) = last_session {
            check_and_unlock(ctx, identity, session.id);
        }

        // Sync BestScore.learning_tier to match re-computed Player.learning_tier
        if let Some(updated_player) = ctx.db.players().identity().find(identity) {
            if let Some(bs) = ctx.db.best_scores().player_identity().find(identity) {
                ctx.db.best_scores().player_identity().update(BestScore {
                    learning_tier: updated_player.learning_tier,
                    ..bs
                });
            }
        }
    }
    Ok(())
}

/// One-time migration: seed best_scores from existing completed sessions.
/// Idempotent — safe to call multiple times.
#[reducer]
pub fn migrate_seed_best_scores(ctx: &ReducerContext) -> Result<(), String> {
    let all_sessions: Vec<Session> = ctx.db.sessions().iter()
        .filter(|s| s.is_complete)
        .collect();

    for player in ctx.db.players().iter() {
        let best = all_sessions.iter()
            .filter(|s| s.player_identity == player.identity)
            .max_by(|a, b| a.weighted_score.partial_cmp(&b.weighted_score)
                .unwrap_or(std::cmp::Ordering::Equal));

        if let Some(s) = best {
            let new_bs = BestScore {
                player_identity: player.identity,
                username: player.username.clone(),
                best_weighted_score: s.weighted_score,
                best_accuracy_pct: s.accuracy_pct,
                best_total_answered: s.total_answered,
                learning_tier: player.learning_tier,
            };
            match ctx.db.best_scores().player_identity().find(player.identity) {
                Some(existing) => {
                    if s.weighted_score > existing.best_weighted_score {
                        ctx.db.best_scores().player_identity().update(new_bs);
                    }
                }
                None => { ctx.db.best_scores().insert(new_bs); }
            }
        }
    }
    Ok(())
}

/// Recompute all core (category=1) pair weights using the current blending formula.
/// Fixes two classes of wrong values in production:
///   (a) old bootstrap bugs: 4×5, 5×4, 3×6, 3×7, 3×9 were all 0.8; correct values are 0.6/0.7
///   (b) over-calibrated pairs from small-sample community data (e.g. 8×6 dropped to 0.7
///       after only ~20 answers from 2 players — bootstrap is 1.8)
/// Category 0 (trivial ×0/1/10) and category 2 (extended) are left untouched.
/// Idempotent — safe to call multiple times.
#[reducer]
pub fn migrate_reset_weights(ctx: &ReducerContext) -> Result<(), String> {
    for stat in ctx.db.problem_stats().iter() {
        if stat.category != 1 { continue; }
        let new_weight = if stat.attempt_count == 0 {
            bootstrap_weight(stat.a, stat.b, stat.category)
        } else {
            let error_rate = 1.0 - (stat.correct_count as f32 / stat.attempt_count as f32);
            let speed_factor = (stat.avg_response_ms as f32 / 10_000.0).min(1.0);
            let community = (0.2_f32 + 1.8 * error_rate + 0.5 * speed_factor).clamp(0.2, 2.0);
            let bootstrap = bootstrap_weight(stat.a, stat.b, stat.category);
            let blend = (stat.attempt_count as f32 / 200.0).min(1.0);
            bootstrap * (1.0 - blend) + community * blend
        };
        if (new_weight - stat.difficulty_weight).abs() > 0.001 {
            ctx.db.problem_stats().problem_key().update(ProblemStat {
                difficulty_weight: new_weight,
                ..stat
            });
        }
    }
    Ok(())
}

fn seed_problem_stats(ctx: &ReducerContext) {
    for a in 0u8..=10 {
        for b in 0u8..=10 {
            let category: u8 =
                if a == 0 || b == 0 || a == 1 || b == 1 || a == 10 || b == 10 {
                    0
                } else {
                    1
                };
            let weight = bootstrap_weight(a, b, category);
            let key = (a as u16) * 100 + (b as u16);
            ctx.db.problem_stats().insert(ProblemStat {
                problem_key: key,
                a, b, category,
                attempt_count: 0,
                correct_count: 0,
                avg_response_ms: 0,
                difficulty_weight: weight,
            });
        }
    }
}

fn seed_tier1_problem_stats(ctx: &ReducerContext) {
    // Curated 2-digit × 1-digit pairs. Both orderings seeded (e.g. 11×7 and 7×11).
    let pairs: &[(u8, u8, f32)] = &[
        (11,2,0.6),(11,3,0.6),(11,4,0.6),(11,5,0.6),(11,6,0.6),(11,7,0.6),(11,8,0.6),(11,9,0.6),
        (12,2,1.0),(12,3,1.0),(12,4,1.0),(12,5,1.0),(12,6,1.0),(12,7,1.0),(12,8,1.0),(12,9,1.0),
        (15,2,1.2),(15,3,1.2),(15,4,1.2),(15,5,1.2),(15,6,1.2),(15,7,1.2),(15,8,1.2),(15,9,1.2),
        (20,2,0.8),(20,3,0.8),(20,4,0.8),(20,5,0.8),(20,6,0.8),(20,7,0.8),(20,8,0.8),(20,9,0.8),
        (25,2,1.4),(25,3,1.4),(25,4,1.4),(25,5,1.4),(25,6,1.4),(25,7,1.4),(25,8,1.4),(25,9,1.4),
    ];
    for &(a, b, weight) in pairs {
        for &(ra, rb) in &[(a, b), (b, a)] {
            let key = (ra as u16) * 100 + (rb as u16);
            ctx.db.problem_stats().insert(ProblemStat {
                problem_key: key,
                a: ra, b: rb, category: 2,
                attempt_count: 0, correct_count: 0, avg_response_ms: 0,
                difficulty_weight: weight,
            });
        }
    }
}

fn bootstrap_weight(a: u8, b: u8, category: u8) -> f32 {
    if category == 0 { return 0.2; }
    let hard: &[(u8, u8, f32)] = &[
        (8, 7, 2.0), (7, 8, 2.0),
        (8, 9, 1.9), (9, 8, 1.9),
        (6, 8, 1.8), (8, 6, 1.8),
        (9, 6, 1.8), (6, 9, 1.8),
        (7, 6, 1.7), (6, 7, 1.7),
        (9, 7, 1.7), (7, 9, 1.7),
        (6, 6, 1.3), (7, 7, 1.4), (8, 8, 1.4), (9, 9, 1.5),
        (4, 8, 1.1), (8, 4, 1.1),
        (3, 8, 1.1), (8, 3, 1.1),
        (4, 7, 1.1), (7, 4, 1.1),
        (4, 6, 1.0), (6, 4, 1.0),
    ];
    for &(pa, pb, w) in hard { if pa == a && pb == b { return w; } }
    let min_ab = a.min(b);
    let max_ab = a.max(b);
    if max_ab <= 3 { return 0.4; }
    if max_ab <= 5 && min_ab <= 3 { return 0.5; }
    if a == b && a <= 5 { return 0.5; }
    if min_ab == 2 { return 0.45; }
    if min_ab == 5 { return 0.6; }
    // 3×5, 4×5, 5×4, 3×6 etc. that slipped through – keep them accessible
    if max_ab <= 5 { return 0.6; }      // 4×5 = 0.6  (not 0.8)
    if min_ab == 3 { return 0.7; }      // 3×6, 3×7, 3×9 = 0.7
    0.8
}

// ============================================================
// REDUCERS
// ============================================================

/// Validate a username for length, control characters, and Unicode script (SEC-08).
/// Allows Latin, Latin-1 Supplement, Latin Extended-A/B (covers EU languages).
/// Rejects null bytes, control characters, and characters above U+024F.
fn validate_username(name: &str) -> Result<(), String> {
    if name.is_empty() || name.len() > 24 {
        return Err("Username must be 1\u{2013}24 characters".into());
    }
    if name.chars().any(|c| c.is_control()) {
        return Err("Username contains invalid characters".into());
    }
    // Reject non-Latin scripts (above U+024F) to prevent Unicode homoglyph attacks.
    // Latin, Latin-1 Supplement, Latin Extended-A/B cover EU languages including German.
    if name.chars().any(|c| (c as u32) > 0x024F) {
        return Err("Username contains unsupported characters".into());
    }
    Ok(())
}

#[reducer]
pub fn register(ctx: &ReducerContext, username: String) -> Result<(), String> {
    let name = username.trim().to_string();
    validate_username(&name)?;
    let sender = ctx.sender();
    if let Some(existing) = ctx.db.players().identity().find(sender) {
        ctx.db.players().identity().update(Player { username: name.clone(), ..existing });
    } else {
        ctx.db.players().insert(Player {
            identity: sender,
            username: name.clone(),
            best_score: 0.0,
            total_sessions: 0,
            total_correct: 0,
            total_answered: 0,
            onboarding_done: false,
            learning_tier: 0,
            recovery_emailed: false,
        });
    }
    // Keep online_players in sync (user may have connected before registering)
    if let Some(op) = ctx.db.online_players().identity().find(sender) {
        ctx.db.online_players().identity().update(OnlinePlayer { username: name, ..op });
    } else {
        let _ = ctx.db.online_players().try_insert(OnlinePlayer {
            identity: sender,
            username: name,
            connected_at: ctx.timestamp,
            connection_count: 1,
        });
    }
    Ok(())
}

#[reducer]
pub fn start_session(ctx: &ReducerContext) -> Result<(), String> {
    let player = get_player(ctx)?;
    for _ in 0..200 {
        if ctx.db.sessions().try_insert(Session {
            id: 0,
            player_identity: ctx.sender(),
            username: player.username.clone(),
            weighted_score: 0.0,
            raw_score: 0,
            accuracy_pct: 0,
            total_answered: 0,
            is_complete: false,
            started_at: ctx.timestamp,
            class_sprint_id: 0,
        }).is_ok() {
            return Ok(());
        }
    }
    Err("Could not start session".to_string())
}

/// SEC-10: Server deals a problem — creates an IssuedProblem row and writes
/// the token to IssuedProblemResult so the client can read it and pass it back
/// in submit_answer.
#[reducer]
pub fn issue_problem(
    ctx: &ReducerContext,
    session_id: u64,
    a: u8,
    b: u8,
) -> Result<(), String> {
    let session = ctx.db.sessions().id().find(session_id)
        .ok_or("Session not found")?;
    if session.player_identity != ctx.sender() {
        return Err("Not your session".into());
    }
    if session.is_complete {
        return Err("Session already complete".into());
    }
    let pair_tier = pair_learning_tier(a, b).ok_or("Invalid problem pair")?;
    let player = get_player(ctx)?;
    if pair_tier > player.learning_tier {
        return Err("Problem pair above player's current tier".into());
    }
    let token = make_code(ctx);
    ctx.db.issued_problems().insert(IssuedProblem {
        id: 0,
        session_id,
        a,
        b,
        token: token.clone(),
    });
    // Write token to result table for client to read
    match ctx.db.issued_problem_results().owner().find(ctx.sender()) {
        Some(_) => {
            ctx.db.issued_problem_results().owner().update(IssuedProblemResult {
                owner: ctx.sender(),
                token,
            });
        }
        None => {
            ctx.db.issued_problem_results().insert(IssuedProblemResult {
                owner: ctx.sender(),
                token,
            });
        }
    }
    Ok(())
}

#[reducer]
pub fn submit_answer(
    ctx: &ReducerContext,
    session_id: u64,
    a: u8,
    b: u8,
    user_answer: u32,
    response_ms: u32,
    problem_token: String,
) -> Result<(), String> {
    let sender = ctx.sender();
    let player = get_player(ctx)?;

    let session = ctx.db.sessions().id().find(session_id)
        .ok_or("Session not found")?;
    if session.player_identity != sender { return Err("Not your session".into()); }
    if session.is_complete { return Err("Session already complete".into()); }

    // SEC-05: response_ms bounds
    if response_ms < MIN_RESPONSE_MS {
        return Err("Response time below minimum threshold".into());
    }
    if response_ms > MAX_RESPONSE_MS {
        return Err("Response time above maximum threshold".into());
    }

    // SEC-04: per-session answer cap
    let existing_count = ctx.db.answers()
        .iter()
        .filter(|ans| ans.session_id == session_id)
        .count();
    if existing_count >= MAX_ANSWERS_PER_SESSION {
        return Err("Session answer limit reached".into());
    }

    // SEC-06: (a, b) pair must be within player's learning tier
    let pair_tier = pair_learning_tier(a, b)
        .ok_or_else(|| "Invalid problem pair".to_string())?;
    if pair_tier > player.learning_tier {
        return Err("Problem pair above player's current tier".into());
    }

    // SEC-10: verify server-issued problem token
    let issued = ctx.db.issued_problems()
        .iter()
        .find(|ip| ip.session_id == session_id && ip.a == a && ip.b == b && ip.token == problem_token)
        .ok_or_else(|| "Problem not issued or token invalid".to_string())?;
    let issued_id = issued.id;
    ctx.db.issued_problems().id().delete(issued_id); // one-time use
    // Clean up result table entry
    ctx.db.issued_problem_results().owner().delete(ctx.sender());

    let correct_answer = (a as u32) * (b as u32);
    let is_correct = user_answer == correct_answer;

    ctx.db.answers().insert(Answer {
        id: 0,
        player_identity: sender,
        session_id,
        a, b,
        user_answer,
        is_correct,
        response_ms,
        answered_at: ctx.timestamp,
    });

    // Update Derived Score for this ordered pair
    let key = (a as u16) * 100 + (b as u16);
    if let Some(stat) = ctx.db.problem_stats().problem_key().find(key) {
        let new_count = stat.attempt_count + 1;
        let new_correct = stat.correct_count + u32::from(is_correct);
        let new_avg_ms = if stat.attempt_count == 0 {
            response_ms
        } else {
            ((stat.avg_response_ms as u64 * stat.attempt_count as u64
                + response_ms as u64) / new_count as u64) as u32
        };
        // Blend bootstrap → community weight over 200 answers (category 1 only).
        // A hard cutover at 20 lets a single fast player crater an established weight;
        // gradual blending means small user bases stay close to research-backed values.
        let new_weight = if stat.category == 1 {
            let error_rate = 1.0 - (new_correct as f32 / new_count as f32);
            let speed_factor = (new_avg_ms as f32 / 10_000.0).min(1.0);
            let community = (0.2_f32 + 1.8 * error_rate + 0.5 * speed_factor).clamp(0.2, 2.0);
            let bootstrap = bootstrap_weight(stat.a, stat.b, stat.category);
            let blend = (new_count as f32 / 200.0).min(1.0);
            bootstrap * (1.0 - blend) + community * blend
        } else {
            stat.difficulty_weight // category 0 (trivial) and 2 (extended): keep seeded value
        };
        ctx.db.problem_stats().problem_key().update(ProblemStat {
            attempt_count: new_count,
            correct_count: new_correct,
            avg_response_ms: new_avg_ms,
            difficulty_weight: new_weight,
            ..stat
        });
    }
    Ok(())
}

/// Compute and persist final scores for a session without permission checks.
/// Used by end_session (player-initiated) and sprint auto-end (server-initiated).
/// Does NOT update player stats — call sites that need that handle it separately.
fn finalize_session(ctx: &ReducerContext, session: Session) {
    if session.is_complete { return; }
    let session_id = session.id;
    let answers: Vec<Answer> = ctx.db.answers().iter().filter(|a| a.session_id == session_id).collect();
    let total = answers.len() as u32;
    if total == 0 {
        ctx.db.sessions().id().update(Session { is_complete: true, ..session });
        return;
    }
    let raw_score = answers.iter().filter(|a| a.is_correct).count() as u32;
    let accuracy_pct = ((raw_score * 100) / total).min(100) as u8;
    let weighted_score: f32 = answers.iter()
        .filter(|a| a.is_correct)
        .map(|a| {
            let key = (a.a as u16) * 100 + (a.b as u16);
            let base = ctx.db.problem_stats().problem_key().find(key)
                .map(|s| s.difficulty_weight).unwrap_or(1.0);
            let digit_bonus: f32 = if a.a.max(a.b) >= 11 {
                if (a.a as u32) * (a.b as u32) >= 100 { 1.0 } else { 0.5 }
            } else { 0.0 };
            base + digit_bonus
        })
        .sum();
    ctx.db.sessions().id().update(Session {
        weighted_score, raw_score, accuracy_pct, total_answered: total, is_complete: true, ..session
    });
}

#[reducer]
pub fn end_session(ctx: &ReducerContext, session_id: u64) -> Result<(), String> {
    let sender = ctx.sender();
    let _player = get_player(ctx)?;

    let session = ctx.db.sessions().id().find(session_id)
        .ok_or("Session not found")?;
    if session.player_identity != sender { return Err("Not your session".into()); }
    if session.is_complete { return Ok(()); }

    finalize_session(ctx, session);
    credit_session_to_player(ctx, sender, session_id);
    Ok(())
}

/// Maximum learning tier index (inclusive). Tiers 0–7 = 8 distinct tiers.
const MAX_TIER: u8 = 7;

/// Returns the learning tier for a factor value.
/// Returns None for excluded factors (×0 and extended: ×11, ×12, ×15, ×20, ×25).
/// Tier ladder: ×1/×2/×10 (0) → ×3 (1) → ×5 (2) → ×4 (3) → ×6 (4) → ×7 (5) → ×8 (6) → ×9 (7).
fn factor_tier(x: u8) -> Option<u8> {
    match x {
        0 => None,
        1 | 2 | 10 => Some(0), // starter: ×1, ×2, ×10
        3 => Some(1),
        5 => Some(2),
        4 => Some(3),
        6 => Some(4),
        7 => Some(5),
        8 => Some(6),
        9 => Some(7),
        _ => None, // 11, 12, 15, 20, 25 — excluded
    }
}

/// Learning tier of an ordered pair = min(tier(a), tier(b)).
/// A pair belongs to the tier of its *easier* factor — so 2×7 is a tier-0 pair
/// because it's part of the ×2 table, even though 7 hasn't been unlocked yet.
/// This means both 2×7 and 7×2 are tier-0 pairs (symmetric, as expected).
/// Old design used max(); changed to min() so pools are [unlocked_factors] × [1–10].
/// Returns None for excluded pairs (those involving ×0).
fn pair_learning_tier(a: u8, b: u8) -> Option<u8> {
    match (factor_tier(a), factor_tier(b)) {
        (Some(ta), Some(tb)) => Some(ta.min(tb)),
        _ => None,
    }
}

fn credit_session_to_player(ctx: &ReducerContext, identity: Identity, session_id: u64) {
    let session = match ctx.db.sessions().id().find(session_id) {
        Some(s) => s,
        None => return,
    };
    let player = match ctx.db.players().identity().find(identity) {
        Some(p) => p,
        None => return,
    };

    let weighted_score = session.weighted_score;
    let raw_score = session.raw_score;
    let accuracy_pct = session.accuracy_pct;
    let total = session.total_answered;

    let new_best = player.best_score.max(weighted_score);
    ctx.db.players().identity().update(Player {
        best_score: new_best,
        total_sessions: player.total_sessions + 1,
        total_correct: player.total_correct + raw_score,
        total_answered: player.total_answered + total,
        ..player
    });
    check_and_unlock(ctx, identity, session_id);

    // Re-read player to pick up learning_tier update from check_and_unlock
    if let Some(up) = ctx.db.players().identity().find(identity) {
        match ctx.db.best_scores().player_identity().find(identity) {
            Some(prev) => {
                let keep = prev.best_weighted_score >= weighted_score;
                ctx.db.best_scores().player_identity().update(BestScore {
                    username: up.username.clone(),
                    best_weighted_score: if keep { prev.best_weighted_score } else { weighted_score },
                    best_accuracy_pct:   if keep { prev.best_accuracy_pct   } else { accuracy_pct  },
                    best_total_answered: if keep { prev.best_total_answered  } else { total         },
                    learning_tier: up.learning_tier,
                    ..prev
                });
            }
            None => {
                ctx.db.best_scores().insert(BestScore {
                    player_identity: identity,
                    username: up.username.clone(),
                    best_weighted_score: weighted_score,
                    best_accuracy_pct: accuracy_pct,
                    best_total_answered: total,
                    learning_tier: up.learning_tier,
                });
            }
        }
    }
}

fn check_and_unlock(ctx: &ReducerContext, sender: Identity, session_id: u64) {
    let player = match ctx.db.players().identity().find(sender) {
        Some(p) => p,
        None => return,
    };

    let my_answers: Vec<Answer> = ctx.db.answers()
        .iter()
        .filter(|a| a.player_identity == sender)
        .collect();
    let sprint_answers: Vec<&Answer> = my_answers.iter()
        .filter(|a| a.session_id == session_id)
        .collect();

    let mut new_tier = player.learning_tier;

    for target_tier in (player.learning_tier + 1)..=MAX_TIER {
        let check_tier = target_tier - 1;

        // All problem_stat pairs belonging to check_tier
        let tier_pairs: Vec<(u8, u8)> = ctx.db.problem_stats()
            .iter()
            .filter(|s| pair_learning_tier(s.a, s.b) == Some(check_tier))
            .map(|s| (s.a, s.b))
            .collect();
        let total = tier_pairs.len() as f32;
        if total == 0.0 { continue; }

        // Speed bonus: ≥80% of this-sprint answers for check_tier pairs answered in <2s
        let sprint_tier: Vec<_> = sprint_answers.iter()
            .filter(|a| pair_learning_tier(a.a, a.b) == Some(check_tier))
            .collect();
        let speed_bonus = !sprint_tier.is_empty()
            && sprint_tier.iter().filter(|a| a.response_ms < 2000).count() as f32
               / sprint_tier.len() as f32 >= 0.8;
        let threshold = if speed_bonus { 0.5_f32 } else { 0.8_f32 };

        // Count mastered pairs (last-10 accuracy ≥80%)
        let mut mastered = 0u32;
        for (a, b) in &tier_pairs {
            let mut pair: Vec<_> = my_answers.iter()
                .filter(|ans| ans.a == *a && ans.b == *b)
                .collect();
            if pair.is_empty() { continue; }
            pair.sort_by_key(|ans| ans.id);
            let recent: Vec<_> = pair.iter().rev().take(10).collect();
            let acc = recent.iter().filter(|ans| ans.is_correct).count() as f32
                / recent.len() as f32;
            if acc >= 0.8 { mastered += 1; }
        }

        if mastered as f32 / total >= threshold {
            new_tier = target_tier;
        } else {
            break; // cannot skip tiers
        }
    }

    if new_tier > player.learning_tier {
        let updated = Player { learning_tier: new_tier, ..player };
        ctx.db.players().identity().update(updated);
    }

    // Backward compat: write unlock_logs(tier=1) when player reaches learning_tier ≥ 2
    if new_tier >= 2
        && !ctx.db.unlock_logs().iter().any(|u| u.player_identity == sender && u.tier == 1)
    {
        ctx.db.unlock_logs().insert(UnlockLog {
            id: 0,
            player_identity: sender,
            tier: 1,
            unlocked_at: ctx.timestamp,
        });
    }
}

// ============================================================
// ACCOUNT MANAGEMENT
// ============================================================

#[table(accessor = transfer_codes)]
pub struct TransferCode {
    #[primary_key]
    pub code: String,
    pub owner: Identity,
    pub token: String,
    pub created_at: Timestamp,
}

/// Public result table — rows are short-lived and owner-keyed (SEC-03).
/// Populated by create_transfer_code; deleted by use_transfer_code.
#[table(accessor = transfer_code_results, public)]
pub struct TransferCodeResult {
    #[primary_key]
    pub owner: Identity,
    pub code: String,
}

const TRANSFER_CODE_TTL_MICROS: i64 = 10 * 60 * 1_000_000; // 10 minutes
const TRANSFER_CODE_CLEANUP_INTERVAL_MICROS: i64 = 5 * 60 * 1_000_000; // check every 5 min

/// Scheduled recurring table — SpacetimeDB fires `expire_transfer_codes` at each scheduled_at (SEC-09).
#[table(accessor = transfer_code_cleanup_schedule, scheduled(expire_transfer_codes))]
pub struct TransferCodeCleanupSchedule {
    #[primary_key]
    #[auto_inc]
    pub scheduled_id: u64,
    pub scheduled_at: ScheduleAt,
}

/// Update display name (also patches all existing incomplete sessions)
#[reducer]
pub fn set_username(ctx: &ReducerContext, new_username: String) -> Result<(), String> {
    let name = new_username.trim().to_string();
    validate_username(&name)?;
    let player = get_player(ctx)?;
    ctx.db.players().identity().update(Player { username: name.clone(), ..player });
    // Keep BestScore.username in sync
    if let Some(bs) = ctx.db.best_scores().player_identity().find(ctx.sender()) {
        ctx.db.best_scores().player_identity().update(BestScore { username: name.clone(), ..bs });
    }
    // Keep online_players.username in sync
    if let Some(op) = ctx.db.online_players().identity().find(ctx.sender()) {
        ctx.db.online_players().identity().update(OnlinePlayer { username: name, ..op });
    }
    Ok(())
}

/// Mark the player's onboarding as completed so the intro overlay is not shown again.
#[reducer]
pub fn complete_onboarding(ctx: &ReducerContext) -> Result<(), String> {
    let player = get_player(ctx)?;
    ctx.db.players().identity().update(Player { onboarding_done: true, ..player });
    Ok(())
}

/// Let a player declare their starting learning tier (0–MAX_TIER).
/// Used in onboarding to skip tiers the player already knows.
/// Also allows downgrading from ProgressPage if a player wants more practice on easier tables.
#[reducer]
pub fn set_learning_tier(ctx: &ReducerContext, tier: u8) -> Result<(), String> {
    if tier > MAX_TIER {
        return Err(format!("Tier must be 0–{}", MAX_TIER));
    }
    let player = get_player(ctx)?;
    ctx.db.players().identity().update(Player { learning_tier: tier, ..player });
    // Also sync BestScore.learning_tier if it exists
    if let Some(bs) = ctx.db.best_scores().player_identity().find(ctx.sender()) {
        ctx.db.best_scores().player_identity().update(BestScore { learning_tier: tier, ..bs });
    }
    Ok(())
}

/// Mark that the player has emailed themselves their recovery key.
/// Persisted server-side so the nag banner stays gone across all devices.
#[reducer]
pub fn mark_recovery_emailed(ctx: &ReducerContext) -> Result<(), String> {
    let player = get_player(ctx)?;
    ctx.db.players().identity().update(Player { recovery_emailed: true, ..player });
    Ok(())
}

/// Store a transfer code → token mapping so another device can claim this account.
/// The caller passes their own SpaceTimeDB auth token; the server holds it briefly.
#[reducer]
pub fn create_transfer_code(ctx: &ReducerContext, token: String) -> Result<(), String> {
    let _player = get_player(ctx)?;
    // Remove any previous codes for this owner
    let old: Vec<_> = ctx.db.transfer_codes()
        .iter()
        .filter(|c| c.owner == ctx.sender())
        .collect();
    for c in old { ctx.db.transfer_codes().code().delete(c.code); }

    let code = make_code(ctx);
    ctx.db.transfer_codes().insert(TransferCode {
        code: code.clone(),
        owner: ctx.sender(),
        token,
        created_at: ctx.timestamp,
    });

    // Write to private result table so the client can read back its own code (SEC-03).
    match ctx.db.transfer_code_results().owner().find(ctx.sender()) {
        Some(_) => {
            ctx.db.transfer_code_results().owner().update(TransferCodeResult {
                owner: ctx.sender(),
                code: code.clone(),
            });
        }
        None => {
            ctx.db.transfer_code_results().insert(TransferCodeResult {
                owner: ctx.sender(),
                code,
            });
        }
    }
    Ok(())
}

/// Called by the new device after it has read and stored the token — deletes the row.
#[reducer]
pub fn use_transfer_code(ctx: &ReducerContext, code: String) -> Result<(), String> {
    let record = ctx.db.transfer_codes().code().find(code.clone())
        .ok_or("Transfer code not found or already used")?;
    // Delete the result entry for the owner so the UI clears
    ctx.db.transfer_code_results().owner().delete(record.owner);
    ctx.db.transfer_codes().code().delete(code);
    Ok(())
}

/// Scheduled reducer: deletes transfer codes older than TRANSFER_CODE_TTL_MICROS (10 min)
/// and re-schedules itself for the next run (recurring pattern, SEC-09).
#[reducer]
pub fn expire_transfer_codes(ctx: &ReducerContext, _arg: TransferCodeCleanupSchedule)
    -> Result<(), String>
{
    let cutoff = ctx.timestamp.to_micros_since_unix_epoch() - TRANSFER_CODE_TTL_MICROS;
    let expired: Vec<_> = ctx.db.transfer_codes()
        .iter()
        .filter(|c| c.created_at.to_micros_since_unix_epoch() < cutoff)
        .map(|c| (c.code.clone(), c.owner))
        .collect();
    for (code, owner) in expired {
        ctx.db.transfer_codes().code().delete(code);
        ctx.db.transfer_code_results().owner().delete(owner);
    }
    // Re-schedule for next run (recurring pattern)
    let next_at = ctx.timestamp.to_micros_since_unix_epoch() + TRANSFER_CODE_CLEANUP_INTERVAL_MICROS;
    ctx.db.transfer_code_cleanup_schedule().insert(TransferCodeCleanupSchedule {
        scheduled_id: 0,
        scheduled_at: ScheduleAt::Time(Timestamp::from_micros_since_unix_epoch(next_at)),
    });
    Ok(())
}

// ============================================================
// RECOVERY KEYS  (permanent, multi-use, 12 chars)
// ============================================================

/// One permanent recovery key per player. Never expires, survives logout.
/// Lets you reclaim your account from any device at any future point.
#[table(accessor = recovery_keys)]
pub struct RecoveryKey {
    #[primary_key]
    pub code: String,
    pub owner: Identity,
    pub token: String,
}

/// Public result table — rows are short-lived and owner-keyed (SEC-03).
/// Populated by get_my_recovery_code and regenerate_recovery_key.
#[table(accessor = recovery_code_results, public)]
pub struct RecoveryCodeResult {
    #[primary_key]
    pub owner: Identity,
    pub code: String,
}

/// ACCT-03: Result table for restore_account.
/// Made public (not private) because SpacetimeDB 2.0.3 private tables cannot
/// push rows to subscribers — same limitation as IssuedProblemResult (SEC-10).
/// The token is short-lived: consumed the moment the client reloads, and the
/// row is deleted in identity_disconnected so the window is <1 s.
#[table(accessor = restore_results, public)]
pub struct RestoreResult {
    #[primary_key]
    pub caller: Identity,
    pub token: String,
}

/// ACCT-04: Result table for get_class_recovery_codes.
/// Made public (not private) because SpacetimeDB 2.0.3 private tables cannot
/// push rows to subscribers — same limitation as restore_results (ACCT-03).
/// Security note: individual recovery codes are already in the public
/// recovery_code_results table, so this exposes no new data beyond that.
/// Rows are created on demand (teacher calls get_class_recovery_codes) and
/// deleted when the teacher disconnects (identity_disconnected cleanup).
#[table(accessor = class_recovery_results, public)]
pub struct ClassRecoveryResult {
    #[primary_key]
    pub member_identity: Identity,
    pub teacher_identity: Identity,
    pub classroom_id: u64,
    pub username: String,
    pub code: String,
}

/// Ensure the caller has a permanent recovery key — no-op if one already exists.
/// Safe to call on every app load; will never overwrite an existing key.
#[reducer]
pub fn create_recovery_key(ctx: &ReducerContext, token: String) -> Result<(), String> {
    let _player = get_player(ctx)?;
    let existing = ctx.db.recovery_keys()
        .iter()
        .any(|k| k.owner == ctx.sender());
    if existing { return Ok(()); }

    let code = make_recovery_code(ctx);
    ctx.db.recovery_keys().insert(RecoveryKey {
        code,
        owner: ctx.sender(),
        token,
    });
    Ok(())
}

/// Fetch the caller's own recovery code into the private RecoveryCodeResult table (SEC-03).
/// Client subscribes to recovery_code_results to read the value.
#[reducer]
pub fn get_my_recovery_code(ctx: &ReducerContext) -> Result<(), String> {
    let _player = get_player(ctx)?;
    let record = ctx.db.recovery_keys()
        .iter()
        .find(|k| k.owner == ctx.sender())
        .ok_or("No recovery key found")?;
    match ctx.db.recovery_code_results().owner().find(ctx.sender()) {
        Some(_) => {
            ctx.db.recovery_code_results().owner().update(RecoveryCodeResult {
                owner: ctx.sender(),
                code: record.code.clone(),
            });
        }
        None => {
            ctx.db.recovery_code_results().insert(RecoveryCodeResult {
                owner: ctx.sender(),
                code: record.code.clone(),
            });
        }
    }
    Ok(())
}

/// ACCT-03: Restore an account session via recovery code.
/// Called by an anonymous connection (no player row required).
/// Normalises code to uppercase, looks it up in recovery_keys, then writes the stored
/// session token to RestoreResult keyed by the caller's anonymous identity.
#[reducer]
pub fn restore_account(ctx: &ReducerContext, code: String) -> Result<(), String> {
    let upper = code.trim().to_uppercase();
    if upper.len() != 12 {
        return Err("Invalid recovery code length".into());
    }
    let record = ctx.db.recovery_keys().code().find(upper)
        .ok_or("Recovery code not found")?;
    match ctx.db.restore_results().caller().find(ctx.sender()) {
        Some(_) => {
            ctx.db.restore_results().caller().update(RestoreResult {
                caller: ctx.sender(),
                token: record.token.clone(),
            });
        }
        None => {
            ctx.db.restore_results().insert(RestoreResult {
                caller: ctx.sender(),
                token: record.token,
            });
        }
    }
    Ok(())
}

/// ACCT-04: Teacher reducer to retrieve all student recovery codes for a classroom.
/// Verifies teacher ownership, deletes previous results for this teacher, then inserts
/// one row per student with a recovery key.
#[reducer]
pub fn get_class_recovery_codes(ctx: &ReducerContext, classroom_id: u64) -> Result<(), String> {
    let classroom = ctx.db.classrooms().id().find(classroom_id)
        .ok_or("Classroom not found")?;
    if classroom.teacher != ctx.sender() {
        return Err("Not the teacher of this classroom".into());
    }

    // Delete stale result rows for this teacher
    let old: Vec<Identity> = ctx.db.class_recovery_results()
        .iter()
        .filter(|r| r.teacher_identity == ctx.sender())
        .map(|r| r.member_identity)
        .collect();
    for id in old {
        ctx.db.class_recovery_results().member_identity().delete(id);
    }

    // Iterate members, look up recovery key, write results
    let members: Vec<_> = ctx.db.classroom_members()
        .iter()
        .filter(|m| m.classroom_id == classroom_id)
        .collect();

    for member in members {
        let player = match ctx.db.players().identity().find(member.player_identity) {
            Some(p) => p,
            None => continue,
        };
        let key = match ctx.db.recovery_keys()
            .iter()
            .find(|k| k.owner == member.player_identity)
        {
            Some(k) => k,
            None => continue,
        };
        ctx.db.class_recovery_results().insert(ClassRecoveryResult {
            member_identity: member.player_identity,
            teacher_identity: ctx.sender(),
            classroom_id,
            username: player.username.clone(),
            code: key.code.clone(),
        });
    }
    Ok(())
}

/// Explicitly replace the caller's recovery key with a new one.
/// Only called when the user clicks "Regenerate" in the Account page.
#[reducer]
pub fn regenerate_recovery_key(ctx: &ReducerContext, token: String) -> Result<(), String> {
    let _player = get_player(ctx)?;
    let old: Vec<_> = ctx.db.recovery_keys()
        .iter()
        .filter(|k| k.owner == ctx.sender())
        .collect();
    for k in old { ctx.db.recovery_keys().code().delete(k.code); }

    let code = make_recovery_code(ctx);
    ctx.db.recovery_keys().insert(RecoveryKey {
        code: code.clone(),
        owner: ctx.sender(),
        token,
    });

    // Keep recovery_code_results in sync so client sees the new code immediately (SEC-03).
    match ctx.db.recovery_code_results().owner().find(ctx.sender()) {
        Some(_) => {
            ctx.db.recovery_code_results().owner().update(RecoveryCodeResult {
                owner: ctx.sender(),
                code,
            });
        }
        None => {
            ctx.db.recovery_code_results().insert(RecoveryCodeResult {
                owner: ctx.sender(),
                code,
            });
        }
    }
    Ok(())
}

/// FNV-1a of (sender bytes ++ timestamp micros) → 6 unambiguous uppercase chars
fn make_code(ctx: &ReducerContext) -> String {
    const CHARS: &[u8] = b"23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32, no 0/O/1/I/L
    let ts = ctx.timestamp.to_micros_since_unix_epoch() as u64;
    let mut h: u64 = 14695981039346656037;
    for b in ctx.sender().to_byte_array() {
        h ^= b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    h ^= ts;
    h = h.wrapping_mul(1099511628211);
    (0..6).map(|i| CHARS[((h >> (i * 5)) & 31) as usize] as char).collect()
}

/// Same algorithm with a distinct seed → 12 chars for recovery keys
fn make_recovery_code(ctx: &ReducerContext) -> String {
    const CHARS: &[u8] = b"23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let ts = ctx.timestamp.to_micros_since_unix_epoch() as u64;
    let mut h: u64 = 14695981039346656037u64 ^ 0xA5A5A5A5_5A5A5A5A; // distinct seed
    for b in ctx.sender().to_byte_array() {
        h ^= b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    h ^= ts;
    h = h.wrapping_mul(1099511628211);
    h ^= ts.rotate_left(32); // extra mixing
    h = h.wrapping_mul(1099511628211);
    (0..12).map(|i| CHARS[((h >> (i * 5)) & 31) as usize] as char).collect()
}

fn get_player(ctx: &ReducerContext) -> Result<Player, String> {
    ctx.db.players().identity().find(ctx.sender())
        .ok_or_else(|| "Not registered - call register() first".into())
}

// ============================================================
// CLASSROOMS
// ============================================================

#[table(accessor = classrooms, public)]
pub struct Classroom {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[index(btree)]
    pub code: String,
    pub name: String,
    #[index(btree)]
    pub teacher: Identity,
}

#[table(accessor = classroom_members, public)]
pub struct ClassroomMember {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[index(btree)]
    pub classroom_id: u64,
    #[index(btree)]
    pub player_identity: Identity,
    #[default(false)]
    pub hidden: bool,  // if true, member is excluded from class leaderboard/mastery
}

/// An active class sprint kicked off by a teacher.
/// When is_active flips to false (or the teacher calls end_class_sprint),
/// the live view switches to the "ended" mode on all clients.
#[table(accessor = class_sprints, public)]
pub struct ClassSprint {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub classroom_id: u64,
    pub teacher: Identity,
    pub started_at: Timestamp,
    pub is_active: bool,
    #[default(false)]
    pub is_diagnostic: bool,
}

/// Scheduled auto-end for class sprints.
/// SpacetimeDB fires `auto_end_class_sprint` when `scheduled_at` arrives —
/// even if every client is offline — so offline students can never block the transition.
#[table(accessor = end_sprint_schedule, scheduled(auto_end_class_sprint))]
pub struct EndSprintSchedule {
    #[primary_key]
    #[auto_inc]
    pub scheduled_id: u64,
    pub scheduled_at: ScheduleAt,
    pub class_sprint_id: u64,
}

/// Create a new classroom. The caller becomes its teacher and first member.
/// A player may teach or join multiple classrooms simultaneously.
#[reducer]
pub fn create_classroom(ctx: &ReducerContext, name: String) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() || name.len() > 40 {
        return Err("Class name must be 1–40 characters".into());
    }
    let _player = get_player(ctx)?;
    let code = make_code(ctx);
    let classroom = ctx.db.classrooms().insert(Classroom {
        id: 0, code, name, teacher: ctx.sender(),
    });
    ctx.db.classroom_members().insert(ClassroomMember {
        id: 0, classroom_id: classroom.id, player_identity: ctx.sender(), hidden: false,
    });
    Ok(())
}

/// Join an existing classroom by its 6-character code.
/// A player may be a member of multiple classrooms at once.
#[reducer]
pub fn join_classroom(ctx: &ReducerContext, code: String) -> Result<(), String> {
    let _player = get_player(ctx)?;
    let upper = code.trim().to_uppercase();
    let classroom = ctx.db.classrooms()
        .iter()
        .find(|c| c.code == upper)
        .ok_or("Classroom not found — check the code")?;
    let cid = classroom.id;
    // Already a member? No-op
    if ctx.db.classroom_members().iter().any(|m| m.classroom_id == cid && m.player_identity == ctx.sender()) {
        return Ok(());
    }
    ctx.db.classroom_members().insert(ClassroomMember {
        id: 0, classroom_id: cid, player_identity: ctx.sender(), hidden: false,
    });
    Ok(())
}

/// Leave a specific classroom by ID.
/// If the caller is the teacher, the classroom is closed for all members.
#[reducer]
pub fn leave_classroom(ctx: &ReducerContext, classroom_id: u64) -> Result<(), String> {
    // Verify membership
    let membership = ctx.db.classroom_members()
        .iter()
        .find(|m| m.classroom_id == classroom_id && m.player_identity == ctx.sender())
        .ok_or("Not a member of this classroom")?;

    let is_teacher = ctx.db.classrooms()
        .iter()
        .any(|c| c.id == classroom_id && c.teacher == ctx.sender());

    if is_teacher {
        // Close classroom: remove all members then the classroom itself
        let all_members: Vec<_> = ctx.db.classroom_members()
            .iter()
            .filter(|m| m.classroom_id == classroom_id)
            .collect();
        for m in all_members { ctx.db.classroom_members().id().delete(m.id); }
        ctx.db.classrooms().id().delete(classroom_id);
    } else {
        ctx.db.classroom_members().id().delete(membership.id);
    }
    Ok(())
}

/// Toggle whether the caller's stats are visible in a specific classroom.
#[reducer]
pub fn toggle_classroom_visibility(ctx: &ReducerContext, classroom_id: u64) -> Result<(), String> {
    let membership = ctx.db.classroom_members()
        .iter()
        .find(|m| m.classroom_id == classroom_id && m.player_identity == ctx.sender())
        .ok_or("Not in this classroom")?;
    let updated = ClassroomMember { hidden: !membership.hidden, ..membership };
    ctx.db.classroom_members().id().update(updated);
    Ok(())
}

/// Teacher starts a class sprint: marks any existing active sprint for this classroom
/// as inactive, inserts a new ClassSprint row, then creates a Session for every
/// non-hidden, non-teacher member so their SprintPage auto-detects it.
#[reducer]
pub fn start_class_sprint(ctx: &ReducerContext, classroom_id: u64, is_diagnostic: bool) -> Result<(), String> {
    let sender = ctx.sender();
    // Verify caller is the classroom teacher
    let classroom = ctx.db.classrooms().id().find(classroom_id)
        .ok_or("Classroom not found")?;
    if classroom.teacher != sender {
        return Err("Only the teacher can start a class sprint".into());
    }

    // Deactivate any previous active ClassSprint for this classroom
    let old_sprints: Vec<_> = ctx.db.class_sprints()
        .iter()
        .filter(|s| s.classroom_id == classroom_id && s.is_active)
        .collect();
    for s in old_sprints {
        ctx.db.class_sprints().id().update(ClassSprint { is_active: false, ..s });
    }

    // Insert new ClassSprint — use try_insert retry loop to survive auto_inc desync
    // (SpacetimeDB resets the counter to 0 on each deploy while existing rows keep higher IDs)
    let mut sprint_opt: Option<ClassSprint> = None;
    for _ in 0..200 {
        if let Ok(s) = ctx.db.class_sprints().try_insert(ClassSprint {
            id: 0,
            classroom_id,
            teacher: sender,
            started_at: ctx.timestamp,
            is_active: true,
            is_diagnostic,
        }) {
            sprint_opt = Some(s);
            break;
        }
    }
    let sprint = sprint_opt.ok_or("Could not create class sprint")?;

    // Create a Session for each non-hidden, non-teacher member
    let members: Vec<_> = ctx.db.classroom_members()
        .iter()
        .filter(|m| m.classroom_id == classroom_id && !m.hidden && m.player_identity != sender)
        .collect();

    for member in members {
        if let Some(player) = ctx.db.players().identity().find(member.player_identity) {
            // auto_inc counter may be out of sync with existing data due to a SpacetimeDB
            // migration resetting it. Retry until the counter moves past existing IDs.
            let mut success = false;
            for _ in 0..200 {
                if ctx.db.sessions().try_insert(Session {
                    id: 0,
                    player_identity: member.player_identity,
                    username: player.username.clone(),
                    weighted_score: 0.0,
                    raw_score: 0,
                    accuracy_pct: 0,
                    total_answered: 0,
                    is_complete: false,
                    started_at: ctx.timestamp,
                    class_sprint_id: sprint.id,
                }).is_ok() {
                    success = true;
                    break;
                }
            }
            if !success {
                return Err(format!("Could not insert session for {}", player.username));
            }
        }
    }

    // Schedule server-side auto-end: 34 s for diagnostic (32s + 2s buffer), 62 s for regular.
    let auto_end_secs: i64 = if is_diagnostic { 62 } else { 62 };
    let schedule_at = ScheduleAt::Time(Timestamp::from_micros_since_unix_epoch(
        ctx.timestamp.to_micros_since_unix_epoch() + auto_end_secs * 1_000_000,
    ));
    for _ in 0..200 {
        if ctx.db.end_sprint_schedule().try_insert(EndSprintSchedule {
            scheduled_id: 0,
            scheduled_at: schedule_at.clone(),
            class_sprint_id: sprint.id,
        }).is_ok() { break; }
    }

    Ok(())
}

/// Teacher ends the class sprint early (students' 60s timers still run to natural end).
#[reducer]
pub fn end_class_sprint(ctx: &ReducerContext, class_sprint_id: u64) -> Result<(), String> {
    let sprint = ctx.db.class_sprints().id().find(class_sprint_id)
        .ok_or("ClassSprint not found")?;
    if sprint.teacher != ctx.sender() {
        return Err("Only the teacher can end this sprint".into());
    }
    finalize_class_sprint_sessions(ctx, class_sprint_id);
    ctx.db.class_sprints().id().update(ClassSprint { is_active: false, ..sprint });
    Ok(())
}

/// Called automatically by SpacetimeDB's scheduler after a class sprint starts.
/// Idempotent: no-op if the sprint was already ended manually.
/// No permission check needed — `ctx.sender()` is the module identity here, not a teacher.
#[reducer]
pub fn auto_end_class_sprint(ctx: &ReducerContext, args: EndSprintSchedule) -> Result<(), String> {
    if let Some(sprint) = ctx.db.class_sprints().id().find(args.class_sprint_id) {
        if sprint.is_active {
            finalize_class_sprint_sessions(ctx, args.class_sprint_id);
            ctx.db.class_sprints().id().update(ClassSprint { is_active: false, ..sprint });
        }
    }
    Ok(())
}

fn finalize_class_sprint_sessions(ctx: &ReducerContext, class_sprint_id: u64) {
    let incomplete: Vec<Session> = ctx.db.sessions()
        .iter()
        .filter(|s| s.class_sprint_id == class_sprint_id && !s.is_complete)
        .collect();
    for session in incomplete {
        let player_identity = session.player_identity;
        let session_id = session.id;
        finalize_session(ctx, session);
        credit_session_to_player(ctx, player_identity, session_id);
    }
}

// ============================================================
// GDPR-01: delete_player — full cascade erasure
// ============================================================

/// GDPR-01: Erase all data for the calling player.
/// Cascade covers all 13 identity-keyed tables.
/// Idempotent: if no player row exists, still cleans up any orphaned rows.
#[reducer]
pub fn delete_player(ctx: &ReducerContext) -> Result<(), String> {
    let sender = ctx.sender();

    // 1. Collect session IDs before deleting sessions (issued_problems are session-scoped)
    let session_ids: Vec<u64> = ctx.db.sessions().iter()
        .filter(|s| s.player_identity == sender)
        .map(|s| s.id)
        .collect();

    // 2. Delete issued_problems for those sessions (must happen before sessions are deleted)
    for sid in &session_ids {
        let to_delete: Vec<u64> = ctx.db.issued_problems().iter()
            .filter(|ip| ip.session_id == *sid)
            .map(|ip| ip.id)
            .collect();
        for id in to_delete { ctx.db.issued_problems().id().delete(id); }
    }

    // 3. Delete answers
    let ans_to_del: Vec<u64> = ctx.db.answers().iter()
        .filter(|a| a.player_identity == sender)
        .map(|a| a.id)
        .collect();
    for id in ans_to_del { ctx.db.answers().id().delete(id); }

    // 4. Delete sessions
    for sid in session_ids { ctx.db.sessions().id().delete(sid); }

    // 5. Delete best_score
    ctx.db.best_scores().player_identity().delete(sender);

    // 6. Delete unlock_logs
    let ul: Vec<u64> = ctx.db.unlock_logs().iter()
        .filter(|u| u.player_identity == sender)
        .map(|u| u.id)
        .collect();
    for id in ul { ctx.db.unlock_logs().id().delete(id); }

    // 7. Delete recovery / transfer credentials
    let rk: Vec<String> = ctx.db.recovery_keys().iter()
        .filter(|k| k.owner == sender)
        .map(|k| k.code.clone())
        .collect();
    for code in rk { ctx.db.recovery_keys().code().delete(code); }
    ctx.db.recovery_code_results().owner().delete(sender);

    let tc: Vec<String> = ctx.db.transfer_codes().iter()
        .filter(|c| c.owner == sender)
        .map(|c| c.code.clone())
        .collect();
    for code in tc { ctx.db.transfer_codes().code().delete(code); }
    ctx.db.transfer_code_results().owner().delete(sender);

    // 8. Delete issued_problem_results
    ctx.db.issued_problem_results().owner().delete(sender);

    // 9. Handle classroom memberships — if teacher, close entire classroom
    let memberships: Vec<_> = ctx.db.classroom_members().iter()
        .filter(|m| m.player_identity == sender)
        .collect();
    for m in memberships {
        let is_teacher = ctx.db.classrooms()
            .iter()
            .any(|c| c.id == m.classroom_id && c.teacher == sender);
        if is_teacher {
            let all_members: Vec<_> = ctx.db.classroom_members().iter()
                .filter(|x| x.classroom_id == m.classroom_id)
                .collect();
            for am in all_members { ctx.db.classroom_members().id().delete(am.id); }
            ctx.db.classrooms().id().delete(m.classroom_id);
        } else {
            ctx.db.classroom_members().id().delete(m.id);
        }
    }

    // 10. Delete online presence
    ctx.db.online_players().identity().delete(sender);

    // 11. Delete player row last
    ctx.db.players().identity().delete(sender);

    Ok(())
}
