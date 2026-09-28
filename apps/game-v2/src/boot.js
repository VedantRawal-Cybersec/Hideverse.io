/**
 * The game boot — everything a normal page load stands up. src/main.js
 * dispatches here (dynamically, so a `?renderGame=false` UI-only load never
 * fetches any of this or the subsystems it imports).
 */
import { Engine } from './core/engine.js';
import { createConfig } from './core/config.js';
import {
  AdaptiveQualitySystem,
  detectDeviceSignature,
  estimateRefreshRate,
  loadGraphicsSettings,
  prepareAutoSettings,
  resolveGraphicsBoot,
  saveGraphicsSettings,
} from './core/quality.js';
import { applyGraphicsOverrides } from './core/graphics.js';
import { DEFAULT_CONTROLS, loadControlSettings } from './core/controls.js';
import { detectTouchMode } from './core/input.js';

import { RenderSystem } from './render/index.js';
import { MaterialSystem } from './materials/index.js';
import { SkySystem } from './sky/index.js';
import { WorldSystem } from './world/index.js';
import { PhysicsSystem } from './physics/index.js';
import { PlayerSystem } from './player/index.js';
import { WeaponSystem } from './weapons/index.js';
import { FxSystem } from './fx/index.js';
import { AiSystem } from './ai/index.js';
import { UiSystem } from './ui/index.js';
import { AudioSystem } from './audio/index.js';
import { NetSystem } from './net/index.js';
import { MatchSystem } from './match/index.js';

import { installShotApi } from './dev/shots.js';
import { prewarm } from './core/prewarm.js';

const params = new URLSearchParams(location.search);
const capture = params.get('capture') === '1';
// Deterministic shutter for the pixel gate: the engine does not schedule its own
// frames, the driver advances exactly N of them through window.__PUMP__. Opt-in,
// because tools that measure real frame pacing (tools/perf.mjs) need the loop to
// free-run. See the long comment in src/dev/shots.js.
const lockstep = capture && params.get('lockstep') === '1';

// The Match Start view: every normal load opens on a menu rather than mid-match,
// so a player can pick a bot garrison and go, or wait for a friend to join the
// room and ready up together. Off for capture runs (a menu is not a screenshot)
// and with `?match=0`, which restores the old "live on the first frame" boot for
// benchmarks and playtest harnesses.
const matchFlow = !capture && params.get('match') !== '0';

const explicitQuality = params.get('q');
let graphics = loadGraphicsSettings();
const initialBoot = resolveGraphicsBoot({ capture, explicitQuality, settings: graphics });
if (initialBoot.enabled && graphics.mode === 'auto') {
  const signature = detectDeviceSignature();
  const refreshHz =
    graphics.targetFps === 'display'
      ? document.hidden
        ? graphics.refreshHz ?? 120
        : await estimateRefreshRate()
      : graphics.refreshHz;
  graphics = saveGraphicsSettings(prepareAutoSettings(graphics, { signature, refreshHz }));
}

let { enabled: adaptiveEnabled, quality: bootQuality } = resolveGraphicsBoot({
  capture,
  explicitQuality,
  settings: graphics,
});
// Capture runs must not inherit whatever aim style a previous session saved,
// or a scripted ADS shot could come back hip-fired.
const controls = capture ? { ...DEFAULT_CONTROLS } : loadControlSettings();
// Touch mode never applies to a capture: the pixel gate frames a desktop HUD,
// and an overlay of thumb controls in every baseline would be a visual change.
const touchMode = !capture && detectTouchMode(params);

// Phones/tablets get a hard Auto safety envelope before WebGL allocates the
// expensive render targets. High-DPI mobile screens are the worst case for a
// browser FPS: DPR 3 at 1440x3200 can request more pixels than a desktop 4K
// monitor while running a much smaller GPU. Start at Performance, allow Auto to
// prove its way up to Low, and never let a short quiet-scene benchmark promote
// a touch device into desktop SSR/GTAO/4-cascade territory.
if (adaptiveEnabled && graphics.mode === 'auto' && touchMode) {
  const mobileScale = 0.55;
  const tooHeavy = !graphics.tier || ['medium', 'high', 'ultra'].includes(graphics.tier);
  graphics = saveGraphicsSettings({
    ...graphics,
    tier: tooHeavy ? 'performance' : graphics.tier,
    tierCeiling: 'low',
    renderScale: tooHeavy ? mobileScale : Math.min(graphics.renderScale, 0.72),
    calibrated: true,
    targetFps: 60,
  });
  bootQuality = graphics.tier;
}

// Menus (the lobby, the pause panel, the net overlay) read this class to grow
// hit targets and drop keyboard hints; it is set before any UI exists.
document.body.classList.toggle('wm-touch', touchMode);
const config = createConfig({
  quality: bootQuality,
  adsMode: controls.adsMode,
  adsKey: controls.adsKey,
  autoReload: controls.autoReload,
  touchMode,
  touchSensitivity: controls.touchSensitivity,
  graphicsMode: graphics.mode,
  targetFps: graphics.targetFps,
  displayRefreshHz: graphics.refreshHz ?? 120,
  adaptiveQuality: adaptiveEnabled,
  deterministic: capture,
  // `ai` skips its boot-time garrison; `match` spawns it when a match starts.
  deferGarrison: matchFlow,
});
if (adaptiveEnabled && graphics.mode === 'auto' && graphics.calibrated)
  config.q.renderScale = graphics.renderScale;

