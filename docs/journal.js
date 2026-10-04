/* JOKKOO – Journal d'activité lisible (super admin) : qui a fait quoi, quand, sur quoi.
   Les données viennent de la table audit_logs ; ce fichier les traduit en phrases claires. */
const JRN = { q: '', type: '', user: '', from: '', to: '', max: 150, logs: null, at: 0, err: '' };

const JRN_ROLE = r => (ROLE_LBL && ROLE_LBL[r]) || r || '';
const JRN_ENQ = { draft: 'Brouillon', in_progress: 'Sauvegardée', completed: 'Définitive', validated: 'Validée', archived: 'Archivée' };
const jrnPretty = s => { s = String(s || '').replace(/_/g, ' ').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Action' };
const jrnObj = v => (v && typeof v === 'object') ? v : {};
const jrnShort = id => id ? String(id).slice(0, 8) : '';

function jrnWho(uid) {
  const p = ME.profiles.find(x => x.user_id === uid);
  return p ? fullName(p) : (uid ? 'Utilisateur supprimé ou inconnu' : 'Système');
}
function jrnTargetProfile(a) {
  if (a.target_user_id) { const p = ME.profiles.find(x => x.user_id === a.target_user_id); if (p) return p }
  if (a.table_name === 'profiles' && a.record_id) return ME.profiles.find(x => x.id === a.record_id || x.user_id === a.record_id) || null;
  return null;
}
function jrnEnq(a) { return a.record_id ? (db.diagnostics || []).find(d => d.id === a.record_id) : null }

/* traduit une ligne du journal en : type, libellé, couleur, cible, détail */
function jrnDescribe(a) {
  const nv = jrnObj(a.nouvelle_valeur), av = jrnObj(a.ancienne_valeur), act = String(a.action || ''), tbl = a.table_name || '';
  const out = { type: 'Autre', label: jrnPretty(act), tone: 'info', cible: '', detail: '' };

  if (tbl === 'profiles' || /^(signup|status_change|role_change|user_)/.test(act)) {
    out.type = 'Compte';
    const p = jrnTargetProfile(a), nom = p ? fullName(p) : 'Compte supprimé ou inconnu';
    out.cible = nom + (p && p.commune_id ? ' (' + (communeName(p.commune_id) || '—') + ')' : '');
    if (act === 'signup') {
      out.label = 'Inscription'; out.tone = 'info';
      out.detail = 'A créé un compte' + (p ? ' ' + JRN_ROLE(p.role).toLowerCase() : '') + (p && p.statut === 'pending' ? ' — en attente de validation' : '');
    } else if (act === 'role_change' || (nv.role && av.role && nv.role !== av.role && nv.statut === av.statut)) {
      out.label = 'Rôle modifié'; out.tone = 'warn';
      out.detail = (JRN_ROLE(av.role) || '—') + ' → ' + (JRN_ROLE(nv.role) || '—');
    } else if (nv.statut) {
      const s = nv.statut, was = av.statut;
      const map = { active: [was === 'pending' || !was ? 'Compte validé' : 'Compte réactivé', 'ok', 'Peut se connecter et utiliser l’application'], inactive: ['Compte désactivé', 'warn', 'Ne peut plus se connecter'], rejected: ['Inscription refusée', 'bad', 'Demande de compte refusée'], deleted: ['Compte supprimé', 'bad', 'Le compte n’est plus accessible'], pending: ['Compte mis en attente', 'warn', 'En attente de validation'] };
      const m = map[s] || ['Statut modifié', 'info', 'Nouveau statut : ' + (STAT_LBL[s] || s)];
      out.label = m[0]; out.tone = m[1]; out.detail = m[2] + (nv.role ? ' · rôle : ' + JRN_ROLE(nv.role) : '');
    } else { out.label = 'Compte modifié'; out.tone = 'info' }
    return out;
  }

  if (tbl === 'enquetes' || /^enquete/.test(act)) {
    out.type = 'Enquête';
    const d = jrnEnq(a);
    out.cible = d ? ((d.numero || 'Fiche') + (d.meta && d.meta.nom ? ' · ' + d.meta.nom : '')) : 'Fiche ' + jrnShort(a.record_id) + ' (supprimée ou non visible)';
    const dets = []; if (d && d.meta) { if (d.meta.commune) dets.push('Commune : ' + d.meta.commune); if (d.meta.agent) dets.push('Enquêteur : ' + d.meta.agent) }
    const sfx = act.replace(/^enquete_?/, '');
    if (/create|insert/.test(sfx)) { out.label = 'Enquête créée'; out.tone = 'ok' }
    else if (/valid/.test(sfx) || nv.statut === 'validated') { out.label = 'Enquête validée'; out.tone = 'ok' }
    else if (/archiv/.test(sfx) || nv.statut === 'archived') { out.label = 'Enquête archivée'; out.tone = 'warn' }
    else if (/delete|remove|supprim/.test(sfx)) { out.label = 'Enquête supprimée'; out.tone = 'bad' }
    else if (/complet|final|submit/.test(sfx) || nv.statut === 'completed') { out.label = 'Enquête finalisée'; out.tone = 'ok' }
    else if (nv.statut) { out.label = 'Statut de l’enquête modifié'; out.tone = 'info'; dets.unshift('Nouveau statut : ' + (JRN_ENQ[nv.statut] || nv.statut)) }
    else { out.label = 'Enquête modifiée'; out.tone = 'info' }
    out.detail = dets.join(' · ');
    return out;
  }

  if (tbl === 'communes') {
    out.type = 'Commune'; out.cible = nv.nom || av.nom || communeName(a.record_id) || 'Commune';
    if (/create|insert/.test(act)) { out.label = 'Commune ajoutée'; out.tone = 'ok' }
    else if (nv.actif === false && av.actif !== false) { out.label = 'Commune désactivée'; out.tone = 'warn'; out.detail = 'N’apparaît plus à l’inscription' }
    else if (nv.actif === true && av.actif === false) { out.label = 'Commune réactivée'; out.tone = 'ok' }
    else if (/delete|remove/.test(act)) { out.label = 'Commune supprimée'; out.tone = 'bad' }
    else { out.label = 'Commune modifiée'; out.tone = 'info' }
    return out;
  }
  const pairs = Object.entries(nv).slice(0, 3).map(([k, v]) => jrnPretty(k) + ' : ' + (typeof v === 'object' ? '…' : v));
  out.detail = pairs.join(' · '); out.cible = tbl ? jrnPretty(tbl) : '';
  return out;
}

/* lignes prêtes à afficher / exporter */
function jrnRows(logs) {
  return (logs || []).map(a => { const d = jrnDescribe(a); return Object.assign({ date: a.created_at, who: jrnWho(a.user_id), whoId: a.user_id || '' }, d) });
}

async function jrnLoad(force) {
  if (!force && JRN.logs && Date.now() - JRN.at < 30000) return;
  JRN.err = '';
  const r = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(1500);
  if (r.error) { JRN.err = r.error.message; JRN.logs = []; return }
  JRN.logs = r.data || []; JRN.at = Date.now();
}
const jrnTone = t => ({ ok: 'b-final', info: 'b-saved', warn: 'b-warning', bad: 'b-draft' }[t] || 'b-saved');
function jrnFiltered() {
  const q = JRN.q.trim().toLowerCase();
  return jrnRows(JRN.logs).filter(r => (!JRN.type || r.type === JRN.type) && (!JRN.user || r.whoId === JRN.user) &&
    (!JRN.from || String(r.date).slice(0, 10) >= JRN.from) && (!JRN.to || String(r.date).slice(0, 10) <= JRN.to) &&
    (!q || [r.who, r.label, r.cible, r.detail].join(' ').toLowerCase().includes(q)));
}
function jrnReset() { Object.assign(JRN, { q: '', type: '', user: '', from: '', to: '', max: 150 }); render() }
function jrnMore() { JRN.max += 200; render() }
async function jrnRefresh() { await jrnLoad(true); render() }

VIEWS.audit = async () => {
  $('#content').innerHTML = '<div class="empty">Chargement du journal…</div>';
  await jrnLoad(false);
  if (JRN.err) { $('#content').innerHTML = `<div class="empty">Journal indisponible : ${esc(JRN.err)}</div>`; return }
  const all = jrnRows(JRN.logs), L = jrnFiltered(), today = new Date().toISOString().slice(0, 10), wk = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const users = [...new Map(all.filter(r => r.whoId).map(r => [r.whoId, r.who])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  const shown = L.slice(0, JRN.max);
  $('#content').innerHTML = `<p class="muted" style="margin-top:0">Le journal garde la trace de ce qui est fait sur la plateforme : <b>qui</b> a fait <b>quoi</b>, <b>quand</b> et <b>sur quel élément</b>. Il ne peut pas être modifié depuis l’application.</p>` +
    kpiBlock('Activité', [[all.filter(r => String(r.date).slice(0, 10) === today).length, 'Aujourd’hui'], [all.filter(r => String(r.date).slice(0, 10) >= wk).length, '7 derniers jours', 'var(--gold)'], [all.filter(r => r.type === 'Compte').length, 'Actions sur les comptes', 'var(--red)'], [all.filter(r => r.type === 'Enquête').length, 'Actions sur les enquêtes']]) +
    `<div class="toolbar filters" style="margin-top:14px"><input class="input" placeholder="Rechercher (nom, action, organisation…)" value="${esc(JRN.q)}" onchange="JRN.q=this.value;JRN.max=150;render()">
    <select class="input" onchange="JRN.type=this.value;JRN.max=150;render()">${selOpts([['Compte', 'Comptes et inscriptions'], ['Enquête', 'Enquêtes'], ['Commune', 'Communes']], JRN.type, 'Tous les types')}</select>
    <select class="input" onchange="JRN.user=this.value;JRN.max=150;render()">${selOpts(users, JRN.user, 'Toutes les personnes')}</select>
    <input class="input" type="date" value="${JRN.from}" title="Du" onchange="JRN.from=this.value;JRN.max=150;render()"><input class="input" type="date" value="${JRN.to}" title="Au" onchange="JRN.to=this.value;JRN.max=150;render()">
    <button class="btn btn-secondary" onclick="jrnReset()">Réinitialiser</button><button class="btn btn-secondary" onclick="jrnRefresh()">↻ Actualiser</button><button class="btn btn-primary" onclick="exportJournal()">⇩ Exporter en Excel</button></div>
    <p class="muted small">${L.length} action(s)${L.length !== all.length ? ' sur ' + all.length : ''} · les ${all.length >= 1500 ? '1500 plus récentes' : 'actions enregistrées'}.</p>` +
    tableOf(['Date et heure', 'Qui', 'Ce qui a été fait', 'Concerne', 'Précisions'], shown.map(r => [
      `<b>${esc(dmyhm(r.date))}</b>`, esc(r.who), `<span class="badge ${jrnTone(r.tone)}">${esc(r.label)}</span>`, esc(r.cible || '—'), `<span class="muted">${esc(r.detail || '—')}</span>`]), 'Aucune action ne correspond à ces filtres.') +
    (L.length > shown.length ? `<div class="toolbar" style="justify-content:center;margin-top:10px"><button class="btn btn-secondary" onclick="jrnMore()">Afficher plus (${L.length - shown.length} restantes)</button></div>` : '');
};

/* version courte pour le tableau de bord du super admin */
function jrnLine(a) { const d = jrnDescribe(a); return `${esc(jrnWho(a.user_id))} — ${esc(d.label)}${d.cible ? ' : ' + esc(d.cible) : ''}` }
