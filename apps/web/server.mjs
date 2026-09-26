import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
const port = Number.parseInt(process.env.PORT ?? '4173', 10);
const rooms = new Map();
const streams = new Map();

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.wasm', 'application/wasm'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
  ['.bin', 'application/octet-stream'],
  ['.ktx2', 'image/ktx2'],
]);

function resolveRequest(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const requested = decoded === '/' ? '/index.html' : decoded;
  const resolved = path.resolve(dist, `.${requested}`);
  return resolved.startsWith(dist) ? resolved : null;
}

function apiHeaders() {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function sendJson(res, status, value) {
  res.writeHead(status, apiHeaders());
  res.end(JSON.stringify(value));
}

function sanitizeToken(value, fallback) {
  const normalized = String(value ?? fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);
  return normalized || fallback;
}

function sanitizeObjective(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 64);
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 16_384) throw new Error('payload too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function roomKey(map, room) {
  return `${map}:${room}`;
}

function getRoom(map, room) {
  const key = roomKey(map, room);
  let current = rooms.get(key);
  if (!current) {
    const now = Date.now();
    current = {
      map,
      room,
      players: new Map(),
      objectives: new Set(),
      createdAt: now,
      roundStartedAt: now,
    };
    rooms.set(key, current);
  }
  return current;
}

function streamSet(map, room) {
  const key = roomKey(map, room);
  let current = streams.get(key);
  if (!current) {
    current = new Set();
    streams.set(key, current);
  }
  return current;
}

function streamClientCount() {
  let count = 0;
  for (const clients of streams.values()) count += clients.size;
  return count;
}

function writeEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastRoom(map, room, event, payload) {
  const clients = streams.get(roomKey(map, room));
  if (!clients) return;
  for (const client of clients) writeEvent(client.res, event, payload);
}

function pruneRoom(room) {
  const staleBefore = Date.now() - 30_000;
  let changed = false;
  for (const [playerId, state] of room.players) {
    if (state.serverUpdatedAt < staleBefore) {
      room.players.delete(playerId);
      changed = true;
      broadcastRoom(room.map, room.room, 'leave', { playerId });
    }
  }
  return changed;
}

