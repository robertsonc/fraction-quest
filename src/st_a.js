
  const EQ2 = EQ;
  const setBlocked = (st, on) => {
    st.el.classList.toggle('blocked', on);
    $$('input, button', st.el).forEach((x) => { x.disabled = on; });
    if (!on) {
      const i = $('input', st.el);
      if (i) { i.value = ''; if (booted) i.focus({ preventScroll: true }); }
    }
  };
  const visible = (id) => !$(id).hidden;

  /* ================= fresh problems =================
     Every visit deals a new random set of 8 problems per station (no fixed list to memorize).
     Recently dealt problems are kept out of the next set. */
  const recent = [];
  const remember = (k) => { recent.push(k); if (recent.length > 60) recent.shift(); };
  function dealSet(gen, count = 8) {
    const out = [], seen = new Set();
    for (let i = 0; i < 600 && out.length < count; i++) {
      const p = gen(), k = `${p[0]}/${p[1]}`;
      if (seen.has(k) || (i < 450 && recent.includes(k))) continue;
      seen.add(k); out.push(p);
    }
    out.forEach((p) => remember(`${p[0]}/${p[1]}`));
    return out;
  }
  const coprime = (a, b) => gcd(a, b) === 1;
  const GEN = {
    /** Bigger pieces: whole bar of 4 to 20 pieces; about 1 in 9 already simplest (so the "It's simplest" button gets practice); some more than one whole. */
    pieces() {
      for (let i = 0; i < 300; i++) {
        const d = rand(4, 20), improper = Math.random() < 0.2;
        const n = improper ? rand(d + 1, 2 * d) : rand(1, d - 1);
        if (improper && n % d === 0) continue;
        if (gcd(n, d) === 1 && Math.random() < 0.94) continue;
        return [n, d];
      }
      return [9, 12];
    },
    /** Golden rule: proper, simplifiable, top at least 2 pieces' worth so "take away" never hits 0, bottom up to 30. */
    rule() {
      for (let i = 0; i < 300; i++) {
        const b = rand(3, 10), a = rand(2, b - 1), G = rand(2, Math.floor(30 / b));
        if (G < 2 || !coprime(a, b)) continue;
        return [a * G, b * G];
      }
      return [9, 12];
    },
    /** Factor rainbows: two different numbers up to 40, usually sharing a factor bigger than 1. */
    rainbow() {
      for (let i = 0; i < 300; i++) {
        const d = rand(8, 40), n = rand(4, d - 1);
        if (gcd(n, d) === 1 && Math.random() < 0.9) continue;
        return [n, d];
      }
      return [12, 18];
    },
    /** Prime trees: always something to cancel; sometimes the whole top cancels (a lesson in 1, not 0); some improper. */
    primes() {
      for (let i = 0; i < 300; i++) {
        const b = rand(2, 9), improper = Math.random() < 0.2;
        const a = improper ? rand(b + 1, 2 * b) : rand(1, b - 1), k = rand(2, 12);
        if (!coprime(a, b)) continue;
        const n = a * k, d = b * k;
        if (n < 2 || n > 72 || d > 72) continue;
        return [n, d];
      }
      return [12, 18];
    },
    /** Wholes and leftovers: more than one whole, bottom 2 to 10, at most 5 wholes; whole-number answers are rare. */
    wholes() {
      for (let i = 0; i < 300; i++) {
        const d = rand(2, 10), n = rand(d + 1, Math.min(72, 5 * d));
        if (n % d === 0 && Math.random() < 0.75) continue;
        return [n, d];
      }
      return [18, 8];
    },
  };
  /** Gives a station a dealt row of chips, a "New set" button, and nextUp() for the "Next problem" button. */
  function useDeck(mod, id, gen) {
    const row = $(`#${id}-presets`);
    const pick = (n, d) => { mod.deckI = mod.deck.findIndex((p) => p[0] === n && p[1] === d); mod.set(n, d); };
    mod.newSet = (load = true) => {
      mod.deck = dealSet(gen);
      mod.deckI = 0;
      presetChips(row, mod.deck, pick);
      if (load) mod.set(...mod.deck[0]);
    };
    mod.nextUp = () => {
      mod.deckI += 1;
      if (mod.deckI >= mod.deck.length) mod.newSet();
      else mod.set(...mod.deck[mod.deckI]);
    };
    const sh = document.createElement('button');
    sh.type = 'button';
    sh.className = 'chip shuffle';
    sh.textContent = 'New set';
    sh.addEventListener('click', () => { Sound.play('tick'); mod.newSet(); });
    row.after(sh);
    mod.newSet();
  }
  function nextBtn(host, mod) {
    const nb = document.createElement('div');
    nb.className = 'ask-btns';
    nb.innerHTML = '<button type="button" class="btn primary">Next problem</button>';
    host.appendChild(nb);
    const b = $('button', nb);
    b.addEventListener('click', () => { Sound.play('tick'); mod.nextUp(); });
    if (booted) b.focus({ preventScroll: true });
  }

  /* ================= hero: a random fraction snaps into simplest form ================= */
  const Hero = {
    EXAMPLES: [[9, 12], [6, 8], [10, 15], [8, 12], [12, 16], [4, 6], [6, 9], [10, 12], [8, 10], [6, 12], [15, 20], [9, 15], [12, 18], [4, 10], [14, 16], [16, 20]],
    init() {
      this.tray = new Tray($('#hero-svg'), { top: 6, trayH: 58, gap: 10, pad: 4, minW: 240 });
      $('#hero-replay').addEventListener('click', () => { Sound.play('tick'); this.play(true); });
      this.play(false);
    },
    eq(snapped) {
      const { n, d } = this, g = gcd(n, d);
      $('#hero-eq').innerHTML = snapped ? `${frac(n, d)}${ops(`÷ ${g}`, `÷ ${g}`)}${frac(n / g, d / g)}` : frac(n, d);
    },
    play(user) {
      window.clearTimeout(this.t);
      let p;
      do { p = this.EXAMPLES[rand(0, this.EXAMPLES.length - 1)]; } while (this.n === p[0] && this.d === p[1]);
      [this.n, this.d] = p;
      this.snapped = false;
      this.tray.draw(this.n, this.d);
      this.eq(false);
      this.t = window.setTimeout(() => {
        this.tray.chunk(gcd(this.n, this.d), true);
        this.snapped = true;
        this.eq(true);
        if (user) Sound.play('snap');
      }, reduced ? 250 : 1200);
    },
    redraw() { this.tray.draw(this.n, this.d); if (this.snapped) this.tray.chunk(gcd(this.n, this.d), false); },
  };

  /* ================= 1. Bigger pieces ================= */
  const S1 = {
    tok: 0,
    init() {
      this.tray = new Tray($('#s1-svg'), { top: 24, trayH: 66, gap: 16 });
      bindCustom('s1', (n, d) => {
        const max = Tray.maxPieces($('#s1-svg'));
        if (n < 1 || d < 2) return 'Use a top of 1 or more and a bottom of 2 or more.';
        if (d > max) return `This screen fits up to ${max} pieces in one whole bar. For bigger numbers, use Factor rainbows or Prime trees.`;
        if (n > 3 * d) return 'Keep it to 3 wholes or fewer (the top can be up to 3 times the bottom).';
        return '';
      }, (n, d) => this.set(n, d));
      useDeck(this, 's1', GEN.pieces);
    },
    set(n, d) {
      this.tok += 1;
      Object.assign(this, { n0: n, d0: d, n, d, hist: [], asks: [], over: false });
      markPreset($('#s1-presets'), n, d);
      if (visible('#st-pieces')) this.tray.draw(n, d);
      this.renderEq();
      $('#s1-work').innerHTML = '';
      const wholes = n > d ? ` That's more than one whole, so it fills ${Math.ceil(n / d)} bars.` : '';
      note('#s1-note', `${frac(n, d)} means ${n} piece${n > 1 ? 's' : ''}, and ${d} pieces make one whole bar.${wholes} Snap the pieces into bigger chunks. A chunk size only works if it splits the shaded pieces <b>and</b> each whole bar evenly.`);
      this.chunkPrompt();
    },
    onShow() {
      this.tray.draw(this.n, this.d);
    },
    renderEq() {
      let h = frac(this.n0, this.d0);
      let { n0: n, d0: d } = this;
      for (const s of this.hist) { n /= s.g; d /= s.g; h += `${ops(`÷ ${s.g}`, `÷ ${s.g}`)}${frac(n, d)}`; }
      $('#s1-eq').innerHTML = h;
    },
    chunkPrompt() {
      const { n, d } = this;
      const a = ask($('#s1-work'), {
        st: 'pieces',
        lead: this.hist.length ? `Now it's ${frac(n, d)}. Snap again, or is it in simplest form?` : `What chunk size fits ${frac(n, d)}?`,
        tpl: 'Chunks of [[g:Chunk size]] pieces',
        button: 'Snap',
        check: (v) => this.checkChunk(v.g),
        onOk: (v) => this.predict(v.g),
        extra: [{ label: "It's simplest", onClick: (st) => this.claimSimplest(st) }],
      });
      this.asks.push(a);
    },
    checkChunk(g) {
      const { n, d } = this;
      if (g < 2) return { kind: 'one', msg: 'A chunk has to be at least 2 pieces. Chunks of 1 change nothing.' };
      if (g > d) return { kind: 'notFactor', msg: `One whole bar only has ${d} pieces, so a chunk can't be ${g}.` };
      if (d % g !== 0) return { kind: 'notFactor', msg: `Chunks of ${g} don't split a whole bar of ${d} pieces evenly.`, after: (st) => this.proof(d, g, st) };
      if (n % g !== 0) {
        this.tray.outline(g);
        return { kind: 'notFactor', msg: `Look at the bar: one chunk is part shaded and part empty. Chunks of ${g} don't fit the ${n} shaded pieces.`, after: (st) => this.proof(n, g, st) };
      }
      this.tray.outline(g);
      return { ok: true, msg: `Chunks of ${g} fit both ${n} and ${d}.`, sound: 'snap' };
    },
    proof(num, g, chunkAsk) {
      setBlocked(chunkAsk, true);
      const q = Math.floor(num / g), r = num % g;
      const pa = ask($('#s1-work'), {
        st: 'pieces',
        lead: `Prove it: how many groups of ${g} fit into ${num}, and how many are left over?`,
        tpl: `${num} ÷ ${g} = [[q:Groups]] remainder [[r:Left over]]`,
        check: (v) => {
          if (v.q == null || v.r == null) return { invalid: true, msg: 'Fill in both boxes.' };
          if (v.q === q && v.r === r) return { ok: true, msg: `Right. ${g} × ${q} = ${g * q}, with ${r} left over. A leftover means ${g} doesn't fit evenly.`, sound: 'tick' };
          if (v.q === q) return { kind: 'arith', msg: `${g} × ${q} = ${g * q}. How much more do you need to get to ${num}?` };
          return { kind: 'arith', msg: `${g} × ${v.q} = ${g * v.q}. How many groups of ${g} fit into ${num} without going over?` };
        },
        onOk: () => setBlocked(chunkAsk, false),
      });
      this.asks.push(pa);
    },
    predict(g) {
      const { n, d } = this, a = n / g, b = d / g;
      const pa = ask($('#s1-work'), {
        st: 'pieces',
        lead: 'Before it snaps: count the chunks. What fraction will it be?',
        tpl: '[[frac:a,b]]',
        help: () => `Top: how many chunks are fully shaded? Bottom: how many chunks make <b>one</b> whole bar? Or divide both ${n} and ${d} by ${g}.`,
        check: (v) => {
          if (v.a == null || v.b == null) return { invalid: true, msg: 'Fill in the top and the bottom.' };
          if (v.a === a && v.b === b) return { ok: true, msg: `Yes! ${n} ÷ ${g} = ${a} and ${d} ÷ ${g} = ${b}. Watch it snap.`, sound: false };
          if (v.a === a) return { kind: 'topOnly', msg: 'The top is right. The bottom is how many chunks make one whole bar.' };
          if (v.b === b) return { kind: 'bottomOnly', msg: 'The bottom is right. The top is how many chunks are shaded, not how many pieces.' };
          return { kind: 'other', msg: 'Not quite. Top = shaded chunks. Bottom = chunks in one whole bar.' };
        },
        onOk: () => this.snap(g),
      });
      this.asks.push(pa);
    },
    snap(g) {
      this.tray.chunk(g, true);
      Sound.play('snap');
      this.hist.push({ g });
      this.n /= g; this.d /= g;
      this.renderEq();
      const tok = this.tok;
      window.setTimeout(() => { if (tok === this.tok && visible('#st-pieces')) this.tray.draw(this.n, this.d); }, reduced ? 0 : 950);
      this.chunkPrompt();
    },
    claimSimplest(st) {
      const { n, d } = this;
      if (gcd(n, d) === 1) {
        st.finish(`Yes! No chunk bigger than 1 fits both ${n} and ${d}.`);
        this.done();
      } else {
        st.fail({ kind: 'early', msg: `Not yet. There's a chunk size bigger than 1 that fits both ${n} and ${d}.` });
      }
    },
    done() {
      const clean = this.asks.every((a) => a.tries === 0);
      const t = simplest(this.n0, this.d0);
      let msg = `${frac(this.n0, this.d0)} = ${frac(this.n, this.d)}. Same amount, bigger pieces!`;
      if (this.d === 1) msg += ` That's just ${this.n}.`;
      else if (this.n > this.d) msg += ` As a mixed number that's ${showVal(t)}.`;
      msg += clean ? ' No misses!' : ' Now try one with no misses to fill the meter.';
      note('#s1-note', msg, 'good');
      finishItem('pieces', `${this.n0}/${this.d0}`, clean, 2);
      nextBtn($('#s1-work'), this);
    },
  };

  /* ================= 2. The golden rule ================= */
  const S2 = {
    init() {
      $('#s2-scen').addEventListener('click', (e) => { const b = e.target.closest('button[data-s]'); if (b) { Sound.play('tick'); this.scenario(b.dataset.s); } });
      $('#s2-work').addEventListener('click', (e) => { const b = e.target.closest('button[data-cmp]'); if (b) this.compare(b.dataset.cmp, b); });
      useDeck(this, 's2', GEN.rule);
    },
    set(n, d) {
      this.n = n; this.d = d; this.active = ''; this.res = null;
      markPreset($('#s2-presets'), n, d);
      this.renderScen();
      $('#s2-work').innerHTML = '';
      $('#s2-eq').innerHTML = frac(n, d);
      $('#s2-linewrap').hidden = true;
      note('#s2-note', `Pick a "try this" button. Work out the answer and predict what happens to the amount <b>before</b> you get to see it.`);
      const G = gcd(n, d);
      $('#s2-why').innerHTML = `<strong>Why does the golden rule work?</strong> Dividing the top and the bottom by ${G} is the same as dividing by ${frac(G, G)}. And ${frac(G, G)} is exactly one whole. Dividing by 1 never changes a number, so the amount stays exactly the same.`;
    },
    onShow() { if (this.res && this.revealed) this.drawLine(); },
    scenarios() {
      const { n, d } = this, G = gcd(n, d);
      return [
        { id: 'same', label: `Divide both by ${G}`, desc: `Divide the top by ${G} and the bottom by ${G}.`, t: G, b: G },
        { id: 'diff', label: `Top ÷ ${n}, bottom ÷ ${G}`, desc: `Divide the top by ${n} and the bottom by ${G}.`, t: n, b: G },
        { id: 'one', label: 'Divide only the bottom', desc: `Divide only the bottom by ${G}. Leave the top alone.`, t: 1, b: G },
        { id: 'drop', label: 'Write only the bottom number', desc: `Divide the bottom by ${G}, then write only that number.`, mode: 'drop' },
        { id: 'subtract', label: `Take ${G} away from both`, desc: `Take ${G} away from the top and from the bottom.`, mode: 'subtract' },
      ];
    },
    renderScen() {
      $('#s2-scen').innerHTML = this.scenarios().map((s) => {
        const done = Store.has('rule', s.id);
        return `<button type="button" class="chip wide" data-s="${s.id}" aria-pressed="${this.active === s.id}">${s.label}${done ? '<span class="mk" aria-hidden="true"> ✓</span><span class="sr"> (done)</span>' : ''}</button>`;
      }).join('');
    },
    result(s) {
      const { n, d } = this, G = gcd(n, d);
      if (s.mode === 'drop') return { op: [`<span class="x">✗</span>`, `÷ ${G}`], v: { w: d / G, n: 0, d: null } };
      if (s.mode === 'subtract') return { op: [`− ${G}`, `− ${G}`], v: { w: 0, n: n - G, d: d - G } };
      return { op: [`÷ ${s.t}`, `÷ ${s.b}`], v: { w: 0, n: n / s.t, d: d / s.b } };
    },
    scenario(id) {
      const s = this.scenarios().find((x) => x.id === id);
      if (!s) return;
      const { n, d } = this;
      this.active = id; this.s = s; this.res = this.result(s); this.revealed = false; this.miss = 0;
      this.renderScen();
      $('#s2-linewrap').hidden = true;
      $('#s2-work').innerHTML = '';
      $('#s2-eq').innerHTML = `${frac(n, d)}${ops(this.res.op[0], this.res.op[1], '?')}<span class="qbox">?</span>`;
      note('#s2-note', s.desc);
      const v = this.res.v;
      this.a1 = ask($('#s2-work'), {
        st: 'rule',
        lead: `${s.desc} What do you get?`,
        tpl: s.mode === 'drop' ? 'The number left: [[w:Answer]]' : '[[frac:a,b]]',
        check: (x) => {
          if (s.mode === 'drop') return x.w === v.w ? { ok: true, msg: `Yes, ${d} ÷ ${gcd(n, d)} = ${v.w}.`, sound: 'tick' } : { kind: 'arith', msg: `What is ${d} ÷ ${gcd(n, d)}?` };
          if (x.a == null || x.b == null) return { invalid: true, msg: 'Fill in the top and the bottom.' };
          if (x.a === v.n && x.b === v.d) return { ok: true, msg: `Yes, that gives ${frac(v.n, v.d)}.`, sound: 'tick' };
          return { kind: 'arith', msg: `Do each part on its own: top ${n} ${this.res.op[0].replace(/<[^>]+>/g, '')}, bottom ${d} ${this.res.op[1]}.` };
        },
        onOk: () => this.comparePrompt(),
      });
    },
    comparePrompt() {
      const { n, d } = this;
      const box = document.createElement('div');
      box.className = 'ask';
      box.innerHTML = `<p class="ask-lead">Compared with ${frac(n, d)}, is ${showVal(this.res.v)} more, less, or the same amount?</p><div class="chips"><button type="button" class="chip wide" data-cmp="more">More</button><button type="button" class="chip wide" data-cmp="less">Less</button><button type="button" class="chip wide" data-cmp="same">The same amount</button></div>`;
      $('#s2-work').appendChild(box);
    },
    compare(choice, btn) {
      if (this.revealed) return;
      const { n, d } = this, v = this.res.v, G = gcd(n, d);
      const val = valOf(v), start = n / d;
      const truth = Math.abs(val - start) < 1e-9 ? 'same' : (val > start ? 'more' : 'less');
      const right = choice === truth;
      if (!right) { this.miss += 1; Track.attempt('rule', { ok: false, kind: 'compare' }); }
      this.revealed = true;
      $$('button[data-cmp]', $('#s2-work')).forEach((b) => { b.disabled = true; if (b.dataset.cmp === truth) b.classList.add('good'); else if (b === btn) b.classList.add('bad'); });
      const same = truth === 'same';
      $('#s2-eq').innerHTML = `${frac(n, d)}${ops(this.res.op[0], this.res.op[1], same ? '=' : '≠', same ? '' : 'ne')}${showVal(v)}`;
      $('#s2-linewrap').hidden = false;
      this.drawLine();
      const dir = truth === 'more' ? 'more than you started with' : 'less than you started with';
      const startT = frac(n, d);
      const id = this.s.id;
      let html;
      if (id === 'same') html = `Same amount! Both were divided by ${G}, so ${startT} = ${showVal(v)}. That's the golden rule.`;
      else if (id === 'diff') html = `The amount changed! The top was divided by ${n} but the bottom by ${G}, so ${showVal(v)} is ${dir}.`;
      else if (id === 'one') html = `Only the bottom was divided. Each piece got bigger, but you kept all ${n} of them, so ${showVal(v)} is ${dir}.`;
      else if (id === 'drop') html = `Without a top, ${v.w} means ${v.w} whole bars! But ${startT} isn't even one whole. A fraction needs both numbers.`;
      else html = `Taking ${G} away from the top and the bottom changed the amount: ${showVal(v)} is ${dir}. Subtracting doesn't keep a fraction the same. Dividing does.`;
      note('#s2-note', `${right ? 'Good prediction! ' : 'Look at the number line. '}${html}`, right ? 'good' : 'bad');
      Sound.play(right ? 'good' : 'bad');
      const clean = right && this.a1.tries === 0;
      finishItem('rule', id, clean, 1);
      this.renderScen();
    },
    drawLine() {
      compareLine($('#s2-line'), [{ w: 0, n: this.n, d: this.d, tag: 'Start' }, { ...this.res.v, tag: 'After' }]);
    },
  };

  /* ================= 3. Factor rainbows (built by the student) ================= */
  const ARC = [1, 2, 3, 4, 5, 6, 8, 9, 10].map(tileColor);
  function drawRainbow(svg, X, found, opts = {}) {
    const f = divisors(X), k = f.length, W = Math.max(280, widthOf(svg));
    const r = W < 520 ? 16 : 19, left = r + 6, right = W - r - 6;
    const step = k > 1 ? (right - left) / (k - 1) : 0;
    const pairs = Math.floor(k / 2), hasMid = k % 2 === 1;
    const maxRy = 14 + Math.max(pairs, 1) * 13;
    const cy = maxRy + r + 20, H = cy + r + 6, top = cy - r - 2;
    const xs = f.map((_, i) => (k > 1 ? left + i * step : W / 2));
    let arcs = '';
    for (let i = 0; i < pairs; i++) {
      const j = k - 1 - i;
      if (!found.has(f[i]) || !found.has(f[j])) continue;
      const rx = (xs[j] - xs[i]) / 2, ry = 14 + (pairs - i) * 13;
      arcs += `<path class="arc grow" d="M ${f1(xs[i])} ${top} A ${f1(rx)} ${ry} 0 0 1 ${f1(xs[j])} ${top}" stroke="${ARC[i % ARC.length]}"><title>${f[i]} × ${f[j]} = ${X}</title></path>`;
    }
    if (hasMid) {
      const m = Math.floor(k / 2), x = xs[m];
      if (found.has(f[m])) arcs += `<path class="arc grow" d="M ${f1(x - 9)} ${top} A 10 13 0 1 1 ${f1(x + 9)} ${top}" stroke="${ARC[pairs % ARC.length]}"><title>${f[m]} × ${f[m]} = ${X}</title></path>`;
    }
    let dots = '';
    f.forEach((v, i) => {
      const x = xs[i];
      if (!found.has(v)) { dots += `<circle class="fac-empty" cx="${f1(x)}" cy="${cy}" r="${r}"/>`; return; }
      const common = opts.common && opts.common.has(v), isG = opts.G === v;
      const b = cy - r - 4;
      const crown = isG ? `<path class="crown" d="M ${f1(x - 11)} ${b} L ${f1(x - 13)} ${b - 12} L ${f1(x - 6)} ${b - 6} L ${f1(x)} ${b - 15} L ${f1(x + 6)} ${b - 6} L ${f1(x + 13)} ${b - 12} L ${f1(x + 11)} ${b} Z"/>` : '';
      dots += `<g class="fac ${common ? 'found' : ''} ${isG ? 'gcf' : ''}"><circle cx="${f1(x)}" cy="${cy}" r="${r}"/><text x="${f1(x)}" y="${cy}">${v}</text>${crown}</g>`;
    });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', String(H));
    svg.innerHTML = arcs + dots;
  }

  const S3 = {
    tok: 0,
    init() {
      bindCustom('s3', (n, d) => (n < 2 || d < 2 || n > 60 || d > 60 ? 'Use numbers from 2 to 60.' : (n === d ? 'Pick two different numbers.' : '')), (n, d) => this.set(n, d));
      useDeck(this, 's3', GEN.rainbow);
    },
    set(n, d) {
      this.tok += 1;
      Object.assign(this, { n, d, G: gcd(n, d), asks: [], phase: 'build', found: { top: new Set([1, n]), bot: new Set([1, d]) }, which: 'top', k: 2 });
      markPreset($('#s3-presets'), n, d);
      $('#s3-lt').textContent = `Factors of ${n} (the top)`;
      $('#s3-lb').textContent = `Factors of ${d} (the bottom)`;
      $('#s3-pt').textContent = ''; $('#s3-pb').textContent = '';
      $('#s3-eq').innerHTML = '';
      $('#s3-work').innerHTML = '';
      this.draw();
      note('#s3-note', `Build both rainbows by finding factor pairs. Every number is 1 × itself, so those are already in. Start testing at 2.`);
      this.prompt();
    },
    onShow() { this.draw(); },
    X() { return this.which === 'top' ? this.n : this.d; },
    draw() {
      const done = this.phase === 'gcf-done' || this.phase === 'done';
      const common = done ? new Set(divisors(this.G)) : null;
      drawRainbow($('#s3-top'), this.n, this.found.top, { common, G: done ? this.G : null });
      drawRainbow($('#s3-bot'), this.d, this.found.bot, { common, G: done ? this.G : null });
    },
    prompt() {
      const X = this.X(), k = this.k, tok = this.tok;
      if (k * k > X) { this.complete(); return; }
      const a = ask($('#s3-work'), {
        st: 'rainbow',
        lead: `Does ${k} go into ${X} evenly?`,
        tpl: `${X} = ${k} × [[p:Partner]]`,
        button: 'It fits',
        check: (v) => {
          if (X % k === 0 && v.p === X / k) return { ok: true, msg: `Yes! ${k} × ${v.p} = ${X}.`, sound: 'snap' };
          if (X % k === 0) return { kind: 'arith', msg: `${k} × ${v.p} = ${k * v.p}, not ${X}. Try another partner.` };
          return { kind: 'notFactor', msg: `${k} × ${v.p} = ${k * v.p}, not ${X}. Is there any whole number that works?` };
        },
        onOk: (v) => { if (tok !== this.tok) return; this.found[this.which].add(k).add(v.p); this.draw(); this.k += 1; this.prompt(); },
        extra: [{ label: `${k} doesn't fit`, onClick: (st) => this.noFit(st, X, k, tok) }],
      });
      this.asks.push(a);
    },
    noFit(st, X, k, tok) {
      if (X % k === 0) { st.fail({ kind: 'notFactor', msg: `Check again: ${k} goes into ${X} with nothing left over. It fits!` }); return; }
      st.finish(null, 'tick');
      const q = Math.floor(X / k), r = X % k;
      const pa = ask($('#s3-work'), {
        st: 'rainbow',
        lead: `Prove it: ${X} ÷ ${k} leaves something over.`,
        tpl: `${X} ÷ ${k} = [[q:Groups]] remainder [[r:Left over]]`,
        check: (v) => {
          if (v.q == null || v.r == null) return { invalid: true, msg: 'Fill in both boxes.' };
          if (v.q === q && v.r === r) return { ok: true, msg: `Right, ${r} left over, so ${k} is not a factor.`, sound: 'tick' };
          if (v.q === q) return { kind: 'arith', msg: `${k} × ${q} = ${k * q}. How far is that from ${X}?` };
          return { kind: 'arith', msg: `${k} × ${v.q} = ${k * v.q}. How many groups of ${k} fit into ${X} without going over?` };
        },
        onOk: () => { if (tok !== this.tok) return; this.k += 1; this.prompt(); },
      });
      this.asks.push(pa);
    },
    complete() {
      const X = this.X(), k = this.k;
      const list = divisors(X).join(', ');
      const pairs = [];
      const f = divisors(X);
      for (let i = 0; i < Math.ceil(f.length / 2); i++) pairs.push(`${f[i]} × ${f[f.length - 1 - i]}`);
      $(this.which === 'top' ? '#s3-pt' : '#s3-pb').textContent = `Factor pairs: ${pairs.join(', ')}`;
      note('#s3-note', `Rainbow done! ${k} × ${k} = ${k * k}, which is bigger than ${X}, so you've reached the middle and found every factor: ${list}.`, 'good');
      Sound.play('good');
      if (this.which === 'top') { this.which = 'bot'; this.k = 2; this.prompt(); return; }
      this.gcfPrompt();
    },
    gcfPrompt() {
      const { n, d, G, tok } = this;
      const a = ask($('#s3-work'), {
        st: 'rainbow',
        lead: 'Both rainbows are built. Which numbers show up in both? Type the greatest one.',
        tpl: `Greatest common factor of ${n} and ${d}: [[g:Greatest common factor]]`,
        check: (v) => {
          const g = v.g;
          if (g === G) return { ok: true, msg: `Yes! ${G} is the biggest number in both rainbows.` };
          if (g > 0 && n % g === 0 && d % g === 0) return { kind: 'notGreatest', msg: `${g} is in both rainbows, but there's a bigger one.` };
          const miss = n % g !== 0 ? n : d;
          return { kind: 'notFactor', msg: `${g} isn't in the rainbow for ${miss}.` };
        },
        onOk: () => { if (tok !== this.tok) return; this.phase = 'gcf-done'; this.draw(); this.simplifyPrompt(); },
      });
      this.asks.push(a);
    },
    simplifyPrompt() {
      const { n, d, G, tok } = this;
      const a = ask($('#s3-work'), {
        st: 'rainbow',
        lead: `Divide the top and the bottom by ${G}.`,
        tpl: `${frac(n, d)} = [[frac:a,b]]`,
        check: checkFrac(n, d, G === 1 ? `Right. The only common factor is 1, so ${frac(n, d)} was already simplest.` : `Yes! One jump to simplest form.`),
        onOk: () => {
          if (tok !== this.tok) return;
          this.phase = 'done';
          $('#s3-eq').innerHTML = G > 1 ? `${frac(n, d)}${ops(`÷ ${G}`, `÷ ${G}`)}${frac(n / G, d / G)}` : frac(n, d);
          const clean = this.asks.every((x) => x.tries === 0);
          note('#s3-note', `${frac(n, d)} = ${frac(n / G, d / G)}. ${clean ? 'No misses!' : 'Try another with no misses to fill the meter.'}`, 'good');
          finishItem('rainbow', `${n}/${d}`, clean, 2);
          nextBtn($('#s3-work'), this);
        },
      });
      this.asks.push(a);
    },
  };
