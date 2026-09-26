import type { Entity } from 'playcanvas';
import type { QualityPreset } from './performance-manager';

type CameraFrameRuntime = {
  rendering: {
    toneMapping: string;
    renderTargetScale: number;
    samples: number;
    sharpness: number;
  };
  ssao: {
    type: string;
    intensity: number;
    radius: number;
    samples: number;
    power: number;
    scale: number;
    randomize: boolean;
    blurEnabled: boolean;
  };
  bloom: {
    enabled: boolean;
    intensity: number;
    blurLevel: number;
    threshold: number;
  };
  grading: {
    enabled: boolean;
    brightness: number;
    contrast: number;
    saturation: number;
  };
  vignette: {
    enabled: boolean;
    intensity: number;
    inner: number;
    outer: number;
    curvature: number;
  };
  taa: {
    enabled: boolean;
    jitter: number;
  };
  colorEnhance: {
    enabled: boolean;
    shadows: number;
    highlights: number;
    midtones: number;
    vibrance: number;
    dehaze: number;
  };
  volumetricFog: {
    enabled: boolean;
    light: Entity | null;
    density: number;
    maxDistance: number;
    steps: number;
    scale: number;
    intensity: number;
    ambientIntensity: number;
  };
};

export class GraphicsPipeline {
  private frame: CameraFrameRuntime | null = null;

  private constructor(
    private readonly camera: Entity,
    private readonly coarsePointer: boolean,
    private readonly keyLight: Entity,
  ) {}

  static async create(
    camera: Entity,
    coarsePointer: boolean,
    keyLight: Entity,
    quality: QualityPreset,
  ): Promise<GraphicsPipeline> {
    const pipeline = new GraphicsPipeline(camera, coarsePointer, keyLight);
    await pipeline.initialize(quality);
    return pipeline;
  }

  async initialize(quality: QualityPreset): Promise<void> {
    try {
      if (!this.camera.script) this.camera.addComponent('script');
      if (!this.camera.script) return;

      const module = await import('playcanvas/scripts/esm/camera-frame.mjs');
      const scriptComponent = this.camera.script as unknown as {
        create: (script: unknown) => CameraFrameRuntime;
      };
      this.frame = scriptComponent.create(module.CameraFrame);
      this.applyQuality(quality);
    } catch (error) {
      console.warn('[Hideverse graphics] CameraFrame unavailable; using base renderer.', error);
    }
  }

  applyQuality(quality: QualityPreset): void {
    const frame = this.frame;
    if (!frame) return;

    const low = quality === 'low' || (quality === 'auto' && this.coarsePointer);
    const high = quality === 'high' && !this.coarsePointer;
    const balanced = !low && !high;

    frame.rendering.toneMapping = 'aces';
    frame.rendering.renderTargetScale = low ? 0.82 : 1;
    frame.rendering.samples = low ? 1 : high ? 2 : 1;
    frame.rendering.sharpness = low ? 0.2 : 0.1;

    frame.ssao.type = low ? 'none' : 'lighting';
    frame.ssao.intensity = high ? 0.62 : 0.42;
    frame.ssao.radius = high ? 10 : 7;
    frame.ssao.samples = high ? 16 : 8;
    frame.ssao.power = high ? 4.5 : 3.5;
    frame.ssao.scale = high ? 1 : 0.75;
    frame.ssao.randomize = high;
    frame.ssao.blurEnabled = !high;

    frame.bloom.enabled = !low;
    frame.bloom.intensity = high ? 0.018 : 0.01;
    frame.bloom.blurLevel = high ? 8 : 5;
    frame.bloom.threshold = 1.1;

    frame.grading.enabled = true;
    frame.grading.brightness = 1;
    frame.grading.contrast = high ? 1.09 : balanced ? 1.06 : 1.03;
    frame.grading.saturation = high ? 1.08 : balanced ? 1.05 : 1.02;

    frame.vignette.enabled = !low;
    frame.vignette.intensity = high ? 0.22 : 0.14;
    frame.vignette.inner = 0.65;
    frame.vignette.outer = 1.2;
    frame.vignette.curvature = 0.6;

    frame.taa.enabled = high;
    frame.taa.jitter = high ? 0.7 : 0;

    frame.colorEnhance.enabled = !low;
    frame.colorEnhance.shadows = 0.04;
    frame.colorEnhance.highlights = 0.03;
    frame.colorEnhance.midtones = 0.02;
    frame.colorEnhance.vibrance = high ? 0.12 : 0.07;
    frame.colorEnhance.dehaze = high ? 0.06 : 0.03;

    frame.volumetricFog.enabled = high;
    frame.volumetricFog.light = this.keyLight;
    frame.volumetricFog.density = 0.0035;
    frame.volumetricFog.maxDistance = 95;
    frame.volumetricFog.steps = 12;
    frame.volumetricFog.scale = 0.5;
    frame.volumetricFog.intensity = 0.45;
    frame.volumetricFog.ambientIntensity = 0.015;
  }
}
