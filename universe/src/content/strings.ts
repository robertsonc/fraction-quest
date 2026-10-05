import en from '../../../content/strings/en.json';

type Vars = Record<string, string | number>;

const table: Record<string, string> = en as Record<string, string>;

/** Looks up a user-facing string by id and fills {placeholders}. Missing ids throw in tests and dev. */
export function t(id: string, vars: Vars = {}): string {
  const raw = table[id];
  if (raw === undefined) throw new Error(`missing string: ${id}`);
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    return v === undefined ? m : String(v);
  });
}

export function hasString(id: string): boolean {
  return table[id] !== undefined;
}

export function allStrings(): Readonly<Record<string, string>> {
  return table;
}

const PLURAL: Record<number, string> = {
  1: 'wholes', 2: 'halves', 3: 'thirds', 4: 'fourths', 5: 'fifths', 6: 'sixths', 7: 'sevenths', 8: 'eighths',
  9: 'ninths', 10: 'tenths', 11: 'elevenths', 12: 'twelfths',
};
const SINGLE: Record<number, string> = {
  1: 'whole', 2: 'half', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth',
  9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth',
};
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
const TENS = ['', '', 'twent', 'thirt', 'fort', 'fift', 'sixt', 'sevent', 'eight', 'ninet'];

function ordinal(d: number): string {
  if (d < 20) return ORD[d] ?? `${d}th`;
  const tens = TENS[Math.floor(d / 10)] ?? '';
  return d % 10 ? `${tens}y-${ORD[d % 10] ?? ''}` : `${tens}ieth`;
}

/** "thirds", "a third", "sixtieths". Carried from FQ2. */
export function pieceName(d: number, count = 2): string {
  const single = SINGLE[d];
  const plural = PLURAL[d];
  if (single !== undefined && plural !== undefined) return count === 1 ? single : plural;
  const o = d < 100 ? ordinal(d) : `${d}th`;
  return count === 1 ? o : `${o}s`;
}

/** "2 thirds", "1 half". Spoken form of a fraction for captions and read-aloud. */
export function sayFrac(n: number, d: number): string {
  if (d === 1) return String(n);
  return `${n} ${pieceName(d, n === 1 ? 1 : 2)}`;
}
