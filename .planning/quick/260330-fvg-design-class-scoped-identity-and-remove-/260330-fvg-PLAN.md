# Quick Task 260330-fvg: Class-Scoped Identity & Remove Global Leaderboard

**Date:** 2026-03-30
**Status:** Planning document — no code changes yet
**Trigger:** App Store submission blocked by (1) global leaderboard privacy concern and (2) impersonation risk via global username namespace

---

## Problem Statement

Two App Store dealbreakers:

1. **Global leaderboard** — children's names visible to strangers; COPPA/DSGVO concern
2. **Global username namespace** — no prevention of impersonation; any student can claim any name

Both problems share the same root cause: player identity is global. Fix: scope identity to class.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Teacher auth | Email (stored in DB) + Recovery Key | Email = unique identifier; Recovery Key = device transfer; no OAuth complexity |
| Student auth | Class code + in-class username + Recovery Key | No email needed for minors; name unique only within class |
| Solo mode | Keep, no class required | Username not globally unique; no leaderboard; personal progress only |
| Existing players | Keep as-is | No data wipe; global leaderboard removed from UI only |
| SpaceTimeDB Identity | Still the cryptographic unique key | Email/classname = display only; Identity = real uniqueness |

---

## Onboarding Flow (New)

```
App öffnen
    │
    ├── 👩‍🏫 Lehrer
    │       1. Email eingeben
    │       2. Recovery Key anzeigen + sichern lassen
    │       3. → Dashboard: Klassen erstellen / verwalten
    │
    ├── 👨‍🎓 Schüler (Klasse beitreten)
    │       1. Klassencode eingeben (z.B. "MATH7A")
    │       2. Name wählen → Server prüft: unique in dieser Klasse?
    │       3. Recovery Key anzeigen (optional, aber empfohlen)
    │       4. → Spielen; Leaderboard = nur Klassenkameraden
    │
    └── 🎮 Solo üben
            1. Name wählen (kein Uniqueness-Check)
            2. → Spielen; kein Leaderboard; nur eigener Fortschritt
```

---

## Architecture Changes

### SpaceTimeDB Schema

**`players` table — additions:**
```rust
player_type: PlayerType,   // enum: Teacher | Student | Solo
class_id: Option<u64>,     // None für Teacher + Solo
email: Option<String>,     // Teacher only, unique constraint
```

**`players` username uniqueness:**
- Currently: globally unique
- New: unique per `(class_id, username)` for Students; globally unique for Teacher/Solo (oder gar keine Uniqueness für Solo)

**`classrooms` table — additions:**
```rust
teacher_identity: Identity,  // wer hat die Klasse erstellt
```

### Leaderboard Scoping

| Context | Currently | New |
|---------|-----------|-----|
| Sprint live | All participants globally | Only class members in class sprint |
| Global ranking | Exists | **Remove entirely** |
| Personal progress | Own data | Own data only (unchanged) |
| Teacher view | n/a | All students in own classes |

### Reducers (new/changed)

| Reducer | Change |
|---------|--------|
| `register` | Add `player_type` param; validate email uniqueness for Teacher |
| `join_class` | New: validate class code, check username uniqueness in class |
| `create_classroom` | Require caller to be `PlayerType::Teacher` |
| `get_leaderboard` | Scope to `class_id`; remove global leaderboard query |

---

## UI Changes

### Register/Onboarding
- Current: one flow (username → play)
- New: 3-way split screen (Lehrer / Schüler / Solo)

### Leaderboard
- Remove global leaderboard page/component
- Class sprint leaderboard: already class-scoped (verify in code)
- Progress page: no change (already personal)

### Teacher Dashboard
- Existing classroom management: check if already sufficient
- Add: see student list per class + their tier/progress

---

## What Stays the Same

- SpaceTimeDB `Identity` = cryptographic unique key per device (unchanged)
- Recovery Key flow (unchanged — same for all player types)
- Sprint mechanics, problem generation, tier system (unchanged)
- Existing players continue to work (grandfather clause)

---

## Solo → LuL/SuS Transition (Account Upgrade)

A Solo player can upgrade to Teacher or Student later — the SpaceTimeDB `Identity` stays the same, only `player_type` and optional fields change.

### Allowed Transitions

| From → To | Allowed | Enforcement |
|-----------|---------|-------------|
| Solo → SuS | ✅ | Enter class code + pick name |
| Solo → LuL | ✅ | Email + two consent checkboxes (see below) |
| SuS → LuL | ❌ | Server rejects: `player_type == Student` |
| LuL → SuS | ❌ | No use case |

### Reducers

```rust
upgrade_to_teacher(email: String, gdpr_consent: bool, teacher_declaration: bool)
// → rejects if caller is already Student
// → rejects if gdpr_consent == false or teacher_declaration == false
// → sets player_type = Teacher, stores email

join_class(class_code: String, class_username: String)
// → validates code, checks username unique in class
// → sets player_type = Student, class_id, username
// → existing solo progress: kept but no longer shown in class context
```

### GDPR Compliance for Teacher Email Collection

