# SpaceTimeDB Schema Architecture

This document tracks all tables in the `server` module, categorized strictly by their privacy boundary and purpose.

**Total Tables:** 32 living tables + 3 legacy tombstones

---

## Category 1: Sensitive Server-Only Data
*Test: "Would a leak require a security-incident response?" → yes.*
*Clients NEVER view or download this data. Accessed strictly by server-side reducers.*

- **`PlayerSecret`** — Stores email addresses mapping to identities. *(Introduced for account recovery without broadcasting PII)*
- **`TeacherSecret`** — Stores the HMAC key for stateless teacher verification. *(Introduced for GDPR-compliant teacher consent)*
- **`RecoveryKey`** — Stores the generated restore token for device migrations. *(Introduced for frictionless account recovery)*

## Category 2: Personal & Global State
*Test: "Should the client see it (their own row, or everyone's)?" → yes.*
*Public tables (either truly global OR exposed via `ctx.sender()` scoped views).*

- **`Player`** — Core identity profile (username, learning tier, etc.). *(Introduced as the primary global player record)*
- **`Session`** — Metadata for a sprint session (score, accuracy, timestamp). *(Introduced for sprint history and leaderboard)*
- **`Answer`** — Granular problem responses per session. *(Introduced for DKT insights and adaptive problem generation)*
- **`OnlinePlayer`** — Ephemeral online presence tracker. *(Introduced for the live lobby "Who is online" feature)*
- **`BestScore`** — **Denormalized leaderboard cache.** Source of truth is `Player`; exists to avoid scanning all sessions on leaderboard reads. Kept in sync by `finalize_session` + `set_learning_tier`.
- **`ProblemStat`** — Global community difficulty stats per multiplier pair. *(Introduced for adaptive difficulty weighting)*
- **`Classroom`** — Represents a teacher's room. The 6-char `code` is a shareable invite, not a secret. Brute-force is mitigated by the join reducer (rate-limiting / no enumeration endpoint).
- **`ClassroomMember`** — Maps students to Classrooms. *(Introduced for class-scoped leaderboards)*
- **`ClassSprint`** — Metadata for synchronized live class sessions. *(Introduced for teacher dashboards)*
- **`Friendship`** — Maps two identities with optional aliases. *(Introduced for opt-in friends list)*
- **`FriendInvite`** — Stores an 8-digit token the creator wants to share with a friend. *(Creator reads via sender-scoped view; invitee submits to reducer)*
- **`UnlockLog`** — **Status: Write-only audit log.** Canonical tier lives in `Player.learning_tier`. Candidate for deprecation.

## Category 3: RPC Result Tables
*Test: "Is this the return value of a reducer call?" → yes.*
*Endorsed STDB pattern: Public tables exposed via a view filtered by `owner == ctx.sender()`. Used strictly as return values from reducers.*

- **`MyEmailResult`** — Returns the stored email. *(Introduced to securely read from PlayerSecret)*
- **`RecoveryCodeResult`** — Returns the generated recovery code. *(Introduced for token generation flow)*
- **`RestoreResult`** — Returns success/failure of a device migration. *(Introduced for account restore flow)*
- **`ClassRecoveryResult`** — Returns a teacher's generated class code. *(Introduced for classroom management)*
- **`IssuedProblemResultV2`** — Returns the active sprint problem. *(Introduced for server-driven problem sequencing)*
- **`NextProblemResultV2`** — Returns the subsequent sprint problem. *(Introduced for uninterrupted problem delivery)*
- ~~`IssuedProblemResult`~~ — *(Legacy V1 table — unused, remove in P1)*
- ~~`NextProblemResult`~~ — *(Legacy V1 table — unused, remove in P1)*

*Note: The ultimate goal (P3) is to unify these disparate tables into 2-3 generic result shapes (e.g., `ReducerTokenResult`, `ReducerPayloadResult`).*

## Category 4: Server-only Operational State
*Test: "Server-only, but not a secret?" → yes.*
*Private tables used for ephemeral server logic or ML telemetry. Clients are entirely unaware of these.*

