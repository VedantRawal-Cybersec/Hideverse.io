import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const required = ['dist/index.html', 'dist/game/index.html', 'dist/data/asset-summary.json'];

for (const relative of required) {
  await access(path.join(root, relative));
}

const summary = JSON.parse(await readFile(path.join(root, 'dist/data/asset-summary.json'), 'utf8'));
if (!Number.isInteger(summary.acquiredAssets) || summary.acquiredAssets < 1) {
  throw new Error('Live site asset summary is invalid.');
}

console.log(
  `[web:smoke] PASS — site + embedded game + ${summary.acquiredAssets} acquired assets represented.`,
);
