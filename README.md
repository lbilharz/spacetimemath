# SpaceTimeMath

Real-time multiplayer multiplication trainer. Adaptive problem selection, difficulty-weighted scoring, live sync via SpaceTimeDB.

## Tech stack

- **Backend**: SpaceTimeDB — Rust module on maincloud
- **Frontend**: Vite + React 19 + TypeScript on Vercel
- **No external database** — SpaceTimeDB is the only data store

## Features

**Sprint (60 s)**
- Adaptive selection: `p(appear) ∝ difficulty_weight × (1.5 − last10_accuracy)`
- Score = Σ difficulty weights of correct answers; wrong answer = −2 s penalty
- Tier-gated pool: only unlocked pairs appear until mastery gates open the next tier

**Learning tiers** (unlocked automatically at end of session)
| Tier | Factors | Unlock condition |
|------|---------|-----------------|
| 0 — Starter | ×1 ×2 ×5 ×10 | automatic |
| 1 — Building | +×3 ×4 | 80% of tier-0 pairs mastered |
| 2 — Advanced | +×6–9 | 80% of tier-1 pairs mastered |
| 3 — Extended | ×11 ×12 ×15 ×20 ×25 | 80% of tier-2 pairs mastered |

Speed bonus: if ≥80% of sprint answers for current-tier pairs are <2 s, threshold drops to 50%.

**Mastery grid** — heatmap of all answered ordered pairs (4×6 and 6×4 tracked separately)

**Difficulty weights** — bootstrapped from Ashcraft research; auto-updated after 20+ community answers:
`weight = 0.2 + 1.8×error_rate + 0.5×(avg_ms/10s)`

**Classrooms** — teacher creates class (6-char code + QR), live leaderboard + aggregate mastery grid

**Accounts** — no passwords; SpaceTimeDB token in localStorage; transfer code + recovery key for device migration

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
make deploy     # publish + generate in one step
make call REDUCER=migrate_seed_best_scores   # call any reducer
```

Schema changes (adding columns) require `--break-clients` — disconnects all clients until they reload.

> **Why not just `spacetime publish` directly?** The CLI invokes cargo internally but won't find it unless `~/.cargo/bin` is in PATH — which it isn't in non-login shells. The Makefile uses absolute paths for both binaries to avoid this.

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
