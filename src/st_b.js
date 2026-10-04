
  /* ================= 4. Prime trees ================= */
  const isPrime = (x) => x > 1 && primeFactors(x).length === 1;
  function notPrimeHint(v) {
    const p = primeFactors(v)[0];
    if (p === 2) return `${v} is even, so 2 goes into it. It's not prime. Split it!`;
    if (p === 5) return `${v} ends in 5, so 5 goes into it. It's not prime. Split it!`;
    if (p === 3 && v >= 10) {
      const digits = String(v).split('').map(Number);
      const s = digits.reduce((a, b) => a + b, 0);
      return `Add the digits of ${v}: ${digits.join(' + ')} = ${s}. 3 goes into ${s}, so 3 goes into ${v}. Split it!`;
    }
    return `${v} isn't prime. Try dividing it by ${p}.`;
  }
  const S4 = {
    tok: 0,
    init() {
      bindCustom('s4', (n, d) => (n < 2 || d < 2 || n > 144 || d > 144 ? 'Use numbers from 2 to 144.' : ''), (n, d) => this.set(n, d));
      ['#s4-tree-top', '#s4-tree-bot'].forEach((sel) => {
        const svg = $(sel);
        svg.addEventListener('click', (e) => { const g = e.target.closest('.tleaf'); if (g) this.pick(g.dataset.tree, g.dataset.id); });
        svg.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          const g = e.target.closest('.tleaf');
          if (g) { e.preventDefault(); this.pick(g.dataset.tree, g.dataset.id); }
        });
      });
      $('#s4-board').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) this.tap(b.dataset.row, Number(b.dataset.i)); });
      useDeck(this, 's4', GEN.primes);
    },
    node(v) { this.uid += 1; return { id: `t${this.uid}`, v, kids: null, prime: false }; },
    leaves(root) { const out = []; const w = (nd) => { if (!nd.kids) out.push(nd); else nd.kids.forEach(w); }; w(root); return out; },
    find(root, id) { let hit = null; const w = (nd) => { if (nd.id === id) hit = nd; if (nd.kids) nd.kids.forEach(w); }; w(root); return hit; },
    set(n, d) {
      this.tok += 1;
      this.uid = 0;
      Object.assign(this, { n, d, asks: [], miss: 0, active: null, sel: null, pairs: [], phase: 'trees', cur: null });
      this.trees = { top: this.node(n), bot: this.node(d) };
      markPreset($('#s4-presets'), n, d);
      $('#s4-work').innerHTML = '';
      $('#s4-boardwrap').hidden = true;
      $('#s4-eq').innerHTML = '';
      $('#s4-cancelled').innerHTML = '';
      $('#s4-cap-top').textContent = `Top: ${n}`;
      $('#s4-cap-bot').textContent = `Bottom: ${d}`;
      note('#s4-note', `Break ${n} and ${d} down into primes. A prime can only be made as 1 × itself, like 2, 3, 5, 7 or 11. Split each number into two smaller numbers that multiply to it, until every branch ends in a prime.`);
      this.next();
    },
    onShow() { this.drawTrees(); },
    next() {
      for (const t of ['top', 'bot']) {
        const lf = this.leaves(this.trees[t]).find((x) => !x.prime);
        if (lf) { this.focusNode(t, lf); return; }
      }
      this.treesDone();
    },
    focusNode(tree, nd) {
      this.active = { tree, id: nd.id };
      this.drawTrees();
      this.splitPrompt(nd);
    },
    pick(tree, id) {
      if (this.phase !== 'trees') return;
      const nd = this.find(this.trees[tree], id);
      if (!nd || nd.kids || nd.prime || (this.active && this.active.id === id)) return;
      Sound.play('tick');
      this.focusNode(tree, nd);
    },
    splitPrompt(nd) {
      if (this.cur && !this.cur.done) this.cur.el.remove();
      const v = nd.v, tok = this.tok;
      const a = ask($('#s4-work'), {
        st: 'primes',
        lead: `Split ${v} into two numbers that multiply to ${v}, or decide that it's prime.`,
        tpl: `${v} = [[a:First number]] × [[b:Second number]]`,
        button: 'Split',
        check: (x) => {
          if (x.a == null || x.b == null) return { invalid: true, msg: 'Fill in both numbers.' };
          if (x.a * x.b !== v) return { kind: 'arith', msg: `${x.a} × ${x.b} = ${x.a * x.b}, not ${v}.` };
          if (x.a === 1 || x.b === 1) return { kind: 'one', msg: `1 × ${v} doesn't break it down. ${isPrime(v) ? `Is there any other way to make ${v}?` : 'Find two numbers bigger than 1.'}` };
          return { ok: true, msg: `${v} = ${x.a} × ${x.b}. Nice split.`, sound: 'snap' };
        },
        onOk: (x) => { if (tok !== this.tok) return; nd.kids = [this.node(x.a), this.node(x.b)]; this.next(); },
        extra: [{
          label: `${v} is prime`,
          onClick: (st) => {
            if (isPrime(v)) { st.finish(`Yes, ${v} is prime. Only 1 × ${v} makes it.`, 'tick'); nd.prime = true; this.next(); }
            else st.fail({ kind: 'notPrime', msg: notPrimeHint(v) });
          },
        }],
      });
      this.cur = a;
      this.asks.push(a);
    },
    drawTrees() {
      this.drawTree($('#s4-tree-top'), this.trees.top, 'top');
      this.drawTree($('#s4-tree-bot'), this.trees.bot, 'bot');
    },
    drawTree(svg, root, tree) {
      let slot = 0, maxDepth = 0;
      const nodes = [];
      const walk = (nd, depth) => {
        nd.depth = depth; maxDepth = Math.max(maxDepth, depth);
        if (!nd.kids) { nd.x = slot; slot += 1; }
        else { nd.kids.forEach((k) => walk(k, depth + 1)); nd.x = (nd.kids[0].x + nd.kids[1].x) / 2; }
        nodes.push(nd);
      };
      walk(root, 0);
      const slotW = 58, levelH = 62, r = 21, top = r + 6;
      const W = Math.max(slot * slotW + 12, 120), H = top + maxDepth * levelH + r + 8;
      const off = (W - slot * slotW) / 2;
      const px = (nd) => off + nd.x * slotW + slotW / 2, py = (nd) => top + nd.depth * levelH;
      let lines = '', dots = '';
      nodes.forEach((nd) => {
        if (nd.kids) nd.kids.forEach((k) => { lines += `<line class="tline" x1="${f1(px(nd))}" y1="${py(nd) + r}" x2="${f1(px(k))}" y2="${py(k) - r}"/>`; });
      });
      nodes.forEach((nd) => {
        const open = !nd.kids && !nd.prime;
        const act = this.active && this.active.id === nd.id && this.phase === 'trees';
        const cls = nd.prime ? 'prime' : (nd.kids ? 'split' : 'open');
        const attrs = open ? ` role="button" tabindex="0" data-tree="${tree}" data-id="${nd.id}" aria-label="${nd.v}, not finished. Tap to work on it."` : ` aria-label="${nd.v}${nd.prime ? ', prime' : ''}"`;
        dots += `<g class="tn ${cls} ${open ? 'tleaf' : ''} ${act ? 'active' : ''}"${attrs}><circle cx="${f1(px(nd))}" cy="${py(nd)}" r="${r}"/>${nd.prime ? `<circle class="ring" cx="${f1(px(nd))}" cy="${py(nd)}" r="${r - 4}"/>` : ''}<text x="${f1(px(nd))}" y="${py(nd)}">${nd.v}</text></g>`;
      });
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', String(W));
      svg.setAttribute('height', String(H));
      svg.innerHTML = lines + dots;
    },
    treesDone() {
      this.phase = 'cancel';
      this.active = null;
      this.drawTrees();
      const tp = this.leaves(this.trees.top).map((x) => x.v).sort((a, b) => a - b);
      const bp = this.leaves(this.trees.bot).map((x) => x.v).sort((a, b) => a - b);
      this.top = tp.map((p) => ({ p, gone: false }));
      this.bot = bp.map((p) => ({ p, gone: false }));
      Sound.play('good');
      note('#s4-note', `Every branch ends in a prime! ${this.n} = ${tp.join(' × ')} and ${this.d} = ${bp.join(' × ')}. (Any way you split, you always end up with the same primes.)`, 'good');
      $('#s4-boardwrap').hidden = false;
      this.render();
      if (!this.anyMatch()) { this.resultPrompt(); return; }
      const box = document.createElement('p');
      box.className = 'ask-lead';
      box.innerHTML = 'Now cancel: tap a prime on top, then the <b>same</b> prime on the bottom. Each matching pair divides to 1.';
      $('#s4-work').appendChild(box);
      const first = $('#s4-board .ptile');
      if (first && booted) first.focus({ preventScroll: true });
    },
    anyMatch() {
      const t = new Set(this.top.filter((x) => !x.gone).map((x) => x.p));
      return this.bot.some((x) => !x.gone && t.has(x.p));
    },
    render() {
      const tile = (row, it, i) => {
        const sel = this.sel && this.sel.row === row && this.sel.i === i;
        return `<button type="button" class="ptile neutral ${it.gone ? 'gone' : ''} ${sel ? 'sel' : ''}" data-row="${row}" data-i="${i}" ${it.gone ? 'aria-disabled="true"' : ''} aria-pressed="${sel}" aria-label="${it.p}${it.gone ? ', cancelled' : ''}">${it.p}</button>`;
      };
      const row = (name, arr) => arr.map((it, i) => tile(name, it, i)).join('<span class="times" aria-hidden="true">×</span>');
      $('#s4-board').innerHTML = `<div class="prow" role="group" aria-label="Top primes">${row('top', this.top)}</div><div class="pbar"></div><div class="prow" role="group" aria-label="Bottom primes">${row('bot', this.bot)}</div>`;
      const c = this.pairs;
      $('#s4-cancelled').innerHTML = c.length ? `Cancelled: ${c.map((p) => frac(p, p)).join(' × ')}, and each one equals 1.` : '';
    },
    tap(row, i) {
      if (this.phase !== 'cancel') return;
      const arr = row === 'top' ? this.top : this.bot, it = arr[i];
      if (!it || it.gone) return;
      const kb = focusedMatches('.ptile');
      if (!this.sel || this.sel.row === row) {
        this.sel = { row, i };
        Sound.play('tick');
        this.render();
        if (kb) { const el = $(`.ptile[data-row="${row}"][data-i="${i}"]`); if (el) el.focus({ preventScroll: true }); }
        return;
      }
      const prev = this.sel, other = (prev.row === 'top' ? this.top : this.bot)[prev.i];
      if (other.p === it.p) {
        other.gone = true; it.gone = true; this.pairs.push(it.p); this.sel = null;
        Sound.play('snap');
        note('#s4-note', `${it.p} on top and ${it.p} on the bottom: ${it.p} ÷ ${it.p} = 1, so they cancel.`, 'good');
        this.render();
        if (!this.anyMatch()) window.setTimeout(() => this.resultPrompt(), reduced ? 0 : 400);
        else if (kb) { const el = $('.ptile:not(.gone)'); if (el) el.focus({ preventScroll: true }); }
      } else {
        this.miss += 1;
        Track.attempt('primes', { ok: false, kind: 'mismatch' });
        Sound.play('bad');
        this.sel = null;
        this.render();
        shake($(`.ptile[data-row="${row}"][data-i="${i}"]`));
        shake($(`.ptile[data-row="${prev.row}"][data-i="${prev.i}"]`));
        const tp = row === 'top' ? it.p : other.p, bp = row === 'top' ? other.p : it.p;
        const A1 = an(tp);
        note('#s4-note', `${A1.charAt(0).toUpperCase()}${A1.slice(1)} ${tp} and ${an(bp)} ${bp} can't cancel. Only matching primes cancel, because ${frac(tp, bp)} isn't 1.`, 'bad');
      }
    },
    resultPrompt() {
      this.phase = 'result';
      const { n, d, tok } = this;
      const tl = this.top.filter((x) => !x.gone).map((x) => x.p), bl = this.bot.filter((x) => !x.gone).map((x) => x.p);
      const A = tl.reduce((a, b) => a * b, 1), B = bl.reduce((a, b) => a * b, 1);
      const lead = this.pairs.length
        ? 'No matches left. Multiply the primes that are still standing on top, then on the bottom. (If nothing is left on a side, that side is 1.)'
        : `No prime shows up on both the top and the bottom. So ${frac(n, d)} can't be simplified. Type it as it is.`;
      const a = ask($('#s4-work'), {
        st: 'primes',
        lead,
        tpl: '[[frac:a,b]]',
        check: (v) => {
          if (v.a == null || v.b == null) return { invalid: true, msg: 'Fill in the top and the bottom. Use 1 if a side has nothing left.' };
          if (v.a === A && v.b === B) return { ok: true, msg: 'Yes!' };
          if (v.a === 0) return { kind: 'zero', msg: 'When everything on top cancels, 1 is left, not 0. Each cancelled pair was a 1.' };
          if (v.b === 0) return { kind: 'zero', msg: 'A side with nothing left is 1, not 0.' };
          return { kind: 'arith', msg: `Multiply only the numbers that aren't crossed out. Top: ${tl.length ? tl.join(' × ') : '1'}. Bottom: ${bl.length ? bl.join(' × ') : '1'}.` };
        },
        onOk: () => { if (tok === this.tok) this.finish(A, B); },
      });
      this.asks.push(a);
    },
    finish(A, B) {
      const { n, d } = this;
      const res = B === 1 ? `<span class="whole">${A}</span>` : frac(A, B);
      const mixedTail = A > B && B > 1 ? `${EQ}${showVal(simplest(A, B))}` : '';
      $('#s4-eq').innerHTML = `${frac(n, d)}${EQ}${res}${mixedTail}`;
      const G = gcd(n, d);
      const clean = this.miss === 0 && this.asks.every((a) => a.tries === 0);
      let msg = `${frac(n, d)} = ${res}.`;
      if (this.pairs.length) msg += ` The primes you cancelled multiply to ${this.pairs.join(' × ')} = ${G}, the biggest number that goes into both ${n} and ${d}.`;
      if (!this.top.some((x) => !x.gone) && this.pairs.length) msg += ' Everything on top cancelled, so 1 was left on top, not 0.';
      if (B === 1) msg += ` The bottom is 1, so it's the whole number ${A}.`;
      else if (A > B) msg += ` As a mixed number that's ${showVal(simplest(A, B))}.`;
      msg += clean ? ' No misses!' : ' Try another with no misses to fill the meter.';
      note('#s4-note', msg, 'good');
      finishItem('primes', `${n}/${d}`, clean, 2);
      nextBtn($('#s4-work'), this);
    },
  };

  /* ================= 5. Wholes and leftovers ================= */
  const S5 = {
    tok: 0,
    init() {
      bindCustom('s5', (n, d) => {
        if (d < 2 || d > 12) return 'Use a bottom number from 2 to 12.';
        if (n <= d) return 'Make the top bigger than the bottom.';
        if (n > 72 || n / d > 6) return 'Keep it to 6 wholes or fewer, with a top of 72 or less.';
        return '';
      }, (n, d) => this.set(n, d));
      useDeck(this, 's5', GEN.wholes);
    },
    set(n, d) {
      this.tok += 1;
      const G = gcd(n, d), A = n / G, B = d / G;
      Object.assign(this, { n, d, asks: [], barsOn: false, v: { G, A, B, Q: Math.floor(A / B), R: A % B } });
      markPreset($('#s5-presets'), n, d);
      $('#s5-steps').innerHTML = '';
      this.block('1. Is it more than one whole?', `<div class="eq">${frac(n, d)}</div><p>The top (${n}) is bigger than the bottom (${d}). One whole is ${d} pieces and you have ${n}, so it's more than one whole.</p>`);
      this.step2();
    },
    onShow() { if (this.barsOn) this.drawBars(false); },
    block(title, html) {
      const el = document.createElement('div');
      el.className = 'wstep';
      el.innerHTML = `<h3>${title}</h3>${html}`;
      const host = $('#s5-steps');
      host.appendChild(el);
      $$('.wstep', host).forEach((x) => x.classList.toggle('cur', x === el));
      return el;
    },
    step2() {
      const { n, d, tok } = this, { G } = this.v;
      const el = this.block('2. Simplify first', '<p>Divide the top and the bottom by the biggest number that goes into both. If nothing bigger than 1 goes into both, write it the same.</p>');
      this.asks.push(ask(el, {
        st: 'wholes',
        tpl: `${frac(n, d)} = [[frac:a,b]]`,
        check: checkFrac(n, d, G > 1 ? `Yes! Both divided by ${G}.` : `Right. ${n} and ${d} share nothing but 1.`),
        onOk: () => { if (tok === this.tok) this.step3(); },
      }));
    },
    step3() {
      const { tok } = this, { A, B, Q, R } = this.v;
      const piece = B === 1 ? 'piece' : pieceName(B);
      const el = this.block('3. Predict', `<p>Each whole bar holds ${B} ${piece}. You have ${A}. Work it out before the bars fill.</p>`);
      this.asks.push(ask(el, {
        st: 'wholes',
        tpl: '[[q:Full bars]] full bars, and [[r:Pieces left over]] left over',
        help: () => `Count by ${B}s: ${Array.from({ length: Math.min(Q + 1, 9) }, (_, i) => B * (i + 1)).join(', ')}. Stop before you pass ${A}.`,
        check: (v) => {
          if (v.q == null || v.r == null) return { invalid: true, msg: 'Fill in both boxes.' };
          if (v.q === Q && v.r === R) return { ok: true, msg: `Yes! ${B} × ${Q} = ${B * Q}, and ${R} left over. Watch the bars fill.`, sound: false };
          if (v.q === Q) return { kind: 'wholes', msg: `Right number of bars. ${B} × ${Q} = ${B * Q}. How many of the ${A} are left after that?` };
          if (B * v.q > A) return { kind: 'wholes', msg: `${B} × ${v.q} = ${B * v.q}. That's more than ${A}, so that many bars won't fill.` };
          return { kind: 'wholes', msg: `${B} × ${v.q} = ${B * v.q}. Can one more full bar fit?` };
        },
        onOk: () => { if (tok === this.tok) this.step4(); },
      }));
    },
    step4() {
      const { tok } = this, { A, B, Q, R } = this.v;
      const rest = R ? ` and ${R} ${pieceName(B, R)} left over` : ', with nothing left over';
      this.block('4. Fill the bars', `<svg class="tray-svg" id="s5-bars" role="img" aria-label="${A} pieces filling ${Q} whole bars"></svg><p>${A} ÷ ${B} = ${Q} with ${R} left over. That's ${Q} full bar${Q === 1 ? '' : 's'}${rest}.</p>`);
      this.barsOn = true;
      this.drawBars(true);
      window.setTimeout(() => { if (tok === this.tok) this.step5(); }, reduced ? 0 : Math.min(2400, A * 110 + 500));
    },
    step5() {
      const { n, d, tok } = this, { G, R, B } = this.v;
      const el = this.block('5. Write the mixed number', `<p>${R ? `The whole number is how many bars filled. The leftover pieces are still ${pieceName(B)}.` : 'No leftovers this time.'}</p>`);
      this.asks.push(ask(el, {
        st: 'wholes',
        tpl: `${frac(n, d)} = [[mixed:w,a,b]]`,
        check: checkFinal(n, d),
        onOk: () => {
          if (tok !== this.tok) return;
          const clean = this.asks.every((a) => a.tries === 0);
          let other = '';
          if (G > 1) {
            const q0 = Math.floor(n / d), r0 = n % d;
            if (r0) { const g2 = gcd(r0, d); other = ` Another way: change it first, then simplify the leftover. ${n} ÷ ${d} = ${q0} with ${r0} left over, so ${showVal({ w: q0, n: r0, d })}, and ${frac(r0, d)} simplifies to ${frac(r0 / g2, d / g2)}. Same answer!`; }
          }
          const p = document.createElement('p');
          p.className = 'note good';
          p.innerHTML = `${clean ? 'No misses!' : 'Done! Try another with no misses to fill the meter.'}${other}`;
          el.appendChild(p);
          finishItem('wholes', `${n}/${d}`, clean, 2);
          nextBtn(el, this);
        },
      }));
    },
    drawBars(animate) {
      const svg = $('#s5-bars');
      if (!svg) return;
      const { A: a, B: b, Q: q } = this.v;
      const rows = Math.ceil(a / b);
      const W = Math.max(300, widthOf(svg)), narrow = W < 520;
      const badgeW = narrow ? 70 : 96, barW = W - badgeW, barH = narrow ? 36 : 42, gap = 10;
      const H = rows * (barH + gap) + 4;
      const cw = (barW - 8) / b, per = Math.min(110, 1600 / a);
      let out = '';
      for (let row = 0; row < rows; row++) {
        const y = row * (barH + gap) + 4;
        out += `<rect class="tray" x="2" y="${y - 2}" width="${f1(barW - 4)}" height="${barH + 4}" rx="9"/>`;
        for (let c = 0; c < b; c++) {
          const idx = row * b + c, x = 4 + c * cw;
          if (idx < a) out += tileG(x + 1, y, cw - 2, barH, b, b === 1 ? '1' : `1/${b}`, true, animate ? 'drop' : '', animate ? `animation-delay:${Math.round(idx * per)}ms` : '');
          else out += `<rect class="slot" x="${f1(x + 1)}" y="${y}" width="${f1(cw - 2)}" height="${barH}" rx="6"/>`;
        }
        if (row < q) {
          const delay = animate ? Math.round(((row + 1) * b - 1) * per + 220) : 0;
          out += `<text class="badge" x="${f1(barW + 6)}" y="${y + barH / 2}" style="animation-delay:${delay}ms">${narrow ? '1 whole' : '= 1 whole'}</text>`;
        }
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('height', String(H));
      svg.classList.toggle('still', !animate);
      svg.innerHTML = out;
      if (animate && !reduced) for (let i = 0; i < a; i++) Sound.tone(420 + (i % b) * 45, 0.04, 'sine', 0.035, (i * per) / 1000);
    },
  };
