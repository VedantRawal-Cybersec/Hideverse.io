import {
  ADDRESS_REPEAT,
  Application,
  Color,
  StandardMaterial,
  Texture,
} from 'playcanvas';

type SurfaceTextureName = 'concrete' | 'brick' | 'asphalt' | 'metal' | 'wood';
type PbrChannel = 'color' | 'normal' | 'roughness';

export type SurfaceMaterialSet = {
  wall?: StandardMaterial;
  wallAlt?: StandardMaterial;
  floor?: StandardMaterial;
  trim?: StandardMaterial;
  metal?: StandardMaterial;
  wood?: StandardMaterial;
};

type SurfaceBinding = {
  material?: StandardMaterial;
  surface: SurfaceTextureName;
  tiling: number;
  tint: Color;
  bumpiness: number;
};

const textureCache = new Map<string, Promise<Texture>>();

function referenceTextureUrl(name: SurfaceTextureName): string {
  return `${import.meta.env.BASE_URL}materials/reference/${name}.png`;
}

function pbrTextureUrl(name: SurfaceTextureName, channel: PbrChannel): string {
  return `${import.meta.env.BASE_URL}materials/pbr/${name}-${channel}.ktx2`;
}

function loadTexture(app: Application, url: string, anisotropy: number): Promise<Texture> {
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
      texture.anisotropy = anisotropy;
      resolve(texture);
    });
  });

  textureCache.set(url, loading);
  return loading;
}

function configureTiling(material: StandardMaterial, tiling: number): void {
  material.diffuseMapTiling.set(tiling, tiling);
  material.normalMapTiling.set(tiling, tiling);
  material.glossMapTiling.set(tiling, tiling);
}

function attachBaseTexture(
  material: StandardMaterial | undefined,
  texture: Texture,
  tiling: number,
  tint: Color,
): void {
  if (!material) return;
  material.diffuseMap = texture;
  configureTiling(material, tiling);
  material.diffuse = tint;
  material.update();
}

function applyPbrMaps(
  material: StandardMaterial | undefined,
  color: Texture,
  normal: Texture | null,
  roughness: Texture | null,
  binding: SurfaceBinding,
): void {
  if (!material) return;

  material.diffuseMap = color;
  material.diffuse = binding.tint;
  configureTiling(material, binding.tiling);

  if (normal) {
    material.normalMap = normal;
    material.bumpiness = binding.bumpiness;
  }

  if (roughness) {
    material.glossMap = roughness;
    material.glossMapChannel = 'r';
    material.glossInvert = true;
    material.gloss = 1;
  }

  material.update();
}

function wallTextureForMap(mapIndex: number): SurfaceTextureName {
  if (mapIndex === 1 || mapIndex === 5) return 'wood';
  if (mapIndex === 2 || mapIndex === 3) return 'brick';
  return 'concrete';
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function applyRealSurfaceTextures(
  app: Application,
  materials: SurfaceMaterialSet,
  mapIndex: number,
  coarsePointer: boolean,
): Promise<void> {
  const wallName = wallTextureForMap(mapIndex);
  const wallTiling = coarsePointer ? 2.35 : 3.25;
  const detailTiling = coarsePointer ? 2.1 : 3;
  const floorTiling = coarsePointer ? 5.2 : 7.4;
  const anisotropy = coarsePointer ? 2 : 4;

  const bindings: SurfaceBinding[] = [
    {
      material: materials.wall,
      surface: wallName,
      tiling: wallTiling,
      tint: new Color(0.94, 0.92, 0.88),
      bumpiness: 0.38,
    },
    {
      material: materials.wallAlt,
      surface: mapIndex === 4 || mapIndex === 6 ? 'concrete' : 'brick',
      tiling: detailTiling,
      tint: new Color(0.9, 0.89, 0.86),
      bumpiness: 0.44,
    },
    {
      material: materials.floor,
      surface: 'asphalt',
      tiling: floorTiling,
      tint: new Color(0.7, 0.7, 0.68),
      bumpiness: 0.34,
    },
    {
      material: materials.trim,
      surface: 'concrete',
      tiling: detailTiling,
      tint: new Color(0.76, 0.75, 0.72),
      bumpiness: 0.25,
    },
    {
      material: materials.metal,
      surface: 'metal',
      tiling: coarsePointer ? 1.7 : 2.6,
      tint: new Color(0.84, 0.85, 0.86),
      bumpiness: 0.28,
    },
    {
      material: materials.wood,
      surface: 'wood',
      tiling: coarsePointer ? 2 : 2.8,
      tint: new Color(0.9, 0.86, 0.8),
      bumpiness: 0.32,
    },
  ].filter((binding) => Boolean(binding.material));

  // Pass 1: tiny preview color maps. This immediately removes flat-color blockout surfaces
  // without delaying map boot or causing a large GPU upload spike.
  await Promise.all(
    bindings.map(async (binding) => {
      const preview = await loadTexture(
        app,
        referenceTextureUrl(binding.surface),
        anisotropy,
      );
      attachBaseTexture(binding.material, preview, binding.tiling, binding.tint);
    }),
  );

  const quality = localStorage.getItem('hideverse-quality') ?? 'auto';

  // Mobile / Low remains texture-real but intentionally skips extra PBR maps.
  // This is the main smoothness guardrail.
  if (coarsePointer || quality === 'low') return;

  await delay(450);

  // Pass 2: stream compressed KTX2 PBR maps sequentially. Shared materials mean each
  // upload upgrades many walls/props at once while avoiding a one-frame upload spike.
  for (const binding of bindings) {
    try {
      const color = await loadTexture(
        app,
        pbrTextureUrl(binding.surface, 'color'),
        anisotropy,
      );

      await delay(45);

      const [normal, roughness] = await Promise.all([
        loadTexture(app, pbrTextureUrl(binding.surface, 'normal'), anisotropy),
        loadTexture(app, pbrTextureUrl(binding.surface, 'roughness'), anisotropy),
      ]);

      applyPbrMaps(binding.material, color, normal, roughness, binding);
    } catch (error) {
      console.warn(
        `[Hideverse surfaces] PBR upgrade skipped for ${binding.surface}; keeping lightweight texture.`,
        error,
      );
    }

    await delay(85);
  }
}