function resolveMatchRoom(map) {
  for (let index = 1; index <= 99; index += 1) {
    const roomCode = `MATCH-${String(index).padStart(2, '0')}`;
    const room = getRoom(map, roomCode);
    pruneRoom(room);
    if (room.players.size < 8) return roomCode;
  }
  return `MATCH-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

function validPosition(position) {
  return (
    Array.isArray(position) &&
    position.length === 3 &&
    position.every((value) => Number.isFinite(value) && Math.abs(value) <= 1000)
  );
}

function stateDistance(a, b) {
  return Math.hypot(
    a.position[0] - b.position[0],
    a.position[1] - b.position[1],
    a.position[2] - b.position[2],
  );
}

function publicPlayerState(state) {
  const { serverUpdatedAt, initialized, ...publicState } = state;
  return { ...publicState, updatedAt: serverUpdatedAt };
}

function roomSnapshot(room, playerId = '') {
  return {
    room: room.room,
    map: room.map,
    peers: [...room.players.values()]
      .filter((state) => state.playerId !== playerId)
      .map(publicPlayerState),
    playerCount: room.players.size,
    maxPlayers: 8,
    objectives: [...room.objectives],
    roundStartedAt: room.roundStartedAt,
  };
}

async function handleMultiplayer(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, apiHeaders());
    res.end();
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/multiplayer/health') {
    sendJson(res, 200, {
      ok: true,
      rooms: rooms.size,
      streamClients: streamClientCount(),
      maxRoomSize: 8,
      transport: 'http+sse',
      sharedObjectives: true,
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/multiplayer/join') {
    const body = await readJson(req);
    const map = sanitizeToken(body.map, 'RAVENWOOD').toLowerCase();
    const requestedRoom = sanitizeToken(body.room, 'LOCAL');
    const roomCode = requestedRoom === 'MATCH' ? resolveMatchRoom(map) : requestedRoom;
    const playerId = String(body.playerId ?? '').slice(0, 80);
    if (!playerId) {
      sendJson(res, 400, { error: 'playerId required' });
      return true;
    }

    const room = getRoom(map, roomCode);
    pruneRoom(room);
    if (room.players.size === 0) {
      room.objectives.clear();
      room.roundStartedAt = Date.now();
    }
    if (!room.players.has(playerId) && room.players.size >= 8) {
      sendJson(res, 409, { error: 'room full' });
      return true;
    }

    const now = Date.now();
    room.players.set(playerId, {
      playerId,
      map,
      room: roomCode,
      position: [0, 2, 0],
      yaw: 0,
      motion: 'idle',
      serverUpdatedAt: now,
      updatedAt: now,
      initialized: false,
    });

    broadcastRoom(map, roomCode, 'presence', {
      room: roomCode,
      playerCount: room.players.size,
    });

    sendJson(res, 200, {
      ...roomSnapshot(room, playerId),
      playerId,
      transport: 'http+sse',
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/multiplayer/state') {
    const body = await readJson(req);
    const map = sanitizeToken(body.map, 'RAVENWOOD').toLowerCase();
    const roomCode = sanitizeToken(body.room, 'LOCAL');
    const playerId = String(body.playerId ?? '').slice(0, 80);
    if (!playerId || !validPosition(body.position)) {
      sendJson(res, 400, { error: 'invalid state' });
      return true;
    }

    const room = getRoom(map, roomCode);
    pruneRoom(room);
    const previous = room.players.get(playerId);
    if (!previous) {
      sendJson(res, 403, { error: 'join room first' });
      return true;
    }

    const now = Date.now();
    const elapsed = Math.max(0.05, (now - previous.serverUpdatedAt) / 1000);
    const requested = {
      playerId,
      map,
      room: roomCode,
      position: body.position.map((value) => Number(value)),
      yaw: Number.isFinite(body.yaw) ? Number(body.yaw) : 0,
      motion: ['idle', 'walk', 'run', 'sprint', 'jump'].includes(body.motion)
        ? body.motion
        : 'idle',
      serverUpdatedAt: now,
      updatedAt: now,
      initialized: true,
    };

    const maxTravel = 4 + elapsed * 12;
    if (previous.initialized && stateDistance(previous, requested) > maxTravel) {
      sendJson(res, 422, { error: 'movement rejected', reason: 'speed envelope exceeded' });
      return true;
    }

    room.players.set(playerId, requested);
    broadcastRoom(map, roomCode, 'state', publicPlayerState(requested));
    sendJson(res, 200, { ok: true, serverUpdatedAt: now });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/multiplayer/objective') {
    const body = await readJson(req);
    const map = sanitizeToken(body.map, 'RAVENWOOD').toLowerCase();
    const roomCode = sanitizeToken(body.room, 'LOCAL');
    const playerId = String(body.playerId ?? '').slice(0, 80);
    const objectiveId = sanitizeObjective(body.objectiveId);
    if (!playerId || !objectiveId) {
      sendJson(res, 400, { error: 'playerId and objectiveId required' });
      return true;
    }

    const room = getRoom(map, roomCode);
    pruneRoom(room);
    if (!room.players.has(playerId)) {
      sendJson(res, 403, { error: 'join room first' });
      return true;
    }

    const added = !room.objectives.has(objectiveId);
    room.objectives.add(objectiveId);
    if (added) {
      broadcastRoom(map, roomCode, 'objective', { objectiveId, playerId });
    }

    sendJson(res, 200, {
      ok: true,
      added,
      objectives: [...room.objectives],
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/multiplayer/reset') {
    const body = await readJson(req);
    const map = sanitizeToken(body.map, 'RAVENWOOD').toLowerCase();
    const roomCode = sanitizeToken(body.room, 'LOCAL');
    const playerId = String(body.playerId ?? '').slice(0, 80);
    const room = getRoom(map, roomCode);
    pruneRoom(room);

    if (!playerId || !room.players.has(playerId)) {
      sendJson(res, 403, { error: 'join room first' });
      return true;
    }

    room.objectives.clear();
    room.roundStartedAt = Date.now();
    broadcastRoom(map, roomCode, 'round-reset', {
      playerId,
      roundStartedAt: room.roundStartedAt,
    });
    sendJson(res, 200, { ok: true, roundStartedAt: room.roundStartedAt });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/multiplayer/leave') {
    const body = await readJson(req);
    const map = sanitizeToken(body.map, 'RAVENWOOD').toLowerCase();
    const roomCode = sanitizeToken(body.room, 'LOCAL');
    const playerId = String(body.playerId ?? '').slice(0, 80);
    const room = getRoom(map, roomCode);
    const removed = playerId ? room.players.delete(playerId) : false;
    if (removed) {
      broadcastRoom(map, roomCode, 'leave', { playerId });
      broadcastRoom(map, roomCode, 'presence', {
        room: roomCode,
        playerCount: room.players.size,
      });
    }
    sendJson(res, 200, { ok: true, removed });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/multiplayer/events') {
    const map = sanitizeToken(url.searchParams.get('map'), 'RAVENWOOD').toLowerCase();
    const roomCode = sanitizeToken(url.searchParams.get('room'), 'LOCAL');
    const playerId = String(url.searchParams.get('playerId') ?? '').slice(0, 80);
    const room = getRoom(map, roomCode);
    pruneRoom(room);

    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'access-control-allow-origin': '*',
    });
    res.write(': connected\n\n');

    const clients = streamSet(map, roomCode);
    const client = { playerId, res };
    clients.add(client);

    writeEvent(res, 'snapshot', roomSnapshot(room, playerId));

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(client);
      if (clients.size === 0) streams.delete(roomKey(map, roomCode));
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/multiplayer/room') {
    const map = sanitizeToken(url.searchParams.get('map'), 'RAVENWOOD').toLowerCase();
    const roomCode = sanitizeToken(url.searchParams.get('room'), 'LOCAL');
    const playerId = String(url.searchParams.get('playerId') ?? '').slice(0, 80);
    const room = getRoom(map, roomCode);
    pruneRoom(room);
    sendJson(res, 200, roomSnapshot(room, playerId));
    return true;
  }

  return false;
}

async function send(res, filePath) {
  const data = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mime.get(ext) ?? 'application/octet-stream',
    'Cache-Control':
      ext === '.html' || ext === '.json' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  res.end(data);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname.startsWith('/api/multiplayer/')) {
      const handled = await handleMultiplayer(req, res, url);
      if (!handled) sendJson(res, 404, { error: 'not found' });
      return;
    }

    const requested = resolveRequest(req.url ?? '/');
    if (!requested) return res.writeHead(400).end('Bad request');

    let file = requested;
    try {
      const info = await stat(file);
      if (info.isDirectory()) {
        file = path.join(file, 'index.html');
      } else if (!info.isFile()) {
        throw new Error('not a file');
      }
    } catch {
      file = path.join(dist, 'index.html');
    }

    await send(res, file);
  } catch (error) {
    console.error('[Hideverse web server]', error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'internal server error' });
    } else {
      res.end();
    }
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[Hideverse web] site + authoritative room API listening on :${port}`);
});
