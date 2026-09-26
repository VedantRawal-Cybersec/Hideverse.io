export type MoveAxes = {
  x: number;
  z: number;
};

const sensitivityKey = 'hideverse-look-sensitivity';

function readSensitivity(): number {
  const saved = Number.parseFloat(localStorage.getItem(sensitivityKey) ?? '1');
  return Number.isFinite(saved) ? Math.max(0.55, Math.min(1.7, saved)) : 1;
}

export class InputController {
  private readonly keys = new Set<string>();
  private joystickX = 0;
  private joystickZ = 0;
  private jumpQueued = false;
  private interactQueued = false;
  private viewToggleQueued = false;
  private sprintTouch = false;
  private crouchTouch = false;
  private yawValue = 0;
  private pitchValue = -4;
  private touchLookPointer: number | null = null;
  private touchLookX = 0;
  private touchLookY = 0;
  private lookSensitivity = readSensitivity();

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.resetTransientInput);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('click', this.onCanvasClick);
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    canvas.addEventListener('pointerup', this.onCanvasPointerUp);
    canvas.addEventListener('pointercancel', this.onCanvasPointerUp);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    this.bindJoystick();
    this.bindButton('mobile-jump', () => {
      this.jumpQueued = true;
    });
    this.bindButton('mobile-interact', () => {
      this.interactQueued = true;
    });
    this.bindButton('mobile-view', () => {
      this.viewToggleQueued = true;
    });
    this.bindHoldButton('mobile-sprint', (active) => {
      this.sprintTouch = active;
    });
    this.bindHoldButton('mobile-crouch', (active) => {
      this.crouchTouch = active;
    });
  }

  get yaw(): number {
    return this.yawValue;
  }

  get pitch(): number {
    return this.pitchValue;
  }

  get sensitivity(): number {
    return this.lookSensitivity;
  }

  get sprint(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.sprintTouch;
  }

  get crouch(): boolean {
    return this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.crouchTouch;
  }

  get move(): MoveAxes {
    let x = this.joystickX;
    let z = this.joystickZ;

    if (this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;
    if (this.keys.has('KeyW')) z += 1;
    if (this.keys.has('KeyS')) z -= 1;

    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }

    return { x, z };
  }

  setLookSensitivity(value: number): void {
    this.lookSensitivity = Math.max(0.55, Math.min(1.7, value));
    localStorage.setItem(sensitivityKey, this.lookSensitivity.toFixed(2));
  }

  consumeJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  consumeInteract(): boolean {
    const queued = this.interactQueued;
    this.interactQueued = false;
    return queued;
  }

  consumeViewToggle(): boolean {
    const queued = this.viewToggleQueued;
    this.viewToggleQueued = false;
    return queued;
  }

  consumeReset(): boolean {
    if (!this.keys.has('KeyR')) return false;
    this.keys.delete('KeyR');
    return true;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.resetTransientInput);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.resetTransientInput();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
    if (event.code === 'Space' && !event.repeat) {
      this.jumpQueued = true;
      event.preventDefault();
    }
    if (event.code === 'KeyE' && !event.repeat) {
      this.interactQueued = true;
    }
    if (event.code === 'KeyV' && !event.repeat) {
      this.viewToggleQueued = true;
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private onCanvasClick = (): void => {
    if (!matchMedia('(pointer: coarse)').matches && document.pointerLockElement !== this.canvas) {
      void this.canvas.requestPointerLock();
    }
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.applyLook(event.movementX, event.movementY, 0.1);
  };

  private onCanvasPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') return;
    if (event.clientX < window.innerWidth * 0.42) return;
    this.touchLookPointer = event.pointerId;
    this.touchLookX = event.clientX;
    this.touchLookY = event.clientY;
    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  private onCanvasPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.touchLookPointer) return;
    const dx = event.clientX - this.touchLookX;
    const dy = event.clientY - this.touchLookY;
    this.touchLookX = event.clientX;
    this.touchLookY = event.clientY;
    this.applyLook(dx, dy, 0.16);
    event.preventDefault();
  };

  private onCanvasPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.touchLookPointer) {
      this.touchLookPointer = null;
    }
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) this.resetTransientInput();
  };

  private resetTransientInput = (): void => {
    this.keys.clear();
    this.joystickX = 0;
    this.joystickZ = 0;
    this.sprintTouch = false;
    this.crouchTouch = false;
    this.touchLookPointer = null;
  };

  private applyLook(dx: number, dy: number, sensitivity: number): void {
    const scaled = sensitivity * this.lookSensitivity;
    this.yawValue -= dx * scaled;
    this.pitchValue = Math.max(-84, Math.min(84, this.pitchValue - dy * scaled));
  }

  private bindJoystick(): void {
    const base = document.querySelector<HTMLDivElement>('#move-stick');
    const knob = document.querySelector<HTMLDivElement>('#move-stick-knob');
    if (!base || !knob) return;

    let activePointer: number | null = null;

    const update = (event: PointerEvent): void => {
      const rect = base.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = rect.width * 0.34;
      let dx = event.clientX - centerX;
      let dy = event.clientY - centerY;
      const length = Math.hypot(dx, dy);
      if (length > radius) {
        dx = (dx / length) * radius;
        dy = (dy / length) * radius;
      }
      this.joystickX = dx / radius;
      this.joystickZ = -dy / radius;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    base.addEventListener('pointerdown', (event) => {
      activePointer = event.pointerId;
      base.setPointerCapture(event.pointerId);
      update(event);
      event.preventDefault();
      event.stopPropagation();
    });
    base.addEventListener('pointermove', (event) => {
      if (event.pointerId !== activePointer) return;
      update(event);
      event.preventDefault();
      event.stopPropagation();
    });
    const release = (event: PointerEvent): void => {
      if (event.pointerId !== activePointer) return;
      activePointer = null;
      this.joystickX = 0;
      this.joystickZ = 0;
      knob.style.transform = 'translate(0, 0)';
      event.preventDefault();
      event.stopPropagation();
    };
    base.addEventListener('pointerup', release);
    base.addEventListener('pointercancel', release);
  }

  private bindButton(id: string, action: () => void): void {
    const button = document.querySelector<HTMLButtonElement>(`#${id}`);
    if (!button) return;
    button.addEventListener('pointerdown', (event) => {
      action();
      event.preventDefault();
      event.stopPropagation();
    });
  }

  private bindHoldButton(id: string, action: (active: boolean) => void): void {
    const button = document.querySelector<HTMLButtonElement>(`#${id}`);
    if (!button) return;
    button.addEventListener('pointerdown', (event) => {
      button.setPointerCapture(event.pointerId);
      action(true);
      event.preventDefault();
      event.stopPropagation();
    });
    const release = (event: PointerEvent): void => {
      action(false);
      event.preventDefault();
      event.stopPropagation();
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
  }
}
