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

  const bindings = [
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
  ] satisfies SurfaceBinding[];

  const activeBindings = bindings.filter((binding) => Boolean(binding.material));

  // Pass 1: tiny preview color maps. This immediately removes flat-color blockout surfaces
  // without delaying map boot or causing a large GPU upload spike.
  await Promise.all(
    activeBindings.map(async (binding) => {
      const preview = await loadTexture(
        app,
        referenceTextureUrl(binding.surface),
        anisotropy,
      );
      attachBaseTexture(binding.material, preview, binding.tiling, binding.tint);
    }),
  );

  const quality = localStorage.getItem('hideverse-quality') ?? 'auto';
  const fullPbr =
    !coarsePointer && (quality === 'balanced' || quality === 'high');

  await delay(coarsePointer ? 700 : 420);

  // Pass 2A: upgrade every visible surface to the compressed full-detail color map in parallel.
  // Color is the most noticeable realism improvement and remains cheap at render time.
  await Promise.all(
    activeBindings.map(async (binding) => {
      try {
        const color = await loadTexture(
          app,
          pbrTextureUrl(binding.surface, 'color'),
          anisotropy,
        );
        applyPbrMaps(binding.material, color, null, null, binding);
      } catch (error) {
        console.warn(
          `[Hideverse surfaces] Detailed color skipped for ${binding.surface}; keeping preview.`,
          error,
        );
      }
    }),
  );

  if (!fullPbr) return;

  await delay(650);

  // Pass 2B: Balanced / High desktop gains normal + roughness one shared material at a time.
  // These uploads are staggered so they never arrive as one large frame-time spike.
  for (const binding of activeBindings) {
    try {
      const [normal, roughness] = await Promise.all([
        loadTexture(app, pbrTextureUrl(binding.surface, 'normal'), anisotropy),
        loadTexture(app, pbrTextureUrl(binding.surface, 'roughness'), anisotropy),
      ]);

      const color = await loadTexture(
        app,
        pbrTextureUrl(binding.surface, 'color'),
        anisotropy,
      );
      applyPbrMaps(binding.material, color, normal, roughness, binding);
    } catch (error) {
      console.warn(
        `[Hideverse surfaces] Normal/roughness upgrade skipped for ${binding.surface}.`,
        error,
      );
    }

    await delay(140);
  }
}
