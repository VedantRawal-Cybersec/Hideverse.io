import RAPIER from '@dimforge/rapier3d-compat';
import { Application, Entity, Vec3 } from 'playcanvas';
import type { RenderComponent } from 'playcanvas';
import { loadContainer } from '../../core/load-container';
import { createReferenceMaterial, mapWallTone } from '../../core/reference-art-direction';
import interiorLayout from './interior-layout.json';

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

async function buildStaticTrimesh(
  world: RAPIER.World,
  root: Entity,
  onStatus: RavenwoodStatus,
): Promise<void> {
  const renders = root.findComponents('render') as RenderComponent[];
  const vertices: number[] = [];
  const indices: number[] = [];
  const source = new Vec3();
  const target = new Vec3();
  let processedInstances = 0;

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

      processedInstances += 1;
      if (processedInstances % 4 === 0) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
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
  const coarse = matchMedia('(pointer: coarse)').matches;
  for (const placement of placements) {
    const entity = asset.resource.instantiateRenderEntity({
      castShadows: !coarse,
      receiveShadows: true,
    });
    const scale = placement.scale ?? 1;
    entity.setLocalScale(scale, scale, scale);
    entity.setPosition(placement.x, placement.y, placement.z);
    entity.setEulerAngles(0, placement.yaw ?? 0, 0);
    app.root.addChild(entity);
  }
}

type InteriorPlacement = {
  id: string;
  asset: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  collider: { x: number; y: number; z: number };
};

async function loadInteriorDressing(app: Application, world: RAPIER.World): Promise<void> {
  const grouped = new Map<string, InteriorPlacement[]>();
  const coarse = matchMedia('(pointer: coarse)').matches;
  const placements = interiorLayout.placements as InteriorPlacement[];

  for (const [index, placement] of placements.entries()) {
    if (!coarse || index % 2 === 0) {
      const list = grouped.get(placement.asset) ?? [];
      list.push(placement);
      grouped.set(placement.asset, list);
    }

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(
        placement.x,
        placement.y + placement.collider.y,
        placement.z,
      ),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        placement.collider.x,
        placement.collider.y,
        placement.collider.z,
      ).setFriction(0.8),
      body,
    );
  }

  const tasks = [...grouped.entries()].map(([asset, groupedPlacements]) =>
    loadInstances(
      app,
      asset,
      groupedPlacements.map((placement) => ({
        x: placement.x,
        y: placement.y,
        z: placement.z,
        yaw: placement.yaw,
        scale: placement.scale,
      })),
    ),
  );

  await Promise.allSettled(tasks);
}

