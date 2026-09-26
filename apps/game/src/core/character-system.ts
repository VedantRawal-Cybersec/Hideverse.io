import { Application, Color, Entity, StandardMaterial } from 'playcanvas';
import type { ActorRole, MapDefinition, Triplet } from '../maps/map-catalog';

export type MotionState = 'idle' | 'walk' | 'run' | 'sprint' | 'jump';

export type ThreatSnapshot = {
  role: ActorRole | 'none';
  distance: number;
  detected: boolean;
  danger: number;
  label: string;
};

type ActorRuntime = {
  id: string;
  root: Entity;
  visual: Entity;
  head: Entity;
  role: ActorRole;
  path: Triplet[];
  pathIndex: number;
  speed: number;
  state: MotionState;
  animationPhase: number;
  alertSeconds: number;
};

const roleColors: Record<ActorRole, Triplet> = {
  hider: [0.33, 0.72, 0.95],
  seeker: [0.95, 0.28, 0.28],
  guard: [0.86, 0.68, 0.24],
  civilian: [0.72, 0.74, 0.79],
  mimic: [0.64, 0.35, 0.88],
  monster: [0.32, 0.92, 0.48],
  traitor: [0.95, 0.42, 0.68],
};

function makeMaterial(color: Triplet): StandardMaterial {
  const result = new StandardMaterial();
  result.diffuse = new Color(color[0], color[1], color[2]);
  result.gloss = 0.25;
  result.update();
  return result;
}

function speedForRole(role: ActorRole): number {
  if (role === 'monster') return 4.7;
  if (role === 'seeker') return 3.7;
  if (role === 'hider') return 2.8;
  if (role === 'traitor') return 2.9;
  if (role === 'guard') return 2.35;
  if (role === 'mimic') return 1.95;
  return 1.55;
}

function stateForRole(role: ActorRole): MotionState {
  if (role === 'monster' || role === 'seeker') return 'run';
  if (role === 'hider') return 'sprint';
  return 'walk';
}

function detectionRadius(role: ActorRole): number {
  if (role === 'monster') return 18;
  if (role === 'seeker') return 14;
  if (role === 'guard') return 11;
  if (role === 'traitor') return 10;
  if (role === 'mimic') return 7;
  return 0;
}

function isHostile(role: ActorRole): boolean {
  return role === 'monster' || role === 'seeker' || role === 'guard' || role === 'traitor';
}

function distance(a: Triplet, b: Triplet): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function moveActor(
  actor: ActorRuntime,
  target: Triplet,
  deltaSeconds: number,
  speedScale = 1,
): void {
  const current = actor.root.getPosition();
  const dx = target[0] - current.x;
  const dy = target[1] - current.y;
  const dz = target[2] - current.z;
  const remaining = Math.hypot(dx, dy, dz);
  if (remaining <= 0.001) return;

  const step = Math.min(remaining, actor.speed * speedScale * deltaSeconds);
  const inverse = 1 / remaining;
  actor.root.setPosition(
    current.x + dx * inverse * step,
    current.y + dy * inverse * step,
    current.z + dz * inverse * step,
  );

  const yaw = (Math.atan2(dx, -dz) * 180) / Math.PI;
  actor.root.setEulerAngles(0, yaw, 0);
}

export class CharacterSystem {
  private readonly actors: ActorRuntime[] = [];

  constructor(app: Application, map: MapDefinition) {
    const navById = new Map(map.navNodes.map((node) => [node.id, node.position] as const));

    for (const spawn of map.actorSpawns) {
      const root = new Entity(`actor-${spawn.id}`);
      root.setPosition(spawn.position[0], spawn.position[1], spawn.position[2]);

      const visual = new Entity(`${spawn.id}-body`);
      visual.addComponent('render', { type: 'capsule' });
      visual.setLocalScale(
        spawn.role === 'monster' ? 1.05 : 0.72,
        spawn.role === 'monster' ? 1.35 : 1,
        spawn.role === 'monster' ? 1.05 : 0.72,
      );

      const head = new Entity(`${spawn.id}-head`);
      head.addComponent('render', { type: 'sphere' });
      head.setLocalScale(0.48, 0.48, 0.48);
      head.setLocalPosition(0, spawn.role === 'monster' ? 1.55 : 1.18, 0);

      const actorMaterial = makeMaterial(roleColors[spawn.role]);
      if (visual.render) visual.render.material = actorMaterial;
      if (head.render) head.render.material = actorMaterial;

      root.addChild(visual);
      root.addChild(head);
      app.root.addChild(root);

      const path = spawn.patrol
        .map((nodeId) => navById.get(nodeId))
        .filter((point): point is Triplet => Boolean(point));

      this.actors.push({
        id: spawn.id,
        root,
        visual,
        head,
        role: spawn.role,
        path,
        pathIndex: 0,
        speed: speedForRole(spawn.role),
        state: path.length > 0 ? stateForRole(spawn.role) : 'idle',
        animationPhase: Math.random() * Math.PI * 2,
        alertSeconds: 0,
      });
    }
  }

