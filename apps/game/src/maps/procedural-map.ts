import RAPIER from '@dimforge/rapier3d-compat';
import { ADDRESS_REPEAT, Application, Color, Entity, StandardMaterial } from 'playcanvas';
import type { Texture } from 'playcanvas';
import { loadContainer } from '../core/load-container';
import type { DoorDefinition, MapBox, MapDefinition, Triplet } from './map-catalog';
import { buildRavenwood } from './ravenwood/ravenwood';

export type DoorRuntime = {
  definition: DoorDefinition;
  entity: Entity;
  open: boolean;
  toggle: () => void;
};

export type MapRuntime = {
  doors: DoorRuntime[];
  objectCount: number;
};

type Palette = {
  architecture: Triplet;
  prop: Triplet;
  accent: Triplet;
  ground: Triplet;
};

type DressingAsset = {
  asset: string;
  scale: number;
};

const dressingAssets: Record<string, DressingAsset[]> = {
  nexus: [
    { asset: 'ravenwood/exterior/kaykit-city/bench.gltf', scale: 1 },
    { asset: 'ravenwood/furniture/kaykit/couch.gltf', scale: 0.95 },
    { asset: 'ravenwood/furniture/kaykit/table_medium_long.gltf', scale: 0.9 },
    { asset: 'ravenwood/furniture/kaykit/chair_A.gltf', scale: 0.95 },
  ],
  museum: [
    { asset: 'ravenwood/architecture/kaykit-dungeon/wall_arched.gltf.glb', scale: 1 },
    { asset: 'ravenwood/furniture/kaykit/shelf_B_large_decorated.gltf', scale: 0.9 },
    { asset: 'ravenwood/architecture/kaykit-dungeon/barrel_large.gltf.glb', scale: 0.85 },
    { asset: 'ravenwood/architecture/kaykit-dungeon/crates_stacked.gltf.glb', scale: 0.9 },
  ],
  hospital: [
    { asset: 'ravenwood/furniture/kaykit/bed_double_A.gltf', scale: 0.82 },
    { asset: 'ravenwood/furniture/kaykit/shelf_B_large_decorated.gltf', scale: 0.82 },
    { asset: 'ravenwood/furniture/kaykit/table_medium_long.gltf', scale: 0.82 },
    { asset: 'ravenwood/furniture/kaykit/chair_A.gltf', scale: 0.9 },
  ],
  hotel: [
    { asset: 'ravenwood/furniture/kaykit/bed_double_A.gltf', scale: 0.9 },
    { asset: 'ravenwood/furniture/kaykit/couch.gltf', scale: 0.95 },
    { asset: 'ravenwood/furniture/kaykit/lamp_standing.gltf', scale: 0.92 },
    { asset: 'ravenwood/furniture/kaykit/chair_A.gltf', scale: 0.95 },
  ],
  axiom: [
    { asset: 'ravenwood/furniture/kaykit/shelf_B_large_decorated.gltf', scale: 0.85 },
    { asset: 'ravenwood/architecture/kaykit-dungeon/crates_stacked.gltf.glb', scale: 0.8 },
    { asset: 'ravenwood/furniture/kaykit/table_medium_long.gltf', scale: 0.85 },
    { asset: 'ravenwood/architecture/kaykit-dungeon/wall_arched.gltf.glb', scale: 0.95 },
  ],
};

const palettes: Palette[] = [
  {
    architecture: [0.2, 0.22, 0.27],
    prop: [0.34, 0.3, 0.26],
    accent: [0.65, 0.72, 0.82],
    ground: [0.08, 0.1, 0.12],
  },
  {
    architecture: [0.27, 0.29, 0.33],
    prop: [0.22, 0.38, 0.52],
    accent: [0.92, 0.68, 0.25],
    ground: [0.12, 0.13, 0.15],
  },
  {
    architecture: [0.3, 0.27, 0.22],
    prop: [0.44, 0.34, 0.22],
    accent: [0.82, 0.67, 0.36],
    ground: [0.1, 0.085, 0.07],
  },
  {
    architecture: [0.18, 0.24, 0.23],
    prop: [0.26, 0.36, 0.32],
    accent: [0.35, 0.82, 0.64],
    ground: [0.055, 0.08, 0.075],
  },
  {
    architecture: [0.28, 0.22, 0.31],
    prop: [0.46, 0.26, 0.28],
    accent: [0.86, 0.48, 0.32],
    ground: [0.09, 0.065, 0.1],
  },
  {
    architecture: [0.18, 0.24, 0.34],
    prop: [0.26, 0.38, 0.52],
    accent: [0.52, 0.58, 0.96],
    ground: [0.055, 0.075, 0.11],
  },
];

