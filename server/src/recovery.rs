use spacetimedb::{reducer, ReducerContext};
use std::collections::HashSet;

use crate::*;

/// Recovers `ClassSprint` rows that were lost during schema migrations.
/// Scans all `sessions` for `class_sprint_id`s that lack parent `ClassSprint` rows,
/// infers the `classroom_id` and `teacher` from the students' memberships,
/// and re-inserts the historical sprint as `is_active: false`.
#[reducer]
pub fn recover_orphaned_sprints(ctx: &ReducerContext) {
    let mut missing_sprints = HashSet::new();

    // 1. Identify missing sprint IDs
    for session in ctx.db.sessions().iter() {
        if session.class_sprint_id != 0 {
            if ctx.db.class_sprints().id().find(session.class_sprint_id).is_none() {
                missing_sprints.insert(session.class_sprint_id);
            }
        }
    }

    if missing_sprints.is_empty() {
        spacetimedb::log::info!("No orphaned sprints found. System is healthy.");
        return;
    }

    // 2. Reconstruct each missing sprint
    for sprint_id in missing_sprints {
        let sprint_sessions: Vec<_> = ctx.db.sessions().iter()
            .filter(|s| s.class_sprint_id == sprint_id)
            .collect();

        if sprint_sessions.is_empty() {
            continue;
        }

        let earliest_start = sprint_sessions
            .iter()
            .map(|s| s.started_at)
            .min()
            .unwrap_or(ctx.timestamp);

        let mut classroom_id_opt = None;
        let mut teacher_opt = None;

        for session in &sprint_sessions {
            for member in ctx.db.classroom_members().iter().filter(|m| m.player_identity == session.player_identity) {
                if let Some(classroom) = ctx.db.classrooms().id().find(member.classroom_id) {
                    classroom_id_opt = Some(classroom.id);
                    teacher_opt = Some(classroom.teacher);
                    break;
                }
            }
            if teacher_opt.is_some() {
                break;
            }
        }

        if let (Some(classroom_id), Some(teacher)) = (classroom_id_opt, teacher_opt) {
            let recovered_sprint = ClassSprint {
                id: sprint_id,
                classroom_id,
                teacher,
                started_at: earliest_start,
                is_active: false,
                is_diagnostic: false,
            };

            ctx.db.class_sprints().insert(recovered_sprint);
            spacetimedb::log::info!("Recovered orphaned sprint {} for classroom {}", sprint_id, classroom_id);
        } else {
            spacetimedb::log::warn!("Could not resolve classroom context for orphaned sprint {}", sprint_id);
        }
    }
}

/// Reconnects legacy sessions (class_sprint_id = 0) to their `class_sprints` rows.
/// During schema migrations, `class_sprint_id` may have been lost or defaulted to 0.
/// This matches sessions to a `class_sprint` if the sprint was created slightly before or around the session start.
#[reducer]
pub fn reconnect_legacy_sessions(ctx: &ReducerContext) {
    let mut updated_count = 0;

    for mut session in ctx.db.sessions().iter() {
        if session.class_sprint_id == 0 {
            // Find the classroom this student belongs to
            let member_classrooms: Vec<u64> = ctx.db.classroom_members().player_identity().filter(&session.player_identity)
                .map(|m| m.classroom_id).collect();

            let mut best_sprint_id = 0;
            let mut smallest_time_diff = i64::MAX;

            for classroom_id in member_classrooms {
                for sprint in ctx.db.class_sprints().classroom_id().filter(&classroom_id) {
                    // Match sessions that started up to 3 hours after the sprint was created
                    // (Some sprints run for a while, or server time differences)
                    let sprint_time = sprint.started_at.to_micros_since_unix_epoch() as i64 / 1_000_000;
                    let session_time = session.started_at.to_micros_since_unix_epoch() as i64 / 1_000_000;

                    let time_diff = session_time - sprint_time;
                    
                    // Allow the session to start up to 2 hours (7200 seconds) after the sprint created
                    // and up to 10 seconds before (clock skew)
                    if time_diff >= -10 && time_diff <= 7200 {
                        if time_diff.abs() < smallest_time_diff {
                            smallest_time_diff = time_diff.abs();
                            best_sprint_id = sprint.id;
                        }
                    }
                }
            }

            if best_sprint_id != 0 {
                // Remove the old session and insert with the updated class_sprint_id
                ctx.db.sessions().id().delete(session.id);
                session.class_sprint_id = best_sprint_id;
                ctx.db.sessions().insert(session);
                updated_count += 1;
            }
        }
    }

    spacetimedb::log::info!("Reconnected {} legacy sessions to their original class sprints.", updated_count);
}

/// Synthesizes `class_sprints` for legacy sessions that belonged to classroom members but NEVER had a class sprint 
/// (i.e. sessions created before the class_sprints feature was introduced).
/// We group these sessions by classroom and day (approximated) to avoid spamming the teacher dashboard.
#[reducer]
pub fn synthesize_legacy_sprints(ctx: &ReducerContext) {
    let mut updated_sessions = 0;
    let mut created_sprints = 0;

    // We only process sessions that STILL have class_sprint_id == 0 
    // after reconnect_legacy_sessions has run.
    let mut legacy_sessions = Vec::new();
    for session in ctx.db.sessions().iter() {
        if session.class_sprint_id == 0 {
            legacy_sessions.push(session.clone());
        }
    }

    // Group by (classroom_id, date_bucket)
    // Timestamp is in microseconds, so 86400 * 1_000_000 = 86_400_000_000 is one day.
    let day_seconds = 86400;

    for mut session in legacy_sessions {
        let member_classrooms: Vec<u64> = ctx.db.classroom_members().player_identity().filter(&session.player_identity)
            .map(|m| m.classroom_id).collect();

        // If the player is in multiple classrooms, they probably played for one of them.
        // We'll just pick the first one... or create a sprint in all of them? 
        // For legacy UI compatibility, we just assign the session to the first classroom.
        if let Some(classroom_id) = member_classrooms.first() {
            if let Some(classroom) = ctx.db.classrooms().id().find(*classroom_id) {
                let session_time = session.started_at.to_micros_since_unix_epoch() as u64 / 1_000_000;
                let day_bucket = session_time / day_seconds;
                
                // Construct a deterministic ID for the synthesized sprint so we group them
                // e.g. classroom_id * 100_000 + day_bucket
                let synthetic_sprint_id = classroom_id * 100_000 + (day_bucket as u64 % 100_000);
                
                // If it doesn't exist, create it
                if ctx.db.class_sprints().id().find(synthetic_sprint_id).is_none() {
                    let sprint = ClassSprint {
                        id: synthetic_sprint_id,
                        classroom_id: *classroom_id,
                        teacher: classroom.teacher,
                        started_at: session.started_at,
                        is_active: false,
                        is_diagnostic: false,
                    };
                    ctx.db.class_sprints().insert(sprint);
                    created_sprints += 1;
                }

                ctx.db.sessions().id().delete(session.id);
                session.class_sprint_id = synthetic_sprint_id;
                ctx.db.sessions().insert(session);
                updated_sessions += 1;
            }
        }
    }
    spacetimedb::log::info!("Synthesized {} classic sprints to house {} legacy sessions.", created_sprints, updated_sessions);
}
