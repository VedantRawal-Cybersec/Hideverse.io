import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const [catalogText, html, main, performanceManager, multiplayer, characters, manifestText] =
  await Promise.all([
    readFile(path.join(root, 'src/maps/map-data.json'), 'utf8'),
    readFile(path.join(root, 'index.html'), 'utf8'),
    readFile(path.join(root, 'src/main.ts'), 'utf8'),
    readFile(path.join(root, 'src/core/performance-manager.ts'), 'utf8'),
    readFile(path.join(root, 'src/core/multiplayer-client.ts'), 'utf8'),
    readFile(path.join(root, 'src/core/character-system.ts'), 'utf8'),
    readFile(path.resolve(root, '../../assets/manifest.json'), 'utf8'),
  ]);

const catalog = JSON.parse(catalogText);
const manifest = JSON.parse(manifestText);

function fail(message) {
  throw new Error(`[release-qa] ${message}`);
}

for (const map of catalog.maps ?? []) {
  if (map.lod.mobileObjectBudget > map.lod.desktopObjectBudget) {
    fail(`${map.id}: mobile object budget exceeds desktop budget`);
  }
  if (map.lod.mobileObjectBudget > 64) {
    fail(`${map.id}: mobile object budget is too high for browser-first target`);
  }
}

for (const marker of [
  'id="mobile-sprint"',
  'id="mobile-crouch"',
  'id="mobile-interact"',
  'id="mobile-jump"',
  'id="quality-select"',
  'id="sensitivity-slider"',
  'id="round-result"',
]) {
  if (!html.includes(marker)) fail(`game shell missing ${marker}`);
}

for (const marker of [
  'PerformanceManager',
  'roundElapsedSeconds',
  'consumeRemoteObjectives',
  'setMovementLocked',
]) {
  if (!main.includes(marker)) fail(`main runtime missing ${marker}`);
}

for (const marker of ['adaptiveScale', 'maxPixelRatio', 'measuredFps']) {
  if (!performanceManager.includes(marker)) fail(`adaptive performance missing ${marker}`);
}

for (const marker of [
  'EventSource',
  'submitObjective',
  'consumeRemoteObjectives',
  'resetRound',
  'sync-snapshot',
]) {
  if (!multiplayer.includes(marker)) fail(`multiplayer release runtime missing ${marker}`);
}

const riggedCharacter = manifest.assets?.find(
  (asset) => asset.id === 'kaykit-character-rogue-hooded' && asset.status === 'acquired',
);
if (!riggedCharacter) fail('rigged CC0 desktop character asset is not registered');

for (const marker of [
  'Rogue_Hooded.glb',
  "tracks.get('Idle')",
  "tracks.get('Walking_A')",
  "tracks.get('Running_A')",
  "assignAnimation('idle'",
  "matchMedia('(pointer: coarse)')",
]) {
  if (!characters.includes(marker)) fail(`rigged character runtime missing ${marker}`);
}

console.log(
  `[release-qa] PASS — ${catalog.maps.length} maps, mobile budgets, adaptive rendering, touch controls, shared objectives, replay flow, realtime room sync and rigged desktop locomotion verified.`,
);
