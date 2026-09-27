import { Application, Color, Entity, StandardMaterial } from 'playcanvas';
import { loadContainer } from '../core/load-container';
import type { MapDefinition, Triplet } from './map-catalog';

export type DetailMaterials = {
  wall: StandardMaterial;
  wallAlt: StandardMaterial;
  trim: StandardMaterial;
  metal: StandardMaterial;
  wood: StandardMaterial;
  accent: StandardMaterial;
};

type DetailBox = {
  id: string;
  position: Triplet;
  size: Triplet;
  material: StandardMaterial;
};

type AssetPlacement = {
  asset: string;
  position: Triplet;
  scale: number;
  yaw?: number;
};

function makeMaterial(
  color: Triplet,
  gloss: number,
  metalness: number,
  emissive = 0,
): StandardMaterial {
  const material = new StandardMaterial();
  material.diffuse = new Color(color[0], color[1], color[2]);
  material.gloss = gloss;
  material.metalness = metalness;
  if (emissive > 0) {
    material.emissive = new Color(color[0], color[1], color[2]);
    material.emissiveIntensity = emissive;
  }
  material.update();
  return material;
}

function addBox(app: Application, detail: DetailBox): void {
  const entity = new Entity(detail.id);
  entity.addComponent('render', { type: 'box' });
  entity.setLocalScale(detail.size[0], detail.size[1], detail.size[2]);
  entity.setPosition(detail.position[0], detail.position[1], detail.position[2]);
  if (entity.render) entity.render.material = detail.material;
  app.root.addChild(entity);
}

async function loadPlacedAssets(
  app: Application,
  placements: AssetPlacement[],
  coarse: boolean,
): Promise<void> {
  const cache = new Map<string, ReturnType<typeof loadContainer>>();

  const getAsset = (asset: string): ReturnType<typeof loadContainer> => {
    const existing = cache.get(asset);
    if (existing) return existing;
    const loading = loadContainer(app, `${import.meta.env.BASE_URL}${asset}`);
    cache.set(asset, loading);
    return loading;
  };

  for (const [index, placement] of placements.entries()) {
    try {
      const asset = await getAsset(placement.asset);
      const entity = asset.resource.instantiateRenderEntity({
        castShadows: !coarse,
        receiveShadows: true,
      });
      entity.name = `detail-prop-${index}-${placement.asset.split('/').at(-1) ?? 'asset'}`;
      entity.setLocalScale(placement.scale, placement.scale, placement.scale);
      entity.setPosition(placement.position[0], placement.position[1], placement.position[2]);
      entity.setEulerAngles(0, placement.yaw ?? 0, 0);
      app.root.addChild(entity);
    } catch (error) {
      console.warn('[Hideverse detail pass] Asset skipped.', error);
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, coarse ? 180 : 90));
  }
}

