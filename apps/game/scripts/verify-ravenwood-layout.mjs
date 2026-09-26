import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const layout = JSON.parse(
  await readFile(path.join(root, 'src/maps/ravenwood/gameplay-layout.json'), 'utf8'),
);
const interior = JSON.parse(
  await readFile(path.join(root, 'src/maps/ravenwood/interior-layout.json'), 'utf8'),
);
const manifest = JSON.parse(
  await readFile(path.resolve(root, '../../assets/manifest.json'), 'utf8'),
);

const errors = [];
const ids = new Set();
const { min, max } = layout.worldBounds;

function checkPoint(point, kind) {
  if (!point.id || ids.has(point.id)) errors.push(`${kind}: duplicate/missing id ${point.id}`);
  ids.add(point.id);
  for (const axis of ['x', 'y', 'z']) {
    if (!Number.isFinite(point[axis])) errors.push(`${point.id}: invalid ${axis}`);
    if (point[axis] < min[axis] || point[axis] > max[axis]) {
      errors.push(`${point.id}: ${axis} outside Ravenwood bounds`);
    }
  }
}

for (const spawn of layout.spawns.hiders) checkPoint(spawn, 'hider spawn');
for (const spawn of layout.spawns.seekers) checkPoint(spawn, 'seeker spawn');
for (const objective of layout.objectives) checkPoint(objective, 'objective');

const acquiredFiles = new Set(
  manifest.assets
    .filter((asset) => asset.status === 'acquired')
    .flatMap((asset) => asset.localFiles),
);

for (const placement of interior.placements) {
  checkPoint(placement, 'interior placement');
  const manifestPath = `assets/runtime/${placement.asset}`;
  if (!acquiredFiles.has(manifestPath)) {
    errors.push(`${placement.id}: furnishing asset is not acquired in manifest: ${manifestPath}`);
  }
  for (const axis of ['x', 'y', 'z']) {
    if (!Number.isFinite(placement.collider?.[axis]) || placement.collider[axis] <= 0) {
      errors.push(`${placement.id}: invalid collider half extent ${axis}`);
    }
  }
}

if (layout.spawns.hiders.length < 6) errors.push('Ravenwood requires at least 6 hider spawns.');
if (layout.spawns.seekers.length < 1) errors.push('Ravenwood requires at least 1 seeker spawn.');
if (layout.objectives.length < 3) errors.push('Ravenwood requires at least 3 objective slots.');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(
  `[ravenwood:layout] PASS — ${layout.spawns.hiders.length} hider spawns, ${layout.spawns.seekers.length} seeker spawns, ${layout.objectives.length} objective slots, ${interior.placements.length} furnishing anchors.`,
);
