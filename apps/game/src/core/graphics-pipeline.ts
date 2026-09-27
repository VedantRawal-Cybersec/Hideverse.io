import { Application, CameraFrame, Entity, FOG_EXP, FOG_NONE, TONEMAP_ACES } from 'playcanvas';
import type { QualityPreset } from './performance-manager';
import type { MapVisualProfile } from './map-visual-profile';
import { colorFromTriplet } from './reference-art-direction';

export class GraphicsPipeline {
  private readonly frame: CameraFrame;
  private currentPreset: QualityPreset = 'auto';
  private runtimeReduced = false;

  constructor(
    private readonly app: Application,
    camera: Entity,
    private readonly coarsePointer: boolean,
    private readonly visualProfile: MapVisualProfile,
  ) {
    if (!camera.camera) throw new Error('GraphicsPipeline requires a camera component.');

    this.frame = new CameraFrame(app, camera.camera);
    this.frame.rendering.sceneColorMap = true;
    this.frame.rendering.sceneDepthMap = true;
    this.frame.rendering.toneMapping = TONEMAP_ACES;
    this.frame.rendering.sharpness = 0.12;
    this.app.scene.fog.color = colorFromTriplet(this.visualProfile.fog);
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
    const autoDesktop = preset === 'auto' && !this.coarsePointer && !runtimeReduced;

    this.frame.enabled = !lightweight;
    this.frame.grading.enabled = !lightweight;
    this.frame.grading.brightness = high ? 1.06 : 1.035;
    this.frame.grading.contrast = high || autoDesktop ? 1.09 : 1.055;
    this.frame.grading.saturation = high || autoDesktop ? 1.07 : 1.035;

    // The references are crisp rather than cinematic: almost no bloom and only light vignette.
    this.frame.bloom.intensity = lightweight ? 0 : high ? 0.008 : balanced ? 0.004 : 0.003;
    this.frame.bloom.blurLevel = high ? 6 : 4;
    this.frame.vignette.inner = 0.76;
    this.frame.vignette.outer = 1;
    this.frame.vignette.curvature = 0.55;
    this.frame.vignette.intensity = lightweight ? 0 : 0.035;

    this.frame.taa.enabled = high && !this.coarsePointer;
    this.frame.taa.jitter = 0.6;

    // Contact shading creates the baked-lightmap / clean competitive-FPS depth visible
    // in the supplied references without forcing expensive dynamic lights everywhere.
    this.frame.ssao.type = lightweight ? 'none' : 'combine';
    this.frame.ssao.blurEnabled = true;
    this.frame.ssao.randomize = false;
    this.frame.ssao.intensity = high ? 0.42 : 0.3;
    this.frame.ssao.radius = high ? 4.2 : 3.2;
    this.frame.ssao.samples = high ? 12 : 7;
    this.frame.ssao.power = 2.2;
    this.frame.ssao.minAngle = 12;
    this.frame.ssao.scale = high ? 0.75 : 0.62;

    this.app.scene.fog.type = low ? FOG_NONE : FOG_EXP;
    const fogScale = this.coarsePointer || runtimeReduced ? 0.72 : 1;
    this.app.scene.fog.density = this.visualProfile.fogDensity * fogScale;
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
