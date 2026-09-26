import RAPIER from '@dimforge/rapier3d-compat';
import { Application, Entity, Vec3 } from 'playcanvas';
import type { RenderComponent } from 'playcanvas';
import { loadContainer } from '../../core/load-container';

export type RavenwoodStatus = (message: string) => void;

const base = (): string => import.meta.env.BASE_URL;

function modelUrl(path: string): string {
  return `${base()}${path}`;
}

function collectBounds(root: Entity): {
  centerX: number;
  centerZ: number;
  minY: number;
  width: number;
  depth: number;
} {
  const renders = root.findComponents('render') as RenderComponent[];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const render of renders) {
    for (const instance of render.meshInstances) {
      const box = instance.aabb;
      minX = Math.min(minX, box.center.x - box.halfExtents.x);
      minY = Math.min(minY, box.center.y - box.halfExtents.y);
      minZ = Math.min(minZ, box.center.z - box.halfExtents.z);
      maxX = Math.max(maxX, box.center.x + box.halfExtents.x);
      maxZ = Math.max(maxZ, box.center.z + box.halfExtents.z);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    throw new Error('Ravenwood model has no renderable bounds.');
  }

  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    minY,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

function fitMansion(root: Entity): number {
  const bounds = collectBounds(root);
  const targetFootprint = 66;
  const scale = targetFootprint / Math.max(bounds.width, bounds.depth);
  root.setLocalScale(scale, scale, scale);
  root.setPosition(-bounds.centerX * scale, -bounds.minY * scale, -bounds.centerZ * scale);
  return scale;
}

function buildStaticTrimesh(world: RAPIER.World, root: Entity, onStatus: RavenwoodStatus): void {
  const renders = root.findComponents('render') as RenderComponent[];
  const vertices: number[] = [];
  const indices: number[] = [];
  const source = new Vec3();
  const target = new Vec3();

  for (const render of renders) {
    for (const instance of render.meshInstances) {
      const positions: number[] = [];
      const localIndices: number[] = [];
      instance.mesh.getPositions(positions);
      instance.mesh.getIndices(localIndices);

      const vertexOffset = vertices.length / 3;
      const transform = instance.node.getWorldTransform();

      for (let i = 0; i < positions.length; i += 3) {
        source.set(positions[i] ?? 0, positions[i + 1] ?? 0, positions[i + 2] ?? 0);
        transform.transformPoint(source, target);
        vertices.push(target.x, target.y, target.z);
      }

      if (localIndices.length) {
        for (const index of localIndices) {
          indices.push(vertexOffset + index);
        }
      } else {
        const count = positions.length / 3;
        for (let i = 0; i < count; i += 1) {
          indices.push(vertexOffset + i);
        }
      }
    }
  }

  if (vertices.length === 0 || indices.length < 3) {
    throw new Error('Ravenwood collision extraction produced no triangles.');
  }

  const collider = RAPIER.ColliderDesc.trimesh(
    new Float32Array(vertices),
    new Uint32Array(indices),
  ).setFriction(0.85);
  world.createCollider(collider);
  onStatus(
    `Mansion collision ready · ${Math.floor(indices.length / 3).toLocaleString()} triangles`,
  );
}

async function loadInstances(
  app: Application,
  url: string,
  placements: Array<{ x: number; y: number; z: number; scale?: number; yaw?: number }>,
): Promise<void> {
  const asset = await loadContainer(app, modelUrl(url));
  for (const placement of placements) {
    const entity = asset.resource.instantiateRenderEntity({
      castShadows: true,
      receiveShadows: true,
    });
    const scale = placement.scale ?? 1;
    entity.setLocalScale(scale, scale, scale);
    entity.setPosition(placement.x, placement.y, placement.z);
    entity.setEulerAngles(0, placement.yaw ?? 0, 0);
    app.root.addChild(entity);
  }
}

async function loadExteriorDressing(app: Application): Promise<void> {
  const tasks = [
    loadInstances(app, 'ravenwood/nature/kenney/tree_oak.glb', [
      { x: -38, y: 0, z: 28, scale: 2.2 },
      { x: 39, y: 0, z: 24, scale: 2.4, yaw: 70 },
      { x: -42, y: 0, z: -18, scale: 2.1, yaw: 120 },
      { x: 42, y: 0, z: -22, scale: 2.35, yaw: 210 },
    ]),
    loadInstances(app, 'ravenwood/nature/kenney/tree_pineDefaultA.glb', [
      { x: -48, y: 0, z: 4, scale: 2.4 },
      { x: 48, y: 0, z: 8, scale: 2.2 },
    ]),
    loadInstances(app, 'ravenwood/nature/kenney/rock_largeA.glb', [
      { x: -26, y: 0, z: 34, scale: 1.8, yaw: 24 },
      { x: 27, y: 0, z: 35, scale: 1.4, yaw: 130 },
    ]),
    loadInstances(app, 'ravenwood/exterior/kaykit-city/bench.gltf', [
      { x: -10, y: 0, z: 33, scale: 1.1, yaw: 180 },
      { x: 10, y: 0, z: 33, scale: 1.1, yaw: 180 },
    ]),
    loadInstances(app, 'ravenwood/exterior/kaykit-city/streetlight.gltf', [
      { x: -7, y: 0, z: 42, scale: 1.2 },
      { x: 7, y: 0, z: 42, scale: 1.2 },
      { x: -7, y: 0, z: 28, scale: 1.2 },
      { x: 7, y: 0, z: 28, scale: 1.2 },
    ]),
  ];

  await Promise.allSettled(tasks);
}

export async function buildRavenwood(
  app: Application,
  world: RAPIER.World,
  onStatus: RavenwoodStatus,
): Promise<void> {
  onStatus('Loading Ravenwood environment…');

  const ground = new Entity('Ravenwood Ground');
  ground.addComponent('render', { type: 'box' });
  ground.setLocalScale(120, 0.2, 120);
  ground.setPosition(0, -0.1, 0);
  app.root.addChild(ground);

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.1, 60).setTranslation(0, -0.1, 0).setFriction(0.9),
  );

  const wallThickness = 0.5;
  const wallHeight = 6;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, wallHeight, wallThickness).setTranslation(0, wallHeight, -60),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, wallHeight, wallThickness).setTranslation(0, wallHeight, 60),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(wallThickness, wallHeight, 60).setTranslation(-60, wallHeight, 0),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(wallThickness, wallHeight, 60).setTranslation(60, wallHeight, 0),
  );

  void loadExteriorDressing(app);

  try {
    const asset = await loadContainer(
      app,
      modelUrl('ravenwood/map/ravenwood_mansion_victorian.glb'),
    );
    const mansion = asset.resource.instantiateRenderEntity({
      castShadows: true,
      receiveShadows: true,
    });
    mansion.name = 'Ravenwood Victorian Mansion';
    app.root.addChild(mansion);

    const scale = fitMansion(mansion);
    onStatus(`Mansion visual ready · normalized scale ${scale.toFixed(3)}`);

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    buildStaticTrimesh(world, mansion, onStatus);
  } catch (error) {
    console.warn('[Ravenwood] Mansion asset unavailable, using environment staging area.', error);
    onStatus('Mansion asset is still being vendored · exterior staging mode');
  }
}
