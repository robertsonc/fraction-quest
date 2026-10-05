/**
 * Small seeded PRNG (mulberry32). Items are stored as template id plus seed and regenerated on demand,
 * so the generator must be deterministic for a given seed (DESIGN.md 6.1).
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number {
    if (hi < lo) throw new RangeError(`empty range ${lo}..${hi}`);
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick from empty list');
    return items[this.int(0, items.length - 1)] as T;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const t = a[i] as T;
      a[i] = a[j] as T;
      a[j] = t;
    }
    return a;
  }
}

/** A fresh seed from the platform RNG, for new items. */
export function freshSeed(): number {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] as number;
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
