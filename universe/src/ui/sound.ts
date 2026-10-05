/** Tiny synth, no audio files, carried from FQ2. */
export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when: number): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      const c = this.ctx;
      if (c.state === 'suspended') void c.resume();
      const t = c.currentTime + when;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.03);
    } catch {
      /* audio is optional */
    }
  }

  play(kind: 'tick' | 'good' | 'bad' | 'win'): void {
    if (!this.enabled) return;
    const seqs: Record<string, [number, number, OscillatorType?, number?][]> = {
      tick: [[1150, 0.035, 'sine', 0.05]],
      good: [[523, 0.1], [659, 0.1], [784, 0.16]],
      bad: [[247, 0.14, 'triangle', 0.08], [196, 0.2, 'triangle', 0.08]],
      win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.32]],
    };
    let t = 0;
    for (const [f, d, type = 'sine', v = 0.1] of seqs[kind] ?? []) {
      this.tone(f, d, type, v, t);
      t += d * 0.8;
    }
  }
}