function buildNexusDetails(app: Application, materials: DetailMaterials, coarse: boolean): number {
  const glass = makeMaterial([0.12, 0.22, 0.28], 0.82, 0.12, 0.025);
  const sign = makeMaterial([0.82, 0.28, 0.16], 0.35, 0.04, 0.08);
  const details: DetailBox[] = [];

  const storeRows = [28, -2, -32];
  for (const z of storeRows) {
    for (const side of [-1, 1] as const) {
      const frontX = side * 28.85;
      details.push({
        id: `nexus-store-glass-${side}-${z}`,
        position: [frontX, 2.4, z],
        size: [0.18, 3.75, 11.5],
        material: glass,
      });
      details.push({
        id: `nexus-store-fascia-${side}-${z}`,
        position: [frontX - side * 0.03, 5.15, z],
        size: [0.24, 0.72, 12.8],
        material: sign,
      });

      if (!coarse) {
        for (const zOffset of [-5.4, 0, 5.4]) {
          details.push({
            id: `nexus-store-frame-${side}-${z}-${zOffset}`,
            position: [frontX - side * 0.06, 2.35, z + zOffset],
            size: [0.28, 4.6, 0.22],
            material: materials.metal,
          });
        }
      }
    }
  }

  details.push(
    {
      id: 'nexus-cinema-front',
      position: [0, 3, 31.82],
      size: [20, 4.2, 0.18],
      material: glass,
    },
    {
      id: 'nexus-cinema-fascia',
      position: [0, 5.35, 31.72],
      size: [22, 0.7, 0.3],
      material: sign,
    },
    {
      id: 'nexus-food-front',
      position: [0, 2.6, -33.85],
      size: [20, 3.4, 0.2],
      material: glass,
    },
    {
      id: 'nexus-entry-header',
      position: [0, 5.25, 55],
      size: [12, 0.7, 0.45],
      material: materials.metal,
    },
  );

  for (const detail of details) addBox(app, detail);

  const props: AssetPlacement[] = coarse
    ? [
        {
          asset: 'ravenwood/exterior/kaykit-city/bench.gltf',
          position: [-14, 0, 8],
          scale: 1.05,
          yaw: 90,
        },
        {
          asset: 'ravenwood/exterior/kaykit-city/bench.gltf',
          position: [14, 0, 8],
          scale: 1.05,
          yaw: -90,
        },
        {
          asset: 'ravenwood/nature/kenney/plant_bush.glb',
          position: [8, 0, 18],
          scale: 1.1,
        },
      ]
    : [
        {
          asset: 'ravenwood/exterior/kaykit-city/bench.gltf',
          position: [-14, 0, 8],
          scale: 1.05,
          yaw: 90,
        },
        {
          asset: 'ravenwood/exterior/kaykit-city/bench.gltf',
          position: [14, 0, 8],
          scale: 1.05,
          yaw: -90,
        },
        {
          asset: 'ravenwood/nature/kenney/plant_bush.glb',
          position: [8, 0, 18],
          scale: 1.1,
        },
        {
          asset: 'ravenwood/nature/kenney/plant_bush.glb',
          position: [-8, 0, 18],
          scale: 1.1,
        },
        {
          asset: 'ravenwood/exterior/kaykit-city/streetlight.gltf',
          position: [-7, 0, 47],
          scale: 1.15,
        },
        {
          asset: 'ravenwood/exterior/kaykit-city/streetlight.gltf',
          position: [7, 0, 47],
          scale: 1.15,
        },
      ];

  window.setTimeout(() => void loadPlacedAssets(app, props, coarse), coarse ? 2400 : 1600);
  return details.length + props.length;
}

function buildHospitalDetails(
  app: Application,
  materials: DetailMaterials,
  coarse: boolean,
): number {
  const glass = makeMaterial([0.22, 0.37, 0.42], 0.78, 0.08, 0.018);
  const hospitalBand = makeMaterial([0.23, 0.42, 0.4], 0.2, 0.02);
  const emergency = makeMaterial([0.64, 0.14, 0.11], 0.25, 0.02, 0.05);
  const lightPanel = makeMaterial([0.9, 0.92, 0.86], 0.18, 0, 0.16);

  const details: DetailBox[] = [
    {
      id: 'hospital-entry-frame-top',
      position: [0, 4.3, 53],
      size: [9.4, 0.42, 0.6],
      material: emergency,
    },
    {
      id: 'hospital-entry-frame-left',
      position: [-4.45, 2.2, 53],
      size: [0.42, 4.6, 0.6],
      material: emergency,
    },
    {
      id: 'hospital-entry-frame-right',
      position: [4.45, 2.2, 53],
      size: [0.42, 4.6, 0.6],
      material: emergency,
    },
    {
      id: 'hospital-entry-glass-left',
      position: [-2.2, 2.2, 52.9],
      size: [3.2, 3.65, 0.16],
      material: glass,
    },
    {
      id: 'hospital-entry-glass-right',
      position: [2.2, 2.2, 52.9],
      size: [3.2, 3.65, 0.16],
      material: glass,
    },
  ];

  for (const x of [-31, 31]) {
    for (const z of [-18, 18]) {
      const towardCenter = x < 0 ? x + 10.15 : x - 10.15;
      details.push({
        id: `hospital-ward-band-${x}-${z}`,
        position: [towardCenter, 1.05, z],
        size: [0.16, 1.25, 18],
        material: hospitalBand,
      });
      details.push({
        id: `hospital-ward-window-${x}-${z}`,
        position: [towardCenter + (x < 0 ? 0.02 : -0.02), 3.3, z],
        size: [0.2, 1.3, 8.5],
        material: glass,
      });
    }
  }

  for (const door of [
    { id: 'surgery', x: 0, z: -31.82, width: 5.5 },
    { id: 'morgue', x: -16, z: -42, width: 4.4 },
  ]) {
    details.push(
      {
        id: `hospital-${door.id}-header`,
        position: [door.x, 4, door.z],
        size: [door.width, 0.42, 0.45],
        material: emergency,
      },
      {
        id: `hospital-${door.id}-frame-left`,
        position: [door.x - door.width / 2 + 0.2, 2, door.z],
        size: [0.35, 3.9, 0.45],
        material: materials.metal,
      },
      {
        id: `hospital-${door.id}-frame-right`,
        position: [door.x + door.width / 2 - 0.2, 2, door.z],
        size: [0.35, 3.9, 0.45],
        material: materials.metal,
      },
    );
  }

  if (!coarse) {
    for (const z of [28, 8, -12, -30]) {
      details.push({
        id: `hospital-ceiling-light-${z}`,
        position: [0, 5.1, z],
        size: [4.8, 0.08, 1],
        material: lightPanel,
      });
    }
  }

  for (const detail of details) addBox(app, detail);

  const props: AssetPlacement[] = coarse
    ? [
        {
          asset: 'ravenwood/furniture/kaykit/bed_double_A.gltf',
          position: [-22, 0, 18],
          scale: 0.78,
          yaw: 90,
        },
        {
          asset: 'ravenwood/furniture/kaykit/shelf_B_large_decorated.gltf',
          position: [21, 0, -18],
          scale: 0.78,
          yaw: -90,
        },
      ]
    : [
        {
          asset: 'ravenwood/furniture/kaykit/bed_double_A.gltf',
          position: [-22, 0, 18],
          scale: 0.78,
          yaw: 90,
        },
        {
          asset: 'ravenwood/furniture/kaykit/bed_double_A.gltf',
          position: [22, 0, 18],
          scale: 0.78,
          yaw: -90,
        },
        {
          asset: 'ravenwood/furniture/kaykit/shelf_B_large_decorated.gltf',
          position: [-21, 0, -18],
          scale: 0.78,
          yaw: 90,
        },
        {
          asset: 'ravenwood/furniture/kaykit/shelf_B_large_decorated.gltf',
          position: [21, 0, -18],
          scale: 0.78,
          yaw: -90,
        },
        {
          asset: 'ravenwood/furniture/kaykit/chair_A.gltf',
          position: [-4, 0, 30],
          scale: 0.9,
          yaw: 90,
        },
        {
          asset: 'ravenwood/furniture/kaykit/chair_A.gltf',
          position: [4, 0, 30],
          scale: 0.9,
          yaw: -90,
        },
      ];

  window.setTimeout(() => void loadPlacedAssets(app, props, coarse), coarse ? 2600 : 1700);
  return details.length + props.length;
}

