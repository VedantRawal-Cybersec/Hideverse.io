import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'src/maps/map-data.json');
const catalog = JSON.parse(await readFile(file, 'utf8'));

const expected = new Map([
  ['ravenwood', 'kick-the-box'],
  ['nexus', 'who-is-real'],
  ['museum', 'hide-and-heist'],
  ['hospital', 'monster-hunt'],
  ['hotel', 'floor-by-floor'],
  ['axiom', 'traitor'],
]);

const requiredRoles = new Map([
  ['ravenwood', ['seeker', 'hider']],
  ['nexus', ['civilian', 'mimic']],
  ['museum', ['guard']],
  ['hospital', ['monster']],
  ['hotel', ['seeker', 'guard']],
  ['axiom', ['civilian', 'guard', 'traitor']],
]);

function fail(message) {
  throw new Error(`[roadmap-qa] ${message}`);
}

function insideBounds(map, point) {
  const [x, y, z] = point;
  const [minX, minY, minZ] = map.worldBounds.min;
  const [maxX, maxY, maxZ] = map.worldBounds.max;
  return x >= minX && x <= maxX && y >= minY && y <= maxY && z >= minZ && z <= maxZ;
}

function insideSolid(structure, point) {
  if (structure.size[1] < 1) return false;
  const [x, y, z] = point;
  const [sx, sy, sz] = structure.position;
  const [wx, wy, wz] = structure.size;
  return (
    Math.abs(x - sx) < wx / 2 &&
    Math.abs(y - sy) < wy / 2 &&
    Math.abs(z - sz) < wz / 2
  );
}

function assertUnique(items, label, mapId) {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) fail(`${mapId}: duplicate ${label} id ${item.id}`);
    ids.add(item.id);
  }
}

if (!Array.isArray(catalog.maps) || catalog.maps.length !== 6) {
  fail(`expected 6 maps, received ${catalog.maps?.length ?? 0}`);
}

for (const map of catalog.maps) {
  const expectedMode = expected.get(map.id);
  if (!expectedMode) fail(`unexpected map id ${map.id}`);
  if (map.mode.id !== expectedMode) {
    fail(`${map.id}: expected mode ${expectedMode}, received ${map.mode.id}`);
  }

  if (map.structures.length < 8) fail(`${map.id}: needs at least 8 architecture structures`);
  if (map.props.length < 3) fail(`${map.id}: needs at least 3 props`);
  if (map.doors.length < 1) fail(`${map.id}: needs at least 1 door`);
  if (map.hidingSpots.length < 4) fail(`${map.id}: needs at least 4 hiding areas`);
  if (map.objectives.length < 3) fail(`${map.id}: needs at least 3 objectives`);
  if (map.navNodes.length < 8) fail(`${map.id}: needs at least 8 navigation nodes`);
  if (map.actorSpawns.length < 3) fail(`${map.id}: needs at least 3 role actors`);

  if (
    !Number.isFinite(map.lod.mobileObjectBudget) ||
    !Number.isFinite(map.lod.desktopObjectBudget) ||
    map.lod.mobileObjectBudget <= 0 ||
    map.lod.desktopObjectBudget < map.lod.mobileObjectBudget
  ) {
    fail(`${map.id}: invalid LOD/mobile object budgets`);
  }

  if (!insideBounds(map, map.spawn)) fail(`${map.id}: player spawn is outside world bounds`);

  assertUnique(map.structures, 'structure', map.id);
  assertUnique(map.props, 'prop', map.id);
  assertUnique(map.doors, 'door', map.id);
  assertUnique(map.hidingSpots, 'hiding spot', map.id);
  assertUnique(map.objectives, 'objective', map.id);
  assertUnique(map.navNodes, 'navigation node', map.id);
  assertUnique(map.actorSpawns, 'actor', map.id);

  const navIds = new Set(map.navNodes.map((node) => node.id));
  for (const actor of map.actorSpawns) {
    if (!insideBounds(map, actor.position)) fail(`${map.id}: actor ${actor.id} is out of bounds`);
    for (const nodeId of actor.patrol) {
      if (!navIds.has(nodeId)) fail(`${map.id}: actor ${actor.id} references missing nav node ${nodeId}`);
    }
  }

  for (const group of [
    ['door', map.doors],
    ['hiding spot', map.hidingSpots],
    ['objective', map.objectives],
    ['navigation node', map.navNodes],
  ]) {
    const [label, items] = group;
    for (const item of items) {
      if (!insideBounds(map, item.position)) {
        fail(`${map.id}: ${label} ${item.id} is outside world bounds`);
      }
    }
  }

  if (map.id !== 'ravenwood') {
    const gameplayPoints = [
      ...map.objectives.map((item) => ['objective', item]),
      ...map.hidingSpots.map((item) => ['hiding spot', item]),
      ...map.navNodes.map((item) => ['navigation node', item]),
      ...map.actorSpawns.map((item) => ['actor', item]),
    ];

    for (const [label, item] of gameplayPoints) {
      const blocker = map.structures.find((structure) => insideSolid(structure, item.position));
      if (blocker) {
        fail(`${map.id}: ${label} ${item.id} is embedded in solid structure ${blocker.id}`);
      }
    }
  }

  const actualRoles = new Set(map.actorSpawns.map((actor) => actor.role));
  for (const role of requiredRoles.get(map.id) ?? []) {
    if (!actualRoles.has(role)) fail(`${map.id}: missing required actor role ${role}`);
  }

  for (const channel of ['ambient', 'sun', 'fill', 'clear']) {
    const value = map.lighting[channel];
    if (!Array.isArray(value) || value.length !== 3 || value.some((entry) => !Number.isFinite(entry))) {
      fail(`${map.id}: invalid lighting channel ${channel}`);
    }
  }
}

const modes = new Set(catalog.maps.map((map) => map.mode.id));
if (modes.size !== 6) fail('all six maps must use distinct game modes');

console.log(
  `[roadmap-qa] PASS — 6 maps, 6 modes, ${catalog.maps.reduce((sum, map) => sum + map.objectives.length, 0)} objectives, ${catalog.maps.reduce((sum, map) => sum + map.actorSpawns.length, 0)} role actors, complete navigation/LOD metadata.`,
);
