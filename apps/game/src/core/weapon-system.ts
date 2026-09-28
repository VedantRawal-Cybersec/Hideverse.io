import {
  Application,
  Color,
  Entity,
  StandardMaterial,
} from 'playcanvas';
import type { MotionState } from './character-system';
import type { InputController } from './input-controller';
import { loadContainer } from './load-container';
import type { PlayerViewMode } from './player-avatar';

export type WeaponShot = {
  weapon: string;
  damage: number;
  spread: number;
};

type WeaponDefinition = {
  name: string;
  shortName: string;
  file: string;
  magazineSize: number;
  reserve: number;
  damage: number;
  fireInterval: number;
  reloadSeconds: number;
  spread: number;
  hipPosition: [number, number, number];
  adsPosition: [number, number, number];
  scale: number;
};

const weapons: WeaponDefinition[] = [
  {
    name: 'HV-AR MACHINE GUN',
    shortName: 'AR',
    file: 'machinegun.glb',
    magazineSize: 30,
    reserve: 120,
    damage: 34,
    fireInterval: 0.095,
    reloadSeconds: 1.35,
    spread: 0.013,
    hipPosition: [0.28, -0.31, -0.72],
    adsPosition: [0.015, -0.205, -0.56],
    scale: 0.34,
  },
  {
    name: 'HV-9 PISTOL',
    shortName: 'PST',
    file: 'pistol.glb',
    magazineSize: 15,
    reserve: 75,
    damage: 42,
    fireInterval: 0.19,
    reloadSeconds: 1.05,
    spread: 0.009,
    hipPosition: [0.25, -0.28, -0.62],
    adsPosition: [0.015, -0.19, -0.5],
    scale: 0.36,
  },
  {
    name: 'HV-12 SHOTGUN',
    shortName: 'SG',
    file: 'shotgun.glb',
    magazineSize: 8,
    reserve: 40,
    damage: 74,
    fireInterval: 0.68,
    reloadSeconds: 1.7,
    spread: 0.036,
    hipPosition: [0.31, -0.34, -0.82],
    adsPosition: [0.02, -0.215, -0.65],
    scale: 0.31,
  },
];

function emissiveMaterial(color: Color, intensity: number): StandardMaterial {
  const material = new StandardMaterial();
  material.diffuse = color;
  material.emissive = color;
  material.emissiveIntensity = intensity;
  material.gloss = 0.3;
  material.update();
  return material;
}

function fallbackMaterial(): StandardMaterial {
  const material = new StandardMaterial();
  material.diffuse = new Color(0.18, 0.2, 0.22);
  material.metalness = 0.55;
  material.gloss = 0.42;
  material.update();
  return material;
}

export class WeaponSystem {
  private readonly mount = new Entity('FPS Weapon Mount');
  private readonly models: Array<Entity | null> = weapons.map(() => null);
  private readonly ammo = weapons.map((weapon) => weapon.magazineSize);
  private readonly reserve = weapons.map((weapon) => weapon.reserve);
  private readonly muzzleFlash = new Entity('Weapon Muzzle Flash');
  private activeIndex = 0;
  private cooldown = 0;
  private reloadTimer = 0;
  private recoil = 0;
  private bobTime = 0;
  private shotQueued: WeaponShot | null = null;
  private adsBlend = 0;
  private disposed = false;

  constructor(
    private readonly app: Application,
    private readonly camera: Entity,
    private readonly coarsePointer: boolean,
  ) {
    this.camera.addChild(this.mount);

    this.muzzleFlash.addComponent('render', { type: 'sphere' });
    this.muzzleFlash.setLocalScale(0.085, 0.085, 0.085);
    this.muzzleFlash.setLocalPosition(0.02, -0.09, -0.82);
    if (this.muzzleFlash.render) {
      this.muzzleFlash.render.material = emissiveMaterial(new Color(1, 0.72, 0.24), 2.8);
    }
    this.muzzleFlash.enabled = false;
    this.mount.addChild(this.muzzleFlash);

    this.createFallback();
    void this.loadModels();
  }

  get weaponName(): string {
    return weapons[this.activeIndex]!.name;
  }

  get weaponShortName(): string {
    return weapons[this.activeIndex]!.shortName;
  }

  get magazineAmmo(): number {
    return this.ammo[this.activeIndex] ?? 0;
  }

  get reserveAmmo(): number {
    return this.reserve[this.activeIndex] ?? 0;
  }

  get reloading(): boolean {
    return this.reloadTimer > 0;
  }

  get aiming(): boolean {
    return this.adsBlend > 0.65;
  }

  consumeShot(): WeaponShot | null {
    const shot = this.shotQueued;
    this.shotQueued = null;
    return shot;
  }

