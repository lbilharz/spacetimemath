/**
 * cleanupBots.ts
 *
 * Reconnects each saved bot token and calls leaveClassroom for every
 * classroom the bot is still a member of.  Fixes the "Error materializing
 * view my_classroom_members" error caused by stale bot rows.
 *
 * Usage:
 *   npm run cleanup-bots
 */
import { connect, waitFor, type ConnectedClient } from '../src/__tests__/helpers.js';
import fs from 'node:fs';

process.env.TEST_STDB_URI = 'wss://maincloud.spacetimedb.com';
process.env.TEST_STDB_DB  = 'spacetimemath';

const TOKEN_FILE = 'bot_tokens.json';

if (!fs.existsSync(TOKEN_FILE)) {
  console.error(`No ${TOKEN_FILE} found — nothing to clean up.`);
  process.exit(0);
}

const tokens: string[] = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
console.log(`Found ${tokens.length} bot tokens to clean up.`);

async function cleanupBot(token: string, idx: number): Promise<void> {
  let client: ConnectedClient | undefined;
  try {
    client = await connect(token);
    const hex = client.identity.toHexString();
    console.log(`Bot ${idx + 1} connected (${hex.slice(0, 6)}…)`);

    // Wait for subscriptions to populate
    await new Promise(r => setTimeout(r, 2000));

    const memberships = [...client.conn.db.my_classroom_members.iter()];
    if (memberships.length === 0) {
      console.log(`  Bot ${idx + 1}: no classroom memberships — already clean.`);
      return;
    }

    // Collect unique classroom IDs
    const classroomIds = new Set<bigint>(
      memberships.map((m: any) => m.classroomId as bigint)
    );

    for (const classroomId of classroomIds) {
      console.log(`  Bot ${idx + 1}: leaving classroom ${classroomId}…`);
      await client.conn.reducers.leaveClassroom({ classroomId });
      await new Promise(r => setTimeout(r, 500));
    }
    console.log(`  Bot ${idx + 1}: done.`);
  } catch (err) {
    console.error(`  Bot ${idx + 1}: error — ${err}`);
  } finally {
    client?.conn.disconnect();
  }
}

(async () => {
  for (let i = 0; i < tokens.length; i++) {
    await cleanupBot(tokens[i], i);
  }
  console.log('\nAll bots cleaned up. Delete bot_tokens.json if you want to start fresh:');
  console.log('  rm client/bot_tokens.json');
  process.exit(0);
})();
