import type { MapDefinition, ObjectiveDefinition } from '../maps/map-catalog';
import type { ThreatSnapshot } from './character-system';

export type ModeOutcome = 'playing' | 'won' | 'lost';

export type ModeRuntimeState = {
  prompt: string | null;
  objective: string;
  progress: string;
  complete: boolean;
  outcome: ModeOutcome;
  timerSeconds: number;
  dangerPercent: number;
  status: string;
};

type ModeContext = {
  deltaSeconds: number;
  hidden: boolean;
  threat: ThreatSnapshot;
};

const roundTimerByMode: Record<string, number> = {
  'kick-the-box': 300,
  'who-is-real': 240,
  'hide-and-heist': 300,
  'monster-hunt': 270,
  'floor-by-floor': 360,
  traitor: 300,
};

const failureByMode: Record<string, string> = {
  'kick-the-box': 'The seeker caught you before the box chain was completed.',
  'who-is-real': 'The mimic escaped identification.',
  'hide-and-heist': 'Security locked the museum down before extraction.',
  'monster-hunt': 'The monster overwhelmed the hunting team.',
  'floor-by-floor': 'The sweep failed before the roof extraction was secured.',
  traitor: 'Sabotage reached critical state before the traitor was exposed.',
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

function riskRate(modeId: string, threat: ThreatSnapshot): number {
  if (threat.danger <= 0) return 0;

  if (modeId === 'monster-hunt' && threat.role === 'monster') return threat.danger * 36;
  if (modeId === 'hide-and-heist' && threat.role === 'guard') return threat.danger * 30;
  if (modeId === 'kick-the-box' && threat.role === 'seeker') return threat.danger * 28;
  if (
    modeId === 'floor-by-floor' &&
    (threat.role === 'seeker' || threat.role === 'guard')
  ) {
    return threat.danger * 24;
  }
  if (modeId === 'traitor' && threat.role === 'traitor') return threat.danger * 22;
  if (modeId === 'who-is-real' && threat.role === 'mimic') return threat.danger * 12;

  return threat.detected ? threat.danger * 10 : threat.danger * 3;
}

function statusFor(modeId: string, danger: number, threat: ThreatSnapshot, hidden: boolean): string {
  if (hidden && danger > 5) return 'CONCEALED · RISK DECAYING';
  if (threat.detected) return threat.label;
  if (modeId === 'who-is-real' && threat.role === 'mimic' && threat.danger > 0.15) {
    return 'ANOMALOUS BEHAVIOR NEARBY';
  }
  if (danger >= 70) return 'CRITICAL';
  if (danger >= 40) return 'ELEVATED';
  return 'CLEAR';
}

function objectiveGuidance(modeId: string): string {
  if (modeId === 'kick-the-box') return 'Activate the box chain and avoid seeker contact.';
  if (modeId === 'who-is-real') return 'Complete scans and isolate the mimic before time expires.';
  if (modeId === 'hide-and-heist') return 'Secure the heist objectives while keeping security heat low.';
  if (modeId === 'monster-hunt') return 'Restore hunting systems and survive monster pursuit.';
  if (modeId === 'floor-by-floor') return 'Clear each floor in sequence, then secure extraction.';
  if (modeId === 'traitor') return 'Finish facility tasks, collect evidence, and expose the traitor.';
  return 'Complete the active objectives.';
}

export class ModeEngine {
  private readonly completed = new Set<string>();
  private readonly totalSeconds: number;
  private timerSeconds: number;
  private danger = 0;
  private outcome: ModeOutcome = 'playing';

  constructor(private readonly map: MapDefinition) {
    this.totalSeconds = roundTimerByMode[map.mode.id] ?? 300;
    this.timerSeconds = this.totalSeconds;
  }

  update(
    position: { x: number; y: number; z: number },
    interactPressed: boolean,
    context: ModeContext,
  ): ModeRuntimeState {
    if (this.outcome === 'playing') {
      const dt = Math.min(Math.max(context.deltaSeconds, 0), 0.1);
      this.timerSeconds = Math.max(0, this.timerSeconds - dt);

      const gain = riskRate(this.map.mode.id, context.threat) * dt;
      const recovery = context.hidden ? 17 * dt : context.threat.detected ? 0 : 5 * dt;
      this.danger = Math.min(100, Math.max(0, this.danger + gain - recovery));

      if (this.timerSeconds <= 0 || this.danger >= 100) {
        this.outcome = 'lost';
      }
    }

    const incomplete = this.map.objectives.filter((objective) => !this.completed.has(objective.id));
    const orderedMode =
      this.map.mode.id === 'hide-and-heist' ||
      this.map.mode.id === 'floor-by-floor' ||
      this.map.mode.id === 'traitor';
    const eligible = orderedMode && incomplete.length > 0 ? [incomplete[0]!] : incomplete;

    let nearest: ObjectiveDefinition | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    if (this.outcome === 'playing') {
      for (const objective of eligible) {
        const distance = distanceSquared(position, objective.position);
        if (distance <= objective.radius * objective.radius && distance < nearestDistance) {
          nearest = objective;
          nearestDistance = distance;
        }
      }

      if (nearest && interactPressed) {
        this.completed.add(nearest.id);
        this.danger = Math.max(0, this.danger - 12);
      }
    }

    const completedCount = this.completed.size;
    if (completedCount === this.map.objectives.length && this.outcome === 'playing') {
      this.outcome = 'won';
    }

    const complete = this.outcome === 'won';
    const activeIncomplete = this.map.objectives.filter(
      (objective) => !this.completed.has(objective.id),
    );
    const nextObjective = activeIncomplete[0] ?? null;

    let objective = objectiveGuidance(this.map.mode.id);
    if (this.outcome === 'won') {
      objective = this.map.mode.success;
    } else if (this.outcome === 'lost') {
      objective = failureByMode[this.map.mode.id] ?? 'Round failed.';
    } else if (orderedMode && nextObjective) {
      objective = `${objectiveGuidance(this.map.mode.id)} Next: ${nextObjective.label}.`;
    }

    return {
      prompt:
        nearest && !this.completed.has(nearest.id) && this.outcome === 'playing'
          ? `E · ${nearest.action} · ${nearest.label.toUpperCase()}`
          : null,
      objective,
      progress: `${completedCount}/${this.map.objectives.length}`,
      complete,
      outcome: this.outcome,
      timerSeconds: this.timerSeconds,
      dangerPercent: this.danger,
      status: statusFor(this.map.mode.id, this.danger, context.threat, context.hidden),
    };
  }
}
