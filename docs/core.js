/* JOKKOO – noyau : état, routeur par rôle, cache local (IndexedDB), synchronisation Supabase.
   Principe : les droits réels sont dans PostgreSQL (RLS). Ici on ne fait que masquer ce qui ne sert pas. */
const FORM_ID = '00000000-0000-0000-0000-00000000f001';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
let db = { diagnostics: [] }, currentId = null, currentVisit = 0, view = 'dashboard', sb = null, syncing = false, saveT = null;
const ME = { user: null, profile: null, offline: false, communes: [], profiles: [], adminCommunes: [], notifs: [], platform: null, syncError: '' };
const VIEWS = {};

/* ---------- libellés et utilitaires ---------- */
const S2L = { draft: 'Brouillon', in_progress: 'Sauvegardée', completed: 'Définitive', validated: 'Validée', archived: 'Archivée' };
const L2S = { 'Brouillon': 'draft', 'Sauvegardée': 'in_progress', 'Définitive': 'completed' };
const ROLE_LBL = { super_admin: 'Super admin', admin: 'Administrateur', enqueteur: 'Enquêteur' };
const STAT_LBL = { pending: 'En attente', active: 'Actif', inactive: 'Inactif', rejected: 'Refusé', deleted: 'Supprimé' };
const STAT_CLS = { pending: 'b-draft', active: 'b-final', inactive: 'b-warning', rejected: 'b-warning', deleted: 'b-warning' };
const isFinal = d => ['Définitive', 'Validée', 'Archivée'].includes(d.status);
const badgeCls = s => s === 'Définitive' || s === 'Validée' ? 'b-final' : s === 'Sauvegardée' || s === 'Archivée' ? 'b-saved' : 'b-draft';
const fullName = p => p ? ([p.prenom, p.nom].filter(Boolean).join(' ') || p.email || '—') : '—';
const communeName = id => (ME.communes.find(c => c.id === id) || {}).nom || '';
const profileById = id => ME.profiles.find(p => p.id === id);
const IMG_FILES = { hero: 'assets/taatan-hero.jpg', logo: 'assets/taatan-logo.jpg', icon: 'assets/icon-192.png' };
const IMG = k => (window.JOKKOO_IMG && window.JOKKOO_IMG[k]) || IMG_FILES[k];   // branding.js (texte) sinon fichiers assets/
const role = () => ME.profile ? ME.profile.role : null;
const isStaff = () => role() === 'admin' || role() === 'super_admin';
const dmy = s => s ? new Date(s).toLocaleDateString('fr-FR') : '—';
const dmyhm = s => s ? new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2);
function toast(t) { const x = $('#toast'); x.textContent = t; x.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => x.classList.remove('show'), 3000) }
function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="modal-card">${html}</div>`; m.classList.add('open') }
function closeModal() { $('#modal').classList.remove('open') }
function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500) }
const errMsg = e => (e && e.message) || String(e || 'Erreur');

/* ---------- Supabase : configuration publique uniquement ---------- */
function healUrl(c) { // l'identifiant du projet est inscrit dans la clé anon : on corrige toute URL .supabase.co qui ne lui correspond pas
  try {
    if (!c || !c.url || !c.anonKey || !/\.supabase\.co/i.test(c.url)) return c;
    const ref = JSON.parse(atob(c.anonKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).ref;
    if (ref && !new RegExp('^https?://' + ref + '\\.supabase\\.co', 'i').test(c.url.trim())) return Object.assign({}, c, { url: 'https://' + ref + '.supabase.co' });
  } catch { }
  return c;
}
function getCfg() {
  const c = window.JOKKOO_CONFIG || {};
  if (c.url && c.anonKey) return healUrl(c);
  try { return healUrl(JSON.parse(localStorage.getItem('jokkoo_supabase') || 'null') || {}) } catch { return {} }
}
function isSecretKey(k) { // refuse toute clé privée (service_role / sb_secret_)
  if (!k) return false;
  if (/^sb_secret_/.test(k)) return true;
  try { return JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role' } catch { return false }
}
function initSb() {
  const c = getCfg();
  if (!c.url || !c.anonKey || isSecretKey(c.anonKey) || !window.supabase) return null;
  return window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
}

/* ---------- IndexedDB : un cache par utilisateur (plusieurs comptes sur un même téléphone) ---------- */
const IDB = {
  db: null,
  open(name) {
    return new Promise((res, rej) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { this.db = r.result; res() };
      r.onerror = () => rej(r.error);
    });
  },
  get(k) { return new Promise(res => { const r = this.db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined) }) },
  set(k, v) { return new Promise(res => { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false) }) }
};
function saveDB() { clearTimeout(saveT); saveT = setTimeout(flushDB, 400); updateSync() }
async function flushDB() { if (IDB.db && ME.profile) await IDB.set('db', db) }
addEventListener('pagehide', flushDB);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushDB() });
const pendingCount = () => db.diagnostics.filter(d => d._dirty && d.meta.enqueteurId === (ME.profile || {}).id).length;
function touch(d) { d._dirty = true; d._v = (d._v || 0) + 1; d.updatedAt = new Date().toISOString(); saveDB(); clearTimeout(touch._t); touch._t = setTimeout(() => syncNow(), 4000) }
function fixNom(d) { if (!d.meta.nom && d.answers && d.answers.nom) d.meta.nom = d.answers.nom }

/* ---------- conversion serveur <-> local ---------- */
function fromServer(s) {
  const ag = profileById(s.enqueteur_id);
  const d = {
    id: s.id, numero: s.numero || s.numero_local, createdAt: s.created_at, updatedAt: s.updated_at,
    status: S2L[s.statut] || 'Brouillon',
    meta: { nom: s.nom_structure || '', date: s.date_enquete || '', commune: communeName(s.commune_id), agent: ag ? fullName(ag) : '', communeId: s.commune_id, enqueteurId: s.enqueteur_id },
    answers: s.answers || {}, photos: s.photos || {}, history: s.historique || [], _server: true
  };
  fixNom(d); return d;
}
const cleanPhotos = d => Object.fromEntries(Object.entries(d.photos || {}).filter(([, v]) => v && !String(v).startsWith('data:')));
function toServer(d, full) {
  const o = { statut: L2S[d.status] || 'draft', nom_structure: d.meta.nom || null, date_enquete: d.meta.date || null, answers: d.answers, photos: cleanPhotos(d), historique: d.history || [], numero_local: d.numero_local || null };
  if (full) { o.id = d.id; o.enqueteur_id = ME.profile.id; o.commune_id = ME.profile.commune_id; o.formulaire_id = FORM_ID }
  return o;
}
async function uploadPhotos(d) {
  let ok = true;
  for (const [q, v] of Object.entries(d.photos || {})) {
    if (!v || !String(v).startsWith('data:')) continue;
    try {
      const blob = await (await fetch(v)).blob(), path = `${ME.profile.id}/${d.id}/${q}.jpg`;
      const r = await sb.storage.from('photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (r.error) throw r.error;
      (d._thumbs = d._thumbs || {})[q] = v; d.photos[q] = path;
    } catch (e) { ok = false; console.warn('photo', e) }
  }
  return ok;
}
const photoSrc = (d, q) => { const p = (d.photos || {})[q]; if (!p) return ''; if (String(p).startsWith('data:')) return p; return ((d._thumbs || {})[q]) || '' };
async function resolvePhotos() { // photos stockées sur le serveur : URL signée à la demande
  if (!sb || ME.offline || !navigator.onLine) return;
  for (const img of document.querySelectorAll('img[data-path]')) {
    const r = await sb.storage.from('photos').createSignedUrl(img.dataset.path, 600);
    if (r.data) img.src = r.data.signedUrl;
  }
}

/* ---------- récupération depuis le serveur ---------- */
async function refreshProfiles() {
  if (!sb || ME.offline || !navigator.onLine) return;
  const cs = await sb.from('communes').select('*').order('nom'); if (!cs.error) ME.communes = cs.data;
  const ps = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (!ps.error) {
    ME.profiles = ps.data;
    // Certaines anciennes fiches n'ont pas user_id rempli : dans ce cas l'id du profil
    // correspond à auth.uid(). On accepte donc les deux formes.
    const me = ps.data.find(p => (p.user_id || p.id) === ME.user.id);
    if (me) { ME.profile = me; localStorage.setItem('jokkoo_last', JSON.stringify({ uid: ME.user.id, email: ME.user.email, profile: me })) }
  }
  if (isStaff()) { const ac = await sb.from('admin_communes').select('*'); if (!ac.error) ME.adminCommunes = ac.data }
}
async function pullAll() {
  if (!sb || ME.offline || !navigator.onLine || !ME.profile) return;
  await refreshProfiles();
  let all = [], from = 0;
  for (; ;) {
    const r = await sb.from('enquetes').select('*').order('created_at', { ascending: false }).range(from, from + 499);
    if (r.error) throw r.error;
    all = all.concat(r.data); if (r.data.length < 500) break; from += 500;
  }
  mergeServer(all);
  await loadNotifs();
}
function mergeServer(rows) {
  const byId = new Map(db.diagnostics.map(d => [d.id, d])), out = [];
  for (const s of rows) {
    const l = byId.get(s.id); byId.delete(s.id);
    const locked = ['completed', 'validated', 'archived'].includes(s.statut);
    if (l && l._dirty && !l._conflict && !locked) { out.push(l); continue }
    if (l && l._dirty && locked && l.status !== 'Définitive') toast('Une fiche a déjà été finalisée sur le serveur : la version du serveur est conservée.');
    const n = fromServer(s); if (l && l._thumbs) n._thumbs = l._thumbs; out.push(n);
  }
  for (const l of byId.values()) if (l._dirty || !l._server) out.push(l); // jamais envoyées : on les garde
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  db.diagnostics = out; saveDB();
}
async function loadNotifs() {
  if (!sb || ME.offline || !ME.profile) return;
  const r = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(80);
  if (!r.error) { ME.notifs = r.data; updateBell() }
}
function updateBell() {
  const n = ME.notifs.filter(x => !x.lu).length, b = $('#bellBadge');
  if (b) { b.textContent = n; b.hidden = !n }
}

/* ---------- synchronisation (enquêteur : envoi + réception ; staff : lecture) ---------- */
function updateSync() {
  const el = $('#syncStatus'), n = pendingCount(), on = navigator.onLine && !ME.offline;
  if (!el) return;
  el.textContent = ME.syncError ? '● Synchronisation à réessayer' : syncing ? '↻ Synchronisation…' : !on ? `● Hors ligne${n ? ' — ' + n + ' à envoyer' : ''}` : n ? `● ${n} en attente d’envoi` : '● Synchronisé';
  const t = $('#netText'), dot = $('#netDot');
  if (t) t.textContent = on ? 'Connexion disponible' : 'Hors connexion';
  if (dot) dot.style.background = on ? '#16a66a' : '#d7a62a';
}
async function syncNow(manual) {
  if (syncing || !sb || !ME.profile) return;
  if (ME.offline || !navigator.onLine) { if (manual) toast('Hors connexion : la synchronisation reprendra automatiquement'); updateSync(); return }
  syncing = true; ME.syncError = ''; updateSync();
  try {
    if (role() === 'enqueteur') {
      for (const d of db.diagnostics.filter(x => x._dirty && x.meta.enqueteurId === ME.profile.id)) {
        const v = d._v || 0, photosOk = await uploadPhotos(d);
        const up = await sb.from('enquetes').update(toServer(d)).eq('id', d.id).select('id,numero');
        if (up.error) throw up.error;
        let row = up.data[0];
        if (!row) { // pas de ligne modifiable : nouvelle fiche, ou fiche déjà verrouillée côté serveur
          const ins = await sb.from('enquetes').insert(toServer(d, true)).select('id,numero');
          if (ins.error) { if (ins.error.code === '23505') { d._conflict = true; d._dirty = false; continue } throw ins.error }
          row = ins.data[0];
        }
        d.numero = row.numero || d.numero; d._server = true;
        if (photosOk && (d._v || 0) === v) d._dirty = false;
      }
    }
    await pullAll();
  } catch (e) { ME.syncError = errMsg(e); console.warn('sync', e) }
  finally { syncing = false; saveDB(); updateSync(); if (manual) toast(ME.syncError ? 'Synchronisation à réessayer : ' + ME.syncError : 'Synchronisation terminée'); if (!document.hidden && view === 'dashboard') render() }
}
addEventListener('online', async () => { updateSync(); if (ME.offline && window.revalidate) await revalidate(); syncNow() });
addEventListener('offline', updateSync);

/* ---------- routeur ---------- */
const MENUS = {
  enqueteur: [['dashboard', '▦', 'Tableau de bord'], ['new', '＋', 'Nouvelle enquête'], ['list', '▤', 'Mes enquêtes'], ['organisations', '◉', 'Organisations'], ['rapports', '▣', 'Mes rapports'], ['stats', '◔', 'Statistiques'], ['referentiel', '⌘', 'Référentiel de notation'], ['exports', '⇩', 'Exports'], ['notifications', '🔔', 'Notifications'], ['profile', '☺', 'Mon profil'], ['settings', '⚙', 'Paramètres']],
  admin: [['dashboard', '▦', 'Tableau de bord'], ['enquetes', '▤', 'Enquêtes'], ['users', '◉', 'Enquêteurs'], ['rapports', '▣', 'Rapports'], ['archive', '⇩', 'Archive Excel'], ['stats', '◔', 'Statistiques'], ['notifications', '🔔', 'Notifications'], ['profile', '☺', 'Mon profil']],
  super_admin: [['dashboard', '▦', 'Tableau de bord'], ['users', '◉', 'Utilisateurs'], ['pending', '⏳', 'Inscriptions en attente'], ['admins', '★', 'Administrateurs'], ['communes', '⌂', 'Communes'], ['enquetes', '▤', 'Enquêtes'], ['rapports', '▣', 'Rapports'], ['archive', '⇩', 'Archive Excel'], ['stats', '◔', 'Statistiques'], ['notifications', '🔔', 'Notifications'], ['audit', '☰', 'Journal d’activité'], ['platform', '⚙', 'Paramètres'], ['referentiel', '⌘', 'Référentiel de notation'], ['profile', '☺', 'Mon profil']]
};
const TITLES = { dashboard: 'Tableau de bord', new: 'Fiche diagnostic', list: 'Mes enquêtes', rapports: 'Rapports', stats: 'Statistiques', referentiel: 'Référentiel de notation', exports: 'Exports', notifications: 'Notifications', profile: 'Mon profil', settings: 'Paramètres', enquetes: 'Enquêtes', users: 'Utilisateurs', pending: 'Inscriptions en attente', admins: 'Administrateurs', communes: 'Communes', audit: 'Journal d’activité', platform: 'Paramètres de la plateforme', organisations: 'Organisations', archive: 'Archive Excel' };
function buildNav() {
  const items = MENUS[role()] || [];
  $('#sidebar nav').innerHTML = items.map(([v, ic, l]) => `<button data-view="${v}">${ic} ${l}${v === 'pending' ? '<span class="nav-badge" id="pendingBadge" hidden></span>' : ''}</button>`).join('');
  document.querySelectorAll('#sidebar nav button').forEach(b => b.onclick = () => b.dataset.view === 'new' ? newDiagnostic() : nav(b.dataset.view));
  const bi = $('#brandImg'); if (bi) bi.src = IMG('logo'); const tl = $('#topLogo'); if (tl) tl.src = IMG('logo');
  $('#newTop').hidden = role() !== 'enqueteur';
  $('#userChip').innerHTML = `<b>${esc(fullName(ME.profile))}</b><span>${esc(ROLE_LBL[role()] || '')}${ME.profile.commune_id ? ' · ' + esc(communeName(ME.profile.commune_id)) : ''}</span>`;
  updatePendingBadge();
}
function updatePendingBadge() {
  const b = $('#pendingBadge'); if (!b) return;
  const n = ME.profiles.filter(p => p.statut === 'pending').length; b.textContent = n; b.hidden = !n;
}
function allowed(v) { return v === 'new' || (MENUS[role()] || []).some(m => m[0] === v) }
function nav(v) {
  if (!allowed(v)) v = 'dashboard';
  view = v;
  $('#pageTitle').textContent = v === 'new' && role() === 'enqueteur' && !getCurrent() ? 'Nouvelle enquête' : (TITLES[v] || 'JOKKOO');
  document.querySelectorAll('#sidebar nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('#sidebar').classList.remove('open');
  render();
}
function render() {
  if (!ME.profile) return;
  const f = VIEWS[view] || VIEWS.dashboard;
  const fail = e => { console.error(e); $('#content').innerHTML = `<div class="empty">Une erreur est survenue : ${esc(errMsg(e))}</div>` };
  try { const r = f(); if (r && r.catch) r.catch(fail) } catch (e) { fail(e) }
  updatePendingBadge(); resolvePhotos();
}
VIEWS.dashboard = () => ({ enqueteur: dashEnqueteur, admin: dashAdmin, super_admin: dashSuper }[role()] || (() => { }))();

/* petits composants communs */
const kpi = (n, l, c) => `<div class="card stat" style="border-top-color:${c || 'var(--green)'}"><div><div class="num">${n}</div><div class="lbl">${l}</div></div></div>`;
const kpiBlock = (title, items) => `<div class="section-title"><h2>${title}</h2></div><div class="grid">${items.map(i => kpi(i[0], i[1], i[2])).join('')}</div>`;
const statusBadge = p => `<span class="badge ${STAT_CLS[p.statut] || ''}">${STAT_LBL[p.statut] || p.statut}</span>`;
function tableOf(heads, rows, empty) {
  if (!rows.length) return `<div class="empty">${empty || 'Aucun élément.'}</div>`;
  return `<div class="card table-wrap"><table class="table"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function daysSeries(ds, n) {
  const out = []; for (let i = n - 1; i >= 0; i--) { const dt = new Date(); dt.setDate(dt.getDate() - i); out.push({ k: dt.toISOString().slice(0, 10), n: 0 }) }
  ds.forEach(d => { const k = String(d.createdAt || '').slice(0, 10), x = out.find(o => o.k === k); if (x) x.n++ });
  return out;
}
function barsOf(series) {
  const mx = Math.max(1, ...series.map(s => s.n));
  return `<div class="spark">${series.map(s => `<div title="${s.k} : ${s.n}"><i style="height:${Math.round(s.n / mx * 100)}%"></i><small>${s.k.slice(8)}</small></div>`).join('')}</div>`;
}
const sameDay = (a, b) => String(a).slice(0, 10) === String(b).slice(0, 10);
const since = (d, days) => new Date(d) >= new Date(Date.now() - days * 864e5);
