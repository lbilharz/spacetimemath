// Sprint reducers: start_session, issue_problem, next_problem, submit_answer,
// finalize_session, end_session, credit_session_to_player

use spacetimedb::{reducer, ReducerContext, Table, Identity};
use crate::{
    Player, Session, Answer, IssuedProblemV2, IssuedProblemResultV2,
    SprintSequence, NextProblemResultV2, ProblemStat, BestScore,
    get_player, make_code, pair_learning_tier,
    bootstrap_weight, build_sequence, check_and_unlock,
    MAX_ANSWERS_PER_SESSION, MIN_RESPONSE_MS, MAX_RESPONSE_MS,
};
use crate::{
    players, sessions, answers, issued_problems_v2, issued_problem_results_v2,
    sprint_sequences, next_problem_results_v2, problem_stats, best_scores,
    player_dkt_weights, classrooms, classroom_members, diagnostic_states,
    DiagnosticState
};

fn splitmix64(mut x: u64) -> u64 {
    x = x.wrapping_add(0x9E3779B97F4A7C15);
    x = (x ^ (x >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    x = (x ^ (x >> 27)).wrapping_mul(0x94D049BB133111EB);
    x ^ (x >> 31)
}

fn generate_tap_options(session_id: u64, a: u8, b: u8) -> Vec<u32> {
    let ans = (a as u32) * (b as u32);
    let mut pool = Vec::new();
    
    // Neighbors
    if b < 255 { pool.push((a as u32) * (b as u32 + 1)); }
    if b > 1 { pool.push((a as u32) * (b as u32 - 1)); }
    if a < 255 { pool.push((a as u32 + 1) * (b as u32)); }
    if a > 1 { pool.push((a as u32 - 1) * (b as u32)); }
    
    // +/- 10
    pool.push(ans + 10);
    if ans > 10 { pool.push(ans - 10); }
    
    // Addition confusion
    pool.push((a as u32) + (b as u32));
    
    // Transposition (e.g., 42 -> 24)
    if ans >= 10 && ans % 10 != ans / 10 {
        let flipped = (ans % 10) * 10 + (ans / 10);
        pool.push(flipped);
    }
    
    // Filter out invalid/duplicate/correct answers
    pool.retain(|&x| x > 0 && x != ans);
    pool.sort_unstable();
    pool.dedup();
    
    let mut seed = splitmix64(session_id ^ ((a as u64) << 32 | (b as u64) << 16));
    
    // Shuffle pool
    for i in (1..pool.len()).rev() {
        seed = splitmix64(seed);
        let j = (seed as usize) % (i + 1);
        pool.swap(i, j);
    }


    
    // Take exactly 3 distractors
    let mut options: Vec<u32> = pool.into_iter().take(3).collect();
    
    // In case pool was too small (unlikely), pad safely
    let mut pad = 1;
    while options.len() < 3 {
        let candidate = ans + pad;
        if candidate != ans && !options.contains(&candidate) {
            options.push(candidate);
        }
        pad += 1;
    }
    
    // Insert correct answer
    options.push(ans);
    
    // Shuffle options so correct answer isn't always last
    for i in (1..options.len()).rev() {
        seed = splitmix64(seed);
        let j = (seed as usize) % (i + 1);
        options.swap(i, j);
    }
    
    options
}

#[reducer]
pub fn start_session(ctx: &ReducerContext) -> Result<(), String> {
    let player = get_player(ctx)?;

    // Close any orphaned incomplete solo sessions for this player.
    // These arise from abandoned sprints or from the restore-incident (sessions
    // restored as is_complete=false with no SprintSequence).  Marking them complete
    // ensures SprintPage always picks the freshly-created session.
    let sender = ctx.sender();
    let orphans: Vec<_> = ctx.db.sessions()
        .player_identity().filter(&sender)
        .filter(|s| !s.is_complete && s.class_sprint_id == 0)
        .collect();
    for s in orphans {
        ctx.db.sessions().id().update(Session { is_complete: true, ..s });
    }

    // STDB resets the auto_inc counter to 0 on every server restart, causing try_insert
    // to collide with existing session IDs until the counter advances past the highest ID.
    // We derive the limit from max(existing id) so it's always sufficient regardless of
    // how many sessions accumulate over time. +500 provides headroom for concurrent inserts.
    let session_limit = ctx.db.sessions().iter().map(|s| s.id).max().unwrap_or(0) as usize + 500;
    for _ in 0..session_limit {
        if let Ok(inserted) = ctx.db.sessions().try_insert(Session {
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
            heat: 0,
        }) {
            if player.total_sessions == 0 {
                ctx.db.diagnostic_states().insert(DiagnosticState {
                    session_id: inserted.id,
                    player_identity: ctx.sender(),
                    current_tier: crate::diagnostic_seed_tier(ctx, ctx.sender()),
                    consecutive_fast_correct: 0,
                    wrong_streak: 0,
                    force_tap_mode: false,
                });
            } else {
                let seq_str = build_sequence(ctx, inserted.id, player.learning_tier, player.extended_mode, player.extended_level);
                ctx.db.sprint_sequences().insert(SprintSequence {
                    session_id: inserted.id,
                    player_identity: ctx.sender(),
                    sequence: seq_str,
                    index: 0,
                });
            }
            return Ok(());
        }
    }
    Err("Could not start session".to_string())
}

#[reducer]
pub fn start_diagnostic_session(ctx: &ReducerContext) -> Result<(), String> {
    let player = get_player(ctx)?;

    // Close any orphaned incomplete solo sessions
    let sender = ctx.sender();
    let orphans: Vec<_> = ctx.db.sessions()
        .player_identity().filter(&sender)
        .filter(|s| !s.is_complete && s.class_sprint_id == 0)
        .collect();
    for s in orphans {
        ctx.db.sessions().id().update(Session { is_complete: true, ..s });
    }

    let session_limit = ctx.db.sessions().iter().map(|s| s.id).max().unwrap_or(0) as usize + 500;
    for _ in 0..session_limit {
        if let Ok(inserted) = ctx.db.sessions().try_insert(Session {
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
            heat: 0,
        }) {
            ctx.db.diagnostic_states().insert(DiagnosticState {
                session_id: inserted.id,
                player_identity: ctx.sender(),
                current_tier: crate::diagnostic_seed_tier(ctx, ctx.sender()),
                consecutive_fast_correct: 0,
                wrong_streak: 0,
                force_tap_mode: false,
            });
            return Ok(());
        }
    }
    Err("Could not start diagnostic session".to_string())
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
    let player = get_player(ctx)?;
    let is_diag = ctx.db.diagnostic_states().session_id().find(session_id).is_some();

    let pair_tier = pair_learning_tier(a, b).ok_or("Invalid problem pair")?;
    if !is_diag {
        if (a > 10 || b > 10) && !player.extended_mode {
            return Err("Extended problems not unlocked".into());
        }
        if pair_tier > player.learning_tier {
            return Err("Problem pair above player's current tier".into());
        }
    }
    let token = make_code(ctx);
    
    let session = ctx.db.sessions().id().find(session_id).ok_or_else(|| "Session not found".to_string())?;
    let prompt_mode = if session.heat >= 3 { 0 } else { 1 };
    
    let options = if prompt_mode == 1 { generate_tap_options(session_id, a, b) } else { vec![] };
    let options_res = options.clone(); // For the result table
    let _generated_kcs = crate::generator::calculate_kcs_for_multiplication(a, b);

    ctx.db.issued_problems_v2().insert(IssuedProblemV2 {
        id: 0,
        session_id,
        a,
        b,
        prompt_mode,
        options: options.clone(),
        token: token.clone(),
    });
    // Write token to result table for client to read
    let existing_result = ctx.db.issued_problem_results_v2().owner().find(ctx.sender());
    match existing_result {
        Some(_) => {
            ctx.db.issued_problem_results_v2().owner().update(IssuedProblemResultV2 {
                owner: ctx.sender(),
                token,
                prompt_mode,
                options: options_res,
            });
        }
        None => {
            ctx.db.issued_problem_results_v2().insert(IssuedProblemResultV2 {
                owner: ctx.sender(),
                token,
                prompt_mode,
                options: options_res,
            });
        }
    }
    Ok(())
}

/// SEQ-01/SEQ-02: Server-driven problem delivery for normal sprints.
/// Reads the next problem from the player's SprintSequence, issues a token via
/// the existing IssuedProblem / IssuedProblemResult pattern (SEC-10), and writes
/// the (a, b, token) to NextProblemResult for the client to subscribe to.
/// Diagnostic sprints remain client-driven (issue_problem still handles those).
#[reducer]
pub fn next_problem(ctx: &ReducerContext, session_id: u64) -> Result<(), String> {
    let session = ctx.db.sessions().id().find(session_id)
        .ok_or("Session not found")?;
    if session.player_identity != ctx.sender() {
        return Err("Not your session".into());
    }
    if session.is_complete {
        return Err("Session already complete".into());
    }

    let session = ctx.db.sessions().id().find(session_id).ok_or_else(|| "Session not found".to_string())?;

    let (a, b, prompt_mode) = if let Some(diag) = ctx.db.diagnostic_states().session_id().find(session_id) {
        // --- TIER CLIMBER ---
        let mut a: u8;
        let mut b: u8;
        // Simple mapping representing tiers. 
        // Real tier mapping: Tier 1=Add/Sub Tier 2=Multiplication etc, but for spacetimemath,
        // we use learning_tier table. E.g. Tier 1 = max(a,b) <= 3. Tier 2: x5.
        // We will sample based on current_tier to make it simple but accurate.
        let seed_val = (ctx.timestamp.to_micros_since_unix_epoch() as u64) + (diag.current_tier as u64);
        let seed = splitmix64(seed_val);
        let r1 = (seed % 100) as u8;
        let r2 = ((seed / 100) % 100) as u8;
        
        match diag.current_tier {
            1 => { a = r1 % 4 + 1; b = r2 % 3 + 1; }, // 1-4, 1-3
            2 => { a = r1 % 5 + 1; b = 5; },
            3 => { a = r1 % 9 + 2; b = r2 % 2 + 2; }, 
            4 => { a = r1 % 10 + 1; b = 10; },
            5 => { a = r1 % 6 + 4; b = r2 % 6 + 4; }, 
            _ => { a = r1 % 9 + 2; b = r2 % 9 + 2; }, 
        }
        if seed % 2 == 0 { std::mem::swap(&mut a, &mut b); }
        let p_mode = if diag.force_tap_mode { 1 } else { 0 };
        (a, b, p_mode)
    } else {
        // --- STANDARD SEQUENCE ---
        let mut seq = ctx.db.sprint_sequences().session_id().find(session_id)
            .ok_or("No sequence for this session")?;

        let keys: Vec<u16> = if seq.sequence.is_empty() {
            vec![]
        } else {
            seq.sequence.split(',')
                .filter_map(|s| s.parse::<u16>().ok())
                .collect()
        };

        let idx = seq.index as usize;
        if idx >= keys.len() {
            return Err("Sequence exhausted".into());
        }

        let key = keys[idx];
        let a = (key / 100) as u8;
        let b = (key % 100) as u8;

        // Advance index
        seq.index += 1;
        ctx.db.sprint_sequences().session_id().update(seq);
        let p_mode = if session.heat >= 3 { 0 } else { 1 };
        (a, b, p_mode)
    };


    let options = if prompt_mode == 1 { generate_tap_options(session_id, a, b) } else { vec![] };
    let options_sys = options.clone(); // For the IssuedProblemV2 table
    let options_res = options.clone(); // For the NextProblemResultV2 table

    // Issue token (reuse SEC-10 IssuedProblem pattern)
    let token = make_code(ctx); // Assuming make_code(ctx) is the equivalent of generate_random_token()
    let _generated_kcs = crate::generator::calculate_kcs_for_multiplication(a, b);

    ctx.db.issued_problems_v2().insert(IssuedProblemV2 {
        id: 0, // Assuming id is still auto-incremented
        session_id: session.id,
        a,
        b,
        prompt_mode,
        options: options_sys,
        token: token.clone(),
    });

    // Upsert NextProblemResult for the client subscription
    let existing_result = ctx.db.next_problem_results_v2().owner().find(ctx.sender());
    match existing_result {
        Some(_) => {
            ctx.db.next_problem_results_v2().owner().update(NextProblemResultV2 {
                owner: ctx.sender(),
                session_id: session.id,
                a,
                b,
                prompt_mode,
                options: options_res,
                token,
            });
        }
        None => {
            ctx.db.next_problem_results_v2().insert(NextProblemResultV2 {
                owner: ctx.sender(), session_id: session.id, a, b, prompt_mode, options: options_res, token
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
    attempts: u8,
    problem_token: String,
) -> Result<(), String> {
    let sender = ctx.sender();
    let player = get_player(ctx)?;

    let session = ctx.db.sessions().id().find(session_id)
        .ok_or("Session not found")?;
    if session.player_identity != sender { return Err("Not your session".into()); }
    if session.is_complete { return Err("Session already complete".into()); }

    // Validate attempts
    if attempts < 1 {
        return Err("Attempts must be at least 1".into());
    }

    // SEC-05: response_ms bounds
    if response_ms < MIN_RESPONSE_MS {
        return Err("Response time below minimum threshold".into());
    }
    if response_ms > MAX_RESPONSE_MS {
        return Err("Response time above maximum threshold".into());
    }

    // SEC-04: per-session answer cap
    let existing_count = ctx.db.answers()
        .session_id().filter(&session_id)
        .count();
    if existing_count >= MAX_ANSWERS_PER_SESSION {
        return Err("Session answer limit reached".into());
    }

    // SEC-06: (a, b) pair must be within player's learning tier (or extended pool if enabled)
    let is_diag = ctx.db.diagnostic_states().session_id().find(session_id).is_some();

    let pair_tier = pair_learning_tier(a, b)
        .ok_or_else(|| "Invalid problem pair".to_string())?;
    if !is_diag {
        if (a > 10 || b > 10) && !player.extended_mode {
            return Err("Extended problems not unlocked".into());
        }
        if pair_tier > player.learning_tier {
            return Err("Problem pair above player's current tier".into());
        }
    }

    // SEC-10: verify server-issued problem token
    let issued = ctx.db.issued_problems_v2()
        .iter()
        .find(|ip| ip.session_id == session_id && ip.a == a && ip.b == b && ip.token == problem_token)
        .ok_or_else(|| "Problem not issued or token invalid".to_string())?;
    let issued_id = issued.id;
    let answered_prompt_mode = issued.prompt_mode;
    ctx.db.issued_problems_v2().id().delete(issued_id); // one-time use
    ctx.db.issued_problem_results_v2().owner().delete(ctx.sender());

    let correct_answer = (a as u32) * (b as u32);
    let is_correct = user_answer == correct_answer;

    // --- TIER CLIMBER LOGIC ---
    if let Some(mut diag) = ctx.db.diagnostic_states().session_id().find(session_id) {
        let is_fast = response_ms < 4000;
        if is_correct {
            diag.wrong_streak = 0;
            diag.force_tap_mode = false;
            if is_fast {
                diag.consecutive_fast_correct += 1;
                if diag.consecutive_fast_correct >= 2 {
                    let max_tier = if player.extended_mode { crate::MAX_EXTENDED_TIER } else { crate::MAX_STANDARD_TIER };
                    diag.current_tier = diag.current_tier.saturating_add(1).min(max_tier);
                    diag.consecutive_fast_correct = 0;
                }
            } else {
                diag.consecutive_fast_correct = 0;
            }
        } else {
            diag.consecutive_fast_correct = 0;
            diag.wrong_streak += 1;
            if diag.wrong_streak == 2 {
                diag.force_tap_mode = true;
            } else if diag.wrong_streak >= 3 {
                diag.current_tier = diag.current_tier.saturating_sub(1).max(1);
                diag.wrong_streak = 0;
                diag.force_tap_mode = false;
            }
        }
        ctx.db.diagnostic_states().session_id().update(diag);
    }

    // Track Heat in the Session
    let mut session = ctx.db.sessions().id().find(session_id).ok_or_else(|| "Session not found".to_string())?;
    if is_correct && response_ms <= 3000 {
        session.heat = session.heat.saturating_add(1);
    } else if !is_correct || response_ms > 6000 {
        session.heat = 0;
    }
    ctx.db.sessions().id().update(session);

    // In-reducer BKT mastery update.
    // Success = correct, single attempt, under 4s. Anything else counts as miss.
    let generated_kcs = crate::generator::calculate_kcs_for_multiplication(a, b);
    let is_dkt_success = if is_correct && attempts == 1 && response_ms < 4000 { 1.0_f32 } else { 0.0_f32 };
    
    // Seed with the neutral 0.5 prior; pad legacy short vectors up to KC_COUNT
    // so new KC slots (e.g. Fact3s through Fact8s) aren't silently dropped.
    // Decay first so time-between-answers shows up in the persisted snapshot
    // (a player returning after a month won't accidentally keep their old
    // mastery and bypass tier gates).
    let mut current_weights = if let Some(existing) = ctx.db.player_dkt_weights().player_identity().find(player.identity) {
        let padded = crate::ensure_kc_mastery_len(existing.kc_mastery.clone());
        crate::decay_mastery(padded, existing.last_updated_timestamp, ctx.timestamp.to_micros_since_unix_epoch())
    } else {
        vec![0.5_f32; crate::generator::KC_COUNT]
    };
    
    for &kc in &generated_kcs {
        let idx = (kc as usize).saturating_sub(1); // KC enum is 1-based, array is 0-based
        if idx < current_weights.len() {
            if is_dkt_success == 1.0 {
                current_weights[idx] = (current_weights[idx] + 0.15).min(0.99);
            } else {
                current_weights[idx] = (current_weights[idx] - 0.25).max(0.01);
            }
        }
    }
    
    let new_dkt = crate::PlayerDktWeights {
        player_identity: player.identity,
        kc_mastery: current_weights,
        last_updated_timestamp: ctx.timestamp.to_micros_since_unix_epoch() as u64,
    };
    match ctx.db.player_dkt_weights().player_identity().find(player.identity) {
        Some(_) => { ctx.db.player_dkt_weights().player_identity().update(new_dkt); }
        None => { ctx.db.player_dkt_weights().insert(new_dkt); }
    }

    // try_insert retry loop: auto_inc counter may be out of sync with restored rows.
    for _ in 0..200 {
        if ctx.db.answers().try_insert(Answer {
            id: 0,
            player_identity: sender,
            session_id,
            a, b,
            user_answer,
            is_correct,
            response_ms,
            attempts,
            prompt_mode: answered_prompt_mode,
            answered_at: ctx.timestamp,
        }).is_ok() { break; }
    }

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
pub(crate) fn finalize_session(ctx: &ReducerContext, session: Session) {
    if session.is_complete { return; }
    let session_id = session.id;
    // SEQ: clean up sprint sequence (no longer needed after session ends)
    ctx.db.sprint_sequences().session_id().delete(session_id);
    let answers: Vec<Answer> = ctx.db.answers().session_id().filter(&session_id).collect();
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
            let derived_difficulty = ctx.db.problem_stats().problem_key().find(key)
                .map(|s| s.difficulty_weight).unwrap_or(1.0);
            let digit_bonus: f32 = if a.a.max(a.b) >= 11 {
                if (a.a as u32) * (a.b as u32) >= 100 { 1.0 } else { 0.5 }
            } else { 0.0 };
            
            let base = derived_difficulty + digit_bonus;
            
            let modality_multiplier = if a.prompt_mode == 0 { 3.0 } else { 1.0 };
            let consistency_multiplier = if a.attempts == 1 { 1.0 } else { 0.5 };
            let speed_bonus = if a.response_ms < 2000 { 1.5 } else { 1.0 };
            
            base * modality_multiplier * consistency_multiplier * speed_bonus
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



pub(crate) fn credit_session_to_player(ctx: &ReducerContext, identity: Identity, session_id: u64) {
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
    
    // Check if this was a diagnostic placement match
    let max_tier = if player.extended_mode { crate::MAX_EXTENDED_TIER } else { crate::MAX_STANDARD_TIER };
    let mut final_learning_tier = player.learning_tier.min(max_tier);
    if let Some(diag) = ctx.db.diagnostic_states().session_id().find(session_id) {
        // Cap the diagnostic promotion at the highest tier the player actually
        // demonstrates DKT mastery for. Prevents the "zero-answer session
        // promotes to tier 1" bug where the diagnostic default seed leaked
        // straight onto the player's learning_tier.
        let claimed = diag.current_tier.min(max_tier);
        let mut supported = player.learning_tier.min(max_tier);
        for tier in (supported + 1)..=claimed {
            if crate::has_dkt_mastery_for_tier(ctx, identity, tier - 1) {
                supported = tier;
            } else {
                break;
            }
        }
        final_learning_tier = supported;
        ctx.db.diagnostic_states().session_id().delete(session_id);
    }

    ctx.db.players().identity().update(Player {
        best_score: new_best,
        total_sessions: player.total_sessions + 1,
        total_correct: player.total_correct + raw_score,
        total_answered: player.total_answered + total,
        learning_tier: final_learning_tier,
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

#[reducer]
pub fn focus_student(ctx: &ReducerContext, student_id: Option<Identity>) -> Result<(), String> {
    use crate::teacher_focus;

    // SEC-11: Only teachers can focus on students
    let player = ctx.db.players().identity().find(ctx.sender())
        .ok_or("Player not found")?;
    if player.player_type != crate::PlayerType::Teacher {
        return Err("Only teachers can focus students".into());
    }

    // SEC-12: If focusing a student, verify they share a classroom
    if let Some(sid) = &student_id {
        let teacher_classrooms: Vec<u64> = ctx.db.classrooms().teacher()
            .filter(&ctx.sender()).map(|c| c.id).collect();
        let student_in_teacher_class = ctx.db.classroom_members()
            .player_identity().filter(sid)
            .any(|m| teacher_classrooms.contains(&m.classroom_id));
        if !student_in_teacher_class {
            return Err("Student is not in your classroom".into());
        }
    }

    ctx.db.teacher_focus().teacher_id().delete(ctx.sender());
    if let Some(id) = student_id {
        ctx.db.teacher_focus().insert(crate::TeacherFocus {
            teacher_id: ctx.sender(),
            focused_student_id: id,
        });
    }
    Ok(())
}

#[reducer]
pub fn sync_keystroke(ctx: &ReducerContext, current_input: String) -> Result<(), String> {
    use crate::teacher_focus;
    use crate::student_keystrokes;
    // Check if any teacher is actively watching this student
    let is_focused = ctx.db.teacher_focus().focused_student_id().filter(&ctx.sender()).next().is_some();
    if is_focused {
        ctx.db.student_keystrokes().student_id().delete(ctx.sender());
        ctx.db.student_keystrokes().insert(crate::StudentKeystroke {
            student_id: ctx.sender(),
            current_input,
            timestamp: ctx.timestamp,
        });
    }
    Ok(())
}

#[reducer]
pub fn fix_tiers(ctx: &ReducerContext) -> Result<(), String> {
    let mut to_update = Vec::new();
    for player in ctx.db.players().iter() {
        if player.learning_tier > 7 {
             to_update.push(crate::Player {
                learning_tier: 7,
                identity: player.identity,
                username: player.username.clone(),
                best_score: player.best_score,
                total_sessions: player.total_sessions,
                total_correct: player.total_correct,
                total_answered: player.total_answered,
                onboarding_done: player.onboarding_done,
                recovery_emailed: player.recovery_emailed,
                extended_mode: player.extended_mode,
                extended_level: player.extended_level,
                player_type: player.player_type,
                class_id: player.class_id,
                email: player.email.clone(),
            });
        }
    }
    for p in to_update {
        ctx.db.players().identity().update(p);
    }
    Ok(())
}
