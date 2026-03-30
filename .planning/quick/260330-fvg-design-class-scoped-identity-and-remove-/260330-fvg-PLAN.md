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

### Reducers

```rust
upgrade_to_teacher(email: String)
// → sets player_type = Teacher, stores email
// → requires GDPR consent flag passed from client

join_class(class_code: String, class_username: String)
// → validates code, checks username unique in class
// → sets player_type = Student, class_id, username
// → existing solo progress: kept but no longer shown in class context
```

### GDPR Compliance for Teacher Email Collection

The email-entry moment is the **consent moment** — must be handled correctly:

| Requirement | Implementation |
|------------|----------------|
| Explicit consent | Checkbox (not pre-ticked): "Ich stimme der Speicherung meiner E-Mail zur Kontowiederherstellung zu" |
| Purpose limitation | Visible text: "Nur zur Kontowiederherstellung. Kein Marketing." |
| Privacy Policy link | Mandatory link before checkbox |
| Right to deletion | Account deletion reducer must also wipe email |
| Data minimization | Only email stored — no name, no phone, nothing else |
| No PII for minors | Students (SuS) provide zero PII — username is pseudonymous |

The `upgrade_to_teacher` reducer must receive a `gdpr_consent: bool` parameter. Server rejects if `false`.

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

## Recommended Submission Strategy

**For v1.0 submission: do Phase 1 only.**

Removing the global leaderboard from the UI is enough to address the App Store concern. The deeper identity rework (Phases 2–4) is a v1.1 feature that can ship after initial approval.

This way: ship faster, get the app in the store, then improve auth/identity in the next update.
