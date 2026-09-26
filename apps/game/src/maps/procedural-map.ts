import RAPIER from '@dimforge/rapier3d-compat';
import { Application, Color, Entity, StandardMaterial } from 'playcanvas';
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

function material(color: Triplet): StandardMaterial {
  const result = new StandardMaterial();
  result.diffuse = new Color(color[0], color[1], color[2]);
  result.metalness = 0.05;
  result.gloss = 0.35;
  result.update();
  return result;
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

async function buildProceduralMap(
  app: Application,
  world: RAPIER.World,
  map: MapDefinition,
  onStatus: (message: string) => void,
): Promise<MapRuntime> {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const palette = palettes[Math.max(0, Math.min(palettes.length - 1, map.index - 1))]!;
  const architectureMaterial = material(palette.architecture);
  const propMaterial = material(palette.prop);
  const accentMaterial = material(palette.accent);
  const groundMaterial = material(palette.ground);
  const budget = coarse ? map.lod.mobileObjectBudget : map.lod.desktopObjectBudget;

  onStatus(`Building ${map.name} architecture…`);
  createGround(app, world, map, groundMaterial);

  let objectCount = 1;

  for (const structure of map.structures) {
    if (objectCount >= budget) break;
    createVisualBox(app, structure, architectureMaterial);
    createStaticCollider(world, structure);
    objectCount += 1;
  }

  for (const prop of map.props) {
    if (objectCount >= budget) break;
    if (coarse && prop.decorative) continue;
    createVisualBox(app, prop, propMaterial);
    if (!prop.decorative) {
      createStaticCollider(world, prop);
    }
    objectCount += 1;
  }

  const doors = map.doors.map((door) => {
    objectCount += 1;
    return createDoor(app, world, door, accentMaterial);
  });

  onStatus(
    `${map.name} ready · ${objectCount} runtime objects · ${map.navNodes.length} navigation nodes`,
  );

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
    const doorMaterial = material(palette.accent);
    const doors = map.doors.map((door) => createDoor(app, world, door, doorMaterial));
    return {
      doors,
      objectCount: map.structures.length + map.props.length + doors.length,
    };
  }

  return buildProceduralMap(app, world, map, onStatus);
}
