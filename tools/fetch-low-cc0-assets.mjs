import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Vendor the tiny CC0 industrial geometry set used by V2 LOW.
 *
 * Source: Kenney CC0 packs mirrored at shorepine/kenney.
 * The game discards source materials/textures and merges the geometry into
 * Hideverse's existing LOW material batches, so these files improve silhouette
 * quality without creating a large material/draw-call tax.
 */

const ROOT = 'https://raw.githubusercontent.com/shorepine/kenney/main/3d';
const SURFACE_ROOT =
  'https://raw.githubusercontent.com/petroulacl/fps-buildings-env-kit/main/environment/ground-textures/ambientcg';

const SURFACE_TEXTURES = Object.freeze([
  ['Asphalt021_2K-JPG/Asphalt021.png', 'asphalt.png'],
  ['Concrete012_2K-JPG/Concrete012.png', 'concrete.png'],
  ['Bricks066_2K-JPG/Bricks066.png', 'brick.png'],
  ['Metal063_2K-JPG/Metal063.png', 'metal.png'],
  ['Road001_2K-JPG/Road001.png', 'road.png'],
]);

const ASSETS = Object.freeze([
  ['factory/cone.glb', 'cone.glb'],
  ['factory/machine.glb', 'machine.glb'],
  ['factory/machine-window.glb', 'machine-window.glb'],
  ['factory/catwalk-straight.glb', 'catwalk-straight.glb'],
  ['factory/catwalk-stairs.glb', 'catwalk-stairs.glb'],
  ['factory/catwalk-corner.glb', 'catwalk-corner.glb'],
  ['factory/machine-fortified.glb', 'machine-fortified.glb'],
  ['factory/pipe-large-cross.glb', 'pipe-large-cross.glb'],
  ['factory/pipe-large-junction.glb', 'pipe-large-junction.glb'],
  ['factory/door-wide-closed.glb', 'door-wide-closed.glb'],
  ['factory/conveyor-bars-stripe-fence.glb', 'conveyor-bars-stripe-fence.glb'],
  ['factory/door.glb', 'door.glb'],
  ['factory/pipe-large-valve.glb', 'pipe-large-valve.glb'],
  ['factory/pipe-large-long.glb', 'pipe-large-long.glb'],
  ['factory/pipe-large-bend.glb', 'pipe-large-bend.glb'],
  ['factory/conveyor-long-stripe-sides.glb', 'conveyor-long-stripe-sides.glb'],
  ['city-industrial/detail-tank.glb', 'detail-tank.glb'],
  ['city-industrial/chimney-medium.glb', 'chimney-medium.glb'],
  ['city-industrial/chimney-large.glb', 'chimney-large.glb'],
  ['city-industrial/building-h.glb', 'building-h.glb'],
  ['city-industrial/building-k.glb', 'building-k.glb'],
]);

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'apps', 'game-v2', 'public', 'models', 'cc0-industrial');
const texDir = join(here, '..', 'apps', 'game-v2', 'public', 'textures', 'cc0-low');

async function fetchWithRetry(url, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'user-agent': 'Hideverse-Build/1.0' },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      last = err;
      if (i + 1 < attempts) await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

await mkdir(outDir, { recursive: true });
await mkdir(texDir, { recursive: true });

let ok = 0;
const failed = [];
for (const [src, name] of ASSETS) {
  const url = `${ROOT}/${src}`;
  try {
    const bytes = await fetchWithRetry(url);
    await writeFile(join(outDir, name), bytes);
    ok++;
    console.log(`[cc0] ${name} ${bytes.byteLength} bytes`);
  } catch (err) {
    failed.push(name);
    console.warn(`[cc0] failed ${name}: ${err?.message ?? err}`);
  }
}

console.log(`[cc0] vendored ${ok}/${ASSETS.length} LOW industrial models`);
if (ok === 0) {
  console.warn('[cc0] no local models downloaded; runtime remote fallback remains available');
}

let texOk = 0;
const texFailed = [];
for (const [src, name] of SURFACE_TEXTURES) {
  const url = `${SURFACE_ROOT}/${src}`;
  try {
    const bytes = await fetchWithRetry(url);
    await writeFile(join(texDir, name), bytes);
    texOk++;
    console.log(`[cc0] surface ${name} ${bytes.byteLength} bytes`);
  } catch (err) {
    texFailed.push(name);
    console.warn(`[cc0] failed surface ${name}: ${err?.message ?? err}`);
  }
}
console.log(`[cc0] vendored ${texOk}/${SURFACE_TEXTURES.length} LOW surface maps`);

await writeFile(
  join(texDir, 'README.txt'),
  [
    'Hideverse V2 LOW surface diffuse cache',
    'Source bundle: petroulacl/fps-buildings-env-kit',
    'Original assets: ambientCG',
    'License: CC0 1.0',
    'Only low-cost color previews are used; no normal/AO/displacement maps.',
    texFailed.length ? `Missing this build: ${texFailed.join(', ')}` : 'All curated maps present.',
    '',
  ].join('\n')
);

await writeFile(
  join(outDir, 'README.txt'),
  [
    'Hideverse V2 LOW industrial model cache',
    'Source: Kenney Factory Kit + City Kit - Industrial',
    'License: CC0 1.0',
    'Mirror: https://github.com/shorepine/kenney',
    'Materials/textures are discarded at runtime; geometry only.',
    failed.length ? `Missing this build: ${failed.join(', ')}` : 'All curated models present.',
    '',
  ].join('\n')
);