function material(color: Triplet, gloss = 0.35, metalness = 0.05): StandardMaterial {
  const result = new StandardMaterial();
  result.diffuse = new Color(color[0], color[1], color[2]);
  result.useMetalness = true;
  result.metalness = metalness;
  result.gloss = gloss;
  result.update();
  return result;
}

function loadTexture(app: Application, path: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(`${import.meta.env.BASE_URL}${path}`, 'texture', (error, asset) => {
      if (error || !asset?.resource) {
        reject(new Error(typeof error === 'string' ? error : `Unable to load ${path}`));
        return;
      }
      resolve(asset.resource as Texture);
    });
  });
}

function applyTexture(
  target: StandardMaterial,
  texture: Texture,
  tiling: number,
  gloss: number,
  metalness = 0.02,
): void {
  texture.addressU = ADDRESS_REPEAT;
  texture.addressV = ADDRESS_REPEAT;
  target.diffuseMap = texture;
  target.diffuseMapTiling.set(tiling, tiling);
  target.gloss = gloss;
  target.metalness = metalness;
  target.update();
}

async function applySurfaceTextures(
  app: Application,
  map: MapDefinition,
  architecture: StandardMaterial,
  prop: StandardMaterial,
  ground: StandardMaterial,
): Promise<void> {
  try {
    const [concrete, walnut, tiles] = await Promise.all([
      loadTexture(app, 'materials/cc0/concrete.png'),
      loadTexture(app, 'materials/cc0/walnut.png'),
      loadTexture(app, 'materials/cc0/tiles.png'),
    ]);

    const architectureTexture =
      map.id === 'nexus' || map.id === 'hospital' ? tiles : concrete;
    const propTexture =
      map.id === 'hotel' || map.id === 'museum' ? walnut : map.id === 'hospital' ? tiles : concrete;
    const groundTexture =
      map.id === 'hotel' ? walnut : map.id === 'nexus' || map.id === 'hospital' ? tiles : concrete;

    applyTexture(architecture, architectureTexture, 3.5, map.id === 'hospital' ? 0.28 : 0.38);
    applyTexture(prop, propTexture, 2.5, map.id === 'hotel' ? 0.48 : 0.34);
    applyTexture(ground, groundTexture, 8, map.id === 'nexus' ? 0.52 : 0.3);
  } catch (error) {
    console.warn('[Hideverse materials] CC0 surface textures unavailable; retaining PBR colors.', error);
  }
}

function createVisualBox(app: Application, item: MapBox, boxMaterial: StandardMaterial): Entity {
  const entity = new Entity(item.id);
  entity.addComponent('render', { type: 'box' });
  entity.setLocalScale(item.size[0], item.size[1], item.size[2]);
  entity.setPosition(item.position[0], item.position[1], item.position[2]);
  if (entity.render) {
    entity.render.material = boxMaterial;
  }
  app.root.addChild(entity);
  return entity;
}

function createStaticCollider(world: RAPIER.World, item: MapBox): void {
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(item.size[0] / 2, item.size[1] / 2, item.size[2] / 2)
      .setTranslation(item.position[0], item.position[1], item.position[2])
      .setFriction(0.82),
  );
}

function createDoor(
  app: Application,
  world: RAPIER.World,
  definition: DoorDefinition,
  doorMaterial: StandardMaterial,
): DoorRuntime {
  const entity = createVisualBox(
    app,
    { id: definition.id, position: definition.position, size: definition.size },
    doorMaterial,
  );

  const body = definition.blocking
    ? world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          definition.position[0],
          definition.position[1],
          definition.position[2],
        ),
      )
    : null;

  if (body) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        definition.size[0] / 2,
        definition.size[1] / 2,
        definition.size[2] / 2,
      ).setFriction(0.7),
      body,
    );
  }

  const runtime: DoorRuntime = {
    definition,
    entity,
    open: false,
    toggle: () => {
      runtime.open = !runtime.open;
      const angle = runtime.open ? 90 : 0;
      entity.setEulerAngles(0, angle, 0);

      if (body) {
        const halfAngle = (angle * Math.PI) / 360;
        body.setNextKinematicRotation({
          x: 0,
          y: Math.sin(halfAngle),
          z: 0,
          w: Math.cos(halfAngle),
        });
      }
    },
  };

  return runtime;
}

function createGround(
  app: Application,
  world: RAPIER.World,
  map: MapDefinition,
  groundMaterial: StandardMaterial,
): void {
  const [minX, minY, minZ] = map.worldBounds.min;
  const [maxX, , maxZ] = map.worldBounds.max;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const groundY = Math.max(-0.1, minY + 3.9);

  const ground: MapBox = {
    id: `${map.id}-ground`,
    position: [centerX, groundY, centerZ],
    size: [width, 0.2, depth],
  };

  createVisualBox(app, ground, groundMaterial);
  createStaticCollider(world, ground);
}

