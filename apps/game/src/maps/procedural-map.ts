import RAPIER from '@dimforge/rapier3d-compat';
import { Application, Entity, StandardMaterial } from 'playcanvas';
import { loadContainer } from '../core/load-container';
import {
  colorFromTriplet,
  createReferenceMaterial,
  mapWallTone,
} from '../core/reference-art-direction';
import type { DoorDefinition, MapBox, MapDefinition } from './map-catalog';
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

type DressingAsset = {
  asset: string;
  scale: number;
};

const dressingAssets: Record<string, DressingAsset[]> = {
  nexus: [
    { asset: 'ravenwood/exterior/kaykit-city/bench.gltf', scale: 1 },
    { asset: 'ravenwood/exterior/kaykit-city/streetlight.gltf', scale: 1 },
    { asset: 'ravenwood/nature/kenney/plant_bush.glb', scale: 1.1 },
    { asset: 'ravenwood/furniture/kaykit/couch.gltf', scale: 0.95 },
  ],
  museum: [
    { asset: 'ravenwood/architecture/kaykit-dungeon/wall_arched.gltf.glb', scale: 1 },
    { asset: 'ravenwood/furniture/kaykit/shelf_B_large_decorated.gltf', scale: 0.9 },
    { asset: 'ravenwood/nature/kenney/plant_bush.glb', scale: 0.95 },
    { asset: 'ravenwood/architecture/kaykit-dungeon/crates_stacked.gltf.glb', scale: 0.9 },
  ],
  hospital: [
    { asset: 'ravenwood/furniture/kaykit/bed_double_A.gltf', scale: 0.82 },
    { asset: 'ravenwood/furniture/kaykit/shelf_B_large_decorated.gltf', scale: 0.82 },
    { asset: 'ravenwood/nature/kenney/plant_bush.glb', scale: 0.9 },
    { asset: 'ravenwood/furniture/kaykit/chair_A.gltf', scale: 0.9 },
  ],
  hotel: [
    { asset: 'ravenwood/exterior/kaykit-city/bench.gltf', scale: 1 },
    { asset: 'ravenwood/nature/kenney/plant_bush.glb', scale: 1 },
    { asset: 'ravenwood/furniture/kaykit/couch.gltf', scale: 0.95 },
    { asset: 'ravenwood/furniture/kaykit/lamp_standing.gltf', scale: 0.92 },
  ],
  axiom: [
    { asset: 'ravenwood/architecture/kaykit-dungeon/crates_stacked.gltf.glb', scale: 0.8 },
    { asset: 'ravenwood/exterior/kaykit-city/streetlight.gltf', scale: 1 },
    { asset: 'ravenwood/nature/kenney/rock_largeA.glb', scale: 0.8 },
    { asset: 'ravenwood/nature/kenney/plant_bush.glb', scale: 0.9 },
  ],
};

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

