import { Application, Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { AudioFeedback } from './audio-feedback';
import type { CharacterSystem, CombatHit, ThreatSnapshot } from './character-system';
import type { InputController } from './input-controller';
import type { PlayerViewMode } from './player-avatar';

type WeaponId = 'assault' | 'smg' | 'shotgun';

type WeaponDefinition = {
  id: WeaponId;
  name: string;
  magazine: number;
  reserve: number;
  damage: number;
  fireInterval: number;
  recoil: number;
  spread: number;
  adsSpreadScale: number;
  adsFov: number;
  reloadSeconds: number;
  automatic: boolean;
  pellets: number;
  color: [number, number, number];
  bodyScale: [number, number, number];
  barrelScale: [number, number, number];
  muzzleZ: number;
};

type WeaponState = {
  ammo: number;
  reserve: number;
};

type FxKind = 'tracer' | 'impact' | 'shell';

type FxRuntime = {
  entity: Entity;
  kind: FxKind;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
};

const weapons: WeaponDefinition[] = [
  {
    id: 'assault',
    name: 'VANGUARD AR',
    magazine: 30,
    reserve: 120,
    damage: 24,
    fireInterval: 0.092,
    recoil: 1,
    spread: 0.006,
    adsSpreadScale: 0.38,
    adsFov: 56,
    reloadSeconds: 1.45,
    automatic: true,
    pellets: 1,
    color: [0.16, 0.18, 0.2],
    bodyScale: [0.13, 0.12, 0.52],
    barrelScale: [0.055, 0.055, 0.4],
    muzzleZ: -0.73,
  },
  {
    id: 'smg',
    name: 'RIFT SMG',
    magazine: 36,
    reserve: 144,
    damage: 18,
    fireInterval: 0.062,
    recoil: 0.68,
    spread: 0.011,
    adsSpreadScale: 0.45,
    adsFov: 60,
    reloadSeconds: 1.2,
    automatic: true,
    pellets: 1,
    color: [0.12, 0.2, 0.24],
    bodyScale: [0.14, 0.12, 0.4],
    barrelScale: [0.05, 0.05, 0.3],
    muzzleZ: -0.61,
  },
  {
    id: 'shotgun',
    name: 'BREACH-12',
    magazine: 8,
    reserve: 40,
    damage: 14,
    fireInterval: 0.64,
    recoil: 1.8,
    spread: 0.045,
    adsSpreadScale: 0.62,
    adsFov: 62,
    reloadSeconds: 1.8,
    automatic: false,
    pellets: 8,
    color: [0.22, 0.16, 0.11],
    bodyScale: [0.15, 0.13, 0.6],
    barrelScale: [0.07, 0.07, 0.48],
    muzzleZ: -0.86,
  },
];

const shotDirection = new Vec3();
const muzzleForward = new Vec3();
const fxRight = new Vec3();
const fxUp = new Vec3();

function required<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Hideverse combat HUD is missing ${selector}`);
  return element as T;
}

function weaponMaterial(color: [number, number, number]): StandardMaterial {
  const material = new StandardMaterial();
  material.diffuse = new Color(color[0], color[1], color[2]);
  material.metalness = 0.52;
  material.gloss = 0.46;
  material.update();
  return material;
}

function accentMaterial(): StandardMaterial {
  const material = new StandardMaterial();
  material.diffuse = new Color(0.5, 0.58, 0.62);
  material.emissive = new Color(0.12, 0.18, 0.2);
  material.emissiveIntensity = 0.14;
  material.metalness = 0.35;
  material.gloss = 0.58;
  material.update();
  return material;
}

function emissiveMaterial(color: [number, number, number], intensity: number): StandardMaterial {
  const material = new StandardMaterial();
  material.diffuse = new Color(color[0], color[1], color[2]);
  material.emissive = new Color(color[0], color[1], color[2]);
  material.emissiveIntensity = intensity;
  material.gloss = 0.18;
  material.update();
  return material;
}

function part(
  parent: Entity,
  name: string,
  scale: [number, number, number],
  position: [number, number, number],
  material: StandardMaterial,
  rotation: [number, number, number] = [0, 0, 0],
): Entity {
  const entity = new Entity(name);
  entity.addComponent('render', { type: 'box' });
  entity.setLocalScale(scale[0], scale[1], scale[2]);
  entity.setLocalPosition(position[0], position[1], position[2]);
  entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
  if (entity.render) entity.render.material = material;
  parent.addChild(entity);
  return entity;
}

export class CombatSystem {
  private readonly root = new Entity('fps-viewmodel');
  private readonly fxRoot = new Entity('combat-fx-root');
  private readonly modelRoots = new Map<WeaponId, Entity>();
  private readonly muzzleFlashes = new Map<WeaponId, Entity>();
  private readonly state = new Map<WeaponId, WeaponState>();
  private readonly fxPool: FxRuntime[] = [];

  private currentIndex = 0;
  private fireCooldown = 0;
  private reloadRemaining = 0;
  private triggerLatched = false;
  private viewKick = 0;
  private recoilPitchVisual = 0;
  private recoilYawVisual = 0;
  private muzzleFlashSeconds = 0;
  private hitMarkerSeconds = 0;
  private eliminationSeconds = 0;
  private weaponTime = 0;
  private enabled = true;
  private lastHud = '';
  private health = 100;
  private armor = 100;
  private incomingDamageCooldown = 0;
  private eliminatedQueued = false;
  private shotSeed = 0x53a9c1ef;
  private fxCursor = 0;

  private readonly hudWeapon = required<HTMLElement>('#combat-weapon');
  private readonly hudAmmo = required<HTMLElement>('#combat-ammo');
  private readonly hudReserve = required<HTMLElement>('#combat-reserve');
  private readonly hudState = required<HTMLElement>('#combat-state');
  private readonly hudHealth = required<HTMLElement>('#combat-health');
  private readonly hudArmor = required<HTMLElement>('#combat-armor');
  private readonly crosshair = required<HTMLElement>('.crosshair');
  private readonly hitMarker = required<HTMLElement>('#hit-marker');
  private readonly eliminate = required<HTMLElement>('#eliminate-notice');

  constructor(
    private readonly app: Application,
    private readonly camera: Entity,
    private readonly input: InputController,
    private readonly characters: CharacterSystem,
    private readonly audio: AudioFeedback,
  ) {
    for (const weapon of weapons) {
      this.state.set(weapon.id, {
        ammo: weapon.magazine,
        reserve: weapon.reserve,
      });
      this.modelRoots.set(weapon.id, this.createViewModel(weapon));
    }

    this.camera.addChild(this.root);
    this.app.root.addChild(this.fxRoot);
    this.createFxPool();
    this.root.setLocalPosition(0.2, -0.22, -0.44);
    this.activateModel();
    this.updateHud(true);
  }

  get weaponName(): string {
    return this.weapon.name;
  }

  get ammo(): number {
    return this.weaponState.ammo;
  }

  get reserve(): number {
    return this.weaponState.reserve;
  }

  get healthPercent(): number {
    return this.health;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  update(deltaSeconds: number, viewMode: PlayerViewMode): void {
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.1);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.hitMarkerSeconds = Math.max(0, this.hitMarkerSeconds - dt);
    this.eliminationSeconds = Math.max(0, this.eliminationSeconds - dt);
    this.muzzleFlashSeconds = Math.max(0, this.muzzleFlashSeconds - dt);
    this.incomingDamageCooldown = Math.max(0, this.incomingDamageCooldown - dt);
    this.weaponTime += dt;

    this.updateFx(dt);

    const directSlot = this.input.consumeWeaponSwitch();
    if (directSlot !== null) this.switchWeapon(Math.max(0, Math.min(2, directSlot - 1)));
    if (this.input.consumeWeaponCycle()) {
      this.switchWeapon((this.currentIndex + 1) % weapons.length);
    }

    if (this.input.consumeReload()) this.startReload();

    if (this.reloadRemaining > 0) {
      this.reloadRemaining = Math.max(0, this.reloadRemaining - dt);
      if (this.reloadRemaining === 0) this.finishReload();
    }

    const firstPerson = viewMode === 'first-person';
    this.root.enabled = firstPerson;
    const aiming = firstPerson && this.enabled && this.input.aim && this.reloadRemaining <= 0;

    const cameraComponent = this.camera.camera;
    if (cameraComponent) {
      const targetFov = aiming ? this.weapon.adsFov : 82;
      const fovBlend = 1 - Math.exp(-14 * dt);
      cameraComponent.fov += (targetFov - cameraComponent.fov) * fovBlend;
    }

    const axes = this.input.move;
    const moveMagnitude = Math.min(1, Math.hypot(axes.x, axes.z));
    const bobStrength = aiming ? 0.18 : this.input.sprint ? 1.15 : 0.65;
    const bobFrequency = this.input.sprint ? 12.5 : 8.5;
    const bobX = Math.sin(this.weaponTime * bobFrequency) * 0.009 * moveMagnitude * bobStrength;
    const bobY =
      Math.abs(Math.cos(this.weaponTime * bobFrequency)) * 0.007 * moveMagnitude * bobStrength;

    const reloadProgress =
      this.reloadRemaining > 0
        ? 1 - this.reloadRemaining / Math.max(0.001, this.weapon.reloadSeconds)
        : 0;
    const reloadArc = this.reloadRemaining > 0 ? Math.sin(reloadProgress * Math.PI) : 0;

    const targetX = (aiming ? 0.012 : 0.2) + bobX;
    const targetY = (aiming ? -0.185 : -0.22) - bobY - reloadArc * 0.11;
    const targetZ = aiming ? -0.37 : -0.44;
    const position = this.root.getLocalPosition();
    const viewBlend = 1 - Math.exp(-18 * dt);

    this.viewKick += (0 - this.viewKick) * (1 - Math.exp(-22 * dt));
    this.recoilPitchVisual += (0 - this.recoilPitchVisual) * (1 - Math.exp(-17 * dt));
    this.recoilYawVisual += (0 - this.recoilYawVisual) * (1 - Math.exp(-20 * dt));

    this.root.setLocalPosition(
      position.x + (targetX - position.x) * viewBlend,
      position.y + (targetY - position.y) * viewBlend,
      position.z + (targetZ + this.viewKick - position.z) * viewBlend,
    );
    this.root.setLocalEulerAngles(
      this.recoilPitchVisual + reloadArc * 18,
      this.recoilYawVisual,
      reloadArc * 38,
    );

    const flash = this.muzzleFlashes.get(this.weapon.id);
    if (flash) {
      flash.enabled = this.muzzleFlashSeconds > 0 && firstPerson;
      if (flash.enabled) {
        const pulse = 0.8 + this.muzzleFlashSeconds * 8;
        flash.setLocalScale(0.12 * pulse, 0.12 * pulse, 0.18 * pulse);
        flash.setLocalEulerAngles(0, 0, this.weaponTime * 900);
      }
    }

    const wantsFire = firstPerson && this.enabled && this.input.fire && this.reloadRemaining <= 0;
    const canTrigger = this.weapon.automatic ? wantsFire : wantsFire && !this.triggerLatched;
    if (canTrigger && this.fireCooldown <= 0) this.fire(aiming);

    if (!this.input.fire) this.triggerLatched = false;
    else if (!this.weapon.automatic) this.triggerLatched = true;

    this.crosshair.classList.toggle('is-aiming', aiming);
    this.hitMarker.classList.toggle('is-visible', this.hitMarkerSeconds > 0);
    this.eliminate.classList.toggle('is-visible', this.eliminationSeconds > 0);
    this.updateHud();
  }

  applyThreat(threat: ThreatSnapshot, deltaSeconds: number): void {
    if (this.health <= 0) return;
    this.incomingDamageCooldown = Math.max(
      0,
      this.incomingDamageCooldown - Math.min(Math.max(deltaSeconds, 0), 0.1),
    );
    if (
      !threat.detected ||
      threat.danger < 0.42 ||
      !Number.isFinite(threat.distance) ||
      threat.distance > 18 ||
      this.incomingDamageCooldown > 0
    ) {
      return;
    }

    const roleDamage =
      threat.role === 'monster'
        ? 19
        : threat.role === 'seeker'
          ? 13
          : threat.role === 'traitor'
            ? 12
            : 9;
    const damage = roleDamage * (0.68 + Math.min(1, threat.danger) * 0.42);
    const armorShare = Math.min(this.armor, damage * 0.62);
    this.armor = Math.max(0, this.armor - armorShare);
    this.health = Math.max(0, this.health - (damage - armorShare));
    this.incomingDamageCooldown = Math.max(0.52, 1.05 - threat.danger * 0.32);
    this.audio.cue('damage');

    if (this.health <= 0 && !this.eliminatedQueued) {
      this.eliminatedQueued = true;
      this.audio.cue('lose');
    }

    this.updateHud(true);
  }

  consumePlayerEliminated(): boolean {
    const queued = this.eliminatedQueued;
    this.eliminatedQueued = false;
    return queued;
  }

  reset(): void {
    for (const weapon of weapons) {
      this.state.set(weapon.id, {
        ammo: weapon.magazine,
        reserve: weapon.reserve,
      });
    }
    this.currentIndex = 0;
    this.fireCooldown = 0;
    this.reloadRemaining = 0;
    this.triggerLatched = false;
    this.viewKick = 0;
    this.recoilPitchVisual = 0;
    this.recoilYawVisual = 0;
    this.muzzleFlashSeconds = 0;
    this.hitMarkerSeconds = 0;
    this.eliminationSeconds = 0;
    this.health = 100;
    this.armor = 100;
    this.incomingDamageCooldown = 0;
    this.eliminatedQueued = false;
    this.shotSeed = 0x53a9c1ef;
    this.activateModel();
    this.clearFx();
    this.updateHud(true);
  }

  destroy(): void {
    this.root.destroy();
    this.fxRoot.destroy();
  }

  private get weapon(): WeaponDefinition {
    return weapons[this.currentIndex]!;
  }

  private get weaponState(): WeaponState {
    return this.state.get(this.weapon.id)!;
  }

  private switchWeapon(index: number): void {
    if (index === this.currentIndex) return;
    this.currentIndex = index;
    this.reloadRemaining = 0;
    this.fireCooldown = 0.12;
    this.triggerLatched = false;
    this.muzzleFlashSeconds = 0;
    this.activateModel();
    this.updateHud(true);
  }

  private activateModel(): void {
    for (const [id, model] of this.modelRoots) {
      model.enabled = id === this.weapon.id;
    }
  }

  private startReload(): void {
    const state = this.weaponState;
    if (this.reloadRemaining > 0 || state.ammo >= this.weapon.magazine || state.reserve <= 0) {
      return;
    }
    this.reloadRemaining = this.weapon.reloadSeconds;
    this.fireCooldown = Math.max(this.fireCooldown, 0.16);
    this.audio.cue('reload');
    this.updateHud(true);
  }

  private finishReload(): void {
    const state = this.weaponState;
    const needed = this.weapon.magazine - state.ammo;
    const moved = Math.min(needed, state.reserve);
    state.ammo += moved;
    state.reserve -= moved;
    this.updateHud(true);
  }

  private fire(aiming: boolean): void {
    const state = this.weaponState;
    if (state.ammo <= 0) {
      this.audio.cue('empty');
      this.fireCooldown = 0.18;
      return;
    }

    state.ammo -= 1;
    this.fireCooldown = this.weapon.fireInterval;
    this.audio.cue('shoot');
    this.viewKick = Math.min(0.095, this.viewKick + 0.04 * this.weapon.recoil);
    this.recoilPitchVisual -= 2.6 * this.weapon.recoil;
    this.recoilYawVisual += (this.nextRandom() - 0.5) * 1.8 * this.weapon.recoil;
    this.muzzleFlashSeconds = 0.045;

    const recoilYaw = (this.nextRandom() - 0.5) * 0.32 * this.weapon.recoil;
    const recoilPitch = -0.48 * this.weapon.recoil;
    this.input.addLookImpulse(recoilYaw, recoilPitch);

    const origin = this.camera.getPosition();
    const cameraRotation = this.camera.getRotation();
    cameraRotation.transformVector(Vec3.FORWARD, muzzleForward);

    const spread = this.weapon.spread * (aiming ? this.weapon.adsSpreadScale : 1);
    let bestHit: CombatHit | null = null;
    let tracerDirectionX = muzzleForward.x;
    let tracerDirectionY = muzzleForward.y;
    let tracerDirectionZ = muzzleForward.z;

    for (let pellet = 0; pellet < this.weapon.pellets; pellet += 1) {
      shotDirection.copy(muzzleForward);
      shotDirection.x += (this.nextRandom() - 0.5) * spread;
      shotDirection.y += (this.nextRandom() - 0.5) * spread;
      shotDirection.z += (this.nextRandom() - 0.5) * spread;
      shotDirection.normalize();

      if (pellet === 0) {
        tracerDirectionX = shotDirection.x;
        tracerDirectionY = shotDirection.y;
        tracerDirectionZ = shotDirection.z;
      }

      const hit = this.characters.fireHitscan(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: shotDirection.x, y: shotDirection.y, z: shotDirection.z },
        this.weapon.damage,
      );

      if (!hit) continue;
      if (!bestHit || hit.distance < bestHit.distance || hit.eliminated) bestHit = hit;
    }

    const tracerEnd = bestHit
      ? bestHit.point
      : ([
          origin.x + tracerDirectionX * 52,
          origin.y + tracerDirectionY * 52,
          origin.z + tracerDirectionZ * 52,
        ] as [number, number, number]);
    this.spawnTracer([origin.x, origin.y, origin.z], tracerEnd);
    this.spawnShell();

    if (bestHit) {
      this.spawnImpact(bestHit.point, bestHit.headshot);
      this.hitMarkerSeconds = bestHit.headshot ? 0.18 : 0.12;
      this.audio.cue(bestHit.eliminated ? 'eliminate' : 'hit');
      this.hitMarker.classList.toggle('is-headshot', bestHit.headshot);
      if (bestHit.eliminated) {
        this.eliminationSeconds = 0.95;
        this.eliminate.textContent = `ELIMINATED · ${bestHit.role.toUpperCase()}`;
      }
    } else {
      this.hitMarker.classList.remove('is-headshot');
    }

    this.updateHud(true);
  }

  private createViewModel(definition: WeaponDefinition): Entity {
    const weaponRoot = new Entity(`viewmodel-${definition.id}`);
    const primary = weaponMaterial(definition.color);
    const accent = accentMaterial();
    const dark = weaponMaterial([
      definition.color[0] * 0.52,
      definition.color[1] * 0.52,
      definition.color[2] * 0.52,
    ]);

    part(weaponRoot, `${definition.id}-receiver`, definition.bodyScale, [0, 0, -0.05], primary);
    part(
      weaponRoot,
      `${definition.id}-barrel`,
      definition.barrelScale,
      [0, 0.018, definition.muzzleZ + definition.barrelScale[2] * 0.42],
      accent,
    );

    if (definition.id === 'assault') {
      part(weaponRoot, 'assault-stock', [0.12, 0.105, 0.25], [0, -0.005, 0.3], dark);
      part(weaponRoot, 'assault-handguard', [0.145, 0.1, 0.28], [0, 0, -0.34], primary);
      part(weaponRoot, 'assault-magazine', [0.085, 0.2, 0.12], [0, -0.15, 0.06], dark, [-13, 0, 0]);
      part(weaponRoot, 'assault-rail', [0.075, 0.025, 0.31], [0, 0.09, -0.14], accent);
      part(weaponRoot, 'assault-optic', [0.07, 0.065, 0.105], [0, 0.135, -0.05], dark);
      part(weaponRoot, 'assault-muzzle', [0.07, 0.07, 0.11], [0, 0.018, -0.7], dark);
    } else if (definition.id === 'smg') {
      part(weaponRoot, 'smg-stock', [0.085, 0.075, 0.2], [0, 0, 0.25], dark);
      part(weaponRoot, 'smg-foregrip', [0.07, 0.15, 0.08], [0, -0.12, -0.27], dark, [-8, 0, 0]);
      part(weaponRoot, 'smg-magazine', [0.07, 0.19, 0.09], [0, -0.16, 0.03], primary);
      part(weaponRoot, 'smg-sight', [0.055, 0.05, 0.08], [0, 0.115, -0.08], accent);
    } else {
      part(weaponRoot, 'shotgun-stock', [0.13, 0.11, 0.31], [0, -0.005, 0.4], dark);
      part(weaponRoot, 'shotgun-pump', [0.16, 0.12, 0.24], [0, -0.02, -0.44], primary);
      part(weaponRoot, 'shotgun-tube', [0.045, 0.045, 0.52], [0, -0.075, -0.51], accent);
      part(weaponRoot, 'shotgun-sight', [0.03, 0.04, 0.04], [0, 0.115, -0.52], accent);
    }

    const grip = part(
      weaponRoot,
      `${definition.id}-grip`,
      [0.065, 0.18, 0.08],
      [0, -0.12, 0.02],
      primary,
      [-12, 0, 0],
    );
    grip.setLocalEulerAngles(-12, 0, 0);

    const flash = new Entity(`${definition.id}-muzzle-flash`);
    flash.addComponent('render', { type: 'sphere' });
    flash.setLocalPosition(0, 0.018, definition.muzzleZ);
    if (flash.render) {
      flash.render.material = emissiveMaterial([1, 0.58, 0.16], 2.4);
    }
    flash.enabled = false;
    weaponRoot.addChild(flash);
    this.muzzleFlashes.set(definition.id, flash);

    this.root.addChild(weaponRoot);
    return weaponRoot;
  }

  private createFxPool(): void {
    const tracerMaterial = emissiveMaterial([1, 0.62, 0.22], 1.6);
    const impactMaterial = emissiveMaterial([1, 0.78, 0.38], 1.2);
    const shellMaterial = weaponMaterial([0.48, 0.34, 0.12]);

    for (let index = 0; index < 10; index += 1) {
      const entity = new Entity(`tracer-${index}`);
      entity.addComponent('render', { type: 'box' });
      if (entity.render) entity.render.material = tracerMaterial;
      entity.enabled = false;
      this.fxRoot.addChild(entity);
      this.fxPool.push({
        entity,
        kind: 'tracer',
        life: 0,
        maxLife: 0.055,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinY: 0,
        spinZ: 0,
      });
    }

    for (let index = 0; index < 8; index += 1) {
      const entity = new Entity(`impact-${index}`);
      entity.addComponent('render', { type: 'sphere' });
      if (entity.render) entity.render.material = impactMaterial;
      entity.enabled = false;
      this.fxRoot.addChild(entity);
      this.fxPool.push({
        entity,
        kind: 'impact',
        life: 0,
        maxLife: 0.12,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinY: 0,
        spinZ: 0,
      });
    }

    for (let index = 0; index < 10; index += 1) {
      const entity = new Entity(`shell-${index}`);
      entity.addComponent('render', { type: 'box' });
      entity.setLocalScale(0.018, 0.038, 0.018);
      if (entity.render) entity.render.material = shellMaterial;
      entity.enabled = false;
      this.fxRoot.addChild(entity);
      this.fxPool.push({
        entity,
        kind: 'shell',
        life: 0,
        maxLife: 0.72,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinY: 0,
        spinZ: 0,
      });
    }
  }

  private nextFx(kind: FxKind): FxRuntime {
    for (let offset = 0; offset < this.fxPool.length; offset += 1) {
      const index = (this.fxCursor + offset) % this.fxPool.length;
      const candidate = this.fxPool[index]!;
      if (candidate.kind === kind && candidate.life <= 0) {
        this.fxCursor = (index + 1) % this.fxPool.length;
        return candidate;
      }
    }

    const candidates = this.fxPool.filter((effect) => effect.kind === kind);
    const fallback = candidates[this.fxCursor % candidates.length]!;
    this.fxCursor = (this.fxCursor + 1) % this.fxPool.length;
    return fallback;
  }

  private spawnTracer(from: [number, number, number], to: [number, number, number]): void {
    const effect = this.nextFx('tracer');
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const length = Math.max(0.1, Math.hypot(dx, dy, dz));
    effect.life = effect.maxLife;
    effect.entity.enabled = true;
    effect.entity.setPosition(from[0] + dx * 0.5, from[1] + dy * 0.5, from[2] + dz * 0.5);
    effect.entity.setLocalScale(0.014, 0.014, length);
    effect.entity.lookAt(to[0], to[1], to[2]);
  }

  private spawnImpact(point: [number, number, number], headshot: boolean): void {
    const effect = this.nextFx('impact');
    effect.life = effect.maxLife;
    effect.entity.enabled = true;
    effect.entity.setPosition(point[0], point[1], point[2]);
    const scale = headshot ? 0.18 : 0.11;
    effect.entity.setLocalScale(scale, scale, scale);
  }

  private spawnShell(): void {
    const effect = this.nextFx('shell');
    const position = this.camera.getPosition();
    const rotation = this.camera.getRotation();
    rotation.transformVector(Vec3.RIGHT, fxRight);
    rotation.transformVector(Vec3.UP, fxUp);
    rotation.transformVector(Vec3.FORWARD, muzzleForward);

    effect.life = effect.maxLife;
    effect.entity.enabled = true;
    effect.entity.setPosition(
      position.x + fxRight.x * 0.18 + fxUp.x * -0.14 + muzzleForward.x * 0.3,
      position.y + fxRight.y * 0.18 + fxUp.y * -0.14 + muzzleForward.y * 0.3,
      position.z + fxRight.z * 0.18 + fxUp.z * -0.14 + muzzleForward.z * 0.3,
    );
    effect.vx = fxRight.x * 2.2 + fxUp.x * 0.9 - muzzleForward.x * 0.3;
    effect.vy = fxRight.y * 2.2 + fxUp.y * 0.9 - muzzleForward.y * 0.3;
    effect.vz = fxRight.z * 2.2 + fxUp.z * 0.9 - muzzleForward.z * 0.3;
    effect.spinX = 480 + this.nextRandom() * 320;
    effect.spinY = 620 + this.nextRandom() * 360;
    effect.spinZ = 380 + this.nextRandom() * 280;
  }

  private updateFx(deltaSeconds: number): void {
    for (const effect of this.fxPool) {
      if (effect.life <= 0 || !effect.entity.enabled) continue;
      effect.life = Math.max(0, effect.life - deltaSeconds);
      if (effect.life <= 0) {
        effect.entity.enabled = false;
        continue;
      }

      const ratio = effect.life / effect.maxLife;
      if (effect.kind === 'tracer') {
        const scale = effect.entity.getLocalScale();
        effect.entity.setLocalScale(scale.x * ratio, scale.y * ratio, scale.z);
      } else if (effect.kind === 'impact') {
        const scale = 0.04 + ratio * 0.12;
        effect.entity.setLocalScale(scale, scale, scale);
      } else {
        const position = effect.entity.getPosition();
        effect.vy -= 7.8 * deltaSeconds;
        effect.entity.setPosition(
          position.x + effect.vx * deltaSeconds,
          position.y + effect.vy * deltaSeconds,
          position.z + effect.vz * deltaSeconds,
        );
        effect.entity.rotateLocal(
          effect.spinX * deltaSeconds,
          effect.spinY * deltaSeconds,
          effect.spinZ * deltaSeconds,
        );
      }
    }
  }

  private clearFx(): void {
    for (const effect of this.fxPool) {
      effect.life = 0;
      effect.entity.enabled = false;
    }
  }

  private nextRandom(): number {
    this.shotSeed = (Math.imul(this.shotSeed, 1664525) + 1013904223) >>> 0;
    return this.shotSeed / 4294967296;
  }

  private updateHud(force = false): void {
    const status =
      this.health <= 0
        ? 'DOWN'
        : this.reloadRemaining > 0
          ? 'RELOADING'
          : this.weaponState.ammo <= 0
            ? 'EMPTY'
            : this.input.aim
              ? 'ADS'
              : 'READY';
    const signature = [
      this.weapon.id,
      this.weaponState.ammo,
      this.weaponState.reserve,
      status,
      Math.round(this.health),
      Math.round(this.armor),
    ].join(':');
    if (!force && signature === this.lastHud) return;
    this.lastHud = signature;

    this.hudWeapon.textContent = this.weapon.name;
    this.hudAmmo.textContent = String(this.weaponState.ammo).padStart(2, '0');
    this.hudReserve.textContent = String(this.weaponState.reserve);
    this.hudState.textContent = status;
    this.hudHealth.textContent = String(Math.round(this.health));
    this.hudArmor.textContent = String(Math.round(this.armor));
  }
}
