/**
 * Draws a Scene (DESIGN.md 4.1) as SVG in any of the five representations. Used by the walkthrough
 * player (keyframes) and by items (the picture the learner reasons over). Pure DOM output; the
 * value drawn is always exactly scene.shaded / scene.d.
 */
import { s } from '../dom';
import type { Scene } from '../../engine/types';

/** Fraction tile palette: color encodes piece size, carried from FQ2 so pieces look familiar. */
export const TILE: Record<number, string> = {
  1: '#E5483B', 2: '#F38B2A', 3: '#F2C12E', 4: '#3FAE68', 5: '#20A4B5', 6: '#3B7EE0',
  7: '#5D59D6', 8: '#8E5AD5', 9: '#C551B2', 10: '#E5567E', 11: '#B97A3D', 12: '#7FA736',
};
export function tileColor(d: number): string {
  return TILE[d] ?? `hsl(${(d * 47) % 360}, 58%, 46%)`;
}
export function tileText(d: number): string {
  return d === 3 || d === 12 ? '#3A2E05' : '#FFFFFF';
}

export interface SceneOpts {
  /** Grid for the area model: columns then rows. Defaults to one row of d columns (up to 12), else a near-square grid. */
  grid?: { cols: number; rows: number };
  /** Called when a piece is tapped (interactive items). */
  onPiece?: (index: number) => void;
  /** Number-line variant: show the point label. */
  labels?: boolean;
  width?: number;
}

export function gridFor(d: number, hint?: { cols: number; rows: number }): { cols: number; rows: number } {
  if (hint && hint.cols * hint.rows === d) return hint;
  if (d <= 12) return { cols: d, rows: 1 };
  let best = { cols: d, rows: 1 };
  for (let r = 2; r * r <= d; r++) if (d % r === 0) best = { cols: d / r, rows: r };
  return best;
}

/** Piece index -> cell, column-major so shaded columns stay shaded when rows are added by a split. */
function cellOf(i: number, rows: number): { col: number; row: number } {
  return { col: Math.floor(i / rows), row: i % rows };
}

export function renderScene(scene: Scene, opts: SceneOpts = {}): SVGSVGElement {
  switch (scene.rep) {
    case 'area': return renderArea(scene, opts);
    case 'bar': return renderBar(scene, opts);
    case 'line': return renderLine(scene, opts);
    case 'set': return renderSet(scene, opts);
    case 'symbol': return renderSymbol(scene);
  }
}

function pieceAttrs(i: number, scene: Scene, opts: SceneOpts): Record<string, string | number | boolean | EventListener> {
  const shaded = i < scene.shaded;
  const hi = scene.highlight?.includes(i) ?? false;
  const attrs: Record<string, string | number | boolean | EventListener> = {
    class: `piece ${shaded ? 'shaded' : 'empty'} ${hi ? 'hi' : ''}`.trim(),
    'data-i': i,
  };
  if (opts.onPiece) {
    attrs['tabindex'] = 0;
    attrs['role'] = 'button';
    attrs['aria-label'] = `Piece ${i + 1} of ${scene.d}, ${shaded ? 'shaded' : 'not shaded'}`;
    const cb = opts.onPiece;
    attrs['onclick'] = () => cb(i);
    attrs['onkeydown'] = ((e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cb(i); } }) as EventListener;
  }
  return attrs;
}

function renderArea(scene: Scene, opts: SceneOpts): SVGSVGElement {
  const W = 320, H = 320, pad = 6;
  const { cols, rows } = gridFor(scene.d, opts.grid);
  const cw = (W - 2 * pad) / cols, rh = (H - 2 * pad) / rows;
  const color = tileColor(Math.min(12, scene.d));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scene area', role: 'img', 'aria-label': `${scene.shaded} of ${scene.d} pieces shaded` });
  svg.append(s('rect', { x: pad, y: pad, width: W - 2 * pad, height: H - 2 * pad, rx: 14, class: 'tray' }));
  const g = s('g', { class: 'pieces' });
  for (let i = 0; i < scene.d; i++) {
    const { col, row } = cellOf(i, rows);
    g.append(s('rect', {
      x: pad + col * cw + 1.5, y: pad + row * rh + 1.5, width: cw - 3, height: rh - 3, rx: 6,
      fill: i < scene.shaded ? color : 'transparent',
      ...pieceAttrs(i, scene, opts),
    }));
  }
  svg.append(g);
  // Grid lines drawn over the pieces so a split reads as cutting.
  const lines = s('g', { class: 'cuts', 'aria-hidden': 'true' });
  for (let c = 1; c < cols; c++) lines.append(s('line', { x1: pad + c * cw, y1: pad, x2: pad + c * cw, y2: H - pad, class: 'cut col' }));
  for (let r = 1; r < rows; r++) lines.append(s('line', { x1: pad, y1: pad + r * rh, x2: W - pad, y2: pad + r * rh, class: 'cut row' }));
  svg.append(lines);
  return svg;
}

