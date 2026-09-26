import type { Application, Asset } from 'playcanvas';

export function loadContainer(app: Application, url: string): Promise<Asset> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(url, 'container', (error, asset) => {
      if (error || !asset) {
        reject(new Error(typeof error === 'string' ? error : `Unable to load ${url}`));
        return;
      }
      resolve(asset);
    });
  });
}
