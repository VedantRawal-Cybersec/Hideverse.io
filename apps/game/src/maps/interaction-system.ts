import type { MapDefinition } from './map-catalog';
import type { DoorRuntime } from './procedural-map';

export type WorldPoint = {
  x: number;
  y: number;
  z: number;
};

export type MapInteractionState = {
  prompt: string | null;
  hidden: boolean;
  hiddenLabel: string | null;
  handled: boolean;
};

function distanceSquared(a: WorldPoint, b: readonly [number, number, number]): number {
  const dx = a.x - b[0];
  const dy = a.y - b[1];
  const dz = a.z - b[2];
  return dx * dx + dy * dy + dz * dz;
}

export class MapInteractionSystem {
  private hiddenSpotId: string | null = null;

  constructor(
    private readonly map: MapDefinition,
    private readonly doors: DoorRuntime[],
  ) {}

  reset(): void {
    this.hiddenSpotId = null;
    for (const door of this.doors) {
      if (door.open) door.toggle();
    }
  }

  update(position: WorldPoint, interactPressed: boolean): MapInteractionState {
    if (this.hiddenSpotId) {
      const hiddenSpot = this.map.hidingSpots.find((spot) => spot.id === this.hiddenSpotId) ?? null;

      if (interactPressed) {
        this.hiddenSpotId = null;
        return {
          prompt: null,
          hidden: false,
          hiddenLabel: null,
          handled: true,
        };
      }

      return {
        prompt: 'E · EXIT HIDING',
        hidden: true,
        hiddenLabel: hiddenSpot?.label ?? 'Cover',
        handled: false,
      };
    }

    let nearestDoor: DoorRuntime | null = null;
    let nearestDoorDistance = Number.POSITIVE_INFINITY;
    for (const door of this.doors) {
      const distance = distanceSquared(position, door.definition.position);
      if (
        distance <= door.definition.radius * door.definition.radius &&
        distance < nearestDoorDistance
      ) {
        nearestDoor = door;
        nearestDoorDistance = distance;
      }
    }

    if (nearestDoor) {
      if (interactPressed) {
        nearestDoor.toggle();
        return {
          prompt: null,
          hidden: false,
          hiddenLabel: null,
          handled: true,
        };
      }

      return {
        prompt: `E · ${nearestDoor.open ? 'CLOSE' : 'OPEN'} · ${nearestDoor.definition.label.toUpperCase()}`,
        hidden: false,
        hiddenLabel: null,
        handled: false,
      };
    }

    let nearestSpot = this.map.hidingSpots[0] ?? null;
    let nearestSpotDistance = Number.POSITIVE_INFINITY;
    for (const spot of this.map.hidingSpots) {
      const distance = distanceSquared(position, spot.position);
      if (distance <= spot.radius * spot.radius && distance < nearestSpotDistance) {
        nearestSpot = spot;
        nearestSpotDistance = distance;
      }
    }

    if (nearestSpot && nearestSpotDistance < Number.POSITIVE_INFINITY) {
      if (interactPressed) {
        this.hiddenSpotId = nearestSpot.id;
        return {
          prompt: 'E · EXIT HIDING',
          hidden: true,
          hiddenLabel: nearestSpot.label,
          handled: true,
        };
      }

      return {
        prompt: `E · HIDE · ${nearestSpot.label.toUpperCase()}`,
        hidden: false,
        hiddenLabel: null,
        handled: false,
      };
    }

    return {
      prompt: null,
      hidden: false,
      hiddenLabel: null,
      handled: false,
    };
  }
}