function renderBar(scene: Scene, opts: SceneOpts): SVGSVGElement {
  const W = 640, H = 84, pad = 6;
  const d = scene.d;
  const cw = (W - 2 * pad) / d;
  const color = tileColor(Math.min(12, d));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scene bar', role: 'img', 'aria-label': `${scene.shaded} of ${d} tiles in the bar` });
  svg.append(s('rect', { x: pad - 3, y: pad - 3, width: W - 2 * pad + 6, height: H - 2 * pad + 6, rx: 12, class: 'tray' }));
  for (let i = 0; i < d; i++) {
    const x = pad + i * cw;
    const shaded = i < scene.shaded;
    const g = s('g', { class: 'tile' });
    g.append(s('rect', { x: x + 2, y: pad + 2, width: cw - 4, height: H - 2 * pad - 4, rx: 6, fill: shaded ? color : 'transparent', ...pieceAttrs(i, scene, opts) }));
    if (shaded && cw >= 34) g.append(s('text', { x: x + cw / 2, y: H / 2 + 1, class: 'tlabel', fill: tileText(Math.min(12, d)), 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'aria-hidden': 'true' }, `1/${d}`));
    svg.append(g);
  }
  return svg;
}

function renderLine(scene: Scene, opts: SceneOpts): SVGSVGElement {
  const W = 640, H = 150, left = 36, right = W - 36, y = 96;
  const d = scene.d;
  const unit = (right - left) / d;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scene line', role: 'img', 'aria-label': `Number line from 0 to 1 split into ${d}, point at ${scene.shaded} of ${d}` });
  // Jumps for each shaded interval.
  const jumps = s('g', { class: 'jumps' });
  for (let i = 0; i < Math.min(scene.shaded, d); i++) {
    const x0 = left + i * unit, x1 = left + (i + 1) * unit;
    jumps.append(s('path', { d: `M${x0} ${y - 4} Q${(x0 + x1) / 2} ${y - 46} ${x1} ${y - 4}`, class: 'jump', fill: 'none', stroke: tileColor(Math.min(12, d)), 'stroke-width': 4, 'stroke-linecap': 'round', 'data-i': i }));
  }
  svg.append(jumps);
  svg.append(s('line', { x1: left, y1: y, x2: right, y2: y, class: 'axis' }));
  for (let i = 0; i <= d; i++) {
    const x = left + i * unit;
    const major = i === 0 || i === d;
    svg.append(s('line', { x1: x, y1: y - (major ? 16 : 10), x2: x, y2: y + (major ? 16 : 10), class: `tick ${major ? 'major' : ''}`.trim(), 'data-i': i }));
    if (major) svg.append(s('text', { x, y: y + 38, class: 'ticklbl', 'text-anchor': 'middle' }, String(i === 0 ? 0 : 1)));
  }
  const px = left + Math.min(scene.shaded, d) * unit;
  svg.append(s('circle', { cx: px, cy: y, r: 9, class: 'point', fill: tileColor(Math.min(12, d)) }));
  if (opts.labels !== false && scene.shaded > 0) {
    svg.append(s('text', { x: px, y: y + 38, class: 'ticklbl point-lbl', 'text-anchor': 'middle' }, `${scene.shaded}/${d}`));
  }
  if (opts.onPiece) {
    // Tap targets over each interval (at least 44 px tall).
    for (let i = 0; i < d; i++) {
      svg.append(s('rect', { x: left + i * unit, y: y - 50, width: unit, height: 80, fill: 'transparent', ...pieceAttrs(i, scene, opts) }));
    }
  }
  return svg;
}

function renderSet(scene: Scene, opts: SceneOpts): SVGSVGElement {
  const d = scene.d;
  const groups = scene.groups ?? { count: 1, perGroup: d };
  const perRowGroups = Math.min(groups.count, groups.count <= 3 ? groups.count : Math.ceil(Math.sqrt(groups.count)));
  const groupRows = Math.ceil(groups.count / perRowGroups);
  const innerCols = Math.min(groups.perGroup, groups.perGroup <= 4 ? groups.perGroup : Math.ceil(Math.sqrt(groups.perGroup)));
  const innerRows = Math.ceil(groups.perGroup / innerCols);
  const r = 14, gap = 8, pad = 12;
  const gw = innerCols * (2 * r + gap) + pad, gh = innerRows * (2 * r + gap) + pad;
  const W = perRowGroups * (gw + 10) + 10, H = groupRows * (gh + 10) + 10;
  const color = tileColor(Math.min(12, groups.perGroup === d ? d : groups.count));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scene set', role: 'img', 'aria-label': `${scene.shaded} of ${d} objects filled, in ${groups.count} groups of ${groups.perGroup}` });
  let idx = 0;
  for (let gi = 0; gi < groups.count; gi++) {
    const gx = 10 + (gi % perRowGroups) * (gw + 10), gy = 10 + Math.floor(gi / perRowGroups) * (gh + 10);
    if (groups.count > 1) svg.append(s('rect', { x: gx, y: gy, width: gw, height: gh, rx: 12, class: 'group' }));
    for (let k = 0; k < groups.perGroup && idx < d; k++, idx++) {
      const cx = gx + pad / 2 + (k % innerCols) * (2 * r + gap) + r + gap / 2;
      const cy = gy + pad / 2 + Math.floor(k / innerCols) * (2 * r + gap) + r + gap / 2;
      svg.append(s('circle', { cx, cy, r, fill: idx < scene.shaded ? color : 'transparent', ...pieceAttrs(idx, scene, opts) }));
    }
  }
  return svg;
}

function renderSymbol(scene: Scene): SVGSVGElement {
  // The symbol representation is the equation itself; the picture is a placeholder glyph.
  const svg = s('svg', { viewBox: '0 0 320 120', class: 'scene symbol', role: 'img', 'aria-label': scene.equation.join(' ') });
  svg.append(s('text', { x: 160, y: 72, class: 'symbol-eq', 'text-anchor': 'middle' }, scene.equation.join(' ')));
  return svg;
}
