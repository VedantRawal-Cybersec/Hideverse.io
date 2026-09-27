import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

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

async function waitForWsMessage(ws, predicate, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('timed out waiting for WebSocket message'));
    }, timeoutMs);

    const onMessage = (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!predicate(payload)) return;
      cleanup();
      resolve(payload);
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timer);
      ws.off('message', onMessage);
      ws.off('error', onError);
    };

    ws.on('message', onMessage);
    ws.on('error', onError);
  });
}

async function openV2Client(room, name) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  const hello = await waitForWsMessage(ws, (msg) => msg.t === 'hello');
  ws.send(JSON.stringify({ t: 'join', room, name, map: 'wilmot' }));
  const welcome = await waitForWsMessage(ws, (msg) => msg.t === 'welcome');
  return { ws, hello, welcome };
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
  if (
    health.transport !== 'http+sse' ||
    health.maxRoomSize !== 8 ||
    health.sharedObjectives !== true
  ) {
    throw new Error(`unexpected health payload: ${JSON.stringify(health)}`);
  }

  const compressed = await fetch(`${base}/game/index.html`, {
    headers: { 'accept-encoding': 'br' },
  });
  if (!compressed.ok || compressed.headers.get('content-encoding') !== 'br') {
    throw new Error('Brotli delivery is not active for compressible game assets');
  }

  const assetsDir = path.join(root, 'dist', 'game', 'assets');
  const assetNames = await readdir(assetsDir);
  const javascriptAssets = [];
  for (const name of assetNames) {
    if (!name.endsWith('.js')) continue;
    const info = await stat(path.join(assetsDir, name));
    javascriptAssets.push({ name, size: info.size });
  }
  javascriptAssets.sort((a, b) => b.size - a.size);
  const largestBundle = javascriptAssets[0];
  if (!largestBundle) throw new Error('game JavaScript bundle was not found');

  const burst = await Promise.all(
    Array.from({ length: 12 }, () =>
      fetch(`${base}/game/assets/${largestBundle.name}`, {
        headers: { 'accept-encoding': 'gzip' },
      }),
    ),
  );
  if (
    burst.some((response) => !response.ok || response.headers.get('content-encoding') !== 'gzip')
  ) {
    throw new Error('concurrent compressed bundle delivery failed');
  }
  await Promise.all(burst.map((response) => response.arrayBuffer()));

  const headers = { 'content-type': 'application/json' };
  const first = await json('/api/multiplayer/join', {
    method: 'POST',
    headers,
    body: JSON.stringify({ map: 'ravenwood', room: 'QA-ROOM', playerId: 'qa-player-1' }),
  });
  if (first.room !== 'QA-ROOM') throw new Error('room code was not preserved');
  if (!Number.isFinite(first.roundStartedAt)) throw new Error('round start time was not supplied');

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

  let room = await json('/api/multiplayer/room?map=ravenwood&room=QA-ROOM&playerId=qa-player-2');
  if (room.playerCount !== 2 || room.peers?.length !== 1) {
    throw new Error(`unexpected room state: ${JSON.stringify(room)}`);
  }
  if (room.peers[0]?.position?.[2] !== 38) {
    throw new Error('authoritative first player state was not accepted');
  }

  await json('/api/multiplayer/objective', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      map: 'ravenwood',
      room: 'QA-ROOM',
      playerId: 'qa-player-1',
      objectiveId: 'library-box',
    }),
  });

  room = await json('/api/multiplayer/room?map=ravenwood&room=QA-ROOM&playerId=qa-player-2');
  if (!room.objectives?.includes('library-box')) {
    throw new Error(`shared objective missing: ${JSON.stringify(room)}`);
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

  const previousRoundStartedAt = room.roundStartedAt;
  await new Promise((resolve) => setTimeout(resolve, 5));
  const reset = await json('/api/multiplayer/reset', {
    method: 'POST',
    headers,
    body: JSON.stringify({ map: 'ravenwood', room: 'QA-ROOM', playerId: 'qa-player-2' }),
  });
  if (!Number.isFinite(reset.roundStartedAt) || reset.roundStartedAt < previousRoundStartedAt) {
    throw new Error('round reset did not advance the server clock');
  }

  room = await json('/api/multiplayer/room?map=ravenwood&room=QA-ROOM&playerId=qa-player-2');
  if (room.objectives?.length !== 0) {
    throw new Error(`round reset did not clear objectives: ${JSON.stringify(room)}`);
  }

  await json('/api/multiplayer/leave', {
    method: 'POST',
    headers,
    body: JSON.stringify({ map: 'ravenwood', room: 'QA-ROOM', playerId: 'qa-player-1' }),
  });

  const v2a = await openV2Client('v2-qa-room', 'Alpha');
  if (!Number.isFinite(v2a.hello.id) || v2a.welcome.room !== 'v2-qa-room') {
    throw new Error(`unexpected Game V2 welcome: ${JSON.stringify(v2a.welcome)}`);
  }

  const peerJoin = waitForWsMessage(v2a.ws, (msg) => msg.t === 'peer_join');
  const v2b = await openV2Client('v2-qa-room', 'Bravo');
  const joined = await peerJoin;
  if (joined.name !== 'Bravo' || v2b.welcome.peers?.length !== 1) {
    throw new Error(
      `Game V2 room sync failed: ${JSON.stringify({ joined, welcome: v2b.welcome })}`,
    );
  }

  const pongPromise = waitForWsMessage(v2a.ws, (msg) => msg.t === 'pong');
  v2a.ws.send(JSON.stringify({ t: 'ping', ts: 12345 }));
  const pong = await pongPromise;
  if (pong.ts !== 12345) throw new Error('Game V2 WebSocket ping/pong failed');

  v2a.ws.close();
  v2b.ws.close();

  console.log(
    '[multiplayer-qa] PASS — compressed delivery burst, legacy HTTP/SSE multiplayer, and Game V2 WebSocket room relay verified.',
  );
} finally {
  server.kill('SIGTERM');
}
