import rawCatalog from './map-data.json';

export type Triplet = [number, number, number];

export type MapBox = {
  id: string;
  position: Triplet;
  size: Triplet;
  decorative?: boolean;
};

export type DoorDefinition = {
  id: string;
  label: string;
  position: Triplet;
  size: Triplet;
  radius: number;
  blocking: boolean;
};

export type InteractionPoint = {
  id: string;
  label: string;
  position: Triplet;
  radius: number;
};

export type ObjectiveDefinition = InteractionPoint & {
  action: string;
};

export type NavNode = {
  id: string;
  label: string;
  position: Triplet;
};

export type ActorRole =
  | 'hider'
  | 'seeker'
  | 'guard'
  | 'civilian'
  | 'mimic'
  | 'monster'
  | 'traitor';

export type ActorSpawn = {
  id: string;
  role: ActorRole;
  position: Triplet;
  patrol: string[];
};

export type MapDefinition = {
  id: string;
  index: number;
  name: string;
  mode: {
    id: string;
    name: string;
    summary: string;
    success: string;
  };
  worldBounds: {
    min: Triplet;
    max: Triplet;
  };
  spawn: Triplet;
  lighting: {
    ambient: Triplet;
    sun: Triplet;
    fill: Triplet;
    clear: Triplet;
    sunIntensity: number;
    fillIntensity: number;
    sunAngles: Triplet;
    fillAngles: Triplet;
  };
  structures: MapBox[];
  props: MapBox[];
  doors: DoorDefinition[];
  hidingSpots: InteractionPoint[];
  objectives: ObjectiveDefinition[];
  navNodes: NavNode[];
  actorSpawns: ActorSpawn[];
  lod: {
    mobileObjectBudget: number;
    desktopObjectBudget: number;
    shadowDistance: number;
  };
};

type Catalog = {
  version: number;
  maps: MapDefinition[];
};

const catalog = rawCatalog as unknown as Catalog;

export const hideverseMaps = catalog.maps;

export function getMapById(id: string | null): MapDefinition {
  return hideverseMaps.find((map) => map.id === id) ?? hideverseMaps[0]!;
}

export function selectedMapFromLocation(): MapDefinition {
  const query = new URLSearchParams(window.location.search);
  return getMapById(query.get('map'));
}

export function pointInsideMap(
  map: MapDefinition,
  point: { x: number; y: number; z: number },
): boolean {
  const { min, max } = map.worldBounds;
  return (
    point.x >= min[0] &&
    point.x <= max[0] &&
    point.y >= min[1] &&
    point.y <= max[1] &&
    point.z >= min[2] &&
    point.z <= max[2]
  );
}

export function nearestAreaLabel(
  map: MapDefinition,
  point: { x: number; y: number; z: number },
): string {
  let nearest = map.navNodes[0]!;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const node of map.navNodes) {
    const dx = point.x - node.position[0];
    const dy = point.y - node.position[1];
    const dz = point.z - node.position[2];
    const distance = dx * dx + dy * dy + dz * dz;
    if (distance < nearestDistance) {
      nearest = node;
      nearestDistance = distance;
    }
  }

  return nearest.label;
}
