import { describe, it, expect } from 'vitest';
import { content, lintContent, graph } from '../../src/content';
import { allStrings } from '../../src/content/strings';
import { denylist } from '../../src/content';

describe('content lint', () => {
  it('has no dangling references', () => {
    expect(lintContent()).toEqual([]);
  });

  it('the Phase 1 skill has two prerequisites that are roots', () => {
    expect(graph.prereqsOf('nf.equiv')).toEqual(['nf.meaning', 'ops.multfacts']);
    expect(graph.prereqsOf('nf.meaning')).toEqual([]);
    expect(graph.prereqsOf('ops.multfacts')).toEqual([]);
  });

  it('five worlds, one open', () => {
    expect(content.worlds).toHaveLength(5);
    expect(content.worlds.filter((w) => w.status === 'open').map((w) => w.id)).toEqual(['nf']);
  });

  it('every user-facing string is free of em and en dashes and licensed names', () => {
    const bad: string[] = [];
    const names = denylist.map((n) => n.toLowerCase());
    for (const [id, s] of Object.entries(allStrings())) {
      if (/[–—]/.test(s)) bad.push(`${id}: dash`);
      const lower = s.toLowerCase();
      for (const n of names) if (new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)) bad.push(`${id}: ${n}`);
    }
    expect(bad).toEqual([]);
  });
});
