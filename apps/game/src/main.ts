import RAPIER from '@dimforge/rapier3d-compat';
import { Application, Color, Entity, FILLMODE_FILL_WINDOW, RESOLUTION_AUTO } from 'playcanvas';
import { CharacterSystem } from './core/character-system';
import { InputController } from './core/input-controller';
import { ModeEngine } from './core/mode-engine';
import { MultiplayerClient } from './core/multiplayer-client';
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
const motionValue = must<HTMLElement>('#motion-value');
const staminaValue = must<HTMLElement>('#stamina-value');
const networkValue = must<HTMLElement>('#network-value');
const roomValue = must<HTMLElement>('#room-value');
const peersValue = must<HTMLElement>('#peers-value');

const map = selectedMapFromLocation();
const debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';
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

async function boot(): Promise<void> {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const app = new Application(canvas);
  app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(RESOLUTION_AUTO);
  app.scene.ambientLight = color(map.lighting.ambient);

  const camera = new Entity('Player Camera');
  camera.addComponent('camera', {
    clearColor: color(map.lighting.clear),
    nearClip: 0.08,
    farClip: 260,
    fov: coarse ? 76 : 72,
  });
  app.root.addChild(camera);

  const sun = new Entity(`${map.name} Key Light`);
  sun.addComponent('light', {
    type: 'directional',
    color: color(map.lighting.sun),
    intensity: map.lighting.sunIntensity,
    castShadows: !coarse,
    shadowResolution: coarse ? 1024 : 2048,
    shadowDistance: map.lod.shadowDistance,
  });
  sun.setEulerAngles(
    map.lighting.sunAngles[0],
    map.lighting.sunAngles[1],
    map.lighting.sunAngles[2],
  );
  app.root.addChild(sun);

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
  const player = new FirstPersonController(world, camera, input, {
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

  let fpsAccumulator = 0;
  let fpsFrames = 0;

  const resize = (): void => {
    app.resizeCanvas();
  };
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('beforeunload', () => multiplayer.dispose(), { once: true });

  app.on('update', (deltaSeconds: number) => {
    player.update(deltaSeconds);

    const position = player.position;
    if (!pointInsideMap(map, position)) {
      player.reset();
      return;
    }

    const interactPressed = input.consumeInteract();
    const interaction = interactions.update(position, interactPressed);
    const modeState = mode.update(position, interactPressed && !interaction.handled);

    player.setMovementLocked(interaction.hidden);

    const area = nearestAreaLabel(map, position);
    zoneValue.textContent = area.toUpperCase();

    const prompt = interaction.prompt ?? modeState.prompt;
    interactionPrompt.textContent = prompt ?? '';
    interactionPrompt.classList.toggle('is-visible', Boolean(prompt));

    hiddenState.textContent = interaction.hidden
      ? `HIDDEN · ${interaction.hiddenLabel?.toUpperCase() ?? 'COVER'}`
      : '';
    hiddenState.classList.toggle('is-visible', interaction.hidden);

    modeObjective.textContent = modeState.objective;
    modeProgress.textContent = modeState.progress;
    modePanel.classList.toggle('is-complete', modeState.complete);
    motionValue.textContent = player.motionState.toUpperCase();
    staminaValue.textContent = `${Math.round(player.staminaPercent)}%`;

    characters.update(deltaSeconds);
    multiplayer.update(position, player.yaw, player.motionState);
    networkValue.textContent = multiplayer.status;
    roomValue.textContent = multiplayer.roomCode;
    peersValue.textContent = multiplayer.peerCount.toString();

    if (debugEnabled) {
      debugPosition.textContent = `POSITION ${position.x.toFixed(2)} · ${position.y.toFixed(2)} · ${position.z.toFixed(2)}`;
      debugZone.textContent = `AREA ${area.toUpperCase()}`;
      debugRole.textContent = `NEAREST ROLE ${characters.nearestRole(position)}`;
      debugMeta.textContent = `MAP QA ${map.structures.length} ARCH · ${map.doors.length} DOORS · ${map.objectives.length} OBJECTIVES · ${map.navNodes.length} NAV · ${runtime.objectCount} RUNTIME`;
    }

    fpsAccumulator += deltaSeconds;
    fpsFrames += 1;
    if (fpsAccumulator >= 0.5) {
      fpsValue.textContent = Math.round(fpsFrames / fpsAccumulator).toString();
      fpsAccumulator = 0;
      fpsFrames = 0;
    }
  });

  const initialMode = mode.update(player.position, false);
  modeProgress.textContent = initialMode.progress;
  modeObjective.textContent = initialMode.objective;
  setMapStatus(
    `${map.name} ready · ${map.mode.name} · ${characters.count} active role actors · ${map.navNodes.length} nav nodes`,
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