async function loadExteriorDressing(app: Application): Promise<void> {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const tasks = coarse
    ? [
        loadInstances(app, 'ravenwood/nature/kenney/tree_oak.glb', [
          { x: -38, y: 0, z: 28, scale: 2.2 },
          { x: 39, y: 0, z: 24, scale: 2.4, yaw: 70 },
        ]),
        loadInstances(app, 'ravenwood/nature/kenney/rock_largeA.glb', [
          { x: -26, y: 0, z: 34, scale: 1.8, yaw: 24 },
        ]),
        loadInstances(app, 'ravenwood/exterior/kaykit-city/streetlight.gltf', [
          { x: -7, y: 0, z: 42, scale: 1.2 },
          { x: 7, y: 0, z: 42, scale: 1.2 },
        ]),
      ]
    : [
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

function applyReferenceMansionMaterials(root: Entity): void {
  const wall = createReferenceMaterial('wall', mapWallTone(1));
  const trim = createReferenceMaterial('trim');
  const metal = createReferenceMaterial('metal');
  const wood = createReferenceMaterial('wood');

  const renders = root.findComponents('render') as RenderComponent[];
  for (const render of renders) {
    for (const instance of render.meshInstances) {
      const name = instance.node.name.toLowerCase();
      if (/window|glass|metal|rail|pipe/.test(name)) {
        instance.material = metal;
      } else if (/roof|trim|frame|column|border/.test(name)) {
        instance.material = trim;
      } else if (/door|wood|floor/.test(name)) {
        instance.material = wood;
      } else {
        instance.material = wall;
      }
    }
  }
}

async function streamMansionDetail(
  app: Application,
  world: RAPIER.World,
  onStatus: RavenwoodStatus,
  fallbackShell: Entity[],
): Promise<void> {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const quality = localStorage.getItem('hideverse-quality') ?? 'auto';

  if (coarse && quality !== 'high') {
    onStatus('Ravenwood reference shell active · mobile optimized');
    return;
  }

  await new Promise<void>((resolve) => window.setTimeout(resolve, coarse ? 4200 : 2400));

  try {
    const asset = await loadContainer(
      app,
      modelUrl('ravenwood/map/ravenwood_mansion_victorian.glb'),
    );
    const mansion = asset.resource.instantiateRenderEntity({
      castShadows: !matchMedia('(pointer: coarse)').matches,
      receiveShadows: true,
    });
    mansion.name = 'Ravenwood Victorian Mansion';
    app.root.addChild(mansion);
    applyReferenceMansionMaterials(mansion);

    const scale = fitMansion(mansion);
    for (const entity of fallbackShell) entity.destroy();

    if (quality !== 'high') {
      onStatus(
        `Ravenwood visual streamed · scale ${scale.toFixed(3)} · optimized collision shell active`,
      );
      return;
    }

    onStatus(
      `Ravenwood visual streamed · scale ${scale.toFixed(3)} · refining high-detail collision…`,
    );
    await new Promise<void>((resolve) => window.setTimeout(resolve, 1800));
    await buildStaticTrimesh(world, mansion, onStatus);
    onStatus('Ravenwood Mansion fully streamed · high-detail collision active');
  } catch (error) {
    console.warn('[Ravenwood] Mansion detail unavailable, keeping playable fallback shell.', error);
    onStatus('Ravenwood playable fallback active · mansion detail unavailable');
  }
}

function buildPlayableMansionShell(app: Application, world: RAPIER.World): Entity[] {
  const shell: Entity[] = [];
  const wallMaterial = createReferenceMaterial('wall', mapWallTone(1));
  const trimMaterial = createReferenceMaterial('trim');
  const floorMaterial = createReferenceMaterial('floor');

  const createPart = (
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    material = wallMaterial,
  ): void => {
    const entity = new Entity(name);
    entity.addComponent('render', { type: 'box' });
    entity.setLocalScale(size[0], size[1], size[2]);
    entity.setPosition(position[0], position[1], position[2]);
    if (entity.render) entity.render.material = material;
    app.root.addChild(entity);
    shell.push(entity);
  };

  const createWallCollider = (
    halfX: number,
    halfY: number,
    halfZ: number,
    x: number,
    y: number,
    z: number,
  ): void => {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ).setTranslation(x, y, z).setFriction(0.85),
    );
  };

  createPart('ravenwood-shell-west', [0.7, 6.2, 22], [-12, 3.1, 2]);
  createPart('ravenwood-shell-east', [0.7, 6.2, 22], [12, 3.1, 2]);
  createPart('ravenwood-shell-back', [24, 6.2, 0.7], [0, 3.1, -9]);
  createPart('ravenwood-shell-front-left', [10.5, 6.2, 0.7], [-6.75, 3.1, 13]);
  createPart('ravenwood-shell-front-right', [10.5, 6.2, 0.7], [6.75, 3.1, 13]);
  createPart('ravenwood-shell-roof', [24.8, 0.34, 22.8], [0, 6.35, 2], trimMaterial);
  createPart('ravenwood-shell-porch', [13, 0.24, 5], [0, 0.12, 15], floorMaterial);
  createPart('ravenwood-shell-foundation', [24.4, 0.35, 22.4], [0, 0.18, 2], trimMaterial);

  createWallCollider(0.35, 3.1, 11, -12, 3.1, 2);
  createWallCollider(0.35, 3.1, 11, 12, 3.1, 2);
  createWallCollider(12, 3.1, 0.35, 0, 3.1, -9);
  createWallCollider(5.25, 3.1, 0.35, -6.75, 3.1, 13);
  createWallCollider(5.25, 3.1, 0.35, 6.75, 3.1, 13);

  return shell;
}

export async function buildRavenwood(
  app: Application,
  world: RAPIER.World,
  onStatus: RavenwoodStatus,
): Promise<void> {
  onStatus('Preparing Ravenwood playable shell…');

  const ground = new Entity('Ravenwood Ground');
  ground.addComponent('render', { type: 'box' });
  ground.setLocalScale(120, 0.2, 120);
  ground.setPosition(0, -0.1, 0);
  if (ground.render) ground.render.material = createReferenceMaterial('floor');
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

  const fallbackShell = buildPlayableMansionShell(app, world);

  // None of the decorative/detail work below blocks entering the game.
  window.setTimeout(() => {
    void loadExteriorDressing(app);
  }, 1800);
  window.setTimeout(() => {
    void loadInteriorDressing(app, world);
  }, 2600);
  void streamMansionDetail(app, world, onStatus, fallbackShell);

  onStatus('Ravenwood playable · mansion detail streaming in background');
}
