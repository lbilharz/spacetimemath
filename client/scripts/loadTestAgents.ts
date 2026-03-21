import { connect, waitFor, type ConnectedClient } from '../src/__tests__/helpers.js';
import fs from 'node:fs';

const code = process.argv[2];
if (!code) {
  console.error("Usage: TEST_STDB_URI=... npx tsx client/scripts/loadTestAgents.ts <CODE>");
  process.exit(1);
}

const AGENT_COUNT = 10;
const TOKEN_FILE = 'bot_tokens.json';

const MATHEMATICIANS = [
  "Euler", "Gauss", "Newton", "Riemann", "Lagrange",
  "Noether", "Hypatia", "Lovelace", "Germain", "Mirzakhani",
  "Turing", "vonNeumann", "Ramanujan", "Euclid", "Pythagoras",
  "Archimedes", "Descartes", "Fibonacci", "Pascal", "Fermat"
];

// Dictates the simulation speed limits & accuracy of each bot, simulating real class disparity
const SKILL_PROFILES = [
  { baseMs: 400, varianceMs: 500, errorRate: 0.02 },  // Euler: Very fast, precise
  { baseMs: 500, varianceMs: 800, errorRate: 0.05 },  // Gauss
  { baseMs: 700, varianceMs: 1200, errorRate: 0.08 }, // Newton
  { baseMs: 1000, varianceMs: 1500, errorRate: 0.12 }, // Riemann
  { baseMs: 1200, varianceMs: 2000, errorRate: 0.18 }, // Lagrange
  { baseMs: 1500, varianceMs: 2500, errorRate: 0.25 }, // Noether
  { baseMs: 2000, varianceMs: 3000, errorRate: 0.35 }, // Hypatia
  { baseMs: 2500, varianceMs: 3500, errorRate: 0.45 }, // Lovelace
  { baseMs: 3000, varianceMs: 4500, errorRate: 0.60 }, // Germain
  { baseMs: 3500, varianceMs: 5500, errorRate: 0.75 }, // Mirzakhani: Very slow, struggles
];

let globalTokens: string[] = [];
if (fs.existsSync(TOKEN_FILE)) {
  globalTokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

function selectDiagnosticProblem(): { a: number; b: number } {
  const a = 1 + Math.floor(Math.random() * 10);
  const b = 1 + Math.floor(Math.random() * 10);
  return { a, b };
}

async function startAgent(index: number, existingToken?: string) {
  console.log(`Agent ${index} connecting...`);
  const client = await connect(existingToken);
  const hex = client.identity.toHexString();
  const botName = MATHEMATICIANS[(index - 1) % MATHEMATICIANS.length];
  
  globalTokens[index - 1] = client.token;
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(globalTokens, null, 2));
  
  if (!existingToken) {
    console.log(`Agent ${index} connected fresh (${hex.slice(0, 6)}). Registering as ${botName}...`);
    await client.conn.reducers.register({ username: botName });
  } else {
    console.log(`Agent ${index} reconnected via token (${hex.slice(0, 6)}) as ${botName}.`);
  }
  
  console.log(`Agent ${index} joining classroom ${code}...`);
  await client.conn.reducers.joinClassroom({ code });
  
  while (true) {
    console.log(`Agent ${index} ready. Waiting for teacher to start class sprint...`);
    const session = await waitFor(() => {
      for (const s of client.conn.db.sessions.iter()) {
        if (s.playerIdentity.toHexString() === hex && !s.isComplete) return s;
      }
    }, 3600_000); 
    
    if (!session) continue;
    
    const sprint = [...client.conn.db.class_sprints.iter()].find(s => s.id === session.classSprintId)!;
    const isDiagnostic = sprint.isDiagnostic;
    console.log(`Agent ${index} sprint started! Diagnostic: ${isDiagnostic}`);
    
    let sprintStartTime = Date.now();
    let seenTokens = new Set<string>();
    
    if (!isDiagnostic) {
      await client.conn.reducers.nextProblem({ sessionId: session.id });
    }
    
    while (true) {
      const latestSession = [...client.conn.db.sessions.iter()].find(s => s.id === session.id);
      if (latestSession && latestSession.isComplete) {
         console.log(`Agent ${index} local session completed!`);
         break;
      }

      let a: number, b: number, problemToken: string;

      if (isDiagnostic) {
        // Diagnostic Flow: Client issues problem locally
        const prob = selectDiagnosticProblem();
        a = prob.a; b = prob.b;
        
        await client.conn.reducers.issueProblem({ sessionId: session.id, a, b });
        const problemRow = await waitFor(() => {
          for (const r of client.conn.db.issued_problem_results.iter()) {
            if (r.owner.toHexString() === hex && !seenTokens.has(r.token)) return r;
          }
        }, 30_000);
        if (!problemRow) break;
        problemToken = problemRow.token;
      } else {
        // Normal Flow: Wait for Server nextProblem
        const problemRow = await waitFor(() => {
          for (const r of client.conn.db.next_problem_results.iter()) {
            if (r.owner.toHexString() === hex && !seenTokens.has(r.token)) return r;
          }
        }, 30_000);
        if (!problemRow) break;
        a = problemRow.a;
        b = problemRow.b;
        problemToken = problemRow.token;
      }
      
      // Use profile to simulate human latency
      const profile = SKILL_PROFILES[(index - 1) % SKILL_PROFILES.length];
      const thinkingTime = profile.baseMs + Math.random() * profile.varianceMs;
      await new Promise(r => setTimeout(r, thinkingTime));
      
      seenTokens.add(problemToken);

      // Mutate answer based on profile accuracy
      let submittedAnswer = a * b;
      let attempts = 1;
      const makeError = Math.random() < profile.errorRate;
      
      if (makeError) {
        // Plausible calculation errors
        const errorModifiers = [+1, -1, +2, -2, +10, -10, +a, -a, +b, -b];
        const mod = errorModifiers[Math.floor(Math.random() * errorModifiers.length)];
        submittedAnswer = Math.max(1, (a * b) + mod);
        attempts = 2; // Simulating a multi-try stumble
      }

      try {
        await client.conn.reducers.submitAnswer({
          sessionId: session.id,
          a, b,
          userAnswer: submittedAnswer,
          responseMs: thinkingTime,
          attempts,
          problemToken,
        });
        
        if (!isDiagnostic) {
          await client.conn.reducers.nextProblem({ sessionId: session.id });
        }
      } catch (e) {
        console.log(`Agent ${index} caught error: ${e}`);
        break;
      }
    }
  }
}

async function run() {
  const promises = [];
  for (let i = 0; i < AGENT_COUNT; i++) {
    promises.push(startAgent(i + 1, globalTokens[i]));
    await new Promise(r => setTimeout(r, 200)); 
  }
  console.log("\n>>> All 10 agents spawned! <<<\n");
  await Promise.all(promises);
  console.log("All agents finished.");
  process.exit(0);
}

run().catch(console.error);
