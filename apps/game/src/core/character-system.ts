import { Application, Color, Entity, StandardMaterial } from 'playcanvas';
import type { AnimTrack } from 'playcanvas';
import { AStar, Graph, NavEdge, NavNode, Vector3 as YukaVector3 } from 'yuka';
import type { ActorRole, MapDefinition, Triplet } from '../maps/map-catalog';
import { loadContainer } from './load-container';

export type MotionState = 'idle' | 'walk' | 'run' | 'sprint' | 'jump';

export type ThreatSnapshot = {
  role: ActorRole | 'none';
  distance: number;
  detected: boolean;
  danger: number;
  label: string;
};

type NavigationRuntime = {
  graph: Graph;
  indexById: Map<string, number>;
  idByIndex: Map<number, string>;
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
  limbs: {
    leftArm: Entity;
    rightArm: Entity;
    leftLeg: Entity;
    rightLeg: Entity;
  } | null;
  rigged: Entity | null;
  riggedState: 'idle' | 'walk' | 'run' | null;
  roleMarker: Entity | null;
  chasePath: Triplet[];
  chasePathIndex: number;
  chaseRepathSeconds: number;
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

const roleModels: Record<ActorRole, string> = {
  hider: 'Rogue.glb',
  seeker: 'Rogue_Hooded.glb',
  guard: 'Knight.glb',
  civilian: 'Mage.glb',
  mimic: 'Rogue.glb',
  monster: 'Barbarian.glb',
  traitor: 'Rogue_Hooded.glb',
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

function animationStateForMotion(state: MotionState): 'idle' | 'walk' | 'run' {
  if (state === 'idle') return 'idle';
  if (state === 'walk') return 'walk';
  return 'run';
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

function pointInsideStructure(map: MapDefinition, point: Triplet, margin = 0.65): boolean {
  return map.structures.some((structure) => {
    if (structure.size[1] < 1) return false;
    const [x, y, z] = point;
    const [sx, sy, sz] = structure.position;
    const [wx, wy, wz] = structure.size;
    const insideHeight = Math.abs(y - sy) < wy / 2 + 1.1;
    return insideHeight && Math.abs(x - sx) < wx / 2 + margin && Math.abs(z - sz) < wz / 2 + margin;
  });
}

function lineClear(map: MapDefinition, a: Triplet, b: Triplet): boolean {
  if (Math.abs(a[1] - b[1]) > 4.2) return false;
  const length = distance(a, b);
  const samples = Math.max(3, Math.min(26, Math.ceil(length / 1.7)));

  for (let index = 1; index < samples; index += 1) {
    const t = index / samples;
    const point: Triplet = [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
    if (pointInsideStructure(map, point)) return false;
  }
  return true;
}

function buildNavigationGraph(map: MapDefinition): NavigationRuntime {
  const graph = new Graph();
  const indexById = new Map<string, number>();
  const idByIndex = new Map<number, string>();

  for (const [index, node] of map.navNodes.entries()) {
    indexById.set(node.id, index);
    idByIndex.set(index, node.id);
    graph.addNode(
      new NavNode(
        index,
        new YukaVector3(node.position[0], node.position[1], node.position[2]),
        { id: node.id },
      ),
    );
  }

  for (let aIndex = 0; aIndex < map.navNodes.length; aIndex += 1) {
    const a = map.navNodes[aIndex]!;
    for (let bIndex = aIndex + 1; bIndex < map.navNodes.length; bIndex += 1) {
      const b = map.navNodes[bIndex]!;
      const cost = distance(a.position, b.position);
      if (cost > 38 || Math.abs(a.position[1] - b.position[1]) > 4.2) continue;
      if (!lineClear(map, a.position, b.position)) continue;
      graph.addEdge(new NavEdge(aIndex, bIndex, cost));
    }
  }

  return { graph, indexById, idByIndex };
}

function nearestNodeId(map: MapDefinition, point: Triplet): string | null {
  let bestId: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const node of map.navNodes) {
    const horizontal = Math.hypot(point[0] - node.position[0], point[2] - node.position[2]);
    const vertical = Math.abs(point[1] - node.position[1]);
    const score = horizontal + vertical * 4;
    if (score < bestScore) {
      bestScore = score;
      bestId = node.id;
    }
  }
  return bestId;
}

function shortestPath(
  navigation: NavigationRuntime,
  start: string,
  goal: string,
): string[] {
  const source = navigation.indexById.get(start);
  const target = navigation.indexById.get(goal);
  if (source === undefined || target === undefined) return [];
  if (source === target) return [start];

  const path = new AStar(navigation.graph, source, target).search().getPath();
  return path
    .map((index) => navigation.idByIndex.get(index))
    .filter((id): id is string => Boolean(id));
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
  private readonly graph: NavigationRuntime;
  private readonly navById: Map<string, Triplet>;

  constructor(
    app: Application,
    private readonly map: MapDefinition,
  ) {
    this.navById = new Map(map.navNodes.map((node) => [node.id, node.position] as const));
    this.graph = buildNavigationGraph(map);

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

      let limbs: ActorRuntime['limbs'] = null;
      if (!matchMedia('(pointer: coarse)').matches) {
        const makeLimb = (name: string, x: number, y: number): Entity => {
          const limb = new Entity(`${spawn.id}-${name}`);
          limb.addComponent('render', { type: 'box' });
          limb.setLocalScale(0.18, 0.62, 0.2);
          limb.setLocalPosition(x, y, 0);
          if (limb.render) limb.render.material = actorMaterial;
          root.addChild(limb);
          return limb;
        };

        limbs = {
          leftArm: makeLimb('left-arm', -0.52, 0.24),
          rightArm: makeLimb('right-arm', 0.52, 0.24),
          leftLeg: makeLimb('left-leg', -0.22, -0.78),
          rightLeg: makeLimb('right-leg', 0.22, -0.78),
        };
      }

      app.root.addChild(root);

      const path = spawn.patrol
        .map((nodeId) => this.navById.get(nodeId))
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
        limbs,
        rigged: null,
        riggedState: null,
        roleMarker: null,
        chasePath: [],
        chasePathIndex: 0,
        chaseRepathSeconds: 0,
      });
    }

    if (!matchMedia('(pointer: coarse)').matches) {
      void this.loadRiggedActors(app);
    }
  }

  private async loadRiggedActors(app: Application): Promise<void> {
    try {
      const requiredModels = [...new Set(this.actors.map((actor) => roleModels[actor.role]))];
      const assets = new Map<string, Awaited<ReturnType<typeof loadContainer>>>();

      await Promise.all(
        requiredModels.map(async (filename) => {
          const asset = await loadContainer(
            app,
            `${import.meta.env.BASE_URL}characters/kaykit/${filename}`,
          );
          assets.set(filename, asset);
        }),
      );

      for (const actor of this.actors) {
        const filename = roleModels[actor.role];
        const asset = assets.get(filename);
        if (!asset) continue;

        const resource = asset.resource as typeof asset.resource & {
          animations: Array<{ resource: AnimTrack }>;
        };
        const tracks = new Map<string, AnimTrack>();
        for (const animation of resource.animations) {
          tracks.set(animation.resource.name, animation.resource);
        }

        const idle = tracks.get(actor.role === 'guard' ? 'Unarmed_Idle' : 'Idle') ?? tracks.get('Idle');
        const walking = tracks.get('Walking_A');
        const running = tracks.get('Running_A');
        if (!idle || !walking || !running) continue;

        const rigged = asset.resource.instantiateRenderEntity({
          castShadows: true,
          receiveShadows: true,
        });
        rigged.name = `rigged-${actor.id}-${filename.replace('.glb', '')}`;
        rigged.setLocalPosition(0, actor.role === 'monster' ? -1.36 : -1.2, 0);
        const scale = actor.role === 'monster' ? 1.08 : 0.88;
        rigged.setLocalScale(scale, scale, scale);
        rigged.setLocalEulerAngles(0, 180, 0);
        rigged.addComponent('anim', { activate: true, speed: 1 });
        if (!rigged.anim) continue;

        rigged.anim.rootBone = rigged;
        rigged.anim.assignAnimation('idle', idle);
        rigged.anim.assignAnimation('walk', walking);
        rigged.anim.assignAnimation('run', running);
        const interact = tracks.get('Interact');
        const cheer = tracks.get('Cheer');
        if (interact) rigged.anim.assignAnimation('interact', interact);
        if (cheer) rigged.anim.assignAnimation('cheer', cheer);

        const baseLayer = rigged.anim.baseLayer;
        if (!baseLayer) {
          rigged.destroy();
          continue;
        }
        baseLayer.transition('idle', 0);

        const marker = new Entity(`role-marker-${actor.id}`);
        marker.addComponent('render', { type: 'cylinder' });
        marker.setLocalScale(actor.role === 'monster' ? 0.92 : 0.7, 0.035, actor.role === 'monster' ? 0.92 : 0.7);
        marker.setLocalPosition(0, actor.role === 'monster' ? -1.34 : -1.17, 0);
        if (marker.render) marker.render.material = makeMaterial(roleColors[actor.role]);

        actor.root.addChild(rigged);
        actor.root.addChild(marker);
        actor.rigged = rigged;
        actor.riggedState = 'idle';
        actor.roleMarker = marker;
        actor.visual.enabled = false;
        actor.head.enabled = false;
        if (actor.limbs) {
          actor.limbs.leftArm.enabled = false;
          actor.limbs.rightArm.enabled = false;
          actor.limbs.leftLeg.enabled = false;
          actor.limbs.rightLeg.enabled = false;
        }
      }
    } catch (error) {
      console.warn(
        '[Hideverse characters] Rigged role variety unavailable; using procedural fallback.',
        error,
      );
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
      const directSight = sameFloor && lineClear(this.map, current, player);
      const detected =
        radius > 0 &&
        sameFloor &&
        directSight &&
        currentDistance <= Math.max(1.5, radius * visibilityScale);

      if (detected && isHostile(actor.role)) {
        actor.alertSeconds = Math.max(actor.alertSeconds, actor.role === 'monster' ? 4.5 : 3);
      } else {
        actor.alertSeconds = Math.max(0, actor.alertSeconds - dt);
      }

      const chasing = isHostile(actor.role) && actor.alertSeconds > 0 && sameFloor;
      if (chasing) {
        actor.state = actor.role === 'monster' || actor.role === 'seeker' ? 'sprint' : 'run';
        actor.chaseRepathSeconds = Math.max(0, actor.chaseRepathSeconds - dt);

        if (directSight) {
          actor.chasePath = [];
          actor.chasePathIndex = 0;
          moveActor(actor, player, dt, actor.role === 'monster' ? 1.08 : 1);
        } else {
          if (actor.chaseRepathSeconds <= 0) {
            const startId = nearestNodeId(this.map, current);
            const goalId = nearestNodeId(this.map, player);
            if (startId && goalId) {
              const ids = shortestPath(this.graph, startId, goalId);
              actor.chasePath = ids
                .map((id) => this.navById.get(id))
                .filter((point): point is Triplet => Boolean(point));
              actor.chasePathIndex = actor.chasePath.length > 1 ? 1 : 0;
            }
            actor.chaseRepathSeconds = 0.55;
          }

          const waypoint = actor.chasePath[actor.chasePathIndex] ?? null;
          if (waypoint) {
            if (distance(current, waypoint) < 0.75) {
              actor.chasePathIndex = Math.min(actor.chasePath.length - 1, actor.chasePathIndex + 1);
            }
            moveActor(
              actor,
              actor.chasePath[actor.chasePathIndex] ?? waypoint,
              dt,
              actor.role === 'monster' ? 1.08 : 1,
            );
          }
        }
      } else if (actor.path.length > 0) {
        actor.chasePath = [];
        actor.chasePathIndex = 0;
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

      if (actor.limbs) {
        const moving = actor.state !== 'idle';
        const swing = moving ? Math.sin(actor.animationPhase) * 28 : 0;
        actor.limbs.leftArm.setLocalEulerAngles(swing, 0, 0);
        actor.limbs.rightArm.setLocalEulerAngles(-swing, 0, 0);
        actor.limbs.leftLeg.setLocalEulerAngles(-swing * 0.75, 0, 0);
        actor.limbs.rightLeg.setLocalEulerAngles(swing * 0.75, 0, 0);
      }

      if (actor.rigged?.anim) {
        const nextState = animationStateForMotion(actor.state);
        actor.rigged.anim.speed = actor.state === 'sprint' ? 1.25 : 1;
        const baseLayer = actor.rigged.anim.baseLayer;
        if (baseLayer && actor.riggedState !== nextState) {
          baseLayer.transition(nextState, 0.16);
          actor.riggedState = nextState;
        }
      }

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
