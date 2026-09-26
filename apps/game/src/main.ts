import {
  Application,
  Color,
  Entity,
  FILLMODE_FILL_WINDOW,
  RESOLUTION_AUTO,
} from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { EntityManager, GameEntity } from 'yuka';
import './styles.css';

type StatusState = 'ok' | 'error';

const statusListQuery = document.querySelector<HTMLDivElement>('#status-list');
const bootMessageQuery = document.querySelector<HTMLParagraphElement>('#boot-message');
const canvasQuery = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!statusListQuery || !bootMessageQuery || !canvasQuery) {
  throw new Error('Hideverse foundation DOM is incomplete.');
}

const statusList = statusListQuery;
const bootMessage = bootMessageQuery;
const canvas = canvasQuery;

function setStatus(label: string, value: string, state: StatusState = 'ok'): void {
  const row = document.createElement('div');
  row.className = 'status-row';

  const key = document.createElement('span');
  key.textContent = label;

  const result = document.createElement('span');
  result.className = `status-value ${state}`;
  result.textContent = value;

  row.append(key, result);
  statusList.append(row);
}

async function boot(): Promise<void> {
  const app = new Application(canvas);
  app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(RESOLUTION_AUTO);
  app.scene.ambientLight = new Color(0.16, 0.18, 0.22);

  const camera = new Entity('Foundation Camera');
  camera.addComponent('camera', {
    clearColor: new Color(0.025, 0.035, 0.055),
    farClip: 100,
    nearClip: 0.1,
  });
  camera.setPosition(0, 2.7, 8);
  camera.lookAt(0, 1.25, 0);
  app.root.addChild(camera);

  const light = new Entity('Foundation Sun');
  light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.92, 0.8),
    intensity: 1.35,
    castShadows: true,
    shadowResolution: 1024,
  });
  light.setEulerAngles(45, 35, 0);
  app.root.addChild(light);

  const ground = new Entity('Foundation Ground');
  ground.addComponent('render', { type: 'box' });
  ground.setLocalScale(16, 0.4, 16);
  ground.setPosition(0, -0.2, 0);
  app.root.addChild(ground);

  const physicsCube = new Entity('Rapier Physics Cube');
  physicsCube.addComponent('render', { type: 'box' });
  app.root.addChild(physicsCube);

  setStatus('PlayCanvas', 'READY');

  await RAPIER.init();
  const physicsWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const groundBody = physicsWorld.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.2, 0),
  );
  physicsWorld.createCollider(RAPIER.ColliderDesc.cuboid(8, 0.2, 8), groundBody);

  const cubeBody = physicsWorld.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 4, 0),
  );
  physicsWorld.createCollider(
    RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setRestitution(0.35),
    cubeBody,
  );
  setStatus('Rapier 3D', 'READY');

  const aiManager = new EntityManager();
  const aiProbe = new GameEntity();
  aiProbe.name = 'Foundation AI Probe';
  aiProbe.position.set(0, 0, 0);
  aiManager.add(aiProbe);
  setStatus('Yuka AI', 'READY');

  app.on('update', (deltaSeconds: number) => {
    physicsWorld.timestep = Math.min(deltaSeconds, 1 / 30);
    physicsWorld.step();

    const position = cubeBody.translation();
    const rotation = cubeBody.rotation();
    physicsCube.setPosition(position.x, position.y, position.z);
    physicsCube.setRotation(rotation.x, rotation.y, rotation.z, rotation.w);

    aiManager.update(deltaSeconds);
  });

  const resize = (): void => {
    app.resizeCanvas();
  };
  window.addEventListener('resize', resize, { passive: true });

  app.start();
  setStatus('TypeScript/Vite', 'READY');
  bootMessage.textContent =
    'Foundation booted: renderer, physics and AI are running together. Map and character systems can now be built on this base.';
}

boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[Hideverse] Foundation boot failed:', error);
  setStatus('Foundation', 'FAILED', 'error');
  bootMessage.textContent = `Boot failed: ${message}`;
});
