#!/usr/bin/env node
/**
 * Scans every user-facing string for em dashes, en dashes and licensed names (DESIGN.md 10.5).
 * Sources: content/strings/*.json, content/lessons and skills (titles), and string literals in src/ui.
 * Exit 1 on any hit.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '..');
const cast = JSON.parse(readFileSync(join(repo, 'content/cast.json'), 'utf8'));
const deny = cast.denylist.map((n) => n.toLowerCase());
const allowedNames = new Set([...cast.kids, ...cast.animals, cast.guide].map((n) => n.toLowerCase()));

const problems = [];
function check(where, text) {
  if (/[–—]/.test(text)) problems.push(`${where}: em or en dash in "${text.slice(0, 60)}"`);
  const lower = text.toLowerCase();
  for (const n of deny) {
    const re = new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
    if (re.test(lower)) problems.push(`${where}: licensed name "${n}" in "${text.slice(0, 60)}"`);
  }
}

function walk(dir, exts) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== 'dist') out.push(...walk(p, exts)); }
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

// 1. Content JSON: every string value.
for (const file of walk(join(repo, 'content'), ['.json'])) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const visit = (v, path) => {
    if (typeof v === 'string') { if (!path.includes('denylist')) check(`${file}:${path}`, v); }
    else if (Array.isArray(v)) v.forEach((x, i) => visit(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, path ? `${path}.${k}` : k);
  };
  visit(data, '');
}

// 2. UI source: string literals (single, double, template) in src/, excluding import paths and selectors.
for (const file of walk(join(root, 'src'), ['.ts'])) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(import|export .* from)/.test(line)) return;
    const literals = line.match(/'([^'\\]|\\.)*'|"([^"\\]|\\.)*"|`([^`\\]|\\.)*`/g) ?? [];
    for (const lit of literals) check(`${file}:${i + 1}`, lit);
  });
}

// 3. Story names must come from the cast.
const storyFiles = walk(join(repo, 'content'), ['.json']).filter((f) => /lessons|strings/.test(f));
for (const file of storyFiles) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\b([A-Z][a-z]{2,})\s+(baked|made|has|had|cut|shared|ran|walked|drank|ate|bought|brought|poured)\b/g)) {
    if (!allowedNames.has(m[1].toLowerCase())) problems.push(`${file}: story name "${m[1]}" is not in content/cast.json`);
  }
}

if (problems.length) {
  console.error(`string scan: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('string scan: clean');
