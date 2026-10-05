import type { Frac } from './rational';

export type Rep = 'area' | 'bar' | 'line' | 'set' | 'symbol';
export const REPS: readonly Rep[] = ['area', 'bar', 'line', 'set', 'symbol'];

/** What the learner submits. Shape is fixed per item kind; the UI never sends another shape. */
export type Answer =
  | { kind: 'int'; value: number }
  | { kind: 'frac'; n: number; d: number }
  | { kind: 'bool'; value: boolean };

/** A scene is a value state the walkthrough can draw. One scene = one keyframe. */
export interface Scene {
  rep: Rep;
  /** Pieces per whole. */
  d: number;
  /** Shaded pieces, 0..d*wholes. */
  shaded: number;
  /** Number of wholes drawn (1 for equivalence; more for improper later). */
  wholes: number;
  /** For set and array models: how the pieces are grouped (perGroup pieces make one group). */
  groups?: { count: number; perGroup: number };
  /** Equation tokens under the picture, e.g. ["2/3", "=", "?/6"]. "?" marks the unknown. */
  equation: string[];
  /** Pieces to call out (indexes into 0..d*wholes-1). */
  highlight?: number[];
}

export type StepKind = 'show' | 'split' | 'merge' | 'shade' | 'count' | 'write' | 'compare';

export interface Step {
  kind: StepKind;
  /** Caption, grade 4 to 5, no em or en dashes. */
  say: string;
  before: Scene;
  after: Scene;
}

export type ItemKind = 'missing-part' | 'is-equivalent' | 'find-pair' | 'name-fraction' | 'mult-fact';

export interface MissingPartGiven {
  kind: 'missing-part';
  from: Frac;
  /** Which part of the target the learner fills in. */
  missing: 'numerator' | 'denominator';
  /** The known part of the target (denominator if missing numerator, and the other way round). */
  known: number;
  k: number;
}

export type Distractor = 'equal' | 'adds-to-both' | 'scales-numerator-only' | 'scales-denominator-only' | 'different-scale-factors';

export interface IsEquivalentGiven {
  kind: 'is-equivalent';
  a: Frac;
  b: Frac;
  distractor: Distractor;
}

export interface FindPairGiven {
  kind: 'find-pair';
  from: Frac;
  /** The answer must have a denominator larger than this (the given denominator) and at most maxD. */
  maxD: number;
}

export interface NameFractionGiven {
  kind: 'name-fraction';
  shaded: number;
  d: number;
}

export interface MultFactGiven {
  kind: 'mult-fact';
  a: number;
  b: number;
}

export type Given = MissingPartGiven | IsEquivalentGiven | FindPairGiven | NameFractionGiven | MultFactGiven;

export interface Item {
  id: string;
  templateId: string;
  skillId: string;
  kind: ItemKind;
  rep: Rep;
  seed: number;
  given: Given;
  answer: Answer;
  /** Steps that solve the item. The last step's `after` scene carries the answer (tested). */
  trace: Step[];
  /** Misconception ids this item can detect, in priority order. */
  misconceptions: string[];
}

export interface Grade {
  correct: boolean;
  /** Set when the answer's shape is wrong (half-filled, zero denominator). Not an attempt. */
  invalid?: string;
  misconceptionId: string | null;
}

export interface ParamRange {
  min: number;
  max: number;
}

export interface TemplateSpec {
  id: string;
  skillId: string;
  generator: string;
  rep: Rep;
  params: Record<string, number | string | ParamRange | string[]>;
  misconceptions: string[];
}
