import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import type { Plugin, ResolvedConfig } from 'vite';

/** Stamps the hand-written service worker (src/sw/service-worker.js) with the build's file list and a content
 *  hash, and writes it to dist/sw.js. No PWA plugin: the cache list and the CSP stay understood (DESIGN.md 9.2). */
export function precachePlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'fqu-precache',
    apply: 'build',
    configResolved(c) { config = c; },
    closeBundle() {
      const out = config.build.outDir;
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(out, p).split('\\').join('/'));
        }
      };
      walk(out);
      const assets = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.startsWith('_'));
      const hash = createHash('sha256');
      for (const f of assets.sort()) hash.update(f).update(readFileSync(join(out, f)));
      const version = hash.digest('hex').slice(0, 12);
      const src = readFileSync(join(config.root, 'src/sw/service-worker.js'), 'utf8');
      const list = assets.map((f) => (f === 'index.html' ? './' : `./${f}`));
      const sw = src.replace('__VERSION__', version).replace('__ASSETS__', JSON.stringify(list, null, 2).slice(1, -1).trim());
      writeFileSync(join(out, 'sw.js'), sw);
      config.logger.info(`[fqu-precache] sw.js: ${assets.length} files, version ${version}`);
    },
  };
}
