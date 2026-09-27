import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const here = path.resolve(import.meta.dirname, '..');
const gameDist = path.resolve(here, '../game/dist');
const gameV2Dist = path.resolve(here, '../game-v2/dist');
const destination = path.join(here, 'dist/game');
const v2Destination = path.join(here, 'dist/game-v2');

try {
  const info = await stat(gameDist);
  if (!info.isDirectory()) throw new Error('not a directory');
} catch {
  throw new Error('Game production build is missing. Build @hideverse/game before @hideverse/web.');
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(gameDist, destination, { recursive: true });
console.log('[web:embed] current game build copied to /game/');

try {
  const info = await stat(gameV2Dist);
  if (!info.isDirectory()) throw new Error('not a directory');
} catch {
  throw new Error(
    'Game V2 production build is missing. Build @hideverse/game-v2 before @hideverse/web.',
  );
}
await rm(v2Destination, { recursive: true, force: true });
await mkdir(v2Destination, { recursive: true });
await cp(gameV2Dist, v2Destination, { recursive: true });
console.log('[web:embed] Hideverse Game V2 copied to /game-v2/');
