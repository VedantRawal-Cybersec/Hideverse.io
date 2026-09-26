import RAPIER from '@dimforge/rapier3d-compat';
import { Entity, Quat, Vec3 } from 'playcanvas';
import type { MapBox } from '../maps/map-catalog';
import type { MotionState } from './character-system';
import type { InputController } from './input-controller';

export type PlayerViewMode = 'first-person' | 'third-person';

const viewModeKey = 'hideverse-view-mode';
const forward = new Vec3();
const right = new Vec3();
const rotation = new Quat();
const desiredCamera = new Vec3();
const cameraTarget = new Vec3();

function damp(rate: number, deltaSeconds: number): number {
  return 1 - Math.exp(-rate * deltaSeconds);
}

function lerpAngle(from: number, to: number, alpha: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return from + delta * alpha;
}

function readViewMode(): PlayerViewMode {
  return localStorage.getItem(viewModeKey) === 'third-person' ? 'third-person' : 'first-person';
}

function segmentAabbHit(
  origin: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  box: MapBox,
  margin = 0.22,
): number | null {
  const direction = {
    x: target.x - origin.x,
    y: target.y - origin.y,
    z: target.z - origin.z,
  };
  const min = {
    x: box.position[0] - box.size[0] / 2 - margin,
    y: box.position[1] - box.size[1] / 2 - margin,
    z: box.position[2] - box.size[2] / 2 - margin,
  };
  const max = {
    x: box.position[0] + box.size[0] / 2 + margin,
    y: box.position[1] + box.size[1] / 2 + margin,
    z: box.position[2] + box.size[2] / 2 + margin,
  };

  let tMin = 0;
  let tMax = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const d = direction[axis];
    if (Math.abs(d) < 1e-6) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
      continue;
    }

    const inverse = 1 / d;
    let t1 = (min[axis] - origin[axis]) * inverse;
    let t2 = (max[axis] - origin[axis]) * inverse;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  return tMin >= 0 && tMin <= 1 ? tMin : null;
}

export class FirstPersonController {
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly character: RAPIER.KinematicCharacterController;
  private readonly cameraCollision: MapBox[];
  private verticalVelocity = 0;
  private grounded = false;
  private movementLocked = false;
  private stamina = 100;
  private motion: MotionState = 'idle';
  private jumpMotionTimer = 0;
  private eyeHeight = 1.62;
  private horizontalVelocityX = 0;
  private horizontalVelocityZ = 0;
  private mode: PlayerViewMode = readViewMode();
  private characterYaw = 0;
  private cameraDistance = 4.1;

