use spacetimedb::{reducer, ReducerContext, Table};
use crate::{Friendship, FriendInvite, friend_invites, friendships};

/// Generates a random 8-character token matching [A-Z0-9].
fn generate_token(ctx: &ReducerContext) -> String {
    // Generating token deterministically using STDB context.
    let ts = ctx.timestamp.to_micros_since_unix_epoch();
    let id_bytes = ctx.sender().to_string().into_bytes();
    let num = ts.wrapping_add(id_bytes[0] as i64);
    format!("{:08}", num.abs() % 100_000_000)
}

#[reducer]
pub fn create_friend_invite(ctx: &ReducerContext) -> Result<(), String> {
    let token = generate_token(ctx);
    // Expires in 48 hours
    let expires_micros = ctx.timestamp.to_micros_since_unix_epoch() + (48 * 3600 * 1000 * 1000);
    let expires_at = spacetimedb::Timestamp::from_micros_since_unix_epoch(expires_micros);
    
    ctx.db.friend_invites().insert(FriendInvite {
        token: token.clone(),
        creator_identity: ctx.sender(),
        expires_at,
        used: false,
    });
    
    Ok(())
}

#[reducer]
pub fn accept_friend_invite(ctx: &ReducerContext, token: String) -> Result<(), String> {
    let invite = ctx.db.friend_invites().token().find(token.clone())
        .ok_or("Invite not found")?;
        
    if invite.expires_at < ctx.timestamp {
        return Err("Invite expired".into());
    }
    if invite.creator_identity == ctx.sender() {
        return Err("Cannot accept your own invite".into());
    }
    
    // Check if friendship already exists
    for f in ctx.db.friendships().iter() {
        if (f.initiator_identity == invite.creator_identity && f.recipient_identity == ctx.sender()) ||
           (f.initiator_identity == ctx.sender() && f.recipient_identity == invite.creator_identity) {
            return Err("Already friends".into());
        }
    }
    
    ctx.db.friendships().insert(Friendship {
        id: 0,
        initiator_identity: invite.creator_identity,
        recipient_identity: ctx.sender(),
        alias_by_initiator: None,
        alias_by_recipient: None,
        created_at: ctx.timestamp,
    });
    
    // Note: We no longer set used=true, allowing multi-use until expiration
    
    Ok(())
}

#[reducer]
pub fn update_friend_alias(ctx: &ReducerContext, friend_identity: spacetimedb::Identity, alias: String) -> Result<(), String> {
    let mut updated = false;
    // SpaceTimeDB doesn't have a direct query for multiple columns yet, so we iterate
    for mut f in ctx.db.friendships().iter() {
        if f.initiator_identity == ctx.sender() && f.recipient_identity == friend_identity {
            f.alias_by_initiator = if alias.trim().is_empty() { None } else { Some(alias.clone()) };
            ctx.db.friendships().id().update(f);
            updated = true;
            break;
        } else if f.recipient_identity == ctx.sender() && f.initiator_identity == friend_identity {
            f.alias_by_recipient = if alias.trim().is_empty() { None } else { Some(alias.clone()) };
            ctx.db.friendships().id().update(f);
            updated = true;
            break;
        }
    }
    if !updated {
        return Err("Friendship not found".into());
    }
    Ok(())
}

#[reducer]
pub fn remove_friend(ctx: &ReducerContext, friend_identity: spacetimedb::Identity) -> Result<(), String> {
    let mut to_delete = None;
    for f in ctx.db.friendships().iter() {
        if (f.initiator_identity == ctx.sender() && f.recipient_identity == friend_identity) ||
           (f.recipient_identity == ctx.sender() && f.initiator_identity == friend_identity) {
            to_delete = Some(f.id);
            break;
        }
    }
    
    if let Some(id) = to_delete {
        ctx.db.friendships().id().delete(id);
        Ok(())
    } else {
        Err("Friendship not found".into())
    }
}

#[reducer]
pub fn revoke_friend_invite(ctx: &ReducerContext, token: String) -> Result<(), String> {
    let invite = ctx.db.friend_invites().token().find(token.clone())
        .ok_or("Invite not found")?;
        
    if invite.creator_identity != ctx.sender() {
        return Err("Not authorized".into());
    }
    
    ctx.db.friend_invites().token().delete(token.clone());
    Ok(())
}