  update(
    deltaSeconds: number,
    input: InputController,
    motion: MotionState,
    viewMode: PlayerViewMode,
  ): void {
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    this.recoil = Math.max(0, this.recoil - dt * 8.5);

    const switchIndex = input.consumeWeaponSwitch();
    if (switchIndex !== null && switchIndex >= 0 && switchIndex < weapons.length) {
      this.activeIndex = switchIndex;
      this.reloadTimer = 0;
      this.cooldown = Math.max(this.cooldown, 0.15);
      this.refreshActiveModel();
    }

    if (input.consumeReload()) this.startReload();
    if (this.reloadTimer > 0 && this.reloadTimer <= dt + 0.0001) this.finishReload();

    const shouldShow = viewMode === 'first-person';
    this.mount.enabled = shouldShow;
    if (!shouldShow) return;

    const definition = weapons[this.activeIndex]!;
    const adsTarget = input.adsHeld && !this.reloading ? 1 : 0;
    const adsRate = 1 - Math.exp(-18 * dt);
    this.adsBlend += (adsTarget - this.adsBlend) * adsRate;

    if (input.fireHeld && this.cooldown <= 0 && !this.reloading) {
      if ((this.ammo[this.activeIndex] ?? 0) > 0) {
        this.fire(definition);
      } else {
        this.startReload();
      }
    }

    this.bobTime += dt * (motion === 'sprint' ? 10.5 : motion === 'run' ? 8 : 4.2);
    const moving = motion === 'walk' || motion === 'run' || motion === 'sprint';
    const bobScale = moving ? (motion === 'sprint' ? 0.022 : 0.013) : 0.0035;
    const bobX = Math.sin(this.bobTime) * bobScale * (1 - this.adsBlend * 0.68);
    const bobY = Math.abs(Math.cos(this.bobTime * 2)) * bobScale * 0.72;

    const hip = definition.hipPosition;
    const ads = definition.adsPosition;
    const x = hip[0] + (ads[0] - hip[0]) * this.adsBlend + bobX;
    const y = hip[1] + (ads[1] - hip[1]) * this.adsBlend - bobY + this.recoil * 0.024;
    const z = hip[2] + (ads[2] - hip[2]) * this.adsBlend + this.recoil * 0.09;
    this.mount.setLocalPosition(x, y, z);
    this.mount.setLocalEulerAngles(
      -this.recoil * 2.8,
      bobX * 22,
      -bobX * 13,
    );

    if (this.camera.camera) {
      const targetFov = this.adsBlend > 0.02 ? 82 - this.adsBlend * 18 : 82;
      this.camera.camera.fov += (targetFov - this.camera.camera.fov) * (1 - Math.exp(-16 * dt));
    }

    if (this.muzzleFlash.enabled && this.cooldown < definition.fireInterval * 0.72) {
      this.muzzleFlash.enabled = false;
    }
  }

  destroy(): void {
    this.disposed = true;
    this.mount.destroy();
  }

  private fire(definition: WeaponDefinition): void {
    this.ammo[this.activeIndex] = Math.max(0, (this.ammo[this.activeIndex] ?? 0) - 1);
    this.cooldown = definition.fireInterval;
    this.recoil = Math.min(1.25, this.recoil + (definition.shortName === 'SG' ? 1.05 : 0.55));
    this.muzzleFlash.enabled = true;
    this.muzzleFlash.setLocalScale(
      0.07 + Math.random() * 0.045,
      0.07 + Math.random() * 0.045,
      0.07 + Math.random() * 0.045,
    );
    this.shotQueued = {
      weapon: definition.shortName,
      damage: definition.damage,
      spread: definition.spread,
    };
  }

  private startReload(): void {
    if (this.reloadTimer > 0) return;
    const definition = weapons[this.activeIndex]!;
    const magazine = this.ammo[this.activeIndex] ?? 0;
    const reserve = this.reserve[this.activeIndex] ?? 0;
    if (magazine >= definition.magazineSize || reserve <= 0) return;
    this.reloadTimer = definition.reloadSeconds;
  }

  private finishReload(): void {
    const definition = weapons[this.activeIndex]!;
    const current = this.ammo[this.activeIndex] ?? 0;
    const needed = Math.max(0, definition.magazineSize - current);
    const available = this.reserve[this.activeIndex] ?? 0;
    const loaded = Math.min(needed, available);
    this.ammo[this.activeIndex] = current + loaded;
    this.reserve[this.activeIndex] = available - loaded;
    this.reloadTimer = 0;
  }

  private createFallback(): void {
    const body = new Entity('Fallback Weapon Body');
    body.addComponent('render', { type: 'box' });
    body.setLocalScale(0.16, 0.12, 0.62);
    body.setLocalPosition(0, 0, -0.18);
    if (body.render) body.render.material = fallbackMaterial();
    this.mount.addChild(body);
    this.models[0] = body;
  }

  private async loadModels(): Promise<void> {
    for (const [index, definition] of weapons.entries()) {
      if (this.disposed) return;
      try {
        const asset = await loadContainer(
          this.app,
          `${import.meta.env.BASE_URL}weapons/kenney/${definition.file}`,
        );
        if (this.disposed) return;

        const model = asset.resource.instantiateRenderEntity({
          castShadows: false,
          receiveShadows: false,
        });
        model.name = `fps-viewmodel-${definition.shortName.toLowerCase()}`;
        model.setLocalScale(definition.scale, definition.scale, definition.scale);
        model.setLocalEulerAngles(0, 90, 0);
        model.enabled = index === this.activeIndex;
        this.mount.addChild(model);

        if (index === 0 && this.models[0]) {
          this.models[0]!.destroy();
        }
        this.models[index] = model;
      } catch (error) {
        console.warn(`[Hideverse weapons] ${definition.file} unavailable; fallback retained.`, error);
      }

      await new Promise<void>((resolve) => window.setTimeout(resolve, this.coarsePointer ? 180 : 90));
    }

    this.refreshActiveModel();
  }

  private refreshActiveModel(): void {
    for (const [index, model] of this.models.entries()) {
      if (model) model.enabled = index === this.activeIndex;
    }
  }
}
