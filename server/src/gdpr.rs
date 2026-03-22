use spacetimedb::{reducer, ReducerContext, Table};
use crate::{sessions, answers, issued_problems_v2, sprint_sequences, best_scores,
            unlock_logs, recovery_keys, recovery_code_results,
            issued_problem_results_v2, classroom_members,
            classrooms, online_players, players};

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
        let to_delete: Vec<u64> = ctx.db.issued_problems_v2().iter()
            .filter(|p| p.session_id == *sid)
            .map(|p| p.id)
            .collect();
        for id in to_delete { ctx.db.issued_problems_v2().id().delete(id); }
    }

    // 2b. Delete sprint_sequences for those sessions (SEQ-06 GDPR cascade)
    for sid in &session_ids {
        ctx.db.sprint_sequences().session_id().delete(*sid);
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

    // 7. Delete recovery credentials
    let rk: Vec<String> = ctx.db.recovery_keys().iter()
        .filter(|k| k.owner == sender)
        .map(|k| k.code.clone())
        .collect();
    for code in rk { ctx.db.recovery_keys().code().delete(code); }
    ctx.db.recovery_code_results().owner().delete(sender);

    // 8. Delete issued_problem_results
    ctx.db.issued_problem_results_v2().owner().delete(sender);

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
