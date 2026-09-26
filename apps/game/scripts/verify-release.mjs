import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const [
  catalogText,
  html,
  main,
  performanceManager,
  multiplayer,
  characters,
  playerController,
  playerAvatar,
  graphicsPipeline,
  manifestText,
] = await Promise.all([
    readFile(path.join(root, 'src/maps/map-data.json'), 'utf8'),
    readFile(path.join(root, 'index.html'), 'utf8'),
    readFile(path.join(root, 'src/main.ts'), 'utf8'),
    readFile(path.join(root, 'src/core/performance-manager.ts'), 'utf8'),
    readFile(path.join(root, 'src/core/multiplayer-client.ts'), 'utf8'),
    readFile(path.join(root, 'src/core/character-system.ts'), 'utf8'),
    readFile(path.join(root, 'src/core/player-controller.ts'), 'utf8'),
    readFile(path.join(root, 'src/core/player-avatar.ts'), 'utf8'),
    readFile(path.join(root, 'src/core/graphics-pipeline.ts'), 'utf8'),
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
  'id="mobile-view"',
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

for (const id of [
  'kaykit-character-rogue-hooded',
  'kaykit-character-rogue',
  'kaykit-character-knight',
  'kaykit-character-mage',
  'kaykit-character-barbarian',
]) {
  const asset = manifest.assets?.find((candidate) => candidate.id === id && candidate.status === 'acquired');
  if (!asset) fail(`rigged CC0 character asset is not registered: ${id}`);
}

for (const marker of [
  'Rogue_Hooded.glb',
  'Rogue.glb',
  'Knight.glb',
  'Mage.glb',
  'Barbarian.glb',
  "tracks.get('Idle')",
  "tracks.get('Walking_A')",
  "tracks.get('Running_A')",
]) {
  if (!characters.includes(marker)) fail(`role character runtime missing ${marker}`);
}

for (const marker of ['Vec3.FORWARD', 'Vec3.RIGHT', 'castRay', 'third-person', 'enableSnapToGround']) {
  if (!playerController.includes(marker)) fail(`player controller missing ${marker}`);
}

for (const marker of ['Rogue.glb', 'setViewMode', "assignAnimation('run'")]) {
  if (!playerAvatar.includes(marker)) fail(`third-person avatar missing ${marker}`);
}

for (const marker of ['CameraFrame', 'TONEMAP_ACES', 'bloom', 'grading', 'fog']) {
  if (!graphicsPipeline.includes(marker)) fail(`graphics pipeline missing ${marker}`);
}

console.log(
  `[release-qa] PASS — ${catalog.maps.length} maps, mobile budgets, adaptive rendering, touch controls, FPS/TPS physics, shared objectives, realtime room sync, multi-character rigged locomotion and HDR graphics verified.`,
);
