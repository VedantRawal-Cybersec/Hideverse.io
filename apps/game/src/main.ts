import RAPIER from '@dimforge/rapier3d-compat';
import { Application, Color, Entity, FILLMODE_FILL_WINDOW, RESOLUTION_AUTO } from 'playcanvas';
import { AudioFeedback } from './core/audio-feedback';
import { CharacterSystem } from './core/character-system';
import { GraphicsPipeline } from './core/graphics-pipeline';
import { InputController } from './core/input-controller';
import { ModeEngine } from './core/mode-engine';
import { MultiplayerClient } from './core/multiplayer-client';
import { PerformanceManager, type QualityPreset } from './core/performance-manager';
import { PlayerAvatar } from './core/player-avatar';
import { FirstPersonController } from './core/player-controller';
import {
  hideverseMaps,
  nearestAreaLabel,
  pointInsideMap,
  selectedMapFromLocation,
  type Triplet,
} from './maps/map-catalog';
import { MapInteractionSystem } from './maps/interaction-system';
import { buildSelectedMap } from './maps/procedural-map';
import './styles.css';

function must<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Hideverse DOM is missing ${selector}`);
  return element as T;
}

function color(value: Triplet): Color {
  return new Color(value[0], value[1], value[2]);
}

const canvas = must<HTMLCanvasElement>('#game-canvas');
const mapStatus = must<HTMLSpanElement>('#map-status');
const fpsValue = must<HTMLSpanElement>('#fps-value');
const zoneValue = must<HTMLSpanElement>('#zone-value');
const interactionPrompt = must<HTMLDivElement>('#interaction-prompt');
const hiddenState = must<HTMLDivElement>('#hidden-state');
const debugPanel = must<HTMLElement>('#debug-panel');
const debugPosition = must<HTMLSpanElement>('#debug-position');
const debugZone = must<HTMLSpanElement>('#debug-zone');
const debugRole = must<HTMLSpanElement>('#debug-role');
const debugMeta = must<HTMLSpanElement>('#debug-meta');
const bootOverlay = must<HTMLDivElement>('#boot-overlay');
const mapEyebrow = must<HTMLParagraphElement>('#map-eyebrow');
const mapTitle = must<HTMLHeadingElement>('#map-title');
const mapSelect = must<HTMLSelectElement>('#map-select');
const modeName = must<HTMLElement>('#mode-name');
const modeTitle = must<HTMLElement>('#mode-title');
const modeObjective = must<HTMLParagraphElement>('#mode-objective');
const modeProgress = must<HTMLElement>('#mode-progress');
const modePanel = must<HTMLElement>('#mode-panel');
const modeTimer = must<HTMLElement>('#mode-timer');
const modeDanger = must<HTMLElement>('#mode-danger');
const modeOutcome = must<HTMLElement>('#mode-outcome');
const motionValue = must<HTMLElement>('#motion-value');
const staminaValue = must<HTMLElement>('#stamina-value');
const viewValue = must<HTMLElement>('#view-value');
const networkValue = must<HTMLElement>('#network-value');
const roomValue = must<HTMLElement>('#room-value');
const peersValue = must<HTMLElement>('#peers-value');
const roomCodeInput = must<HTMLInputElement>('#room-code-input');
const joinRoomButton = must<HTMLButtonElement>('#join-room');
const quickMatchButton = must<HTMLButtonElement>('#quick-match');
const copyInviteButton = must<HTMLButtonElement>('#copy-invite');
const qualitySelect = must<HTMLSelectElement>('#quality-select');
const sensitivitySlider = must<HTMLInputElement>('#sensitivity-slider');
const roundResult = must<HTMLElement>('#round-result');
const roundResultKicker = must<HTMLElement>('#round-result-kicker');
const roundResultTitle = must<HTMLElement>('#round-result-title');
const roundResultCopy = must<HTMLParagraphElement>('#round-result-copy');
const restartRoundButton = must<HTMLButtonElement>('#restart-round');

const map = selectedMapFromLocation();
const query = new URLSearchParams(window.location.search);
const debugEnabled = query.get('debug') === '1';

function normalizeRoomCode(value: string): string {
  return (
    value
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16) || 'LOCAL'
  );
}

function goToRoom(roomCode: string): void {
  const next = new URL(window.location.href);
  next.searchParams.set('room', normalizeRoomCode(roomCode));
  window.location.assign(next.toString());
}

function setRoundResult(outcome: 'playing' | 'won' | 'lost', message: string): void {
  const visible = outcome !== 'playing';
  roundResult.classList.toggle('is-visible', visible);
  roundResult.classList.toggle('is-lost', outcome === 'lost');

  if (!visible) return;
  roundResultKicker.textContent = outcome === 'won' ? 'ROUND COMPLETE' : 'ROUND FAILED';
  roundResultTitle.textContent = outcome === 'won' ? 'MISSION COMPLETE' : 'MISSION FAILED';
  roundResultCopy.textContent = message;
}

roomCodeInput.value = normalizeRoomCode(
  query.get('room') ?? localStorage.getItem('hideverse-last-room') ?? 'LOCAL',
);

joinRoomButton.addEventListener('click', () => {
  goToRoom(roomCodeInput.value);
});

quickMatchButton.addEventListener('click', () => {
  goToRoom('MATCH');
});

roomCodeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    goToRoom(roomCodeInput.value);
  }
});

copyInviteButton.addEventListener('click', async () => {
  const invite = new URL(window.location.href);
  invite.searchParams.set('map', map.id);
  invite.searchParams.set('room', normalizeRoomCode(roomValue.textContent ?? roomCodeInput.value));
  try {
    await navigator.clipboard.writeText(invite.toString());
    copyInviteButton.textContent = 'COPIED';
    window.setTimeout(() => {
      copyInviteButton.textContent = 'COPY INVITE';
    }, 1400);
  } catch (error) {
    console.warn('[Hideverse] invite copy unavailable', error);
    roomCodeInput.value = normalizeRoomCode(roomValue.textContent ?? roomCodeInput.value);
    roomCodeInput.select();
  }
});
debugPanel.classList.toggle('is-visible', debugEnabled);

document.title = `Hideverse.io — ${map.name} — ${map.mode.name}`;
mapEyebrow.textContent = `HIDEVERSE.IO · MAP ${String(map.index).padStart(2, '0')}`;
mapTitle.textContent = map.name.toUpperCase();
modeName.textContent = map.mode.name.toUpperCase();
modeTitle.textContent = map.mode.name;
modeObjective.textContent = map.mode.summary;

for (const candidate of hideverseMaps) {
  const option = document.createElement('option');
  option.value = candidate.id;
  option.textContent = `${String(candidate.index).padStart(2, '0')} · ${candidate.name} · ${candidate.mode.name}`;
  option.selected = candidate.id === map.id;
  mapSelect.append(option);
}

mapSelect.addEventListener('change', () => {
  const next = new URL(window.location.href);
  next.searchParams.set('map', mapSelect.value);
  window.location.assign(next.toString());
});

function setMapStatus(message: string): void {
  mapStatus.textContent = message;
}

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

async function boot(): Promise<void> {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const app = new Application(canvas);
  app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(RESOLUTION_AUTO);
  app.scene.ambientLight = color(map.lighting.ambient);

  const performanceManager = new PerformanceManager(app, coarse);
  qualitySelect.value = performanceManager.preset;

  const camera = new Entity('Player Camera');
  camera.addComponent('camera', {
    clearColor: color(map.lighting.clear),
    nearClip: 0.08,
    farClip: coarse ? 190 : 260,
    fov: coarse ? 76 : 72,
  });
  app.root.addChild(camera);

  const graphicsPipeline = new GraphicsPipeline(app, camera, coarse);
  graphicsPipeline.applyQuality(performanceManager.preset);

  const sun = new Entity(`${map.name} Key Light`);
  sun.addComponent('light', {
    type: 'directional',
    color: color(map.lighting.sun),
    intensity: map.lighting.sunIntensity,
    castShadows: performanceManager.shadowsEnabled,
    shadowResolution: performanceManager.shadowResolution,
    shadowDistance: coarse ? Math.min(55, map.lod.shadowDistance) : map.lod.shadowDistance,
  });
  sun.setEulerAngles(
    map.lighting.sunAngles[0],
    map.lighting.sunAngles[1],
    map.lighting.sunAngles[2],
  );
  app.root.addChild(sun);

  qualitySelect.addEventListener('change', () => {
    performanceManager.setPreset(qualitySelect.value as QualityPreset);
    graphicsPipeline.applyQuality(performanceManager.preset);
    if (sun.light) {
      sun.light.castShadows = performanceManager.shadowsEnabled;
      sun.light.shadowResolution = performanceManager.shadowResolution;
    }
  });

  const fill = new Entity(`${map.name} Fill Light`);
  fill.addComponent('light', {
    type: 'directional',
    color: color(map.lighting.fill),
    intensity: map.lighting.fillIntensity,
    castShadows: false,
  });
  fill.setEulerAngles(
    map.lighting.fillAngles[0],
    map.lighting.fillAngles[1],
    map.lighting.fillAngles[2],
  );
  app.root.addChild(fill);

  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const input = new InputController(canvas);
  sensitivitySlider.value = input.sensitivity.toFixed(2);
  sensitivitySlider.addEventListener('input', () => {
    input.setLookSensitivity(Number.parseFloat(sensitivitySlider.value));
  });

  const playerAvatar = new PlayerAvatar(app);
  const player = new FirstPersonController(world, camera, input, playerAvatar, {
    x: map.spawn[0],
    y: map.spawn[1],
    z: map.spawn[2],
  });

  app.start();
  const runtime = await buildSelectedMap(app, world, map, setMapStatus);
  const interactions = new MapInteractionSystem(map, runtime.doors);
  const mode = new ModeEngine(map);
  const characters = new CharacterSystem(app, map);
  const multiplayer = new MultiplayerClient(app, map.id);
  const audio = new AudioFeedback();

  restartRoundButton.addEventListener('click', () => {
    multiplayer.resetRound();
    window.setTimeout(() => window.location.reload(), 120);
  });

  const resize = (): void => {
    app.resizeCanvas();
  };
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener(
    'beforeunload',
    () => {
      multiplayer.dispose();
      input.dispose();
      graphicsPipeline.destroy();
    },
    { once: true },
  );

  app.on('update', (deltaSeconds: number) => {
    if (multiplayer.consumeRoundReset()) {
      mode.reset();
      interactions.reset();
      player.reset();
      setRoundResult('playing', '');
    }

    mode.completeObjectives(multiplayer.consumeRemoteObjectives());

    player.update(deltaSeconds);

    const position = player.position;
    if (!pointInsideMap(map, position)) {
      player.reset();
      return;
    }

    const interactPressed = input.consumeInteract();
    const interaction = interactions.update(position, interactPressed);
    if (interaction.handled && interactPressed) audio.cue('interact');

    const threat = characters.update(deltaSeconds, position, interaction.hidden);
    const modeState = mode.update(position, interactPressed && !interaction.handled, {
      deltaSeconds,
      hidden: interaction.hidden,
      threat,
      roundElapsedSeconds: multiplayer.roundElapsedSeconds,
    });

    if (modeState.completedObjectiveId) {
      multiplayer.submitObjective(modeState.completedObjectiveId);
    }

    if (modeState.event === 'objective') audio.cue('objective');
    if (modeState.event === 'won') audio.cue('win');
    if (modeState.event === 'lost') audio.cue('lose');
    if (threat.detected && threat.danger > 0.5) audio.cue('danger');

    player.setMovementLocked(interaction.hidden || modeState.outcome !== 'playing');
    setRoundResult(modeState.outcome, modeState.objective);

    const area = nearestAreaLabel(map, position);
    zoneValue.textContent = area.toUpperCase();

    const prompt = interaction.prompt ?? modeState.prompt;
    interactionPrompt.textContent = prompt ?? '';
    interactionPrompt.classList.toggle(
      'is-visible',
      Boolean(prompt) && modeState.outcome === 'playing',
    );

    hiddenState.textContent = interaction.hidden
      ? `HIDDEN · ${interaction.hiddenLabel?.toUpperCase() ?? 'COVER'}`
      : '';
    hiddenState.classList.toggle('is-visible', interaction.hidden);

    modeObjective.textContent = modeState.objective;
    modeProgress.textContent = modeState.progress;
    modeTimer.textContent = formatTimer(modeState.timerSeconds);
    modeDanger.textContent = `${Math.round(modeState.dangerPercent)}%`;
    modeOutcome.textContent =
      modeState.outcome === 'playing' ? modeState.status : modeState.outcome.toUpperCase();
    modePanel.classList.toggle('is-complete', modeState.outcome === 'won');
    modePanel.classList.toggle('is-lost', modeState.outcome === 'lost');
    motionValue.textContent = player.motionState.toUpperCase();
    staminaValue.textContent = `${Math.round(player.staminaPercent)}%`;
    viewValue.textContent = player.viewMode === 'first-person' ? 'FPS' : 'TPS';

    multiplayer.update(position, player.yaw, player.motionState, deltaSeconds);
    networkValue.textContent = multiplayer.status;
    roomValue.textContent = multiplayer.roomCode;
    roomCodeInput.value = multiplayer.roomCode;
    peersValue.textContent = multiplayer.peerCount.toString();

    const performance = performanceManager.update(deltaSeconds);
    fpsValue.textContent = performance.fps.toString();

    if (debugEnabled) {
      debugPosition.textContent = `POSITION ${position.x.toFixed(2)} · ${position.y.toFixed(2)} · ${position.z.toFixed(2)}`;
      debugZone.textContent = `AREA ${area.toUpperCase()}`;
      debugRole.textContent = `THREAT ${threat.role.toUpperCase()} · ${threat.distance.toFixed(1)}M`;
      debugMeta.textContent = `QA ${map.structures.length} ARCH · ${map.objectives.length} OBJ · ${map.navNodes.length} NAV · ${runtime.objectCount} RUNTIME · ${performance.quality.toUpperCase()} @ ${performance.pixelRatio.toFixed(2)}X`;
    }
  });

  const initialMode = mode.update(player.position, false, {
    deltaSeconds: 0,
    hidden: false,
    threat: {
      role: 'none',
      distance: Number.POSITIVE_INFINITY,
      detected: false,
      danger: 0,
      label: 'CLEAR',
    },
    roundElapsedSeconds: multiplayer.roundElapsedSeconds,
  });
  modeProgress.textContent = initialMode.progress;
  modeObjective.textContent = initialMode.objective;
  modeTimer.textContent = formatTimer(initialMode.timerSeconds);
  modeDanger.textContent = '0%';
  modeOutcome.textContent = 'CLEAR';
  setMapStatus(
    `${map.name} ready · ${map.mode.name} · ${characters.count} active role actors · adaptive ${coarse ? 'mobile' : 'desktop'} profile`,
  );
  bootOverlay.classList.add('is-hidden');
}

boot().catch((error: unknown) => {
  console.error('[Hideverse] boot failed:', error);
  const message = error instanceof Error ? error.message : String(error);
  setMapStatus(`Boot failed · ${message}`);
  bootOverlay.classList.remove('is-hidden');
  bootOverlay.textContent = `Hideverse failed to start: ${message}`;
});
