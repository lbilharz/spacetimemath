use spacetimedb::{table, reducer, Table, ReducerContext, Identity, Timestamp, ScheduleAt};

mod sprint;
mod classroom;
mod auth;
mod security;
mod gdpr;

// Re-export scheduled reducers so the `scheduled(...)` macro in #[table] attributes can find them.
pub use classroom::auto_end_class_sprint;

// ============================================================
// CONSTANTS
// ============================================================

pub(crate) const MAX_ANSWERS_PER_SESSION: usize = 80;
pub(crate) const MIN_RESPONSE_MS: u32 = 200;
pub(crate) const MAX_RESPONSE_MS: u32 = 120_000;

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
    #[default(false)]
    pub extended_mode: bool,
    #[default(0)]
    pub extended_level: u8,
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

/// SEQ-01: Server-side sprint problem sequence (private — never pushed to client).
/// Keyed by session_id; one row per active session.
/// The sequence field is a comma-separated list of problem_keys (a*100+b as u16 values).
/// Deleted when the session is finalized (finalize_session) or the player is erased (delete_player).
#[table(accessor = sprint_sequences)]
pub struct SprintSequence {
    #[primary_key]
    pub session_id: u64,
    pub player_identity: Identity,
    pub sequence: String,   // comma-separated problem_keys: "102,201,310,..."
    pub index: u32,         // pointer to the next problem to serve
}

