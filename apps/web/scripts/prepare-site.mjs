import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const here = path.resolve(import.meta.dirname, '..');
const root = path.resolve(here, '../..');
const manifest = JSON.parse(await readFile(path.join(root, 'assets/manifest.json'), 'utf8'));

const acquired = manifest.assets.filter((asset) => asset.status === 'acquired');
const candidates = manifest.assets.filter((asset) => asset.status === 'candidate');
const runtimeFiles = [...new Set(acquired.flatMap((asset) => asset.localFiles))];
const sources = acquired.reduce((acc, asset) => {
  acc[asset.source] = (acc[asset.source] ?? 0) + 1;
  return acc;
}, {});

const ravenwood = manifest.assets.find((asset) => asset.id === 'ravenwood-victorian-house-source');

const output = {
  acquiredAssets: acquired.length,
  candidateAssets: candidates.length,
  runtimeFiles: runtimeFiles.length,
  sources,
  ravenwood: ravenwood
    ? {
        status: ravenwood.status,
        source: ravenwood.source,
        sourceTriangles: ravenwood.sourceStats?.triangles ?? null,
        runtimeTriangles: ravenwood.runtimeStats?.triangles ?? null,
        runtimeBytes: ravenwood.runtimeStats?.bytes ?? null,
        targetTriangles: ravenwood.targetTriangleBudget ?? null,
        targetBytes: ravenwood.targetRuntimeBytes ?? null,
      }
    : null,
  generatedAt: new Date().toISOString(),
};

const directory = path.join(here, 'public/data');
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'asset-summary.json'), JSON.stringify(output, null, 2) + '\n');
console.log('[web:prepare] asset + Ravenwood summary generated');
