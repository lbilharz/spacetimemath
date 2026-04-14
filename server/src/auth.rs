use spacetimedb::{table, reducer, ReducerContext, Table};
use hmac::{Hmac, Mac};
use sha2::Sha256;
type HmacSha256 = Hmac<Sha256>;
use crate::{Player, PlayerSecret, OnlinePlayer, BestScore, get_player, MAX_TIER, PlayerType};
use crate::{players, player_secrets, online_players, best_scores, classrooms};

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
    Ok(())
}

#[reducer]
pub fn register(ctx: &ReducerContext, username: String, player_type: PlayerType, email: Option<String>) -> Result<(), String> {
    let name = username.trim().to_string();
    validate_username(&name)?;
    
    // If Teacher, ensure email is provided. (Note: DSGVO consent is verified frontend side, but could send boolean here)
    // Block Teacher registration. Must go through verification flow.
    if player_type == PlayerType::Teacher {
        return Err("Teachers must verify their email via the upgrade flow.".into());
    }
    
    let sender = ctx.sender();
    if let Some(existing) = ctx.db.players().identity().find(sender) {
        ctx.db.players().identity().update(Player { username: name.clone(), player_type: player_type.clone(), email: None, ..existing });
    } else {
        ctx.db.players().insert(Player {
            identity: sender,
            player_type: player_type.clone(),
            class_id: None,
            email: None,
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
    
    // Store email securely in the isolated private table
    if let Some(e) = email {
        match ctx.db.player_secrets().identity().find(sender) {
            Some(existing) => { ctx.db.player_secrets().identity().update(PlayerSecret { email: Some(e), ..existing }); }
            None => { ctx.db.player_secrets().insert(PlayerSecret { identity: sender, email: Some(e), recovery_emailed: false }); }
        }
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
        player_type: PlayerType::Solo,
        class_id: None,
        email: None,
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
    match ctx.db.player_secrets().identity().find(ctx.sender()) {
        Some(existing) => { ctx.db.player_secrets().identity().update(PlayerSecret { recovery_emailed: true, ..existing }); }
        None => { ctx.db.player_secrets().insert(PlayerSecret { identity: ctx.sender(), email: None, recovery_emailed: true }); }
    }
    ctx.db.players().identity().update(Player { recovery_emailed: true, ..player });
    Ok(())
}

#[table(accessor = server_admins)]
pub struct ServerAdmin {
    #[primary_key]
    pub identity: spacetimedb::Identity,
}

/// SEC-13: Check if an identity is a server admin.
pub(crate) fn is_admin(ctx: &ReducerContext, who: spacetimedb::Identity) -> bool {
    ctx.db.server_admins().identity().find(who).is_some()
}

#[reducer]
pub fn grant_admin_to(ctx: &ReducerContext, target: spacetimedb::Identity) -> Result<(), String> {
    // If the table is entirely empty, anyone can bootstrap the first admin.
    // Otherwise, you must already be an admin to grant admin.
    if ctx.db.server_admins().iter().count() > 0 && ctx.db.server_admins().identity().find(ctx.sender()).is_none() {
        return Err("Not authorized".into());
    }
    ctx.db.server_admins().insert(ServerAdmin { identity: target });
    Ok(())
}

#[table(accessor = teacher_secrets)]
pub struct TeacherSecret {
    #[primary_key]
    pub id: u32,
    pub secret: String,
}


#[reducer]
pub fn admin_set_hmac_secret(ctx: &ReducerContext, secret: String) -> Result<(), String> {
    // Allow bootstrap: if no secret is set yet, anyone can set it once.
    // After that, only server admins can update it.
    let secret_exists = ctx.db.teacher_secrets().id().find(0).is_some();
    if secret_exists && ctx.db.server_admins().identity().find(ctx.sender()).is_none() {
        return Err("Not authorized".into());
    }
    // Only id 0 will be used to store the single active secret
    match ctx.db.teacher_secrets().id().find(0) {
        Some(_) => { ctx.db.teacher_secrets().id().update(TeacherSecret { id: 0, secret }); }
        None => { ctx.db.teacher_secrets().insert(TeacherSecret { id: 0, secret }); }
    }
    Ok(())
}

/// Upgrade a Solo player to a Teacher using a signed verification code.
#[reducer]
pub fn verify_teacher_upgrade(ctx: &ReducerContext, username: Option<String>, email: String, code: String, signature: String, expires_at_ms: u64, gdpr_consent: bool, teacher_declaration: bool) -> Result<(), String> {
    if !gdpr_consent || !teacher_declaration {
        return Err("Must provide all required consents.".into());
    }
    
    // 1. Replay & expiration protection
    let now_ms = (ctx.timestamp.to_micros_since_unix_epoch() / 1000) as u64;
    if now_ms > expires_at_ms {
        return Err("Verification code has expired. Please request a new one.".into());
    }

    if let Some(player) = get_player(ctx).ok() {
        if player.player_type == PlayerType::Student {
            return Err("Students cannot upgrade to Teachers.".into());
        }
    } else if username.is_none() {
        return Err("Player does not exist and no fallback username was provided.".into());
    }
    
    // 2. Fetch shared secret (with fallback)
    let secret_str = ctx.db.teacher_secrets().id().find(0)
        .map(|s| s.secret)
        .ok_or("Server error: Missing HMAC secret.")?;
    
    // 3. Reconstruct payload exactly as Vercel signed it: identity + email + code + expires_at_ms
    let mut identity_hex = ctx.sender().to_hex().to_string();
    if !identity_hex.starts_with("0x") {
        identity_hex = format!("0x{}", identity_hex);
    }
    let payload = format!("{}{}{}{}", identity_hex, email.trim(), code.trim(), expires_at_ms);

    // 4. Verify HMAC
    let mut mac = HmacSha256::new_from_slice(secret_str.as_bytes())
        .map_err(|_| "Invalid HMAC key representation".to_string())?;
    mac.update(payload.as_bytes());
    let expected_sig = hex::encode(mac.finalize().into_bytes());

    if signature.trim().to_lowercase() != expected_sig.to_lowercase() {
        return Err("Invalid or tampered verification code signature.".into());
    }
    
    // 5. Apply Upgrade or Creation
    if let Some(player) = ctx.db.players().identity().find(ctx.sender()) {
        ctx.db.players().identity().update(Player {
            player_type: PlayerType::Teacher,
            email: None,
            ..player
        });
    } else if let Some(uname) = username {
        let name = uname.trim().to_string();
        validate_username(&name)?;
        
        ctx.db.players().insert(Player {
            identity: ctx.sender(),
            player_type: PlayerType::Teacher,
            class_id: None,
            email: None,
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
        
        ctx.db.online_players().try_insert(OnlinePlayer {
            identity: ctx.sender(),
            username: name,
            connected_at: ctx.timestamp,
            connection_count: 1,
        }).ok();
    }
    
    // Store email privately
    match ctx.db.player_secrets().identity().find(ctx.sender()) {
        Some(existing) => { ctx.db.player_secrets().identity().update(PlayerSecret { email: Some(email), ..existing }); }
        None => { ctx.db.player_secrets().insert(PlayerSecret { identity: ctx.sender(), email: Some(email), recovery_emailed: false }); }
    }
    
    Ok(())
}

/// Join a class as a student (Solo -> Student transition).
#[reducer]
pub fn join_class_as_student(ctx: &ReducerContext, class_code: String, class_username: String) -> Result<(), String> {
    let name = class_username.trim().to_string();
    validate_username(&name)?;
    
    // Validate class code exists
    let class_code_upper = class_code.trim().to_uppercase();
    let class = ctx.db.classrooms().iter().find(|c| c.code == class_code_upper)
        .ok_or("Classroom not found")?;
        
    // Check manual uniqueness in this class
    let all_players = ctx.db.players().iter();
    for p in all_players {
        if p.class_id == Some(class.id) && p.username.eq_ignore_ascii_case(&name) && p.identity != ctx.sender() {
            return Err("Username already taken in this class.".into());
        }
    }
    
    let player = get_player(ctx)?;
    ctx.db.players().identity().update(Player {
        player_type: PlayerType::Student,
        class_id: Some(class.id),
        username: name.clone(),
        ..player
    });
    
    // Also update display names in connected tables
    if let Some(bs) = ctx.db.best_scores().player_identity().find(ctx.sender()) {
        ctx.db.best_scores().player_identity().update(BestScore { username: name.clone(), ..bs });
    }
    if let Some(op) = ctx.db.online_players().identity().find(ctx.sender()) {
        ctx.db.online_players().identity().update(OnlinePlayer { username: name, ..op });
    }
    Ok(())
}
