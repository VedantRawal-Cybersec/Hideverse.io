import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');

await access(indexPath);
const index = await readFile(indexPath, 'utf8');
if (!index.includes('<script') || !index.includes('assets/')) {
  throw new Error('Production index.html does not reference bundled assets.');
}

const assetDir = path.join(dist, 'assets');
const files = await readdir(assetDir);
const jsFiles = files.filter((file) => file.endsWith('.js'));
if (jsFiles.length === 0) {
  throw new Error('No JavaScript bundle was produced.');
}

let jsBytes = 0;
for (const file of jsFiles) {
  jsBytes += (await stat(path.join(assetDir, file))).size;
}

const requiredRuntimeAssets = [
  path.join(dist, 'ravenwood/nature/kenney/tree_oak.glb'),
  path.join(dist, 'ravenwood/furniture/kaykit/chair_A.gltf'),
  path.join(dist, 'ravenwood/architecture/kaykit-dungeon/wall_doorway.glb'),
  path.join(dist, 'ravenwood/exterior/kaykit-city/streetlight.gltf'),
];

for (const required of requiredRuntimeAssets) {
  await access(required);
}

console.log(
  `[verify-build] PASS — ${jsFiles.length} JS bundle(s), ${jsBytes} JS bytes, ${requiredRuntimeAssets.length} representative runtime assets present.`,
);
