import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { AudioFeedback } from './audio-feedback';
import type { CharacterSystem, CombatHit } from './character-system';
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
};

type WeaponState = {
  ammo: number;
  reserve: number;
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
  },
];

const shotDirection = new Vec3();
const muzzleForward = new Vec3();

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

export class CombatSystem {
  private readonly root = new Entity('fps-viewmodel');
  private readonly modelRoots = new Map<WeaponId, Entity>();
  private readonly state = new Map<WeaponId, WeaponState>();
  private currentIndex = 0;
  private fireCooldown = 0;
  private reloadRemaining = 0;
  private triggerLatched = false;
  private viewKick = 0;
  private hitMarkerSeconds = 0;
  private eliminationSeconds = 0;
  private enabled = true;
  private lastHud = '';
  private health = 100;
  private armor = 100;

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

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  update(deltaSeconds: number, viewMode: PlayerViewMode): void {
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.1);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.hitMarkerSeconds = Math.max(0, this.hitMarkerSeconds - dt);
    this.eliminationSeconds = Math.max(0, this.eliminationSeconds - dt);

    const directSlot = this.input.consumeWeaponSwitch();
    if (directSlot !== null) this.switchWeapon(Math.max(0, Math.min(2, directSlot - 1)));
    if (this.input.consumeWeaponCycle())
      this.switchWeapon((this.currentIndex + 1) % weapons.length);

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

    const targetX = aiming ? 0.012 : 0.2;
    const targetY = aiming ? -0.185 : -0.22;
    const targetZ = aiming ? -0.37 : -0.44;
    const position = this.root.getLocalPosition();
    const viewBlend = 1 - Math.exp(-18 * dt);
    this.viewKick += (0 - this.viewKick) * (1 - Math.exp(-22 * dt));
    this.root.setLocalPosition(
      position.x + (targetX - position.x) * viewBlend,
      position.y + (targetY - position.y) * viewBlend,
      position.z + (targetZ + this.viewKick - position.z) * viewBlend,
    );

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
    this.hitMarkerSeconds = 0;
    this.eliminationSeconds = 0;
    this.health = 100;
    this.armor = 100;
    this.activateModel();
    this.updateHud(true);
  }

  destroy(): void {
    this.root.destroy();
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
    if (this.reloadRemaining > 0 || state.ammo >= this.weapon.magazine || state.reserve <= 0)
      return;
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
    this.viewKick = Math.min(0.085, this.viewKick + 0.038 * this.weapon.recoil);

    const recoilYaw = (Math.random() - 0.5) * 0.32 * this.weapon.recoil;
    const recoilPitch = -0.48 * this.weapon.recoil;
    this.input.addLookImpulse(recoilYaw, recoilPitch);

    const origin = this.camera.getPosition();
    const cameraRotation = this.camera.getRotation();
    cameraRotation.transformVector(Vec3.FORWARD, muzzleForward);

    const spread = this.weapon.spread * (aiming ? this.weapon.adsSpreadScale : 1);
    let bestHit: CombatHit | null = null;

    for (let pellet = 0; pellet < this.weapon.pellets; pellet += 1) {
      shotDirection.copy(muzzleForward);
      shotDirection.x += (Math.random() - 0.5) * spread;
      shotDirection.y += (Math.random() - 0.5) * spread;
      shotDirection.z += (Math.random() - 0.5) * spread;
      shotDirection.normalize();

      const hit = this.characters.fireHitscan(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: shotDirection.x, y: shotDirection.y, z: shotDirection.z },
        this.weapon.damage,
      );

      if (!hit) continue;
      if (!bestHit || hit.distance < bestHit.distance || hit.eliminated) bestHit = hit;
    }

    if (bestHit) {
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

    const body = new Entity(`${definition.id}-body`);
    body.addComponent('render', { type: 'box' });
    body.setLocalScale(definition.bodyScale[0], definition.bodyScale[1], definition.bodyScale[2]);
    body.setLocalPosition(0, 0, -0.05);
    if (body.render) body.render.material = primary;
    weaponRoot.addChild(body);

    const barrel = new Entity(`${definition.id}-barrel`);
    barrel.addComponent('render', { type: 'box' });
    barrel.setLocalScale(
      definition.barrelScale[0],
      definition.barrelScale[1],
      definition.barrelScale[2],
    );
    barrel.setLocalPosition(0, 0.018, -0.42);
    if (barrel.render) barrel.render.material = accent;
    weaponRoot.addChild(barrel);

    const sight = new Entity(`${definition.id}-sight`);
    sight.addComponent('render', { type: 'box' });
    sight.setLocalScale(0.035, 0.035, 0.075);
    sight.setLocalPosition(0, 0.09, -0.18);
    if (sight.render) sight.render.material = accent;
    weaponRoot.addChild(sight);

    const grip = new Entity(`${definition.id}-grip`);
    grip.addComponent('render', { type: 'box' });
    grip.setLocalScale(0.065, 0.18, 0.08);
    grip.setLocalPosition(0, -0.12, 0.02);
    grip.setLocalEulerAngles(-12, 0, 0);
    if (grip.render) grip.render.material = primary;
    weaponRoot.addChild(grip);

    this.root.addChild(weaponRoot);
    return weaponRoot;
  }

  private updateHud(force = false): void {
    const status =
      this.reloadRemaining > 0
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
      this.health,
      this.armor,
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