  constructor(
    private readonly world: RAPIER.World,
    private readonly camera: Entity,
    private readonly input: InputController,
    private readonly spawn = { x: 0, y: 2.2, z: 38 },
    cameraCollision: readonly MapBox[] = [],
  ) {
    this.cameraCollision = [...cameraCollision].filter(
      (box) => box.size[0] > 0.25 && box.size[1] > 0.35 && box.size[2] > 0.25,
    );
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.62, 0.34).setFriction(0.25),
      this.body,
    );

    this.character = world.createCharacterController(0.035);
    this.character.enableAutostep(0.38, 0.18, true);
    this.character.enableSnapToGround(0.28);
    this.character.setMaxSlopeClimbAngle((48 * Math.PI) / 180);
    this.character.setMinSlopeSlideAngle((32 * Math.PI) / 180);
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
    return this.mode === 'third-person' ? this.characterYaw : this.input.yaw;
  }

  get viewMode(): PlayerViewMode {
    return this.mode;
  }

  setMovementLocked(locked: boolean): void {
    this.movementLocked = locked;
  }

  togglePerspective(): void {
    this.mode = this.mode === 'first-person' ? 'third-person' : 'first-person';
    localStorage.setItem(viewModeKey, this.mode);
    this.horizontalVelocityX = 0;
    this.horizontalVelocityZ = 0;
    this.syncCamera(1 / 60);
  }

  update(deltaSeconds: number): void {
    const dt = Math.min(Math.max(deltaSeconds, 0), 1 / 20);

    if (this.input.consumePerspectiveToggle()) this.togglePerspective();

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
      this.stamina = Math.max(0, this.stamina - 23 * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 18 * dt);
    }

    rotation.setFromEulerAngles(0, this.input.yaw, 0);
    rotation.transformVector(Vec3.FORWARD, forward);
    rotation.transformVector(Vec3.RIGHT, right);

    const targetSpeed = this.movementLocked
      ? 0
      : this.input.crouch
        ? 2.15
        : wantsSprint
          ? 6.15
          : moveMagnitude < 0.55
            ? 2.65
            : 3.95;

    const desiredX = (right.x * axes.x + forward.x * axes.z) * targetSpeed;
    const desiredZ = (right.z * axes.x + forward.z * axes.z) * targetSpeed;
    const acceleration = this.grounded ? (moveMagnitude > 0.05 ? 16 : 22) : 4.5;
    const horizontalBlend = damp(acceleration, dt);
    this.horizontalVelocityX += (desiredX - this.horizontalVelocityX) * horizontalBlend;
    this.horizontalVelocityZ += (desiredZ - this.horizontalVelocityZ) * horizontalBlend;

    if (!this.movementLocked && this.input.consumeJump() && this.grounded) {
      this.verticalVelocity = 6.55;
      this.grounded = false;
      this.jumpMotionTimer = 0.44;
    }

    this.verticalVelocity += -20.5 * dt;
    this.verticalVelocity = Math.max(this.verticalVelocity, -19);
    this.jumpMotionTimer = Math.max(0, this.jumpMotionTimer - dt);

    this.character.computeColliderMovement(this.collider, {
      x: this.horizontalVelocityX * dt,
      y: this.verticalVelocity * dt,
      z: this.horizontalVelocityZ * dt,
    });

    const movement = this.character.computedMovement();
    this.grounded = this.character.computedGrounded();
    if (this.grounded && this.verticalVelocity < 0) this.verticalVelocity = -0.35;

    const position = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: position.x + movement.x,
      y: position.y + movement.y,
      z: position.z + movement.z,
    });

    this.world.timestep = dt;
    this.world.step();

    const actualSpeed = Math.hypot(this.horizontalVelocityX, this.horizontalVelocityZ);
    if (this.movementLocked || actualSpeed < 0.08) {
      this.motion = this.jumpMotionTimer > 0 ? 'jump' : 'idle';
    } else if (this.jumpMotionTimer > 0 && !this.grounded) {
      this.motion = 'jump';
    } else if (this.input.crouch || actualSpeed < 2.9) {
      this.motion = 'walk';
    } else if (wantsSprint && actualSpeed > 4.4) {
      this.motion = 'sprint';
    } else {
      this.motion = 'run';
    }

    if (actualSpeed > 0.18) {
      const targetYaw =
        (Math.atan2(this.horizontalVelocityX, -this.horizontalVelocityZ) * 180) / Math.PI;
      this.characterYaw = lerpAngle(this.characterYaw, targetYaw, damp(12, dt));
    } else if (this.mode === 'first-person') {
      this.characterYaw = this.input.yaw;
    }

    this.syncCamera(dt);
  }

  reset(): void {
    this.verticalVelocity = 0;
    this.horizontalVelocityX = 0;
    this.horizontalVelocityZ = 0;
    this.jumpMotionTimer = 0;
    this.motion = 'idle';
    this.stamina = 100;
    this.movementLocked = false;
    this.characterYaw = this.input.yaw;
    this.body.setTranslation(this.spawn, true);
    this.body.setNextKinematicTranslation(this.spawn);
    this.syncCamera(1 / 60);
  }

  private syncCamera(deltaSeconds: number): void {
    const position = this.body.translation();
    const targetEyeHeight = this.input.crouch ? 1.1 : 1.62;
    const blend = damp(12, deltaSeconds);
    this.eyeHeight += (targetEyeHeight - this.eyeHeight) * blend;

    if (this.mode === 'first-person') {
      this.camera.setPosition(position.x, position.y + this.eyeHeight, position.z);
      this.camera.setEulerAngles(this.input.pitch, this.input.yaw, 0);
      return;
    }

    cameraTarget.set(position.x, position.y + (this.input.crouch ? 1.15 : 1.38), position.z);
    const pitch = Math.max(-38, Math.min(62, this.input.pitch * 0.72 + 10));
    rotation.setFromEulerAngles(pitch, this.input.yaw, 0);
    rotation.transformVector(Vec3.FORWARD, forward);

    desiredCamera.copy(cameraTarget).sub(forward.mulScalar(this.cameraDistance));
    desiredCamera.y += 0.35;

    let nearestHit = 1;
    for (const box of this.cameraCollision) {
      const hit = segmentAabbHit(cameraTarget, desiredCamera, box);
      if (hit !== null && hit < nearestHit) nearestHit = hit;
    }

    if (nearestHit < 1) {
      const safe = Math.max(0.08, nearestHit - 0.05);
      desiredCamera.set(
        cameraTarget.x + (desiredCamera.x - cameraTarget.x) * safe,
        cameraTarget.y + (desiredCamera.y - cameraTarget.y) * safe,
        cameraTarget.z + (desiredCamera.z - cameraTarget.z) * safe,
      );
    }

    const current = this.camera.getPosition();
    const cameraBlend = damp(14, deltaSeconds);
    this.camera.setPosition(
      current.x + (desiredCamera.x - current.x) * cameraBlend,
      current.y + (desiredCamera.y - current.y) * cameraBlend,
      current.z + (desiredCamera.z - current.z) * cameraBlend,
    );
    this.camera.lookAt(cameraTarget);
  }
}
