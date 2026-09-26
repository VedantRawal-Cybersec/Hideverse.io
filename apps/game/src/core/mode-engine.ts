import type { MapDefinition, ObjectiveDefinition } from '../maps/map-catalog';

export type ModeRuntimeState = {
  prompt: string | null;
  objective: string;
  progress: string;
  complete: boolean;
};

function distanceSquared(
  position: { x: number; y: number; z: number },
  target: readonly [number, number, number],
): number {
  const dx = position.x - target[0];
  const dy = position.y - target[1];
  const dz = position.z - target[2];
  return dx * dx + dy * dy + dz * dz;
}

export class ModeEngine {
  private readonly completed = new Set<string>();

  constructor(private readonly map: MapDefinition) {}

  update(
    position: { x: number; y: number; z: number },
    interactPressed: boolean,
  ): ModeRuntimeState {
    const incomplete = this.map.objectives.filter((objective) => !this.completed.has(objective.id));

    if (incomplete.length === 0) {
      return {
        prompt: null,
        objective: this.map.mode.success,
        progress: `${this.map.objectives.length}/${this.map.objectives.length}`,
        complete: true,
      };
    }

    let nearest: ObjectiveDefinition | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const objective of incomplete) {
      const distance = distanceSquared(position, objective.position);
      if (distance <= objective.radius * objective.radius && distance < nearestDistance) {
        nearest = objective;
        nearestDistance = distance;
      }
    }

    if (nearest && interactPressed) {
      this.completed.add(nearest.id);
    }

    const completedCount = this.completed.size;
    const complete = completedCount === this.map.objectives.length;

    return {
      prompt:
        nearest && !this.completed.has(nearest.id)
          ? `E · ${nearest.action} · ${nearest.label.toUpperCase()}`
          : null,
      objective: complete
        ? this.map.mode.success
        : `${this.map.mode.name}: ${this.map.mode.summary}`,
      progress: `${completedCount}/${this.map.objectives.length}`,
      complete,
    };
  }
}
