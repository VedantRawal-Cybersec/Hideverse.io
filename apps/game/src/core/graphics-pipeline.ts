import {
  Application,
  CameraFrame,
  Color,
  Entity,
  FOG_EXP,
  FOG_NONE,
  TONEMAP_ACES,
} from 'playcanvas';
import type { QualityPreset } from './performance-manager';

export class GraphicsPipeline {
  private readonly frame: CameraFrame;

  constructor(
    private readonly app: Application,
    private readonly camera: Entity,
    private readonly coarsePointer: boolean,
  ) {
    if (!camera.camera) throw new Error('GraphicsPipeline requires a camera component.');

    this.frame = new CameraFrame(app, camera.camera);
    this.frame.rendering.sceneColorMap = true;
    this.frame.rendering.toneMapping = TONEMAP_ACES;
    this.frame.grading.enabled = true;
    this.frame.grading.brightness = 1.02;
    this.frame.grading.contrast = 1.06;
    this.frame.grading.saturation = 1.06;
    this.frame.vignette.enabled = true;
    this.frame.vignette.inner = 0.66;
    this.frame.vignette.outer = 1;
    this.frame.vignette.curvature = 0.65;
    this.frame.vignette.intensity = 0.12;
    this.frame.update();

    this.app.scene.fog.type = FOG_EXP;
    this.app.scene.fog.color = new Color(0.055, 0.065, 0.08);
    this.app.scene.fog.density = coarsePointer ? 0.006 : 0.0042;
  }

  applyQuality(preset: QualityPreset): void {
    const low = preset === 'low';
    const high = preset === 'high';
    const balanced = preset === 'balanced';
    const autoHigh = preset === 'auto' && !this.coarsePointer;

    this.frame.enabled = !low;
    this.frame.bloom.enabled = !low;
    this.frame.bloom.intensity = high || autoHigh ? 0.025 : balanced ? 0.014 : 0.008;
    this.frame.bloom.blurLevel = high || autoHigh ? 10 : 6;
    this.frame.bloom.threshold = 1.1;

    this.frame.grading.enabled = !low;
    this.frame.grading.brightness = high ? 1.04 : 1.02;
    this.frame.grading.contrast = high || autoHigh ? 1.08 : 1.04;
    this.frame.grading.saturation = high || autoHigh ? 1.08 : 1.04;

    this.frame.taa.enabled = high && !this.coarsePointer;
    this.frame.taa.jitter = 0.8;

    this.frame.vignette.enabled = !low;
    this.frame.vignette.intensity = high || autoHigh ? 0.14 : 0.09;

    this.app.scene.fog.type = low ? FOG_NONE : FOG_EXP;
    this.app.scene.fog.density = this.coarsePointer
      ? high
        ? 0.005
        : 0.006
      : high || autoHigh
        ? 0.004
        : 0.0048;

    this.frame.update();
  }

  destroy(): void {
    this.frame.destroy();
  }
}
