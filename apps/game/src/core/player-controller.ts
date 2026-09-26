import RAPIER from '@dimforge/rapier3d-compat';
import { Entity } from 'playcanvas';
import type { MotionState } from './character-system';
import type { InputController } from './input-controller';

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

  constructor(
    private readonly world: RAPIER.World,
    private readonly camera: Entity,
    private readonly input: InputController,
    private readonly spawn = { x: 0, y: 2.2, z: 38 },
  ) {
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.62, 0.34).setFriction(0),
      this.body,
    );

    this.character = world.createCharacterController(0.025);
    this.character.enableAutostep(0.42, 0.18, true);
    this.character.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.character.setMinSlopeSlideAngle((30 * Math.PI) / 180);
    this.character.setApplyImpulsesToDynamicBodies(true);

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

  setMovementLocked(locked: boolean): void {
    this.movementLocked = locked;
  }

  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 1 / 30);

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

    const yaw = (this.input.yaw * Math.PI) / 180;
    const forwardX = Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = Math.sin(yaw);

    const speed = this.movementLocked
      ? 0
      : this.input.crouch
        ? 2.2
        : wantsSprint
          ? 6.2
          : moveMagnitude < 0.55
            ? 2.6
            : 3.8;

    const horizontalX = (rightX * axes.x + forwardX * axes.z) * speed * dt;
    const horizontalZ = (rightZ * axes.x + forwardZ * axes.z) * speed * dt;

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
    this.syncCamera(1 / 60);
  }

  private syncCamera(deltaSeconds: number): void {
    const position = this.body.translation();
    const targetEyeHeight = this.input.crouch ? 1.1 : 1.62;
    const blend = Math.min(1, deltaSeconds * 12);
    this.eyeHeight += (targetEyeHeight - this.eyeHeight) * blend;

    this.camera.setPosition(position.x, position.y + this.eyeHeight, position.z);
    this.camera.setEulerAngles(this.input.pitch, this.input.yaw, 0);
  }
}
