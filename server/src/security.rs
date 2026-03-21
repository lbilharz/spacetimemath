use spacetimedb::{reducer, ReducerContext, Table, Identity};
use crate::{
    RecoveryKey,
    RecoveryCodeResult, RestoreResult, ClassRecoveryResult,
    get_player, make_recovery_code,
};
use crate::{
    recovery_keys, recovery_code_results, restore_results, class_recovery_results,
    classrooms, classroom_members, players,
};

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

/// CONSUME-01: Delete the restore_results row for the caller after a successful account restore.
/// Idempotent — no error if the row is already gone (identity_disconnected may have cleaned it).
#[reducer]
pub fn consume_restore_result(ctx: &ReducerContext) -> Result<(), String> {
    ctx.db.restore_results().caller().delete(ctx.sender());
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

/// DATA RESTORE: Insert a specific recovery key (code + token) for the caller.
/// Removes any existing key first so the original code is exactly restored.
#[reducer]
pub fn restore_recovery_key(ctx: &ReducerContext, code: String, token: String) -> Result<(), String> {
    let old: Vec<_> = ctx.db.recovery_keys()
        .iter()
        .filter(|k| k.owner == ctx.sender())
        .collect();
    for k in old { ctx.db.recovery_keys().code().delete(k.code); }
    ctx.db.recovery_keys().insert(RecoveryKey {
        code,
        owner: ctx.sender(),
        token,
    });
    Ok(())
}

/// Explicitly replace the caller's recovery key with a new one.
/// Only called when the user clicks "Regenerate" in the Account page.
#[reducer]
pub fn regenerate_recovery_key(ctx: &ReducerContext, token: String) -> Result<(), String> {
    let player = get_player(ctx)?;
    // Strip validation flag so UI forces user to re-save the new code
    ctx.db.players().identity().update(crate::Player { recovery_emailed: false, ..player });

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
