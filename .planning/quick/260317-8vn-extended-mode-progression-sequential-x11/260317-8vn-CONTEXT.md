# Quick Task 260317-8vn: Extended mode progression - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Task Boundary

Full extended mode progression system:
1. Sequential ×11→×20 unlocking gated by mastery threshold (≥80%, last 10 answers)
2. Weighted random problem selection for ALL sprints (hard problems prioritized)
3. Extended problem_stats seeded for ×11–×20 with higher base weights
4. Client "Master +N" display in tier card

</domain>

<decisions>
## Implementation Decisions

### Extended table set (from prior session)
- Extended tables: ×11, ×12, ×13, ×14, ×15, ×16, ×17, ×18, ×19, ×20 (drop ×25)
- Goal: proficiency in 20×20 multiplication

### Server: Player.extended_level
- New field: `#[default(0)] pub extended_level: u8` on Player struct (additive, auto-migrates)
- Range 0–9: level k means ×(11+k) is the current focus; level 9 = all 10 tables unlocked
- (Level 10 = fully complete, but practically level 9 = working on ×20 is the max actively worked state)

### Sprint pool with extended_level
- When `extended_mode=true && extended_level=k`, include category-2 pairs where max(a,b) <= 11+k
  - level 0: only ×11 pairs (×11 × ×1–10, both orderings)
  - level 1: ×11 + ×12 pairs
  - ...
  - level 9: all ×11–×20 pairs
- Sprint mix: ALWAYS include base ×1–10 pool + unlocked extended pairs (full mix, same as regular tiers)

### Weighted random problem selection (all sprints)
- Replace uniform Fisher-Yates pool with weight-expanded pool + Fisher-Yates + dedup
- Expansion factor: `copies = max(1, (weight * 3.0).round() as usize)`
  - weight 0.2 → 1 copy, weight 1.0 → 3 copies, weight 2.0 → 6 copies
- Shuffle expanded pool with existing FNV Fisher-Yates, then dedup keeping first occurrence of each key
- Effect: hard problems appear earlier in sequence → more likely to be hit in 60s sprint
- No change to Fisher-Yates logic itself — just pool construction changes

### Extended problem_stats seeding
- Replace `seed_tier1_problem_stats` (old 5 curated tables) with `seed_extended_problem_stats` (×11–×20 full)
- Seed both orderings: (a=extended, b=1..10) and (a=1..10, b=extended) — category 2
- Weights: uniform 1.5 for all extended problems (3-digit typing penalty baked in)
  - Future: community weight adjustment is disabled for category 2 (already in code: keeps seeded value)
- Old entries for ×25 must NOT be reseeded (they may already exist in live DB — acceptable, they just won't appear in sprint pool since ×25 > 20 is excluded from new extended_level logic)

### SEC-06 guard update
- Old: `is_extended_pair = matches!(a.max(b), 11 | 12 | 15 | 20 | 25)`
- New: `is_extended_pair = a.max(b) >= 11 && a.max(b) <= 20`
- Must update in BOTH `issue_problem` and `submit_answer`

### Advancement trigger: end_session
- In `end_session`, after `finalize_session` and `credit_session_to_player`, call new `check_extended_level(ctx, sender)`
- `check_extended_level`: if player.extended_mode && player.extended_level < 9
  - current_table = 11 + player.extended_level (u8)
  - Collect ALL historical answers for this player where max(a, b) == current_table
  - Take last 10; require at least 5 to evaluate
  - If correct_count / total >= 0.8 → increment extended_level
- Only advance one level at a time per session

### auth.rs register struct literal
- Add `extended_level: 0` to the Player struct literal in register reducer

### classroom.rs build_sequence calls
- Already pass `extended_mode: false` — also pass `extended_level: 0`
- Signature becomes: `build_sequence(ctx, session_id, player_tier, extended_mode, extended_level)`

### Client: Master +N display
- In `ProgressPage.tsx`, tier status card: when `extendedMode && extendedLevel > 0`, show "+{extendedLevel}" after the tier name
- When `extendedMode && extendedLevel == 0`, show "+0" or just "Master" (player just started extended — Claude's discretion: show nothing until first advancement)
- `extendedLevel` prop must flow: PageRenderer → ProgressPage

### Deploy order
- Server changes first → make deploy → make generate → client changes
- The executor should run `make deploy` as a task step; if it fails with 502, task stays in progress

### Claude's Discretion
- Font/style of "+N" suffix: same weight/color as tier name, smaller text
- Whether to show extended level progress in sprint results page: deferred (not in scope)
- Exact wording of i18n key for "Master +N": can reuse existing tier name + concatenation

</decisions>

<specifics>
## Specific Ideas

**Pool expansion implementation sketch (Rust):**
```rust
let mut pool: Vec<u16> = ctx.db.problem_stats().iter()
    .filter(|s| /* existing filter */)
    .flat_map(|s| {
        let copies = (s.difficulty_weight * 3.0).round().max(1.0) as usize;
        std::iter::repeat(s.problem_key).take(copies)
    })
    .collect();
// ... existing Fisher-Yates on pool ...
// Dedup: keep first occurrence only
let mut seen = std::collections::HashSet::new();
let pool: Vec<u16> = pool.into_iter().filter(|k| seen.insert(*k)).collect();
```

**Extended level check in end_session:**
```rust
fn check_extended_level(ctx: &ReducerContext, identity: Identity) {
    let player = match ctx.db.players().identity().find(identity) { Some(p) => p, None => return };
    if !player.extended_mode || player.extended_level >= 9 { return; }
    let current_table = 11u8 + player.extended_level;
    let recent: Vec<_> = ctx.db.answers().iter()
        .filter(|a| a.player_identity == identity && a.a.max(a.b) == current_table)
        .collect();
    let last10: Vec<_> = recent.iter().rev().take(10).collect();
    if last10.len() < 5 { return; }
    let correct = last10.iter().filter(|a| a.is_correct).count();
    if correct * 10 >= last10.len() * 8 { // ≥80%
        ctx.db.players().identity().update(Player { extended_level: player.extended_level + 1, ..player });
    }
}
```

</specifics>
