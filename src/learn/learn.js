/* Learn pages: concept animations. Plain JS, no inline script (the site's CSP forbids it).
   One init function per page; each returns early when its root element is missing. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the app's tile palette: color = piece size ---------- */
  const TILE = { 1: '#E5483B', 2: '#F38B2A', 3: '#F2C12E', 4: '#3FAE68', 5: '#20A4B5', 6: '#3B7EE0', 7: '#5D59D6', 8: '#8E5AD5', 9: '#C551B2', 10: '#E5567E', 11: '#B97A3D', 12: '#7FA736' };
  const tileColor = (d) => TILE[d] || `hsl(${(d * 47) % 360}, 58%, 50%)`;
  const tileText = (d) => (d === 3 ? '#3A2E05' : '#FFFFFF');
  const GROUP = ['#3B7EE0', '#E5483B', '#3FAE68', '#8E5AD5', '#F38B2A', '#20A4B5', '#C551B2', '#7FA736', '#5D59D6', '#E5567E', '#B97A3D', '#F2C12E'];

  const gcd = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; };
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  const smallestFactor = (n) => { for (let p = 2; p * p <= n; p++) if (n % p === 0) return p; return n; };
  const f1 = (x) => Math.round(x * 10) / 10;
  const sleep = (ms) => new Promise((res) => setTimeout(res, reduced ? 0 : ms));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
  const isAre = (k) => (k === 1 ? 'is' : 'are');
  const an = (w) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);
  const PIECE = { 2: 'half', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth' };
  const pieces = (d, k = 2) => { const w = PIECE[d] || `1/${d} piece`; return k === 1 ? w : (PIECE[d] ? (d === 2 ? 'halves' : `${w}s`) : `${w}s`); };

  /** Runs fn(progress) every frame for ms; progress is eased 0..1. Jumps straight to the end under reduced motion. */
  function tween(ms, fn) {
    if (reduced || ms <= 0) { fn(1); return Promise.resolve(); }
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        fn(ease(t));
        if (t < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }

  const fracHTML = (n, d) => `<span class="frac" role="img" aria-label="${n} over ${d}"><span aria-hidden="true">${n}</span><i></i><span aria-hidden="true">${d}</span></span>`;
  const opsHTML = (k) => `<span class="ops"><span>÷ ${k}</span><span class="sign">=</span><span>÷ ${k}</span></span>`;
  const opHTML = (s) => `<span class="op">${s}</span>`;
  /** n/d as a whole number, a mixed number, or a fraction. */
  function valueHTML(n, d) {
    const g0 = gcd(n, d) || 1; n /= g0; d /= g0;
    if (d === 1 || n % d === 0) return `<span class="whole">${n / d}</span>`;
    if (n > d) return `<span class="mixed" role="img" aria-label="${Math.floor(n / d)} and ${n % d} over ${d}"><span class="w">${Math.floor(n / d)}</span>${fracHTML(n % d, d)}</span>`;
    return fracHTML(n, d);
  }
  function valueText(n, d) {
    const g0 = gcd(n, d) || 1; n /= g0; d /= g0;
    if (d === 1 || n % d === 0) return `${n / d}`;
    if (n > d) return `${Math.floor(n / d)} and ${n % d}/${d}`;
    return `${n}/${d}`;
  }
  /** Plain-language "can I simplify?" sentence for n/d, with the simplified value. */
  function simplifyNote(n, d) {
    const g = gcd(n, d);
    if (d === 1) return '';
    if (g === 1 && n < d) return `Can I simplify? No. Only 1 goes into ${n} and ${d}. ${n}/${d} is done.`;
    if (g === 1) return `Can I simplify? No. Only 1 goes into ${n} and ${d}. The top is bigger than the bottom, so write it as ${valueText(n, d)}.`;
    const a = n / g, b = d / g;
    return `Can I simplify? Yes. ${g} goes into ${n} and ${d}. ${n}/${d} = ${valueText(a, b)}.`;
  }

  function el(tag, attrs = {}, parent = null) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    if (parent) parent.appendChild(node);
    return node;
  }
  function text(parent, cls, x, y, str, attrs = {}) {
    const t = el('text', Object.assign({ class: cls, x: f1(x), y: f1(y) }, attrs), parent);
    t.textContent = str;
    return t;
  }

  /** A fraction tile: colored rect + glass sheen + optional label. set() moves and resizes it. */
  function tileEl(parent, d, label, cls = '', color = null) {
    const g = el('g', { class: `tile ${cls}`.trim() }, parent);
    const body = el('rect', { rx: 6, fill: color || tileColor(d) }, g);
    const sheen = el('rect', { rx: 6, fill: 'url(#sheen)' }, g);
    const tx = el('text', { class: 'tlabel', fill: tileText(d) }, g);
    tx.textContent = label;
    const t = {
      g,
      set(x, y, w, h) {
        for (const r of [body, sheen]) { r.setAttribute('x', f1(x)); r.setAttribute('y', f1(y)); r.setAttribute('width', f1(Math.max(0, w))); r.setAttribute('height', f1(Math.max(0, h))); }
        tx.setAttribute('x', f1(x + w / 2)); tx.setAttribute('y', f1(y + h / 2));
        tx.style.display = (w >= 30 + 7 * String(label).length && h >= 18) ? '' : 'none';
        return t;
      },
    };
    return t;
  }

  /** Flies tiles along moves [{from, to, d, label, color?}] inside `layer`, reshaping on the way; resolves when all have landed. */
  async function flyTiles(layer, moves, opts = {}) {
    const { dur = 700, stagger = 120, onStart = null } = opts;
    const flyers = moves.map((m, i) => ({ m, t: tileEl(layer, m.d, m.label, '', m.color || null).set(m.from.x, m.from.y, m.from.w, m.from.h), delay: m.delay != null ? m.delay : i * stagger, started: false }));
    const total = reduced ? 0 : dur;
    const last = flyers.length ? Math.max(...flyers.map((f) => f.delay)) + total : 0;
    const start = performance.now();
    await tween(last, () => {
      const now = performance.now() - start;
      for (const f of flyers) {
        const p = reduced ? 1 : Math.max(0, Math.min(1, (now - f.delay) / total));
        if (p > 0 && !f.started) { f.started = true; if (onStart) onStart(f.m); }
        const e = ease(p), a = f.m.from, b = f.m.to;
        f.t.set(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, a.w + (b.w - a.w) * e, a.h + (b.h - a.h) * e);
      }
    });
    layer.innerHTML = '';
  }

  /** Numbered outlines around consecutive groups of `size` cells; cells past q whole groups are the dashed leftover. */
  function markGroupCells(cells, size, q, parent) {
    cells.forEach((cell, i) => {
      const grp = Math.floor(i / size), isRest = grp >= q;
      const color = isRest ? null : GROUP[grp % GROUP.length];
      const cr = cell.rect;
      el('rect', { class: `chunk ${isRest ? 'rest' : ''}`, x: f1(cr.x - 1), y: f1(cr.y - 1), width: f1(cr.w + 2), height: f1(cr.h + 2), rx: 9, style: `animation-delay:${Math.min(i, 40) * 30}ms${color ? `;stroke:${color}` : ''}` }, parent);
      if (!isRest && i % size === 0) {
        const bx = cr.x + 4, by = cr.y + 4;
        el('circle', { class: 'badge', cx: f1(bx + 10), cy: f1(by + 10), r: 11, fill: color }, parent);
        text(parent, 'badge-n', bx + 10, by + 10, String(grp + 1), { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      }
    });
  }
  const timesWord = (q) => (q === 1 ? 'once' : q === 2 ? 'twice' : `${q} times`);
  const mixedText = (w, n, d) => (n === 0 ? `${w}` : (w ? `${w} ${n}/${d}` : `${n}/${d}`));
  const mixedHTML = (w, n, d) => (n === 0 ? `<span class="whole">${w}</span>` : (w ? `<span class="mixed" role="img" aria-label="${w} and ${n} over ${d}"><span class="w">${w}</span>${fracHTML(n, d)}</span>` : fracHTML(n, d)));

  /* ---------- scene: one or two squares with a label between ---------- */
  class Scene {
    constructor(svg, opts = {}) {
      this.svg = svg;
      this.o = Object.assign({ squares: 2, mid: 160, midV: 170, maxS: 320 }, opts);
      this.leftTiles = [];
    }
    /** Two squares side by side when there is room, otherwise the second sits under the first. */
    layout() {
      const W = Math.max(300, Math.round(this.svg.getBoundingClientRect().width) || 700);
      const pad = 8, top = pad + 22;
      this.W = W;
      if (this.o.squares === 1) {
        this.S = Math.min(this.o.maxS, W - 2 * pad);
        this.L = { x: Math.round((W - this.S) / 2), y: top };
        this.R = null; this.M = null; this.horiz = true;
        this.H = this.S + top + pad;
      } else {
        this.horiz = W >= 600;
        if (this.horiz) {
          const mid = this.o.mid;
          this.S = Math.min(this.o.maxS, Math.floor((W - 2 * pad - mid) / 2));
          const x0 = Math.round((W - (2 * this.S + mid)) / 2);
          this.L = { x: x0, y: top };
          this.R = { x: x0 + this.S + mid, y: top };
          this.M = { x: x0 + this.S + mid / 2, y: top + this.S / 2 };
          this.H = this.S + top + pad;
        } else {
          const mid = this.o.midV;
          this.S = Math.min(this.o.maxS, W - 2 * pad);
          const x = Math.round((W - this.S) / 2);
          this.L = { x, y: top };
          this.R = { x, y: top + this.S + mid };
          this.M = { x: W / 2, y: top + this.S + mid / 2 - 12 };
          this.H = 2 * this.S + mid + top + pad + 22;
        }
      }
      this.svg.setAttribute('viewBox', `0 0 ${W} ${this.H}`);
      this.svg.setAttribute('height', String(this.H));
    }
    clear() {
      this.svg.innerHTML = '';
      this.gL = el('g', { class: 'sq-left' }, this.svg);
      this.gR = el('g', { class: 'sq-right' }, this.svg);
      this.gM = el('g', { class: 'mid' }, this.svg);
      this.gF = el('g', { class: 'flyers' }, this.svg);
      this.leftTiles = [];
    }
    frame(o, parent, name) {
      el('rect', { class: 'tray', x: o.x - 3, y: o.y - 3, width: this.S + 6, height: this.S + 6, rx: 12 }, parent);
      if (name) text(parent, 'lname', o.x + this.S / 2, o.y - 9, name);
    }
    cell(o, cols, rows, c, r) { const cw = this.S / cols, rh = this.S / rows; return { x: o.x + c * cw + 2, y: o.y + r * rh + 2, w: cw - 4, h: rh - 4 }; }
    col(o, cols, c) { const cw = this.S / cols; return { x: o.x + c * cw + 2, y: o.y + 2, w: cw - 4, h: this.S - 4 }; }
    /** A square cut into cols × rows pieces, the first `shaded` filled in column order (down each column, then the next). */
    grid(o, cols, rows, shaded, d, parent, name, cls = '') {
      this.frame(o, parent, name);
      const cells = [];
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const idx = c * rows + r, cr = this.cell(o, cols, rows, c, r);
          let tile = null, slot = null;
          if (idx < shaded) tile = tileEl(parent, d, `1/${d}`, cls).set(cr.x, cr.y, cr.w, cr.h);
          else slot = el('rect', { class: 'slot', x: f1(cr.x), y: f1(cr.y), width: f1(cr.w), height: f1(cr.h), rx: 6 }, parent);
          cells.push({ c, r, idx, rect: cr, tile, slot });
        }
      }
      return cells;
    }
    /** Thin lines that show one piece cut into k, drawn over an existing grid. */
    cutLines(o, cols, rows, parent) {
      for (let c = 0; c < cols; c++) for (let r = 1; r < rows; r++) {
        const y = o.y + r * (this.S / rows), x0 = o.x + c * (this.S / cols);
        el('line', { class: 'cut', x1: f1(x0 + 3), x2: f1(x0 + this.S / cols - 3), y1: f1(y), y2: f1(y) }, parent);
      }
    }
    /** The fraction in the middle, with "÷ k" beside the top and bottom while a step is happening. */
    label(n, d, k = null) {
      this.gM.innerHTML = '';
      const { x, y } = this.M;
      text(this.gM, 'lnum', x, y - 14, n);
      el('line', { class: 'lbar', x1: x - 26, x2: x + 26, y1: y, y2: y }, this.gM);
      text(this.gM, 'lnum', x, y + 40, d);
      if (k) { text(this.gM, 'lhand', x + 34, y - 16, `÷ ${k}`); text(this.gM, 'lhand', x + 34, y + 38, `÷ ${k}`); }
      this.arrow();
    }
    /** A big operator between the squares (+, −, ÷). */
    sign(s, note = '') {
      this.gM.innerHTML = '';
      const { x, y } = this.M;
      text(this.gM, 'lsign', x, y + 16, s);
      if (note) text(this.gM, 'lhand mid', x, y + 50, note, { 'text-anchor': 'middle' });
    }
    arrow() {
      const { x, y } = this.M, ay = y + 70;
      const d = this.horiz
        ? `M ${x - 28} ${ay} H ${x + 28} M ${x + 14} ${ay - 12} L ${x + 28} ${ay} L ${x + 14} ${ay + 12}`
        : `M ${x + 90} ${y - 30} V ${y + 30} M ${x + 78} ${y + 16} L ${x + 90} ${y + 30} L ${x + 102} ${y + 16}`;
      el('path', { class: 'larrow', d }, this.gM);
    }
    flyTiles(moves, opts = {}) { return flyTiles(this.gF, moves, opts); }

    /* ----- simplify page helpers ----- */
    drawLeft(n, d, k, name) {
      this.leftTiles = this.grid(this.L, d / k, k, n, d, this.gL, name).filter((c) => c.tile).map((c) => ({ c: c.c, r: c.r, t: c.tile }));
    }
    drawRight(cols, filled, dd, name, pop = false) {
      this.frame(this.R, this.gR, name);
      for (let c = 0; c < cols; c++) {
        const cr = this.col(this.R, cols, c);
        if (c < filled) tileEl(this.gR, dd, `1/${dd}`, pop ? 'pop' : '').set(cr.x, cr.y, cr.w, cr.h);
        else el('rect', { class: 'slot', x: f1(cr.x), y: f1(cr.y), width: f1(cr.w), height: f1(cr.h), rx: 6 }, this.gR);
      }
    }
    groups(cols) {
      for (let c = 0; c < cols; c++) {
        const cr = this.col(this.L, cols, c);
        el('rect', { class: 'chunk', x: f1(cr.x - 1), y: f1(cr.y - 1), width: f1(cr.w + 2), height: f1(cr.h + 2), rx: 9, style: `animation-delay:${c * 40}ms` }, this.gL);
      }
    }
    ghostLeft(upToCol) { for (const { c, t } of this.leftTiles) if (c < upToCol) t.g.classList.add('ghost'); }
    async fly(n, d, k) {
      const cols = d / k, filled = n / k, dd = d / k;
      const moves = [];
      for (let c = 0; c < filled; c++) {
        const to = this.col(this.R, cols, c);
        for (let r = 0; r < k; r++) moves.push({ from: this.cell(this.L, cols, k, c, r), to, d, label: `1/${d}`, col: c, row: r });
      }
      await this.flyTiles(moves, { dur: 700, stagger: 40, onStart: (m) => { const src = this.leftTiles.find((lt) => lt.c === m.col && lt.r === m.row); if (src) src.t.g.classList.add('ghost'); } });
      this.ghostLeft(filled);
      this.gR.innerHTML = '';
      this.drawRight(cols, filled, dd, 'Bigger pieces', true);
    }
  }

  /* ---------- shared page controller: steps, buttons, resize ---------- */
  function controller(root, scene, build, firstCaption) {
    const cap = $('.caption', root), where = $('.where', root);
    const btnNext = $('.btn-next', root), btnPlay = $('.btn-play', root), btnReplay = $('.btn-replay', root);
    let steps = [], idx = -1, busy = false, playing = false;
    function say(t) { cap.textContent = t; cap.classList.remove('ink'); if (!reduced) { void cap.getBoundingClientRect(); cap.classList.add('ink'); } }
    function updateButtons() {
      const atEnd = idx >= steps.length - 1;
      btnNext.disabled = busy || atEnd; btnPlay.disabled = busy || atEnd; btnReplay.disabled = busy;
      btnNext.textContent = idx < 0 ? 'Start' : 'Next step';
      where.textContent = steps.length > 1 ? `Step ${Math.max(0, idx + 1)} of ${steps.length}` : '';
    }
    async function runStep(i, animate) {
      busy = true; updateButtons(); idx = i;
      say(steps[i].text);
      try { await steps[i].run(animate); } finally { busy = false; updateButtons(); }
    }
    async function playAll() {
      if (playing) return;
      playing = true; btnPlay.textContent = 'Playing…';
      while (idx < steps.length - 1 && playing) { await runStep(idx + 1, true); if (idx < steps.length - 1) await sleep(1400); }
      playing = false; btnPlay.textContent = 'Play it all'; updateButtons();
    }
    function reset() {
      playing = false; steps = build(); idx = -1;
      steps[0].run(false, true);  // draw the opening picture without advancing
      say(steps.length > 1 ? firstCaption() : steps[0].text);
      if (steps.length === 1) idx = 0;
      updateButtons();
    }
    btnNext.addEventListener('click', () => { if (!busy && idx < steps.length - 1) runStep(idx + 1, true); });
    btnPlay.addEventListener('click', playAll);
    btnReplay.addEventListener('click', () => { playing = false; reset(); });
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (busy) return; if (idx < 0) reset(); else steps[idx].run(false); }, 150); });
    return { reset, stop: () => { playing = false; } };
  }
  function pressOnly(container, el_) { $$('.chip', container).forEach((x) => x.setAttribute('aria-pressed', String(x === el_))); }
  const intIn = (sel, root) => parseInt($(sel, root).value, 10);

  /* ================= simplify ================= */
  function initSimplify() {
    const root = $('#simplify'); if (!root) return;
    const scene = new Scene($('.stage-svg', root));
    const eq = $('.eqline', root), msg = $('.msg', root);
    const PRESETS = [[6, 20], [4, 8], [9, 12], [8, 12], [10, 15], [12, 18], [18, 24], [16, 40], [12, 36]];
    let n = 6, d = 20, mode = 'steps';
    function chain(rounds, upto, showDivide) {
      let html = fracHTML(n, d);
      rounds.forEach((r, i) => {
        if (i < upto) html += `${opsHTML(r.k)}${fracHTML(r.nn, r.dd)}`;
        else if (i === upto && showDivide) html += `<span class="dim">${opsHTML(r.k)}</span>`;
      });
      eq.innerHTML = html;
    }
    function rounds() {
      const out = []; let a = n, b = d;
      while (gcd(a, b) > 1) { const g = gcd(a, b), k = mode === 'jump' ? g : smallestFactor(g); out.push({ n: a, d: b, k, nn: a / k, dd: b / k }); a /= k; b /= k; }
      return out;
    }
    function build() {
      const rs = rounds(), list = [];
      const base = (r, i, withRight) => { scene.layout(); scene.clear(); scene.drawLeft(r.n, r.d, r.k, i === 0 ? 'Small pieces' : 'Pieces'); if (withRight) scene.drawRight(r.d / r.k, 0, r.dd, 'Bigger pieces'); scene.label(r.n, r.d); };
      if (!rs.length) {
        list.push({ text: `This is ${n}/${d}. The square is cut into ${d} pieces, and ${n} ${isAre(n)} shaded. Nothing bigger than 1 goes into both ${n} and ${d}, so it is already simplified all the way.`,
          run: () => { scene.layout(); scene.clear(); scene.drawLeft(n, d, 1, 'Pieces'); scene.label(n, d); chain(rs, 0, false); } });
        return list;
      }
      rs.forEach((r, i) => {
        list.push({ text: i === 0 ? `This is ${n}/${d}. The square is cut into ${d} small pieces, and ${n} of them ${isAre(n)} shaded.` : `Check again. Now it is ${r.n}/${r.d}. Can we use even bigger pieces?`,
          run: (animate, opening) => { if (opening) { scene.layout(); scene.clear(); scene.drawLeft(n, d, 1, 'Pieces'); scene.label(n, d); eq.innerHTML = fracHTML(n, d); return; } base(r, i, true); chain(rs, i, false); } });
        list.push({ text: `${r.k} goes into ${r.n}, and ${r.k} goes into ${r.d}. So group the pieces in ${r.k}s. Each column is one group of ${r.k}.`,
          run: () => { base(r, i, true); scene.groups(r.d / r.k); scene.label(r.n, r.d, r.k); chain(rs, i, true); } });
        list.push({ text: `Each group of ${r.k} small pieces joins into 1 bigger piece. The ${plural(r.n, 'shaded piece')} fly across and become ${plural(r.nn, 'bigger piece')}.`,
          run: async (animate) => { base(r, i, true); scene.groups(r.d / r.k); scene.label(r.n, r.d, r.k); chain(rs, i, true);
            if (animate) await scene.fly(r.n, r.d, r.k); else { scene.ghostLeft(r.nn); scene.gR.innerHTML = ''; scene.drawRight(r.d / r.k, r.nn, r.dd, 'Bigger pieces'); } } });
        list.push({ text: `Now the square is cut into ${r.dd} pieces, and ${r.nn} ${isAre(r.nn)} shaded. ${r.n}/${r.d} and ${r.nn}/${r.dd} are the same amount. Bigger pieces, fewer of them.`,
          run: () => { base(r, i, true); scene.groups(r.d / r.k); scene.ghostLeft(r.nn); scene.gR.innerHTML = ''; scene.drawRight(r.d / r.k, r.nn, r.dd, 'Bigger pieces'); scene.label(r.nn, r.dd); chain(rs, i + 1, false); } });
      });
      const last = rs[rs.length - 1];
      list.push({ text: `Nothing bigger than 1 goes into both ${last.nn} and ${last.dd}. So ${n}/${d} = ${last.nn}/${last.dd}, simplified all the way.`,
        run: () => { scene.layout(); scene.clear(); scene.drawLeft(n, d, 1, 'You started with'); scene.drawRight(last.dd, last.nn, last.dd, 'Simplified all the way'); scene.label(last.nn, last.dd); chain(rs, rs.length, false); } });
      return list;
    }
    const ctl = controller(root, scene, build, () => `Ready. ${n}/${d} is on the left. Press Start to watch it simplify.`);
    function pick(nn, dd) { n = nn; d = dd; $$('.presets .chip', root).forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.n) === n && Number(c.dataset.d) === d))); msg.textContent = ''; ctl.reset(); }
    $('.presets', root).innerHTML = PRESETS.map(([a, b]) => `<button class="chip" type="button" data-n="${a}" data-d="${b}" aria-pressed="${a === n && b === d}">${fracHTML(a, b)}</button>`).join('');
    $('.presets', root).addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) pick(Number(c.dataset.n), Number(c.dataset.d)); });
    $('form.custom', root).addEventListener('submit', (e) => {
      e.preventDefault();
      const a = intIn('.in-top', root), b = intIn('.in-bot', root);
      if (!Number.isInteger(a) || !Number.isInteger(b)) { msg.textContent = 'Type a top number and a bottom number.'; return; }
      if (b < 2 || b > 48) { msg.textContent = 'Use a bottom number from 2 to 48.'; return; }
      if (a < 1 || a >= b) { msg.textContent = 'This page shows fractions smaller than one whole. Keep the top smaller than the bottom.'; return; }
      pick(a, b);
    });
    $('.modes', root).addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; mode = c.dataset.mode; pressOnly($('.modes', root), c); ctl.reset(); });
    ctl.reset();
  }

  /* ================= add and subtract ================= */
  function initAddSub() {
    const root = $('#addsub'); if (!root) return;
    const scene = new Scene($('.stage-svg', root), { mid: 120, midV: 120 });
    const eq = $('.eqline', root), msg = $('.msg', root);
    const PRESETS = [[3, 8, '+', 1, 4], [1, 2, '+', 1, 4], [1, 3, '+', 1, 6], [2, 5, '+', 3, 10], [1, 2, '+', 1, 3], [3, 4, '−', 1, 8], [5, 6, '−', 1, 3], [2, 3, '−', 1, 4]];
    let a = 3, b = 8, op = '+', c = 1, d = 4;
    const key = (p) => p.join(' ');
    function plan() {
      const L = lcm(b, d), ka = L / b, kb = L / d, A = a * ka, C = c * kb;
      const R = op === '+' ? A + C : A - C;
      return { L, ka, kb, A, C, R };
    }
    function chainHTML(stage, p) {
      // stage 0: a/b ± c/d ; 1: + rewritten ; 2: = result ; 3: simplified
      let h = `${fracHTML(a, b)}${opHTML(op)}${fracHTML(c, d)}`;
      if (stage >= 1 && (p.ka > 1 || p.kb > 1)) h += `${opHTML('→')}${fracHTML(p.A, p.L)}${opHTML(op)}${fracHTML(p.C, p.L)}`;
      if (stage >= 2) h += `${opHTML('=')}${fracHTML(p.R, p.L)}`;
      if (stage >= 3 && gcd(p.R, p.L) > 1) h += `${opsHTML(gcd(p.R, p.L))}${valueHTML(p.R / gcd(p.R, p.L), p.L / gcd(p.R, p.L))}`;
      return h;
    }
    /** Draws square A (a/b) and square B (c/d) at a given split level. splitA/splitB: whether each is already cut to L. */
    function drawBoth(p, splitA, splitB, shadedA, shadedB, opts = {}) {
      scene.layout(); scene.clear();
      const colsA = b, rowsA = splitA ? p.ka : 1, dA = splitA ? p.L : b;
      const colsB = d, rowsB = splitB ? p.kb : 1, dB = splitB ? p.L : d;
      const cellsA = scene.grid(scene.L, colsA, rowsA, shadedA, dA, scene.gL, opts.nameA || `${a}/${b}`);
      const cellsB = scene.grid(scene.R, colsB, rowsB, shadedB, dB, scene.gR, opts.nameB || `${c}/${d}`, op === '−' ? 'take' : '');
      scene.sign(op, opts.note || '');
      return { cellsA, cellsB };
    }
    function build() {
      const p = plan(), list = [];
      const same = p.ka === 1 && p.kb === 1;
      const words = op === '+' ? 'add' : 'take away';
      list.push({
        text: same
          ? `This is ${a}/${b} ${op} ${c}/${d}. Both bottoms are ${b}, so all the pieces are the same size. You can ${words} them straight away.`
          : `This is ${a}/${b} ${op} ${c}/${d}. Look at the bottoms: ${b} and ${d}. They are different, so the pieces are different sizes. You cannot count pieces of two sizes together.`,
        run: () => { drawBoth(p, false, false, a, c); eq.innerHTML = chainHTML(0, p); },
      });
      if (!same) {
        const who = p.ka > 1 && p.kb > 1 ? 'both' : (p.ka > 1 ? 'left' : 'right');
        list.push({
          text: `Make the bottoms the same. ${p.L} is the first number that both ${b} and ${d} count to. ` +
            (p.ka > 1 ? `Cut each ${PIECE[b] || `1/${b} piece`} into ${p.ka}: ${a}/${b} becomes ${p.A}/${p.L}. ` : '') +
            (p.kb > 1 ? `Cut each ${PIECE[d] || `1/${d} piece`} into ${p.kb}: ${c}/${d} becomes ${p.C}/${p.L}. ` : '') +
            `Same amount, smaller pieces.`,
          run: async (animate) => {
            drawBoth(p, false, false, a, c);
            if (animate) { await sleep(350); }
            drawBoth(p, true, true, p.A, p.C, { nameA: `${p.A}/${p.L}`, nameB: `${p.C}/${p.L}`, note: `${p.L}s` });
            if (animate) { if (p.ka > 1) scene.cutLines(scene.L, b, p.ka, scene.gL); if (p.kb > 1) scene.cutLines(scene.R, d, p.kb, scene.gR); }
            eq.innerHTML = chainHTML(1, p);
          },
        });
      }
      const nA = `${p.A}/${p.L}`, nB = `${p.C}/${p.L}`;
      if (op === '+') {
        list.push({
          text: `Now every piece is ${an(pieces(p.L, 1))}. Slide the ${plural(p.C, 'piece')} from the right into the empty spaces on the left: ${p.A} + ${p.C} = ${p.R} pieces.`,
          run: async (animate) => {
            const { cellsA, cellsB } = drawBoth(p, true, true, p.A, p.C, { nameA: nA, nameB: nB });
            const targets = cellsA.filter((x) => !x.tile).slice(0, p.C), sources = cellsB.filter((x) => x.tile);
            if (animate) {
              const moves = sources.map((s, i) => ({ from: s.rect, to: targets[i].rect, d: p.L, label: `1/${p.L}` }));
              await scene.flyTiles(moves, { dur: 650, stagger: 110, onStart: (m) => { const s = sources.find((x) => x.rect === m.from); if (s) s.tile.g.classList.add('ghost'); } });
            }
            drawBoth(p, true, true, p.R, 0, { nameA: `${p.R}/${p.L}`, nameB: 'moved over' });
            eq.innerHTML = chainHTML(2, p);
          },
        });
      } else {
        list.push({
          text: `Now every piece is ${an(pieces(p.L, 1))}. Take away ${plural(p.C, 'piece')} from the left: ${p.A} − ${p.C} = ${p.R} pieces are left.`,
          run: async (animate) => {
            const { cellsA, cellsB } = drawBoth(p, true, true, p.A, p.C, { nameA: nA, nameB: nB });
            const sources = cellsA.filter((x) => x.tile).slice(-p.C).reverse(), targets = cellsB.filter((x) => x.tile);
            if (animate) {
              targets.forEach((t) => t.tile.g.classList.add('ghost'));
              const moves = sources.map((s, i) => ({ from: s.rect, to: targets[i].rect, d: p.L, label: `1/${p.L}` }));
              await scene.flyTiles(moves, { dur: 650, stagger: 110, onStart: (m) => { const s = sources.find((x) => x.rect === m.from); if (s) s.tile.g.classList.add('ghost'); } });
            }
            drawBoth(p, true, true, p.R, p.C, { nameA: `${p.R}/${p.L}`, nameB: 'taken away' });
            $$('.sq-right .tile', scene.svg).forEach((t) => t.classList.add('ghost'));
            eq.innerHTML = chainHTML(2, p);
          },
        });
      }
      const g = gcd(p.R, p.L);
      list.push({
        text: `${a}/${b} ${op} ${c}/${d} = ${p.R}/${p.L}. ${p.R === p.L ? 'That fills the whole square: exactly 1 whole. ' : ''}${p.R === 0 ? 'Nothing is left: 0. ' : ''}${p.R > 0 && p.R !== p.L ? simplifyNote(p.R, p.L) : ''}`,
        run: () => {
          drawBoth(p, true, true, p.R, op === '+' ? 0 : p.C, { nameA: `${p.R}/${p.L}`, nameB: op === '+' ? 'moved over' : 'taken away' });
          if (op === '−') $$('.sq-right .tile', scene.svg).forEach((t) => t.classList.add('ghost'));
          if (g > 1 && p.R < p.L) { scene.gM.innerHTML = ''; scene.label(p.R / g, p.L / g); }
          eq.innerHTML = chainHTML(3, p);
        },
      });
      return list;
    }
    const ctl = controller(root, scene, build, () => `Ready. ${a}/${b} ${op} ${c}/${d}. Press Start.`);
    function pick(v) {
      [a, b, op, c, d] = v;
      $$('.presets .chip', root).forEach((ch) => ch.setAttribute('aria-pressed', String(ch.dataset.k === key(v))));
      msg.textContent = ''; ctl.reset();
    }
    $('.presets', root).innerHTML = PRESETS.map((v) => `<button class="chip" type="button" data-k="${key(v)}" aria-pressed="${key(v) === key([a, b, op, c, d])}">${fracHTML(v[0], v[1])}<span class="mk">${v[2]}</span>${fracHTML(v[3], v[4])}</button>`).join('');
    $('.presets', root).addEventListener('click', (e) => { const ch = e.target.closest('.chip'); if (ch) pick(ch.dataset.k.split(' ').map((x, i) => (i === 2 ? x : Number(x)))); });
    $('form.custom', root).addEventListener('submit', (e) => {
      e.preventDefault();
      const v = ['.in-a', '.in-b', null, '.in-c', '.in-d'].map((s) => (s ? intIn(s, root) : $('.in-op', root).value));
      const [A, B, O, C, D] = v;
      if (![A, B, C, D].every(Number.isInteger)) { msg.textContent = 'Fill in all four numbers.'; return; }
      if (B < 2 || D < 2 || B > 12 || D > 12) { msg.textContent = 'Use bottom numbers from 2 to 12.'; return; }
      if (A < 1 || C < 1 || A > B || C > D) { msg.textContent = 'Keep each top from 1 up to its bottom.'; return; }
      if (O === '+' && A / B + C / D > 1 + 1e-9) { msg.textContent = 'This page shows answers up to one whole. Try a smaller pair.'; return; }
      if (O === '−' && A / B < C / D) { msg.textContent = 'Put the bigger fraction first when you take away.'; return; }
      pick([A, B, O, C, D]);
    });
    ctl.reset();
  }

  /* ================= multiply ================= */
  function initMultiply() {
    const root = $('#multiply'); if (!root) return;
    const scene = new Scene($('.stage-svg', root), { squares: 1, maxS: 340 });
    const eq = $('.eqline', root), msg = $('.msg', root);
    const PRESETS = [[2, 3, 3, 4], [1, 2, 1, 2], [1, 2, 3, 4], [2, 5, 1, 2], [3, 4, 2, 3], [1, 3, 3, 5], [3, 5, 5, 6], [1, 4, 2, 3]];
    let a = 2, b = 3, c = 3, d = 4;   // a/b of c/d
    const key = (v) => v.join(' ');
    /** Square: c/d as shaded columns, a/b as shaded rows, overlap highlighted. */
    function draw(stage) {
      scene.layout(); scene.clear();
      const o = scene.L, S = scene.S, g = scene.gL;
      scene.frame(o, g, stage === 0 ? `${c}/${d}` : `${a}/${b} of ${c}/${d}`);
      const cw = S / d, rh = S / b;
      for (let i = 0; i < d; i++) {
        el('rect', { class: `strip ${i < c ? 'on' : ''}`, x: f1(o.x + i * cw + 2), y: o.y + 2, width: f1(cw - 4), height: S - 4, rx: 6, fill: tileColor(d), style: `animation-delay:${i * 40}ms` }, g);
      }
      if (stage >= 1) {
        for (let r = 0; r < b; r++) {
          el('rect', { class: `band ${r < a ? 'on' : ''}`, x: o.x + 2, y: f1(o.y + r * rh + 2), width: S - 4, height: f1(rh - 4), rx: 6, fill: tileColor(b), style: `animation-delay:${r * 60}ms` }, g);
          if (r) el('line', { class: 'cut', x1: o.x + 2, x2: o.x + S - 2, y1: f1(o.y + r * rh), y2: f1(o.y + r * rh) }, g);
        }
      }
      if (stage >= 2) {
        const dd = b * d;
        for (let i = 0; i < c; i++) for (let r = 0; r < a; r++) {
          const cr = scene.cell(o, d, b, i, r);
          tileEl(g, dd, `1/${dd}`, stage === 2 ? 'pop' : '').set(cr.x, cr.y, cr.w, cr.h).g.style.animationDelay = `${(i * a + r) * 50}ms`;
        }
      }
    }
    function chainHTML(stage) {
      const top = a * c, bot = b * d, g = gcd(top, bot);
      let h = `${fracHTML(a, b)}${opHTML('×')}${fracHTML(c, d)}`;
      if (stage >= 3) h += `${opHTML('=')}<span class="frac" role="img" aria-label="${a} times ${c} over ${b} times ${d}"><span aria-hidden="true">${a} × ${c}</span><i></i><span aria-hidden="true">${b} × ${d}</span></span>${opHTML('=')}${fracHTML(top, bot)}`;
      else if (stage >= 2) h += `${opHTML('=')}${fracHTML(top, bot)}`;
      if (stage >= 4 && g > 1) h += `${opsHTML(g)}${valueHTML(top / g, bot / g)}`;
      return h;
    }
    function build() {
      const top = a * c, bot = b * d;
      return [
        { text: `This is ${c}/${d}: the square is cut into ${d} strips, and ${c} ${isAre(c)} shaded. × means "of". We want ${a}/${b} of it.`, run: () => { draw(0); eq.innerHTML = chainHTML(0); } },
        { text: `Cut the square the other way into ${b} rows, and shade ${a} of the ${b} rows. That is ${a}/${b} of everything.`, run: () => { draw(1); eq.innerHTML = chainHTML(1); } },
        { text: `The pieces shaded both ways are ${a}/${b} of ${c}/${d}. Count them: ${plural(a, 'row')} × ${plural(c, 'strip')} = ${plural(top, 'piece')}. The whole square is cut into ${b} × ${d} = ${bot} pieces. So the answer is ${top}/${bot}.`, run: () => { draw(2); eq.innerHTML = chainHTML(2); } },
        { text: `That is the rule: top × top, and bottom × bottom. ${a} × ${c} = ${top} on top. ${b} × ${d} = ${bot} on the bottom.`, run: () => { draw(3); eq.innerHTML = chainHTML(3); } },
        { text: simplifyNote(top, bot), run: () => { draw(3); eq.innerHTML = chainHTML(4); } },
      ];
    }
    const ctl = controller(root, scene, build, () => `Ready. ${a}/${b} × ${c}/${d}. Press Start.`);
    function pick(v) { [a, b, c, d] = v; $$('.presets .chip', root).forEach((ch) => ch.setAttribute('aria-pressed', String(ch.dataset.k === key(v)))); msg.textContent = ''; ctl.reset(); }
    $('.presets', root).innerHTML = PRESETS.map((v) => `<button class="chip" type="button" data-k="${key(v)}" aria-pressed="${key(v) === key([a, b, c, d])}">${fracHTML(v[0], v[1])}<span class="mk">×</span>${fracHTML(v[2], v[3])}</button>`).join('');
    $('.presets', root).addEventListener('click', (e) => { const ch = e.target.closest('.chip'); if (ch) pick(ch.dataset.k.split(' ').map(Number)); });
    $('form.custom', root).addEventListener('submit', (e) => {
      e.preventDefault();
      const v = ['.in-a', '.in-b', '.in-c', '.in-d'].map((s) => intIn(s, root));
      if (!v.every(Number.isInteger)) { msg.textContent = 'Fill in all four numbers.'; return; }
      if (v[1] < 2 || v[3] < 2 || v[1] > 10 || v[3] > 10) { msg.textContent = 'Use bottom numbers from 2 to 10.'; return; }
      if (v[0] < 1 || v[2] < 1 || v[0] > v[1] || v[2] > v[3]) { msg.textContent = 'Keep each top from 1 up to its bottom.'; return; }
      pick(v);
    });
    ctl.reset();
  }

  /* ================= divide ================= */
  function initDivide() {
    const root = $('#divide'); if (!root) return;
    const scene = new Scene($('.stage-svg', root), { mid: 120, midV: 120 });
    const eq = $('.eqline', root), msg = $('.msg', root);
    const PRESETS = [[3, 4, 1, 4], [3, 4, 1, 8], [1, 2, 1, 6], [5, 6, 1, 3], [2, 3, 1, 6], [3, 4, 1, 2], [1, 2, 3, 8], [5, 8, 2, 3]];
    let a = 3, b = 4, c = 1, d = 4;   // a/b ÷ c/d
    const key = (v) => v.join(' ');
    function plan() {
      const L = lcm(b, d), ka = L / b, kb = L / d, A = a * ka, C = c * kb;
      const q = Math.floor(A / C), r = A % C;        // q whole groups, r pieces left over out of a group of C
      const top = a * d, bot = b * c, g = gcd(top, bot); // keep-change-flip
      return { L, ka, kb, A, C, q, r, top, bot, g };
    }
    function drawBoth(p, split, opts = {}) {
      scene.layout(); scene.clear();
      const cellsA = scene.grid(scene.L, b, split ? p.ka : 1, split ? p.A : a, split ? p.L : b, scene.gL, opts.nameA || `${a}/${b}`);
      const cellsB = scene.grid(scene.R, d, split ? p.kb : 1, split ? p.C : c, split ? p.L : d, scene.gR, opts.nameB || `${c}/${d}`);
      scene.sign('÷', opts.note || '');
      return { cellsA, cellsB };
    }
    function markGroups(p, cellsA) { markGroupCells(cellsA.filter((x) => x.tile), p.C, p.q, scene.gL); }
    function chainHTML(stage, p) {
      let h = `${fracHTML(a, b)}${opHTML('÷')}${fracHTML(c, d)}`;
      if (stage >= 1 && (p.ka > 1 || p.kb > 1)) h += `${opHTML('→')}${fracHTML(p.A, p.L)}${opHTML('÷')}${fracHTML(p.C, p.L)}`;
      if (stage >= 2) h += `${opHTML('=')}${valueHTML(p.A, p.C)}`;
      return h;
    }
    function flipHTML(p) {
      return `${fracHTML(a, b)}${opHTML('×')}${fracHTML(d, c)}${opHTML('=')}${fracHTML(p.top, p.bot)}${p.g > 1 || p.top > p.bot ? `${opHTML('=')}${valueHTML(p.top / p.g, p.bot / p.g)}` : ''}`;
    }
    function build() {
      const p = plan(), list = [];
      const same = p.ka === 1 && p.kb === 1;
      const groupWord = p.C === 1 ? `${pieces(p.L, 1)} piece` : `group of ${p.C}`;
      list.push({
        text: `This is ${a}/${b} ÷ ${c}/${d}. ÷ asks: how many ${c}/${d}s fit into ${a}/${b}?`,
        run: () => { drawBoth(p, false); eq.innerHTML = chainHTML(0, p); },
      });
      if (!same) {
        list.push({
          text: `First make the bottoms the same, so the pieces match. ${p.L} is the first number both ${b} and ${d} count to. ` +
            (p.ka > 1 ? `${a}/${b} becomes ${p.A}/${p.L}. ` : '') + (p.kb > 1 ? `${c}/${d} becomes ${p.C}/${p.L}. ` : '') +
            `Now the question is: how many ${p.C === 1 ? 'single pieces' : `groups of ${p.C} pieces`} fit into ${plural(p.A, 'piece')}?`,
          run: async (animate) => {
            drawBoth(p, false); if (animate) await sleep(350);
            drawBoth(p, true, { nameA: `${p.A}/${p.L}`, nameB: `${p.C}/${p.L}`, note: `${p.L}s` });
            if (animate) { if (p.ka > 1) scene.cutLines(scene.L, b, p.ka, scene.gL); if (p.kb > 1) scene.cutLines(scene.R, d, p.kb, scene.gR); }
            eq.innerHTML = chainHTML(1, p);
          },
        });
      }
      const restText = p.r ? ` ${plural(p.r, 'piece')} left over, and a ${groupWord} needs ${p.C}, so that is ${p.r}/${p.C} of a group.` : '';
      const fitText = p.q === 0 ? `Not even one whole group fits.` : `${plural(p.q, 'whole group')} fit${p.q === 1 ? 's' : ''}.`;
      list.push({
        text: `${p.C === 1 ? 'Count the pieces on the left.' : `Count the groups of ${p.C} on the left.`} ${p.C === 1 ? `${plural(p.A, 'piece')} fit.` : fitText}${restText} So ${a}/${b} ÷ ${c}/${d} = ${valueText(p.A, p.C)}.`,
        run: () => { const { cellsA } = drawBoth(p, true, { nameA: `${p.A}/${p.L}`, nameB: p.C === 1 ? 'one piece' : `a group of ${p.C}` }); markGroups(p, cellsA); eq.innerHTML = chainHTML(2, p); },
      });
      list.push({
        text: `The shortcut gives the same answer. Keep ${a}/${b}. Change ÷ to ×. Flip ${c}/${d} to ${d}/${c}. ${a} × ${d} = ${p.top} on top, ${b} × ${c} = ${p.bot} on the bottom.${p.g > 1 || p.top > p.bot ? ` ${simplifyNote(p.top, p.bot)}` : ` Only 1 goes into ${p.top} and ${p.bot}, so ${p.top}/${p.bot} is done.`} Same answer: ${valueText(p.A, p.C)}.`,
        run: () => { const { cellsA } = drawBoth(p, true, { nameA: `${p.A}/${p.L}`, nameB: p.C === 1 ? 'one piece' : `a group of ${p.C}` }); markGroups(p, cellsA); eq.innerHTML = `${chainHTML(2, p)}<span class="break"></span>${flipHTML(p)}`; },
      });
      return list;
    }
    const ctl = controller(root, scene, build, () => `Ready. ${a}/${b} ÷ ${c}/${d}. Press Start.`);
    function pick(v) { [a, b, c, d] = v; $$('.presets .chip', root).forEach((ch) => ch.setAttribute('aria-pressed', String(ch.dataset.k === key(v)))); msg.textContent = ''; ctl.reset(); }
    $('.presets', root).innerHTML = PRESETS.map((v) => `<button class="chip" type="button" data-k="${key(v)}" aria-pressed="${key(v) === key([a, b, c, d])}">${fracHTML(v[0], v[1])}<span class="mk">÷</span>${fracHTML(v[2], v[3])}</button>`).join('');
    $('.presets', root).addEventListener('click', (e) => { const ch = e.target.closest('.chip'); if (ch) pick(ch.dataset.k.split(' ').map(Number)); });
    $('form.custom', root).addEventListener('submit', (e) => {
      e.preventDefault();
      const v = ['.in-a', '.in-b', '.in-c', '.in-d'].map((s) => intIn(s, root));
      if (!v.every(Number.isInteger)) { msg.textContent = 'Fill in all four numbers.'; return; }
      if (v[1] < 2 || v[3] < 2 || v[1] > 12 || v[3] > 12) { msg.textContent = 'Use bottom numbers from 2 to 12.'; return; }
      if (v[0] < 1 || v[2] < 1 || v[0] > v[1] || v[2] > v[3]) { msg.textContent = 'Keep each top from 1 up to its bottom.'; return; }
      pick(v);
    });
    ctl.reset();
  }

  /* ================= bar scene: stacks of whole bars, for mixed numbers ================= */
  class BarScene {
    constructor(svg, opts = {}) { this.svg = svg; this.o = Object.assign({ barH: 44, gap: 10, mid: 120, midV: 96, maxBarW: 380 }, opts); }
    /** rowsL / rowsR: how many bars each stack may need, so the picture does not jump between steps. */
    layout(rowsL, rowsR) {
      const W = Math.max(300, Math.round(this.svg.getBoundingClientRect().width) || 700);
      const pad = 8, top = pad + 22, { barH, gap, mid, midV, maxBarW } = this.o;
      const hL = Math.max(1, rowsL) * (barH + gap) - gap, hR = Math.max(1, rowsR) * (barH + gap) - gap;
      this.W = W; this.horiz = W >= 640;
      if (this.horiz) {
        this.barW = Math.min(maxBarW, Math.floor((W - 2 * pad - mid) / 2));
        const x0 = Math.round((W - (2 * this.barW + mid)) / 2);
        this.L = { x: x0, y: top }; this.R = { x: x0 + this.barW + mid, y: top };
        this.M = { x: x0 + this.barW + mid / 2, y: top + Math.max(hL, hR) / 2 };
        this.H = top + Math.max(hL, hR) + pad;
      } else {
        this.barW = Math.min(maxBarW, W - 2 * pad);
        const x = Math.round((W - this.barW) / 2);
        this.L = { x, y: top }; this.R = { x, y: top + hL + midV + 22 };
        this.M = { x: W / 2, y: top + hL + midV / 2 + 6 };
        this.H = this.R.y + hR + pad;
      }
      this.svg.setAttribute('viewBox', `0 0 ${W} ${this.H}`);
      this.svg.setAttribute('height', String(this.H));
    }
    clear() {
      this.svg.innerHTML = '';
      this.gL = el('g', { class: 'sq-left' }, this.svg);
      this.gR = el('g', { class: 'sq-right' }, this.svg);
      this.gM = el('g', { class: 'mid' }, this.svg);
      this.gF = el('g', { class: 'flyers' }, this.svg);
    }
    bar(o, i) { return { x: o.x, y: o.y + i * (this.o.barH + this.o.gap), w: this.barW, h: this.o.barH }; }
    cell(o, i, d, c) { const b = this.bar(o, i), cw = b.w / d; return { x: b.x + c * cw + 2, y: b.y + 2, w: cw - 4, h: b.h - 4 }; }
    /** A stack of bars: each {n, d, cls?, cut?} is one bar with n of d shaded. Returns bars → cells. */
    stack(o, bars, parent, name) {
      if (name) text(parent, 'lname', o.x + this.barW / 2, o.y - 9, name);
      return bars.map((spec, i) => {
        const b = this.bar(o, i), { n, d } = spec;
        el('rect', { class: `tray ${spec.cut ? 'broken' : ''}`, x: b.x - 3, y: b.y - 3, width: b.w + 6, height: b.h + 6, rx: 10 }, parent);
        const cells = [];
        for (let c = 0; c < d; c++) {
          const cr = this.cell(o, i, d, c);
          let tile = null, slot = null;
          if (c < n) tile = tileEl(parent, d, `1/${d}`, spec.cls || '').set(cr.x, cr.y, cr.w, cr.h);
          else slot = el('rect', { class: 'slot', x: f1(cr.x), y: f1(cr.y), width: f1(cr.w), height: f1(cr.h), rx: 6 }, parent);
          cells.push({ bar: i, c, rect: cr, tile, slot });
        }
        if (spec.cut) for (let c = 1; c < d; c++) { const x = b.x + c * (b.w / d); el('line', { class: 'cut', x1: f1(x), x2: f1(x), y1: b.y + 3, y2: b.y + b.h - 3 }, parent); }
        return cells;
      });
    }
    sign(s, note = '') {
      this.gM.innerHTML = '';
      const { x, y } = this.M;
      text(this.gM, 'lsign', x, y + 16, s);
      if (note) text(this.gM, 'lhand mid', x, y + 50, note, { 'text-anchor': 'middle' });
    }
    flyTiles(moves, opts = {}) { return flyTiles(this.gF, moves, opts); }
  }
  /** Bars for a mixed number: `whole` full bars, then a bar with n of d (if n > 0). */
  const barsOf = (whole, n, d, extra = {}) => [...Array.from({ length: whole }, () => Object.assign({ n: d, d }, extra.full || {})), ...(n > 0 ? [Object.assign({ n, d }, extra.part || {})] : [])];
  const flat = (bars) => bars.flat();
  const shadedOf = (bars) => flat(bars).filter((x) => x.tile);
  const emptyOf = (bars) => flat(bars).filter((x) => !x.tile);
  const piecesOnlyText = (w, n, d) => (w && d > 1 ? `${plural(w, 'whole')} ${w === 1 ? 'is' : 'are'} ${w * d} ${pieces(d, w * d)}${n ? `, plus ${n} more: ${w * d + n}/${d}` : `: ${w * d}/${d}`}. ` : '');

  /* ---------- mixed-number inputs shared by the three lesson-2 pages ---------- */
  function readMixed(root, side, maxW = 4, maxD = 12) {
    const w = $(`.in-${side}w`, root).value.trim() === '' ? 0 : intIn(`.in-${side}w`, root);
    const n = $(`.in-${side}n`, root).value.trim() === '' ? 0 : intIn(`.in-${side}n`, root);
    const d = $(`.in-${side}d`, root).value.trim() === '' ? 1 : intIn(`.in-${side}d`, root);
    if (![w, n, d].every(Number.isInteger)) return { err: 'Use whole numbers in every box.' };
    if (w < 0 || w > maxW) return { err: `Keep the wholes from 0 to ${maxW}.` };
    if (d < 1 || d > maxD) return { err: `Use bottom numbers from 2 to ${maxD}.` };
    if (n < 0 || (d > 1 && n >= d)) return { err: 'Keep each part smaller than its bottom.' };
    if (d === 1 && n) return { err: 'A whole number has no part. Leave the part boxes empty.' };
    if (w === 0 && n === 0) return { err: 'Type at least a whole number or a part.' };
    return { w, n, d: d === 1 ? 1 : d };
  }
  function presetMixedHTML(v) { return `${mixedHTML(v[0], v[1], v[2])}<span class="mk">${v[3]}</span>${mixedHTML(v[4], v[5], v[6])}`; }

  /* ================= add and subtract: mixed numbers ================= */
  function initAddSubMixed() {
    const root = $('#addsubmixed'); if (!root) return;
    const scene = new BarScene($('.stage-svg', root));
    const eq = $('.eqline', root), msg = $('.msg', root);
    const PRESETS = [[1, 3, 4, '+', 2, 1, 2], [2, 1, 3, '+', 1, 1, 2], [1, 1, 2, '+', 1, 1, 2], [1, 5, 8, '+', 0, 1, 2], [3, 1, 4, '−', 1, 3, 4], [2, 1, 2, '−', 1, 1, 4], [4, 0, 1, '−', 1, 2, 3], [2, 1, 6, '−', 0, 2, 3]];
    let v = PRESETS[0].slice();
    const key = (x) => x.join(' ');
    function plan() {
      const [wa, a, b, op, wb, c, d] = v;
      const L = lcm(b, d), A = a * (L / b), C = c * (L / d);
      const out = { wa, a, b, op, wb, c, d, L, A, C };
      if (op === '+') {
        const parts = A + C; out.carry = Math.floor(parts / L); out.rem = parts % L; out.W = wa + wb + out.carry; out.parts = parts;
      } else {
        out.borrow = A < C; out.A2 = out.borrow ? A + L : A; out.wa2 = out.borrow ? wa - 1 : wa; out.rem = out.A2 - C; out.W = out.wa2 - wb;
      }
      out.g = out.rem ? gcd(out.rem, L) : 1;
      out.rowsL = op === '+' ? out.W + (out.rem ? 1 : 0) + (out.carry && !out.rem ? 0 : 0) : Math.max(wa + (a ? 1 : 0), 1);
      if (op === '+') out.rowsL = Math.max(out.rowsL, wa + wb + 1 + (out.carry ? 1 : 0));
      out.rowsR = Math.max(1, wb + (c ? 1 : 0));
      return out;
    }
    /** Draws both stacks from a state; returns the bars so steps can animate between states. */
    function draw(p, st) {
      scene.layout(p.rowsL, p.rowsR); scene.clear();
      const barsA = scene.stack(scene.L, st.A, scene.gL, st.nameA);
      const barsB = scene.stack(scene.R, st.B, scene.gR, st.nameB);
      if (st.ghostB) $$('.sq-right .tile', scene.svg).forEach((t) => t.classList.add('ghost'));
      if (st.ghostBFull != null) barsB.slice(0, st.ghostBFull).forEach((bar) => bar.forEach((x) => x.tile && x.tile.g.classList.add('ghost')));
      scene.sign(p.op, st.note || '');
      return { barsA, barsB };
    }
    const take = { part: { cls: 'take' }, full: { cls: 'take' } };
    function build() {
      const p = plan(), { wa, a, b, op, wb, c, d, L, A, C } = p, list = [];
      const nameA0 = mixedText(wa, a, b), nameB0 = mixedText(wb, c, d);
      const same = (b === 1 || L === b) && (d === 1 || L === d);
      const extraB = op === '−' ? take : {};
      const s0 = { A: barsOf(wa, a, b), B: barsOf(wb, c, d, extraB), nameA: nameA0, nameB: nameB0 };
      const s1 = { A: barsOf(wa, A, L), B: barsOf(wb, C, L, extraB), nameA: mixedText(wa, A, L), nameB: mixedText(wb, C, L), note: same ? '' : `${L}s` };
      const total = `${nameA0} ${op} ${nameB0}`;
      const eq0 = `${mixedHTML(wa, a, b)}${opHTML(op)}${mixedHTML(wb, c, d)}`;
      const eq1 = same ? eq0 : `${eq0}${opHTML('→')}${mixedHTML(wa, A, L)}${opHTML(op)}${mixedHTML(wb, C, L)}`;
      const ansHTML = () => mixedHTML(p.W, p.rem / p.g, L / p.g);
      list.push({ text: `This is ${total}. A mixed number is wholes plus a part. ${op === '+' ? 'Add' : 'Take away'} the wholes and the parts separately.`, run: () => { draw(p, s0); eq.innerHTML = eq0; } });
      if (!same) {
        list.push({ text: `First make the bottoms of the parts the same. ${L} is the first number both ${b === 1 ? d : b} and ${d === 1 ? b : d} count to. ` + (L !== b && a ? `${a}/${b} becomes ${A}/${L}. ` : '') + (L !== d && c ? `${c}/${d} becomes ${C}/${L}. ` : '') + 'The wholes stay as they are.',
          run: () => { draw(p, s1); eq.innerHTML = eq1; } });
      }
      if (op === '+') {
        const s2 = { A: barsOf(wa + wb, A, L), B: barsOf(wb, C, L), nameA: mixedText(wa + wb, A, L), nameB: `${C}/${L} left to add`, ghostBFull: wb };
        list.push({
          text: wb ? `Add the wholes first: ${wa} + ${wb} = ${wa + wb} whole bars. The ${plural(wb, 'whole bar')} slide${wb === 1 ? 's' : ''} over.` : `There are no wholes to add on the right, so the wholes stay at ${wa}.`,
          run: async (animate) => {
            const { barsA, barsB } = draw(p, s1);
            if (animate && wb) {
              const moves = [];
              barsB.slice(0, wb).forEach((bar, i) => bar.forEach((cell) => moves.push({ from: cell.rect, to: scene.cell(scene.L, wa + i, L, cell.c), d: L, label: `1/${L}`, delay: i * 180 })));
              if (a) barsA[wa].forEach((cell) => moves.push({ from: cell.rect, to: scene.cell(scene.L, wa + wb, L, cell.c), d: L, label: `1/${L}`, delay: 0 }));
              const srcA = a ? barsA[wa] : [];
              barsB.slice(0, wb).forEach((bar) => bar.forEach((x) => x.tile.g.classList.add('ghost')));
              srcA.forEach((x) => x.tile && x.tile.g.classList.add('ghost'));
              await scene.flyTiles(moves, { dur: 650 });
            }
            draw(p, s2); eq.innerHTML = `${eq1}<span class="break"></span>${opHTML('wholes:')}<span class="whole">${wa}</span>${opHTML('+')}<span class="whole">${wb}</span>${opHTML('=')}<span class="whole">${wa + wb}</span>`;
          },
        });
        const s3 = { A: barsOf(wa + wb + p.carry, p.rem, L), B: barsOf(wb, C, L), nameA: mixedText(wa + wb + p.carry, p.rem, L), nameB: 'added', ghostB: true };
        list.push({
          text: `Now the parts: ${A}/${L} + ${C}/${L} = ${p.parts}/${L}.` + (p.carry ? ` That is ${p.rem ? 'more than one bar!' : 'exactly one bar!'} ${L} pieces fill a whole bar${p.rem ? `, with ${p.rem} left over` : ''}. So ${p.parts}/${L} = ${mixedText(1, p.rem, L)}, and the wholes go up to ${wa + wb + 1}.` : ' The pieces slide into the part bar.'),
          run: async (animate) => {
            const { barsA, barsB } = draw(p, s2);
            if (animate && C) {
              const sources = barsB[wb] ? barsB[wb].filter((x) => x.tile) : [];
              const targets = [];
              const partBar = barsA[wa + wb];
              if (partBar) partBar.filter((x) => !x.tile).forEach((x) => targets.push(x.rect));
              for (let c2 = 0; targets.length < sources.length; c2++) targets.push(scene.cell(scene.L, wa + wb + (partBar ? 1 : 0), L, c2));
              const moves = sources.map((sc, i) => ({ from: sc.rect, to: targets[i], d: L, label: `1/${L}` }));
              await scene.flyTiles(moves, { dur: 650, stagger: 110, onStart: (m) => { const sc = sources.find((x) => x.rect === m.from); if (sc) sc.tile.g.classList.add('ghost'); } });
            }
            draw(p, s3); eq.innerHTML = `${eq1}<span class="break"></span>${opHTML('parts:')}${fracHTML(A, L)}${opHTML('+')}${fracHTML(C, L)}${opHTML('=')}${fracHTML(p.parts, L)}${p.carry ? `${opHTML('=')}${mixedHTML(1, p.rem, L)}` : ''}`;
          },
        });
      } else {
        const sBreak = { A: [...barsOf(p.wa2, 0, L), ...(p.borrow ? [{ n: L, d: L, cut: true }] : []), ...barsOf(0, A, L)], B: barsOf(wb, C, L, take), nameA: p.borrow ? `${p.wa2} and ${p.A2}/${L}` : mixedText(wa, A, L), nameB: mixedText(wb, C, L) };
        if (p.borrow) {
          list.push({ text: `${A ? `Look at the parts: ${A}/${L} is smaller than ${C}/${L}, so you cannot take ${C} pieces from ${A}.` : `There is no part to take ${C}/${L} from.`} Break one whole bar into ${L} pieces. Now the parts are ${L} + ${A} = ${p.A2} pieces, and ${plural(p.wa2, 'whole bar')} ${isAre(p.wa2)} left.`,
            run: () => { draw(p, sBreak); eq.innerHTML = `${eq1}${opHTML('→')}<span class="mixed"><span class="w">${p.wa2}</span>${fracHTML(p.A2, L)}</span>${opHTML(op)}${mixedHTML(wb, C, L)}`; } });
        }
        const s2 = { A: barsOf(p.wa2, p.rem, L), B: barsOf(wb, C, L, take), nameA: mixedText(p.wa2, p.rem, L), nameB: `${C}/${L} taken`, ghostB: false };
        list.push({
          text: `Take away the parts: ${p.A2}/${L} − ${C}/${L} = ${p.rem}/${L}.`,
          run: async (animate) => {
            const { barsA, barsB } = draw(p, sBreak);
            if (animate && C) {
              const sources = shadedOf(barsA.slice(p.wa2)).reverse().slice(0, C);
              const targets = barsB[wb] ? barsB[wb].filter((x) => x.tile) : [];
              targets.forEach((t) => t.tile.g.classList.add('ghost'));
              const moves = sources.map((sc, i) => ({ from: sc.rect, to: targets[i].rect, d: L, label: `1/${L}` }));
              await scene.flyTiles(moves, { dur: 650, stagger: 110, onStart: (m) => { const sc = sources.find((x) => x.rect === m.from); if (sc) sc.tile.g.classList.add('ghost'); } });
            }
            const { barsB: bb } = draw(p, s2); if (bb[wb]) bb[wb].forEach((x) => x.tile && x.tile.g.classList.add('ghost'));
            eq.innerHTML = `${eq1}<span class="break"></span>${opHTML('parts:')}${fracHTML(p.A2, L)}${opHTML('−')}${fracHTML(C, L)}${opHTML('=')}${fracHTML(p.rem, L)}`;
          },
        });
        const s3 = { A: barsOf(p.W, p.rem, L), B: barsOf(wb, C, L, take), nameA: mixedText(p.W, p.rem, L), nameB: 'taken away', ghostB: true };
        list.push({
          text: wb ? `Now the wholes: ${p.wa2} − ${wb} = ${p.W}. ${plural(wb, 'whole bar')} ${wb === 1 ? 'goes' : 'go'} away.` : `There are no wholes to take away, so ${plural(p.wa2, 'whole bar')} stay${p.wa2 === 1 ? 's' : ''}.`,
          run: async (animate) => {
            const { barsA, barsB } = draw(p, s2); if (barsB[wb]) barsB[wb].forEach((x) => x.tile && x.tile.g.classList.add('ghost'));
            if (animate && wb) {
              const moves = [];
              for (let i = 0; i < wb; i++) barsA[p.wa2 - 1 - i].forEach((cell) => moves.push({ from: cell.rect, to: scene.cell(scene.R, wb - 1 - i, L, cell.c), d: L, label: `1/${L}`, delay: i * 180 }));
              for (let i = 0; i < wb; i++) barsA[p.wa2 - 1 - i].forEach((x) => x.tile.g.classList.add('ghost'));
              await scene.flyTiles(moves, { dur: 650 });
            }
            draw(p, s3); eq.innerHTML = `${eq1}<span class="break"></span>${opHTML('wholes:')}<span class="whole">${p.wa2}</span>${opHTML('−')}<span class="whole">${wb}</span>${opHTML('=')}<span class="whole">${p.W}</span>`;
          },
        });
      }
      const finalState = op === '+' ? { A: barsOf(p.W, p.rem, L), B: barsOf(wb, C, L), nameA: mixedText(p.W, p.rem, L), nameB: 'added', ghostB: true } : { A: barsOf(p.W, p.rem, L), B: barsOf(wb, C, L, take), nameA: mixedText(p.W, p.rem, L), nameB: 'taken away', ghostB: true };
      const simp = p.rem ? simplifyNote(p.rem, L) : 'No part is left, so the answer is a whole number.';
      const Ap = wa * b + a, Cp = wb * d + c, Lp = L, A2p = Ap * (L / b), C2p = Cp * (L / d), tot = op === '+' ? A2p + C2p : A2p - C2p;
      list.push({
        text: `Put it together: ${p.W} ${p.W === 1 ? 'whole' : 'wholes'}${p.rem ? ` and ${p.rem}/${L}` : ''}. ${simp} So ${total} = ${mixedText(p.W, p.rem / p.g, L / p.g)}.`,
        run: () => { draw(p, finalState); eq.innerHTML = `${eq0}${opHTML('=')}${ansHTML()}<span class="break"></span><span class="dim">${opHTML('Another way, pieces only:')}${fracHTML(Ap, b)}${opHTML(op)}${fracHTML(Cp, d)}${opHTML('=')}${fracHTML(A2p, Lp)}${opHTML(op)}${fracHTML(C2p, Lp)}${opHTML('=')}${fracHTML(tot, Lp)}${opHTML('=')}${ansHTML()}</span>`; },
      });
      return list;
    }
    const ctl = controller(root, scene, build, () => `Ready. ${mixedText(v[0], v[1], v[2])} ${v[3]} ${mixedText(v[4], v[5], v[6])}. Press Start.`);
    function pick(x) { v = x.slice(); $$('.presets .chip', root).forEach((ch) => ch.setAttribute('aria-pressed', String(ch.dataset.k === key(v)))); msg.textContent = ''; ctl.reset(); }
    $('.presets', root).innerHTML = PRESETS.map((x) => `<button class="chip" type="button" data-k="${key(x)}" aria-pressed="${key(x) === key(v)}">${presetMixedHTML(x)}</button>`).join('');
    $('.presets', root).addEventListener('click', (e) => { const ch = e.target.closest('.chip'); if (ch) pick(ch.dataset.k.split(' ').map((x, i) => (i === 3 ? x : Number(x)))); });
    $('form.custom', root).addEventListener('submit', (e) => {
      e.preventDefault();
      const A = readMixed(root, 'a'), B = readMixed(root, 'b'), op = $('.in-op', root).value;
      if (A.err || B.err) { msg.textContent = A.err || B.err; return; }
      const valA = A.w + A.n / A.d, valB = B.w + B.n / B.d;
      if (op === '+' && valA + valB > 6 + 1e-9) { msg.textContent = 'Keep the answer to 6 wholes or fewer.'; return; }
      if (op === '−' && valA < valB) { msg.textContent = 'Put the bigger number first when you take away.'; return; }
      pick([A.w, A.n, A.d, op, B.w, B.n, B.d]);
    });
    ctl.reset();
  }

  /* ================= multiply: mixed numbers (area model) ================= */
  function initMultiplyMixed() {
    const root = $('#multiplymixed'); if (!root) return;
    const svg = $('.stage-svg', root);
    const bars = new BarScene(svg);
    const eq = $('.eqline', root), msg = $('.msg', root);
    const PRESETS = [[2, 1, 2, '×', 1, 1, 3], [1, 1, 2, '×', 0, 2, 3], [0, 5, 8, '×', 4, 0, 1], [1, 1, 2, '×', 4, 0, 1], [2, 0, 1, '×', 0, 3, 4], [1, 1, 4, '×', 1, 1, 2], [3, 1, 3, '×', 0, 3, 5], [2, 2, 3, '×', 1, 1, 2]];
    let v = PRESETS[0].slice();
    const key = (x) => x.join(' ');
    function plan() {
      const [wa, a, b, , wc, c, d] = v;
      const Ap = wa * b + a, Cp = wc * d + c, top = Ap * Cp, bot = b * d;
      const q = Math.floor(top / bot), r = top % bot, g = r ? gcd(r, bot) : 1;
      return { wa, a, b, wc, c, d, Ap, Cp, top, bot, q, r, g };
    }
    function drawBars(p, cut) {
      const rowsL = p.wa + (p.a ? 1 : 0), rowsR = p.wc + (p.c ? 1 : 0);
      bars.layout(Math.max(1, rowsL), Math.max(1, rowsR)); bars.clear();
      const extra = cut ? { full: { cut: true } } : {};
      bars.stack(bars.L, barsOf(p.wa, p.a, p.b, extra), bars.gL, cut ? `${p.Ap}/${p.b}` : mixedText(p.wa, p.a, p.b));
      bars.stack(bars.R, barsOf(p.wc, p.c, p.d, extra), bars.gR, cut ? `${p.Cp}/${p.d}` : mixedText(p.wc, p.c, p.d));
      bars.sign('×');
    }
    /** The area model: a rectangle with sides Ap/b and Cp/d (longer side across), one unit square outlined. */
    function orient(p) {
      const swap = p.Cp / p.d > p.Ap / p.b;
      return swap ? { an: p.Cp, ad: p.d, dn: p.Ap, dd: p.b } : { an: p.Ap, ad: p.b, dn: p.Cp, dd: p.d };
    }
    function drawArea(p, stage) {
      const W = Math.max(300, Math.round(svg.getBoundingClientRect().width) || 700), pad = 8, top = pad + 26;
      const o = orient(p);
      const wUnits = o.an / o.ad, hUnits = o.dn / o.dd;
      const U = Math.max(40, Math.min(170, Math.floor((W - 2 * pad) / wUnits), Math.floor(360 / hUnits)));
      const rw = wUnits * U, rh = hUnits * U, x0 = Math.round((W - rw) / 2), y0 = top;
      svg.innerHTML = '';
      svg.setAttribute('viewBox', `0 0 ${W} ${Math.ceil(y0 + rh + pad + 24)}`); svg.setAttribute('height', String(Math.ceil(y0 + rh + pad + 24)));
      const g = el('g', {}, svg);
      const unitShown = wUnits >= 1 && hUnits >= 1;
      text(g, 'lname', W / 2, y0 - 9, `${o.an}/${o.ad} across, ${o.dn}/${o.dd} down. ${unitShown ? 'The dark square is 1 whole.' : 'Dashed lines mark each whole.'}`);
      el('rect', { class: 'tray', x: x0 - 3, y: y0 - 3, width: rw + 6, height: rh + 6, rx: 10 }, g);
      const cw = U / o.ad, rhh = U / o.dd, cells = [];
      for (let j = 0; j < o.dn; j++) for (let i = 0; i < o.an; i++) {
        const cr = { x: x0 + i * cw + 2, y: y0 + j * rhh + 2, w: cw - 4, h: rhh - 4 };
        if (stage >= 2) tileEl(g, p.bot, `1/${p.bot}`, stage === 2 ? 'pop' : '').set(cr.x, cr.y, cr.w, cr.h).g.style.animationDelay = `${Math.min(j * o.an + i, 40) * 25}ms`;
        else el('rect', { class: 'slot', x: f1(cr.x), y: f1(cr.y), width: f1(cr.w), height: f1(cr.h), rx: 6 }, g);
        cells.push({ rect: cr });
      }
      for (let i = 1; i < Math.ceil(wUnits); i++) el('line', { class: 'unitline', x1: f1(x0 + i * U), x2: f1(x0 + i * U), y1: y0, y2: f1(y0 + rh) }, g);
      for (let j = 1; j < Math.ceil(hUnits); j++) el('line', { class: 'unitline', x1: x0, x2: f1(x0 + rw), y1: f1(y0 + j * U), y2: f1(y0 + j * U) }, g);
      if (unitShown) el('rect', { class: 'unit', x: x0, y: y0, width: U, height: U, rx: 4 }, g);
      if (stage >= 3) markGroupCells(cells, p.bot, p.q, g);
    }
    function chain(stage, p) {
      const [wa, a, b, , wc, c, d] = v;
      let h = `${mixedHTML(wa, a, b)}${opHTML('×')}${mixedHTML(wc, c, d)}`;
      if (stage >= 1) h += `${opHTML('→')}${fracHTML(p.Ap, p.b)}${opHTML('×')}${fracHTML(p.Cp, p.d)}`;
      if (stage >= 3) h += `${opHTML('=')}${fracHTML(p.top, p.bot)}`;
      if (stage >= 4) h += `${opHTML('=')}${mixedHTML(p.q, p.r / p.g, p.bot / p.g)}`;
      return h;
    }
    function build() {
      const p = plan(), [wa, a, b, , wc, c, d] = v;
      const nA = mixedText(wa, a, b), nB = mixedText(wc, c, d);
      const unitWords = p.bot === 1 ? 'Each piece is 1 whole.' : `A whole square holds ${b} × ${d} = ${p.bot} pieces, so each piece is 1/${p.bot}.`;
      return [
        { text: `This is ${nA} × ${nB}. × means "of". With mixed numbers, first write each one as pieces only.`, run: () => { drawBars(p, false); eq.innerHTML = chain(0, p); } },
        { text: `${piecesOnlyText(wa, a, b)}${piecesOnlyText(wc, c, d)}${b === 1 ? `A whole number goes over 1: ${wa} is ${wa}/1. ` : ''}${d === 1 ? `A whole number goes over 1: ${wc} is ${wc}/1. ` : ''}So it is ${p.Ap}/${b} × ${p.Cp}/${d}.`, run: () => { drawBars(p, true); eq.innerHTML = chain(1, p); } },
        { text: (() => { const o = orient(p); const unitShown = o.an / o.ad >= 1 && o.dn / o.dd >= 1; return `Draw a rectangle ${o.an}/${o.ad} across and ${o.dn}/${o.dd} down. ${unitShown ? 'The dark outline is one whole square.' : 'Each dashed line marks one whole.'} ${unitWords}`; })(), run: () => { drawArea(p, 1); eq.innerHTML = chain(1, p); } },
        { text: (() => { const o = orient(p); return `Count the pieces in the rectangle: ${o.an} across × ${o.dn} down = ${p.top} pieces. So ${p.Ap}/${b} × ${p.Cp}/${d} = ${p.top}/${p.bot}. Top × top, bottom × bottom.`; })(), run: () => { drawArea(p, 2); eq.innerHTML = chain(3, p); } },
        { text: (p.bot === 1 ? `${p.top} whole pieces: the answer is ${p.top}.` : `${p.bot} pieces make a whole. ${p.bot} goes into ${p.top} ${timesWord(p.q)}${p.r ? ` with ${p.r} left over: ${mixedText(p.q, p.r, p.bot)}` : ''}. ${p.r ? simplifyNote(p.r, p.bot) : 'No pieces are left over.'} So ${nA} × ${nB} = ${mixedText(p.q, p.r / p.g, p.bot / p.g)}.`), run: () => { drawArea(p, 3); eq.innerHTML = chain(4, p); } },
      ];
    }
    const ctl = controller(root, bars, build, () => `Ready. ${mixedText(v[0], v[1], v[2])} × ${mixedText(v[4], v[5], v[6])}. Press Start.`);
    function pick(x) { v = x.slice(); $$('.presets .chip', root).forEach((ch) => ch.setAttribute('aria-pressed', String(ch.dataset.k === key(v)))); msg.textContent = ''; ctl.reset(); }
    $('.presets', root).innerHTML = PRESETS.map((x) => `<button class="chip" type="button" data-k="${key(x)}" aria-pressed="${key(x) === key(v)}">${presetMixedHTML(x)}</button>`).join('');
    $('.presets', root).addEventListener('click', (e) => { const ch = e.target.closest('.chip'); if (ch) pick(ch.dataset.k.split(' ').map((x, i) => (i === 3 ? x : Number(x)))); });
    $('form.custom', root).addEventListener('submit', (e) => {
      e.preventDefault();
      const A = readMixed(root, 'a', 4, 10), B = readMixed(root, 'b', 4, 10);
      if (A.err || B.err) { msg.textContent = A.err || B.err; return; }
      if ((A.w + A.n / A.d) * (B.w + B.n / B.d) > 12 + 1e-9) { msg.textContent = 'Keep the answer to 12 or less so the picture fits.'; return; }
      if ((A.w * A.d + A.n) * (B.w * B.d + B.n) > 60) { msg.textContent = 'That makes more than 60 small pieces. Try smaller numbers.'; return; }
      pick([A.w, A.n, A.d, '×', B.w, B.n, B.d]);
    });
    ctl.reset();
  }

  /* ================= divide: mixed numbers ================= */
  function initDivideMixed() {
    const root = $('#dividemixed'); if (!root) return;
    const scene = new BarScene($('.stage-svg', root));
    const eq = $('.eqline', root), msg = $('.msg', root);
    const PRESETS = [[2, 1, 2, '÷', 0, 1, 2], [1, 3, 4, '÷', 0, 1, 4], [3, 0, 1, '÷', 0, 3, 4], [1, 1, 2, '÷', 0, 1, 3], [2, 1, 4, '÷', 1, 1, 2], [3, 1, 3, '÷', 0, 2, 3], [2, 0, 1, '÷', 0, 2, 5], [1, 1, 2, '÷', 2, 0, 1]];
    let v = PRESETS[0].slice();
    const key = (x) => x.join(' ');
    function plan() {
      const [wa, a, b, , wc, c, d] = v;
      const Ap = wa * b + a, Cp = wc * d + c, L = lcm(b, d), A2 = Ap * (L / b), C2 = Cp * (L / d);
      const q = Math.floor(A2 / C2), r = A2 % C2, top = Ap * d, bot = b * Cp, g = gcd(top, bot);
      const rowsL = Math.max(1, Math.ceil(A2 / L)), rowsR = Math.max(1, Math.ceil(C2 / L));
      return { wa, a, b, wc, c, d, Ap, Cp, L, A2, C2, q, r, top, bot, g, rowsL, rowsR };
    }
    function stacks(p, mode) {
      // mode 0: mixed as drawn; 1: pieces only (cut wholes); 2: same bottoms
      scene.layout(p.rowsL, p.rowsR); scene.clear();
      const dL = mode === 2 ? p.L : p.b, dR = mode === 2 ? p.L : p.d;
      const nL = mode === 2 ? p.A2 : p.Ap, nR = mode === 2 ? p.C2 : p.Cp;
      const toBars = (n, dd) => { const out = []; let left = n; while (left > 0) { out.push({ n: Math.min(left, dd), d: dd, cut: mode >= 1 && left >= dd }); left -= dd; } return out.length ? out : [{ n: 0, d: dd }]; };
      const barsA = scene.stack(scene.L, toBars(nL, dL), scene.gL, mode === 0 ? mixedText(p.wa, p.a, p.b) : `${nL}/${dL}`);
      const barsB = scene.stack(scene.R, toBars(nR, dR), scene.gR, mode === 0 ? mixedText(p.wc, p.c, p.d) : (mode === 2 && p.C2 > 1 ? `a group of ${p.C2}` : `${nR}/${dR}`));
      scene.sign('÷', mode === 2 && p.L !== p.b ? `${p.L}s` : '');
      return { barsA, barsB };
    }
    function chain(stage, p) {
      const [wa, a, b, , wc, c, d] = v;
      let h = `${mixedHTML(wa, a, b)}${opHTML('÷')}${mixedHTML(wc, c, d)}`;
      if (stage >= 1) h += `${opHTML('→')}${fracHTML(p.Ap, b)}${opHTML('÷')}${fracHTML(p.Cp, d)}`;
      if (stage >= 2 && (p.L !== b || p.L !== d)) h += `${opHTML('→')}${fracHTML(p.A2, p.L)}${opHTML('÷')}${fracHTML(p.C2, p.L)}`;
      if (stage >= 3) h += `${opHTML('=')}${valueHTML(p.A2, p.C2)}`;
      if (stage >= 4) h += `<span class="break"></span>${fracHTML(p.Ap, b)}${opHTML('×')}${fracHTML(d, p.Cp)}${opHTML('=')}${fracHTML(p.top, p.bot)}${p.g > 1 || p.top > p.bot ? `${opHTML('=')}${valueHTML(p.top / p.g, p.bot / p.g)}` : ''}`;
      return h;
    }
    function build() {
      const p = plan(), [wa, a, b, , wc, c, d] = v, list = [];
      const nA = mixedText(wa, a, b), nB = mixedText(wc, c, d);
      list.push({ text: `This is ${nA} ÷ ${nB}. ÷ asks: how many ${nB}s fit into ${nA}? With mixed numbers, first write each one as pieces only.`, run: () => { stacks(p, 0); eq.innerHTML = chain(0, p); } });
      list.push({ text: `${piecesOnlyText(wa, a, b)}${piecesOnlyText(wc, c, d)}${b === 1 ? `A whole number goes over 1: ${wa} is ${wa}/1. ` : ''}${d === 1 ? `A whole number goes over 1: ${wc} is ${wc}/1. ` : ''}So it is ${p.Ap}/${b} ÷ ${p.Cp}/${d}.`, run: () => { stacks(p, 1); eq.innerHTML = chain(1, p); } });
      const sameBottoms = p.L === b && p.L === d;
      if (!sameBottoms) {
        list.push({ text: `Make the bottoms the same so the pieces match. ${p.L} is the first number both ${b} and ${d} count to. ` + (p.L !== b ? `${p.Ap}/${b} becomes ${p.A2}/${p.L}. ` : '') + (p.L !== d ? `${p.Cp}/${d} becomes ${p.C2}/${p.L}. ` : ''), run: () => { stacks(p, 2); eq.innerHTML = chain(2, p); } });
      }
      const fit = p.q === 0 ? 'Not even one whole group fits.' : `${plural(p.q, 'whole group')} fit${p.q === 1 ? 's' : ''}.`;
      const gr = p.r ? gcd(p.r, p.C2) : 1;
      const rest = p.r ? ` ${plural(p.r, 'piece')} left over, and a group needs ${p.C2}, so that is ${p.r}/${p.C2} of a group${gr > 1 ? `, which is ${p.r / gr}/${p.C2 / gr}` : ''}.` : '';
      list.push({ text: `${p.C2 === 1 ? `Count the pieces on the left. ${plural(p.A2, 'piece')} fit.` : `Count groups of ${p.C2} across the bars on the left. ${fit}`}${rest} So ${nA} ÷ ${nB} = ${valueText(p.A2, p.C2)}.`,
        run: () => { const { barsA } = stacks(p, 2); markGroupCells(shadedOf(barsA), p.C2, p.q, scene.gL); eq.innerHTML = chain(3, p); } });
      list.push({ text: `The shortcut gives the same answer. Keep ${p.Ap}/${b}. Change ÷ to ×. Flip ${p.Cp}/${d} to ${d}/${p.Cp}. ${p.Ap} × ${d} = ${p.top} on top, ${b} × ${p.Cp} = ${p.bot} on the bottom. ${p.g > 1 || p.top > p.bot ? simplifyNote(p.top, p.bot) : `Only 1 goes into ${p.top} and ${p.bot}, so ${p.top}/${p.bot} is done.`} Same answer: ${valueText(p.A2, p.C2)}.`,
        run: () => { const { barsA } = stacks(p, 2); markGroupCells(shadedOf(barsA), p.C2, p.q, scene.gL); eq.innerHTML = chain(4, p); } });
      return list;
    }
    const ctl = controller(root, scene, build, () => `Ready. ${mixedText(v[0], v[1], v[2])} ÷ ${mixedText(v[4], v[5], v[6])}. Press Start.`);
    function pick(x) { v = x.slice(); $$('.presets .chip', root).forEach((ch) => ch.setAttribute('aria-pressed', String(ch.dataset.k === key(v)))); msg.textContent = ''; ctl.reset(); }
    $('.presets', root).innerHTML = PRESETS.map((x) => `<button class="chip" type="button" data-k="${key(x)}" aria-pressed="${key(x) === key(v)}">${presetMixedHTML(x)}</button>`).join('');
    $('.presets', root).addEventListener('click', (e) => { const ch = e.target.closest('.chip'); if (ch) pick(ch.dataset.k.split(' ').map((x, i) => (i === 3 ? x : Number(x)))); });
    $('form.custom', root).addEventListener('submit', (e) => {
      e.preventDefault();
      const A = readMixed(root, 'a'), B = readMixed(root, 'b');
      if (A.err || B.err) { msg.textContent = A.err || B.err; return; }
      const L = lcm(A.d, B.d);
      if ((A.w * A.d + A.n) * (L / A.d) > 48) { msg.textContent = 'That makes more than 48 small pieces. Try smaller numbers.'; return; }
      pick([A.w, A.n, A.d, '÷', B.w, B.n, B.d]);
    });
    ctl.reset();
  }

  initSimplify();
  initAddSub();
  initMultiply();
  initDivide();
  initAddSubMixed();
  initMultiplyMixed();
  initDivideMixed();
})();
