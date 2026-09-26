import {
  ravenwoodHidingSpots,
  ravenwoodZoneAt,
  type RavenwoodHidingSpot,
  type RavenwoodPoint,
} from './map-layout';

export type RavenwoodInteractionState = {
  zoneLabel: string;
  prompt: string | null;
  hidden: boolean;
  hiddenLabel: string | null;
};

function distanceSquared(a: RavenwoodPoint, b: RavenwoodPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export class RavenwoodInteractionSystem {
  private hiddenSpot: RavenwoodHidingSpot | null = null;

  update(position: RavenwoodPoint, interactPressed: boolean): RavenwoodInteractionState {
    const zone = ravenwoodZoneAt(position);

    if (this.hiddenSpot) {
      if (interactPressed) {
        this.hiddenSpot = null;
        return {
          zoneLabel: zone.label,
          prompt: null,
          hidden: false,
          hiddenLabel: null,
        };
      }

      return {
        zoneLabel: zone.label,
        prompt: 'E · EXIT HIDING',
        hidden: true,
        hiddenLabel: this.hiddenSpot.label,
      };
    }

    let nearest: RavenwoodHidingSpot | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const spot of ravenwoodHidingSpots) {
      const distance = distanceSquared(position, spot.position);
      if (distance <= spot.radius * spot.radius && distance < nearestDistance) {
        nearest = spot;
        nearestDistance = distance;
      }
    }

    if (nearest && interactPressed) {
      this.hiddenSpot = nearest;
      return {
        zoneLabel: zone.label,
        prompt: 'E · EXIT HIDING',
        hidden: true,
        hiddenLabel: nearest.label,
      };
    }

    return {
      zoneLabel: zone.label,
      prompt: nearest ? `E · HIDE · ${nearest.label.toUpperCase()}` : null,
      hidden: false,
      hiddenLabel: null,
    };
  }
}
