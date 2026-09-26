import { Color, StandardMaterial } from 'playcanvas';
import type { Triplet } from '../maps/map-catalog';

export type ReferenceMaterialRole =
  | 'wall'
  | 'wall-alt'
  | 'floor'
  | 'trim'
  | 'metal'
  | 'accent'
  | 'foliage'
  | 'wood';

export const referenceScene = {
  sky: [0.49, 0.68, 0.82] as Triplet,
  ambient: [0.43, 0.45, 0.46] as Triplet,
  sun: [1, 0.9, 0.72] as Triplet,
  fill: [0.58, 0.7, 0.92] as Triplet,
  fog: [0.52, 0.66, 0.76] as Triplet,
  sunIntensity: 2.05,
  fillIntensity: 0.24,
  sunAngles: [57, -34, 0] as Triplet,
  fillAngles: [24, 142, 0] as Triplet,
};

const colors: Record<ReferenceMaterialRole, Triplet> = {
  wall: [0.72, 0.66, 0.55],
  'wall-alt': [0.58, 0.59, 0.56],
  floor: [0.18, 0.19, 0.19],
  trim: [0.34, 0.32, 0.28],
  metal: [0.34, 0.4, 0.43],
  accent: [0.48, 0.56, 0.46],
  foliage: [0.25, 0.39, 0.24],
  wood: [0.38, 0.29, 0.22],
};

const materialSettings: Record<
  ReferenceMaterialRole,
  { metalness: number; gloss: number; emissive?: number }
> = {
  wall: { metalness: 0.01, gloss: 0.16 },
  'wall-alt': { metalness: 0.02, gloss: 0.2 },
  floor: { metalness: 0.02, gloss: 0.22 },
  trim: { metalness: 0.03, gloss: 0.2 },
  metal: { metalness: 0.48, gloss: 0.48 },
  accent: { metalness: 0.04, gloss: 0.22 },
  foliage: { metalness: 0, gloss: 0.08 },
  wood: { metalness: 0, gloss: 0.14 },
};

export function colorFromTriplet(value: Triplet): Color {
  return new Color(value[0], value[1], value[2]);
}

export function createReferenceMaterial(
  role: ReferenceMaterialRole,
  colorOverride?: Triplet,
): StandardMaterial {
  const settings = materialSettings[role];
  const selected = colorOverride ?? colors[role];
  const material = new StandardMaterial();
  material.diffuse = colorFromTriplet(selected);
  material.metalness = settings.metalness;
  material.gloss = settings.gloss;

  if ((settings.emissive ?? 0) > 0) {
    material.emissive = colorFromTriplet(selected);
    material.emissiveIntensity = settings.emissive ?? 0;
  }

  material.update();
  return material;
}

export function mapWallTone(mapIndex: number): Triplet {
  const tones: Triplet[] = [
    [0.69, 0.63, 0.52],
    [0.7, 0.68, 0.61],
    [0.74, 0.67, 0.54],
    [0.62, 0.64, 0.58],
    [0.71, 0.62, 0.52],
    [0.61, 0.64, 0.62],
  ];
  return tones[Math.max(0, Math.min(tones.length - 1, mapIndex - 1))]!;
}
