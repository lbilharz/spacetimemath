# SpacetimeMath: Product Vision & Architecture

## The Core Educational Philosophy

SpacetimeMath is not a digital worksheet; it is a **fast-paced, multiplayer, cognitive video game** designed to safely guide students through their exact Zone of Proximal Development (ZPD). 

Our fundamental objective is escaping rigid, flat "tier-based" progression loops (where students grind forever on things they already know, or quit from frustration on things they don't). We prioritize cognitive plasticity over raw speed memorization. 

To accomplish this, the game is constructed atop three core mechanics:
* **Sprint** = Fast recall (The 60-second flagship).
* **Focus** = Visual strategy practice (Untimed puzzle-solving to master the grid territory).
* **Boss** = Hard-coded cognitive roadblocks worth substantially more points.

### The Client Physics (0ms Latency UI)
If the student operates at 60 frames-per-second, the app must never drop them. We explicitly bypass traditional web frameworks (e.g., decoupling React controlled-state from `<input>` fields, shifting to native `onPointerDown` for iOS touch registration instead of laggy `onClick` wrappers). The mathematical DOM latency must explicitly mirror the speed of the underlying SpacetimeDB Rust engine to prevent battery drain and thermal throttling.

---

## The Grammar of the Grid

The brand logo (the grid) isn't just an icon; it is the physical mechanism of the game. Operations are physically represented and manipulated:
* **Multiplication** builds rectangles.
* **Division** reverses or splits rectangles.
* **Addition** rides constant-sum diagonals.
* **Subtraction** backtracks along difference lines.
* **Fractions** shade or share territory (visual regions, not abstract math drills).

## High-Speed Gameplay (The "Subway Surfer" Lane Runner)
We refuse to force mobile users to split their attention between a game character and a static keyboard. Instead, the game's movement *is* the mathematical answer input.

* **Math Metro / Grid Runner:** An equation appears (e.g., `6 × 7`). The player doesn't type; they swipe their avatar into the lane that displays the correct factor (`42`, `48`, `36`).
* **The Pacing:** High-speed, kinetic swiping for raw cognitive fluency, organically interrupted every 10–15 seconds by a "Station Stop" where a Hard Fact acts as a boss that requires typed input.

## Live Classroom Invasions
* **Grid Claim Sprint**: Correct answers light cells. Combos are awarded for full rows/columns.
* **Family Fusion**: Securing a full fact family (e.g., `7×8`, `8×7`, `56÷7`, `56÷8`) grants a shield or multiplier.
* **Quadrant Conquest**: Real-time multiplayer where classroom teams race to fill their quadrant of the grid, then invade the center. Correct answers stabilize the team's territory; wrong answers crack tiles.

---

## Architectural Reality (The Friction & The Why)

To execute a vision of high-speed swiping and real-time 30-player classroom grid invasions without compromising privacy or adaptive intelligence, we have explicitly chosen an architecture with unique trade-offs:

### 1. SpacetimeDB (The Zero-Latency Backbone)
* **What it is:** A WebAssembly, in-memory database where the server logic (Rust reducers) runs natively inside the data store over persistent WebSockets.
* **Why we use it:** We are building a multiplayer video game. SpacetimeDB acts as our authoritative game engine/referee. It calculates physics and grid collisions in milliseconds without taxing a disk, enabling 0ms Leaderboards and instant Lane Runner collision detection.
* **The Trade-off (The Friction):** Because it compiles to WASM, it physically cannot run heavy machine learning libraries (like PyTorch). This forces a bifurcated architecture where our intelligent AI must live offline.

### 2. Deep Knowledge Tracing (The Psychometric AI)
* **What it is:** An advanced Machine Learning Recurrent Neural Network (LSTM) that acts as an "Adaptive Teacher," predicting a student's mastery of microscopic cognitive boundaries (e.g., "Fact Family 5s" vs. "Hard Facts").
* **Why we use it:** To power the ZPD and ensure students are only served questions they are cognitively prepared for.
* **The Trade-off:** Because SpacetimeDB can't run the model, a Python FastAPI background worker (hosted on Hugging Face / Modal) async-syncs telemetry, trains the LSTM, and pushes new cognitive weights back to the game engine.

### 3. EduGraph Semantic Interoperability
* **What it is:** An open-source RDF/OWL Knowledge Graph categorizing education globally.
* **Why we use it:** If another app or curriculum wants to know our student's math level, they instantly understand it because we mathematically align to the same URI (`http://edugraph.io/edu/Multiplication`).
* **The Trade-off:** The official EduGraph is macroscopic. To support our granular DKT engine, we strictly sub-class their nodes into microscopic skills using a custom semantic graph (`spacetimemath.ttl`).

### 4. Zero-PII GDPR Compliance
* **What it is:** The mathematical removal of the Student Identity from the data flow.
* **Why we use it:** To legally train the PyTorch LSTM models on global cloud infrastructure (Hugging Face) without requiring localized German servers or exposing children's PII.
* **The Execution:** The `<KcTelemetry>` SpacetimeDB structure explicitly strips Usernames and Identities. It natively logs *only* Session Handles, Latency vectors, and binary correctness before the Python offline worker retrieves it.

---

## Implementation Roadmap (Future Iterations)

1. **Abstract the Problem Model**: Generalize the Rust `generator.rs` engine to handle `[Op, FamilyKey, PromptForm]`.
2. **Division MVP**: Reverse the existing Multiplication family grid. Present early questions as swipes/multiple choice, leveraging the existing SpacetimeDB ledger.
3. **Generalize Mental Strategy Modules**: Upgrade `getRechenweg(a,b)` to support visual array-splitting (Division) and make-10 bars (Addition).
4. **The Additive Grid**: Overlay a new sum grid. Diagonals become explicit interactive game objects.
5. **Fractions Domain**: Introduce shading territories (Equivalence/Comparison) completely independent of the arithmetic keyboard.
6. **Lane Runner Prototype**: Hook up Capacitor touch inputs to swipe the player between physical React lanes, converting the SpacetimeDB response latency into visual velocity.
