import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const manifest = JSON.parse(
  await readFile(new URL('../../assets/manifest.json', import.meta.url), 'utf8'),
);
const acquired = manifest.assets.filter((asset) => asset.status === 'acquired');
const files = [...new Set(acquired.flatMap((asset) => asset.localFiles))];
let bytes = 0;
const errors = [];

for (const relative of files) {
  const info = await stat(path.resolve(process.cwd(), relative));
  bytes += info.size;
  if (info.size > manifest.policy.maxRuntimeFileBytes) {
    errors.push(`${relative}: ${info.size} bytes exceeds ${manifest.policy.maxRuntimeFileBytes}`);
  }
}

const bySource = acquired.reduce((acc, asset) => {
  acc[asset.source] = (acc[asset.source] ?? 0) + 1;
  return acc;
}, {});

console.log(
  JSON.stringify(
    {
      acquiredAssets: acquired.length,
      candidateAssets: manifest.assets.filter((asset) => asset.status === 'candidate').length,
      uniqueRuntimeFiles: files.length,
      totalRuntimeBytes: bytes,
      bySource,
    },
    null,
    2,
  ),
);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
