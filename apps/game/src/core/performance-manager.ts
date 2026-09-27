import type { Application } from 'playcanvas';

export type QualityPreset = 'auto' | 'low' | 'balanced' | 'high';

export type PerformanceSnapshot = {
  fps: number;
  quality: QualityPreset;
  pixelRatio: number;
  reducedEffects: boolean;
  qualityChanged: boolean;
};

const storageKey = 'hideverse-quality';

function readPreset(): QualityPreset {
  const saved = localStorage.getItem(storageKey);
  if (saved === 'low' || saved === 'balanced' || saved === 'high' || saved === 'auto') {
    return saved;
  }
  return 'auto';
}

export class PerformanceManager {
  private presetValue: QualityPreset = readPreset();
  private adaptiveScale = 1;
  private frameAccumulator = 0;
  private timeAccumulator = 0;
  private measuredFps = 60;
  private lastAppliedPixelRatio = 1;
  private reduced = false;
  private goodWindows = 0;

  constructor(
    private readonly app: Application,
    private readonly coarsePointer: boolean,
    private readonly autoPixelScale = 1,
  ) {
    this.reduced = this.presetValue === 'auto';
    this.applyPixelRatio();
  }

  get preset(): QualityPreset {
    return this.presetValue;
  }

  get fps(): number {
    return this.measuredFps;
  }

  get reducedEffects(): boolean {
    return this.presetValue === 'auto' && (this.coarsePointer || this.reduced);
  }

  get shadowsEnabled(): boolean {
    if (this.presetValue === 'low') return false;
    if (this.presetValue === 'auto') return !this.coarsePointer && !this.reduced;
    return true;
  }

  get shadowResolution(): number {
    if (this.presetValue === 'high') return this.coarsePointer ? 1024 : 1536;
    if (this.presetValue === 'balanced') return this.coarsePointer ? 640 : 1024;
    if (this.presetValue === 'low') return 384;
    if (this.reduced || this.coarsePointer) return 512;
    return 1024;
  }

  setPreset(preset: QualityPreset): void {
    this.presetValue = preset;
    this.adaptiveScale = 1;
    this.reduced = preset === 'auto';
    this.goodWindows = 0;
    localStorage.setItem(storageKey, preset);
    this.applyPixelRatio();
  }

  update(deltaSeconds: number): PerformanceSnapshot {
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.25);
    this.frameAccumulator += 1;
    this.timeAccumulator += dt;
    let qualityChanged = false;

    if (this.timeAccumulator >= 1) {
      this.measuredFps = Math.round(this.frameAccumulator / this.timeAccumulator);
      this.frameAccumulator = 0;
      this.timeAccumulator = 0;

      if (this.presetValue === 'auto') {
        const previousReduced = this.reduced;

        if (this.measuredFps < 48) {
          this.adaptiveScale = Math.max(0.55, this.adaptiveScale - 0.12);
          this.reduced = true;
          this.goodWindows = 0;
        } else if (this.measuredFps > 57) {
          this.adaptiveScale = Math.min(1, this.adaptiveScale + 0.05);
          this.goodWindows += 1;
          if (this.goodWindows >= 4) this.reduced = false;
        } else {
          this.goodWindows = 0;
        }

        qualityChanged = previousReduced !== this.reduced;
        this.applyPixelRatio();
      }
    }

    return {
      fps: this.measuredFps,
      quality: this.presetValue,
      pixelRatio: this.lastAppliedPixelRatio,
      reducedEffects: this.reducedEffects,
      qualityChanged,
    };
  }

  private basePixelRatio(): number {
    if (this.presetValue === 'low') return this.coarsePointer ? 0.72 : 0.9;
    if (this.presetValue === 'balanced') return this.coarsePointer ? 0.9 : 1.15;
    if (this.presetValue === 'high') return this.coarsePointer ? 1.1 : 1.45;
    return (this.coarsePointer ? 0.82 : 1.2) * this.autoPixelScale;
  }

  private applyPixelRatio(): void {
    const deviceRatio = Math.max(1, window.devicePixelRatio || 1);
    const ratio = Math.max(0.58, Math.min(deviceRatio, this.basePixelRatio() * this.adaptiveScale));
    this.lastAppliedPixelRatio = ratio;
    this.app.graphicsDevice.maxPixelRatio = ratio;
  }
}
