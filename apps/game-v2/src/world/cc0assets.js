import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Curated CC0 geometry used by the LOW refinery presentation.
 *
 * Source: Kenney CC0 game assets, mirrored by shorepine/kenney.
 * We intentionally load only a handful of tiny GLBs and THROW AWAY their
 * authored materials/textures. Their geometry is merged into Hideverse's
 * existing material batches by nuketown.js, so this improves silhouette quality
 * without turning LOW into a multi-material draw-call farm.
 *
 * License evidence:
 *   https://github.com/shorepine/kenney
 *   https://kenney.nl/assets/factory-kit
 *   https://kenney.nl/assets/city-kit-industrial
 */
const ROOT = 'https://raw.githubusercontent.com/shorepine/kenney/main/3d';

export const LOW_CC0_SOURCES = Object.freeze({
  cone: `${ROOT}/factory/cone.glb`,
  machine: `${ROOT}/factory/machine.glb`,
  catwalk: `${ROOT}/factory/catwalk-straight.glb`,
  pipeValve: `${ROOT}/factory/pipe-large-valve.glb`,
  tank: `${ROOT}/city-industrial/detail-tank.glb`,
  chimney: `${ROOT}/city-industrial/chimney-medium.glb`,
  building: `${ROOT}/city-industrial/building-h.glb`,
});

// GLBs in the Kenney mirror can point at a shared colormap. We discard source
// materials anyway, so redirect those image fetches to one 1x1 white PNG.
// This avoids extra HTTP requests and keeps the loader geometry-only.
const WHITE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7mXcAAAAASUVORK5CYII=';

let _promise = null;

function stripToRenderAttrs(g) {
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  return g;
}

function flattenScene(root) {
  root.updateMatrixWorld(true);
  const pieces = [];

  root.traverse((o) => {
    if (!o?.isMesh || !o.geometry?.getAttribute?.('position')) return;

    let g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (!g.getAttribute('normal')) g.computeVertexNormals();

    // Mixed indexed/non-indexed input cannot be merged reliably. Kenney models
    // are small enough that making every part non-indexed is still cheap.
    if (g.index) {
      const ng = g.toNonIndexed();
      g.dispose();
      g = ng;
    }
    stripToRenderAttrs(g);
    pieces.push(g);
  });

  if (!pieces.length) return null;
  const merged = mergeGeometries(pieces, false);
  for (const g of pieces) if (g !== merged) g.dispose();
  if (!merged) return null;

  // Normalise every source model into a 1 m max-dimension, ground-centred
  // prototype. Nuketown controls final size with one uniform matrix scale.
  merged.computeBoundingBox();
  const bb = merged.boundingBox;
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  bb.getSize(size);
  bb.getCenter(centre);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-5);
  merged.translate(-centre.x, -bb.min.y, -centre.z);
  merged.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function timeout(promise, ms) {
  let id;
  const timer = new Promise((_, reject) => {
    id = setTimeout(() => reject(new Error('CC0 asset timeout')), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(id));
}

export async function loadLowIndustrialAssets({ timeoutMs = 2600 } = {}) {
  if (_promise) return _promise;

  _promise = (async () => {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) =>
      /(?:^|\/)Textures\/colormap\.png(?:\?|$)/i.test(url) ? WHITE_PNG : url
    );
    const loader = new GLTFLoader(manager);
    loader.crossOrigin = 'anonymous';

    const entries = await Promise.all(
      Object.entries(LOW_CC0_SOURCES).map(async ([key, url]) => {
        try {
          const gltf = await timeout(loader.loadAsync(url), timeoutMs);
          const geo = flattenScene(gltf.scene);
          if (!geo) throw new Error('no mesh geometry');
          return [key, geo];
        } catch (err) {
          console.warn(`[world] optional CC0 asset "${key}" unavailable:`, err?.message ?? err);
          return [key, null];
        }
      })
    );

    const assets = Object.fromEntries(entries);
    const loaded = entries.filter(([, g]) => !!g).length;
    console.info(`[world] CC0 LOW refinery geometry: ${loaded}/${entries.length} assets ready`);
    return assets;
  })();

  return _promise;
}