function buildMuseumDetails(app: Application, materials: DetailMaterials, coarse: boolean): number {
  const glass = makeMaterial([0.18, 0.27, 0.3], 0.86, 0.08, 0.018);
  const gold = makeMaterial([0.62, 0.44, 0.17], 0.5, 0.34, 0.025);
  const lightPanel = makeMaterial([0.92, 0.88, 0.74], 0.2, 0, 0.12);
  const details: DetailBox[] = [];

  for (const display of [
    { id: 'west', x: -14, z: 4, width: 4.8 },
    { id: 'east', x: 14, z: 4, width: 4.8 },
    { id: 'north', x: 0, z: -16, width: 5.8 },
  ]) {
    details.push(
      {
        id: `museum-display-glass-${display.id}`,
        position: [display.x, 2.1, display.z],
        size: [display.width, 2.25, 2.5],
        material: glass,
      },
      {
        id: `museum-display-plinth-${display.id}`,
        position: [display.x, 0.48, display.z],
        size: [display.width + 0.4, 0.55, 2.9],
        material: materials.trim,
      },
      {
        id: `museum-display-cap-${display.id}`,
        position: [display.x, 3.3, display.z],
        size: [display.width + 0.25, 0.12, 2.7],
        material: gold,
      },
    );
  }

  details.push(
    {
      id: 'museum-vault-frame-top',
      position: [0, 4.35, -29.65],
      size: [7.2, 0.48, 0.7],
      material: materials.metal,
    },
    {
      id: 'museum-vault-frame-left',
      position: [-3.35, 2.2, -29.65],
      size: [0.5, 4.7, 0.7],
      material: materials.metal,
    },
    {
      id: 'museum-vault-frame-right',
      position: [3.35, 2.2, -29.65],
      size: [0.5, 4.7, 0.7],
      material: materials.metal,
    },
    {
      id: 'museum-entry-canopy',
      position: [0, 4.8, 49],
      size: [12, 0.4, 2.4],
      material: gold,
    },
  );

  if (!coarse) {
    for (const z of [28, 12, -4, -20]) {
      details.push({
        id: `museum-ceiling-panel-${z}`,
        position: [0, 5.8, z],
        size: [7.2, 0.08, 1.1],
        material: lightPanel,
      });
    }
  }

  for (const detail of details) addBox(app, detail);

  const props: AssetPlacement[] = coarse
    ? [
        {
          asset: 'ravenwood/architecture/kaykit-dungeon/wall_arched.gltf.glb',
          position: [-20, 0, 8],
          scale: 1.1,
          yaw: 90,
        },
        {
          asset: 'ravenwood/architecture/kaykit-dungeon/crates_stacked.gltf.glb',
          position: [-12, 0, -34],
          scale: 0.75,
        },
      ]
    : [
        {
          asset: 'ravenwood/architecture/kaykit-dungeon/wall_arched.gltf.glb',
          position: [-20, 0, 8],
          scale: 1.1,
          yaw: 90,
        },
        {
          asset: 'ravenwood/architecture/kaykit-dungeon/wall_arched.gltf.glb',
          position: [20, 0, 8],
          scale: 1.1,
          yaw: -90,
        },
        {
          asset: 'ravenwood/exterior/kaykit-city/bench.gltf',
          position: [-8, 0, 23],
          scale: 1,
          yaw: 90,
        },
        {
          asset: 'ravenwood/exterior/kaykit-city/bench.gltf',
          position: [8, 0, 23],
          scale: 1,
          yaw: -90,
        },
        {
          asset: 'ravenwood/architecture/kaykit-dungeon/crates_stacked.gltf.glb',
          position: [-12, 0, -34],
          scale: 0.75,
        },
      ];

  window.setTimeout(() => void loadPlacedAssets(app, props, coarse), coarse ? 2600 : 1750);
  return details.length + props.length;
}

