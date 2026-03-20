<div align="center">
  
  <img src="assets/hero_mockup.png" alt="Better 1UP Hero Showcase" width="900" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
  <br/><br/>
  
  <h1>Better 1UP </h1>
  <p><b>Real-time multiplayer multiplication trainer. Adaptive problem selection, difficulty-weighted scoring, live sync via SpaceTimeDB.</b></p>

  <a href="https://better-1up.vercel.app"><img src="https://img.shields.io/badge/Play_the_Game-%23FBBA00?style=for-the-badge&logoColor=white" alt="Play Now" /></a>
  <a href="https://better1up.vercel.app"><img src="https://img.shields.io/badge/Visit_Website-%232C3E50?style=for-the-badge&logoColor=white" alt="Website" /></a>
  <br/><br/>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flbilharz%2Fspacetimemath"><img src="https://vercel.com/button" alt="Deploy with Vercel"/></a>
  <br/><br/>

  <img src="https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB" alt="React" />
  <img src="https://img.shields.io/badge/typescript-%230074c1.svg?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/vite-%23646CFF.svg?style=flat&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/rust-%23000000.svg?style=flat&logo=rust&logoColor=white" alt="Rust" />

</div>

<br/>

## Overview

Better 1UP is a high-speed, adaptive multiplication trainer. It features a completely redesigned, premium "Concept 3 Grid" UI that offers tactile feedback, progressive web app (PWA) mobile support, and seamless multiplayer synchronization.

### What's New
- **Internationalization (i18n):** Fully translated into English, German, Turkish, and Arabic.
- **Premium Concept 3 UI:** High-contrast Navy headers, stacked equations, and native-feeling mobile components.
- **Progressive Web App:** Installable on iOS and Android with full Safe Area support for a native fullscreen experience.

---

## Features

**Sprint (60 s)**
- Adaptive selection: `p(appear) ∝ difficulty_weight × (1.5 − last10_accuracy)`
- Score = Σ difficulty weights of correct answers; wrong answer = −2 s penalty
- Tier-gated pool: only unlocked pairs appear until mastery gates open the next tier

**Learning tiers** (unlocked automatically at end of session)
| Tier | Unlocks | Unlock condition |
|------|---------|-----------------|
| 0 | ×1 ×2 ×10 | automatic |
| 1 | +×3 | 80%* of tier-0 pairs mastered |
| 2 | +×5 | 80%* of tier-1 pairs mastered |
| 3 | +×4 | 80%* of tier-2 pairs mastered |
| 4 | +×6 | 80%* of tier-3 pairs mastered |
| 5 | +×7 | 80%* of tier-4 pairs mastered |
| 6 | +×8 | 80%* of tier-5 pairs mastered |
| 7 | +×9 | 80%* of tier-6 pairs mastered |

\* Speed bonus: if ≥80% of sprint answers for current-tier pairs are <2 s, threshold drops to 50%.

**Mastery grid** — heatmap of all answered ordered pairs (4×6 and 6×4 tracked separately)

**Difficulty weights** — bootstrapped from Ashcraft research; auto-updated after 20+ community answers:
`weight = 0.2 + 1.8×error_rate + 0.5×(avg_ms/10s)`

**Classrooms** — teacher creates class (6-char code + QR), live leaderboard + aggregate mastery grid

**Accounts** — no passwords; SpaceTimeDB token in localStorage; transfer code + recovery key for device migration

## Tech stack

- **Backend**: SpaceTimeDB — Rust module on maincloud
- **Frontend**: Vite + React 19 + TypeScript on Vercel
- **No external database** — SpaceTimeDB is the only data store

## Running locally

```bash
# Start local SpaceTimeDB
spacetime start

# Build and publish the server module
cd server
~/.cargo/bin/cargo build --target wasm32-unknown-unknown --release
spacetime publish spacetimemath --server local --bin-path target/wasm32-unknown-unknown/release/spacetimemath.wasm

# Generate TypeScript bindings
spacetime generate --lang typescript --out-dir ../client/src/module_bindings \
  --bin-path target/wasm32-unknown-unknown/release/spacetimemath.wasm

# Start frontend (client/.env.local already points to ws://127.0.0.1:3000)
cd ../client && npm install && npm run dev
```

## Publishing to maincloud

Use the Makefile from the repo root:

```bash
make publish    # build WASM + publish to maincloud (non-interactive)
make generate   # regenerate client/src/module_bindings from server source
make deploy     # publish + generate + run integration tests (full gate)
make call REDUCER=migrate_seed_best_scores   # call any reducer
```

Schema changes (adding columns) require `--break-clients` — disconnects all clients until they reload.

> **Why not just `spacetime publish` directly?** The CLI invokes cargo internally but won't find it unless `~/.cargo/bin` is in PATH — which it isn't in non-login shells. The Makefile uses absolute paths for both binaries to avoid this.

## Security design — "public result tables"

SpacetimeDB lets you mark a table as **private** so its rows are never sent to other clients. This is how `recovery_keys` and `transfer_codes` are protected.

However, **SpacetimeDB 2.0.3 has a limitation: private tables cannot push new rows to a subscriber.** The client can't receive a row that was just written for it by a reducer.

To work around this, four "result" tables are marked `public` instead of private:

| Table | Holds | Lifetime |
|-------|-------|----------|
| `recovery_code_results` | Player's own 12-char recovery code | Until the player calls `get_my_recovery_code` again |
| `restore_results` | Temporary auth token from account restore | Milliseconds — deleted after client reloads |
| `class_recovery_results` | All student codes for a classroom | Until teacher disconnects |
| `issued_problem_results` | Server-issued anti-cheat problem token | Until `submit_answer` consumes it |

**Why is this safe?**

- **No new information is exposed.** Recovery codes already live in the public `recovery_code_results` table from when they were created. `class_recovery_results` just re-packages the same codes for teacher printing — a malicious client subscribed to both tables would see the same codes either way.
- **The sensitive data exists for milliseconds.** `restore_results` holds an auth token only for the time between the server writing it and the client swapping it into `localStorage` and reloading. The row is deleted in `identity_disconnected` so it can never linger.
- **The real secrets stay private.** The `recovery_keys` table — which stores the actual long-lived secrets that tokens are derived from — remains strictly private and is never sent to any client.
- **Threat model fit.** This is a primary school app. The realistic threat is a student guessing a classmate's 12-character random code (36¹² ≈ 4.7 × 10¹⁸ combinations), not a sophisticated attacker monitoring raw WebSocket frames at the right millisecond.

When SpacetimeDB adds reliable private-table push in a future version, these four tables can be made private again without any other changes.

## Project structure

```
server/src/lib.rs          Rust module: schema, reducers, tier logic
client/src/
  module_bindings/         Auto-generated TypeScript bindings (do not edit)
  pages/                   RegisterPage LobbyPage SprintPage ResultsPage
                           ResultsPage ClassroomPage AccountPage
  components/              MasteryGrid BottomNav TopBar DotArray
  utils/learningTier.ts    Client-side pair→tier mapping
```