No technical verification required — **Selbstauskunft** (self-declaration) is legally sufficient under DSGVO. Liability shifts to the user if they provide false information. This is standard practice for professional tools.

UI must show two non-pre-ticked checkboxes before storing any data:

```
☐ Ich bestätige, dass ich Lehrkraft bin und diese Funktion
  ausschließlich für schulische Zwecke nutze.

☐ Ich stimme der Speicherung meiner E-Mail-Adresse zur
  Kontowiederherstellung zu. [Datenschutzerklärung ↗]
```

| Requirement | Implementation |
|------------|----------------|
| Explicit consent | Two checkboxes, neither pre-ticked |
| Purpose limitation | "Nur zur Kontowiederherstellung. Kein Marketing." visible above form |
| Privacy Policy link | Mandatory link in second checkbox label |
| Right to deletion | Account deletion reducer must also wipe email |
| Data minimization | Only email stored — no name, no phone, nothing else |
| No PII for minors | SuS provide zero PII — username is pseudonymous, no consent needed |

### SuS: Zero PII Design

Students never provide personal data:
- Username = pseudonym (could be "Dino7", "Lars7", anything)
- No email, no real name, no age
- SpaceTimeDB Identity is pseudonymous (random key, not linked to person)
- Recovery Key = optional, device-local

→ COPPA-safe, DSGVO-safe, no parental consent flow needed.

---

## Open Questions (for implementation planning)

1. **Recovery Key UX for students:** How prominently should we show it? Many kids will skip it. Options: mandatory acknowledgment, or skip-able with warning.
2. **Teacher email verification:** Do we send a verification email? Or just store unverified (simpler for v1)?
3. **Student in multiple classes:** One student = one class? Or allow joining multiple? (v1: one class per device/identity)
4. **Class code generation:** Teacher-defined or auto-generated? (Auto is safer — avoids `NAZIS` etc.)
5. **Solo progress migration on class join:** Do we show solo sprint history in the class context, or keep it separate?

---

## Implementation Phases (rough)

### Phase 1: Remove Global Leaderboard (quick win, unblocks submission)
- Remove global leaderboard UI component
- Scope sprint leaderboard to class participants only
- No schema change needed

### Phase 2: Onboarding Weiche
- 3-way split on first open
- Teacher: email field in registration
- Student: class code entry before username
- Solo: existing flow (just no leaderboard)

### Phase 3: Server-side class-scoped username uniqueness
- Schema: add `player_type`, `class_id`, `email` to players
- Reducer: `join_class` validates uniqueness within class
- Migration: existing players get `player_type: Solo`

### Phase 4: Teacher Dashboard
- Teacher sees their classes + student progress
- Class management (create, delete, rename)

---

## Solo Social: Friends via Invite Link

Replaces global leaderboard and "who is online" for Solo players with a private, opt-in friends graph.

### Why
- No global username uniqueness → "who is online" is meaningless (who is "Dino7"?)
- Privacy-safe: social graph is opt-in, not broadcast
- Works with pseudonymous identities — no real names needed

### Invite Link Flow

```
Solo Player A → "Freund einladen" → Share Sheet
    → Link: https://better-1up.vercel.app/friend/<one-time-token>

Empfänger öffnet Link:
    ├── Neuer User  → Name wählen → automatisch Friend von A
    └── Existing User → Friend-Request → zu A's Liste hinzugefügt
```

### Friends List (CRUD)

| Operation | Action |
|-----------|--------|
| Add | Via Invite Link (one-time token, expires after use or 48h) |
| Read | Online status + Sprint scores + Progress/tier |
| Update | Alias vergeben ("Jonas aus Klasse 7" statt "Dino7") |
| Delete | Freund entfernen (beide Seiten) |

### SpaceTimeDB Schema

```rust
// friendships table
initiator_identity: Identity,
recipient_identity: Identity,
alias_by_initiator: Option<String>,  // custom label
alias_by_recipient: Option<String>,
created_at: Timestamp,

// friend_invites table (short-lived)
token: String,          // random, one-time
creator_identity: Identity,
expires_at: Timestamp,
used: bool,
```

### What Friends See
- Online status (last seen)
- Sprint scores (recent results)
- Current tier / progress

### GDPR
- No PII — only SpaceTimeDB Identities stored
- Invite token contains no personal data
- "Delete friend" removes both sides of the relationship

---

## v2 Vision: Battle Mode

Friend sprints and 1v1 duels — think Brawl Stars for multiplication.

- **Friend Sprint:** invite a friend to a real-time sprint, see live leaderboard (2-player)
- **Battle Mode:** 1v1 duel — same problem, first correct answer scores a point, first to N wins
- Matchmaking: friends only (v2.0) → open matchmaking by tier (v2.1)

Not planned for v1. Capture here as product direction.

---

## Recommended Submission Strategy

**For v1.0 submission: do Phase 1 only.**

Removing the global leaderboard from the UI is enough to address the App Store concern. The deeper identity rework (Phases 2–4) is a v1.1 feature that can ship after initial approval.

This way: ship faster, get the app in the store, then improve auth/identity in the next update.
