import type { Application, Asset, ContainerResource } from 'playcanvas';

export type ContainerAsset = Asset & {
  resource: ContainerResource;
};

export function loadContainer(app: Application, url: string): Promise<ContainerAsset> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(url, 'container', (error, asset) => {
      if (error || !asset) {
        reject(new Error(typeof error === 'string' ? error : `Unable to load ${url}`));
        return;
      }
      resolve(asset as ContainerAsset);
    });
  });
}
