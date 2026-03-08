# SpaceTimeDB Math Sprint

A real-time multiplayer multiplication trainer built as a prototype for the bettermarks v2 architecture pitch. Every design decision maps directly to a concept from the pitch: adaptive problem selection (IRT), difficulty-weighted scoring (Derived Score), directional mastery tracking, and live sync via SpaceTimeDB.

## What it demonstrates

| Prototype feature | Architecture concept |
|---|---|
| Ordered pair tracking (4×6 ≠ 6×4) | n:m competency mapping |
| Bootstrap + live difficulty weights | Derived Score from interaction data |
| Weighted session score | IRT-based exercise difficulty |
| Problem selection via difficulty × accuracy | Adaptive learning path |
| 10×10 mastery grid heatmap | Implizit → Explizit |
| Classroom leaderboard + mastery grid | Teacher dashboard |
| Live leaderboard across devices | Real-time sync via SpaceTimeDB |

## Tech stack

- **Backend**: [SpaceTimeDB](https://spacetimedb.com) — Rust module, published to maincloud
- **Frontend**: Vite + React 19 + TypeScript, deployed on Vercel
- **No external database** — SpaceTimeDB is the only data store; clients subscribe to live table updates

## Features

**Sprint (60 seconds)**
- Problems selected adaptively: `p(appear) ∝ difficulty_weight × (1.5 − user_accuracy)`
- Score = sum of difficulty weights for correct answers (weighted, not raw count)
- Wrong answer: red flash, correct answer shown, −2s penalty
- Post-session breakdown: hardest pairs you struggled with

**Mastery grid**
- 10×10 heatmap of all ordered pairs (1–10)
- Green = mastered (>80% over last 10), yellow = learning, red = struggling, gray = untouched
- Available per player and aggregated per classroom

**Difficulty weights**
- Bootstrapped from Ashcraft multiplication difficulty research
- Auto-updated after community data: `weight = 0.2 + 1.8×error_rate + 0.5×(avg_ms/10s)`
- Range: 0.2 (trivial) → 2.0 (hardest)

**Classrooms**
- Teacher creates a class, gets a 6-char code + QR code
- Students join via code or QR scan (auto-join URL: `/?join=CODE`)
- Members can hide their stats from the class leaderboard per classroom
- A player can be in multiple classrooms simultaneously
- Live class leaderboard + aggregate mastery grid

**Accounts**
- No passwords — identity is a SpaceTimeDB token stored in `localStorage`
- Transfer code (6-char, 1h TTL) to move account to another device
- Permanent recovery key (12-char) for long-term backup

## Running locally

**Prerequisites**: Rust, `spacetime` CLI ([install](https://spacetimedb.com/install))

```bash
# Start a local SpaceTimeDB instance
spacetime start --in-memory

# Publish the server module
cd server
spacetime publish --server local spacetimemath

# Generate TypeScript bindings
cd ..
spacetime generate --module-path ./server --lang typescript \
  --out-dir ./client/src/module_bindings

# Start the frontend
cd client
npm install
npm run dev
```

The app connects to `ws://127.0.0.1:3000` by default.

## Connecting to maincloud

Set environment variables before running the client:

```bash
VITE_SPACETIMEDB_URI=wss://maincloud.spacetimedb.com
VITE_SPACETIMEDB_DB=spacetimemath
npm run dev
```

Or create `client/.env.local`:
```
VITE_SPACETIMEDB_URI=wss://maincloud.spacetimedb.com
VITE_SPACETIMEDB_DB=spacetimemath
```

## Project structure

```
server/          Rust SpaceTimeDB module (schema + reducers)
client/
  src/
    module_bindings/   Auto-generated TypeScript bindings (do not edit)
    pages/             RegisterPage, LobbyPage, SprintPage, ResultsPage,
                       ClassroomPage, AccountPage
    components/        MasteryGrid, Leaderboard
    auth.ts            Token capture + credential persistence
    main.tsx           SpaceTimeDB connection setup
```

## Regenerating bindings

After any change to `server/src/lib.rs`:

```bash
spacetime generate --module-path ./server --lang typescript \
  --out-dir ./client/src/module_bindings
```

## Publishing to maincloud

```bash
PATH="$PATH:$HOME/.cargo/bin" spacetime publish \
  --module-path server --server maincloud spacetimemath
```
