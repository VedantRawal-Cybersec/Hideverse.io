import type { Application } from 'playcanvas';

export type QualityPreset = 'auto' | 'low' | 'balanced' | 'high';

export type PerformanceSnapshot = {
  fps: number;
  quality: QualityPreset;
  pixelRatio: number;
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

  constructor(
    private readonly app: Application,
    private readonly coarsePointer: boolean,
  ) {
    this.applyPixelRatio();
  }

  get preset(): QualityPreset {
    return this.presetValue;
  }

  get fps(): number {
    return this.measuredFps;
  }

  get shadowsEnabled(): boolean {
    if (this.presetValue === 'low') return false;
    if (this.presetValue === 'auto') return !this.coarsePointer;
    return true;
  }

  get shadowResolution(): number {
    if (this.presetValue === 'high') return this.coarsePointer ? 1536 : 2048;
    if (this.presetValue === 'balanced') return this.coarsePointer ? 768 : 1536;
    if (this.presetValue === 'low') return 512;
    return this.coarsePointer ? 768 : 1536;
  }

  setPreset(preset: QualityPreset): void {
    this.presetValue = preset;
    this.adaptiveScale = 1;
    localStorage.setItem(storageKey, preset);
    this.applyPixelRatio();
  }

  update(deltaSeconds: number): PerformanceSnapshot {
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.25);
    this.frameAccumulator += 1;
    this.timeAccumulator += dt;

    if (this.timeAccumulator >= 1.5) {
      this.measuredFps = Math.round(this.frameAccumulator / this.timeAccumulator);
      this.frameAccumulator = 0;
      this.timeAccumulator = 0;

      if (this.presetValue === 'auto') {
        if (this.measuredFps < 43) {
          this.adaptiveScale = Math.max(0.58, this.adaptiveScale - 0.1);
        } else if (this.measuredFps > 57) {
          this.adaptiveScale = Math.min(1, this.adaptiveScale + 0.06);
        }
        this.applyPixelRatio();
      }
    }

    return {
      fps: this.measuredFps,
      quality: this.presetValue,
      pixelRatio: this.lastAppliedPixelRatio,
    };
  }

  private basePixelRatio(): number {
    if (this.presetValue === 'low') return this.coarsePointer ? 0.85 : 1;
    if (this.presetValue === 'balanced') return this.coarsePointer ? 1 : 1.35;
    if (this.presetValue === 'high') return this.coarsePointer ? 1.35 : 1.8;
    return this.coarsePointer ? 1 : 1.5;
  }

  private applyPixelRatio(): void {
    const deviceRatio = Math.max(1, window.devicePixelRatio || 1);
    const ratio = Math.max(
      0.65,
      Math.min(deviceRatio, this.basePixelRatio() * this.adaptiveScale),
    );
    this.lastAppliedPixelRatio = ratio;
    this.app.graphicsDevice.maxPixelRatio = ratio;
  }
}
