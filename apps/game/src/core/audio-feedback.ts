export type AudioCue =
  | 'interact'
  | 'objective'
  | 'danger'
  | 'win'
  | 'lose'
  | 'shoot'
  | 'hit'
  | 'reload'
  | 'eliminate'
  | 'empty'
  | 'damage';

export class AudioFeedback {
  private context: AudioContext | null = null;
  private unlocked = false;
  private lastDangerAt = 0;

  constructor() {
    const unlock = (): void => {
      this.ensureContext();
      this.unlocked = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  cue(type: AudioCue): void {
    if (!this.unlocked) return;
    const context = this.ensureContext();
    if (!context) return;

    if (type === 'danger') {
      const now = performance.now();
      if (now - this.lastDangerAt < 1200) return;
      this.lastDangerAt = now;
    }

    const settings: Record<AudioCue, [number, number, number]> = {
      interact: [420, 0.035, 0.06],
      objective: [660, 0.055, 0.11],
      danger: [180, 0.05, 0.1],
      win: [880, 0.065, 0.22],
      lose: [120, 0.065, 0.28],
      shoot: [145, 0.055, 0.08],
      hit: [920, 0.035, 0.055],
      reload: [360, 0.03, 0.12],
      eliminate: [1180, 0.05, 0.16],
      empty: [210, 0.025, 0.045],
      damage: [96, 0.055, 0.11],
    };
    const [frequency, gainValue, duration] = settings[type];

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type =
      type === 'danger' || type === 'lose' || type === 'shoot' || type === 'damage'
        ? 'sawtooth'
        : 'sine';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    if (type === 'win' || type === 'eliminate') {
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 1.5,
        context.currentTime + duration,
      );
    }
    gain.gain.setValueAtTime(gainValue, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    }

    try {
      this.context = new AudioContext();
      return this.context;
    } catch {
      return null;
    }
  }
}
