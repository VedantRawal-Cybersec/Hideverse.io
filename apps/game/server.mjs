import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
const port = Number.parseInt(process.env.PORT ?? '4173', 10);

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.wasm', 'application/wasm'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
  ['.ktx2', 'image/ktx2'],
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const requested = decoded === '/' ? '/index.html' : decoded;
  const resolved = path.resolve(dist, `.${requested}`);
  if (!resolved.startsWith(`${dist}${path.sep}`) && resolved !== path.join(dist, 'index.html')) {
    return null;
  }
  return resolved;
}

async function serveFile(res, filePath) {
  const data = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mime.get(ext) ?? 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  res.end(data);
}

const server = createServer(async (req, res) => {
  try {
    const requestedPath = safePath(req.url ?? '/');
    if (!requestedPath) {
      res.writeHead(400).end('Bad request');
      return;
    }

    let filePath = requestedPath;
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error('not a file');
    } catch {
      filePath = path.join(dist, 'index.html');
    }

    await serveFile(res, filePath);
  } catch (error) {
    console.error('[Hideverse server]', error);
    res.writeHead(500).end('Internal server error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[Hideverse] production server listening on :${port}`);
});
