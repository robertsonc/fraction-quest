
  /* ================= 6. Mistake detective (generated cases) ================= */
  const OPT = {
    drop: 'Wrote only the bottom number',
    diff: 'Divided the top and bottom by different numbers',
    topOnly: 'Divided only the top',
    bottomOnly: 'Divided only the bottom',
    early: 'Stopped before it was fully simplified',
    subtract: 'Subtracted instead of dividing',
    zero: 'Wrote 0 where a 1 belongs',
    leftover: "Didn't simplify the leftover fraction",
    wrongDen: 'Put the leftover over the wrong bottom number',
    noMixed: "Didn't write it as a mixed number",
    none: "Nothing. It's correct!",
  };
  const PROPER_POOL = ['drop', 'diff', 'topOnly', 'bottomOnly', 'early', 'subtract', 'zero'];
  const IMPROPER_POOL = ['leftover', 'wrongDen', 'noMixed', 'early', 'diff', 'bottomOnly'];

  function makeCase(type) {
    const improperType = ['leftover', 'wrongDen', 'noMixed'].includes(type) || (type === 'none' && Math.random() < 0.4);
    for (let t = 0; t < 800; t++) {
      let a, b;
      if (improperType) { b = rand(2, 6); a = rand(b + 1, b * 3); }
      else { b = rand(3, 9); a = type === 'zero' ? 1 : rand(1, b - 1); }
      if (gcd(a, b) !== 1 || (improperType && a % b === 0)) continue;
      let k = type === 'early' ? [4, 6, 8, 9][rand(0, 3)] : rand(2, 4);
      if (type === 'wrongDen') k = rand(1, 3);
      const n = a * k, d = b * k;
      if (d > 36 || n > 60) continue;
      const q = Math.floor(a / b), r = a % b;
      let s;
      if (type === 'drop') s = { w: b, n: 0, d: null };
      else if (type === 'diff') { if (a < 2) continue; s = { w: 0, n: 1, d: b }; }
      else if (type === 'topOnly') s = { w: 0, n: a, d };
      else if (type === 'bottomOnly') s = { w: 0, n, d: b };
      else if (type === 'early') { const p = primeFactors(k)[0]; s = { w: 0, n: n / p, d: d / p }; }
      else if (type === 'subtract') { if (a < 2) continue; s = { w: 0, n: n - k, d: d - k }; }
      else if (type === 'zero') s = { w: 0, n: 0, d: b };
      else if (type === 'leftover') { const r0 = n % d; s = { w: Math.floor(n / d), n: r0, d }; if (gcd(r0, d) === 1) continue; }
      else if (type === 'wrongDen') { if (q < 2 || q === b || r >= q) continue; s = { w: q, n: r, d: q }; }
      else if (type === 'noMixed') { if (k < 2) continue; s = { w: 0, n: a, d: b }; }
      else s = simplest(n, d);
      return { type, n, d, s };
    }
    return { type: 'drop', n: 9, d: 12, s: { w: 4, n: 0, d: null } };
  }
  function caseWhy(c) {
    const { type, n, d, s } = c, G = gcd(n, d), F = frac(n, d), ans = showVal(simplest(n, d)), sv = showVal(s);
    switch (type) {
      case 'drop': return `${F} is less than one whole, but ${s.w} means ${s.w} whole bars! A fraction needs a top and a bottom: ${F} = ${ans}.`;
      case 'diff': return `The top was divided by ${n}, but the bottom by ${G}. Different numbers change the amount. Divide both by ${G}: ${F} = ${ans}.`;
      case 'topOnly': return `Only the top was divided by ${G}. The bottom needs ÷ ${G} too: ${F} = ${ans}.`;
      case 'bottomOnly': return `Only the bottom was divided by ${G}, so the pieces got bigger but there are still ${n} of them. That's way more! Divide both by ${G}: ${F} = ${ans}.`;
      case 'early': return `${sv} is the same amount, but ${s.n} and ${s.d} still share ${gcd(s.n, s.d)}. Keep going: ${F} = ${ans}.`;
      case 'subtract': return `${G} was taken away from the top and the bottom. Subtracting changes the amount. Divide instead: ${F} = ${ans}.`;
      case 'zero': return `${n} ÷ ${n} = 1, not 0. When the whole top cancels, 1 is left: ${F} = ${ans}.`;
      case 'leftover': return `${sv} is the right amount, but the leftover ${frac(s.n, s.d)} can still be simplified: ${F} = ${ans}.`;
      case 'wrongDen': { const t = simplest(n, d); return `The leftover pieces are still ${pieceName(t.d)}, so the bottom stays ${t.d}, not ${s.d}: ${F} = ${ans}.`; }
      case 'noMixed': return `${sv} is simplified, but the top is bigger than the bottom. As a mixed number: ${F} = ${ans}.`;
      default: return `${F} = ${ans}${n > d ? ' as a mixed number' : ''}, fully simplified. Nothing to fix.`;
    }
  }

  /** Does this mistake label truthfully describe the student's answer s for n/d? */
  function explains(type, n, d, s) {
    const c = simplest(n, d), cw = c.w || 0, W = s.w || 0, hasF = s.d != null;
    const same = hasF ? (W * s.d + s.n) * d === n * s.d : W * d === n;
    switch (type) {
      case 'none': return W === cw && ((c.d == null && (!hasF || s.n === 0)) || (hasF && s.n === c.n && s.d === c.d));
      case 'drop': return !hasF && W > 0 && n < d;
      case 'diff': return hasF && !W && s.n > 0 && n % s.n === 0 && d % s.d === 0 && n / s.n !== d / s.d;
      case 'topOnly': return hasF && !W && s.d === d && s.n > 0 && s.n < n && n % s.n === 0;
      case 'bottomOnly': return hasF && !W && s.n === n && s.d < d && d % s.d === 0;
      case 'early': return hasF && !W && same && s.n < s.d && gcd(s.n, s.d) > 1;
      case 'subtract': return hasF && !W && n - s.n === d - s.d && n - s.n > 0;
      case 'zero': return hasF && s.n === 0;
      case 'leftover': return hasF && W > 0 && same && gcd(s.n, s.d) > 1;
      case 'wrongDen': return c.d != null && hasF && W === cw && s.n === c.n && s.d !== c.d;
      case 'noMixed': return hasF && !W && same && s.n > s.d;
      default: return false;
    }
  }

  const S6 = {
    tok: 0, count: 0, deck: [], queue: [],
    init() {
      $('#s6-work').addEventListener('click', (e) => {
        const o = e.target.closest('button[data-opt]');
        if (o) { this.choose(o.dataset.opt); return; }
        if (e.target.closest('#s6-next')) { Sound.play('tick'); this.next(true); }
      });
      this.next(false);
    },
    refill() { this.deck = shuffle(['drop', 'diff', 'topOnly', 'bottomOnly', 'early', 'subtract', 'zero', 'leftover', 'wrongDen', 'noMixed', 'none', 'none']); },
    next(user) {
      this.tok += 1; this.count += 1;
      const due = this.queue.findIndex((q) => q.due <= this.count);
      let type, comeback = false;
      if (due >= 0) { type = this.queue.splice(due, 1)[0].type; comeback = true; }
      else { if (!this.deck.length) this.refill(); type = this.deck.pop(); }
      this.c = makeCase(type);
      this.labeled = false;
      const c = this.c;
      const task = c.n > c.d ? `Simplify ${frac(c.n, c.d)} and write it as a mixed number.` : `Simplify ${frac(c.n, c.d)}.`;
      $('#s6-case').innerHTML = `<div class="case-top"><span class="row-label">Case ${this.count}</span>${comeback ? '<span class="tagpill">Comeback: this kind tripped you up before</span>' : ''}</div><div class="paper"><span class="who">${task}</span><span class="work">${frac(c.n, c.d)}<span>=</span>${showVal(c.s)}</span><span class="who small">A student's answer</span></div>`;
      $('#s6-work').innerHTML = '';
      $('#s6-linewrap').hidden = true;
      note('#s6-note', 'Before you judge the student, solve it yourself.');
      this.a1 = ask($('#s6-work'), {
        st: 'detective',
        lead: 'Solve it yourself first.',
        tpl: `${frac(c.n, c.d)} = [[mixed:w,a,b]]`,
        check: checkFinal(c.n, c.d),
        onOk: () => this.labelPrompt(),
        focus: user,
      });
    },
    labelPrompt() {
      const c = this.c;
      const pool = (c.n > c.d ? IMPROPER_POOL : PROPER_POOL).filter((x) => x !== c.type && !explains(x, c.n, c.d, c.s));
      const opts = c.type === 'none' ? shuffle(['none', ...shuffle(pool).slice(0, 3)]) : shuffle([c.type, ...shuffle(pool).slice(0, 2), 'none']);
      const box = document.createElement('div');
      box.className = 'ask';
      box.innerHTML = `<p class="ask-lead">Now compare your answer with the student's. What did the student do?</p><div class="opts">${opts.map((id) => `<button type="button" class="opt" data-opt="${id}">${OPT[id]}</button>`).join('')}</div>`;
      $('#s6-work').appendChild(box);
      note('#s6-note', 'One pick only, so look closely: same amount? Fully simplified? Mixed number when the top is bigger?');
    },
    choose(id) {
      if (this.labeled) return;
      this.labeled = true;
      const c = this.c, right = id === c.type;
      $$('button[data-opt]', $('#s6-work')).forEach((b) => {
        b.setAttribute('aria-disabled', 'true');
        if (b.dataset.opt === c.type) b.classList.add('right');
        else if (b.dataset.opt === id) b.classList.add('wrong');
      });
      const clean = right && this.a1.tries === 0;
      if (!right) Track.attempt('detective', { ok: false, kind: 'label' });
      if (!clean) this.queue.push({ type: c.type, due: this.count + 3 });
      const lead = right ? 'Case closed! ' : (c.type === 'none' ? 'Not quite. The student was actually right! ' : `Not quite. The student ${OPT[c.type].charAt(0).toLowerCase()}${OPT[c.type].slice(1)}. `);
      note('#s6-note', `${lead}${caseWhy(c)}${clean ? '' : ' A case like this will come back later.'}`, right ? 'good' : 'bad');
      Sound.play(right ? 'good' : 'bad');
      $('#s6-linewrap').hidden = false;
      this.line();
      finishItem('detective', `${c.type}:${c.n}/${c.d}:${textOf(c.s)}`, clean, 2);
      const nb = document.createElement('div');
      nb.className = 'ask-btns';
      nb.innerHTML = '<button type="button" class="btn primary" id="s6-next">Next case</button>';
      $('#s6-work').appendChild(nb);
      if (booted) $('#s6-next').focus({ preventScroll: true });
    },
    line() {
      const c = this.c;
      const rows = [{ w: 0, n: c.n, d: c.d, tag: 'Problem' }, { ...c.s, tag: "Student's answer" }];
      if (c.type !== 'none') rows.push({ ...simplest(c.n, c.d), tag: 'Correct answer' });
      compareLine($('#s6-line'), rows);
    },
    onShow() { if (this.labeled) this.line(); },
  };

  /* ================= 7. Challenge ================= */
  function solutionHTML(n, d) {
    const G = gcd(n, d), a = n / G, b = d / G, steps = [];
    const list = (arr) => arr.map((x) => (x === G ? `<mark>${x}</mark>` : x)).join(', ');
    if (G > 1) {
      steps.push(`Find the greatest common factor. Factors of ${n}: ${list(divisors(n))}. Factors of ${d}: ${list(divisors(d))}. The biggest number in both lists is ${G}.`);
      steps.push(`Divide the top and the bottom by ${G}: ${n} ÷ ${G} = ${a} and ${d} ÷ ${G} = ${b}. So ${frac(n, d)} = ${frac(a, b)}${b === 1 ? `, and anything over 1 is just itself: ${a}` : ''}.`);
    } else {
      steps.push(`${n} and ${d} share no factor except 1, so ${frac(n, d)} can't be simplified.`);
    }
    if (b > 1 && a > b) {
      const q = Math.floor(a / b), r = a % b;
      steps.push(`The top is bigger than the bottom, so make a mixed number: ${a} ÷ ${b} = ${q} remainder ${r}. That's ${q} whole${q > 1 ? 's' : ''} and ${frac(r, b)} left over: ${showVal({ w: q, n: r, d: b })}.`);
    }
    return `<ol class="steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;
  }
  const digitSum = (x) => String(x).split('').reduce((s, c) => s + Number(c), 0);
  function divClue(n, d) {
    if (n % 2 === 0 && d % 2 === 0) return `${n} and ${d} are both even, so 2 goes into both. Is there something even bigger that goes into both?`;
    if (digitSum(n) % 3 === 0 && digitSum(d) % 3 === 0) return `The digits of ${n} add to ${digitSum(n)} and the digits of ${d} add to ${digitSum(d)}. Both are multiples of 3, so 3 goes into both. Anything bigger?`;
    if (n % 5 === 0 && d % 5 === 0) return `${n} and ${d} both end in 0 or 5, so 5 goes into both. Anything bigger?`;
    if (gcd(n, d) > 1) return `2, 3 and 5 don't go into both. Try 7.`;
    return `Test 2 (even?), 3 (digits add to a multiple of 3?) and 5 (ends in 0 or 5?). If none of them fits both, the fraction part may already be simplest.`;
  }

  const S7 = {
    level: 'warm', count: 0, streak: 0, queue: [], tok: 0,
    LEVELS: [['warm', 'Warm-up'], ['big', 'Bigger numbers'], ['mixed', 'Mixed numbers'], ['boss', 'Boss mix']],
    init() {
      $('#s7-levels').innerHTML = this.LEVELS.map(([id, name]) => `<button type="button" class="chip" data-lv="${id}" aria-pressed="${id === this.level}">${name}</button>`).join('');
      $('#s7-levels').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-lv]');
        if (!b) return;
        Sound.play('tick');
        this.level = b.dataset.lv;
        $$('button[data-lv]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        this.next(true);
      });
      $('#s7-work').addEventListener('click', (e) => { if (e.target.closest('#s7-next')) { Sound.play('tick'); this.next(true); } });
      this.next(false);
    },
    gen() {
      const lv = this.level === 'boss' ? (Math.random() < 0.5 ? 'bigB' : 'mixedB') : this.level;
      const wholeAnswer = (lv === 'mixed' || lv === 'mixedB') && Math.random() < 0.12;
      for (let i = 0; i < 400; i++) {
        let a, b, k;
        if (lv === 'warm') { b = rand(2, 6); a = rand(1, b - 1); k = rand(2, 4); }
        else if (lv === 'big' || lv === 'bigB') { b = rand(3, 12); a = rand(1, b - 1); k = Math.random() < 0.12 ? 1 : rand(2, lv === 'bigB' ? 9 : 6); }
        else if (wholeAnswer) { b = 1; a = rand(2, 5); k = rand(2, 6); }
        else { b = rand(2, lv === 'mixedB' ? 9 : 6); a = rand(b + 1, b * 4); k = Math.random() < 0.15 ? 1 : rand(2, lv === 'mixedB' ? 6 : 4); }
        if (gcd(a, b) !== 1 || (b > 1 && a % b === 0)) continue;
        const n = a * k, d = b * k;
        if (d < 2 || n > 99 || d > 99) continue;
        if (this.p && this.p.n === n && this.p.d === d) continue;
        return { n, d };
      }
      return { n: 9, d: 12 };
    },
    /** A different problem with the same shape (proper, mixed or whole answer) for comebacks and examples. */
    twin(p) {
      const G = gcd(p.n, p.d), a = p.n / G, b = p.d / G;
      for (let i = 0; i < 400; i++) {
        const b2 = b === 1 ? 1 : Math.max(2, b + rand(-2, 2));
        let a2;
        if (b === 1) a2 = rand(2, 6);
        else if (a > b) a2 = rand(b2 + 1, b2 * 3);
        else a2 = rand(1, b2 - 1);
        if (gcd(a2, b2) !== 1 || (b2 > 1 && a > b && a2 % b2 === 0)) continue;
        const k2 = G === 1 ? 1 : rand(2, Math.max(3, Math.min(G + 1, 9)));
        const n = a2 * k2, d = b2 * k2;
        if (d < 2 || n > 99 || d > 99 || (n === p.n && d === p.d)) continue;
        return { n, d };
      }
      return this.gen();
    },
    next(user) {
      this.tok += 1; this.count += 1;
      const qi = this.queue.findIndex((q) => q.due <= this.count);
      let comeback = false;
      if (qi >= 0) { this.p = this.queue.splice(qi, 1)[0].p; comeback = true; }
      else this.p = this.gen();
      Object.assign(this, { hints: 0, guided: false, shown: false, asks: [] });
      const { n, d } = this.p;
      $('#s7-q').innerHTML = frac(n, d);
      $('#s7-tag').textContent = comeback ? 'Comeback problem: one like this tripped you up earlier.' : '';
      $('#s7-sol').hidden = true;
      $('#s7-sol').innerHTML = '';
      $('#s7-work').innerHTML = '';
      note('#s7-note', 'Simplify all the way. If the top is bigger than the bottom, write a mixed number.');
      const tok = this.tok;
      this.main = ask($('#s7-work'), {
        st: 'challenge',
        tpl: `${frac(n, d)} = [[mixed:w,a,b]]`,
        check: (v) => {
          const t = toVal(v, 'w', 'a', 'b');
          if (t.err) return { invalid: true, msg: t.err };
          const quick = performance.now() - this.main.t0 < QUICK_MS;
          const r = diagnose(n, d, t.val);
          if (r.ok) return { ok: true, msg: 'Yes!' };
          return { ...r, after: (st) => { if (tok === this.tok && (quick || st.tries >= 2)) this.startGuided(quick); } };
        },
        onOk: () => { if (tok === this.tok) this.win(); },
        extra: [
          { label: 'Hint', onClick: () => this.hint() },
          { label: 'Show a similar example', onClick: () => this.example() },
        ],
        focus: user,
      });
      this.asks.push(this.main);
      this.renderStats();
    },
    hint() {
      const { n, d } = this.p;
      this.hints += 1;
      const small = Math.min(n, d), big = Math.max(n, d);
      let msg;
      if (this.hints === 1) msg = divClue(n, d);
      else if (this.hints === 2) msg = `Factors of ${small}: ${divisors(small).join(', ')}. Which of these also go into ${big}? Use the biggest one.`;
      else msg = 'No more hints for this one. Try "Show a similar example", then come back to yours.';
      note('#s7-note', msg);
      Sound.play('tick');
    },
    example() {
      if (!this.shown) { this.shown = true; this.ex = this.twin(this.p); }
      const sol = $('#s7-sol');
      sol.innerHTML = `<h3>A similar example (not your problem): ${frac(this.ex.n, this.ex.d)}</h3>${solutionHTML(this.ex.n, this.ex.d)}`;
      sol.hidden = false;
      note('#s7-note', 'Read how the example works, then use the same steps on yours.');
      Sound.play('tick');
    },
    startGuided(quick) {
      if (this.guided) return;
      this.guided = true;
      Track.guided('challenge');
      setBlocked(this.main, true);
      note('#s7-note', `${quick ? 'That was really fast. ' : ''}Let's slow down and show the work, one step at a time.`, 'bad');
      this.stepGcf();
    },
    stepGcf() {
      const { n, d } = this.p, G = gcd(n, d), tok = this.tok;
      this.asks.push(ask($('#s7-work'), {
        st: 'challenge',
        lead: 'Step 1: find the biggest number that goes into both.',
        tpl: `Greatest common factor of ${n} and ${d}: [[g:Greatest common factor]]`,
        help: () => `Factors of ${Math.min(n, d)}: ${divisors(Math.min(n, d)).join(', ')}. Which of these also go into ${Math.max(n, d)}?`,
        check: (v) => {
          if (v.g === G) return { ok: true, msg: G > 1 ? `Yes, ${G}.` : 'Right, only 1. Nothing to divide.', sound: 'tick' };
          if (v.g > 0 && n % v.g === 0 && d % v.g === 0) return { kind: 'notGreatest', msg: `${v.g} goes into both, but there's a bigger one.` };
          return { kind: 'notFactor', msg: `${v.g} doesn't go into ${v.g > 0 && n % v.g !== 0 ? n : d} evenly.` };
        },
        onOk: () => { if (tok === this.tok) { if (G > 1) this.stepDivide(G); else this.stepMixedOrFinal(n, d); } },
      }));
    },
    stepDivide(G) {
      const { n, d } = this.p, tok = this.tok;
      this.asks.push(ask($('#s7-work'), {
        st: 'challenge',
        lead: `Step 2: divide the top and the bottom by ${G}.`,
        tpl: `${n} ÷ ${G} = [[a:Top]] and ${d} ÷ ${G} = [[b:Bottom]]`,
        check: (v) => {
          if (v.a == null || v.b == null) return { invalid: true, msg: 'Fill in both boxes.' };
          if (v.a === n / G && v.b === d / G) return { ok: true, msg: `So it's ${frac(n / G, d / G)}.`, sound: 'tick' };
          return { kind: 'arith', msg: v.a === n / G ? `Check ${d} ÷ ${G}.` : `Check ${n} ÷ ${G}.` };
        },
        onOk: () => { if (tok === this.tok) this.stepMixedOrFinal(n / G, d / G); },
      }));
    },
    stepMixedOrFinal(a, b) {
      const tok = this.tok;
      if (b > 1 && a > b) {
        const q = Math.floor(a / b), r = a % b;
        this.asks.push(ask($('#s7-work'), {
          st: 'challenge',
          lead: 'The top is bigger than the bottom. How many wholes, and what is left?',
          tpl: `${a} ÷ ${b} = [[q:Wholes]] remainder [[r:Left over]]`,
          check: (v) => {
            if (v.q == null || v.r == null) return { invalid: true, msg: 'Fill in both boxes.' };
            if (v.q === q && v.r === r) return { ok: true, msg: 'Right.', sound: 'tick' };
            return { kind: 'wholes', msg: `${b} × ${v.q} = ${b * v.q}. ${b * v.q > a ? `That's more than ${a}.` : 'How many are left over after that?'}` };
          },
          onOk: () => { if (tok === this.tok) this.stepFinal(); },
        }));
      } else this.stepFinal();
    },
    stepFinal() {
      const { n, d } = this.p, tok = this.tok;
      this.asks.push(ask($('#s7-work'), {
        st: 'challenge',
        lead: 'Last step: put it together.',
        tpl: `${frac(n, d)} = [[mixed:w,a,b]]`,
        check: checkFinal(n, d),
        onOk: () => { if (tok === this.tok) this.win(); },
      }));
    },
    win() {
      const { n, d } = this.p;
      const clean = this.main.tries === 0 && this.hints === 0 && !this.shown && !this.guided;
      this.streak = clean ? this.streak + 1 : 0;
      Store.data.best = Math.max(Store.data.best || 0, this.streak);
      Store.data.solved = (Store.data.solved || 0) + 1;
      Store.save();
      if (!clean) this.queue.push({ p: this.twin(this.p), due: this.count + 2 });
      finishItem('challenge', `${n}/${d}`, clean, 3);
      note('#s7-note', clean ? `First try, no help. +3 stars! ${frac(n, d)} = ${showVal(simplest(n, d))}.` : `Solved! ${frac(n, d)} = ${showVal(simplest(n, d))}. A problem like this will come back soon so you can nail it on the first try.`, 'good');
      const run = this.streak;
      if (run === 3 || (run > 0 && run % 5 === 0)) window.setTimeout(() => { Confetti.burst(); Sound.play('win'); toast(`${run} in a row on the first try!`); }, 300);
      const sol = $('#s7-sol');
      sol.innerHTML = `<h3>How it works</h3>${solutionHTML(n, d)}`;
      sol.hidden = false;
      const nb = document.createElement('div');
      nb.className = 'ask-btns';
      nb.innerHTML = '<button type="button" class="btn primary" id="s7-next">Next problem</button>';
      $('#s7-work').appendChild(nb);
      if (booted) $('#s7-next').focus({ preventScroll: true });
      this.renderStats();
    },
    renderStats() {
      $('#s7-stats').innerHTML = `<span class="stat">Solved: ${Store.data.solved || 0}</span><span class="stat">First-try streak: ${this.streak}</span><span class="stat">Best streak: ${Store.data.best || 0}</span>${this.queue.length ? `<span class="stat">Comebacks waiting: ${this.queue.length}</span>` : ''}`;
    },
  };
