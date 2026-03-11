use spacetimedb::{table, reducer, Table, ReducerContext, Identity, Timestamp, ScheduleAt};

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

// ============================================================
// INIT
// ============================================================

#[reducer(init)]
pub fn init(ctx: &ReducerContext) {
    seed_problem_stats(ctx);
    seed_tier1_problem_stats(ctx);
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

#[reducer]
pub fn register(ctx: &ReducerContext, username: String) -> Result<(), String> {
    let name = username.trim().to_string();
    if name.is_empty() || name.len() > 24 {
        return Err("Username must be 1-24 characters".into());
    }
    let sender = ctx.sender();
    if let Some(existing) = ctx.db.players().identity().find(sender) {
        ctx.db.players().identity().update(Player { username: name, ..existing });
    } else {
        ctx.db.players().insert(Player {
            identity: sender,
            username: name,
            best_score: 0.0,
            total_sessions: 0,
            total_correct: 0,
            total_answered: 0,
            onboarding_done: false,
            learning_tier: 0,
            recovery_emailed: false,
        });
    }
    Ok(())
}

#[reducer]
pub fn start_session(ctx: &ReducerContext) -> Result<(), String> {
    let player = get_player(ctx)?;
    ctx.db.sessions().insert(Session {
        id: 0,
        player_identity: ctx.sender(),
        username: player.username,
        weighted_score: 0.0,
        raw_score: 0,
        accuracy_pct: 0,
        total_answered: 0,
        is_complete: false,
        started_at: ctx.timestamp,
        class_sprint_id: 0,
    });
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
) -> Result<(), String> {
    let sender = ctx.sender();
    let _player = get_player(ctx)?;

    let session = ctx.db.sessions().id().find(session_id)
        .ok_or("Session not found")?;
    if session.player_identity != sender { return Err("Not your session".into()); }
    if session.is_complete { return Err("Session already complete".into()); }

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

#[reducer]
pub fn end_session(ctx: &ReducerContext, session_id: u64) -> Result<(), String> {
    let sender = ctx.sender();
    let player = get_player(ctx)?;

    let session = ctx.db.sessions().id().find(session_id)
        .ok_or("Session not found")?;
    if session.player_identity != sender { return Err("Not your session".into()); }
    if session.is_complete { return Ok(()); }

    let session_answers: Vec<Answer> = ctx.db.answers()
        .iter()
        .filter(|a| a.session_id == session_id)
        .collect();

    let total = session_answers.len() as u32;
    if total == 0 {
        ctx.db.sessions().id().update(Session { is_complete: true, ..session });
        return Ok(());
    }

    let raw_score = session_answers.iter().filter(|a| a.is_correct).count() as u32;
    let accuracy_pct = ((raw_score * 100) / total).min(100) as u8;
    let weighted_score: f32 = session_answers.iter()
        .filter(|a| a.is_correct)
        .map(|a| {
            let key = (a.a as u16) * 100 + (a.b as u16);
            let base = ctx.db.problem_stats().problem_key().find(key)
                .map(|s| s.difficulty_weight)
                .unwrap_or(1.0);
            // Bonus for double-digit factors (11×, 12×) — harder mentally and require
            // typing more digits. +0.5 for any 11×/12× answer; +1.0 when the result
            // is three digits (≥ 100), e.g. 12×9=108 or 11×12=132.
            let digit_bonus: f32 = if a.a.max(a.b) >= 11 {
                if (a.a as u32) * (a.b as u32) >= 100 { 1.0 } else { 0.5 }
            } else { 0.0 };
            base + digit_bonus
        })
        .sum();

    ctx.db.sessions().id().update(Session {
        weighted_score,
        raw_score,
        accuracy_pct,
        total_answered: total,
        is_complete: true,
        ..session
    });

    let new_best = player.best_score.max(weighted_score);
    ctx.db.players().identity().update(Player {
        best_score: new_best,
        total_sessions: player.total_sessions + 1,
        total_correct: player.total_correct + raw_score,
        total_answered: player.total_answered + total,
        ..player
    });
    check_and_unlock(ctx, sender, session_id);

    // Upsert BestScore — re-read player to pick up updated learning_tier from check_and_unlock
    if let Some(up) = ctx.db.players().identity().find(sender) {
        match ctx.db.best_scores().player_identity().find(sender) {
            Some(prev) => {
                // Always refresh username + tier; keep whichever score is higher
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
                    player_identity: sender,
                    username: up.username.clone(),
                    best_weighted_score: weighted_score,
                    best_accuracy_pct: accuracy_pct,
                    best_total_answered: total,
                    learning_tier: up.learning_tier,
                });
            }
        }
    }
    Ok(())
}

/// Returns the learning tier for a factor value (None = excluded, i.e. ×0).
fn factor_tier(x: u8) -> Option<u8> {
    match x {
        0 => None,
        1 | 2 | 5 | 10 => Some(0),
        3 | 4 => Some(1),
        6 | 7 | 8 | 9 => Some(2),
        _ => Some(3), // 11, 12, 15, 20, 25
    }
}

