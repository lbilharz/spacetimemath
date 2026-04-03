import { connect, waitFor, type ConnectedClient } from '../src/__tests__/helpers.js';
import fs from 'node:fs';

// Fallback environment settings so the test suite can connect naturally
process.env.TEST_STDB_URI = process.env.TEST_STDB_URI || 'wss://maincloud.spacetimedb.com';
process.env.TEST_STDB_DB = process.env.TEST_STDB_DB || 'spacetimemath-test';

let targetCode = process.argv[2];
const isAutoMode = !targetCode;
if (!targetCode) {
  console.log("No classroom code provided. Engaging AUTOPILOT MODE (Virtual Teacher + Sprint).");
}

const AGENT_COUNT = 10;
const TOKEN_FILE = 'bot_tokens.json';

const KIDS = [
  "Emil", "Mila", "Anton", "Kian", "Clara",
  "Levi", "Elif", "Oskar", "Ida", "Yasin",
  "Leni", "Finn", "Maja", "Ali", "Nele",
  "Karl", "Elias", "Noa", "Lotte", "Fiete"
];

// Dictates the simulation speed limits & accuracy of each bot, simulating real class disparity
const SKILL_PROFILES = [
  { baseMs: 700, varianceMs: 500, errorRate: 0.02 },  // Emil: Very fast, precise
  { baseMs: 800, varianceMs: 800, errorRate: 0.05 },  // Mila
  { baseMs: 900, varianceMs: 1200, errorRate: 0.08 }, // Anton
  { baseMs: 1000, varianceMs: 1500, errorRate: 0.12 }, // Kian
  { baseMs: 1200, varianceMs: 2000, errorRate: 0.18 }, // Clara
  { baseMs: 1500, varianceMs: 2500, errorRate: 0.25 }, // Levi
  { baseMs: 2000, varianceMs: 3000, errorRate: 0.35 }, // Elif
  { baseMs: 2500, varianceMs: 3500, errorRate: 0.45 }, // Oskar
  { baseMs: 3000, varianceMs: 4500, errorRate: 0.60 }, // Ida
  { baseMs: 3500, varianceMs: 5500, errorRate: 0.75 }, // Yasin: Very slow, struggles
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

async function startVirtualTeacher(): Promise<{ client: ConnectedClient, code: string, classroomId: bigint }> {
  console.log(`Teacher Agent connecting...`);
  const client = await connect();
  const hex = client.identity.toHexString();
  
  console.log(`Teacher Agent connected (${hex.slice(0, 6)}). Registering...`);
  await client.conn.reducers.register({ username: "Automated Teacher", playerType: { tag: "Teacher" }, email: "automated@test.com" });
  
  console.log(`Teacher Agent creating classroom...`);
  await client.conn.reducers.createClassroom({ name: "Automated Test Class" });
  
  const room = await waitFor(() => {
    for (const r of client.conn.db.classrooms.iter()) {
      if (r.teacher.toHexString() === hex) return r;
    }
  }, 10_000);
  
  if (!room) throw new Error("Teacher failed to create classroom");
  console.log(`Teacher Agent created classroom: ${room.code} (ID: ${room.id})`);
  
  return { client, code: room.code, classroomId: room.id };
}

async function startAgent(index: number, existingToken: string | undefined, code: string) {
  console.log(`Agent ${index} connecting...`);
  const client = await connect(existingToken);
  const hex = client.identity.toHexString();
  const botName = KIDS[(index - 1) % KIDS.length];
  
  globalTokens[index - 1] = client.token;
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(globalTokens, null, 2));
  
  if (!existingToken) {
    console.log(`Agent ${index} connected fresh (${hex.slice(0, 6)}). Registering as ${botName}...`);
    await client.conn.reducers.register({ username: botName, playerType: { tag: "Student" }, email: undefined });
  } else {
    console.log(`Agent ${index} reconnected via token (${hex.slice(0, 6)}) as ${botName}.`);
  }
  
  try {
    console.log(`Agent ${index} joining classroom ${code}...`);
    await client.conn.reducers.joinClassroom({ code });
  } catch (e: any) {
    if (e.message?.includes('register')) {
      console.log(`Agent ${index} orphaned by DB wipe! Re-registering as ${botName}...`);
      await client.conn.reducers.register({ username: botName, playerType: { tag: "Student" }, email: undefined });
      await client.conn.reducers.joinClassroom({ code });
    } else {
      throw e;
    }
  }
  
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
          const s = [...client.conn.db.sessions.iter()].find(s => s.id === session.id);
          if (s?.isComplete) return 'COMPLETED';
          for (const r of client.conn.db.issued_problem_results_v2.iter()) {
            if (r.owner.toHexString() === hex && !seenTokens.has(r.token)) return r;
          }
        }, 30_000);
        if (problemRow === 'COMPLETED' || !problemRow) break;
        problemToken = problemRow.token;
      } else {
        // Normal Flow: Wait for Server nextProblem
        const problemRow = await waitFor(() => {
          const s = [...client.conn.db.sessions.iter()].find(s => s.id === session.id);
          if (s?.isComplete) return 'COMPLETED';
          for (const r of client.conn.db.next_problem_results_v2.iter()) {
            if (r.owner.toHexString() === hex && !seenTokens.has(r.token)) return r;
          }
        }, 30_000);
        if (problemRow === 'COMPLETED' || !problemRow) break;
        a = problemRow.a;
        b = problemRow.b;
        problemToken = problemRow.token;
      }
      
      // Use profile to simulate human latency
      const profile = SKILL_PROFILES[(index - 1) % SKILL_PROFILES.length];
      const thinkingTime = profile.baseMs + Math.random() * profile.varianceMs;
      
      seenTokens.add(problemToken);

      // Evaluate answer and potential mistakes BEFORE simulating typing
      let submittedAnswer = a * b;
      let attempts = 1;
      const makeError = Math.random() < profile.errorRate;
      
      if (makeError) {
        const errorModifiers = [+1, -1, +2, -2, +10, -10, +a, -a, +b, -b];
        const mod = errorModifiers[Math.floor(Math.random() * errorModifiers.length)];
        submittedAnswer = Math.max(1, (a * b) + mod);
        attempts = 2; // Simulating a multi-try stumble
      }

      // Simulate human typing delay
      const answerStr = submittedAnswer.toString();

      if (isDiagnostic) {
        // TAP MODE Simulator
        await new Promise(r => setTimeout(r, thinkingTime));
        const isFocused = Array.from(client.conn.db.teacher_focus.iter()).some(
          (f: any) => f.focusedStudentId.toHexString() === hex
        );
        if (isFocused) {
          client.conn.reducers.syncKeystroke({ currentInput: answerStr }).catch(() => {});
          // Hold the visual tap highlight for 150ms before committing the result to the server
          await new Promise(r => setTimeout(r, 150));
        }
      } else {
        // TYPE MODE Simulator
        const delayPerKeystroke = thinkingTime / Math.max(1, answerStr.length);
        for (let charIdx = 1; charIdx <= answerStr.length; charIdx++) {
          await new Promise(r => setTimeout(r, delayPerKeystroke));
          
          // Opt-in Telemetry: Am I being watched right now?
          const isFocused = Array.from(client.conn.db.teacher_focus.iter()).some(
            (f: any) => f.focusedStudentId.toHexString() === hex
          );
          
          if (isFocused) {
            const partial = answerStr.slice(0, charIdx);
            client.conn.reducers.syncKeystroke({ currentInput: partial }).catch(() => {});
          }
        }
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
  if (isAutoMode) {
    console.log(">>> Initiating Virtual Teacher Setup <<<");
    const teacherData = await startVirtualTeacher();
    targetCode = teacherData.code;
    
    const promises = [];
    for (let i = 0; i < AGENT_COUNT; i++) {
      promises.push(startAgent(i + 1, globalTokens[i], targetCode!));
      await new Promise(r => setTimeout(r, 200)); 
    }
    console.log(`\n>>> All 10 agents spawned. Waiting for them to join ${targetCode} <<<\n`);
    
    await waitFor(() => {
      let count = 0;
      for (const m of teacherData.client.conn.db.classroom_members.iter()) {
         if (m.classroomId === teacherData.classroomId) count++;
      }
      if (count >= AGENT_COUNT) return true;
    }, 60_000);
    
    console.log("\n>>> Teacher: All agents joined. Starting Sprint! <<<\n");
    await teacherData.client.conn.reducers.startClassSprint({ classroomId: teacherData.classroomId, isDiagnostic: false });
    
    await Promise.all(promises);
    console.log("All agents finished.");
  } else {
    // Normal targeted run
    const promises = [];
    for (let i = 0; i < AGENT_COUNT; i++) {
        promises.push(startAgent(i + 1, globalTokens[i], targetCode!));
        await new Promise(r => setTimeout(r, 200)); 
    }
    console.log("\n>>> All 10 agents spawned! <<<\n");
    await Promise.all(promises);
    console.log("All agents finished.");
  }
  process.exit(0);
}

run().catch(console.error);
