#!/usr/bin/env node
/** Reads lighthouse.json (npm run lighthouse) and fails below the thresholds in DESIGN.md 10.5.
 *  Lighthouse 12 and later have no PWA category; installability is covered by the manifest and
 *  service worker end-to-end tests instead. */
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(new URL('../lighthouse.json', import.meta.url), 'utf8'));
const MIN = { accessibility: 0.9, 'best-practices': 0.9, performance: 0.8 };
let ok = true;
for (const [cat, min] of Object.entries(MIN)) {
  const score = report.categories[cat]?.score ?? 0;
  console.log(`${cat}: ${Math.round(score * 100)} (min ${Math.round(min * 100)})`);
  if (score < min) ok = false;
}
process.exit(ok ? 0 : 1);