- **`SprintSequence`** — Anti-cheat buffer tracking the generated sequence of problems. *(Introduced to close client foreknowledge vector)*
- **`DiagnosticState`** — Ongoing state/streak tracking for placement matches. *(Introduced to calibrate new player tiers)*
- **`IssuedProblemV2`** — Temporary token validating a single answer submission. *(Introduced to prevent double-submit or spoofed answers)*
- **`EndSprintSchedule`** — Holds `ScheduleAt` handles for auto-closing class sprints. *(Introduced for time-bound class sessions)*
- **`TeacherFocus`** — Live pointer of which student the teacher is viewing. *(Introduced for live dashboard telemetry)*
- **`StudentKeystroke`** — High-frequency input telemetry. *(Introduced for the teacher live view. Target for P5 merge)*
- **`PlayerDktWeights`** — ML tensor backing the offline PyTorch loop. *(Introduced for Deep Knowledge Tracing ingestion)*
- **`KcTelemetry`** — Granular pass/fail ledger for semantic KC concepts. *(Introduced for mastery modeling)*
- **`LegacyScoreBackup`** — Archival table. *(Legacy — Target for P7 removal/documentation)*
- **`ServerAdmin`** — Stores admin identities. Access control state strictly restricted from clients.
- ~~`IssuedProblem`~~ — *(Legacy V1 table — unused, remove in P1)*
- ~~`TeacherVerificationCode`~~ — *(Legacy V1 table — unused, remove in P1)*

---

## Operational Learnings (SpaceTimeDB 2.0.3)

Hard-won production lessons. Read before touching views or schema.

### 1. View failures block every client, not just the one with bad data

SpaceTimeDB re-evaluates **all subscribed views for all connected clients** on every transaction, regardless of which tables changed. If a view panics or errors for even one client, the error is returned to **whoever called the reducer that triggered the re-evaluation** — not to the client whose data caused the failure.

**Consequence:** A single corrupt/orphaned row in one user's data can make `start_session()` fail for a completely unrelated user. The error message names the failing view, not the bad row.

**Diagnosis tip:** Check subscription order in `client/src/main.tsx`. SpaceTimeDB reports the *first* failing view in subscription order — fixing it may reveal the next one in the list.

### 2. `sort_by_key` / `dedup_by_key` inside views crashes WASM evaluation

Calling `Vec::sort_by_key` or `Vec::dedup_by_key` on a result Vec inside a `#[spacetimedb::view]` body triggers a WASM evaluation error in SpaceTimeDB 2.0.3. The symptom is `"Error materializing view <name>"` with no further detail.

**Rules:**
- **Eliminate dedup when semantically unnecessary.** Two BTree index scans on disjoint fields (e.g., `initiator_identity` vs `recipient_identity` in `Friendship`) are always disjoint by definition — no dedup needed.
- **Use `HashSet` for dedup when it is necessary** (see `my_classroom_members` for the pattern). Inserting into a set is safe; `Vec::sort` + `Vec::dedup` is not.
- Do not use `Vec::sort_by_key` or `Vec::dedup_by_key` in any view body.

### 3. Always use BTree index lookups — never `.iter().filter()`

`ctx.db.table().iter().filter(|r| r.field == value)` is a full O(n) table scan. At scale (answers table, sessions table) this causes view timeouts and slow reducer execution.

**Correct pattern:**
```rust
// Good — O(log n) BTree lookup
ctx.db.answers().session_id().filter(&session_id)

// Bad — O(n) full scan
ctx.db.answers().iter().filter(|a| a.session_id == session_id)
```

Every indexed field (marked `#[index(btree)]` in `lib.rs`) has a corresponding accessor method. Use it.

### 4. Orphaned foreign-key rows cause view materialization failures

`ClassroomMember` rows whose `classroom_id` points to a deleted `Classroom` cause `my_classroom_members` (and any other view that does a join on that field) to fail for the affected user — which, per rule 1, blocks all clients.

SpaceTimeDB 2.0.3 has no referential integrity enforcement. When a `Classroom` is deleted (via `leave_classroom` teacher path), all its `ClassroomMember` rows must be deleted in the same reducer. See the `leave_classroom` reducer for the pattern.

**Recovery:** The `cleanup_orphaned_memberships` reducer can be called via CLI to delete any stale rows:
```bash
spacetime call spacetimemath cleanup_orphaned_memberships --server maincloud
```

### 5. `auto_inc` IDs reset to 0 after each deploy

SpaceTimeDB resets `auto_inc` counters to 0 on every publish, while existing rows keep their higher IDs. Inserting with `id: 0` will collide with the first existing row.

**Pattern:** Use `try_insert` in a retry loop (up to 200 attempts) for all auto-incremented tables. The counter advances on each collision until it clears existing IDs. This is already the established pattern in `create_classroom`, `start_class_sprint`, etc.
