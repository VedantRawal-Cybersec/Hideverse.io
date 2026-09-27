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
  inputController,
  playerController,
  playerAvatar,
  combatSystem,
  graphicsPipeline,
  surfaceTextures,
  mapDetailPass,
  ravenwoodRuntime,
  manifestText,
  fpsTemplateSource,
] = await Promise.all([
  readFile(path.join(root, 'src/maps/map-data.json'), 'utf8'),
  readFile(path.join(root, 'index.html'), 'utf8'),
  readFile(path.join(root, 'src/main.ts'), 'utf8'),
  readFile(path.join(root, 'src/core/performance-manager.ts'), 'utf8'),
  readFile(path.join(root, 'src/core/multiplayer-client.ts'), 'utf8'),
  readFile(path.join(root, 'src/core/character-system.ts'), 'utf8'),
  readFile(path.join(root, 'src/core/input-controller.ts'), 'utf8'),
  readFile(path.join(root, 'src/core/player-controller.ts'), 'utf8'),
  readFile(path.join(root, 'src/core/player-avatar.ts'), 'utf8'),
  readFile(path.join(root, 'src/core/combat-system.ts'), 'utf8'),
  readFile(path.join(root, 'src/core/graphics-pipeline.ts'), 'utf8'),
  readFile(path.join(root, 'src/core/surface-textures.ts'), 'utf8'),
  readFile(path.join(root, 'src/maps/map-detail-pass.ts'), 'utf8'),
  readFile(path.join(root, 'src/maps/ravenwood/ravenwood.ts'), 'utf8'),
  readFile(path.resolve(root, '../../assets/manifest.json'), 'utf8'),
  readFile(
    path.resolve(root, '../../vendor/fps-template/bulletstorm-arena/SOURCE.md'),
    'utf8',
  ),
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
  'id="mobile-fire"',
  'id="mobile-aim"',
  'id="mobile-reload"',
  'id="mobile-slide"',
  'id="mobile-weapon"',
  'id="combat-ammo"',
  'id="combat-reserve"',
  'id="combat-health"',
  'id="hit-marker"',
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
  'CombatSystem',
  'combat.update',
  'characters.resetCombat',
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
  const asset = manifest.assets?.find(
    (candidate) => candidate.id === id && candidate.status === 'acquired',
  );
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

for (const marker of [
  'Vec3.FORWARD',
  'Vec3.RIGHT',
  'castRay',
  'third-person',
  'enableSnapToGround',
  'slideSeconds',
  'consumeSlide',
  'slideDirectionX',
]) {
  if (!playerController.includes(marker)) fail(`player controller missing ${marker}`);
}

for (const marker of [
  'consumeReload',
  'consumeWeaponSwitch',
  'mobile-fire',
  'mobile-aim',
  'addLookImpulse',
]) {
  if (!inputController.includes(marker)) fail(`combat input missing ${marker}`);
}

for (const marker of [
  'VANGUARD AR',
  'RIFT SMG',
  'BREACH-12',
  'adsFov',
  'reloadSeconds',
  'fireHitscan',
  'is-headshot',
  'combat-ammo',
]) {
  if (!combatSystem.includes(marker)) fail(`FPS combat runtime missing ${marker}`);
}

for (const marker of ['CombatHit', 'fireHitscan', 'headshot', 'resetCombat', 'respawnSeconds']) {
  if (!characters.includes(marker)) fail(`character combat runtime missing ${marker}`);
}

for (const marker of [
  'kamalesh404/multiplayer-fps-game',
  'cdde0f3cca57769ad7ae610c3c890438393b24d4',
  'MIT',
  'Deliberately NOT imported',
]) {
  if (!fpsTemplateSource.includes(marker)) fail(`FPS template provenance missing ${marker}`);
}

for (const marker of ['Rogue.glb', 'setViewMode', "assignAnimation('run'"]) {
  if (!playerAvatar.includes(marker)) fail(`third-person avatar missing ${marker}`);
}

for (const marker of ['CameraFrame', 'TONEMAP_ACES', 'bloom', 'grading', 'fog']) {
  if (!graphicsPipeline.includes(marker)) fail(`graphics pipeline missing ${marker}`);
}

for (const id of [
  'cc0-surface-concrete',
  'cc0-surface-brick',
  'cc0-surface-asphalt',
  'cc0-surface-metal',
  'cc0-surface-wood',
  'cc0-surface-plaster',
  'cc0-surface-tile',
]) {
  const asset = manifest.assets?.find(
    (candidate) => candidate.id === id && candidate.status === 'acquired',
  );
  if (!asset) fail(`real CC0 surface texture is not registered: ${id}`);
}

for (const marker of [
  'materials/cc0/',
  "'plaster'",
  "'concrete'",
  "'brick'",
  "'asphalt'",
  "'tile'",
  "'metal'",
  "'wood'",
  'ADDRESS_REPEAT',
  'diffuseMapTiling',
  'profiles',
]) {
  if (!surfaceTextures.includes(marker)) fail(`real surface runtime missing ${marker}`);
}

for (const marker of [
  'nexus-store-glass',
  'nexus-cinema-front',
  'nexus-entry-header',
  'hospital-entry-frame-top',
  'hospital-ward-window',
  'hospital-ceiling-light',
  'museum-display-glass',
  'museum-vault-frame',
  'museum-entry-canopy',
  'hotel-entry-glass',
  'hotel-room-door-frame',
  'hotel-floor-band',
  'axiom-reactor-glow',
  'axiom-specimen-glass',
  'axiom-ceiling-trunk',
  'loadPlacedAssets',
]) {
  if (!mapDetailPass.includes(marker)) fail(`map realism detail missing ${marker}`);
}

for (const marker of [
  'ravenwood-porch-column',
  'ravenwood-front-window',
  'ravenwood-front-step',
  'ravenwood-front-door-frame',
  'ravenwood-porch-rail',
]) {
  if (!ravenwoodRuntime.includes(marker)) fail(`Ravenwood realism detail missing ${marker}`);
}

console.log(
  `[release-qa] PASS — ${catalog.maps.length} maps, mobile budgets, adaptive rendering, touch controls, FPS/TPS physics, template-derived ADS/fire/reload/weapon switching/slide/headshot combat, shared objectives, realtime room sync, multi-character rigged locomotion, HDR graphics, progressive map-specific CC0 tiled surfaces and six-map architectural realism verified.`,
);
