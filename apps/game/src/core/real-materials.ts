import {
  ADDRESS_REPEAT,
  Application,
  StandardMaterial,
  Texture,
} from 'playcanvas';
import {
  createReferenceMaterial,
  mapWallTone,
  type ReferenceMaterialRole,
} from './reference-art-direction';

export type RealMaterialSet = {
  wall: StandardMaterial;
  wallAlt: StandardMaterial;
  floor: StandardMaterial;
  trim: StandardMaterial;
  metal: StandardMaterial;
  accent: StandardMaterial;
  wood: StandardMaterial;
};

type TextureName =
  | 'plaster'
  | 'concrete'
  | 'brick'
  | 'asphalt'
  | 'tile'
  | 'metal'
  | 'wood';

type SurfaceProfile = {
  wall: TextureName;
  wallAlt: TextureName;
  floor: TextureName;
  trim: TextureName;
  metal: TextureName;
  wood: TextureName;
};

const textureFiles: Record<TextureName, string> = {
  plaster: 'materials/cc0/plaster-wall.png',
  concrete: 'materials/cc0/concrete-wall.png',
  brick: 'materials/cc0/brick-wall.png',
  asphalt: 'materials/cc0/asphalt-floor.png',
  tile: 'materials/cc0/tile-floor.png',
  metal: 'materials/cc0/metal.png',
  wood: 'materials/cc0/wood.png',
};

const profiles: Record<string, SurfaceProfile> = {
  ravenwood: {
    wall: 'plaster',
    wallAlt: 'brick',
    floor: 'asphalt',
    trim: 'wood',
    metal: 'metal',
    wood: 'wood',
  },
  nexus: {
    wall: 'plaster',
    wallAlt: 'concrete',
    floor: 'tile',
    trim: 'metal',
    metal: 'metal',
    wood: 'wood',
  },
  museum: {
    wall: 'plaster',
    wallAlt: 'concrete',
    floor: 'tile',
    trim: 'wood',
    metal: 'metal',
    wood: 'wood',
  },
  hospital: {
    wall: 'concrete',
    wallAlt: 'plaster',
    floor: 'tile',
    trim: 'metal',
    metal: 'metal',
    wood: 'wood',
  },
  hotel: {
    wall: 'plaster',
    wallAlt: 'concrete',
    floor: 'tile',
    trim: 'wood',
    metal: 'metal',
    wood: 'wood',
  },
  axiom: {
    wall: 'concrete',
    wallAlt: 'metal',
    floor: 'asphalt',
    trim: 'metal',
    metal: 'metal',
    wood: 'wood',
  },
};

const textureCache = new Map<string, Promise<Texture>>();

function loadTexture(app: Application, path: string): Promise<Texture> {
  const url = `${import.meta.env.BASE_URL}${path}`;
  const cached = textureCache.get(url);
  if (cached) return cached;

  const loading = new Promise<Texture>((resolve, reject) => {
    app.assets.loadFromUrl(url, 'texture', (error, asset) => {
      if (error || !asset?.resource) {
        reject(new Error(`Failed to load texture ${url}: ${String(error ?? 'no resource')}`));
        return;
      }

      const texture = asset.resource as Texture;
      texture.addressU = ADDRESS_REPEAT;
      texture.addressV = ADDRESS_REPEAT;
      resolve(texture);
    });
  });

  textureCache.set(url, loading);
  return loading;
}

function applyTexture(
  material: StandardMaterial,
  texture: Texture,
  role: ReferenceMaterialRole,
): void {
  material.diffuseMap = texture;

  const tiling =
    role === 'floor'
      ? 10
      : role === 'wall' || role === 'wall-alt'
        ? 4
        : role === 'metal'
          ? 3
          : role === 'wood'
            ? 4
            : 3;

  material.diffuseMapTiling.set(tiling, tiling);
  material.update();
}

export function createRealMaterialSet(mapIndex: number): RealMaterialSet {
  return {
    wall: createReferenceMaterial('wall', mapWallTone(mapIndex)),
    wallAlt: createReferenceMaterial('wall-alt'),
    floor: createReferenceMaterial('floor'),
    trim: createReferenceMaterial('trim'),
    metal: createReferenceMaterial('metal'),
    accent: createReferenceMaterial('accent'),
    wood: createReferenceMaterial('wood'),
  };
}

export async function streamRealMaterialTextures(
  app: Application,
  mapId: string,
  materials: RealMaterialSet,
): Promise<void> {
  const profile = profiles[mapId] ?? profiles.axiom;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const delay = coarse ? 120 : 70;

  const jobs: Array<{
    material: StandardMaterial;
    role: ReferenceMaterialRole;
    texture: TextureName;
  }> = [
    { material: materials.wall, role: 'wall', texture: profile.wall },
    { material: materials.floor, role: 'floor', texture: profile.floor },
    { material: materials.wallAlt, role: 'wall-alt', texture: profile.wallAlt },
    { material: materials.trim, role: 'trim', texture: profile.trim },
    { material: materials.metal, role: 'metal', texture: profile.metal },
    { material: materials.wood, role: 'wood', texture: profile.wood },
  ];

  const loaded = new Set<TextureName>();

  for (const job of jobs) {
    try {
      const texture = await loadTexture(app, textureFiles[job.texture]);
      applyTexture(job.material, texture, job.role);
      loaded.add(job.texture);
    } catch (error) {
      console.warn('[Hideverse materials] Texture fallback retained.', error);
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, delay);
    });
  }

  console.info(
    `[Hideverse materials] ${mapId}: ${loaded.size} lightweight CC0 surface textures active.`,
  );
}
