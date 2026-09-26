import { Application, Color, Entity, StandardMaterial } from 'playcanvas';
import type { AnimTrack } from 'playcanvas';
import type { MotionState } from './character-system';
import { loadContainer } from './load-container';
import type { PlayerViewMode } from './player-controller';

type AvatarAnimation = 'idle' | 'walk' | 'run' | 'jump' | 'win' | 'lose';

function fallbackMaterial(): StandardMaterial {
  const material = new StandardMaterial();
  material.diffuse = new Color(0.22, 0.68, 0.92);
  material.emissive = new Color(0.015, 0.05, 0.075);
  material.gloss = 0.32;
  material.update();
  return material;
}

function animationForMotion(
  motion: MotionState,
  outcome: 'playing' | 'won' | 'lost',
): AvatarAnimation {
  if (outcome === 'won') return 'win';
  if (outcome === 'lost') return 'lose';
  if (motion === 'jump') return 'jump';
  if (motion === 'sprint' || motion === 'run') return 'run';
  if (motion === 'walk') return 'walk';
  return 'idle';
}

export class PlayerAvatar {
  private readonly root = new Entity('Local Player Avatar');
  private readonly fallback = new Entity('Local Player Fallback');
  private rigged: Entity | null = null;
  private currentAnimation: AvatarAnimation | null = null;

  constructor(
    private readonly app: Application,
    private readonly coarsePointer: boolean,
  ) {
    this.fallback.addComponent('render', { type: 'capsule' });
    this.fallback.setLocalScale(0.72, 1, 0.72);
    if (this.fallback.render) this.fallback.render.material = fallbackMaterial();
    this.root.addChild(this.fallback);
    this.root.enabled = false;
    app.root.addChild(this.root);

    if (!coarsePointer) void this.loadRiggedModel();
  }

  update(
    position: { x: number; y: number; z: number },
    yaw: number,
    motion: MotionState,
    viewMode: PlayerViewMode,
    outcome: 'playing' | 'won' | 'lost',
  ): void {
    this.root.enabled = viewMode === 'third-person';
    this.root.setPosition(position.x, position.y, position.z);
    this.root.setEulerAngles(0, yaw, 0);

    const requested = animationForMotion(motion, outcome);
    if (requested !== this.currentAnimation) {
      this.transition(requested);
      this.currentAnimation = requested;
    }

    if (this.rigged?.anim) {
      this.rigged.anim.speed =
        motion === 'sprint' ? 1.22 : motion === 'run' ? 1.05 : motion === 'walk' ? 0.95 : 1;
    }
  }

  private async loadRiggedModel(): Promise<void> {
    try {
      const asset = await loadContainer(
        this.app,
        `${import.meta.env.BASE_URL}characters/kaykit/Rogue.glb`,
      );
      const resource = asset.resource as typeof asset.resource & {
        animations: Array<{ resource: AnimTrack }>;
      };
      const tracks = new Map<string, AnimTrack>();
      for (const animation of resource.animations) {
        tracks.set(animation.resource.name, animation.resource);
      }

      const required = {
        idle: tracks.get('Idle'),
        walk: tracks.get('Walking_A'),
        run: tracks.get('Running_A'),
        jump: tracks.get('Jump_Full_Short'),
        win: tracks.get('Cheer'),
        lose: tracks.get('Hit_A'),
      };
      if (Object.values(required).some((track) => !track)) {
        console.warn('[Hideverse player] Rigged model is missing a required animation.');
        return;
      }

      const rigged = asset.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true,
      });
      rigged.name = 'Local Player Rigged';
      rigged.setLocalPosition(0, -1.2, 0);
      rigged.setLocalScale(0.88, 0.88, 0.88);
      rigged.setLocalEulerAngles(0, 180, 0);
      rigged.addComponent('anim', { activate: true, speed: 1 });
      if (!rigged.anim) return;

      rigged.anim.rootBone = rigged;
      for (const [name, track] of Object.entries(required)) {
        rigged.anim.assignAnimation(name, track!);
      }

      const layer = rigged.anim.baseLayer;
      if (!layer) return;
      layer.transition('idle', 0);

      this.root.addChild(rigged);
      this.rigged = rigged;
      this.fallback.enabled = false;
      this.currentAnimation = 'idle';
    } catch (error) {
      console.warn('[Hideverse player] Rigged player unavailable; using mobile-safe fallback.', error);
    }
  }

  private transition(animation: AvatarAnimation): void {
    const layer = this.rigged?.anim?.baseLayer;
    if (!layer) return;
    layer.transition(animation, animation === 'jump' ? 0.06 : 0.14);
  }
}
