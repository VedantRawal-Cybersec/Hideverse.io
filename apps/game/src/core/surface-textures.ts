import { ADDRESS_REPEAT, Application, Color, StandardMaterial, Texture } from 'playcanvas';

type SurfaceTextureName =
  | 'plaster'
  | 'concrete'
  | 'brick'
  | 'asphalt'
  | 'tile'
  | 'metal'
  | 'wood';

export type SurfaceMaterialSet = {
  wall?: StandardMaterial;
  wallAlt?: StandardMaterial;
  floor?: StandardMaterial;
  trim?: StandardMaterial;
  metal?: StandardMaterial;
  wood?: StandardMaterial;
};

type SurfaceProfile = {
  wall: SurfaceTextureName;
  wallAlt: SurfaceTextureName;
  floor: SurfaceTextureName;
  trim: SurfaceTextureName;
  metal: SurfaceTextureName;
  wood: SurfaceTextureName;
};

const profiles: Record<number, SurfaceProfile> = {
  1: {
    wall: 'plaster',
    wallAlt: 'brick',
    floor: 'asphalt',
    trim: 'wood',
    metal: 'metal',
    wood: 'wood',
  },
  2: {
    wall: 'plaster',
    wallAlt: 'concrete',
    floor: 'tile',
    trim: 'metal',
    metal: 'metal',
    wood: 'wood',
  },
  3: {
    wall: 'plaster',
    wallAlt: 'concrete',
    floor: 'tile',
    trim: 'wood',
    metal: 'metal',
    wood: 'wood',
  },
  4: {
    wall: 'concrete',
    wallAlt: 'plaster',
    floor: 'tile',
    trim: 'metal',
    metal: 'metal',
    wood: 'wood',
  },
  5: {
    wall: 'plaster',
    wallAlt: 'concrete',
    floor: 'tile',
    trim: 'wood',
    metal: 'metal',
    wood: 'wood',
  },
  6: {
    wall: 'concrete',
    wallAlt: 'metal',
    floor: 'asphalt',
    trim: 'metal',
    metal: 'metal',
    wood: 'wood',
  },
};

const textureFiles: Record<SurfaceTextureName, string> = {
  plaster: 'materials/cc0/plaster-wall.png',
  concrete: 'materials/cc0/concrete-wall.png',
  brick: 'materials/cc0/brick-wall.png',
  asphalt: 'materials/cc0/asphalt-floor.png',
  tile: 'materials/cc0/tile-floor.png',
  metal: 'materials/cc0/metal.png',
  wood: 'materials/cc0/wood.png',
};

const textureCache = new Map<string, Promise<Texture>>();

function textureUrl(name: SurfaceTextureName): string {
  return `${import.meta.env.BASE_URL}${textureFiles[name]}`;
}

function loadTexture(app: Application, name: SurfaceTextureName): Promise<Texture> {
  const url = textureUrl(name);
  const cached = textureCache.get(url);
  if (cached) return cached;

  const loading = new Promise<Texture>((resolve, reject) => {
    app.assets.loadFromUrl(url, 'texture', (error, asset) => {
      if (error || !asset?.resource) {
        reject(error ?? new Error(`Texture failed to load: ${url}`));
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

function attachTexture(
  material: StandardMaterial | undefined,
  texture: Texture,
  tiling: number,
  tint: Color,
): void {
  if (!material) return;

  material.diffuseMap = texture;
  material.diffuseMapTiling.set(tiling, tiling);
  material.diffuse = tint;
  material.update();
}

function tilingForRole(
  role: keyof SurfaceMaterialSet,
  coarsePointer: boolean,
): number {
  if (role === 'floor') return coarsePointer ? 6 : 9;
  if (role === 'wall' || role === 'wallAlt') return coarsePointer ? 2.8 : 4.2;
  if (role === 'metal') return coarsePointer ? 1.8 : 2.8;
  if (role === 'wood') return coarsePointer ? 2.2 : 3.2;
  return coarsePointer ? 2.2 : 3.2;
}

function tintForRole(role: keyof SurfaceMaterialSet): Color {
  if (role === 'floor') return new Color(0.76, 0.76, 0.76);
  if (role === 'metal') return new Color(0.84, 0.86, 0.88);
  if (role === 'wood') return new Color(0.92, 0.88, 0.82);
  if (role === 'trim') return new Color(0.8, 0.79, 0.76);
  if (role === 'wallAlt') return new Color(0.91, 0.9, 0.86);
  return new Color(0.94, 0.92, 0.86);
}

export async function applyRealSurfaceTextures(
  app: Application,
  materials: SurfaceMaterialSet,
  mapIndex: number,
  coarsePointer: boolean,
): Promise<void> {
  const profile = profiles[mapIndex] ?? profiles[6]!;
  const jobs: Array<{
    role: keyof SurfaceMaterialSet;
    texture: SurfaceTextureName;
  }> = [
    { role: 'wall', texture: profile.wall },
    { role: 'floor', texture: profile.floor },
    { role: 'wallAlt', texture: profile.wallAlt },
    { role: 'trim', texture: profile.trim },
    { role: 'metal', texture: profile.metal },
    { role: 'wood', texture: profile.wood },
  ];

  const decoded = new Set<SurfaceTextureName>();
  const delay = coarsePointer ? 130 : 70;

  for (const job of jobs) {
    const material = materials[job.role];
    if (!material) continue;

    try {
      const texture = await loadTexture(app, job.texture);
      attachTexture(
        material,
        texture,
        tilingForRole(job.role, coarsePointer),
        tintForRole(job.role),
      );
      decoded.add(job.texture);
    } catch (error) {
      console.warn(
        `[Hideverse surfaces] ${job.texture} failed; color fallback retained.`,
        error,
      );
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, delay);
    });
  }

  console.info(
    `[Hideverse surfaces] Map ${mapIndex}: ${decoded.size} lightweight CC0 textures active.`,
  );
}
