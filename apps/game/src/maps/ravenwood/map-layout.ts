export type RavenwoodPoint = {
  x: number;
  y: number;
  z: number;
};

export type RavenwoodZone = {
  id: string;
  label: string;
  min: RavenwoodPoint;
  max: RavenwoodPoint;
  priority: number;
};

export type RavenwoodHidingSpot = {
  id: string;
  label: string;
  position: RavenwoodPoint;
  radius: number;
};

export const ravenwoodZones: RavenwoodZone[] = [
  {
    id: 'attic',
    label: 'Attic',
    min: { x: -6.2, y: 6.8, z: -2.0 },
    max: { x: 4.2, y: 12.5, z: 7.2 },
    priority: 50,
  },
  {
    id: 'upper-floor',
    label: 'Upper Floor',
    min: { x: -10.8, y: 3.55, z: -6.3 },
    max: { x: 8.0, y: 6.8, z: 10.8 },
    priority: 40,
  },
  {
    id: 'garage',
    label: 'Garage',
    min: { x: -12.3, y: -0.1, z: -2.6 },
    max: { x: -8.2, y: 3.55, z: 4.1 },
    priority: 45,
  },
  {
    id: 'ground-floor',
    label: 'Ground Floor',
    min: { x: -10.8, y: -0.2, z: -6.3 },
    max: { x: 8.0, y: 3.55, z: 10.8 },
    priority: 30,
  },
  {
    id: 'rear-deck',
    label: 'Rear Deck',
    min: { x: -10.6, y: -0.4, z: 7.0 },
    max: { x: 0.2, y: 2.5, z: 13.1 },
    priority: 25,
  },
  {
    id: 'estate',
    label: 'Ravenwood Estate',
    min: { x: -60, y: -4, z: -60 },
    max: { x: 60, y: 20, z: 60 },
    priority: 1,
  },
];

export const ravenwoodHidingSpots: RavenwoodHidingSpot[] = [
  {
    id: 'under-main-stairs',
    label: 'Under the main stairs',
    position: { x: 1.55, y: 2.0, z: 3.1 },
    radius: 1.65,
  },
  {
    id: 'garage-alcove',
    label: 'Garage alcove',
    position: { x: -9.8, y: 1.35, z: 0.65 },
    radius: 1.8,
  },
  {
    id: 'upper-shower-nook',
    label: 'Upper bathroom nook',
    position: { x: -9.0, y: 4.15, z: -1.05 },
    radius: 1.5,
  },
  {
    id: 'attic-corner',
    label: 'Attic corner',
    position: { x: -0.9, y: 7.35, z: 2.2 },
    radius: 1.8,
  },
  {
    id: 'rear-deck-cover',
    label: 'Rear deck cover',
    position: { x: -5.15, y: 1.0, z: 8.35 },
    radius: 1.9,
  },
];

export function ravenwoodZoneAt(position: RavenwoodPoint): RavenwoodZone {
  const candidates = ravenwoodZones
    .filter(
      (zone) =>
        position.x >= zone.min.x &&
        position.x <= zone.max.x &&
        position.y >= zone.min.y &&
        position.y <= zone.max.y &&
        position.z >= zone.min.z &&
        position.z <= zone.max.z,
    )
    .sort((a, b) => b.priority - a.priority);

  return candidates[0] ?? ravenwoodZones[ravenwoodZones.length - 1]!;
}