/// Learning tier of an ordered pair = max(tier(a), tier(b)).
/// Returns None for excluded pairs (those involving ×0).
fn pair_learning_tier(a: u8, b: u8) -> Option<u8> {
    match (factor_tier(a), factor_tier(b)) {
        (Some(ta), Some(tb)) => Some(ta.max(tb)),
        _ => None,
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

    for target_tier in (player.learning_tier + 1)..=3u8 {
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

#[table(accessor = transfer_codes, public)]
pub struct TransferCode {
    #[primary_key]
    pub code: String,
    pub owner: Identity,
    pub token: String,
    pub created_at: Timestamp,
}

/// Update display name (also patches all existing incomplete sessions)
#[reducer]
pub fn set_username(ctx: &ReducerContext, new_username: String) -> Result<(), String> {
    let name = new_username.trim().to_string();
    if name.is_empty() || name.len() > 24 {
        return Err("Username must be 1–24 characters".into());
    }
    let player = get_player(ctx)?;
    ctx.db.players().identity().update(Player { username: name.clone(), ..player });
    // Keep BestScore.username in sync
    if let Some(bs) = ctx.db.best_scores().player_identity().find(ctx.sender()) {
        ctx.db.best_scores().player_identity().update(BestScore { username: name, ..bs });
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
        code,
        owner: ctx.sender(),
        token,
        created_at: ctx.timestamp,
    });
    Ok(())
}

/// Called by the new device after it has read and stored the token — deletes the row.
#[reducer]
pub fn use_transfer_code(ctx: &ReducerContext, code: String) -> Result<(), String> {
    ctx.db.transfer_codes().code().delete(code);
    Ok(())
}

// ============================================================
// RECOVERY KEYS  (permanent, multi-use, 12 chars)
// ============================================================

/// One permanent recovery key per player. Never expires, survives logout.
/// Lets you reclaim your account from any device at any future point.
#[table(accessor = recovery_keys, public)]
pub struct RecoveryKey {
    #[primary_key]
    pub code: String,
    pub owner: Identity,
    pub token: String,
}

/// Generate (or replace) the caller's permanent recovery key.
#[reducer]
pub fn create_recovery_key(ctx: &ReducerContext, token: String) -> Result<(), String> {
    let _player = get_player(ctx)?;
    // Remove any previous recovery key for this owner
    let old: Vec<_> = ctx.db.recovery_keys()
        .iter()
        .filter(|k| k.owner == ctx.sender())
        .collect();
    for k in old { ctx.db.recovery_keys().code().delete(k.code); }

    let code = make_recovery_code(ctx);
    ctx.db.recovery_keys().insert(RecoveryKey {
        code,
        owner: ctx.sender(),
        token,
    });
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
pub fn start_class_sprint(ctx: &ReducerContext, classroom_id: u64) -> Result<(), String> {
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

    // Insert new ClassSprint
    let sprint = ctx.db.class_sprints().insert(ClassSprint {
        id: 0,
        classroom_id,
        teacher: sender,
        started_at: ctx.timestamp,
        is_active: true,
    });

    // Create a Session for each non-hidden, non-teacher member
    let members: Vec<_> = ctx.db.classroom_members()
        .iter()
        .filter(|m| m.classroom_id == classroom_id && !m.hidden && m.player_identity != sender)
        .collect();

    for member in members {
        if let Some(player) = ctx.db.players().identity().find(member.player_identity) {
            // Skip if that player already has an incomplete session for this class sprint
            // (shouldn't happen, but guards against double-tap)
            let already = ctx.db.sessions()
                .iter()
                .any(|s| s.player_identity == member.player_identity
                    && s.class_sprint_id == sprint.id
                    && !s.is_complete);
            if already { continue; }

            ctx.db.sessions().insert(Session {
                id: 0,
                player_identity: member.player_identity,
                username: player.username,
                weighted_score: 0.0,
                raw_score: 0,
                accuracy_pct: 0,
                total_answered: 0,
                is_complete: false,
                started_at: ctx.timestamp,
                class_sprint_id: sprint.id,
            });
        }
    }

    // Schedule server-side auto-end 62 s from now.
    // Fires even if every client goes offline — offline students can never block the transition.
    ctx.db.end_sprint_schedule().insert(EndSprintSchedule {
        scheduled_id: 0,
        scheduled_at: ScheduleAt::Time(Timestamp::from_micros_since_unix_epoch(
            ctx.timestamp.to_micros_since_unix_epoch() + 62 * 1_000_000,
        )),
        class_sprint_id: sprint.id,
    });

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
    ctx.db.class_sprints().id().update(ClassSprint { is_active: false, ..sprint });
    Ok(())
}

/// Called automatically by SpacetimeDB's scheduler 62 s after a class sprint starts.
/// Idempotent: no-op if the sprint was already ended (manually or by a previous schedule fire).
/// No permission check needed — `ctx.sender()` is the module identity here, not a teacher.
#[reducer]
pub fn auto_end_class_sprint(ctx: &ReducerContext, args: EndSprintSchedule) -> Result<(), String> {
    if let Some(sprint) = ctx.db.class_sprints().id().find(args.class_sprint_id) {
        if sprint.is_active {
            ctx.db.class_sprints().id().update(ClassSprint { is_active: false, ..sprint });
        }
    }
    Ok(())
}
