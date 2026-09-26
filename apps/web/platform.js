/* =====================================================================
   PLATFORM — identity, private sync, the class store and live sessions,
   via the page's runtime capabilities. Everything degrades to local-only.
   db layout: data/users/<id>/sync (private) · progress/<id> (own; admins
   read all) · classes/<id> (admins write) · live/state (admins write) ·
   leader/<id> (own; all read). room topic "predict" is open to students.
===================================================================== */
const Platform = (() => {
  let resolveReady; const P = { id: null, name: null, canEdit: false, db: null, user: null, room: null, classes: [], ready: new Promise(r => resolveReady = r) };
  const summary = () => { const S = Store.get(), A = S.attempts || []; return { bkt: S.bkt || {}, lessons: S.progress || {}, n: A.length, right: A.filter(a => a.ok).length, wrong: A.filter(a => !a.ok && a.sig).slice(-20).map(a => ({ item: a.item, sig: a.sig })), classes: S.joined || [], at: Date.now() }; };
  P.init = async () => {
    try {
      const [user, db, room] = await Promise.all([Cap.use('user'), Cap.use('db'), Cap.use('room')]); P.user = user; P.db = db; P.room = room;
      if (user) { try { const me = await user.me(); P.id = me.id; P.name = me.name || null; P.canEdit = !!me.canEdit || !!(await user.canEdit()); } catch (e) { } }
      if (typeof Runner !== 'undefined' && Runner.token()) {
        try {
          const m = await Runner.me();
          if (m && m.user) {
            P.id = m.user.id; P.name = m.user.name; P.canEdit = true;
            try { const sp = await Runner.getProgress(); if (sp && Object.keys(sp).length) Store.merge({ progress: sp }); } catch (e) { }
            Store.setSync(async d => { try { await Runner.saveProgress(d.progress || {}); } catch (e) { } });
          }
        } catch (e) { Runner.logout(); }
      }
      if (db && P.id) {
        try { const ref = db.doc(`data/users/${P.id}/sync`); const s = await ref.get(); if (s.exists && s.data().store) Store.merge(JSON.parse(s.data().store)); let last = '', lastP = '';
          Store.setSync(async d => { const t = JSON.stringify(Object.assign({}, d, { jobs: d.jobs.slice(0, 15).map(j => Object.assign({}, j, { circuit: undefined })), layouts: undefined })); if (t !== last && t.length < 240000) { last = t; ref.set({ store: t, at: Date.now() }).catch(() => { }); }
            const sm = summary(), ps = JSON.stringify(Object.assign({}, sm, { at: 0 })); if (ps !== lastP) { lastP = ps; db.doc(`progress/${P.id}`).set(sm).catch(() => { }); } }); } catch (e) { }
        try { const q = await db.collection('classes').get(); P.classes = q.docs.map(d => Object.assign({ id: d.id }, d.data())); } catch (e) { }
        try { db.doc('live/state').onSnapshot(s => liveBanner(s.exists ? s.data() : null), () => { }); } catch (e) { }
      }
    } catch (e) { }
    resolveReady(); return P;
  };
  P.listClasses = async () => { if (!P.db) return []; const q = await P.db.collection('classes').get(); P.classes = q.docs.map(d => Object.assign({ id: d.id }, d.data())); return P.classes; };
  P.createClass = async name => { const code = Math.random().toString(36).slice(2, 5).toUpperCase() + '-' + String(Math.floor(Math.random() * 90) + 10); await P.db.collection('classes').add({ name, code, owner: P.id, assign: [], at: Date.now() }); toast(`Class created. Join code ${code}.`); };
  P.joined = () => Store.get().joined || [];
  P.join = async code => { Store.set('joined', [...new Set(P.joined().concat(code))]); };
  P.cohort = async () => { if (!P.db) return []; const q = await P.db.collection('progress').get(); const codes = new Set(P.classes.filter(c => c.owner === P.id).map(c => c.code)); return q.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(s => s.id !== P.id && (!codes.size || (s.classes || []).some(c => codes.has(c)))); };
  P.names = async ids => { const out = {}; if (!P.user || !ids.length) return out; try { const ps = await P.user.profiles(ids); ids.forEach(i => out[i] = (ps[i] && ps[i].name) || ''); } catch (e) { } return out; };
  P.assign = async (c, a) => { await P.db.doc(`classes/${c.id}`).update({ assign: (c.assign || []).concat(a) }); };
  P.setLive = async st => { if (P.db) await P.db.doc('live/state').set(st); };
  P.onPredict = f => { if (P.room) P.room.on('predict', d => f(d)); };
  P.publishBest = (id, gates) => { if (!P.db || !P.id) return; const best = Store.get().best || {}; P.db.doc(`leader/${P.id}`).set({ best, at: Date.now() }).catch(() => { }); };
  // students: a live session appears as a floating prediction card
  function liveBanner(st) {
    const old = document.getElementById('live-banner'); if (old) old.remove(); if (!st || !st.on || P.canEdit) return;
    const C = Q.parse(1, st.circuit || 'H0'), sh = h('div'); const card = h('section', { id: 'live-banner', class: 'card tint blue live-float', role: 'dialog', 'aria-label': 'Live question' }, h('div', { class: 'card-h' }, icon('live'), h('h3', {}, 'Live question'), h('button', { type: 'button', class: 'more', 'aria-label': 'Close', onclick: () => card.remove() }, icon('x'))), h('p', { class: 'small', style: { color: 'var(--ti)' } }, st.q || 'Shape your prediction.'), sh, h('button', { type: 'button', class: 'primary', onclick: () => { P.room && P.room.emit('predict', S.value).catch(() => { }); card.replaceChildren(h('p', { class: 'small' }, 'Sent. Watch the shared result on the instructor’s screen.')); setTimeout(() => card.remove(), 3000); } }, 'Send my prediction'));
    document.body.append(card); const S = Stage.Shaper(sh, { keys: Course.keysFor(C), height: 140 });
  }
  return P;
})();