async function loadProgressiveDressing(app: Application, map: MapDefinition): Promise<void> {
  const specs = dressingAssets[map.id] ?? [];
  if (specs.length === 0 || map.navNodes.length === 0) return;

  const coarse = matchMedia('(pointer: coarse)').matches;
  const instanceLimit = coarse ? Math.min(3, specs.length) : Math.min(8, specs.length * 2);
  const assets = new Map<string, ReturnType<typeof loadContainer>>();

  const getAsset = (asset: string): ReturnType<typeof loadContainer> => {
    const existing = assets.get(asset);
    if (existing) return existing;
    const loading = loadContainer(app, `${import.meta.env.BASE_URL}${asset}`);
    assets.set(asset, loading);
    return loading;
  };

  const tasks = Array.from({ length: instanceLimit }, async (_, index) => {
    const spec = specs[index % specs.length]!;
    const anchor = map.navNodes[(index * 2 + 1) % map.navNodes.length]!;
    const asset = await getAsset(spec.asset);
    const entity = asset.resource.instantiateRenderEntity({
      castShadows: !coarse,
      receiveShadows: true,
    });
    entity.name = `${map.id}-dressing-${index}`;
    entity.setLocalScale(spec.scale, spec.scale, spec.scale);
    entity.setPosition(
      anchor.position[0] + (index % 2 === 0 ? 1.35 : -1.35),
      anchor.position[1] - 0.05,
      anchor.position[2] + ((index % 3) - 1) * 1.1,
    );
    entity.setEulerAngles(0, (index * 67) % 360, 0);
    app.root.addChild(entity);
  });

  await Promise.allSettled(tasks);
}

async function buildProceduralMap(
  app: Application,
  world: RAPIER.World,
  map: MapDefinition,
  onStatus: (message: string) => void,
): Promise<MapRuntime> {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const palette = palettes[Math.max(0, Math.min(palettes.length - 1, map.index - 1))]!;
  const architectureMaterial = material(palette.architecture, 0.36, 0.03);
  const propMaterial = material(palette.prop, 0.42, 0.04);
  const accentMaterial = material(palette.accent, 0.68, 0.18);
  const groundMaterial = material(palette.ground, 0.3, 0.01);
  const budget = coarse ? map.lod.mobileObjectBudget : map.lod.desktopObjectBudget;

  onStatus(`Building ${map.name} architecture…`);
  createGround(app, world, map, groundMaterial);

  let objectCount = 1;

  for (const structure of map.structures) {
    createStaticCollider(world, structure);
    if (objectCount < budget) {
      createVisualBox(app, structure, architectureMaterial);
      objectCount += 1;
    }
  }

  for (const prop of map.props) {
    if (!prop.decorative) createStaticCollider(world, prop);
    if (objectCount >= budget || (coarse && prop.decorative)) continue;
    createVisualBox(app, prop, propMaterial);
    objectCount += 1;
  }

  const doors = map.doors.map((door) => {
    objectCount += 1;
    return createDoor(app, world, door, accentMaterial);
  });

  for (const objective of map.objectives) {
    if (objectCount >= budget + map.objectives.length) break;
    const marker = new Entity(`objective-marker-${objective.id}`);
    marker.addComponent('render', { type: 'sphere' });
    marker.setLocalScale(0.38, 0.38, 0.38);
    marker.setPosition(objective.position[0], objective.position[1] + 0.7, objective.position[2]);
    if (marker.render) marker.render.material = accentMaterial;
    app.root.addChild(marker);
    objectCount += 1;
  }

  onStatus(
    `${map.name} ready · ${objectCount} visible runtime objects · ${map.navNodes.length} navigation nodes`,
  );

  void applySurfaceTextures(app, map, architectureMaterial, propMaterial, groundMaterial);
  void loadProgressiveDressing(app, map);
  return { doors, objectCount };
}

export async function buildSelectedMap(
  app: Application,
  world: RAPIER.World,
  map: MapDefinition,
  onStatus: (message: string) => void,
): Promise<MapRuntime> {
  const palette = palettes[Math.max(0, Math.min(palettes.length - 1, map.index - 1))]!;

  if (map.id === 'ravenwood') {
    await buildRavenwood(app, world, onStatus);
    const doorMaterial = material(palette.accent, 0.5, 0.08);
    const doors = map.doors.map((door) => createDoor(app, world, door, doorMaterial));
    void loadTexture(app, 'materials/cc0/walnut.png')
      .then((texture) => applyTexture(doorMaterial, texture, 2.2, 0.5))
      .catch((error) => {
        console.warn('[Hideverse materials] Ravenwood door texture unavailable.', error);
      });
    return {
      doors,
      objectCount: map.structures.length + map.props.length + doors.length,
    };
  }

  return buildProceduralMap(app, world, map, onStatus);
}
