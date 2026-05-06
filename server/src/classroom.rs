use spacetimedb::{reducer, ReducerContext, Table, Timestamp, ScheduleAt};
use crate::{
    Session, Classroom, ClassroomMember, ClassSprint, EndSprintSchedule,
    SprintSequence, get_player, make_code, build_sequence, DiagnosticState,
};
use crate::{classrooms, classroom_members, class_sprints, sessions, players,
            end_sprint_schedule, sprint_sequences, diagnostic_states};
use crate::sprint::{finalize_session, credit_session_to_player};

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

    // STDB resets auto_inc counters to 0 on every server restart — derive limits from
    // max existing IDs so the retry loop always clears the stale-counter region.
    let classroom_limit = ctx.db.classrooms().iter().map(|c| c.id).max().unwrap_or(0) as usize + 500;
    let member_limit    = ctx.db.classroom_members().iter().map(|m| m.id).max().unwrap_or(0) as usize + 500;

    let mut classroom_opt: Option<Classroom> = None;
    for _ in 0..classroom_limit {
        if let Ok(c) = ctx.db.classrooms().try_insert(Classroom {
            id: 0, code: code.clone(), name: name.clone(), teacher: ctx.sender(),
        }) {
            classroom_opt = Some(c);
            break;
        }
    }
    let classroom = classroom_opt.ok_or("Failed to create classroom due to ID collision")?;

    for _ in 0..member_limit {
        if ctx.db.classroom_members().try_insert(ClassroomMember {
            id: 0, classroom_id: classroom.id, player_identity: ctx.sender(), hidden: false,
        }).is_ok() {
            break;
        }
    }
    
    Ok(())
}

/// Join an existing classroom by its 6-character code.
/// A player may be a member of multiple classrooms at once.
#[reducer]
pub fn join_classroom(ctx: &ReducerContext, code: String) -> Result<(), String> {
    let _player = get_player(ctx)?;
    let upper = code.trim().to_uppercase();
    let classroom = ctx.db.classrooms()
        .code().filter(&upper)
        .next()
        .ok_or("Classroom not found — check the code")?;
    let cid = classroom.id;
    let sender = ctx.sender();
    // Already a member? No-op
    if ctx.db.classroom_members().player_identity().filter(&sender).any(|m| m.classroom_id == cid) {
        return Ok(());
    }
    let member_limit = ctx.db.classroom_members().iter().map(|m| m.id).max().unwrap_or(0) as usize + 500;
    for _ in 0..member_limit {
        if ctx.db.classroom_members().try_insert(ClassroomMember {
            id: 0, classroom_id: cid, player_identity: sender, hidden: false,
        }).is_ok() {
            break;
        }
    }
    Ok(())
}