function createReferenceStructureDetails(
  app: Application,
  item: MapBox,
  trimMaterial: StandardMaterial,
  wallAltMaterial: StandardMaterial,
  coarse: boolean,
): number {
  const [width, height, depth] = item.size;
  if (height < 1.8 || width < 1.2 || depth < 1.2) return 0;

  let created = 0;
  const topCap: MapBox = {
    id: `${item.id}-roof-cap`,
    position: [item.position[0], item.position[1] + height / 2 + 0.08, item.position[2]],
    size: [width + 0.12, 0.16, depth + 0.12],
  };
  createVisualBox(app, topCap, trimMaterial);
  created += 1;

  if (!coarse) {
    const baseBand: MapBox = {
      id: `${item.id}-base-band`,
      position: [item.position[0], item.position[1] - height / 2 + 0.14, item.position[2]],
      size: [width + 0.06, 0.28, depth + 0.06],
    };
    createVisualBox(app, baseBand, wallAltMaterial);
    created += 1;

    if (width >= 8 && depth >= 3) {
      const pillarHeight = Math.min(height * 0.72, 4.8);
      const pillarY = item.position[1] - height / 2 + pillarHeight / 2 + 0.28;
      const pillarSize = Math.max(0.28, Math.min(0.44, Math.min(width, depth) * 0.04));
      const corners: Array<[number, number]> = [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ];

      for (const [sx, sz] of corners) {
        createVisualBox(
          app,
          {
            id: `${item.id}-pillar-${sx}-${sz}`,
            position: [
              item.position[0] + sx * (width / 2 - pillarSize / 2),
              pillarY,
              item.position[2] + sz * (depth / 2 - pillarSize / 2),
            ],
            size: [pillarSize, pillarHeight, pillarSize],
          },
          trimMaterial,
        );
        created += 1;
      }
    }
  }

  return created;
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

function createReferenceFloorPattern(
  app: Application,
  map: MapDefinition,
  walkwayMaterial: StandardMaterial,
  trimMaterial: StandardMaterial,
  coarse: boolean,
): number {
  const [minX, minY, minZ] = map.worldBounds.min;
  const [maxX, , maxZ] = map.worldBounds.max;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const groundY = Math.max(0.02, minY + 4.03);
  let created = 0;

  const longitudinal: MapBox = {
    id: `${map.id}-walkway-long`,
    position: [centerX, groundY, centerZ],
    size: [Math.min(8, width * 0.16), 0.045, depth * 0.72],
  };
  createVisualBox(app, longitudinal, walkwayMaterial);
  created += 1;

  if (!coarse) {
    const cross: MapBox = {
      id: `${map.id}-walkway-cross`,
      position: [centerX, groundY + 0.004, centerZ],
      size: [width * 0.58, 0.05, Math.min(7, depth * 0.14)],
    };
    createVisualBox(app, cross, walkwayMaterial);
    created += 1;

    const centerStripe: MapBox = {
      id: `${map.id}-floor-stripe`,
      position: [centerX, groundY + 0.012, centerZ],
      size: [0.18, 0.025, depth * 0.64],
    };
    createVisualBox(app, centerStripe, trimMaterial);
    created += 1;
  }

  return created;
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

  for (let index = 0; index < instanceLimit; index += 1) {
    const spec = specs[index % specs.length]!;
    const anchor = map.navNodes[(index * 2 + 1) % map.navNodes.length]!;

    try {
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
    } catch (error) {
      console.warn('[Hideverse dressing] asset skipped.', error);
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, coarse ? 180 : 90));
  }
}

async function buildProceduralMap(
  app: Application,
  world: RAPIER.World,
  map: MapDefinition,
  onStatus: (message: string) => void,
): Promise<MapRuntime> {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const architectureMaterial = createReferenceMaterial('wall', mapWallTone(map.index));
  const wallAltMaterial = createReferenceMaterial('wall-alt');
  const trimMaterial = createReferenceMaterial('trim');
  const propMaterial = createReferenceMaterial('metal');
  const accentMaterial = createReferenceMaterial('accent');
  const groundMaterial = createReferenceMaterial('floor');
  const budget = coarse ? map.lod.mobileObjectBudget : map.lod.desktopObjectBudget;

  onStatus(`Building ${map.name} architecture…`);
  createGround(app, world, map, groundMaterial);

  let objectCount = 1;
  objectCount += createReferenceFloorPattern(app, map, wallAltMaterial, trimMaterial, coarse);

  for (const structure of map.structures) {
    createStaticCollider(world, structure);
    if (objectCount < budget) {
      createVisualBox(app, structure, architectureMaterial);
      objectCount += 1;
      if (objectCount < budget) {
        objectCount += createReferenceStructureDetails(
          app,
          structure,
          trimMaterial,
          wallAltMaterial,
          coarse,
        );
      }
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

    if (!coarse && objectCount < budget + 3) {
      const light = new Entity(`objective-light-${objective.id}`);
      light.addComponent('light', {
        type: 'omni',
        color: colorFromTriplet([0.48, 0.56, 0.46]),
        intensity: 0.55,
        range: 7,
        castShadows: false,
      });
      light.setPosition(objective.position[0], objective.position[1] + 1.8, objective.position[2]);
      app.root.addChild(light);
    }

    objectCount += 1;
  }

  onStatus(
    `${map.name} ready · ${objectCount} visible runtime objects · ${map.navNodes.length} navigation nodes`,
  );

  window.setTimeout(() => {
    void loadProgressiveDressing(app, map);
  }, coarse ? 2600 : 1800);
  return { doors, objectCount };
}

export async function buildSelectedMap(
  app: Application,
  world: RAPIER.World,
  map: MapDefinition,
  onStatus: (message: string) => void,
): Promise<MapRuntime> {
  if (map.id === 'ravenwood') {
    await buildRavenwood(app, world, onStatus);
    const doorMaterial = createReferenceMaterial('accent');
    const doors = map.doors.map((door) => createDoor(app, world, door, doorMaterial));
    return {
      doors,
      objectCount: map.structures.length + map.props.length + doors.length,
    };
  }

  return buildProceduralMap(app, world, map, onStatus);
}
