/* =====================================================================
   RUNNER — shared client for the QUBIQ runner service.
   One place for base URL, health/backends/run/batch/exec/convert/transpile,
   SSE parsing, abort handling, offline state, and provenance rendering.
   Browser results get {sdk:"QUBIQ browser engine", where:"browser"} and must
   never be labelled with an SDK name (see lint_provenance).
===================================================================== */
const Runner = (() => {
  const DEFAULT_URL = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? '' : 'http://localhost:8765';
  const url = () => (Store.get().runnerUrl !== undefined ? Store.get().runnerUrl : DEFAULT_URL).replace(/\/$/, '');
  const setUrl = v => { Store.set('runnerUrl', String(v || '').trim()); };
  const token = () => Store.get().authToken || null;
  const setToken = t => { Store.set('authToken', t ? String(t).trim() : null); };
  let online = null, lastCheck = 0, listeners = new Set();
  const notify = v => { online = v; listeners.forEach(f => { try { f(v); } catch (e) { } }); };
  const onStatus = f => { listeners.add(f); return () => listeners.delete(f); };
  async function fetchJSON(path, opts = {}, timeoutMs = 10000) {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), opts.timeout || timeoutMs);
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const tok = token();
    if (tok && !headers['Authorization']) headers['Authorization'] = 'Bearer ' + tok;
    try {
      const r = await fetch(url() + path, Object.assign({}, opts, { headers, signal: opts.signal || ctl.signal }));
      if (!r.ok) {
        let detail = '';
        try { const j = await r.json(); detail = j.detail || JSON.stringify(j); } catch (e) { try { detail = await r.text(); } catch (e2) { } }
        throw Object.assign(new Error(detail || ('HTTP ' + r.status)), { status: r.status });
      }
      return await r.json();
    } finally { clearTimeout(tm); }
  }
  async function health(timeoutMs = 2500) {
    try { const j = await fetchJSON('/v1/health', {}, timeoutMs); notify(true); lastCheck = Date.now(); return j; }
    catch (e) { notify(false); lastCheck = Date.now(); throw e; }
  }
  async function backends(timeoutMs = 2500) {
    const list = await fetchJSON('/v1/backends', {}, timeoutMs);
    notify(true); return list;
  }
  async function checkRunner() {
    try { await backends(); return true; } catch (e) { return false; }
  }
  async function run({ ir, backend, shots = 1024, seed, noise, options = {} }, fetchOpts = {}) {
    return fetchJSON('/v1/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ir, backend, shots, seed, noise, options }),
      signal: fetchOpts.signal, timeout: fetchOpts.timeout || 60000,
    }, fetchOpts.timeout || 60000);
  }
  // SSE batch: yields {type:'result'|'compare', ...} as events arrive.
  async function batch({ runs, exact }, onEvent, fetchOpts = {}) {
    const ctl = new AbortController();
    const r = await fetch(url() + '/v1/run/batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({ runs, exact }), signal: fetchOpts.signal || ctl.signal,
    });
    if (!r.ok) throw new Error('Batch failed: HTTP ' + r.status);
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = '', curEvent = 'message';
    const emit = chunk => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx); buf = buf.slice(idx + 2);
        let ev = curEvent, data = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) ev = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        curEvent = 'message';
        if (!data) continue;
        try { onEvent && onEvent({ type: ev, data: JSON.parse(data) }); } catch (e) { }
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      emit(dec.decode(value, { stream: true }));
    }
    emit(dec.decode());
    return () => { try { ctl.abort(); } catch (e) { } };
  }
  async function compare(results, exact, fetchOpts = {}) {
    return fetchJSON('/v1/compare', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results, exact }), signal: fetchOpts.signal,
    }, fetchOpts.timeout || 15000);
  }
  async function exec(code, fetchOpts = {}) {
    return fetchJSON('/v1/exec', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }), signal: fetchOpts.signal,
    }, fetchOpts.timeout || 45000);
  }
  async function convert(source, source_format, target, fetchOpts = {}) {
    return fetchJSON('/v1/convert', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, source_format, target }), signal: fetchOpts.signal,
    }, fetchOpts.timeout || 15000);
  }
  async function transpile(ir, target = 'basis', optimization_level = 1, seed = 11, fetchOpts = {}) {
    return fetchJSON('/v1/transpile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ir, target, optimization_level, seed }), signal: fetchOpts.signal,
    }, fetchOpts.timeout || 30000);
  }
  function badgeText(prov) {
    if (!prov) return '';
    const parts = [];
    if (prov.sdk) parts.push(prov.sdk + (prov.sdkVersion ? ' ' + prov.sdkVersion : ''));
    if (prov.method) parts.push(prov.method);
    if (prov.seed != null) parts.push('seed ' + prov.seed);
    if (prov.shots != null) parts.push(prov.shots + ' shots');
    if (prov.ms != null) parts.push(Math.round(prov.ms) + ' ms');
    parts.push(prov.where === 'server' ? 'server' : 'browser');
    if (prov.noise) parts.push(String(prov.noise));
    return parts.filter(Boolean).join(' · ');
  }
  function provenanceBadge(prov) {
    const full = badgeText(prov);
    const short = [prov.sdk + (prov.sdkVersion ? ' ' + prov.sdkVersion : ''), prov.seed != null ? 'seed ' + prov.seed : null, (prov.shots != null ? prov.shots + ' shots' : null), prov.ms != null ? Math.round(prov.ms) + ' ms' : null].filter(Boolean).join(' · ');
    const el = h('div', { class: 'wb-prov' + (prov.where === 'server' ? ' srv' : ''), 'data-result-sdk': prov.where === 'server' ? (prov.sdk || 'server') : 'browser', title: full },
      h('i'), h('span', {}, short || full));
    return el;
  }
  async function signup(email, password, name = 'Learner') {
    const res = await fetchJSON('/v1/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) });
    if (res.token) setToken(res.token);
    return res;
  }
  async function login(email, password) {
    const res = await fetchJSON('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (res.token) setToken(res.token);
    return res;
  }
  function logout() {
    setToken(null);
  }
  async function me() {
    return fetchJSON('/v1/me');
  }
  async function listProjects() {
    return fetchJSON('/v1/projects');
  }
  async function createProject(title, ir, script = '', note = 'Initial version') {
    return fetchJSON('/v1/projects', { method: 'POST', body: JSON.stringify({ title, ir, script, note }) });
  }
  async function getProject(id) {
    return fetchJSON('/v1/projects/' + id);
  }
  async function saveProjectVersion(id, ir, script = '', note = '') {
    return fetchJSON('/v1/projects/' + id + '/versions', { method: 'POST', body: JSON.stringify({ ir, script, note }) });
  }
  async function shareProject(projectId) {
    return fetchJSON('/v1/share', { method: 'POST', body: JSON.stringify({ project_id: projectId }) });
  }
  async function getShared(tok) {
    return fetchJSON('/v1/share/' + tok);
  }
  async function getProgress() {
    return fetchJSON('/v1/progress');
  }
  async function saveProgress(data) {
    return fetchJSON('/v1/progress', { method: 'PUT', body: JSON.stringify(data) });
  }
  function isOnline() { return online; }
  return {
    url, setUrl, DEFAULT_URL, token, setToken, health, backends, checkRunner, run, batch, compare,
    exec, convert, transpile, badgeText, provenanceBadge, onStatus, isOnline,
    signup, login, logout, me, listProjects, createProject, getProject, saveProjectVersion,
    shareProject, getShared, getProgress, saveProgress
  };
})();
