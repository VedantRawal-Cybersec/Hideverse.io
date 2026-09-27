import type { MapDefinition, Triplet } from '../maps/map-catalog';
import { referenceScene } from './reference-art-direction';

export type MapVisualProfile = {
  sky: Triplet;
  ambient: Triplet;
  sun: Triplet;
  fill: Triplet;
  fog: Triplet;
  sunIntensity: number;
  fillIntensity: number;
  sunAngles: Triplet;
  fillAngles: Triplet;
  fogDensity: number;
  accent: Triplet;
};

const accentByMap: Record<string, Triplet> = {
  ravenwood: [0.82, 0.58, 0.34],
  nexus: [0.24, 0.66, 0.98],
  museum: [0.9, 0.68, 0.26],
  hospital: [0.3, 0.82, 0.7],
  hotel: [0.88, 0.42, 0.58],
  axiom: [0.48, 0.54, 1],
};

const fogDensityByMap: Record<string, number> = {
  ravenwood: 0.00235,
  nexus: 0.00165,
  museum: 0.00195,
  hospital: 0.0028,
  hotel: 0.00225,
  axiom: 0.00245,
};

function mixTriplet(a: Triplet, b: Triplet, weight: number): Triplet {
  const inverse = 1 - weight;
  return [
    a[0] * inverse + b[0] * weight,
    a[1] * inverse + b[1] * weight,
    a[2] * inverse + b[2] * weight,
  ];
}

function mixNumber(a: number, b: number, weight: number): number {
  return a * (1 - weight) + b * weight;
}

export function mapVisualProfile(map: MapDefinition): MapVisualProfile {
  return {
    // Keep the supplied competitive-FPS reference readability, but let each map
    // own a recognizable atmosphere and color temperature.
    sky: mixTriplet(referenceScene.sky, map.lighting.clear, 0.32),
    ambient: mixTriplet(referenceScene.ambient, map.lighting.ambient, 0.58),
    sun: mixTriplet(referenceScene.sun, map.lighting.sun, 0.48),
    fill: mixTriplet(referenceScene.fill, map.lighting.fill, 0.55),
    fog: mixTriplet(referenceScene.fog, map.lighting.clear, 0.36),
    sunIntensity: mixNumber(referenceScene.sunIntensity, map.lighting.sunIntensity, 0.52),
    fillIntensity: mixNumber(referenceScene.fillIntensity, map.lighting.fillIntensity, 0.55),
    sunAngles: map.lighting.sunAngles,
    fillAngles: map.lighting.fillAngles,
    fogDensity: fogDensityByMap[map.id] ?? 0.0021,
    accent: accentByMap[map.id] ?? [0.5, 0.68, 0.9],
  };
}
