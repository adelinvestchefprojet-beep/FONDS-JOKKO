/* JOKKOO – espaces Super admin / Administrateur + écrans communs (notifications, profil).
   Chaque action appelle directement l'API : c'est la base (RLS + triggers) qui accepte ou refuse. */
const PERMS = [['enquetes.validate', 'Valider les enquêtes de son périmètre']];
const denied = r => (r.error ? r.error.message : 'droits insuffisants');
async function dbUpdate(table, patch, col, val, okMsg) {
  const r = await sb.from(table).update(patch).eq(col, val).select();
  if (r.error || !r.data.length) { toast('Refusé : ' + denied(r)); return false }
  toast(okMsg || 'Enregistré'); return true;
}
const selOpts = (arr, cur, blank) => (blank ? `<option value="">${blank}</option>` : '') + arr.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
const communesOpts = (cur, blank) => selOpts(ME.communes.map(c => [c.id, c.nom]), cur, blank);
const countOf = (f) => db.diagnostics.filter(f).length;

/* ---------- tableaux de bord ---------- */
function dashSuper() {
  const P = ME.profiles.filter(p => p.statut !== 'deleted'), ds = db.diagnostics, today = new Date().toISOString().slice(0, 10);
  const pend = P.filter(p => p.statut === 'pending');
  $('#content').innerHTML = `<div class="card hello"><div><h2 style="margin:0">Administration de la plateforme</h2><div class="muted">Connecté en tant que ${esc(fullName(ME.profile))}</div></div>${pend.length ? `<button class="btn btn-gold" onclick="nav('pending')">${pend.length} inscription(s) à valider</button>` : ''}</div>
  ${kpiBlock('Utilisateurs', [[P.length, 'Total'], [pend.length, 'En attente', 'var(--gold)'], [P.filter(p => p.statut === 'active').length, 'Actifs'], [P.filter(p => p.statut === 'inactive').length, 'Inactifs', 'var(--red)'], [P.filter(p => p.role === 'admin').length, 'Administrateurs'], [P.filter(p => p.role === 'enqueteur').length, 'Enquêteurs']])}
  ${kpiBlock('Territoire', [[ME.communes.length, 'Communes'], [ME.communes.filter(c => c.actif).length, 'Communes actives'], [ME.communes.filter(c => !c.actif).length, 'Communes inactives', 'var(--red)']])}
  ${kpiBlock('Enquêtes', [[ds.length, 'Total'], [countOf(d => sameDay(d.createdAt, today)), 'Aujourd’hui'], [countOf(d => since(d.createdAt, 7)), 'Cette semaine'], [countOf(d => since(d.createdAt, 30)), 'Ce mois'], [countOf(d => !isFinal(d)), 'En cours', 'var(--gold)'], [countOf(isFinal), 'Terminées']])}
  <div class="section-title"><h2>Activité</h2></div><div class="grid2">
  <div class="card"><h3 style="margin-top:0">Dernières inscriptions <small class="muted">(+${P.filter(p => since(p.created_at, 7)).length} cette semaine)</small></h3>${P.slice(0, 5).map(p => `<div class="row-line"><span><b>${esc(fullName(p))}</b><br><small class="muted">${esc(communeName(p.commune_id) || '—')} · ${dmy(p.created_at)}</small></span>${statusBadge(p)}</div>`).join('') || '<div class="muted">Aucune.</div>'}</div>
  <div class="card"><h3 style="margin-top:0">Dernières enquêtes</h3>${ds.slice(0, 5).map(d => `<div class="row-line"><span><b>${esc(d.meta.nom || d.numero)}</b><br><small class="muted">${esc(d.meta.commune || '—')} · ${esc(d.meta.agent || '—')}</small></span><span class="badge ${badgeCls(d.status)}">${d.status}</span></div>`).join('') || '<div class="muted">Aucune.</div>'}</div></div>
  <div class="card" style="margin-top:16px"><h3 style="margin-top:0">Activité récente</h3><div id="recentAudit" class="muted">Chargement…</div></div>`;
  loadRecentAudit();
}
async function loadRecentAudit() {
  const r = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(8), el = $('#recentAudit'); if (!el) return;
  el.innerHTML = r.error ? 'Indisponible hors ligne.' : (r.data.map(a => `<div class="row-line"><span>${typeof jrnLine === 'function' ? jrnLine(a) : esc(actorName(a.user_id) + ' — ' + a.action)}</span><small class="muted">${dmyhm(a.created_at)}</small></div>`).join('') || 'Aucune activité.');
}
const actorName = uidv => { const p = ME.profiles.find(x => x.user_id === uidv); return p ? fullName(p) : (uidv ? 'Utilisateur' : 'Système / inscription') };

