/* =====================================================================
   TOUR — the first visit. "Start learning" opens the Laboratory itself
   and walks the learner through it: drag H onto a wire, click the
   simulation block, watch the Bloch sphere, then a second H brings the
   qubit home (interference). Needs Workbench.tour hooks.
===================================================================== */
const Tour = (() => {
  let run = null;
  const $ = s => document.querySelector(s);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function start() {
    T.pending = false; stop();
    const W = Workbench.tour; W.fresh();
    let step = -1, raf = 0, ghostAt = 0, wire = 0, pointerDown = false, anim = null;
    const ring = h('div', { class: 'tour-ring', 'aria-hidden': 'true' });
    const ghost = h('div', { class: 'tour-ghost', 'aria-hidden': 'true' }, 'H');
    const card = h('section', { class: 'tour-card', role: 'dialog', 'aria-label': 'Laboratory tutorial' });
    document.body.append(ring, ghost, card); document.body.classList.add('touring');
    const onDown = () => { pointerDown = true; if (anim) anim.cancel(); }, onUp = () => { pointerDown = false; ghostAt = performance.now() + 900; };
    addEventListener('pointerdown', onDown, true); addEventListener('pointerup', onUp, true);

    const cells = w => { const S = W.state(); return w < S.n ? S.cols.map(c => c[w]).filter(Boolean) : []; };
    const firstH = () => { const S = W.state(); for (let w = 0; w < S.n; w++) if (cells(w).some(x => x.k === 'H')) return w; return -1; };
    const hTile = () => $('.wb-dock .wb-tile[data-k="H"]');
    const dropPoint = () => { const b = $('.wb-dblock'), wl = document.querySelectorAll('.wb-grid .wb-wl')[wire]; if (!b || !wl) return null; const r = b.getBoundingClientRect(), q = wl.getBoundingClientRect(); return { x: r.left - 26, y: q.top + q.height / 2 }; };
    const finish = where => {
      const prof = Store.get().profile || {}, nm = E.name && E.name.value.trim();
      Store.set('profile', Object.assign({}, prof, { name: nm || prof.name || null, arrived: prof.arrived || new Date().toISOString(), touredLab: true }));
      if (step >= 5) Store.note({ kind: 'field', lesson: 'arrival', title: 'First circuit', text: 'One H puts the qubit on the equator (50/50). A second H brings it back to |0⟩: the two paths to 1 cancel.', task: { kind: 'recall', label: 'Why did H then H give 0 every time?' } });
      stop(); if (where) location.hash = where; else toast('The Laboratory is yours. Press [ to hide the sidebar for more room.');
    };
    const E = {};
    const btn = (label, fn, cls = 'tour-go') => h('button', { type: 'button', class: cls, onclick: fn }, label);
    const skip = () => btn('Skip the tour', () => finish(null), 'tour-skip');

    const STEPS = [
      { target: () => $('.wb-circ .wb-gridwrap'), prefer: ['below', 'right', 'above'],
        title: 'Welcome to QUBIQ', text: 'This is the Laboratory, where everything in the course gets built. Each line is a qubit. Both start at |0⟩: an arrow pointing straight up, which always measures 0.',
        actions: () => [btn('Show me', () => go(1)), skip()] },
      { target: hTile, prefer: ['above', 'right'], ghost: true, corner: true,
        title: 'Drag H onto the first wire', text: 'H (the Hadamard gate) is in the toolbox at the bottom. Drag it up and drop it on q0.',
        done: () => { const w = firstH(); if (w < 0) return false; wire = w; return true; } },
      { target: () => $('.wb-dblock'), prefer: ['right', 'below', 'above'],
        title: 'The qubit moved', text: () => `Look at the block at the end of the wires: q${wire}'s arrow tipped over to the equator, so it now reads 1 half the time (50%). This block follows your last gate and simulates live. Click it.`,
        done: () => W.side() === 'sim' },
      { target: () => $('.wb-code'), prefer: ['left'],
        title: 'The full simulation', text: 'The code panel turned into the simulation: the chance of every outcome, the amplitudes, and a Bloch sphere for each qubit. Click the block again whenever you want the code back.',
        actions: () => [btn('Next', () => go(4)), skip()] },
      { target: hTile, prefer: ['above', 'right'], ghost: true, corner: true,
        title: 'Now a second H', text: () => `A coin flipped twice is still a coin, so two H gates should give 50/50 again. Right? Drag another H onto q${wire}, just after the first, and watch the spheres.`,
        done: () => { const c = cells(wire); return c.length === 2 && c.every(x => x.k === 'H'); } },
      { target: () => $('.wb-code'), prefer: ['left'],
        title: 'Back to |0⟩, every time', text: () => `q${wire} reads 1 with 0% chance. The first H didn’t pick a side: it split the qubit into two paths. The second H made them interfere, and the paths to 1 cancelled out. That is the whole trick of quantum computing.`,
        actions: () => { E.name = Ctl.field({ label: 'Your name (optional)', placeholder: 'Your name (optional)' }); return [E.name, btn('Find my starting point →', () => finish('#placement')), btn('Keep building here', () => finish(null), 'tour-alt'), btn('Go to the lessons', () => finish('#learn'), 'tour-skip')]; } }
    ];

    function go(i) {
      step = i; const s = STEPS[i]; ghostAt = performance.now() + 600; if (anim) anim.cancel();
      const txt = typeof s.text === 'function' ? s.text() : s.text;
      card.replaceChildren(
        h('div', { class: 'tour-top' }, h('span', { class: 'tour-n mono' }, `${i + 1} / ${STEPS.length}`), h('span', { class: 'tour-dots' }, STEPS.map((_, j) => h('i', { class: j < i ? 'd' : j === i ? 'on' : '' })))),
        h('h3', {}, s.title), h('p', {}, txt),
        ...(s.done ? [h('p', { class: 'tour-wait' }, h('span', { class: 'tour-pulse' }), i === 2 ? 'Waiting for your click…' : 'Waiting for you to drop it…')] : []),
        h('div', { class: 'tour-act' }, ...(s.actions ? s.actions() : [skip()])));
      card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
      if (i === 5 && E.name) setTimeout(() => E.name.focus({ preventScroll: true }), 50);
      else { const f = card.querySelector('.tour-go'); f && f.focus({ preventScroll: true }); }
      if (typeof announce === 'function') announce(s.title);
    }

    function place() {
      const s = STEPS[step], t = s.target(), vw = innerWidth, vh = innerHeight, cw = card.offsetWidth, ch = card.offsetHeight, m = 14;
      let r = null;
      if (t) { r = t.getBoundingClientRect(); const p = 6; Object.assign(ring.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px' }); ring.hidden = false; } else ring.hidden = true;
      let x, y;
      const main = $('.wb-main');
      if (vw <= 700) { x = m; const low = s.corner || (r && r.top + r.height / 2 < vh / 2); y = low ? vh - ch - 76 : 64; }
      else if (s.corner && main) { const mr = main.getBoundingClientRect(); x = mr.right - cw - 18; y = mr.top + 16; }
      else if (r) {
        const fits = { below: vh - r.bottom > ch + 2 * m, above: r.top > ch + 2 * m, right: vw - r.right > cw + 2 * m, left: r.left > cw + 2 * m };
        const side = s.prefer.find(k => fits[k]) || 'center';
        if (side === 'below') { x = r.left + r.width / 2 - cw / 2; y = r.bottom + m; }
        else if (side === 'above') { x = r.left + r.width / 2 - cw / 2; y = r.top - ch - m; }
        else if (side === 'right') { x = r.right + m; y = r.top + r.height / 2 - ch / 2; }
        else if (side === 'left') { x = r.left - cw - m; y = r.top + Math.min(40, r.height / 2 - ch / 2); }
        else { x = vw / 2 - cw / 2; y = vh - ch - m; }
      } else { x = vw / 2 - cw / 2; y = vh / 2 - ch / 2; }
      card.style.left = Math.max(m, Math.min(vw - cw - m, x)) + 'px'; card.style.top = Math.max(m, Math.min(vh - ch - m, y)) + 'px';
    }

    function playGhost() {
      const a = hTile(), b = dropPoint(); if (!a || !b || reduced()) return;
      const r = a.getBoundingClientRect(), fx = r.left + r.width / 2 - 20, fy = r.top + r.height / 2 - 20, tx = b.x - 20, ty = b.y - 20;
      anim = ghost.animate([
        { transform: `translate(${fx}px,${fy}px) scale(.9)`, opacity: 0 },
        { transform: `translate(${fx}px,${fy - 6}px) scale(1.05)`, opacity: .95, offset: .15 },
        { transform: `translate(${tx}px,${ty}px) scale(1.05)`, opacity: .95, offset: .72 },
        { transform: `translate(${tx}px,${ty}px) scale(.85)`, opacity: 0 }], { duration: 2000, easing: 'cubic-bezier(.45,0,.2,1)' });
    }

    function loop(now) {
      if (!run) return;
      const s = STEPS[step];
      if (s.done && s.done()) { go(step + 1); }
      place();
      if (STEPS[step].ghost && !pointerDown && now > ghostAt) { playGhost(); ghostAt = now + 2900; }
      raf = requestAnimationFrame(loop);
    }

    run = { destroy() { cancelAnimationFrame(raf); if (anim) anim.cancel(); ring.remove(); ghost.remove(); card.remove(); document.body.classList.remove('touring'); removeEventListener('pointerdown', onDown, true); removeEventListener('pointerup', onUp, true); run = null; } };
    go(0); raf = requestAnimationFrame(loop);
    return run;
  }
  function stop() { if (run) run.destroy(); }
  const T = { pending: false, start, stop, get active() { return !!run; } };
  return T;
})();