function buildHotelDetails(app: Application, materials: DetailMaterials, coarse: boolean): number {
  const glass = makeMaterial([0.16, 0.28, 0.31], 0.84, 0.07, 0.018);
  const warmLight = makeMaterial([0.92, 0.68, 0.38], 0.22, 0, 0.1);
  const floorBand = makeMaterial([0.34, 0.25, 0.19], 0.18, 0.01);
  const details: DetailBox[] = [
    {
      id: 'hotel-entry-glass-left',
      position: [-2.25, 2.25, 39],
      size: [3.4, 3.65, 0.18],
      material: glass,
    },
    {
      id: 'hotel-entry-glass-right',
      position: [2.25, 2.25, 39],
      size: [3.4, 3.65, 0.18],
      material: glass,
    },
    {
      id: 'hotel-entry-canopy',
      position: [0, 4.6, 39],
      size: [10.5, 0.36, 2.4],
      material: materials.wood,
    },
    {
      id: 'hotel-lobby-backdrop',
      position: [0, 2.1, 32.2],
      size: [13, 4.1, 0.2],
      material: materials.wood,
    },
  ];

  const floorBands = coarse ? [5.4] : [2.2, 5.4, 8.8];
  for (const y of floorBands) {
    details.push({
      id: `hotel-floor-band-${y}`,
      position: [0, y, -39.35],
      size: [68, 0.28, 0.18],
      material: floorBand,
    });
  }

  if (!coarse) {
    const roomZ = [-22, -10, 2, 14, 26];
    for (const z of roomZ) {
      for (const side of [-1, 1] as const) {
        const x = side * 18.95;
        details.push({
          id: `hotel-room-door-frame-${side}-${z}`,
          position: [x, 1.9, z],
          size: [0.18, 3.2, 2.15],
          material: materials.trim,
        });
        details.push({
          id: `hotel-room-sconce-${side}-${z}`,
          position: [x - side * 0.12, 3.15, z + 2.1],
          size: [0.12, 0.45, 0.45],
          material: warmLight,
        });
      }
    }
  }

  for (const detail of details) addBox(app, detail);

  const props: AssetPlacement[] = coarse
    ? [
        {
          asset: 'ravenwood/furniture/kaykit/couch.gltf',
          position: [-6, 0, 27],
          scale: 0.95,
          yaw: 90,
        },
      ]
    : [
        {
          asset: 'ravenwood/furniture/kaykit/couch.gltf',
          position: [-6, 0, 27],
          scale: 0.95,
          yaw: 90,
        },
        {
          asset: 'ravenwood/furniture/kaykit/couch.gltf',
          position: [6, 0, 27],
          scale: 0.95,
          yaw: -90,
        },
        {
          asset: 'ravenwood/furniture/kaykit/lamp_standing.gltf',
          position: [-8, 0, 27],
          scale: 0.95,
        },
        {
          asset: 'ravenwood/furniture/kaykit/lamp_standing.gltf',
          position: [8, 0, 27],
          scale: 0.95,
        },
        {
          asset: 'ravenwood/exterior/kaykit-city/bench.gltf',
          position: [0, 0, 34],
          scale: 1,
          yaw: 180,
        },
      ];

  window.setTimeout(() => void loadPlacedAssets(app, props, coarse), coarse ? 3200 : 1800);
  return details.length + props.length;
}

