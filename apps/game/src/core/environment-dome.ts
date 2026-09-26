import {
  Application,
  CULLFACE_FRONT,
  Color,
  Entity,
  StandardMaterial,
} from 'playcanvas';
import type { Texture } from 'playcanvas';

function loadTexture(app: Application, path: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(`${import.meta.env.BASE_URL}${path}`, 'texture', (error, asset) => {
      if (error || !asset?.resource) {
        reject(new Error(typeof error === 'string' ? error : `Unable to load ${path}`));
        return;
      }
      resolve(asset.resource as Texture);
    });
  });
}

export async function addEnvironmentDome(
  app: Application,
  coarsePointer: boolean,
): Promise<Entity | null> {
  if (coarsePointer) return null;

  try {
    const texture = await loadTexture(app, 'environment/khronos/neutral.jpg');
    const material = new StandardMaterial();
    material.useLighting = false;
    material.diffuse = Color.WHITE;
    material.diffuseMap = texture;
    material.emissive = new Color(0.72, 0.74, 0.78);
    material.emissiveMap = texture;
    material.cull = CULLFACE_FRONT;
    material.depthWrite = false;
    material.update();

    const dome = new Entity('Khronos Environment Dome');
    dome.addComponent('render', { type: 'sphere' });
    dome.setLocalScale(210, 210, 210);
    if (dome.render) {
      dome.render.material = material;
      dome.render.castShadows = false;
      dome.render.receiveShadows = false;
    }
    app.root.addChild(dome);
    return dome;
  } catch (error) {
    console.warn('[Hideverse graphics] Environment panorama unavailable.', error);
    return null;
  }
}