/// Leave a specific classroom by ID.
/// If the caller is the teacher, the classroom is closed for all members.
#[reducer]
pub fn leave_classroom(ctx: &ReducerContext, classroom_id: u64) -> Result<(), String> {
    // Verify membership
    let sender = ctx.sender();
    let membership = ctx.db.classroom_members()
        .player_identity().filter(&sender)
        .find(|m| m.classroom_id == classroom_id)
        .ok_or("Not a member of this classroom")?;

    let is_teacher = ctx.db.classrooms()
        .id().find(classroom_id)
        .map(|c| c.teacher == sender)
        .unwrap_or(false);

    if is_teacher {
        // Close classroom: remove all members then the classroom itself
        let all_members: Vec<_> = ctx.db.classroom_members()
            .classroom_id().filter(&classroom_id)
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
    let sender = ctx.sender();
    let membership = ctx.db.classroom_members()
        .player_identity().filter(&sender)
        .find(|m| m.classroom_id == classroom_id)
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
        .classroom_id().filter(&classroom_id)
        .filter(|s| s.is_active)
        .collect();
    for s in old_sprints {
        ctx.db.class_sprints().id().update(ClassSprint { is_active: false, ..s });
    }

    // STDB resets auto_inc counters to 0 on every server restart — derive limits once
    // from max existing IDs so all retry loops clear the stale-counter region.
    let sprint_limit   = ctx.db.class_sprints().iter().map(|s| s.id).max().unwrap_or(0) as usize + 500;
    let session_limit  = ctx.db.sessions().iter().map(|s| s.id).max().unwrap_or(0) as usize + 500;
    let schedule_limit = ctx.db.end_sprint_schedule().iter().map(|e| e.scheduled_id).max().unwrap_or(0) as usize + 500;

    let mut sprint_opt: Option<ClassSprint> = None;
    for _ in 0..sprint_limit {
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
        .classroom_id().filter(&classroom_id)
        .filter(|m| !m.hidden && m.player_identity != sender)
        .collect();

    for member in members {
        if let Some(player) = ctx.db.players().identity().find(member.player_identity) {
            let mut success = false;
            for _ in 0..session_limit {
                if let Ok(inserted_sess) = ctx.db.sessions().try_insert(Session {
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
                    heat: 0,
                }) {
                    if is_diagnostic {
                        ctx.db.diagnostic_states().insert(DiagnosticState {
                            session_id: inserted_sess.id,
                            player_identity: member.player_identity,
                            current_tier: crate::diagnostic_seed_tier(ctx, member.player_identity),
                            consecutive_fast_correct: 0,
                            wrong_streak: 0,
                            force_tap_mode: false,
                        });
                    } else {
                        // SEQ: generate and store problem sequence for this student session
                        // Class sprints don't use extended mode (player.extended_mode ignored for class context)
                        let seq_str = build_sequence(ctx, inserted_sess.id, player.learning_tier, false, 0);
                        ctx.db.sprint_sequences().insert(SprintSequence {
                            session_id: inserted_sess.id,
                            player_identity: member.player_identity,
                            sequence: seq_str,
                            index: 0,
                        });
                    }
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
    for _ in 0..schedule_limit {
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
        .class_sprint_id().filter(&class_sprint_id)
        .filter(|s| !s.is_complete)
        .collect();
    for session in incomplete {
        let player_identity = session.player_identity;
        let session_id = session.id;
        finalize_session(ctx, session);
        credit_session_to_player(ctx, player_identity, session_id);
    }
}

// ============================================================
// DATA RESTORE
// ============================================================

/// DATA RESTORE: Re-insert a Classroom row with its original ID and code,
/// and add the calling teacher as a member (mirroring create_classroom behaviour).
/// The caller (ctx.sender()) becomes the teacher. Idempotent — skips if ID already exists.
#[reducer]
pub fn restore_classroom(
    ctx: &ReducerContext,
    id: u64,
    code: String,
    name: String,
) -> Result<(), String> {
    if ctx.db.classrooms().id().find(id).is_some() { return Ok(()); }
    ctx.db.classrooms().insert(Classroom {
        id,
        code: code.trim().to_uppercase(),
        name: name.trim().to_string(),
        teacher: ctx.sender(),
    });
    // Add teacher as member, same as create_classroom does
    let already_member = ctx.db.classroom_members()
        .player_identity().filter(&ctx.sender())
        .any(|m| m.classroom_id == id);
    if !already_member {
        ctx.db.classroom_members().insert(ClassroomMember {
            id: 0,
            classroom_id: id,
            player_identity: ctx.sender(),
            hidden: false,
        });
    }
    Ok(())
}

/// DATA RESTORE: Re-insert a ClassroomMember row for the calling player.
/// SEC-13: Admin-gated — only server admins can restore classroom members.
/// This reducer exists for data recovery/migration only.
#[reducer]
pub fn restore_classroom_member(
    ctx: &ReducerContext,
    classroom_id: u64,
    hidden: bool,
) -> Result<(), String> {
    if !crate::auth::is_admin(ctx, ctx.sender()) {
        return Err("Only admins can restore classroom members".into());
    }
    let already_member = ctx.db.classroom_members()
        .classroom_id().filter(&classroom_id)
        .any(|m| m.player_identity == ctx.sender());
    if already_member { return Ok(()); }
    ctx.db.classroom_members().insert(ClassroomMember {
        id: 0,
        classroom_id,
        player_identity: ctx.sender(),
        hidden,
    });
    Ok(())
}

/// DATA RESTORE: Re-insert a ClassroomMember row for an arbitrary target identity.
/// Admin-only — used during data recovery to rebuild classroom memberships.
#[reducer]
pub fn admin_restore_membership_for(
    ctx: &ReducerContext,
    target: spacetimedb::Identity,
    classroom_id: u64,
    hidden: bool,
) -> Result<(), String> {
    if !crate::auth::is_admin(ctx, ctx.sender()) {
        return Err("Only admins can restore classroom members".into());
    }
    let already_member = ctx.db.classroom_members()
        .classroom_id().filter(&classroom_id)
        .any(|m| m.player_identity == target);
    if already_member { return Ok(()); }
    ctx.db.classroom_members().insert(ClassroomMember {
        id: 0,
        classroom_id,
        player_identity: target,
        hidden,
    });
    Ok(())
}

/// Teacher removes a student from their classroom.
#[reducer]
pub fn remove_classroom_member(ctx: &ReducerContext, classroom_id: u64, student_hex: String) -> Result<(), String> {
    let student_identity = spacetimedb::Identity::from_hex(&student_hex)
        .map_err(|_| "Invalid student identity".to_string())?;

    let classroom = ctx.db.classrooms().id().find(classroom_id)
        .ok_or("Classroom not found")?;

    if classroom.teacher != ctx.sender() {
        return Err("Only the teacher can remove students from this classroom".into());
    }

    if let Some(membership) = ctx.db.classroom_members()
        .player_identity().filter(&student_identity)
        .find(|m| m.classroom_id == classroom_id)
    {
        ctx.db.classroom_members().id().delete(membership.id);
    } else {
        return Err("Student is not in this classroom".into());
    }

    Ok(())
}

/// One-time migration: delete any classroom_member rows whose classroom_id
/// has no corresponding classroom in the classrooms table.
/// Idempotent — safe to call multiple times.  Fixes "Error materializing view
/// my_classroom_members" caused by stale membership rows for deleted classrooms.
#[reducer]
pub fn cleanup_orphaned_memberships(ctx: &ReducerContext) -> Result<(), String> {
    let orphans: Vec<u64> = ctx.db.classroom_members()
        .iter()
        .filter(|m| ctx.db.classrooms().id().find(m.classroom_id).is_none())
        .map(|m| m.id)
        .collect();
    let count = orphans.len();
    for id in orphans {
        ctx.db.classroom_members().id().delete(id);
    }
    log::info!("cleanup_orphaned_memberships: deleted {} orphaned rows", count);
    Ok(())
}
