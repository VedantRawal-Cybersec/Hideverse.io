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

const fileBudgets = new Map();
for (const asset of acquired) {
  const budget = asset.maxRuntimeFileBytes ?? manifest.policy.maxRuntimeFileBytes;
  for (const file of asset.localFiles) {
    const current = fileBudgets.get(file);
    fileBudgets.set(file, current === undefined ? budget : Math.max(current, budget));
  }
}

for (const relative of files) {
  const info = await stat(path.resolve(process.cwd(), relative));
  bytes += info.size;
  const budget = fileBudgets.get(relative) ?? manifest.policy.maxRuntimeFileBytes;
  if (info.size > budget) {
    errors.push(`${relative}: ${info.size} bytes exceeds ${budget}`);
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
