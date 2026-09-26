import RAPIER from '@dimforge/rapier3d-compat';
import { Entity } from 'playcanvas';
import type { InputController } from './input-controller';

export class FirstPersonController {
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly character: RAPIER.KinematicCharacterController;
  private verticalVelocity = 0;
  private grounded = false;
  private movementLocked = false;

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

    this.syncCamera();
  }

  get position(): { x: number; y: number; z: number } {
    const position = this.body.translation();
    return { x: position.x, y: position.y, z: position.z };
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
    const yaw = (this.input.yaw * Math.PI) / 180;
    const forwardX = Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = Math.sin(yaw);

    const speed = this.movementLocked ? 0 : this.input.crouch ? 2.2 : this.input.sprint ? 6.2 : 3.8;
    const horizontalX = (rightX * axes.x + forwardX * axes.z) * speed * dt;
    const horizontalZ = (rightZ * axes.x + forwardZ * axes.z) * speed * dt;

    if (!this.movementLocked && this.input.consumeJump() && this.grounded) {
      this.verticalVelocity = 6.7;
      this.grounded = false;
    }

    this.verticalVelocity += -19.5 * dt;
    this.verticalVelocity = Math.max(this.verticalVelocity, -18);

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
    this.syncCamera();
  }

  reset(): void {
    this.verticalVelocity = 0;
    this.body.setTranslation(this.spawn, true);
    this.body.setNextKinematicTranslation(this.spawn);
    this.syncCamera();
  }

  private syncCamera(): void {
    const position = this.body.translation();
    const eyeHeight = this.input.crouch ? 1.1 : 1.62;
    this.camera.setPosition(position.x, position.y + eyeHeight, position.z);
    this.camera.setEulerAngles(this.input.pitch, this.input.yaw, 0);
  }
}
