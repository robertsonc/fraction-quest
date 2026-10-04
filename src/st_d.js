
  /* ================= 7. Story problems ================= */
  const SHOWS = [
    { id: 'gf', name: 'Gravity Falls', c: '#3FAE68' },
    { id: 'tadc', name: 'The Amazing Digital Circus', c: '#8E5AD5' },
    { id: 'middle', name: 'The Middle', c: '#F38B2A' },
    { id: 'ys', name: 'Young Sheldon', c: '#3B7EE0' },
    { id: 'gm', name: "Georgie & Mandy's First Marriage", c: '#E5567E' },
    { id: 'desc', name: 'Descendants', c: '#C551B2' },
    { id: 'zom', name: 'Zombies', c: '#20A4B5' },
  ];
  /** A part p of a whole w that shares a factor with w, so there is always something to simplify. */
  function partOf(lo, hi) {
    for (let i = 0; i < 400; i++) { const w = rand(lo, hi), p = rand(1, w - 1); if (gcd(p, w) > 1 && 2 * p !== w) return [p, w]; }
    return [6, 8];
  }
  /** e items packed s to a group: more than one group, not a whole number, and simplifiable. */
  function improperOf() {
    for (let i = 0; i < 400; i++) { const s = [4, 6, 8, 10, 12][rand(0, 4)], e = rand(s + 1, s * 3); if (e % s !== 0 && gcd(e, s) > 1) return [e, s]; }
    return [20, 8];
  }
  const cmp = (n, d, what) => ({ n, d, kind: 'complement', msg: `That's the fraction for ${what}. Read the question again: which part is it asking about?` });
  const pwT = (n, d, what) => ({ n, d, kind: 'partWhole', msg: `That compares ${what}. The bottom should be the whole group, everything added together.` });
  const swapT = (n, d) => ({ n, d, kind: 'other', msg: 'Flip it. The bottom is how many make one group, and the top is how many there are in all.' });
  const groupStory = (e, s, story, q) => ({ story, q, n: e, d: s, traps: [swapT(s, e)] });

  const STORIES = [
    { show: 'gf', make() { const [p, w] = partOf(8, 24); return { story: `Grunkle Stan put ${w} snow globes on the shelf in the Mystery Shack gift shop. By closing time, tourists had bought ${p} of them.`, q: 'What fraction of the snow globes sold?', n: p, d: w, traps: [cmp(w - p, w, 'the snow globes that did not sell')] }; } },
    { show: 'gf', make() { const [a, t] = partOf(8, 20); const b = t - a; return { story: `Mabel knitted ${a} sweaters with sparkles and ${b} sweaters without sparkles.`, q: 'What fraction of her new sweaters have sparkles?', n: a, d: t, traps: [pwT(a, b, 'sparkly sweaters to plain ones'), cmp(b, t, 'the sweaters without sparkles')] }; } },
    { show: 'gf', make() { const [p, t] = partOf(8, 24); return { story: `One page of Dipper's journal has ${t} secret codes. He cracked ${t - p} of them before dinner.`, q: 'What fraction of the codes are still not cracked?', n: p, d: t, traps: [cmp(t - p, t, 'the codes he already cracked')] }; } },
    { show: 'gf', make() { const [e, s] = improperOf(); return groupStory(e, s, `For movie night at the Mystery Shack, Soos cut every pizza into ${s} slices. Everybody ate ${e} slices in all.`, 'How many pizzas did they eat? Write it as a fraction of a pizza first.'); } },
    { show: 'gf', make() { const [p, w] = partOf(6, 20); return { story: `Mabel set out ${w} apple slices for Waddles. He gobbled up ${p} of them.`, q: 'What fraction of the apple slices did Waddles eat?', n: p, d: w, traps: [cmp(w - p, w, 'the apple slices he did not eat')] }; } },

    { show: 'tadc', make() { const [p, t] = partOf(6, 20); return { story: `Caine planned an adventure with ${t} challenges. The team finished ${p} of them before Jax wandered off.`, q: 'What fraction of the challenges did the team finish?', n: p, d: t, traps: [cmp(t - p, t, 'the challenges they did not finish')] }; } },
    { show: 'tadc', make() { const [a, t] = partOf(6, 20); const b = t - a; return { story: `Gangle has ${a} comedy masks and ${b} tragedy masks.`, q: "What fraction of Gangle's masks are comedy masks?", n: a, d: t, traps: [pwT(a, b, 'comedy masks to tragedy masks'), cmp(b, t, 'the tragedy masks')] }; } },
    { show: 'tadc', make() { const [p, t] = partOf(8, 24); return { story: `Kinger built a pillow fort out of ${t} pillows. ${t - p} pillows make the walls, and the rest make the roof.`, q: 'What fraction of the pillows make the roof?', n: p, d: t, traps: [cmp(t - p, t, 'the wall pillows'), pwT(p, t - p, 'roof pillows to wall pillows')] }; } },
    { show: 'tadc', make() { const [p, t] = partOf(6, 20); return { story: `Pomni found ${t} doors in the circus and checked ${p} of them, hoping one is the exit.`, q: 'What fraction of the doors has Pomni checked?', n: p, d: t, traps: [cmp(t - p, t, 'the doors she has not checked')] }; } },
    { show: 'tadc', make() { const [e, s] = improperOf(); return groupStory(e, s, `Ragatha baked ${e} cupcakes for the whole crew. Each tray holds ${s} cupcakes.`, 'How many trays of cupcakes is that? Write it as a fraction of a tray first.'); } },

    { show: 'middle', make() { const [p, t] = partOf(6, 18); return { story: `Brick checked out ${t} books from the library and read ${p} of them in one weekend.`, q: 'What fraction of the books did Brick read?', n: p, d: t, traps: [cmp(t - p, t, 'the books he did not read')] }; } },
    { show: 'middle', make() { const [p, t] = partOf(6, 16); return { story: `Sue Heck tried out for ${t} clubs this year and made ${t - p} of them. She's still smiling!`, q: 'What fraction of the clubs did Sue not make?', n: p, d: t, traps: [cmp(t - p, t, 'the clubs she made')] }; } },
    { show: 'middle', make() { const [p, t] = partOf(8, 20); return { story: `Axl has ${t - p} clean socks and ${p} dirty socks on his bedroom floor.`, q: 'What fraction of the socks on his floor are dirty?', n: p, d: t, traps: [pwT(p, t - p, 'dirty socks to clean socks'), cmp(t - p, t, 'the clean socks')] }; } },
    { show: 'middle', make() { const [e, s] = improperOf(); return groupStory(e, s, `Frankie cut each frozen pizza into ${s} slices. The Hecks ate ${e} slices at dinner.`, 'How many pizzas did the Hecks eat? Write it as a fraction of a pizza first.'); } },

    { show: 'ys', make() { const [a, t] = partOf(6, 18); const b = t - a; return { story: `Sheldon's train set has ${a} boxcars and ${b} passenger cars.`, q: 'What fraction of the train cars are boxcars?', n: a, d: t, traps: [pwT(a, b, 'boxcars to passenger cars'), cmp(b, t, 'the passenger cars')] }; } },
    { show: 'ys', make() { const [p, t] = partOf(8, 24); return { story: `Missy came up to bat ${t} times this season and got a hit ${p} times.`, q: 'What fraction of her times at bat were hits?', n: p, d: t, traps: [cmp(t - p, t, 'the times she did not get a hit')] }; } },
    { show: 'ys', make() { const [p, t] = partOf(8, 24); return { story: `Sheldon's new science book has ${t} chapters. He read ${t - p} chapters before bedtime.`, q: 'What fraction of the book does he still have left to read?', n: p, d: t, traps: [cmp(t - p, t, 'the chapters he already read')] }; } },
    { show: 'ys', make() { const [e, s] = improperOf(); return groupStory(e, s, `Georgie is stacking ${e} tires behind the tire shop, ${s} tires to a pile.`, 'How many piles is that? Write it as a fraction of a pile first.'); } },

    { show: 'gm', make() { const [p, t] = partOf(8, 24); return { story: `The tire shop had ${t} tires on the rack. Georgie sold ${p} of them by lunchtime.`, q: 'What fraction of the tires did Georgie sell?', n: p, d: t, traps: [cmp(t - p, t, 'the tires still on the rack')] }; } },
    { show: 'gm', make() { const [p, t] = partOf(6, 24); return { story: `Mandy gave the TV weather forecast for ${t} days in a row. It rained on ${t - p} of those days.`, q: 'What fraction of the days had no rain?', n: p, d: t, traps: [cmp(t - p, t, 'the rainy days')] }; } },
    { show: 'gm', make() { const [p, t] = partOf(6, 18); return { story: `Baby CeeCee has ${t - p} toys in her crib and ${p} toys on the floor.`, q: 'What fraction of her toys are on the floor?', n: p, d: t, traps: [pwT(p, t - p, 'floor toys to crib toys'), cmp(t - p, t, 'the toys in her crib')] }; } },
    { show: 'gm', make() { const [e, s] = improperOf(); return groupStory(e, s, `Mandy cut each pie into ${s} slices for a family dinner at her parents' house. Everyone ate ${e} slices.`, 'How many pies did they eat? Write it as a fraction of a pie first.'); } },

    { show: 'desc', make() { const [p, t] = partOf(6, 18); return { story: `Evie is sewing ${t} outfits for the Auradon Prep dance. She has finished ${t - p} of them.`, q: 'What fraction of the outfits does she still need to sew?', n: p, d: t, traps: [cmp(t - p, t, 'the outfits she already finished')] }; } },
    { show: 'desc', make() { const [a, t] = partOf(8, 20); const b = t - a; return { story: `Mal's spellbook has ${a} spells she has tried and ${b} spells she hasn't tried yet.`, q: 'What fraction of the spells has Mal tried?', n: a, d: t, traps: [pwT(a, b, 'tried spells to untried spells'), cmp(b, t, 'the spells she has not tried')] }; } },
    { show: 'desc', make() { const [p, t] = partOf(8, 24); return { story: `In a tourney game, Auradon Prep scored ${t} points. Jay scored ${p} of them.`, q: "What fraction of the team's points did Jay score?", n: p, d: t, traps: [cmp(t - p, t, "the points Jay's teammates scored")] }; } },
    { show: 'desc', make() { const [e, s] = improperOf(); return groupStory(e, s, `Carlos packs dog treats for Dude in bags of ${s}. He has ${e} treats.`, 'How many bags is that? Write it as a fraction of a bag first.'); } },

    { show: 'zom', make() { const [p, t] = partOf(6, 20); return { story: `Addison's cheer squad tried ${t} new stunts at practice and landed ${p} of them.`, q: 'What fraction of the stunts did they land?', n: p, d: t, traps: [cmp(t - p, t, 'the stunts they missed')] }; } },
    { show: 'zom', make() { const [p, t] = partOf(6, 20); return { story: `The Seabrook football team scored ${t} touchdowns this season. Zed scored ${p} of them.`, q: 'What fraction of the touchdowns did Zed score?', n: p, d: t, traps: [cmp(t - p, t, 'the touchdowns the rest of the team scored')] }; } },
    { show: 'zom', make() { const [a, t] = partOf(8, 24); const b = t - a; return { story: `Zed's football team has ${a} zombie players and ${b} human players.`, q: 'What fraction of the team are zombies?', n: a, d: t, traps: [pwT(a, b, 'zombie players to human players'), cmp(b, t, 'the human players')] }; } },
    { show: 'zom', make() { const [e, s] = improperOf(); return groupStory(e, s, `Addison baked ${e} cupcakes for a party in Zombietown and packed them in boxes of ${s}.`, 'How many boxes did she fill? Write it as a fraction of a box first.'); } },
  ];

  const S8 = {
    show: 'all', tok: 0, deck: [],
    init() {
      this.show = SHOWS.some((s) => s.id === Store.data.show) ? Store.data.show : 'all';
      $('#s8-shows').innerHTML = [{ id: 'all', name: 'All shows' }, ...SHOWS].map((s) => `<button type="button" class="chip" data-show="${s.id}" aria-pressed="${s.id === this.show}">${s.name}</button>`).join('');
      $('#s8-shows').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-show]');
        if (!b) return;
        Sound.play('tick');
        this.show = b.dataset.show;
        Store.data.show = this.show; Store.save();
        $$('button[data-show]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        this.deck = [];
        this.next(true);
      });
      $('#s8-work').addEventListener('click', (e) => { if (e.target.closest('#s8-next')) { Sound.play('tick'); this.next(true); } });
      this.tray = new Tray($('#s8-svg'), { top: 20, trayH: 54, gap: 12 });
      this.next(false);
    },
    refill() {
      const ids = STORIES.map((_, i) => i).filter((i) => this.show === 'all' || STORIES[i].show === this.show);
      this.deck = shuffle(ids);
      if (this.last != null && this.deck.length > 1 && this.deck[this.deck.length - 1] === this.last) this.deck.unshift(this.deck.pop());
    },
    next(user) {
      this.tok += 1;
      if (!this.deck.length) this.refill();
      this.last = this.deck.pop();
      this.tpl = STORIES[this.last];
      this.p = this.tpl.make();
      this.asks = [];
      this.trayOn = false;
      const show = SHOWS.find((s) => s.id === this.tpl.show);
      $('#s8-card').innerHTML = `<span class="showtag" style="--c:${show.c}">${show.name}</span><p class="story">${this.p.story}</p><p class="storyq">${this.p.q}</p>`;
      $('#s8-viswrap').hidden = true;
      $('#s8-eq').innerHTML = '';
      $('#s8-work').innerHTML = '';
      note('#s8-note', 'Read the whole story first. What part is the question asking about? What is the whole?');
      const { n, d, traps } = this.p, tok = this.tok;
      this.asks.push(ask($('#s8-work'), {
        st: 'story',
        lead: "Step 1: write the fraction from the story. Don't simplify yet.",
        tpl: '[[frac:a,b]]',
        help: () => (n > d ? 'The bottom is how many make one group. The top is how many there are in all.' : 'Top: the part the question asks about. Bottom: the whole group, all of them together.'),
        check: (v) => {
          if (v.a == null || v.b == null) return { invalid: true, msg: 'Fill in the top and the bottom.' };
          if (v.b === 0) return { invalid: true, msg: "The bottom can't be 0." };
          if (v.a === n && v.b === d) return { ok: true, msg: `Yes: ${frac(n, d)}.`, sound: 'tick' };
          if (v.a * d === n * v.b) return { ok: true, msg: `That's ${frac(n, d)} already simplified in your head. Nice!`, sound: 'tick' };
          const trap = traps.find((t) => t.n * v.b === v.a * t.d);
          if (trap) return { kind: trap.kind, msg: trap.msg };
          return { kind: 'other', msg: 'Read the story again. Which number is the part the question asks about, and which is the whole?' };
        },
        onOk: () => { if (tok === this.tok) this.step2(); },
        focus: user,
      }));
    },
    fitsTray() { const { n, d } = this.p; return d <= Tray.maxPieces($('#s8-svg')) && n <= 3 * d; },
    onShow() { if (this.trayOn) { this.tray.draw(this.p.n, this.p.d); if (this.snapped) this.tray.chunk(gcd(this.p.n, this.p.d), false); } },
    step2() {
      const { n, d } = this.p, tok = this.tok;
      $('#s8-viswrap').hidden = false;
      $('#s8-eq').innerHTML = frac(n, d);
      this.snapped = false;
      if (this.fitsTray()) { this.trayOn = true; this.tray.draw(n, d); }
      this.asks.push(ask($('#s8-work'), {
        st: 'story',
        lead: `Step 2: simplify it${n > d ? ', and write it as a mixed number' : ''}.`,
        tpl: `${frac(n, d)} = [[mixed:w,a,b]]`,
        check: checkFinal(n, d),
        onOk: () => { if (tok === this.tok) this.finish(); },
      }));
    },
    finish() {
      const { n, d } = this.p, G = gcd(n, d);
      if (this.trayOn && G > 1) { this.tray.chunk(G, true); this.snapped = true; Sound.play('snap'); }
      const ans = simplest(n, d);
      $('#s8-eq').innerHTML = `${frac(n, d)}${G > 1 ? ops(`÷ ${G}`, `÷ ${G}`) : EQ}${G > 1 ? frac(n / G, d / G) : ''}${n > d ? `${EQ}${showVal(ans)}` : ''}`;
      const clean = this.asks.every((a) => a.tries === 0);
      note('#s8-note', `${clean ? 'Read it right and solved it with no misses!' : 'Solved! Try the next one with no misses.'} The answer is ${showVal(ans)}.`, 'good');
      finishItem('story', `${this.tpl.show}:${n}/${d}`, clean, 3);
      const nb = document.createElement('div');
      nb.className = 'ask-btns';
      nb.innerHTML = '<button type="button" class="btn primary" id="s8-next">Next story</button>';
      $('#s8-work').appendChild(nb);
      if (booted) $('#s8-next').focus({ preventScroll: true });
    },
  };

  /* ================= coach report (for the grown-up) ================= */
  function renderCoach() {
    const S = Store.data.stats || {};
    const kinds = {};
    let wrong = 0, quick = 0;
    const rows = STATIONS.map((s) => {
      const b = S[s.id] ? Track.bucket(s.id) : null;
      if (!b) return `<tr><td>${s.name}</td><td>0</td><td>none yet</td><td>0</td><td>0</td></tr>`;
      wrong += b.wrong; quick += b.quick;
      Object.entries(b.kinds || {}).forEach(([k, v]) => { kinds[k] = (kinds[k] || 0) + v; });
      const pct = b.items ? `${Math.round((100 * b.clean) / b.items)}%` : 'none yet';
      return `<tr><td>${s.name}</td><td>${b.items}</td><td>${pct}</td><td>${b.wrong}</td><td>${b.quick}</td></tr>`;
    }).join('');
    const top = Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const guessy = STATIONS.filter((s) => { const b = S[s.id] ? Track.bucket(s.id) : null; return b && b.wrong >= 4 && b.quick / b.wrong >= 0.5; }).map((s) => s.name);
    const guided = S.challenge ? Track.bucket('challenge').guided : 0;
    $('#coach-body').innerHTML = `
      <div class="tablewrap"><table>
        <thead><tr><th scope="col">Station</th><th scope="col">Finished</th><th scope="col">No misses</th><th scope="col">Wrong answers</th><th scope="col">Quick wrong answers</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <h3>Most common mistakes</h3>
      ${top.length ? `<ol class="kinds">${top.map(([k, v]) => `<li><span class="kc">${v}</span>${KIND[k] || k}</li>`).join('')}</ol>` : '<p>No mistakes recorded yet.</p>'}
      <h3>Guessing check</h3>
      <p>${wrong ? `${quick} of ${wrong} wrong answers came within ${QUICK_MS / 1000} seconds of the question showing up.` : 'No wrong answers yet.'} ${guessy.length ? `Most quick misses: ${guessy.join(', ')}.` : ''} The Challenge switched to step-by-step mode ${guided} time${guided === 1 ? '' : 's'}.</p>
      <p class="fine">"No misses" means finished without a single wrong answer. Only those fill the station meters. Stats are stored on this device only.</p>`;
  }

  /* ================= startup ================= */
  Object.assign(MODS, { pieces: S1, rule: S2, rainbow: S3, primes: S4, wholes: S5, detective: S6, story: S8, challenge: S7 });

  function syncSound() {
    const sb = $('#soundBtn');
    sb.setAttribute('aria-pressed', String(Sound.on));
    sb.setAttribute('aria-label', Sound.on ? 'Sound on' : 'Sound off');
    $$('.wave', sb).forEach((w) => { w.style.display = Sound.on ? '' : 'none'; });
  }
  function twoTap(btn, label, armedLabel, action) {
    let armed = 0;
    btn.addEventListener('click', () => {
      if (!armed) {
        btn.textContent = armedLabel;
        armed = window.setTimeout(() => { armed = 0; btn.textContent = label; }, 4000);
        return;
      }
      window.clearTimeout(armed); armed = 0;
      btn.textContent = label;
      action();
    });
  }

  function init() {
    renderStars(false);
    syncSound();
    $('#soundBtn').addEventListener('click', () => { Store.data.sound = !Sound.on; Store.save(); syncSound(); Sound.play('tick'); });

    const rb = $('#rulebook'), rbtn = $('#ruleBtn');
    const setRB = (open) => { rb.hidden = !open; rbtn.setAttribute('aria-expanded', String(open)); if (open) $('#rbClose').focus(); };
    rbtn.addEventListener('click', () => { Sound.play('tick'); setRB(rb.hidden); });
    $('#rbClose').addEventListener('click', () => { setRB(false); rbtn.focus(); });

    const coach = $('#coach'), scrim = $('#scrim'), cbtn = $('#coachBtn');
    const setCoach = (open) => { coach.hidden = !open; scrim.hidden = !open; if (open) { renderCoach(); $('#coachClose').focus(); } else cbtn.focus(); };
    cbtn.addEventListener('click', () => setCoach(true));
    $('#coachClose').addEventListener('click', () => setCoach(false));
    scrim.addEventListener('click', () => setCoach(false));
    twoTap($('#coachReset'), 'Clear these stats', 'Tap again to clear', () => { Store.data.stats = {}; Store.save(); renderCoach(); });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!coach.hidden) setCoach(false);
      else if (!rb.hidden) { setRB(false); rbtn.focus(); }
    });

    $('#path').addEventListener('click', (e) => {
      const b = e.target.closest('.step');
      if (!b) return;
      Sound.play('tick');
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      show(b.dataset.st, true);
    });

    twoTap($('#resetBtn'), 'Reset progress', 'Tap again to reset everything', () => {
      Store.reset();
      renderStars(false);
      STATIONS.forEach((s) => renderMeter(s.id));
      renderPath();
      S7.streak = 0; S7.queue = []; S7.renderStats();
      S6.queue = [];
      S2.renderScen();
      toast('Progress reset. Fresh start!');
    });

    Keypad.init();
    Object.values(MODS).forEach((m) => m.init());
    Hero.init();
    show(current);
    booted = true;

    let rT = 0, lastW = window.innerWidth;
    window.addEventListener('resize', () => {
      window.clearTimeout(rT);
      rT = window.setTimeout(() => {
        if (Math.abs(window.innerWidth - lastW) < 2) return;
        lastW = window.innerWidth;
        Hero.redraw();
        const m = MODS[current];
        if (m && m.onShow) m.onShow();
      }, 180);
    });
  }

  init();
})();
