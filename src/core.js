'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= math ================= */
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
  const divisors = (n) => { const out = []; for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i); return out; };
  const primeFactors = (n) => { const out = []; let m = n; for (let p = 2; p * p <= m; p++) { while (m % p === 0) { out.push(p); m /= p; } } if (m > 1) out.push(m); return out; };
  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  /** Simplest form as a value object {w, n, d}; d === null means a whole number. */
  const simplest = (n, d) => {
    const g = gcd(n, d), a = n / g, b = d / g;
    if (b === 1) return { w: a, n: 0, d: null };
    if (a > b) return { w: Math.floor(a / b), n: a % b, d: b };
    return { w: 0, n: a, d: b };
  };
  const valOf = (v) => (v.w || 0) + (v.d == null ? 0 : v.n / v.d);
  const textOf = (v) => (v.d == null ? `${v.w}` : (v.w ? `${v.w} ${v.n}/${v.d}` : `${v.n}/${v.d}`));

  const PLURAL = { 1: 'wholes', 2: 'halves', 3: 'thirds', 4: 'fourths', 5: 'fifths', 6: 'sixths', 7: 'sevenths', 8: 'eighths', 9: 'ninths', 10: 'tenths', 11: 'elevenths', 12: 'twelfths' };
  const SINGLE = { 1: 'whole', 2: 'half', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth' };
  const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
  const TENS = ['', '', 'twent', 'thirt', 'fort', 'fift', 'sixt', 'sevent', 'eight', 'ninet'];
  const ordinal = (d) => (d < 20 ? ORD[d] : (d % 10 ? `${TENS[Math.floor(d / 10)]}y-${ORD[d % 10]}` : `${TENS[d / 10]}ieth`));
  const pieceName = (d, count = 2) => {
    if (SINGLE[d]) return count === 1 ? SINGLE[d] : PLURAL[d];
    const o = d < 100 ? ordinal(d) : `${d}th`;
    return count === 1 ? o : `${o}s`;
  };
  /** "a 3" but "an 8", "an 11", "an 83". */
  const an = (x) => { const s = String(x); return /^8/.test(s) || s === '11' || s === '18' ? 'an' : 'a'; };

  /* ================= fraction-tile palette (color = piece size) ================= */
  const TILE = { 1: '#E5483B', 2: '#F38B2A', 3: '#F2C12E', 4: '#3FAE68', 5: '#20A4B5', 6: '#3B7EE0', 7: '#5D59D6', 8: '#8E5AD5', 9: '#C551B2', 10: '#E5567E', 11: '#B97A3D', 12: '#7FA736' };
  const tileColor = (d) => TILE[d] || `hsl(${(d * 47) % 360}, 58%, 50%)`;
  const tileText = (d) => (d === 3 ? '#3A2E05' : '#FFFFFF');

  /* ================= markup helpers (numbers only, never user text) ================= */
  const frac = (n, d, cls = '') => `<span class="frac ${cls}" role="img" aria-label="${n} over ${d}"><span aria-hidden="true">${n}</span><i></i><span aria-hidden="true">${d}</span></span>`;
  const showVal = (v) => {
    if (v.d == null) return `<span class="whole">${v.w}</span>`;
    if (v.w) return `<span class="mixed" role="img" aria-label="${v.w} and ${v.n} over ${v.d}"><span class="w" aria-hidden="true">${v.w}</span>${frac(v.n, v.d)}</span>`;
    return frac(v.n, v.d);
  };
  const ops = (top, bottom, sign = '=', signCls = '') => `<span class="ops"><span>${top}</span><span class="sign ${signCls}">${sign}</span><span>${bottom}</span></span>`;
  const widthOf = (el, fallback = 900) => Math.round(el.getBoundingClientRect().width) || fallback;
  const f1 = (x) => (Math.round(x * 10) / 10).toString();

  function note(el, html, tone = 'info') {
    const node = typeof el === 'string' ? $(el) : el;
    if (node.dataset.base === undefined) node.dataset.base = node.className.split(/\s+/).filter((c) => c && !['note', 'good', 'bad', 'info', 'ink'].includes(c)).join(' ');
    node.className = `note ${node.dataset.base} ${tone}`.replace(/\s+/g, ' ').trim();
    node.innerHTML = html;
    if (!reduced) { void node.getBoundingClientRect(); node.classList.add('ink'); }
  }
  function shake(node) {
    if (!node) return;
    node.classList.remove('shake');
    void node.getBoundingClientRect();
    node.classList.add('shake');
  }

  /* ================= progress storage (per device, best effort) ================= */
  const Store = {
    key: 'fraction-quest-progress-v2',
    data: { stars: 0, prog: {}, best: 0, sound: true, last: 'pieces', solved: 0, stats: {} },
    load() {
      try {
        const raw = window.localStorage.getItem(this.key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.data = Object.assign({}, this.data, parsed);
          if (typeof this.data.prog !== 'object' || this.data.prog === null) this.data.prog = {};
          if (typeof this.data.stats !== 'object' || this.data.stats === null) this.data.stats = {};
          ['stars', 'best', 'solved'].forEach((k) => { if (!Number.isFinite(this.data[k])) this.data[k] = 0; });
        }
      } catch (err) { console.debug('Progress could not be loaded:', err); }
    },
    save() {
      try { window.localStorage.setItem(this.key, JSON.stringify(this.data)); }
      catch (err) { console.debug('Progress could not be saved:', err); }
    },
    reset() {
      this.data = { stars: 0, prog: {}, best: 0, sound: this.data.sound, last: 'pieces', solved: 0, stats: {} };
      try { window.localStorage.removeItem(this.key); } catch (err) { console.debug('Progress could not be cleared:', err); }
    },
    count(st) { return Array.isArray(this.data.prog[st]) ? this.data.prog[st].length : 0; },
    add(st, item) {
      if (!Array.isArray(this.data.prog[st])) this.data.prog[st] = [];
      const list = this.data.prog[st];
      if (list.includes(item)) return false;
      list.push(item);
      this.save();
      return true;
    },
    has(st, item) { return Array.isArray(this.data.prog[st]) && this.data.prog[st].includes(item); },
  };
  Store.load();

  /* ================= sound (tiny synth, no files) ================= */
  const Sound = {
    ctx: null,
    get on() { return Store.data.sound !== false; },
    tone(freq, dur = 0.08, type = 'sine', vol = 0.1, when = 0) {
      if (!this.on) return;
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
        }
        const c = this.ctx;
        if (c.state === 'suspended') c.resume();
        const t = c.currentTime + when;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(c.destination);
        o.start(t); o.stop(t + dur + 0.03);
      } catch (err) { console.debug('Audio unavailable:', err); }
    },
    play(kind) {
      const seqs = {
        tick: [[1150, 0.035, 'sine', 0.05]],
        snap: [[520, 0.06, 'triangle'], [780, 0.09, 'triangle']],
        good: [[523, 0.1], [659, 0.1], [784, 0.16]],
        bad: [[247, 0.14, 'triangle', 0.08], [196, 0.2, 'triangle', 0.08]],
        win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.32]],
      };
      let t = 0;
      for (const [f, d, type = 'sine', v = 0.1] of (seqs[kind] || [])) { this.tone(f, d, type, v, t); t += d * 0.8; }
    },
  };

  /* ================= confetti made of fraction tiles ================= */
  const Confetti = (() => {
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    let parts = [];
    let raf = 0;
    const colors = Object.values(TILE);
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(window.innerWidth * dpr);
      cv.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function step() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      parts = parts.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
      for (const p of parts) {
        p.vy += 0.22; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, p.life / 30);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * 0.3);
        ctx.restore();
      }
      if (parts.length) raf = window.requestAnimationFrame(step);
      else { raf = 0; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
    }
    function burst(count = 110) {
      if (reduced) return;
      resize();
      const x = window.innerWidth / 2, y = window.innerHeight * 0.35;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 9;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 5, w: 10 + Math.random() * 14, h: 7 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[i % colors.length], life: 110 + Math.random() * 50 });
      }
      if (!raf) raf = window.requestAnimationFrame(step);
    }
    return { burst };
  })();

  let toastTimer = 0;
  function toast(html) {
    const t = $('#toast');
    t.innerHTML = html;
    t.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => t.classList.remove('show'), 3400);
  }

  /* ================= stars + station progress (mastery: only clean items count) ================= */
  const STATIONS = [
    { id: 'pieces', name: 'Bigger pieces', goal: 3 },
    { id: 'rule', name: 'The golden rule', goal: 4 },
    { id: 'rainbow', name: 'Factor rainbows', goal: 3 },
    { id: 'primes', name: 'Prime trees', goal: 3 },
    { id: 'wholes', name: 'Wholes and leftovers', goal: 3 },
    { id: 'detective', name: 'Mistake detective', goal: 8 },
    { id: 'story', name: 'Story problems', goal: 8 },
    { id: 'challenge', name: 'Challenge', goal: 10 },
  ];
  const meta = (id) => STATIONS.find((s) => s.id === id);

  function renderStars(bump) {
    $('#starCount').textContent = String(Store.data.stars);
    if (bump) { const s = $('#stars'); s.classList.remove('bump'); void s.getBoundingClientRect(); s.classList.add('bump'); }
  }
  function award(k) {
    if (k <= 0) return;
    Store.data.stars += k;
    Store.save();
    renderStars(true);
  }
  function renderMeter(st) {
    const m = $(`#m-${st}`);
    if (!m) return;
    const s = meta(st), c = Store.count(st);
    const dots = Array.from({ length: s.goal }, (_, i) => `<i class="${i < c ? 'on' : ''}" style="--c:${tileColor((i % 12) + 1)}"></i>`).join('');
    m.innerHTML = `<span class="dots" aria-hidden="true">${dots}</span><span>${Math.min(c, s.goal)} of ${s.goal} done with no misses${c >= s.goal ? '. Station mastered!' : ''}</span>`;
  }
  /** Adds a clean item to the station meter; returns false if that item was already counted. */
  function progress(st, item, stars) {
    if (!Store.add(st, item)) return false;
    award(stars);
    const s = meta(st);
    if (Store.count(st) === s.goal) {
      award(5);
      window.setTimeout(() => { Sound.play('win'); Confetti.burst(); toast(`${s.name} mastered! +5 bonus stars`); }, 350);
    }
    renderPath();
    renderMeter(st);
    return true;
  }
  /** Ends an item: clean work earns full stars and moves the meter; work with misses earns 1 star only. */
  function finishItem(st, key, clean, stars = 2) {
    Track.item(st, clean);
    if (clean) { if (!progress(st, key, stars)) award(stars); }
    else award(1);
  }

  /* ================= SVG tiles ================= */
  function tileG(x, y, w, h, d, label, showLabel = true, cls = '', style = '') {
    const c = tileColor(d), t = tileText(d);
    const lab = showLabel && w >= 34 ? `<text class="tlabel" x="${f1(x + w / 2)}" y="${f1(y + h / 2)}" fill="${t}">${label}</text>` : '';
    const st = style ? ` style="${style}"` : '';
    const ww = f1(Math.max(0, w));
    return `<g class="tile ${cls}"${st}><rect x="${f1(x)}" y="${f1(y)}" width="${ww}" height="${f1(h)}" rx="6" fill="${c}"/><rect x="${f1(x)}" y="${f1(y)}" width="${ww}" height="${f1(h)}" rx="6" fill="url(#sheen)"/>${lab}</g>`;
  }

  /** Tile trays: one bar per whole, d slots each, n tiles filled in reading order. */
  class Tray {
    constructor(svg, opts = {}) {
      this.svg = svg;
      this.o = Object.assign({ top: 30, trayH: 64, gap: 16, pad: 6, labels: true, minW: 300 }, opts);
      this.n = 0; this.d = 1; this.cw = 1;
    }
    rows() { return Math.max(1, Math.ceil(this.n / this.d)); }
    y(r) { return this.o.top + r * (this.o.trayH + this.o.gap); }
    /** Largest bottom number that still draws readable tiles at the current width. */
    static maxPieces(svg) {
      const W = widthOf(svg, 900);
      const minTile = W >= 440 ? 9 : 12;  // tablets: thinner tiles so a whole bar can hold 48 pieces; phones keep 12px
      return Math.max(20, Math.min(48, Math.floor((W - 12) / minTile)));
    }
    draw(n, d) {
      this.n = n; this.d = d;
      const W = Math.max(this.o.minW, widthOf(this.svg));
      const { trayH: h, pad } = this.o, rows = this.rows();
      const tw = W - 2 * pad;
      this.cw = tw / d;
      const H = this.y(rows - 1) + h + 8;
      let trays = '', slots = '', tiles = '';
      for (let r = 0; r < rows; r++) {
        const y = this.y(r);
        trays += `<rect class="tray" x="${pad - 3}" y="${y - 3}" width="${f1(tw + 6)}" height="${h + 6}" rx="10"/>`;
        for (let i = 0; i < d; i++) {
          const idx = r * d + i, x = pad + i * this.cw;
          if (idx >= n) slots += `<rect class="slot" x="${f1(x + 2)}" y="${y + 2}" width="${f1(this.cw - 4)}" height="${h - 4}" rx="6"/>`;
          else tiles += tileG(x + 2, y + 2, this.cw - 4, h - 4, d, `1/${d}`, this.o.labels);
        }
      }
      this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      this.svg.setAttribute('height', String(H));
      this.svg.classList.remove('still');
      this.svg.innerHTML = `${trays}<g class="slots">${slots}</g><g class="orig">${tiles}</g><g class="merged"></g><g class="chunks"></g>`;
    }
    eachGroup(g, fn) {
      const per = this.d / g;
      for (let r = 0; r < this.rows(); r++) {
        for (let k = 0; k < per; k++) {
          const idx0 = r * this.d + k * g;
          const shaded = Math.max(0, Math.min(g, this.n - idx0));
          fn({ x: this.o.pad + k * g * this.cw, w: g * this.cw, y: this.y(r), shaded, i: r * per + k });
        }
      }
    }
    /** Outlines chunks of g without merging; marks part-shaded chunks. Requires d % g === 0. */
    outline(g) {
      const h = this.o.trayH, valid = this.n % g === 0;
      let ch = '';
      this.eachGroup(g, ({ x, w, y, shaded, i }) => {
        const mixed = shaded > 0 && shaded < g;
        if (mixed) ch += `<rect class="hatch" x="${f1(x + 2)}" y="${y + 2}" width="${f1(w - 4)}" height="${h - 4}" rx="6"/><text class="qmark" x="${f1(x + w / 2)}" y="${y - 8}">?</text>`;
        const cls = valid ? 'ok' : (mixed ? 'bad' : 'plain');
        ch += `<rect class="chunk ${cls}" x="${f1(x + 1)}" y="${y - 1}" width="${f1(w - 2)}" height="${h + 2}" rx="9" style="animation-delay:${i * 30}ms"/>`;
      });
      this.svg.classList.remove('still');
      $('.chunks', this.svg).innerHTML = ch;
      $('.merged', this.svg).innerHTML = '';
      $('.orig', this.svg).classList.remove('fade');
      $('.slots', this.svg).classList.remove('fade');
      return valid;
    }
    /** Merges each full chunk of g into one bigger tile (the snap). Requires n % g === 0 and d % g === 0. */
    chunk(g, animate = true) {
      const h = this.o.trayH, nd = this.d / g;
      let ch = '', mg = '';
      this.eachGroup(g, ({ x, w, y, shaded, i }) => {
        ch += `<rect class="chunk ok" x="${f1(x + 1)}" y="${y - 1}" width="${f1(w - 2)}" height="${h + 2}" rx="9" style="animation-delay:${i * 30}ms"/>`;
        if (shaded === g) mg += tileG(x + 2, y + 2, w - 4, h - 4, nd, `1/${nd}`, this.o.labels, 'pop', `animation-delay:${140 + i * 80}ms`);
        else mg += `<rect class="slot" x="${f1(x + 2)}" y="${y + 2}" width="${f1(w - 4)}" height="${h - 4}" rx="6"/>`;
      });
      this.svg.classList.toggle('still', !animate);
      $('.chunks', this.svg).innerHTML = ch;
      $('.merged', this.svg).innerHTML = mg;
      $('.orig', this.svg).classList.add('fade');
      $('.slots', this.svg).classList.add('fade');
    }
  }

  /** Number line with one tile bar per row so amounts can be compared directly. */
  function compareLine(svg, rows) {
    const W = Math.max(320, widthOf(svg));
    const vals = rows.map(valOf);
    const M = Math.max(1, Math.ceil(Math.max(...vals) - 1e-9));
    const left = 10, labW = W < 520 ? 70 : 92;
    const unit = (W - left - labW) / M;
    const rowH = W < 520 ? 36 : 42, step = rowH + 26;
    const axisY = 6 + rows.length * step + 6;
    const H = axisY + 28;
    let out = '';
    rows.forEach((r, idx) => {
      const y = 6 + idx * step + 18;
      out += `<text class="rowtag" x="${left}" y="${y - 6}">${r.tag}</text>`;
      out += `<rect class="tray" x="${left}" y="${y}" width="${f1(unit * M)}" height="${rowH}" rx="8" opacity=".55"/>`;
      let x = left;
      for (let k = 0; k < (r.w || 0); k++) { out += tileG(x + 1, y + 1, unit - 2, rowH - 2, 1, '1', true, 'drop', `animation-delay:${k * 60}ms`); x += unit; }
      if (r.d != null) {
        const cw = unit / r.d;
        for (let i = 0; i < r.n; i++) { out += tileG(x + 1, y + 1, cw - 2, rowH - 2, r.d, `1/${r.d}`, true, 'drop', `animation-delay:${Math.min(i * 30, 600)}ms`); x += cw; }
      }
      const end = left + vals[idx] * unit;
      const same = Math.abs(vals[idx] - vals[0]) < 1e-9;
      if (idx > 0) out += `<line class="guide ${same ? 'same' : 'diff'}" x1="${f1(end)}" y1="${y - 4}" x2="${f1(end)}" y2="${axisY}"/>`;
      else out += `<line class="guide same" x1="${f1(end)}" y1="${y - 4}" x2="${f1(end)}" y2="${axisY}" opacity=".35"/>`;
      out += `<text class="rowval" x="${f1(Math.max(end, left) + 8)}" y="${y + rowH / 2}">${textOf(r)}</text>`;
    });
    out += `<line class="axis" x1="${left}" y1="${axisY}" x2="${f1(left + unit * M)}" y2="${axisY}"/>`;
    for (let k = 0; k <= M; k++) {
      const x = left + k * unit;
      out += `<line class="tick" x1="${f1(x)}" y1="${axisY - 6}" x2="${f1(x)}" y2="${axisY + 6}"/><text class="ticklbl" x="${f1(x)}" y="${axisY + 22}">${k}</text>`;
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', String(H));
    svg.innerHTML = out;
  }

  /* ================= shared inputs ================= */
  const customHTML = (p) => `<span class="custom kp-group"><span class="mini-frac"><input id="${p}-cn" class="mini kp" inputmode="${KP_MODE}" autocomplete="off" aria-label="Your own top number"><i></i><input id="${p}-cd" class="mini kp" inputmode="${KP_MODE}" autocomplete="off" aria-label="Your own bottom number"></span><button class="chip" id="${p}-cgo" type="button">Try mine</button><span class="cmsg" id="${p}-cmsg" role="alert" hidden></span></span>`;
  const digitsOnly = (input) => input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 3); });

  function bindCustom(prefix, validate, apply) {
    const host = $(`[data-custom="${prefix}"]`);
    host.innerHTML = customHTML(prefix);
    const nI = $(`#${prefix}-cn`), dI = $(`#${prefix}-cd`), msg = $(`#${prefix}-cmsg`);
    [nI, dI].forEach(digitsOnly);
    const go = () => {
      const n = parseInt(nI.value, 10), d = parseInt(dI.value, 10);
      const err = Number.isInteger(n) && Number.isInteger(d) ? validate(n, d) : 'Type a top number and a bottom number.';
      if (err) { msg.textContent = err; msg.hidden = false; Sound.play('bad'); return; }
      msg.hidden = true;
      Sound.play('tick');
      apply(n, d);
    };
    $(`#${prefix}-cgo`).addEventListener('click', go);
    [nI, dI].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } }));
  }

  function presetChips(host, list, onPick) {
    host.innerHTML = list.map(([n, d]) => `<button type="button" class="chip" data-n="${n}" data-d="${d}" aria-pressed="false">${frac(n, d)}</button>`).join('');
    host._onPick = onPick;
    if (host._bound) return;
    host._bound = true;
    host.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-n]');
      if (!b) return;
      Sound.play('tick');
      host._onPick(Number(b.dataset.n), Number(b.dataset.d));
    });
  }
  function markPreset(host, n, d) {
    $$('button[data-n]', host).forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.n) === n && Number(b.dataset.d) === d)));
  }

  /* ================= routing between stations ================= */
  const MODS = {};
  let current = STATIONS.some((s) => s.id === Store.data.last) ? Store.data.last : 'pieces';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function renderPath() {
    $('#path').innerHTML = STATIONS.map((s, i) => {
      const c = Math.min(Store.count(s.id), s.goal), done = c >= s.goal;
      return `<button type="button" class="step ${done ? 'done' : ''}" data-st="${s.id}" ${current === s.id ? 'aria-current="step"' : ''} aria-controls="st-${s.id}"><span class="num">${done ? CHECK : i + 1}</span><span class="nm">${s.name}${done ? '<span class="sr"> (complete)</span>' : ''}</span><span class="meter" aria-hidden="true"><b style="width:${(c / s.goal) * 100}%"></b></span></button>`;
    }).join('');
  }
  function show(id, fromUser = false) {
    current = id;
    Store.data.last = id;
    Store.save();
    $$('.station').forEach((s) => { s.hidden = s.id !== `st-${id}`; });
    renderPath();
    renderMeter(id);
    if (MODS[id] && MODS[id].onShow) MODS[id].onShow();
    $$(`#st-${id} .ask`).forEach((el) => { if (el._ask && !el._ask.done) el._ask.t0 = performance.now(); });
    const tab = $(`.step[data-st="${id}"]`);
    if (tab && fromUser) tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }

  const EQ = '<span class="eqsign">=</span>';
  const focusedMatches = (sel) => { const a = document.activeElement; return !!(a && a.matches && a.matches(sel)); };

  /* ================= attempt tracking (feeds the coach report) ================= */
  const QUICK_MS = 3500;
  const KIND = {
    drop: 'Wrote only the bottom number',
    diff: 'Divided top and bottom by different numbers',
    topOnly: 'Divided only the top',
    bottomOnly: 'Divided only the bottom',
    early: 'Stopped before it was fully simplified',
    subtract: 'Subtracted instead of dividing',
    zero: 'Wrote 0 where a 1 belongs',
    leftover: "Didn't simplify the leftover fraction",
    wrongDen: 'Put the leftover over the wrong bottom number',
    improper: "Didn't change it to a mixed number",
    wholes: 'Miscounted the wholes or the remainder',
    notFactor: "Used a number that doesn't divide evenly",
    notGreatest: "Used a common factor that wasn't the greatest",
    notPrime: "Called a number prime when it isn't",
    arith: 'Multiplication or division slip',
    one: 'Tried to use 1 as a factor',
    mismatch: 'Tried to cancel two different primes',
    compare: 'Misjudged more, less, or the same',
    label: 'Named the wrong mistake (detective)',
    partWhole: 'Story: used one part as the whole',
    complement: 'Story: answered for the wrong part',
    other: 'Other wrong answer',
  };
  const Track = {
    bucket(st) {
      if (!Store.data.stats || typeof Store.data.stats !== 'object' || Array.isArray(Store.data.stats)) Store.data.stats = {};
      const S = Store.data.stats;
      const b = S[st];
      if (!b || typeof b !== 'object' || Array.isArray(b)) S[st] = { items: 0, clean: 0, wrong: 0, quick: 0, guided: 0, kinds: {} };
      else {
        ['items', 'clean', 'wrong', 'quick', 'guided'].forEach((k) => { if (!Number.isFinite(b[k])) b[k] = 0; });
        if (!b.kinds || typeof b.kinds !== 'object' || Array.isArray(b.kinds)) b.kinds = {};
      }
      return S[st];
    },
    attempt(st, { ok, kind, quick }) {
      if (!st || ok) return;
      const b = this.bucket(st);
      b.wrong += 1;
      if (quick) b.quick += 1;
      if (kind) b.kinds[kind] = (b.kinds[kind] || 0) + 1;
      Store.save();
    },
    item(st, clean) { const b = this.bucket(st); b.items += 1; if (clean) b.clean += 1; Store.save(); },
    guided(st) { this.bucket(st).guided += 1; Store.save(); },
  };

  /* ================= number inputs + on-screen keypad ================= */
  const TOUCH = window.matchMedia('(pointer: coarse)').matches;
  const KP_MODE = TOUCH ? 'none' : 'numeric';
  let booted = false;
  const numInput = (k, label, extraCls = '') => `<input class="mini kp ${extraCls}" data-k="${k}" inputmode="${KP_MODE}" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="${label}">`;

  const Keypad = {
    el: null, target: null,
    init() {
      this.el = $('#keypad');
      this.el.addEventListener('pointerdown', (e) => e.preventDefault());
      this.el.addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b) this.press(b.dataset.k); });
      document.addEventListener('focusin', (e) => {
        const t = e.target;
        if (TOUCH && t && t.matches && t.matches('input.kp') && !t.readOnly) { this.target = t; this.show(); }
      });
      document.addEventListener('focusout', () => {
        window.setTimeout(() => {
          const a = document.activeElement;
          if (!(a && a.matches && a.matches('input.kp'))) this.hide();
        }, 140);
      });
    },
    show() {
      this.el.classList.add('on');
      this.el.setAttribute('aria-hidden', 'false');
      document.body.classList.add('kp-on');
      window.requestAnimationFrame(() => this.reveal());
    },
    hide() {
      this.el.classList.remove('on');
      this.el.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('kp-on');
      this.target = null;
    },
    reveal() {
      const t = this.target;
      if (!t) return;
      const box = t.closest('.ask') || t.closest('.kp-group') || t;
      const r = box.getBoundingClientRect(), ti = t.getBoundingClientRect();
      const kh = this.el.getBoundingClientRect().height || 96;
      const limit = window.innerHeight - kh - 16;
      if (r.bottom <= limit && ti.top >= 8) return;
      // Bring the whole prompt above the keypad, but never push the focused box off the top.
      let dy = r.bottom - limit;
      dy = Math.min(dy, ti.top - 12);
      if (ti.top < 8) dy = ti.top - 24;
      if (Math.abs(dy) > 2) window.scrollBy({ top: dy, behavior: reduced ? 'auto' : 'smooth' });
    },
    press(k) {
      const t = this.target;
      if (!t || t.readOnly) return;
      if (/^\d$/.test(k)) {
        if (t.value.length < 3) { t.value += k; t.dispatchEvent(new Event('input', { bubbles: true })); }
      } else if (k === 'del') {
        t.value = t.value.slice(0, -1);
        t.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (k === 'next') {
        const group = t.closest('.kp-group') || document;
        const list = $$('input.kp', group).filter((i) => !i.readOnly && !i.disabled && i.offsetParent !== null);
        const nx = list[(list.indexOf(t) + 1) % list.length];
        if (nx) nx.focus({ preventScroll: true });
      } else if (k === 'enter') {
        t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
    },
  };

  /* ================= "show your work" prompt =================
     tpl tokens: [[k]] or [[k:label]] number box, [[frac:a,b]] stacked fraction, [[mixed:w,a,b]] mixed number. */
  function renderTpl(tpl) {
    return tpl
      .replace(/\[\[mixed:(\w+),(\w+),(\w+)\]\]/g, (_, w, a, b) => `<span class="ask-mixed"><span class="ask-w">${numInput(w, 'Whole number, leave empty if none', 'tall')}<small>whole</small></span><span class="mini-frac">${numInput(a, 'Top number')}<i></i>${numInput(b, 'Bottom number')}</span></span>`)
      .replace(/\[\[frac:(\w+),(\w+)\]\]/g, (_, a, b) => `<span class="mini-frac">${numInput(a, 'Top number')}<i></i>${numInput(b, 'Bottom number')}</span>`)
      .replace(/\[\[(\w+)(?::([^\]]+))?\]\]/g, (_, k, label) => numInput(k, label || 'Answer'));
  }
  function ask(host, spec) {
    const { tpl, check, onOk, st, button = 'Check', extra = [], help, lead = '', focus = true } = spec;
    const wrap = document.createElement('div');
    wrap.className = 'ask kp-group';
    wrap.innerHTML = `${lead ? `<p class="ask-lead">${lead}</p>` : ''}<div class="ask-q">${renderTpl(tpl)}</div><div class="ask-btns"><button type="button" class="btn primary ask-go">${button}</button>${extra.map((x, i) => `<button type="button" class="btn ask-x" data-x="${i}">${x.label}</button>`).join('')}</div><div class="ask-help" hidden></div><p class="note ask-note" aria-live="polite"></p>`;
    host.appendChild(wrap);
    const inputs = $$('input.kp', wrap);
    inputs.forEach(digitsOnly);
    const noteEl = $('.ask-note', wrap);
    const state = { tries: 0, done: false, t0: performance.now(), el: wrap, noteEl };
    wrap._ask = state;
    state.finish = (msg, sound = 'good') => {
      state.done = true;
      wrap.classList.add('done');
      inputs.forEach((i) => { i.readOnly = true; i.tabIndex = -1; i.classList.toggle('empty', i.value.trim() === ''); });
      if (inputs.length && inputs.every((i) => i.value.trim() === '')) $('.ask-q', wrap).hidden = true;
      $$('button', wrap).forEach((b) => { b.disabled = true; });
      if (msg) note(noteEl, msg, 'good');
      if (sound) Sound.play(sound);
      Track.attempt(st, { ok: true });
      if (document.activeElement && wrap.contains(document.activeElement)) document.activeElement.blur();
    };
    state.fail = (res) => {
      state.tries += 1;
      const quick = performance.now() - state.t0 < QUICK_MS;
      Track.attempt(st, { ok: false, kind: res.kind || 'other', quick });
      const slow = quick ? ' <span class="slow">That was quick. Take a moment and work it out.</span>' : '';
      note(noteEl, `${res.msg}${slow}`, 'bad');
      shake($('.ask-q', wrap));
      Sound.play('bad');
      if (help && state.tries >= 2) { const h = $('.ask-help', wrap); if (h.hidden) { h.innerHTML = help(); h.hidden = false; } }
      if (res.after) res.after(state);
      state.t0 = performance.now();
    };
    const go = () => {
      if (state.done) return;
      const vals = {};
      inputs.forEach((i) => { vals[i.dataset.k] = i.value.trim() === '' ? null : parseInt(i.value, 10); });
      if (inputs.length && Object.values(vals).every((v) => v == null)) { note(noteEl, 'Type your answer first.', 'bad'); return; }
      const res = check(vals) || {};
      if (res.invalid) { note(noteEl, res.msg, 'bad'); return; }
      if (res.ok) { state.finish(res.msg || 'Yes!', res.sound === undefined ? 'good' : res.sound); if (onOk) onOk(vals, state); }
      else state.fail(res);
    };
    $('.ask-go', wrap).addEventListener('click', go);
    inputs.forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } }));
    extra.forEach((x, i) => $(`.ask-x[data-x="${i}"]`, wrap).addEventListener('click', () => { if (!state.done) x.onClick(state); }));
    if (focus && booted && inputs[0] && !wrap.closest('[hidden]')) {
      window.requestAnimationFrame(() => {
        wrap.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
        inputs[0].focus({ preventScroll: true });
      });
    }
    return state;
  }
  /** Turns whole/top/bottom box values into a value object, or an error for half-filled answers. */
  function toVal(v, wk, ak, bk) {
    const W = wk ? v[wk] : null, N = v[ak], D = v[bk];
    if ((N == null) !== (D == null)) return { err: 'Fill in both the top and the bottom of the fraction, or leave both empty for a whole number.' };
    if (D === 0) return { err: "The bottom can't be 0. It tells how many pieces make one whole." };
    if (N == null) return { val: { w: W || 0, n: 0, d: null } };
    return { val: { w: W || 0, n: N, d: D } };
  }

  /** Compares a final answer with n/d (simplest form, mixed number when needed) and names the misconception. */
  function diagnose(n, d, v) {
    const t = simplest(n, d), G = gcd(n, d), a = n / G, b = d / G;
    const W = v.w || 0, hasF = v.d != null, N = hasF ? v.n : 0, D = hasF ? v.d : 1;
    if (t.d == null && W === t.w && (!hasF || N === 0)) return { ok: true, tip: hasF ? `(${frac(0, D)} is zero, so ${t.w} by itself is enough.)` : '' };
    if (t.d != null && hasF && W === t.w && N === t.n && D === t.d) return { ok: true };
    const equal = (W * D + N) * d === n * D;
    if (equal) {
      if (hasF && D === 1) return { kind: 'improper', msg: `Right amount! But ${frac(N, 1)} is just ${N}. Use the whole-number box.` };
      if (hasF && N >= D && W === 0) {
        const g2 = gcd(N, D);
        return { kind: 'improper', msg: `Right amount! But ${frac(N, D)} has a top bigger than the bottom, so write it as a mixed number${g2 > 1 ? ` (and ${N} and ${D} still share ${g2})` : ''}. How many whole groups of ${D} fit in ${N}?` };
      }
      if (hasF && N >= D) return { kind: 'improper', msg: `Right amount, but the leftover ${frac(N, D)} is a whole or more. Move the wholes over to the whole-number part.` };
      if (hasF && gcd(N, D) > 1) {
        return W > 0
          ? { kind: 'leftover', msg: `Right amount, but simplify the leftover too: ${N} and ${D} can both be divided by ${gcd(N, D)}.` }
          : { kind: 'early', msg: `Same amount, but not done yet: ${N} and ${D} can both still be divided by ${gcd(N, D)}.` };
      }
      return { kind: 'other', msg: "That's the right amount, but not the simplest way to write it." };
    }
    if (!hasF && W > 0 && n < d) {
      if (d % W === 0 && n % (d / W) === 0) return { kind: 'drop', msg: `It looks like only the bottom number got written down. ${frac(n, d)} is less than one whole, but ${W} means ${W} whole bars! A fraction needs a top and a bottom.` };
      return { kind: 'drop', msg: `${W} is a whole number, but ${frac(n, d)} is less than one whole. Your answer needs a top and a bottom.` };
    }
    if (hasF && W === 0) {
      if (N === 0) return { kind: 'zero', msg: '0 on top means nothing at all. When everything on top cancels, 1 is left, not 0.' };
      if (N === n && D !== d && d % D === 0) return { kind: 'bottomOnly', msg: `You divided the bottom by ${d / D}, but the top is still ${n}. Divide the top by ${d / D} too.` };
      if (D === d && N !== n && n % N === 0) return { kind: 'topOnly', msg: `You divided the top by ${n / N}, but the bottom is still ${d}. Divide the bottom by ${n / N} too.` };
      if (n % N === 0 && d % D === 0 && n / N !== d / D) return { kind: 'diff', msg: `It looks like the top was divided by ${n / N} but the bottom by ${d / D}. Both have to be divided by the same number.` };
      if (n - N === d - D && n - N > 0) return { kind: 'subtract', msg: `It looks like ${n - N} was taken away from the top and the bottom. Subtracting changes the amount. Divide instead.` };
    }
    if (t.d != null && t.w > 0) {
      if (W === t.w && hasF && N === t.n && D !== t.d) return { kind: 'wrongDen', msg: `Your whole number is right! The leftover pieces are still ${pieceName(t.d)}, so the bottom stays ${t.d}.` };
      if (W !== t.w) return { kind: 'wholes', msg: `Check the number of wholes. ${G > 1 ? `Simplify first (${frac(n, d)} = ${frac(a, b)}), then ask` : 'Ask'}: how many whole groups of ${b} fit into ${a}?` };
    }
    if (t.d == null && W !== t.w) return { kind: 'wholes', msg: `Not quite. How many groups of ${d} fit into ${n}?` };
    return { kind: 'other', msg: `That's not the same amount as ${frac(n, d)}. Look for a number that goes into both ${n} and ${d}, and divide both by it.` };
  }

  /** Checks a fraction step whose target is n/d in lowest terms (top may be bigger than the bottom). */
  function diagFrac(n, d, N, D) {
    const G = gcd(n, d), a = n / G, b = d / G;
    if (N === a && D === b) return { ok: true };
    if (N * d === n * D) return { kind: 'early', msg: `Same amount, but ${N} and ${D} still share ${gcd(N, D)}. Keep going.` };
    if (N === 0) return { kind: 'zero', msg: '0 on top means nothing at all. When everything on top cancels, 1 is left, not 0.' };
    if (N === n && D !== d && d % D === 0) return { kind: 'bottomOnly', msg: `You divided the bottom by ${d / D}, but the top is still ${n}. Divide the top by ${d / D} too.` };
    if (D === d && N !== n && n % N === 0) return { kind: 'topOnly', msg: `You divided the top by ${n / N}, but the bottom is still ${d}. Divide the bottom too.` };
    if (n % N === 0 && d % D === 0 && n / N !== d / D) return { kind: 'diff', msg: `The top was divided by ${n / N} but the bottom by ${d / D}. Use the same number for both.` };
    if (n - N === d - D && n - N > 0) return { kind: 'subtract', msg: `It looks like ${n - N} was taken away from both. Subtracting changes the amount. Divide instead.` };
    return { kind: 'other', msg: `That's not the same amount as ${frac(n, d)}. Divide the top and the bottom by the same number.` };
  }
  const checkFinal = (n, d) => (v) => {
    const t = toVal(v, 'w', 'a', 'b');
    if (t.err) return { invalid: true, msg: t.err };
    const r = diagnose(n, d, t.val);
    return r.ok ? { ok: true, msg: `Yes! ${frac(n, d)} = ${showVal(simplest(n, d))}.${r.tip ? ` ${r.tip}` : ''}` } : r;
  };
  const checkFrac = (n, d, msgOk) => (v) => {
    if (v.a == null || v.b == null) return { invalid: true, msg: 'Fill in the top and the bottom.' };
    if (v.b === 0) return { invalid: true, msg: "The bottom can't be 0." };
    const r = diagFrac(n, d, v.a, v.b);
    return r.ok ? { ok: true, msg: msgOk || 'Yes!' } : r;
  };

