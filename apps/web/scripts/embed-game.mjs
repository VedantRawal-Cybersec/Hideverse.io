import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const here = path.resolve(import.meta.dirname, '..');
const gameDist = path.resolve(here, '../game/dist');
const destination = path.join(here, 'dist/game');

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
