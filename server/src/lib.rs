use spacetimedb::{table, reducer, Table, ReducerContext, Identity, Timestamp};

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
}

#[table(accessor = answers, public)]
pub struct Answer {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub player_identity: Identity,
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
    pub a: u8,
    pub b: u8,
    pub category: u8,        // 0 = trivial (*0/1/10), 1 = core (2-9 x 2-9)
    pub attempt_count: u32,
    pub correct_count: u32,
    pub avg_response_ms: u32,
    pub difficulty_weight: f32,
}

// ============================================================
// INIT
// ============================================================

#[reducer(init)]
pub fn init(ctx: &ReducerContext) {
    seed_problem_stats(ctx);
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
        let new_weight = if new_count >= 20 && stat.category == 1 {
            let error_rate = 1.0 - (new_correct as f32 / new_count as f32);
            let speed_factor = (new_avg_ms as f32 / 10_000.0).min(1.0);
            (0.2_f32 + 1.8 * error_rate + 0.5 * speed_factor).clamp(0.2, 2.0)
        } else {
            stat.difficulty_weight
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
            ctx.db.problem_stats().problem_key().find(key)
                .map(|s| s.difficulty_weight)
                .unwrap_or(1.0)
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
    Ok(())
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
    pub code: String,
    pub name: String,
    pub teacher: Identity,
}

#[table(accessor = classroom_members, public)]
pub struct ClassroomMember {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub classroom_id: u64,
    pub player_identity: Identity,
    #[default(false)]
    pub hidden: bool,  // if true, member is excluded from class leaderboard/mastery
}

/// Create a new classroom. Closes any existing classroom the caller teaches,
/// and removes them from any classroom they're in as a student.
#[reducer]
pub fn create_classroom(ctx: &ReducerContext, name: String) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() || name.len() > 40 {
        return Err("Class name must be 1–40 characters".into());
    }
    let _player = get_player(ctx)?;
    cleanup_classroom(ctx);
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
    cleanup_classroom(ctx);
    ctx.db.classroom_members().insert(ClassroomMember {
        id: 0, classroom_id: cid, player_identity: ctx.sender(), hidden: false,
    });
    Ok(())
}

/// Leave current classroom. If caller is the teacher, closes the classroom for everyone.
#[reducer]
pub fn leave_classroom(ctx: &ReducerContext) -> Result<(), String> {
    cleanup_classroom(ctx);
    Ok(())
}

/// Toggle whether caller's stats are visible to the rest of the class.
#[reducer]
pub fn toggle_classroom_visibility(ctx: &ReducerContext) -> Result<(), String> {
    let membership = ctx.db.classroom_members()
        .iter()
        .find(|m| m.player_identity == ctx.sender())
        .ok_or("Not in a classroom")?;
    let updated = ClassroomMember { hidden: !membership.hidden, ..membership };
    ctx.db.classroom_members().id().update(updated);
    Ok(())
}

/// Remove all classroom traces for ctx.sender:
/// - Closes any classroom they teach (removes all members)
/// - Removes any student memberships they hold
fn cleanup_classroom(ctx: &ReducerContext) {
    // Close classrooms where caller is teacher
    let my_classrooms: Vec<_> = ctx.db.classrooms()
        .iter()
        .filter(|c| c.teacher == ctx.sender())
        .collect();
    for c in my_classrooms {
        let members: Vec<_> = ctx.db.classroom_members()
            .iter()
            .filter(|m| m.classroom_id == c.id)
            .collect();
        for m in members { ctx.db.classroom_members().id().delete(m.id); }
        ctx.db.classrooms().id().delete(c.id);
    }
    // Remove student memberships
    let my_memberships: Vec<_> = ctx.db.classroom_members()
        .iter()
        .filter(|m| m.player_identity == ctx.sender())
        .collect();
    for m in my_memberships { ctx.db.classroom_members().id().delete(m.id); }
}
