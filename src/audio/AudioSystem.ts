/** Procedural audio via Web Audio API — no external assets */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private stallGain: GainNode | null = null;
  private stallOsc: OscillatorNode | null = null;
  private started = false;
  private volume = 0.7;

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  async ensureStarted(): Promise<void> {
    if (this.started) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);

    // Engine: dual oscillators
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(this.master);
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    const engFilter = this.ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 400;
    this.engineOsc.connect(engFilter);
    engFilter.connect(this.engineGain);
    this.engineOsc.start();

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 90;
    const engGain2 = this.ctx.createGain();
    engGain2.gain.value = 0.15;
    this.engineOsc2.connect(engGain2);
    engGain2.connect(this.engineGain);
    this.engineOsc2.start();

    // Wind: filtered noise
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 800;
    this.windFilter.Q.value = 0.5;
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    this.windSource = this.createNoiseSource();
    this.windSource.connect(this.windFilter);
    this.windSource.start();

    // Stall warning beep
    this.stallGain = this.ctx.createGain();
    this.stallGain.gain.value = 0;
    this.stallGain.connect(this.master);
    this.stallOsc = this.ctx.createOscillator();
    this.stallOsc.type = 'square';
    this.stallOsc.frequency.value = 900;
    this.stallOsc.connect(this.stallGain);
    this.stallOsc.start();

    this.started = true;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  private createNoiseSource(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  update(throttle: number, airspeed: number, stalled: boolean, onGround: boolean): void {
    if (!this.started || !this.ctx) return;

    const t = this.ctx.currentTime;
    // Engine
    const engVol = 0.04 + throttle * 0.18;
    this.engineGain!.gain.setTargetAtTime(engVol, t, 0.08);
    this.engineOsc!.frequency.setTargetAtTime(45 + throttle * 120 + airspeed * 0.15, t, 0.1);
    this.engineOsc2!.frequency.setTargetAtTime(70 + throttle * 160, t, 0.1);

    // Wind
    const windVol = Math.min(0.22, (airspeed / 120) * 0.22) * (onGround ? 0.3 : 1);
    this.windGain!.gain.setTargetAtTime(windVol, t, 0.15);
    this.windFilter!.frequency.setTargetAtTime(400 + airspeed * 8, t, 0.2);

    // Stall
    if (stalled && !onGround) {
      const beep = Math.sin(t * 12) > 0 ? 0.12 : 0;
      this.stallGain!.gain.setTargetAtTime(beep, t, 0.02);
    } else {
      this.stallGain!.gain.setTargetAtTime(0, t, 0.05);
    }
  }

  playTouchdown(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  playCrash(): void {
    if (!this.ctx || !this.master) return;
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = 0.35;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }
}