/// SEQ-02: Public result table for server-driven problem delivery.
/// One row per player — upserted by next_problem reducer.
/// Made public because SpacetimeDB 2.0.3 requires public for row-push to subscribers.
#[table(accessor = next_problem_results, public)]
pub struct NextProblemResult {
    #[primary_key]
    pub owner: Identity,
    pub session_id: u64,
    pub a: u8,
    pub b: u8,
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
    seed_extended_problem_stats(ctx);
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

/// EXT-01: Toggle extended-mode practice (curated 2-digit pairs: ×11,×12,×15,×20,×25).
/// Requires learning_tier >= 7 (Master tier) to enable.
#[reducer]
pub fn set_extended_mode(ctx: &ReducerContext, enabled: bool) -> Result<(), String> {
    let player = get_player(ctx)?;
    if player.learning_tier < 7 {
        return Err("Extended mode requires Master tier (learning_tier 7)".into());
    }
    ctx.db.players().identity().update(Player { extended_mode: enabled, ..player });
    Ok(())
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

/// Migration: seed extended problem stats for ×11–×20 at uniform weight 1.5.
/// Idempotent — safe to call multiple times. Useful to populate extended stats on the
/// live DB without a full reinit.
#[reducer]
pub fn migrate_seed_extended_stats(ctx: &ReducerContext) -> Result<(), String> {
    seed_extended_problem_stats(ctx);
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


fn seed_extended_problem_stats(ctx: &ReducerContext) {
    // Seeds all 10 extended tables (×11 through ×20) at uniform weight 1.5, both orderings.
    // Pairs: a ∈ 11..=20, b ∈ 1..=10. Idempotent — skips existing rows.
    for a in 11u8..=20 {
        for b in 1u8..=10 {
            for &(ra, rb) in &[(a, b), (b, a)] {
                let key = (ra as u16) * 100 + (rb as u16);
                if ctx.db.problem_stats().problem_key().find(key).is_none() {
                    ctx.db.problem_stats().insert(ProblemStat {
                        problem_key: key,
                        a: ra, b: rb, category: 2,
                        attempt_count: 0, correct_count: 0, avg_response_ms: 0,
                        difficulty_weight: 1.5,
                    });
                }
            }
        }
    }
}

pub(crate) fn bootstrap_weight(a: u8, b: u8, category: u8) -> f32 {
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

/// Maximum learning tier index (inclusive). Tiers 0–7 = 8 distinct tiers.
pub(crate) const MAX_TIER: u8 = 7;

/// Returns the learning tier for a factor value.
/// Returns None for excluded factors (×0 and extended: ×11, ×12, ×15, ×20, ×25).
/// Tier ladder: ×1/×2/×10 (0) → ×3 (1) → ×5 (2) → ×4 (3) → ×6 (4) → ×7 (5) → ×8 (6) → ×9 (7).
pub(crate) fn factor_tier(x: u8) -> Option<u8> {
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
pub(crate) fn pair_learning_tier(a: u8, b: u8) -> Option<u8> {
    match (factor_tier(a), factor_tier(b)) {
        (Some(ta), Some(tb)) => Some(ta.min(tb)),
        _ => None,
    }
}

pub(crate) fn check_and_unlock(ctx: &ReducerContext, sender: Identity, session_id: u64) {
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

/// FNV-1a of (sender bytes ++ timestamp micros) → 6 unambiguous uppercase chars
pub(crate) fn make_code(ctx: &ReducerContext) -> String {
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
pub(crate) fn make_recovery_code(ctx: &ReducerContext) -> String {
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

pub(crate) fn get_player(ctx: &ReducerContext) -> Result<Player, String> {
    ctx.db.players().identity().find(ctx.sender())
        .ok_or_else(|| "Not registered - call register() first".into())
}

/// FNV-1a helper for Fisher-Yates per-draw entropy in build_sequence.
pub(crate) fn fnv_index(sender: &Identity, ts: i64, session_id: u64, i: u64) -> u64 {
    let mut h: u64 = 14695981039346656037;
    for b in sender.to_byte_array() {
        h ^= b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    h ^= ts as u64;      h = h.wrapping_mul(1099511628211);
    h ^= session_id;     h = h.wrapping_mul(1099511628211);
    h ^= i;              h = h.wrapping_mul(1099511628211);
    h
}

/// SEQ-01: Build a shuffled problem sequence for a session based on the player's learning tier.
/// Uses Fisher-Yates shuffle (FNV-1a hash chain) then a single pass to fix commutative-pair
/// adjacency (e.g. 4×6 immediately followed by 6×4).
/// Returns a comma-separated string of problem_keys (a*100+b as u16).
pub(crate) fn build_sequence(ctx: &ReducerContext, session_id: u64, player_tier: u8, extended_mode: bool, extended_level: u8) -> String {
    // 1. Collect eligible pool: all ordered pairs (a, b) within player's tier
    //    problem_key = a * 100 + b; exclude pairs where a == 0 || b == 0
    //    If extended_mode is true, also include category=2 (curated 2-digit) pairs
    //    gated by extended_level: only pairs where max(a,b) <= 11 + extended_level.
    let eligible: Vec<ProblemStat> = ctx.db.problem_stats().iter()
        .filter(|s| {
            if s.a == 0 || s.b == 0 { return false; }
            if extended_mode && s.category == 2 {
                return s.a.max(s.b) <= 11 + extended_level;
            }
            pair_learning_tier(s.a, s.b).map(|t| t <= player_tier).unwrap_or(false)
        })
        .collect();

    // 2. Expand into weighted pool: hard problems (high difficulty_weight) get more copies
    let mut pool: Vec<u16> = eligible.into_iter()
        .flat_map(|s| {
            let copies = ((s.difficulty_weight * 3.0).round() as usize).max(1);
            std::iter::repeat(s.problem_key).take(copies)
        })
        .collect();

    // 3. Fisher-Yates shuffle using FNV hash chain
    let n = pool.len();
    let ts = ctx.timestamp.to_micros_since_unix_epoch();
    for i in (1..n).rev() {
        let h = fnv_index(&ctx.sender(), ts, session_id, i as u64);
        let j = (h % (i as u64 + 1)) as usize;
        pool.swap(i, j);
    }

    // 4. Dedup keeping first occurrence (weighted dupes removed, hard problems still appear earlier)
    let mut seen = std::collections::HashSet::new();
    let mut pool: Vec<u16> = pool.into_iter().filter(|k| seen.insert(*k)).collect();

    // 5. Post-shuffle: fix commutative-pair adjacency (one pass)
    //    For each position i where pool[i] and pool[i+1] are commutative pairs
    //    (a*100+b and b*100+a), swap pool[i+1] with pool[i+2] (if exists).
    //    Accept that the very last pair may remain adjacent — edge case, not worth a second pass.
    let m = pool.len();
    let mut i = 0usize;
    while i + 1 < m {
        let key_a = pool[i];
        let key_b = pool[i + 1];
        let a1 = (key_a / 100) as u8;
        let b1 = (key_a % 100) as u8;
        let commutative_of_a = b1 as u16 * 100 + a1 as u16; // = b*100 + a as u16
        if key_b == commutative_of_a {
            // Swap i+1 with i+2 if it exists, otherwise leave as-is (end-of-sequence edge case)
            if i + 2 < m {
                pool.swap(i + 1, i + 2);
            }
            // Skip i+1 (now fixed) to avoid infinite loop on still-adjacent pair
            i += 2;
        } else {
            i += 1;
        }
    }

    // 4. Serialise as comma-separated string
    pool.iter()
        .map(|k| k.to_string())
        .collect::<Vec<_>>()
        .join(",")
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

