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
  private currentPreset: QualityPreset = 'auto';
  private runtimeReduced = false;

  constructor(
    private readonly app: Application,
    camera: Entity,
    private readonly coarsePointer: boolean,
  ) {
    if (!camera.camera) throw new Error('GraphicsPipeline requires a camera component.');

    this.frame = new CameraFrame(app, camera.camera);
    this.frame.rendering.sceneColorMap = true;
    this.frame.rendering.toneMapping = TONEMAP_ACES;
    this.app.scene.fog.color = new Color(0.055, 0.065, 0.08);
    this.applyQuality('auto');
  }

  applyQuality(preset: QualityPreset, runtimeReduced = this.runtimeReduced): void {
    this.currentPreset = preset;
    this.runtimeReduced = runtimeReduced;

    const low = preset === 'low';
    const high = preset === 'high';
    const balanced = preset === 'balanced';
    const autoMobile = preset === 'auto' && this.coarsePointer;
    const lightweight = low || autoMobile || runtimeReduced;
    const autoHigh = preset === 'auto' && !this.coarsePointer && !runtimeReduced;

    this.frame.enabled = !lightweight;

    if (!lightweight) {
      this.frame.grading.enabled = true;
      this.frame.grading.brightness = high ? 1.04 : 1.02;
      this.frame.grading.contrast = high || autoHigh ? 1.07 : 1.035;
      this.frame.grading.saturation = high || autoHigh ? 1.06 : 1.03;
      this.frame.bloom.intensity = high || autoHigh ? 0.018 : balanced ? 0.01 : 0.006;
      this.frame.bloom.blurLevel = high ? 8 : 5;
      this.frame.vignette.inner = 0.7;
      this.frame.vignette.outer = 1;
      this.frame.vignette.curvature = 0.6;
      this.frame.vignette.intensity = high || autoHigh ? 0.1 : 0.06;
      this.frame.taa.enabled = high && !this.coarsePointer;
      this.frame.taa.jitter = 0.7;
    } else {
      this.frame.grading.enabled = false;
      this.frame.bloom.intensity = 0;
      this.frame.vignette.intensity = 0;
      this.frame.taa.enabled = false;
    }

    this.app.scene.fog.type = low ? FOG_NONE : FOG_EXP;
    this.app.scene.fog.density = this.coarsePointer || runtimeReduced ? 0.0035 : high ? 0.0038 : 0.0044;
    this.frame.update();
  }

  setRuntimeReduction(reduced: boolean): void {
    if (this.runtimeReduced === reduced) return;
    this.applyQuality(this.currentPreset, reduced);
  }

  destroy(): void {
    this.frame.destroy();
  }
}
