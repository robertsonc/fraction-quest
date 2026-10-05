/**
 * Item source: picks templates for a skill and generates items with fresh seeds. In test mode the
 * seeds come from a seeded RNG so the e2e suite is deterministic.
 */
import { Rng, freshSeed } from '../engine/rng';
import { generate } from '../engine/generators';
import { template, skill } from '../content';
import type { Item, Rep } from '../engine/types';

export class ItemSource {
  private readonly rng: Rng | null;

  constructor(seed: number | null) {
    this.rng = seed === null ? null : new Rng(seed);
  }

  seed(): number {
    return this.rng ? Math.floor(this.rng.next() * 0xffffffff) >>> 0 : freshSeed();
  }

  pick<T>(list: readonly T[]): T {
    if (list.length === 0) throw new Error('empty list');
    if (this.rng) return this.rng.pick(list);
    return list[Math.floor(Math.random() * list.length)] as T;
  }

  fromTemplate(templateId: string): Item {
    return generate(template(templateId), this.seed());
  }

  /** A random item from the list, preferring representations not yet covered when given. */
  fromTemplates(templateIds: readonly string[], preferReps?: ReadonlySet<Rep>): Item {
    let pool = templateIds;
    if (preferReps && preferReps.size > 0) {
      const uncovered = templateIds.filter((id) => !preferReps.has(template(id).rep));
      if (uncovered.length > 0 && uncovered.length < templateIds.length) pool = uncovered;
    }
    return this.fromTemplate(this.pick(pool));
  }

  forSkill(skillId: string, preferReps?: ReadonlySet<Rep>): Item {
    return this.fromTemplates(skill(skillId).itemTemplates, preferReps);
  }
}
