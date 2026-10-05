import { Rng } from '../rng';
import type { Item, TemplateSpec } from '../types';
import { genFindPair, genIsEquivalent, genMissingPart } from './equiv';
import { genMultFact, genNameFraction } from './prereqs';

export type Generator = (spec: TemplateSpec, seed: number, rng: Rng) => Item;

const REGISTRY: Record<string, Generator> = {
  equivMissingPart: genMissingPart,
  equivIsEquivalent: genIsEquivalent,
  equivFindPair: genFindPair,
  nameFraction: genNameFraction,
  multFact: genMultFact,
};

export function generatorNames(): string[] {
  return Object.keys(REGISTRY);
}

/** Deterministic: the same template and seed always produce the same item. */
export function generate(spec: TemplateSpec, seed: number): Item {
  const gen = REGISTRY[spec.generator];
  if (!gen) throw new Error(`unknown generator ${spec.generator} in template ${spec.id}`);
  return gen(spec, seed, new Rng(seed));
}
