// Sprint reducers: start_session, issue_problem, next_problem, submit_answer,
// finalize_session, end_session, credit_session_to_player

use spacetimedb::{reducer, ReducerContext, Table, Identity};
use crate::{
    Player, Session, Answer, IssuedProblem, IssuedProblemResult,
    SprintSequence, NextProblemResult, ProblemStat, BestScore,
    get_player, make_code, pair_learning_tier,
    bootstrap_weight, build_sequence, check_and_unlock,
    MAX_ANSWERS_PER_SESSION, MIN_RESPONSE_MS, MAX_RESPONSE_MS,
};
use crate::{
    players, sessions, answers, issued_problems, issued_problem_results,
    sprint_sequences, next_problem_results, problem_stats, best_scores,
};

#[reducer]
pub fn start_session(ctx: &ReducerContext) -> Result<(), String> {
    let player = get_player(ctx)?;

    // Close any orphaned incomplete solo sessions for this player.
    // These arise from abandoned sprints or from the restore-incident (sessions
    // restored as is_complete=false with no SprintSequence).  Marking them complete
    // ensures SprintPage always picks the freshly-created session.
    let orphans: Vec<_> = ctx.db.sessions()
        .iter()
        .filter(|s| s.player_identity == ctx.sender() && !s.is_complete && s.class_sprint_id == 0)
        .collect();
    for s in orphans {
        ctx.db.sessions().id().update(Session { is_complete: true, ..s });
    }

    for _ in 0..200 {
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
        }) {
            // SEQ: generate and store problem sequence for this session
            let seq_str = build_sequence(ctx, inserted.id, player.learning_tier, player.extended_mode, player.extended_level);
            ctx.db.sprint_sequences().insert(SprintSequence {
                session_id: inserted.id,
                player_identity: ctx.sender(),
                sequence: seq_str,
                index: 0,
            });
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
    let player = get_player(ctx)?;
    let is_extended_pair = a.max(b) >= 11 && a.max(b) <= 20;
    if is_extended_pair {
        if !player.extended_mode {
            return Err("Extended mode not enabled".into());
        }
        if a.max(b) > 11 + player.extended_level {
            return Err("Extended pair not yet unlocked".into());
        }
        let key = (a as u16) * 100 + (b as u16);
        if ctx.db.problem_stats().problem_key().find(key).is_none() {
            return Err("Unknown extended pair".into());
        }
    } else {
        let pair_tier = pair_learning_tier(a, b).ok_or("Invalid problem pair")?;
        if pair_tier > player.learning_tier {
            return Err("Problem pair above player's current tier".into());
        }
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

    // Issue token (reuse SEC-10 IssuedProblem pattern)
    let token = make_code(ctx);
    ctx.db.issued_problems().insert(IssuedProblem {
        id: 0,
        session_id,
        a,
        b,
        token: token.clone(),
    });

    // Upsert NextProblemResult for the client subscription
    match ctx.db.next_problem_results().owner().find(ctx.sender()) {
        Some(_) => {
            ctx.db.next_problem_results().owner().update(NextProblemResult {
                owner: ctx.sender(),
                session_id,
                a,
                b,
                token,
            });
        }
        None => {
            ctx.db.next_problem_results().insert(NextProblemResult {
                owner: ctx.sender(),
                session_id,
                a,
                b,
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

    // SEC-06: (a, b) pair must be within player's learning tier (or extended pool if enabled)
    let is_extended_pair = a.max(b) >= 11 && a.max(b) <= 20;
    if is_extended_pair {
        if !player.extended_mode {
            return Err("Extended mode not enabled".into());
        }
        if a.max(b) > 11 + player.extended_level {
            return Err("Extended pair not yet unlocked".into());
        }
        let key = (a as u16) * 100 + (b as u16);
        if ctx.db.problem_stats().problem_key().find(key).is_none() {
            return Err("Unknown extended pair".into());
        }
    } else {
        let pair_tier = pair_learning_tier(a, b)
            .ok_or_else(|| "Invalid problem pair".to_string())?;
        if pair_tier > player.learning_tier {
            return Err("Problem pair above player's current tier".into());
        }
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
pub(crate) fn finalize_session(ctx: &ReducerContext, session: Session) {
    if session.is_complete { return; }
    let session_id = session.id;
    // SEQ: clean up sprint sequence (no longer needed after session ends)
    ctx.db.sprint_sequences().session_id().delete(session_id);
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
    check_extended_level(ctx, sender);
    Ok(())
}

fn check_extended_level(ctx: &ReducerContext, identity: Identity) {
    let player = match ctx.db.players().identity().find(identity) { Some(p) => p, None => return };
    if !player.extended_mode || player.extended_level >= 9 { return; }
    let current_table = 11u8 + player.extended_level;
    let all_answers: Vec<_> = ctx.db.answers().iter()
        .filter(|a| a.player_identity == identity && a.a.max(a.b) == current_table)
        .collect();
    let last10: Vec<_> = all_answers.iter().rev().take(10).collect();
    if last10.len() < 5 { return; }
    let correct = last10.iter().filter(|a| a.is_correct).count();
    if correct * 10 >= last10.len() * 8 {
        ctx.db.players().identity().update(Player { extended_level: player.extended_level + 1, ..player });
    }
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
