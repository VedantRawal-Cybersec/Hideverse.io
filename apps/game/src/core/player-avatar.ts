import { Application, Entity } from 'playcanvas';
import type { AnimTrack } from 'playcanvas';
import type { MotionState } from './character-system';
import { loadContainer } from './load-container';

export type PlayerViewMode = 'first-person' | 'third-person';

const playerAsset = 'characters/kaykit/Rogue.glb';

function locomotionState(state: MotionState): 'idle' | 'walk' | 'run' {
  if (state === 'idle') return 'idle';
  if (state === 'walk') return 'walk';
  return 'run';
}

export class PlayerAvatar {
  readonly root = new Entity('local-player-avatar');
  private rigged: Entity | null = null;
  private activeAnimation: 'idle' | 'walk' | 'run' | null = null;
  private loading: Promise<void> | null = null;
  private visible = false;

  constructor(private readonly app: Application) {
    this.root.enabled = false;
    app.root.addChild(this.root);
  }

  setViewMode(mode: PlayerViewMode): void {
    this.visible = mode === 'third-person';
    this.root.enabled = this.visible;
    if (this.visible) void this.ensureLoaded();
  }

  update(position: { x: number; y: number; z: number }, yaw: number, motion: MotionState): void {
    this.root.setPosition(position.x, position.y, position.z);
    this.root.setEulerAngles(0, yaw, 0);

    if (!this.visible || !this.rigged?.anim) return;

    const nextAnimation = locomotionState(motion);
    const baseLayer = this.rigged.anim.baseLayer;
    if (baseLayer && this.activeAnimation !== nextAnimation) {
      baseLayer.transition(nextAnimation, 0.14);
      this.activeAnimation = nextAnimation;
    }

    this.rigged.anim.speed = motion === 'sprint' ? 1.28 : motion === 'run' ? 1.08 : 1;
  }

  private ensureLoaded(): Promise<void> {
    if (this.rigged) return Promise.resolve();
    if (this.loading) return this.loading;

    this.loading = this.loadRiggedAvatar().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async loadRiggedAvatar(): Promise<void> {
    try {
      const asset = await loadContainer(this.app, `${import.meta.env.BASE_URL}${playerAsset}`);
      const resource = asset.resource as typeof asset.resource & {
        animations: Array<{ resource: AnimTrack }>;
      };
      const tracks = new Map<string, AnimTrack>();
      for (const animation of resource.animations) {
        tracks.set(animation.resource.name, animation.resource);
      }

      const idle = tracks.get('Idle');
      const walk = tracks.get('Walking_A');
      const run = tracks.get('Running_A');
      if (!idle || !walk || !run) {
        console.warn('[Hideverse player] Required locomotion animations are unavailable.');
        return;
      }

      const rigged = asset.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true,
      });
      rigged.name = 'local-player-rigged';
      rigged.setLocalPosition(0, -1.2, 0);
      rigged.setLocalScale(0.88, 0.88, 0.88);
      rigged.setLocalEulerAngles(0, 180, 0);
      rigged.addComponent('anim', { activate: true, speed: 1 });
      if (!rigged.anim) {
        rigged.destroy();
        return;
      }

      rigged.anim.rootBone = rigged;
      rigged.anim.assignAnimation('idle', idle);
      rigged.anim.assignAnimation('walk', walk);
      rigged.anim.assignAnimation('run', run);
      const baseLayer = rigged.anim.baseLayer;
      if (!baseLayer) {
        rigged.destroy();
        return;
      }
      baseLayer.transition('idle', 0);

      this.root.addChild(rigged);
      this.rigged = rigged;
      this.activeAnimation = 'idle';
    } catch (error) {
      console.warn('[Hideverse player] Rigged local avatar unavailable.', error);
    }
  }
}
