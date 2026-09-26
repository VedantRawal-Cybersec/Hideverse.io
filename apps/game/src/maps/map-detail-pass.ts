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
      entity.setPosition(
        placement.position[0],
        placement.position[1],
        placement.position[2],
      );
      entity.setEulerAngles(0, placement.yaw ?? 0, 0);
      app.root.addChild(entity);
    } catch (error) {
      console.warn('[Hideverse detail pass] Asset skipped.', error);
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, coarse ? 180 : 90));
  }
}

function buildNexusDetails(
  app: Application,
  materials: DetailMaterials,
  coarse: boolean,
): number {
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

export function buildMapSpecificDetailPass(
  app: Application,
  map: MapDefinition,
  materials: DetailMaterials,
  coarse: boolean,
): number {
  if (map.id === 'nexus') return buildNexusDetails(app, materials, coarse);
  if (map.id === 'hospital') return buildHospitalDetails(app, materials, coarse);
  return 0;
}