function dashAdmin() {
  const ds = db.diagnostics, pr = ME.profiles.filter(p => p.role === 'enqueteur');
  $('#content').innerHTML = `<div class="card hello"><div><h2 style="margin:0">Espace administrateur</h2><div class="muted">Périmètre : toutes les communes et tous les enquêteurs. Consultation uniquement.</div></div></div>
  ${kpiBlock('Vue centrale', [[ME.communes.length, 'Communes'], [pr.length, 'Enquêteurs'], [ds.length, 'Enquêtes'], [countOf(d => since(d.createdAt, 7)), 'Cette semaine'], [countOf(d => !isFinal(d)), 'En cours', 'var(--gold)'], [countOf(d => d.status === 'Définitive'), 'Définitives']])}
  <div class="section-title"><h2>Dernières enquêtes</h2></div>${enqTable(ds.slice(0, 8))}`;
}

/* ---------- utilisateurs ---------- */
const UF = { q: '', commune: '', role: '', statut: '' };
function userRows(list) {
  const me = ME.profile.id, sa = role() === 'super_admin';
  return list.map(p => {
    const acts = [`<button class="btn btn-secondary btn-sm" onclick="userView('${p.id}')">Voir</button>`];
    if (sa && p.id !== me) {
      acts.push(`<button class="btn btn-secondary btn-sm" onclick="userEdit('${p.id}')">Modifier</button>`);
      if (p.statut === 'pending') acts.push(`<button class="btn btn-primary btn-sm" onclick="userAct('${p.id}','valider')">Valider</button><button class="btn btn-danger btn-sm" onclick="userAct('${p.id}','refuser')">Refuser</button>`);
      if (p.statut === 'active') acts.push(`<button class="btn btn-secondary btn-sm" onclick="userAct('${p.id}','desactiver')">Désactiver</button>`);
      if (p.statut === 'inactive' || p.statut === 'rejected') acts.push(`<button class="btn btn-primary btn-sm" onclick="userAct('${p.id}','reactiver')">${p.statut === 'rejected' ? 'Activer' : 'Réactiver'}</button>`);
      if (p.role !== 'super_admin') acts.push(`<select class="input sm role-select" onchange="userRole('${p.id}', this.value)" title="Changer le rôle"><option value="">Changer le rôle…</option><option value="enqueteur" ${p.role === 'enqueteur' ? 'selected' : ''}>Enquêteur</option><option value="admin" ${p.role === 'admin' ? 'selected' : ''}>Administrateur</option></select>`);
      acts.push(`<button class="btn btn-secondary btn-sm" onclick="userAct('${p.id}','reset')">Réinitialiser l’accès</button><button class="btn btn-danger btn-sm" onclick="userAct('${p.id}','supprimer')">Supprimer</button>`);
    }
    return [`<b>${esc(fullName(p))}</b>`, esc(communeName(p.commune_id) || '—'), esc(p.email || ''), esc(p.telephone || ''), esc(ROLE_LBL[p.role] || p.role), statusBadge(p), dmy(p.created_at), `<div class="acts">${acts.join('')}</div>`];
  });
}
function usersFiltered(base) {
  const q = UF.q.toLowerCase();
  return base.filter(p => (UF.statut ? p.statut === UF.statut : p.statut !== 'deleted') && (!UF.commune || p.commune_id === UF.commune) && (!UF.role || p.role === UF.role) && (!q || (fullName(p) + ' ' + (p.email || '')).toLowerCase().includes(q)));
}
VIEWS.users = () => {
  const sa = role() === 'super_admin', base = sa ? ME.profiles : ME.profiles.filter(p => p.role === 'enqueteur');
  $('#content').innerHTML = `<div class="toolbar filters"><input class="input" placeholder="Nom ou email" value="${esc(UF.q)}" onchange="UF.q=this.value;render()">
  <select class="input" onchange="UF.commune=this.value;render()">${communesOpts(UF.commune, 'Toutes les communes')}</select>
  ${sa ? `<select class="input" onchange="UF.role=this.value;render()">${selOpts([['super_admin', 'Super admin'], ['admin', 'Administrateur'], ['enqueteur', 'Enquêteur']], UF.role, 'Tous les rôles')}</select>` : ''}
  <select class="input" onchange="UF.statut=this.value;render()">${selOpts(Object.entries(STAT_LBL), UF.statut, 'Tous les statuts')}</select></div>
  ${tableOf(['Utilisateur', 'Commune', 'Email', 'Téléphone', 'Rôle', 'Statut', 'Inscrit le', 'Actions'], userRows(usersFiltered(base)), 'Aucun utilisateur.')}`;
};
VIEWS.pending = () => {
  const L = ME.profiles.filter(p => p.statut === 'pending');
  $('#content').innerHTML = `<div class="section-title"><h2>Inscriptions en attente (${L.length})</h2></div>` + tableOf(['Nom', 'Email', 'Téléphone', 'Commune', 'Date', 'Statut', 'Action'],
    L.map(p => [`<b>${esc(fullName(p))}</b>`, esc(p.email || ''), esc(p.telephone || ''), esc(communeName(p.commune_id) || '<à définir>'), dmy(p.created_at), statusBadge(p),
    `<div class="acts"><button class="btn btn-primary btn-sm" onclick="userAct('${p.id}','valider')">Valider</button><button class="btn btn-danger btn-sm" onclick="userAct('${p.id}','refuser')">Refuser</button><button class="btn btn-secondary btn-sm" onclick="userAct('${p.id}','supprimer')">Supprimer</button></div>`]), 'Aucune inscription en attente.');
};
async function userAct(id, act) {
  const p = profileById(id); if (!p) return;
  if (act === 'reset') {
    if (!confirm('Envoyer un email de réinitialisation du mot de passe à ' + p.email + ' ?')) return;
    const r = await sb.auth.resetPasswordForEmail(p.email, { redirectTo: location.origin + location.pathname }); return toast(r.error ? 'Échec : ' + r.error.message : 'Email de réinitialisation envoyé');
  }
  if (act === 'valider' && !p.commune_id && !confirm('Cet utilisateur n’a pas de commune : il ne pourra pas créer d’enquête tant qu’elle n’est pas définie (bouton Modifier). Valider quand même ?')) return;
  if (act === 'supprimer' && !confirm('Supprimer le compte de ' + fullName(p) + ' ? (archivage : il ne pourra plus se connecter)')) return;
  const map = { valider: ['active', 'Compte validé'], refuser: ['rejected', 'Inscription refusée'], desactiver: ['inactive', 'Compte désactivé'], reactiver: ['active', 'Compte réactivé'], supprimer: ['deleted', 'Compte supprimé'] };
  if (await dbUpdate('profiles', { statut: map[act][0] }, 'id', id, map[act][1])) { await refreshProfiles(); render() }
}
async function userRole(id, r) {
  if (!r || !['enqueteur','admin'].includes(r)) return;
  const p = profileById(id);
  if (!p || p.id === ME.profile.id || p.role === 'super_admin') return toast('Ce compte ne peut pas être changé ici.');

  if (r === 'enqueteur') {
    if (p.role === 'enqueteur') return toast('Le rôle est déjà « Enquêteur ».');
    if (!confirm('Retirer le rôle Administrateur à ' + fullName(p) + ' et le passer en « Enquêteur » ?')) { render(); return; }

    const result = await sb.from('profiles').update({
      role: 'enqueteur',
      statut: p.statut === 'deleted' ? 'inactive' : (p.statut || 'active')
    }).eq('id', id);

    if (result.error) {
      const e = result.error;
      toast('Rôle non modifié : ' + (e.message || 'erreur Supabase') + (e.details ? ' — ' + e.details : '') + (e.hint ? ' — ' + e.hint : ''));
      await refreshProfiles(); render(); return;
    }

    const d = await sb.from('admin_communes').delete().eq('admin_id', id);
    if (d.error && !/does not exist|relation .* does not exist/i.test(d.error.message || '')) {
      console.warn('admin_communes cleanup:', d.error.message);
    }
    toast('Rôle de ' + fullName(p) + ' changé en « Enquêteur ».');
    await refreshProfiles(); render(); return;
  }

  if (r === 'admin') {
    if (p.role === 'admin' && p.statut === 'active' && !p.commune_id) {
      return toast('Ce compte est déjà l’Administrateur central.');
    }

    const currentAdmins = ME.profiles.filter(x =>
      x.role === 'admin' && x.statut === 'active' && x.id !== id
    );

    if (!confirm(
      'Transférer le rôle ADMIN à ' + fullName(p) + ' ?\n\n' +
      (currentAdmins.length
        ? 'L’ancien administrateur actif sera automatiquement repassé Enquêteur.'
        : 'Le compte cible deviendra Administrateur central.') +
      '\n\nL’ADMIN central reste sans commune et en lecture seule sur les enquêtes.'
    )) { render(); return; }

    // On libère d'abord le rôle ADMIN existant afin que le trigger
    // "un seul admin actif" n'empêche pas la promotion de la nouvelle cible.
    for (const oldAdmin of currentAdmins) {
      const demote = await sb.from('profiles')
        .update({ role: 'enqueteur' })
        .eq('id', oldAdmin.id);

      if (demote.error) {
        const e = demote.error;
        toast('Transfert arrêté : impossible de retirer ADMIN à ' + fullName(oldAdmin) + ' : ' +
          (e.message || 'erreur Supabase') + (e.details ? ' — ' + e.details : '') +
          (e.hint ? ' — ' + e.hint : ''));
        await refreshProfiles(); render(); return;
      }

      const cleanup = await sb.from('admin_communes').delete().eq('admin_id', oldAdmin.id);
      if (cleanup.error && !/does not exist|relation .* does not exist/i.test(cleanup.error.message || '')) {
        console.warn('admin_communes cleanup:', cleanup.error.message);
      }
    }

    const promote = await sb.from('profiles')
      .update({ role: 'admin', statut: 'active', commune_id: null })
      .eq('id', id);

    if (promote.error) {
      const e = promote.error;
      toast('Promotion refusée : ' + (e.message || 'erreur Supabase') + (e.details ? ' — ' + e.details : '') +
        (e.hint ? ' — ' + e.hint : ''));
      await refreshProfiles(); render(); return;
    }

    const cleanupTarget = await sb.from('admin_communes').delete().eq('admin_id', id);
    if (cleanupTarget.error && !/does not exist|relation .* does not exist/i.test(cleanupTarget.error.message || '')) {
      console.warn('admin_communes cleanup:', cleanupTarget.error.message);
    }

    toast('ADMIN transféré à ' + fullName(p) + '.');
    await refreshProfiles();
    render();
  }
}
function userView(id) {
  const p = profileById(id), L = db.diagnostics.filter(d => d.meta.enqueteurId === id);
  openModal(`<h3 style="margin-top:0">${esc(fullName(p))}</h3><div class="detail"><div><small>Email</small>${esc(p.email || '—')}</div><div><small>Téléphone</small>${esc(p.telephone || '—')}</div><div><small>Commune</small>${esc(communeName(p.commune_id) || '—')}</div><div><small>Rôle</small>${esc(ROLE_LBL[p.role])}</div><div><small>Statut</small>${STAT_LBL[p.statut]}</div><div><small>Inscrit le</small>${dmy(p.created_at)}</div><div><small>Validé le</small>${dmy(p.approved_at)}</div>
  <div><small>Enquêtes</small>${L.length} (${L.filter(isFinal).length} terminées)</div></div><div class="toolbar" style="margin-top:14px"><button class="btn btn-secondary" onclick="closeModal()">Fermer</button></div>`);
}
function userEdit(id) {
  const p = profileById(id);
  openModal(`<h3 style="margin-top:0">Modifier le profil</h3><form onsubmit="userSave(event,'${id}')"><div class="two"><label>Prénom<input class="input" id="u_prenom" value="${esc(p.prenom || '')}"></label><label>Nom<input class="input" id="u_nom" value="${esc(p.nom || '')}"></label></div>
  <div class="two"><label>Téléphone<input class="input" id="u_tel" value="${esc(p.telephone || '')}"></label><label>Commune<select class="input" id="u_com">${communesOpts(p.commune_id, '— Aucune —')}</select></label></div>
  <div class="toolbar"><button class="btn btn-primary">Enregistrer</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button></div></form>`);
}
async function userSave(e, id) {
  e.preventDefault();
  if (await dbUpdate('profiles', { prenom: $('#u_prenom').value.trim(), nom: $('#u_nom').value.trim(), telephone: $('#u_tel').value.trim(), commune_id: $('#u_com').value || null }, 'id', id, 'Profil modifié')) { closeModal(); await refreshProfiles(); render() }
}

