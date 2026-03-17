use spacetimedb::{reducer, ReducerContext, Table};
use crate::{Player, OnlinePlayer, BestScore, get_player, MAX_TIER};
use crate::{players, online_players, best_scores};

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
            extended_mode: false,
            extended_level: 0,
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

/// DATA RESTORE: Re-insert a player row with full historical stats from CSV backup.
/// No username validation — we're restoring known-good data.
/// Safe to call multiple times; upserts rather than failing on duplicates.
#[reducer]
pub fn restore_player_full(
    ctx: &ReducerContext,
    username: String,
    best_score: f32,
    total_sessions: u32,
    total_correct: u32,
    total_answered: u32,
    learning_tier: u8,
) -> Result<(), String> {
    let player = Player {
        identity: ctx.sender(),
        username: username.clone(),
        best_score,
        total_sessions,
        total_correct,
        total_answered,
        onboarding_done: true,
        learning_tier,
        recovery_emailed: false,
        extended_mode: false,
        extended_level: 0,
    };
    match ctx.db.players().identity().find(ctx.sender()) {
        Some(_) => { ctx.db.players().identity().update(player); }
        None => { ctx.db.players().insert(player); }
    }
    if let Some(op) = ctx.db.online_players().identity().find(ctx.sender()) {
        ctx.db.online_players().identity().update(OnlinePlayer { username, ..op });
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
