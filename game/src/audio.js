// LEONIDA NIGHTS — all sound is synthesized with WebAudio. No audio files,
// no network: every engine hum, siren, cash chime and crash is an oscillator
// or filtered noise built here at runtime.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.enabled = true;
  }

  /** Must be called from a user gesture (the Start button). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngineLoop();
    } catch (err) {
      this.enabled = false;
    }
  }

  startEngineLoop() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  /** speedFrac 0..1, driving true while the player is in a car. */
  setEngine(speedFrac, driving) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(52 + speedFrac * 165, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedFrac * 0.075 : 0.0, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      let high = true;
      this.sirenTimer = window.setInterval(() => {
        if (!this.sirenOsc) return;
        high = !high;
        this.sirenOsc.frequency.setTargetAtTime(high ? 720 : 540, this.ctx.currentTime, 0.05);
      }, 420);
    } else if (!on && this.sirenOsc) {
      window.clearInterval(this.sirenTimer);
      this.sirenTimer = null;
      try { this.sirenOsc.stop(); } catch (err) { /* already stopped */ }
      this.sirenOsc.disconnect();
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  blip(freq, dur, type = 'sine', vol = 0.16) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur);
  }

  cash() {
    this.blip(880, 0.12, 'sine', 0.2);
    window.setTimeout(() => this.blip(1318, 0.18, 'sine', 0.2), 90);
    window.setTimeout(() => this.blip(1760, 0.24, 'sine', 0.16), 180);
  }

  crash(strength = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.22);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.value = 0.3 * Math.min(1, strength);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    this.blip(70, 0.25, 'square', 0.2);
  }

  denied() {
    this.blip(180, 0.16, 'square', 0.12);
    window.setTimeout(() => this.blip(140, 0.2, 'square', 0.12), 110);
  }

  rankUp() {
    [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => this.blip(f, 0.22, 'triangle', 0.18), i * 110));
  }
}