/* ---------- administrateurs ---------- */
VIEWS.admins = () => {
  const admins = ME.profiles.filter(p => p.role === 'admin' && p.statut !== 'deleted'), cands = ME.profiles.filter(p => p.role === 'enqueteur' && p.statut === 'active');
  $('#content').innerHTML = `<div class="card"><h3 style="margin-top:0">Promouvoir un enquêteur</h3><div class="toolbar"><select class="input" id="promo" style="max-width:340px">${selOpts(cands.map(p => [p.id, fullName(p) + ' — ' + (communeName(p.commune_id) || '—')]), '', 'Choisir un enquêteur actif…')}</select><button class="btn btn-primary" onclick="promote()">Promouvoir administrateur</button></div></div>
  <div class="section-title"><h2>Administrateurs (${admins.length})</h2></div>` + tableOf(['Administrateur', 'Statut', 'Communes (périmètre)', 'Permissions', 'Actions'], admins.map(p => [
    `<b>${esc(fullName(p))}</b><br><small class="muted">${esc(p.email || '')}</small>`, statusBadge(p),
    adminScope(p.id),
    (p.permissions || []).map(x => esc((PERMS.find(q => q[0] === x) || [0, x])[1])).join(', ') || '<span class="muted">lecture seule</span>',
    `<div class="acts"><button class="btn btn-secondary btn-sm" onclick="adminEdit('${p.id}')">Périmètre et permissions</button>${p.statut === 'active' ? `<button class="btn btn-secondary btn-sm" onclick="userAct('${p.id}','desactiver')">Désactiver</button>` : `<button class="btn btn-primary btn-sm" onclick="userAct('${p.id}','reactiver')">Réactiver</button>`}<button class="btn btn-danger btn-sm" onclick="userRole('${p.id}','enqueteur')">Retirer le rôle</button></div>`]), 'Aucun administrateur.');
};
function adminScope(id) {
  const mine = ME.adminCommunes.filter(a => a.admin_id === id).map(a => a.commune_id), act = ME.communes.filter(c => c.actif);
  if (act.length && act.every(c => mine.includes(c.id))) return '<span class="badge b-final">Administrateur global · toutes les communes</span>';
  return mine.map(m => esc(communeName(m))).join(', ') || '<span class="muted">aucune</span>';
}
async function promote() { const id = $('#promo').value; if (!id) return toast('Choisissez un enquêteur'); if (await dbUpdate('profiles', { role: 'admin' }, 'id', id, 'Promu administrateur — définissez son périmètre')) { await refreshProfiles(); render(); adminEdit(id) } }
function adminEdit(id) {
  const p = profileById(id), mine = ME.adminCommunes.filter(a => a.admin_id === id).map(a => a.commune_id);
  openModal(`<h3 style="margin-top:0">${esc(fullName(p))}</h3><p class="muted small">Un administrateur voit les communes de son périmètre (toutes les communes pour un administrateur global). Il ne peut jamais modifier les réponses ni les comptes.</p>
  <h4>Communes <button type="button" class="btn btn-secondary btn-sm" onclick="document.querySelectorAll('input[name=ac]').forEach(x=>x.checked=true)">Toutes les communes</button> <button type="button" class="btn btn-secondary btn-sm" onclick="document.querySelectorAll('input[name=ac]').forEach(x=>x.checked=false)">Aucune</button></h4><div class="checks">${ME.communes.filter(c => c.actif).map(c => `<label><input type="checkbox" name="ac" value="${c.id}" ${mine.includes(c.id) ? 'checked' : ''}> ${esc(c.nom)}</label>`).join('') || '<span class="muted">Aucune commune active.</span>'}</div>
  <h4>Permissions</h4><div class="checks">${PERMS.map(([k, l]) => `<label><input type="checkbox" name="pm" value="${k}" ${(p.permissions || []).includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
  <div class="toolbar" style="margin-top:14px"><button class="btn btn-primary" onclick="adminSave('${id}')">Enregistrer</button><button class="btn btn-secondary" onclick="closeModal()">Annuler</button></div>`);
}
async function adminSave(id) {
  const cs = [...document.querySelectorAll('input[name=ac]:checked')].map(x => x.value), pm = [...document.querySelectorAll('input[name=pm]:checked')].map(x => x.value);
  if (!await dbUpdate('profiles', { permissions: pm }, 'id', id, 'Permissions enregistrées')) return;
  const d = await sb.from('admin_communes').delete().eq('admin_id', id); if (d.error) return toast('Refusé : ' + d.error.message);
  if (cs.length) { const i = await sb.from('admin_communes').insert(cs.map(c => ({ admin_id: id, commune_id: c }))); if (i.error) return toast('Refusé : ' + i.error.message) }
  closeModal(); await refreshProfiles(); render();
}

/* ---------- communes ---------- */
VIEWS.communes = () => {
  $('#content').innerHTML = `<div class="section-title"><h2>Communes (${ME.communes.length})</h2><button class="btn btn-primary" onclick="communeEdit()">＋ Ajouter une commune</button></div>` + tableOf(['Commune', 'Code', 'Département', 'Région', 'Enquêteurs', 'Enquêtes', 'Statut', 'Actions'], ME.communes.map(c => [
    `<b>${esc(c.nom)}</b>`, esc(c.code || '—'), esc(c.departement || '—'), esc(c.region || '—'), ME.profiles.filter(p => p.commune_id === c.id && p.role === 'enqueteur' && p.statut === 'active').length, countOf(d => d.meta.communeId === c.id),
    `<span class="badge ${c.actif ? 'b-final' : 'b-warning'}">${c.actif ? 'Active' : 'Inactive'}</span>`,
    `<div class="acts"><button class="btn btn-secondary btn-sm" onclick="communeEdit('${c.id}')">Modifier</button><button class="btn btn-secondary btn-sm" onclick="communeToggle('${c.id}')">${c.actif ? 'Désactiver' : 'Activer'}</button><button class="btn btn-secondary btn-sm" onclick="UF.commune='${c.id}';UF.statut='';nav('users')">Enquêteurs</button></div>`]), 'Aucune commune : ajoutez la première.');
};
function communeEdit(id) {
  const c = ME.communes.find(x => x.id === id) || {};
  openModal(`<h3 style="margin-top:0">${id ? 'Modifier' : 'Ajouter'} une commune</h3><form onsubmit="communeSave(event,'${id || ''}')"><div class="two"><label>Nom<input class="input" id="c_nom" value="${esc(c.nom || '')}" required></label><label>Code<input class="input" id="c_code" value="${esc(c.code || '')}"></label></div>
  <div class="two"><label>Département<input class="input" id="c_dep" value="${esc(c.departement || '')}"></label><label>Région<input class="input" id="c_reg" value="${esc(c.region || '')}"></label></div>
  <div class="toolbar"><button class="btn btn-primary">Enregistrer</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button></div></form>`);
}
async function communeSave(e, id) {
  e.preventDefault(); const o = { nom: $('#c_nom').value.trim(), code: $('#c_code').value.trim() || null, departement: $('#c_dep').value.trim() || null, region: $('#c_reg').value.trim() || null };
  const r = id ? await sb.from('communes').update(o).eq('id', id).select() : await sb.from('communes').insert(o).select();
  if (r.error || !r.data.length) return toast('Refusé : ' + denied(r));
  closeModal(); toast('Commune enregistrée'); await refreshProfiles(); render();
}
async function communeToggle(id) { const c = ME.communes.find(x => x.id === id); if (await dbUpdate('communes', { actif: !c.actif }, 'id', id, c.actif ? 'Commune désactivée' : 'Commune activée')) { await refreshProfiles(); render() } }

/* ---------- enquêtes (vue staff) ---------- */
const EF = { commune: '', agent: '', statut: '', from: '', to: '' };
const sc = d => { const s = scoreDiag(d); return s.count ? Math.round(s.pct * 100) + ' %' : '—' };
function enqTable(L) {
  const sa = role() === 'super_admin';
  return tableOf(['N°', 'Organisation', 'Commune', 'Enquêteur', 'Statut', 'Date', 'Score', 'Actions'], L.map(d => [esc(d.numero), `<b>${esc(d.meta.nom || '—')}</b>`, esc(d.meta.commune || '—'), esc(d.meta.agent || '—'),
    `<span class="badge ${badgeCls(d.status)}">${d.status}</span>`, dmy(d.meta.date || d.createdAt), sc(d),
    `<div class="acts"><button class="btn btn-secondary btn-sm" onclick="openDiag('${d.id}')">Voir</button>${sa && d.status === 'Définitive' ? `<button class="btn btn-primary btn-sm" onclick="enqStatus('${d.id}','validated')">Valider</button>` : ''}${sa && (d.status === 'Validée' || d.status === 'Définitive') ? `<button class="btn btn-secondary btn-sm" onclick="enqStatus('${d.id}','archived')">Archiver</button>` : ''}</div>`]), 'Aucune enquête.');
}
VIEWS.enquetes = () => {
  const agents = [...new Set(db.diagnostics.map(d => d.meta.agent).filter(Boolean))].sort();
  const L = db.diagnostics.filter(d => (!EF.commune || d.meta.communeId === EF.commune) && (!EF.agent || d.meta.agent === EF.agent) && (!EF.statut || d.status === EF.statut) && (!EF.from || String(d.createdAt).slice(0, 10) >= EF.from) && (!EF.to || String(d.createdAt).slice(0, 10) <= EF.to));
  $('#content').innerHTML = `<div class="toolbar filters"><select class="input" onchange="EF.commune=this.value;render()">${communesOpts(EF.commune, 'Toutes les communes')}</select>
  <select class="input" onchange="EF.agent=this.value;render()">${selOpts(agents.map(a => [a, a]), EF.agent, 'Tous les enquêteurs')}</select>
  <select class="input" onchange="EF.statut=this.value;render()">${selOpts(['Brouillon', 'Sauvegardée', 'Définitive', 'Validée', 'Archivée'].map(s => [s, s]), EF.statut, 'Tous les statuts')}</select>
  <input class="input" type="date" value="${EF.from}" onchange="EF.from=this.value;render()" title="Du"><input class="input" type="date" value="${EF.to}" onchange="EF.to=this.value;render()" title="Au"></div>
  <p class="muted small">${L.length} enquête(s) sur ${db.diagnostics.length}.</p>${enqTable(L)}`;
};
async function enqStatus(id, st) {
  if (st === 'archived' && !confirm('Archiver cette enquête ?')) return;
  if (await dbUpdate('enquetes', { statut: st }, 'id', id, st === 'validated' ? 'Enquête validée' : 'Enquête archivée')) { await pullAll(); render() }
}

/* ---------- notifications ---------- */
VIEWS.notifications = async () => {
  await loadNotifs();
  $('#content').innerHTML = `<div class="section-title"><h2>Notifications</h2>${ME.notifs.some(n => !n.lu) ? '<button class="btn btn-secondary" onclick="readAll()">Tout marquer comme lu</button>' : ''}</div>` +
    (ME.notifs.length ? ME.notifs.map(n => `<div class="card notif ${n.lu ? '' : 'unread'}" onclick="readNotif('${n.id}')"><div><b>${esc(n.titre)}</b><div class="muted">${esc(n.corps || '')}</div></div><small class="muted">${dmyhm(n.created_at)}</small></div>`).join('') : '<div class="empty">Aucune notification.</div>');
};
async function readNotif(id) { const n = ME.notifs.find(x => x.id === id); if (!n || n.lu) return; const r = await sb.from('notifications').update({ lu: true }).eq('id', id); if (!r.error) { n.lu = true; updateBell(); render() } }
async function readAll() { const r = await sb.from('notifications').update({ lu: true }).eq('lu', false); if (!r.error) { ME.notifs.forEach(n => n.lu = true); updateBell(); render() } }

/* ---------- paramètres de la plateforme ---------- */
VIEWS.platform = async () => {
  const r = await sb.from('app_settings').select('*'), pf = ((r.data || []).find(x => x.cle === 'plateforme') || {}).valeur || {};
  $('#content').innerHTML = `<div class="card"><h3 style="margin-top:0">Plateforme</h3><form onsubmit="platformSave(event)"><div class="two"><label>Nom de la plateforme<input class="input" id="p_nom" value="${esc(pf.nom || '')}"></label><label>Email de contact<input class="input" id="p_mail" type="email" value="${esc(pf.contact_email || '')}"></label></div>
  <label>Téléphone de contact<input class="input" id="p_tel" value="${esc(pf.contact_telephone || '')}"></label><p class="muted small">Ces informations sont publiques (page d’accueil). Les clés secrètes et l’envoi d’emails se configurent côté serveur (Supabase), jamais ici.</p><button class="btn btn-primary">Enregistrer</button></form></div>
  <div class="card" style="margin-top:16px"><h3 style="margin-top:0">Règles en vigueur</h3><ul class="rpt-ul"><li>Toute inscription crée un compte « en attente » : seul un super admin l’active.</li><li>Un enquêteur ne voit que ses enquêtes et ne crée que dans sa commune.</li><li>Une enquête « Définitive » n’est plus modifiable par son auteur.</li><li>Le dernier super admin ne peut être ni rétrogradé, ni désactivé, ni supprimé.</li></ul></div>`;
};
async function platformSave(e) {
  e.preventDefault(); const v = { nom: $('#p_nom').value.trim() || 'JOKKOO Diagnostic', contact_email: $('#p_mail').value.trim() || null, contact_telephone: $('#p_tel').value.trim() || null };
  const r = await sb.from('app_settings').upsert({ cle: 'plateforme', valeur: v, publique: true, updated_at: new Date().toISOString(), updated_by: ME.user.id }).select();
  if (r.error) return toast('Refusé : ' + r.error.message); ME.platform = v; toast('Paramètres enregistrés');
}

/* ---------- profil ---------- */
VIEWS.profile = () => {
  const p = ME.profile;
  $('#content').innerHTML = `<div class="card"><h3 style="margin-top:0">Mon profil</h3><form onsubmit="profileSave(event)"><div class="two"><label>Prénom<input class="input" id="m_prenom" value="${esc(p.prenom || '')}"></label><label>Nom<input class="input" id="m_nom" value="${esc(p.nom || '')}"></label></div>
  <div class="two"><label>Téléphone<input class="input" id="m_tel" value="${esc(p.telephone || '')}"></label><label>Email<input class="input" value="${esc(p.email || '')}" disabled></label></div>
  <div class="two"><label>Commune<input class="input" value="${esc(communeName(p.commune_id) || '—')}" disabled></label><label>Rôle · Statut<input class="input" value="${esc(ROLE_LBL[p.role])} · ${STAT_LBL[p.statut]}" disabled></label></div>
  <p class="muted small">La commune et le rôle ne peuvent être modifiés que par l’administration.</p><button class="btn btn-primary">Enregistrer</button></form></div>
  <div class="card" style="margin-top:16px"><h3 style="margin-top:0">Changer le mot de passe</h3><form onsubmit="passSave(event)"><div class="two"><label>Nouveau mot de passe<input class="input" id="w_p1" type="password" minlength="8" autocomplete="new-password" required></label><label>Confirmation<input class="input" id="w_p2" type="password" minlength="8" autocomplete="new-password" required></label></div><button class="btn btn-secondary">Modifier le mot de passe</button></form></div>`;
};
async function profileSave(e) {
  e.preventDefault(); if (ME.offline || !navigator.onLine) return toast('Connexion requise');
  if (await dbUpdate('profiles', { prenom: $('#m_prenom').value.trim(), nom: $('#m_nom').value.trim(), telephone: $('#m_tel').value.trim() }, 'id', ME.profile.id, 'Profil enregistré')) { await refreshProfiles(); buildNav() }
}
async function passSave(e) {
  e.preventDefault(); if ($('#w_p1').value !== $('#w_p2').value) return toast('Les mots de passe ne correspondent pas');
  if (ME.offline || !navigator.onLine) return toast('Connexion requise');
  const r = await sb.auth.updateUser({ password: $('#w_p1').value }); toast(r.error ? 'Échec : ' + r.error.message : 'Mot de passe modifié'); if (!r.error) { $('#w_p1').value = ''; $('#w_p2').value = '' }
}
