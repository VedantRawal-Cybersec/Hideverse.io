import {
  Application,
  Color,
  Entity,
  FILLMODE_FILL_WINDOW,
  RESOLUTION_AUTO,
} from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { EntityManager } from 'yuka';
import { InputController } from './core/input-controller';
import { FirstPersonController } from './core/player-controller';
import { buildRavenwood } from './maps/ravenwood/ravenwood';
import './styles.css';

const canvasQuery = document.querySelector<HTMLCanvasElement>('#game-canvas');
const mapStatusQuery = document.querySelector<HTMLSpanElement>('#map-status');
const fpsValueQuery = document.querySelector<HTMLSpanElement>('#fps-value');
const bootOverlayQuery = document.querySelector<HTMLDivElement>('#boot-overlay');

if (!canvasQuery || !mapStatusQuery || !fpsValueQuery || !bootOverlayQuery) {
  throw new Error('Hideverse Ravenwood DOM is incomplete.');
}

const canvas = canvasQuery;
const mapStatus = mapStatusQuery;
const fpsValue = fpsValueQuery;
const bootOverlay = bootOverlayQuery;

function setMapStatus(message: string): void {
  mapStatus.textContent = message;
}

async function boot(): Promise<void> {
  const app = new Application(canvas);
  app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(RESOLUTION_AUTO);
  app.scene.ambientLight = new Color(0.22, 0.24, 0.29);

  const camera = new Entity('Player Camera');
  camera.addComponent('camera', {
    clearColor: new Color(0.035, 0.045, 0.065),
    nearClip: 0.08,
    farClip: 240,
    fov: 72,
  });
  app.root.addChild(camera);

  const sun = new Entity('Ravenwood Moonlight');
  sun.addComponent('light', {
    type: 'directional',
    color: new Color(0.82, 0.88, 1),
    intensity: 1.35,
    castShadows: true,
    shadowResolution: 2048,
    shadowDistance: 90,
  });
  sun.setEulerAngles(48, 32, 0);
  app.root.addChild(sun);

  const fill = new Entity('Ravenwood Warm Fill');
  fill.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.74, 0.52),
    intensity: 0.28,
    castShadows: false,
  });
  fill.setEulerAngles(22, -120, 0);
  app.root.addChild(fill);

  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const input = new InputController(canvas);
  const player = new FirstPersonController(world, camera, input);
  const aiManager = new EntityManager();

  const mapPromise = buildRavenwood(app, world, setMapStatus);

  let fpsAccumulator = 0;
  let fpsFrames = 0;

  app.on('update', (deltaSeconds: number) => {
    player.update(deltaSeconds);
    aiManager.update(deltaSeconds);

    fpsAccumulator += deltaSeconds;
    fpsFrames += 1;
    if (fpsAccumulator >= 0.5) {
      fpsValue.textContent = Math.round(fpsFrames / fpsAccumulator).toString();
      fpsAccumulator = 0;
      fpsFrames = 0;
    }
  });

  const resize = (): void => {
    app.resizeCanvas();
  };
  window.addEventListener('resize', resize, { passive: true });

  app.start();
  bootOverlay.classList.add('is-hidden');

  await mapPromise;
}

boot().catch((error: unknown) => {
  console.error('[Hideverse] Ravenwood boot failed:', error);
  const message = error instanceof Error ? error.message : String(error);
  setMapStatus(`Boot failed · ${message}`);
  bootOverlay.classList.remove('is-hidden');
  bootOverlay.textContent = `Ravenwood failed to start: ${message}`;
});