function buildAxiomDetails(app: Application, materials: DetailMaterials, coarse: boolean): number {
  const glass = makeMaterial([0.12, 0.31, 0.36], 0.88, 0.16, 0.035);
  const hazard = makeMaterial([0.86, 0.58, 0.1], 0.28, 0.02, 0.05);
  const reactorGlow = makeMaterial([0.16, 0.72, 0.76], 0.36, 0.08, 0.18);
  const details: DetailBox[] = [];

  for (const door of [
    { id: 'entry', x: 0, z: 53, width: 9 },
    { id: 'reactor', x: 0, z: -27.6, width: 7 },
    { id: 'cleanroom', x: 0, z: 8.1, width: 6 },
  ]) {
    details.push(
      {
        id: `axiom-${door.id}-frame-top`,
        position: [door.x, 4.35, door.z],
        size: [door.width, 0.42, 0.7],
        material: hazard,
      },
      {
        id: `axiom-${door.id}-frame-left`,
        position: [door.x - door.width / 2 + 0.22, 2.2, door.z],
        size: [0.38, 4.7, 0.7],
        material: materials.metal,
      },
      {
        id: `axiom-${door.id}-frame-right`,
        position: [door.x + door.width / 2 - 0.22, 2.2, door.z],
        size: [0.38, 4.7, 0.7],
        material: materials.metal,
      },
    );
  }

  for (const x of [-18, 18]) {
    details.push({
      id: `axiom-specimen-glass-${x}`,
      position: [x, 2, -18],
      size: [3, 4.1, 3],
      material: glass,
    });
  }

  for (const offset of [-3.2, 0, 3.2]) {
    details.push({
      id: `axiom-reactor-glow-${offset}`,
      position: [offset, 2.8, -38],
      size: [1.1, 5.4, 1.1],
      material: reactorGlow,
    });
  }

  if (!coarse) {
    for (const z of [25, 10, -6, -22]) {
      details.push({
        id: `axiom-ceiling-trunk-${z}`,
        position: [0, 5.2, z],
        size: [18, 0.32, 0.42],
        material: materials.metal,
      });
    }
  }

  for (const detail of details) addBox(app, detail);

  const props: AssetPlacement[] = coarse
    ? [
        {
          asset: 'ravenwood/architecture/kaykit-dungeon/crates_stacked.gltf.glb',
          position: [-12, 0, 22],
          scale: 0.7,
        },
        {
          asset: 'ravenwood/architecture/kaykit-dungeon/barrel_large.gltf.glb',
          position: [13, 0, -8],
          scale: 0.72,
        },
      ]
    : [
        {
          asset: 'ravenwood/architecture/kaykit-dungeon/crates_stacked.gltf.glb',
          position: [-12, 0, 22],
          scale: 0.7,
        },
        {
          asset: 'ravenwood/architecture/kaykit-dungeon/crates_stacked.gltf.glb',
          position: [12, 0, 22],
          scale: 0.7,
        },
        {
          asset: 'ravenwood/architecture/kaykit-dungeon/barrel_large.gltf.glb',
          position: [-13, 0, -8],
          scale: 0.72,
        },
        {
          asset: 'ravenwood/architecture/kaykit-dungeon/barrel_large.gltf.glb',
          position: [13, 0, -8],
          scale: 0.72,
        },
        {
          asset: 'ravenwood/exterior/kaykit-city/streetlight.gltf',
          position: [-8, 0, 45],
          scale: 1,
        },
        {
          asset: 'ravenwood/exterior/kaykit-city/streetlight.gltf',
          position: [8, 0, 45],
          scale: 1,
        },
      ];

  window.setTimeout(() => void loadPlacedAssets(app, props, coarse), coarse ? 2700 : 1850);
  return details.length + props.length;
}

export function buildMapSpecificDetailPass(
  app: Application,
  map: MapDefinition,
  materials: DetailMaterials,
  coarse: boolean,
): number {
  if (map.id === 'nexus') return buildNexusDetails(app, materials, coarse);
  if (map.id === 'museum') return buildMuseumDetails(app, materials, coarse);
  if (map.id === 'hospital') return buildHospitalDetails(app, materials, coarse);
  if (map.id === 'hotel') return buildHotelDetails(app, materials, coarse);
  if (map.id === 'axiom') return buildAxiomDetails(app, materials, coarse);
  return 0;
}
