import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 43991;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/multiplayer/health`);
      if (response.ok) return response.json();
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`multiplayer server did not start\n${serverOutput}`);
}

async function json(pathname, init) {
  const response = await fetch(`${base}${pathname}`, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${pathname} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

try {
  const health = await waitForHealth();
  if (health.transport !== 'http+sse' || health.maxRoomSize !== 8) {
    throw new Error(`unexpected health payload: ${JSON.stringify(health)}`);
  }

  const headers = { 'content-type': 'application/json' };
  const first = await json('/api/multiplayer/join', {
    method: 'POST',
    headers,
    body: JSON.stringify({ map: 'ravenwood', room: 'QA-ROOM', playerId: 'qa-player-1' }),
  });
  if (first.room !== 'QA-ROOM') throw new Error('room code was not preserved');

  await json('/api/multiplayer/join', {
    method: 'POST',
    headers,
    body: JSON.stringify({ map: 'ravenwood', room: 'QA-ROOM', playerId: 'qa-player-2' }),
  });

  await json('/api/multiplayer/state', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      map: 'ravenwood',
      room: 'QA-ROOM',
      playerId: 'qa-player-1',
      position: [0, 2.2, 38],
      yaw: 15,
      motion: 'run',
    }),
  });

  const room = await json(
    '/api/multiplayer/room?map=ravenwood&room=QA-ROOM&playerId=qa-player-2',
  );
  if (room.playerCount !== 2 || room.peers?.length !== 1) {
    throw new Error(`unexpected room state: ${JSON.stringify(room)}`);
  }
  if (room.peers[0]?.position?.[2] !== 38) {
    throw new Error('authoritative first player state was not accepted');
  }

  const streamController = new AbortController();
  const streamResponse = await fetch(
    `${base}/api/multiplayer/events?map=ravenwood&room=QA-ROOM&playerId=qa-player-2`,
    { signal: streamController.signal },
  );
  if (!streamResponse.ok || !streamResponse.body) {
    throw new Error('SSE stream did not open');
  }
  const reader = streamResponse.body.getReader();
  const firstEvent = await reader.read();
  const text = new TextDecoder().decode(firstEvent.value);
  streamController.abort();
  if (!text.includes('connected') && !text.includes('snapshot')) {
    throw new Error(`SSE stream missing initial event: ${text}`);
  }

  await json('/api/multiplayer/leave', {
    method: 'POST',
    headers,
    body: JSON.stringify({ map: 'ravenwood', room: 'QA-ROOM', playerId: 'qa-player-1' }),
  });

  console.log('[multiplayer-qa] PASS — health, join, first state, room sync, SSE, and leave verified.');
} finally {
  server.kill('SIGTERM');
}
