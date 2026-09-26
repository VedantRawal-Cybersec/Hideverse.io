import { ADDRESS_REPEAT, Application, Color, StandardMaterial, Texture } from 'playcanvas';

type SurfaceTextureName = 'concrete' | 'brick' | 'asphalt' | 'metal' | 'wood';

export type SurfaceMaterialSet = {
  wall?: StandardMaterial;
  wallAlt?: StandardMaterial;
  floor?: StandardMaterial;
  trim?: StandardMaterial;
  metal?: StandardMaterial;
  wood?: StandardMaterial;
};

const textureCache = new Map<string, Promise<Texture>>();

function textureUrl(name: SurfaceTextureName): string {
  return `${import.meta.env.BASE_URL}materials/reference/${name}.png`;
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
  tint = new Color(0.96, 0.96, 0.96),
): void {
  if (!material) return;
  material.diffuseMap = texture;
  material.diffuseMapTiling.set(tiling, tiling);
  material.diffuse = tint;
  material.update();
}

function wallTextureForMap(mapIndex: number): SurfaceTextureName {
  if (mapIndex === 1 || mapIndex === 5) return 'wood';
  if (mapIndex === 2 || mapIndex === 3) return 'brick';
  return 'concrete';
}

export async function applyRealSurfaceTextures(
  app: Application,
  materials: SurfaceMaterialSet,
  mapIndex: number,
  coarsePointer: boolean,
): Promise<void> {
  const wallName = wallTextureForMap(mapIndex);

  const [wall, concrete, brick, asphalt, metal, wood] = await Promise.all([
    loadTexture(app, wallName),
    loadTexture(app, 'concrete'),
    loadTexture(app, 'brick'),
    loadTexture(app, 'asphalt'),
    loadTexture(app, 'metal'),
    loadTexture(app, 'wood'),
  ]);

  const wallTiling = coarsePointer ? 2.4 : 3.4;
  const detailTiling = coarsePointer ? 2.2 : 3.2;
  const floorTiling = coarsePointer ? 5.5 : 8;

  attachTexture(materials.wall, wall, wallTiling);
  attachTexture(
    materials.wallAlt,
    mapIndex === 4 || mapIndex === 6 ? concrete : brick,
    detailTiling,
  );
  attachTexture(materials.floor, asphalt, floorTiling, new Color(0.74, 0.74, 0.74));
  attachTexture(materials.trim, concrete, detailTiling, new Color(0.72, 0.72, 0.72));
  attachTexture(materials.metal, metal, coarsePointer ? 1.8 : 2.8, new Color(0.82, 0.84, 0.86));
  attachTexture(materials.wood, wood, coarsePointer ? 2.1 : 3, new Color(0.9, 0.86, 0.8));
}
