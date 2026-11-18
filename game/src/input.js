// LEONIDA NIGHTS — keyboard input. Tracks held keys and fires edge-triggered
// actions (E, F, G, Escape) exactly once per press.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      // Keep the page from scrolling on game keys.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  held(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  /** True once, on the frame the key went down. Consumes the press. */
  wasPressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  /** Steering: -1 left, +1 right, from A/D or arrows. */
  steer() {
    let s = 0;
    if (this.held('KeyA', 'ArrowLeft')) s -= 1;
    if (this.held('KeyD', 'ArrowRight')) s += 1;
    return s;
  }

  /** Throttle: -1 reverse/brake, +1 forward, from W/S or arrows. */
  throttle() {
    let t = 0;
    if (this.held('KeyW', 'ArrowUp')) t += 1;
    if (this.held('KeyS', 'ArrowDown')) t -= 1;
    return t;
  }

  /** Called at the end of each frame so un-consumed presses do not linger. */
  endFrame() {
    this.pressed.clear();
  }
}
