import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const manifestPath = path.join(root, 'assets/manifest.json');
const outputPath = path.join(root, 'assets/runtime/ravenwood/map/ravenwood_mansion_victorian.glb');
const metadataPath = path.join(
  root,
  'assets/runtime/ravenwood/map/ravenwood_mansion_victorian.meta.json',
);

const bytes = await readFile(outputPath);
const info = await stat(outputPath);

if (bytes.length < 20) throw new Error('Ravenwood GLB is unexpectedly small.');
if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error('Ravenwood output is not GLB.');
if (bytes.readUInt32LE(4) !== 2) throw new Error('Ravenwood GLB must use glTF 2.0.');

const jsonLength = bytes.readUInt32LE(12);
const jsonType = bytes.readUInt32LE(16);
if (jsonType !== 0x4e4f534a) throw new Error('Ravenwood GLB JSON chunk is missing.');

const json = JSON.parse(
  bytes
    .subarray(20, 20 + jsonLength)
    .toString('utf8')
    .trim(),
);
let triangles = 0;
let primitives = 0;

for (const mesh of json.meshes ?? []) {
  for (const primitive of mesh.primitives ?? []) {
    if ((primitive.mode ?? 4) !== 4) continue;
    primitives += 1;
    const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
    const accessor = json.accessors?.[accessorIndex];
    if (!accessor) throw new Error('Ravenwood primitive references a missing accessor.');
    triangles += Math.floor(accessor.count / 3);
  }
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const asset = manifest.assets.find((item) => item.id === 'ravenwood-victorian-house-source');
if (!asset) throw new Error('Ravenwood source asset entry is missing.');

const targetTriangles = asset.targetTriangleBudget ?? 400000;
const targetBytes = asset.targetRuntimeBytes ?? 20000000;

if (triangles > targetTriangles) {
  throw new Error(`Ravenwood GLB has ${triangles} triangles; budget is ${targetTriangles}.`);
}
if (info.size > targetBytes) {
  throw new Error(`Ravenwood GLB is ${info.size} bytes; budget is ${targetBytes}.`);
}

asset.status = 'acquired';
asset.localFiles = [
  'assets/runtime/ravenwood/map/ravenwood_mansion_victorian.glb',
  'assets/runtime/ravenwood/map/ravenwood_mansion_victorian.meta.json',
];
asset.maxRuntimeFileBytes = targetBytes;
asset.runtimeStats = {
  triangles,
  primitives,
  meshes: json.meshes?.length ?? 0,
  materials: json.materials?.length ?? 0,
  nodes: json.nodes?.length ?? 0,
  bytes: info.size,
};
asset.localModifications = [
  'Welded source geometry before simplification.',
  'Simplified source meshes for browser/mobile runtime use.',
  'Preserved scene hierarchy by disabling optimize flatten/join.',
  'Quantized geometry and compressed textures for web delivery.',
];

const metadata = {
  id: 'ravenwood-victorian-house-source',
  generatedFrom: {
    repository: asset.sourceRepo,
    commit: asset.sourceCommit,
    path: asset.sourcePath,
    license: asset.license,
  },
  runtimeStats: asset.runtimeStats,
  targets: {
    triangles: targetTriangles,
    bytes: targetBytes,
  },
};

await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(
  `[ravenwood:promote] PASS — ${triangles} triangles, ${info.size} bytes, ${primitives} primitives.`,
);