// Advanced per-option overrides go on LAST, over both the preset and whatever
// the adaptive scaler last settled on — they are the most specific thing the
// player asked for. Skipped entirely for capture/`?q=` runs, so the pixel gate
// and the goal harness keep seeing the shipped presets.
const graphicsOverrides = adaptiveEnabled ? applyGraphicsOverrides(config, graphics.overrides) : null;
if (graphicsOverrides?.applied.length)
  console.info('[boot] graphics overrides', graphicsOverrides.applied.join(', '));

const canvas = document.getElementById('game');

const engine = new Engine({ canvas, config });

// Registration order is irrelevant — Registry topo-sorts on static deps.
engine
  .add(RenderSystem)
  .add(AdaptiveQualitySystem, { settings: graphics, enabled: adaptiveEnabled })
  .add(MaterialSystem)
  .add(SkySystem)
  .add(WorldSystem)
  .add(PhysicsSystem)
  .add(PlayerSystem)
  .add(WeaponSystem)
  .add(FxSystem)
  .add(AiSystem)
  .add(UiSystem)
  .add(AudioSystem);

// Web multiplayer: on by default, off for capture/deterministic runs or with
// ?mp=0. Every normal load joins (and, if needed, mints) a room, so the URL in
// the address bar is always a shareable invite link.
const multiplayer = !capture && params.get('mp') !== '0';
if (multiplayer) engine.add(NetSystem);

// Registered after `net` so the match view can read the room it joined; the
// lobby itself arrives on the event bus, so the order is a convenience, not a
// requirement. Without this system the game is live on the first frame.
if (matchFlow) engine.add(MatchSystem);

try {
  await engine.init();
} catch (err) {
  console.error('[boot] init failed', err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<pre style="position:fixed;inset:0;padding:2rem;color:#f66;background:#000;
       font:12px/1.5 ui-monospace,monospace;overflow:auto;z-index:9999;white-space:pre-wrap">
BOOT FAILURE\n\n${err.stack ?? err.message}</pre>`
  );
  throw err;
}

const shotApi = installShotApi(engine, { capture, lockstep });

// Full shader/material pre-warming is extremely expensive on software-rendered,
// mobile and lower-end WebGL implementations. Production QA measured 65-77 second
// boots because AI/material prewarm compiled hundreds of permutations before the
// first playable frame. Never block normal players on that work.
//
// Keep full prewarm available for capture/perf tooling and explicit diagnostics
// with ?prewarm=1. Normal /game-v2/ starts immediately; Three.js compiles only the
// permutations actually encountered during play.
const requestedPrewarm = params.get('prewarm');
const warmup =
  capture || requestedPrewarm === '1'
    ? await prewarm(engine)
    : {
        ok: false,
        reason:
          requestedPrewarm === '0'
            ? 'disabled by ?prewarm=0'
            : 'production fast boot — automatic prewarm disabled',
      };
console.info('[boot] prewarm', warmup);
window.__PREWARM__ = warmup;

engine.start();

// Capture harness handshake: only flag ready once a frame has actually landed.
//
// BOOT_FRAMES is deliberately a frame COUNT, not a rAF race. In lockstep mode the
// engine has no loop of its own, so we hand-pump exactly this many frames and only
// then raise __READY__; the shot is therefore always applied at engine frame 3, no
// matter how long boot (or pre-warm) took in wall-clock terms.
const BOOT_FRAMES = 3;
if (lockstep) {
  await shotApi.pump(BOOT_FRAMES);
  window.__READY__ = true;
} else {
  let warm = 0;
  const readyProbe = () => {
    if (++warm >= BOOT_FRAMES) {
      window.__READY__ = true;
      return;
    }
    requestAnimationFrame(readyProbe);
  };
  requestAnimationFrame(readyProbe);
}

window.__ENGINE__ = engine;

// Frame instrumentation, exposed for tooling (tools/fpslog.mjs) and for reading
// straight out of the devtools console:
//
//   __PERF__.stats()                      percentiles, phase breakdown, bound
//   __PERF__.log()                        one-line summary + the object
//   __PERF__.startRecording({frames:600}) begin a benchmark capture
//   __PERF__.stopRecording()              -> { label, frames, stats, rows }
//   __PERF__.csv()                        last recording as CSV
//
// `?perflog=N` prints a summary every N frames, which is how a headless run
// leaves a performance trail in the console log without any driver code.
window.__PERF__ = engine.perf;
const perflog = Number(params.get('perflog'));
if (Number.isFinite(perflog) && perflog > 0) engine.perf.autoLog(perflog);

if (import.meta.hot) {
  import.meta.hot.dispose(() => engine.dispose());
}
