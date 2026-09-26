import RAPIER from '@dimforge/rapier3d-compat';
import { Entity, Quat, Vec3 } from 'playcanvas';
import type { MotionState } from './character-system';
import type { InputController } from './input-controller';
import type { PlayerAvatar, PlayerViewMode } from './player-avatar';

const forward = new Vec3();
const right = new Vec3();
const rotation = new Quat();

export class FirstPersonController {
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly character: RAPIER.KinematicCharacterController;
  private verticalVelocity = 0;
  private grounded = false;
  private movementLocked = false;
  private stamina = 100;
  private motion: MotionState = 'idle';
  private jumpMotionTimer = 0;
  private eyeHeight = 1.62;
  private cameraDistance = 4.8;
  private cameraHeight = 1.15;
  private view: PlayerViewMode = 'first-person';

  constructor(
    private readonly world: RAPIER.World,
    private readonly camera: Entity,
    private readonly input: InputController,
    private readonly avatar: PlayerAvatar,
    private readonly spawn = { x: 0, y: 2.2, z: 38 },
  ) {
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.62, 0.34).setFriction(0.15),
      this.body,
    );

    this.character = world.createCharacterController(0.025);
    this.character.enableAutostep(0.42, 0.18, true);
    this.character.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.character.setMinSlopeSlideAngle((30 * Math.PI) / 180);
    this.character.setApplyImpulsesToDynamicBodies(true);
    this.character.enableSnapToGround(0.28);

    this.avatar.setViewMode(this.view);
    this.syncCamera(1 / 60);
  }

  get position(): { x: number; y: number; z: number } {
    const position = this.body.translation();
    return { x: position.x, y: position.y, z: position.z };
  }

  get motionState(): MotionState {
    return this.motion;
  }

  get staminaPercent(): number {
    return this.stamina;
  }

  get yaw(): number {
    return this.input.yaw;
  }

  get viewMode(): PlayerViewMode {
    return this.view;
  }

  setMovementLocked(locked: boolean): void {
    this.movementLocked = locked;
  }

  update(deltaSeconds: number): void {
    const dt = Math.min(Math.max(deltaSeconds, 0), 1 / 30);

    if (this.input.consumeViewToggle()) {
      this.view = this.view === 'first-person' ? 'third-person' : 'first-person';
      this.avatar.setViewMode(this.view);
    }

    if (this.input.consumeReset()) {
      this.reset();
      return;
    }

    const axes = this.movementLocked ? { x: 0, z: 0 } : this.input.move;
    const moveMagnitude = Math.hypot(axes.x, axes.z);
    const wantsSprint =
      !this.movementLocked &&
      !this.input.crouch &&
      this.input.sprint &&
      moveMagnitude > 0.05 &&
      this.stamina > 0.5;

    if (wantsSprint) {
      this.stamina = Math.max(0, this.stamina - 24 * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 17 * dt);
    }

    rotation.setFromEulerAngles(0, this.input.yaw, 0);
    rotation.transformVector(Vec3.FORWARD, forward);
    rotation.transformVector(Vec3.RIGHT, right);

    const speed = this.movementLocked
      ? 0
      : this.input.crouch
        ? 2.2
        : wantsSprint
          ? 6.2
          : moveMagnitude < 0.55
            ? 2.6
            : 3.8;

    const horizontalX = (right.x * axes.x + forward.x * axes.z) * speed * dt;
    const horizontalZ = (right.z * axes.x + forward.z * axes.z) * speed * dt;

    if (!this.movementLocked && this.input.consumeJump() && this.grounded) {
      this.verticalVelocity = 6.7;
      this.grounded = false;
      this.jumpMotionTimer = 0.42;
    }

    this.verticalVelocity += -19.5 * dt;
    this.verticalVelocity = Math.max(this.verticalVelocity, -18);
    this.jumpMotionTimer = Math.max(0, this.jumpMotionTimer - dt);

    this.character.computeColliderMovement(this.collider, {
      x: horizontalX,
      y: this.verticalVelocity * dt,
      z: horizontalZ,
    });

    const movement = this.character.computedMovement();
    this.grounded = this.character.computedGrounded();
    if (this.grounded && this.verticalVelocity < 0) {
      this.verticalVelocity = -0.6;
    }

    const position = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: position.x + movement.x,
      y: position.y + movement.y,
      z: position.z + movement.z,
    });

    this.world.timestep = dt;
    this.world.step();

    if (this.movementLocked || moveMagnitude <= 0.05) {
      this.motion = this.jumpMotionTimer > 0 ? 'jump' : 'idle';
    } else if (this.jumpMotionTimer > 0 && !this.grounded) {
      this.motion = 'jump';
    } else if (this.input.crouch || moveMagnitude < 0.55) {
      this.motion = 'walk';
    } else if (wantsSprint) {
      this.motion = 'sprint';
    } else {
      this.motion = 'run';
    }

    this.avatar.update(this.position, this.input.yaw, this.motion);
    this.syncCamera(dt);
  }

  reset(): void {
    this.verticalVelocity = 0;
    this.jumpMotionTimer = 0;
    this.motion = 'idle';
    this.stamina = 100;
    this.movementLocked = false;
    this.body.setTranslation(this.spawn, true);
    this.body.setNextKinematicTranslation(this.spawn);
    this.avatar.update(this.spawn, this.input.yaw, 'idle');
    this.syncCamera(1 / 60);
  }

  private syncCamera(deltaSeconds: number): void {
    const position = this.body.translation();
    const targetEyeHeight = this.input.crouch ? 1.1 : 1.62;
    const blend = 1 - Math.exp(-12 * Math.min(Math.max(deltaSeconds, 0), 0.1));
    this.eyeHeight += (targetEyeHeight - this.eyeHeight) * blend;

    const eye = {
      x: position.x,
      y: position.y + this.eyeHeight,
      z: position.z,
    };

    if (this.view === 'first-person') {
      this.camera.setPosition(eye.x, eye.y, eye.z);
      this.camera.setEulerAngles(this.input.pitch, this.input.yaw, 0);
      return;
    }

    rotation.setFromEulerAngles(0, this.input.yaw, 0);
    rotation.transformVector(Vec3.FORWARD, forward);

    const pitchRadians = (this.input.pitch * Math.PI) / 180;
    const horizontalDistance = Math.cos(pitchRadians) * this.cameraDistance;
    const verticalOffset = -Math.sin(pitchRadians) * 1.35 + this.cameraHeight;

    const desired = {
      x: eye.x - forward.x * horizontalDistance,
      y: eye.y + verticalOffset,
      z: eye.z - forward.z * horizontalDistance,
    };

    const dx = desired.x - eye.x;
    const dy = desired.y - eye.y;
    const dz = desired.z - eye.z;
    const distance = Math.max(0.001, Math.hypot(dx, dy, dz));
    const ray = new RAPIER.Ray(
      { x: eye.x, y: eye.y, z: eye.z },
      { x: dx / distance, y: dy / distance, z: dz / distance },
    );
    const hit = this.world.castRay(ray, distance, true, undefined, undefined, this.collider);
    const safeDistance = hit ? Math.max(0.35, hit.timeOfImpact - 0.18) : distance;

    const cameraX = eye.x + (dx / distance) * safeDistance;
    const cameraY = eye.y + (dy / distance) * safeDistance;
    const cameraZ = eye.z + (dz / distance) * safeDistance;

    this.camera.setPosition(cameraX, cameraY, cameraZ);
    this.camera.lookAt(eye.x, eye.y + 0.15, eye.z);
  }
}
