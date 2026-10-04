/* Learn pages: concept animations. Plain JS, no inline script (the site's CSP forbids it). */
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

  const gcd = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; };
  const smallestFactor = (n) => { for (let p = 2; p * p <= n; p++) if (n % p === 0) return p; return n; };
  const f1 = (x) => Math.round(x * 10) / 10;
  const sleep = (ms) => new Promise((res) => setTimeout(res, reduced ? 0 : ms));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;

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

  function el(tag, attrs = {}, parent = null) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    if (parent) parent.appendChild(node);
    return node;
  }

  /** A fraction tile: colored rect + glass sheen + optional label. set() moves and resizes it. */
  function tileEl(parent, d, label, cls = '') {
    const g = el('g', { class: `tile ${cls}`.trim() }, parent);
    const body = el('rect', { rx: 6, fill: tileColor(d) }, g);
    const sheen = el('rect', { rx: 6, fill: 'url(#sheen)' }, g);
    const text = el('text', { class: 'tlabel', fill: tileText(d) }, g);
    text.textContent = label;
    const t = {
      g,
      set(x, y, w, h) {
        for (const r of [body, sheen]) { r.setAttribute('x', f1(x)); r.setAttribute('y', f1(y)); r.setAttribute('width', f1(Math.max(0, w))); r.setAttribute('height', f1(Math.max(0, h))); }
        text.setAttribute('x', f1(x + w / 2)); text.setAttribute('y', f1(y + h / 2));
        text.style.display = (w >= 34 && h >= 18) ? '' : 'none';
        return t;
      },
    };
    return t;
  }

  /* ---------- the two-square scene ---------- */
  class Scene {
    constructor(svg) { this.svg = svg; this.leftTiles = []; }
    /** Side by side when there is room, otherwise the second square sits under the first. */
    layout() {
      const W = Math.max(300, Math.round(this.svg.getBoundingClientRect().width) || 700);
      const pad = 8;
      this.horiz = W >= 600;
      if (this.horiz) {
        const mid = 160;
        this.S = Math.min(320, Math.floor((W - 2 * pad - mid) / 2));
        const x0 = Math.round((W - (2 * this.S + mid)) / 2);
        this.L = { x: x0, y: pad + 22 };
        this.R = { x: x0 + this.S + mid, y: pad + 22 };
        this.M = { x: x0 + this.S + mid / 2, y: pad + 22 + this.S / 2 };
        this.H = this.S + 2 * pad + 22;
      } else {
        const mid = 170;
        this.S = Math.min(320, W - 2 * pad);
        const x = Math.round((W - this.S) / 2);
        this.L = { x, y: pad + 22 };
        this.R = { x, y: pad + 22 + this.S + mid };
        this.M = { x: W / 2, y: pad + 22 + this.S + mid / 2 - 12 };
        this.H = 2 * this.S + mid + 2 * pad + 44;
      }
      this.W = W;
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
      if (name) { const t = el('text', { class: 'lname', x: o.x + this.S / 2, y: o.y - 9 }, parent); t.textContent = name; }
    }
    cell(o, cols, rows, c, r) { const cw = this.S / cols, rh = this.S / rows; return { x: o.x + c * cw + 2, y: o.y + r * rh + 2, w: cw - 4, h: rh - 4 }; }
    col(o, cols, c) { const cw = this.S / cols; return { x: o.x + c * cw + 2, y: o.y + 2, w: cw - 4, h: this.S - 4 }; }
    /** Left square: d pieces as cols columns of k cells, the first n shaded (column by column). */
    drawLeft(n, d, k, name) {
      const cols = d / k;
      this.frame(this.L, this.gL, name);
      this.leftTiles = [];
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < k; r++) {
          const idx = c * k + r, cr = this.cell(this.L, cols, k, c, r);
          if (idx < n) { const t = tileEl(this.gL, d, `1/${d}`).set(cr.x, cr.y, cr.w, cr.h); this.leftTiles.push({ c, r, t }); }
          else el('rect', { class: 'slot', x: f1(cr.x), y: f1(cr.y), width: f1(cr.w), height: f1(cr.h), rx: 6 }, this.gL);
        }
      }
    }
    /** Right square: cols big pieces, the first filled shaded. */
    drawRight(cols, filled, dd, name, pop = false) {
      this.frame(this.R, this.gR, name);
      for (let c = 0; c < cols; c++) {
        const cr = this.col(this.R, cols, c);
        if (c < filled) tileEl(this.gR, dd, `1/${dd}`, pop ? 'pop' : '').set(cr.x, cr.y, cr.w, cr.h);
        else el('rect', { class: 'slot', x: f1(cr.x), y: f1(cr.y), width: f1(cr.w), height: f1(cr.h), rx: 6 }, this.gR);
      }
    }
    /** Green outline around every column of the left square: the groups. */
    groups(cols) {
      for (let c = 0; c < cols; c++) {
        const cr = this.col(this.L, cols, c);
        el('rect', { class: 'chunk', x: f1(cr.x - 1), y: f1(cr.y - 1), width: f1(cr.w + 2), height: f1(cr.h + 2), rx: 9, style: `animation-delay:${c * 40}ms` }, this.gL);
      }
    }
    ghostLeft(upToCol) { for (const { c, t } of this.leftTiles) if (c < upToCol) t.g.classList.add('ghost'); }
    /** The fraction in the middle, with "÷ k" beside the top and bottom while a step is happening. */
    label(n, d, k = null) {
      this.gM.innerHTML = '';
      const { x, y } = this.M;
      const top = el('text', { class: 'lnum', x, y: y - 14 }, this.gM); top.textContent = n;
      el('line', { class: 'lbar', x1: x - 26, x2: x + 26, y1: y, y2: y }, this.gM);
      const bot = el('text', { class: 'lnum', x, y: y + 40 }, this.gM); bot.textContent = d;
      if (k) {
        const a = el('text', { class: 'lhand', x: x + 34, y: y - 16 }, this.gM); a.textContent = `÷ ${k}`;
        const b = el('text', { class: 'lhand', x: x + 34, y: y + 38 }, this.gM); b.textContent = `÷ ${k}`;
      }
      const ax = this.horiz ? x : x, ay = this.horiz ? y + 70 : y + 72;
      const arrow = this.horiz
        ? `M ${ax - 28} ${ay} H ${ax + 28} M ${ax + 14} ${ay - 12} L ${ax + 28} ${ay} L ${ax + 14} ${ay + 12}`
        : `M ${ax + 90} ${y - 30} V ${y + 30} M ${ax + 78} ${y + 16} L ${ax + 90} ${y + 30} L ${ax + 102} ${y + 16}`;
      el('path', { class: 'larrow', d: arrow }, this.gM);
    }
    /** The morph: each shaded column's k small pieces fly to the right square and grow into one big piece. */
    async fly(n, d, k) {
      const cols = d / k, filled = n / k, dd = d / k;
      const moves = [];
      for (let c = 0; c < filled; c++) {
        const to = this.col(this.R, cols, c);
        for (let r = 0; r < k; r++) {
          const from = this.cell(this.L, cols, k, c, r);
          const t = tileEl(this.gF, d, `1/${d}`).set(from.x, from.y, from.w, from.h);
          moves.push({ t, from, to, delay: c * 140 + r * 30, col: c });
        }
      }
      const total = reduced ? 0 : 700;
      const start = performance.now();
      const last = moves.length ? moves[moves.length - 1].delay + total : 0;
      await tween(last, () => {
        const now = performance.now() - start;
        for (const m of moves) {
          const p = reduced ? 1 : Math.max(0, Math.min(1, (now - m.delay) / total));
          const e = ease(p);
          m.t.set(m.from.x + (m.to.x - m.from.x) * e, m.from.y + (m.to.y - m.from.y) * e, m.from.w + (m.to.w - m.from.w) * e, m.from.h + (m.to.h - m.from.h) * e);
          if (p > 0.05) { const src = this.leftTiles.find((lt) => lt.c === m.col && lt.r === (m.from.y > this.L.y + 2 ? Math.round((m.from.y - 2 - this.L.y) / (this.S / k)) : 0)); if (src) src.t.g.classList.add('ghost'); }
        }
      });
      this.gF.innerHTML = '';
      this.ghostLeft(filled);
      this.gR.innerHTML = '';
      this.drawRight(cols, filled, dd, 'Bigger pieces', true);
    }
  }

  /* ---------- simplify page ---------- */
  function initSimplify() {
    const svg = $('#simplify-stage');
    if (!svg) return;
    const scene = new Scene(svg);
    const cap = $('#simplify-cap'), eq = $('#simplify-eq'), msg = $('#simplify-msg'), where = $('#simplify-where');
    const btnNext = $('#btn-next'), btnPlay = $('#btn-play'), btnReplay = $('#btn-replay');
    const PRESETS = [[6, 20], [4, 8], [9, 12], [8, 12], [10, 15], [12, 18], [18, 24], [16, 40], [12, 36]];
    const MAXD = 48;
    let n = 6, d = 20, mode = 'steps', steps = [], idx = -1, busy = false, playing = false;

    function say(text) {
      cap.textContent = text;
      cap.classList.remove('ink');
      if (!reduced) { void cap.getBoundingClientRect(); cap.classList.add('ink'); }
    }
    function chain(rounds, upto, showDivide) {
      let html = fracHTML(n, d);
      rounds.forEach((r, i) => {
        if (i < upto) html += `${opsHTML(r.k)}${fracHTML(r.nn, r.dd)}`;
        else if (i === upto && showDivide) html += `<span class="dim">${opsHTML(r.k)}</span>`;
      });
      eq.innerHTML = html;
    }
    function rounds() {
      const out = [];
      let a = n, b = d;
      while (gcd(a, b) > 1) {
        const g = gcd(a, b), k = mode === 'jump' ? g : smallestFactor(g);
        out.push({ n: a, d: b, k, nn: a / k, dd: b / k });
        a /= k; b /= k;
      }
      return out;
    }
    /** Every step can draw its own end state from scratch (used for Next, for resize, and before an animation). */
    function build() {
      const rs = rounds();
      const list = [];
      const base = (r, i, withRight) => () => {
        scene.layout(); scene.clear();
        scene.drawLeft(r.n, r.d, r.k, i === 0 ? 'Small pieces' : 'Pieces');
        if (withRight) scene.drawRight(r.d / r.k, 0, r.dd, 'Bigger pieces');
        scene.label(r.n, r.d);
      };
      if (!rs.length) {
        list.push({
          text: `This is ${n}/${d}. The square is cut into ${d} pieces, and ${n} are shaded. Nothing bigger than 1 goes into both ${n} and ${d}, so it is already simplified all the way.`,
          run: () => { scene.layout(); scene.clear(); scene.drawLeft(n, d, 1, 'Pieces'); scene.label(n, d); chain(rs, 0, false); },
        });
        return list;
      }
      rs.forEach((r, i) => {
        list.push({
          text: i === 0
            ? `This is ${n}/${d}. The square is cut into ${d} small pieces, and ${n} of them are shaded.`
            : `Check again. Now it is ${r.n}/${r.d}. Can we use even bigger pieces?`,
          run: () => { base(r, i, true)(); chain(rs, i, false); },
        });
        list.push({
          text: `${r.k} goes into ${r.n}, and ${r.k} goes into ${r.d}. So group the pieces in ${r.k}s. Each column is one group of ${r.k}.`,
          run: () => { base(r, i, true)(); scene.groups(r.d / r.k); scene.label(r.n, r.d, r.k); chain(rs, i, true); },
        });
        list.push({
          text: `Each group of ${r.k} small pieces joins into 1 bigger piece. The ${plural(r.n, 'shaded piece')} fly across and become ${plural(r.nn, 'bigger piece')}.`,
          run: async (animate) => {
            base(r, i, true)(); scene.groups(r.d / r.k); scene.label(r.n, r.d, r.k); chain(rs, i, true);
            if (animate) { await scene.fly(r.n, r.d, r.k); }
            else { scene.ghostLeft(r.nn); scene.gR.innerHTML = ''; scene.drawRight(r.d / r.k, r.nn, r.dd, 'Bigger pieces'); }
          },
        });
        list.push({
          text: `Now the square is cut into ${r.dd} pieces, and ${r.nn} are shaded. ${r.n}/${r.d} and ${r.nn}/${r.dd} are the same amount. Bigger pieces, fewer of them.`,
          run: () => {
            base(r, i, true)(); scene.groups(r.d / r.k); scene.ghostLeft(r.nn);
            scene.gR.innerHTML = ''; scene.drawRight(r.d / r.k, r.nn, r.dd, 'Bigger pieces');
            scene.label(r.nn, r.dd); chain(rs, i + 1, false);
          },
        });
      });
      const last = rs[rs.length - 1];
      list.push({
        text: `Nothing bigger than 1 goes into both ${last.nn} and ${last.dd}. So ${n}/${d} = ${last.nn}/${last.dd}, simplified all the way.`,
        run: () => {
          scene.layout(); scene.clear();
          scene.drawLeft(n, d, 1, 'You started with');
          scene.drawRight(last.dd, last.nn, last.dd, 'Simplified all the way');
          scene.label(last.nn, last.dd);
          chain(rs, rs.length, false);
        },
      });
      return list;
    }
    function updateButtons() {
      const atEnd = idx >= steps.length - 1;
      btnNext.disabled = busy || atEnd;
      btnPlay.disabled = busy || atEnd;
      btnReplay.disabled = busy;
      btnNext.textContent = idx < 0 ? 'Start' : 'Next step';
      where.textContent = steps.length > 1 ? `Step ${Math.max(0, idx + 1)} of ${steps.length}` : '';
    }
    async function runStep(i, animate) {
      busy = true; updateButtons();
      idx = i;
      const s = steps[i];
      say(s.text);
      try { await s.run(animate); } finally { busy = false; updateButtons(); }
    }
    async function playAll() {
      if (playing) return;
      playing = true;
      btnPlay.textContent = 'Playing…';
      while (idx < steps.length - 1 && playing) {
        await runStep(idx + 1, true);
        if (idx < steps.length - 1) await sleep(1400);
      }
      playing = false;
      btnPlay.textContent = 'Play it all';
      updateButtons();
    }
    function reset() {
      playing = false;
      steps = build();
      idx = -1;
      scene.layout(); scene.clear();
      scene.drawLeft(n, d, 1, 'Pieces');
      scene.label(n, d);
      eq.innerHTML = fracHTML(n, d);
      say(steps.length > 1 ? `Ready. ${n}/${d} is on the left. Press Start to watch it simplify.` : steps[0].text);
      if (steps.length === 1) { idx = 0; steps[0].run(false); }
      updateButtons();
    }
    function pick(nn, dd) {
      n = nn; d = dd;
      $$('#simplify-presets .chip').forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.n) === n && Number(c.dataset.d) === d)));
      msg.textContent = '';
      reset();
    }

    $('#simplify-presets').innerHTML = PRESETS.map(([a, b]) => `<button class="chip" type="button" data-n="${a}" data-d="${b}" aria-pressed="${a === n && b === d}">${fracHTML(a, b)}</button>`).join('');
    $('#simplify-presets').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) pick(Number(c.dataset.n), Number(c.dataset.d)); });
    $('#simplify-custom').addEventListener('submit', (e) => {
      e.preventDefault();
      const a = parseInt($('#cust-top').value, 10), b = parseInt($('#cust-bot').value, 10);
      if (!Number.isInteger(a) || !Number.isInteger(b)) { msg.textContent = 'Type a top number and a bottom number.'; return; }
      if (b < 2 || b > MAXD) { msg.textContent = `Use a bottom number from 2 to ${MAXD}.`; return; }
      if (a < 1 || a >= b) { msg.textContent = 'This page shows fractions smaller than one whole. Keep the top smaller than the bottom.'; return; }
      pick(a, b);
    });
    $('#simplify-mode').addEventListener('click', (e) => {
      const c = e.target.closest('.chip'); if (!c) return;
      mode = c.dataset.mode;
      $$('#simplify-mode .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      reset();
    });
    btnNext.addEventListener('click', () => { if (!busy && idx < steps.length - 1) runStep(idx + 1, true); });
    btnPlay.addEventListener('click', playAll);
    btnReplay.addEventListener('click', () => { playing = false; reset(); });
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (busy) return; if (idx < 0) reset(); else steps[idx].run(false); }, 150); });
    reset();
  }

  initSimplify();
})();