  get count(): number {
    return this.actors.length;
  }

  update(
    deltaSeconds: number,
    playerPosition: { x: number; y: number; z: number },
    playerHidden: boolean,
  ): ThreatSnapshot {
    const dt = Math.min(deltaSeconds, 1 / 20);
    const player: Triplet = [playerPosition.x, playerPosition.y, playerPosition.z];
    let strongest: ThreatSnapshot = {
      role: 'none',
      distance: Number.POSITIVE_INFINITY,
      detected: false,
      danger: 0,
      label: 'CLEAR',
    };

    for (const actor of this.actors) {
      const actorPosition = actor.root.getPosition();
      const current: Triplet = [actorPosition.x, actorPosition.y, actorPosition.z];
      const currentDistance = distance(current, player);
      const radius = detectionRadius(actor.role);
      const sameFloor = Math.abs(playerPosition.y - actorPosition.y) < 4;
      const visibilityScale = playerHidden ? 0.34 : 1;
      const detected =
        radius > 0 && sameFloor && currentDistance <= Math.max(1.5, radius * visibilityScale);

      if (detected && isHostile(actor.role)) {
        actor.alertSeconds = Math.max(actor.alertSeconds, actor.role === 'monster' ? 4.5 : 3);
      } else {
        actor.alertSeconds = Math.max(0, actor.alertSeconds - dt);
      }

      const chasing = isHostile(actor.role) && actor.alertSeconds > 0 && sameFloor;
      if (chasing) {
        actor.state = actor.role === 'monster' || actor.role === 'seeker' ? 'sprint' : 'run';
        moveActor(actor, player, dt, actor.role === 'monster' ? 1.08 : 1);
      } else if (actor.path.length > 0) {
        actor.state = stateForRole(actor.role);
        const target = actor.path[actor.pathIndex]!;
        const remaining = distance(current, target);
        if (remaining < 0.35) {
          actor.pathIndex = (actor.pathIndex + 1) % actor.path.length;
        } else {
          moveActor(actor, target, dt);
        }
      } else {
        actor.state = 'idle';
      }

      actor.animationPhase += dt * (actor.state === 'run' || actor.state === 'sprint' ? 10 : 6);
      const amplitude =
        actor.state === 'sprint'
          ? 0.09
          : actor.state === 'run'
            ? 0.07
            : actor.state === 'walk'
              ? 0.035
              : 0.01;
      const bob = Math.abs(Math.sin(actor.animationPhase)) * amplitude;
      actor.visual.setLocalPosition(0, bob, 0);
      actor.head.setLocalPosition(0, (actor.role === 'monster' ? 1.55 : 1.18) + bob, 0);

      if (radius > 0) {
        const rawDanger = Math.max(0, 1 - currentDistance / radius);
        const roleWeight =
          actor.role === 'monster'
            ? 1
            : actor.role === 'seeker'
              ? 0.92
              : actor.role === 'guard'
                ? 0.75
                : actor.role === 'traitor'
                  ? 0.7
                  : 0.35;
        const danger = Math.min(1, rawDanger * roleWeight + (chasing ? 0.22 : 0));
        if (danger > strongest.danger) {
          strongest = {
            role: actor.role,
            distance: currentDistance,
            detected: detected || chasing,
            danger,
            label:
              detected || chasing ? `${actor.role.toUpperCase()} ALERT` : actor.role.toUpperCase(),
          };
        }
      }
    }

    return strongest;
  }

  nearestRole(position: { x: number; y: number; z: number }): string {
    let result = 'NONE';
    let best = Number.POSITIVE_INFINITY;

    for (const actor of this.actors) {
      const actorPosition = actor.root.getPosition();
      const current: Triplet = [actorPosition.x, actorPosition.y, actorPosition.z];
      const player: Triplet = [position.x, position.y, position.z];
      const currentDistance = distance(current, player);
      if (currentDistance < best) {
        best = currentDistance;
        result = actor.role.toUpperCase();
      }
    }

    return result;
  }
}
