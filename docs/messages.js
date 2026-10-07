/* JOKKOO – messagerie interne administrateur <-> enquêteurs.
   Données : tables messages / message_destinataires (voir SUPABASE_MESSAGERIE.sql). Les droits réels sont dans PostgreSQL.
   Canaux : (1) dans l'application (cloche + menu Messagerie), (2) email automatique (fonction Supabase notify-message),
            (3) WhatsApp : lien « wa.me » qui prévient l'enquêteur d'aller lire le message dans l'application. */
const MSG = { list: [], dest: [], unread: 0, ready: false, ok: true, t: 0 };
const msgMe = () => ME.profile && ME.profile.id;
const waNum = p => { let n = String(p || '').replace(/\D/g, ''); if (n.startsWith('00')) n = n.slice(2); if (n.length === 9 && n[0] === '7') n = '221' + n; return n };
const appUrl = () => location.origin + location.pathname.replace(/[^/]*$/, '');
function waLink(phone, text) { const n = waNum(phone); return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text) : '' }
const waText = p => 'Bonjour ' + (p && p.prenom ? p.prenom : '') + ', vous avez un nouveau message de l’administration JOKKOO. Ouvrez l’application pour le lire : ' + appUrl();

/* ---------- menu, titres ---------- */
['enqueteur', 'admin', 'super_admin'].forEach(r => { const a = MENUS[r], i = a.findIndex(m => m[0] === 'notifications'); a.splice(i < 0 ? a.length : i, 0, ['messages', '✉', 'Messagerie']) });
TITLES.messages = 'Messagerie';
function msgBell() { return MSG.unread ? 'messages' : 'notifications' }

/* ---------- chargement ---------- */
async function loadMessages() {
  if (!sb || ME.offline || !navigator.onLine || !ME.profile) return;
  const m = await sb.from('messages').select('*').order('created_at', { ascending: false }).limit(300);
  if (m.error) { MSG.ok = false; return }
  const d = await sb.from('message_destinataires').select('*').limit(5000);
  if (d.error) { MSG.ok = false; return }
  MSG.ok = true; MSG.list = m.data; MSG.dest = d.data; MSG.t = Date.now();
  const n = MSG.dest.filter(x => x.profil_id === msgMe() && !x.lu).length;
  if (MSG.ready && n > MSG.unread) toast('✉ Nouveau message reçu');
  MSG.unread = n; MSG.ready = true; updateBell();
}
const _loadNotifs = loadNotifs;
loadNotifs = async function () { await _loadNotifs(); await loadMessages() };
updateBell = function () {
  const n = ME.notifs.filter(x => !x.lu).length + MSG.unread, b = $('#bellBadge');
  if (b) { b.textContent = n; b.hidden = !n }
  const nb = $('#msgBadge'); if (nb) { nb.textContent = MSG.unread; nb.hidden = !MSG.unread }
};
const _buildNav = buildNav;
buildNav = function () {
  _buildNav();
  const btn = document.querySelector('#sidebar nav button[data-view="messages"]');
  if (btn) btn.insertAdjacentHTML('beforeend', '<span class="nav-badge" id="msgBadge" hidden></span>');
  updateBell();
};
document.addEventListener('visibilitychange', () => { if (!document.hidden && ME.profile) loadMessages() });

/* ---------- fils de discussion ---------- */
function msgThreads() {
  const me = msgMe(), byId = new Map(MSG.list.map(m => [m.id, m]));
  const root = m => { let x = m, g = 0; while (x.parent_id && byId.has(x.parent_id) && g++ < 25) x = byId.get(x.parent_id); return x.id };
  const T = new Map();
  MSG.list.forEach(m => { const r = root(m); if (!T.has(r)) T.set(r, []); T.get(r).push(m) });
  return [...T.entries()].map(([id, ms]) => { ms.sort((a, b) => a.created_at.localeCompare(b.created_at)); return { id, ms, last: ms[ms.length - 1] } })
    .filter(t => t.ms.some(m => m.expediteur_id === me || MSG.dest.some(d => d.message_id === m.id && d.profil_id === me)))
    .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
}
const msgUnreadIn = t => t.ms.filter(m => MSG.dest.some(d => d.message_id === m.id && d.profil_id === msgMe() && !d.lu));
function msgTo(m) {
  const D = MSG.dest.filter(x => x.message_id === m.id);
  if (D.some(x => x.profil_id === msgMe())) return 'Vous';
  if (!isStaff()) return 'Administration';
  if (m.portee === 'tous') return 'Tous les enquêteurs';
  if (m.portee === 'commune') return 'Enquêteurs · ' + (communeName(m.commune_id) || 'commune');
  const p = D[0] && profileById(D[0].profil_id); return p ? fullName(p) : 'Destinataire';
}
const msgHtml = s => esc(s).replace(/\n/g, '<br>');
const msgTitle = t => { const r = t.ms[0], e = r.enquete_id && db.diagnostics.find(d => d.id === r.enquete_id); return r.sujet || (e ? 'Enquête ' + (e.numero || '') + (e.meta.nom ? ' — ' + e.meta.nom : '') : 'Message') };

VIEWS.messages = async () => {
  if (Date.now() - MSG.t > 15000) await loadMessages();
  const staff = isStaff(), T = msgThreads();
  const head = `<div class="section-title"><h2>Messagerie</h2>${staff ? '<button class="btn btn-primary" onclick="msgCompose()">✉ Nouveau message</button>' : '<button class="btn btn-primary" onclick="msgComposeAdmin()">✉ Écrire à l’administration</button>'}</div>`;
  if (!MSG.ok) { $('#content').innerHTML = head + '<div class="empty">Messagerie indisponible (hors ligne, ou migration SUPABASE_MESSAGERIE.sql pas encore exécutée).</div>'; return }
  const hint = staff ? '<p class="muted small">Vous pouvez écrire à un enquêteur, à tous les enquêteurs d’une commune, ou à tous. Les enquêteurs peuvent vous répondre.</p>' : '<p class="muted small">Vous pouvez écrire à l’administration et répondre à ses messages.</p>';
  $('#content').innerHTML = head + hint + (T.length ? T.map(t => {
    const u = msgUnreadIn(t).length, l = t.last, who = l.expediteur_id === msgMe() ? 'Moi → ' + msgTo(t.ms[0]) : (l.expediteur_nom || 'Administration');
    return `<div class="card notif ${u ? 'unread' : ''}" onclick="msgOpen('${t.id}')"><div><b>${esc(msgTitle(t))}</b>${u ? ` <span class="badge b-warning">${u} nouveau(x)</span>` : ''}<div class="muted">${esc(l.corps.length > 120 ? l.corps.slice(0, 120) + '…' : l.corps)}</div><small class="muted">${esc(who)} · ${t.ms.length} message(s)</small></div><small class="muted">${dmyhm(l.created_at)}</small></div>`;
  }).join('') : '<div class="empty">Aucun message.</div>');
};

/* ---------- lecture d'un fil + réponse ---------- */
function msgReplyTarget(t) {
  const me = msgMe();
  if (!isStaff()) { const last = [...t.ms].reverse().find(m => m.expediteur_id !== me && MSG.dest.some(d => d.message_id === m.id && d.profil_id === me)); return last ? { parent: last.id } : null }
  const lastEnq = [...t.ms].reverse().find(m => m.expediteur_id !== me && (profileById(m.expediteur_id) || {}).role === 'enqueteur');
  if (lastEnq) return { parent: lastEnq.id, to: lastEnq.expediteur_id };
  const first = t.ms[0], d = MSG.dest.filter(x => x.message_id === first.id);
  if (first.portee === 'direct' && first.expediteur_id === me && d[0]) return { parent: t.last.id, to: d[0].profil_id };
  return null;
}
function msgReadInfo(m) {
  if (!isStaff() || m.expediteur_id !== msgMe()) return '';
  const D = MSG.dest.filter(x => x.message_id === m.id), k = D.filter(x => x.lu).length, nl = D.filter(x => !x.lu);
  let h = `<div class="muted small">Lu par ${k}/${D.length}</div>`;
  if (nl.length) {
    const rows = nl.map(x => { const p = profileById(x.profil_id), l = p && waLink(p.telephone, waText(p)); return `<div class="row-line"><span>${esc(p ? fullName(p) : 'Enquêteur')}</span>${l ? `<a class="btn btn-secondary btn-sm" href="${l}" target="_blank" rel="noopener">WhatsApp</a>` : '<small class="muted">pas de numéro</small>'}</div>` }).join('');
    h += `<details><summary class="small">Pas encore lu (${nl.length}) — prévenir sur WhatsApp</summary>${rows}</details>`;
  }
  return h;
}
async function msgOpen(rootId) {
  const t = msgThreads().find(x => x.id === rootId); if (!t) return;
  const root = t.ms[0], unread = msgUnreadIn(t).map(m => m.id), me = msgMe();
  const enq = root.enquete_id && db.diagnostics.find(d => d.id === root.enquete_id), tg = msgReplyTarget(t);
  const bubbles = t.ms.map(m => `<div class="msg-b ${m.expediteur_id === me ? 'me' : ''}"><small class="muted"><b>${esc(m.expediteur_id === me ? 'Moi' : (m.expediteur_nom || 'Administration'))}</b> → ${esc(msgTo(m))} · ${dmyhm(m.created_at)}</small><div>${msgHtml(m.corps)}</div>${msgReadInfo(m)}</div>`).join('');
  openModal(`<h3 style="margin-top:0">${esc(msgTitle(t))}</h3>${enq ? `<p><button class="btn btn-secondary btn-sm" onclick="closeModal();openDiag('${enq.id}')">Voir l’enquête ${esc(enq.numero || '')}</button></p>` : ''}
  <div class="msg-thread">${bubbles}</div>
  ${tg ? `<label>Répondre<textarea class="input" id="msg_reply" rows="3" maxlength="2000"></textarea></label><div class="toolbar"><button class="btn btn-primary" onclick="msgReply('${t.id}')">Envoyer</button><button class="btn btn-secondary" onclick="closeModal()">Fermer</button></div>`
      : `<div class="toolbar"><button class="btn btn-secondary" onclick="closeModal()">Fermer</button></div>`}`);
  if (unread.length && navigator.onLine && !ME.offline) {
    const r = await sb.rpc('marquer_messages_lus', { p_ids: unread });
    if (!r.error) { MSG.dest.forEach(d => { if (d.profil_id === me && unread.includes(d.message_id)) d.lu = true }); MSG.unread = MSG.dest.filter(x => x.profil_id === me && !x.lu).length; updateBell() }
  }
}
async function msgReply(rootId) {
  const t = msgThreads().find(x => x.id === rootId), tg = t && msgReplyTarget(t), txt = ($('#msg_reply') || {}).value;
  if (!tg || !txt || !txt.trim()) return toast('Écrivez votre réponse');
  if (ME.offline || !navigator.onLine) return toast('Connexion requise pour envoyer');
  const r = await sb.rpc('envoyer_message', { p_portee: 'direct', p_cible: tg.to || null, p_enquete: t.ms[0].enquete_id || null, p_sujet: null, p_corps: txt.trim(), p_parent: tg.parent });
  if (r.error) return toast('Refusé : ' + r.error.message);
  toast('Réponse envoyée'); await loadMessages(); if (view === 'messages') render(); msgOpen(rootId);
}

/* ---------- nouveau message (administrateur) ---------- */
function msgCompose(enqId, enqueteId) {
  if (!isStaff()) return;
  const P = ME.profiles.filter(p => p.role === 'enqueteur' && p.statut === 'active').sort((a, b) => (communeName(a.commune_id) + fullName(a)).localeCompare(communeName(b.commune_id) + fullName(b)));
  const e = enqueteId && db.diagnostics.find(d => d.id === enqueteId), pre = enqId || (e && e.meta.enqueteurId) || '';
  const comm = ME.communes.filter(c => P.some(p => p.commune_id === c.id));
  openModal(`<h3 style="margin-top:0">Nouveau message</h3>${e ? `<p class="muted">À propos de l’enquête <b>${esc(e.numero || '')}</b> — ${esc(e.meta.nom || '')}</p>` : ''}
  <form onsubmit="msgSend(event,'${enqueteId || ''}')">
  <label>Destinataire<select class="input" id="mg_portee" onchange="msgPortee()"><option value="direct">Un enquêteur</option><option value="commune">Tous les enquêteurs d’une commune</option><option value="tous">Tous les enquêteurs</option></select></label>
  <label id="mg_l_enq">Enquêteur<select class="input" id="mg_enq">${selOpts(P.map(p => [p.id, fullName(p) + ' — ' + (communeName(p.commune_id) || 'sans commune')]), pre, '— Choisir —')}</select></label>
  <label id="mg_l_com" style="display:none">Commune<select class="input" id="mg_com">${selOpts(comm.map(c => [c.id, c.nom + ' (' + P.filter(p => p.commune_id === c.id).length + ')']), '', '— Choisir —')}</select></label>
  <label>Objet (facultatif)<input class="input" id="mg_sujet" maxlength="120"></label>
  <label>Message<textarea class="input" id="mg_corps" rows="5" maxlength="2000" required></textarea></label>
  <p class="muted small">L’enquêteur est prévenu dans l’application et par email. Après l’envoi, vous pourrez aussi le relancer sur WhatsApp.</p>
  <div class="toolbar"><button class="btn btn-primary">Envoyer</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button></div></form>`);
}
function msgPortee() {
  const v = $('#mg_portee').value;
  $('#mg_l_enq').style.display = v === 'direct' ? 'block' : 'none'; $('#mg_l_com').style.display = v === 'commune' ? 'block' : 'none';
}
async function msgSend(ev, enqueteId) {
  ev.preventDefault();
  if (ME.offline || !navigator.onLine) return toast('Connexion requise pour envoyer un message');
  const portee = $('#mg_portee').value, cible = portee === 'direct' ? $('#mg_enq').value : portee === 'commune' ? $('#mg_com').value : null, corps = $('#mg_corps').value.trim();
  if (portee !== 'tous' && !cible) return toast('Choisissez le destinataire');
  if (!corps) return toast('Écrivez un message');
  if (portee === 'tous' && !confirm('Envoyer ce message à TOUS les enquêteurs actifs ?')) return;
  const r = await sb.rpc('envoyer_message', { p_portee: portee, p_cible: cible, p_enquete: enqueteId || null, p_sujet: $('#mg_sujet').value.trim() || null, p_corps: corps, p_parent: null });
  if (r.error) return toast('Refusé : ' + r.error.message);
  closeModal(); toast('Message envoyé à ' + r.data + ' enquêteur(s)');
  await loadMessages(); if (view === 'messages') render();
  const t = msgThreads()[0]; if (t) msgOpen(t.id);
}

/* ---------- nouveau message (enquêteur -> administration) ---------- */
function msgComposeAdmin() {
  if (isStaff()) return;
  const E = db.diagnostics.filter(d => d._server && d.meta.enqueteurId === msgMe());
  openModal(`<h3 style="margin-top:0">Écrire à l’administration</h3>
  <form onsubmit="msgSendAdmin(event)">
  <label>À propos d’une enquête (facultatif)<select class="input" id="ma_enq">${selOpts(E.map(d => [d.id, (d.numero || '') + ' — ' + (d.meta.nom || 'sans nom')]), '', '— Aucune —')}</select></label>
  <label>Objet (facultatif)<input class="input" id="ma_sujet" maxlength="120"></label>
  <label>Message<textarea class="input" id="ma_corps" rows="5" maxlength="2000" required></textarea></label>
  <p class="muted small">Connexion internet requise pour envoyer. Seules les enquêtes déjà synchronisées peuvent être citées.</p>
  <div class="toolbar"><button class="btn btn-primary">Envoyer</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button></div></form>`);
}
async function msgSendAdmin(ev) {
  ev.preventDefault();
  if (ME.offline || !navigator.onLine) return toast('Connexion requise pour envoyer un message');
  const corps = $('#ma_corps').value.trim(); if (!corps) return toast('Écrivez un message');
  const r = await sb.rpc('envoyer_message', { p_portee: 'direct', p_cible: null, p_enquete: $('#ma_enq').value || null, p_sujet: $('#ma_sujet').value.trim() || null, p_corps: corps, p_parent: null });
  if (r.error) return toast('Refusé : ' + r.error.message);
  closeModal(); toast('Message envoyé à l’administration');
  await loadMessages(); if (view === 'messages') render();
  const t = msgThreads()[0]; if (t) msgOpen(t.id);
}

/* ---------- page Notifications : affiche aussi le CONTENU des messages ---------- */
const N_TITRE = ['titre', 'title', 'sujet', 'objet'], N_CORPS = ['corps', 'message', 'contenu', 'body', 'texte', 'description'];
const N_SKIP = new Set(['id', 'for_user', 'for_role', 'user_id', 'lu', 'created_at', 'updated_at', 'read_at', ...N_TITRE]);
const nFirst = (n, keys) => { for (const k of keys) if (n[k]) return String(n[k]); return '' };
function nExtra(n) { // affiche tout ce que la ligne contient (type, données JSON…) quand les colonnes habituelles sont vides
  const out = [];
  for (const [k, v] of Object.entries(n)) {
    if (N_SKIP.has(k) || v == null || v === '' || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(v))) continue;
    out.push(k + ' : ' + (typeof v === 'object' ? JSON.stringify(v) : v));
  }
  return out.join(' · ');
}
const N_TYPES = { new_signup: 'Nouvelle inscription' };
const nPayload = n => { let p = n.payload; if (typeof p === 'string') { try { p = JSON.parse(p) } catch { p = null } } return p && typeof p === 'object' ? p : null };
const nTitre = n => nFirst(n, N_TITRE) || N_TYPES[n.type] || n.type || 'Notification';
const nCorps = n => {
  const direct = nFirst(n, N_CORPS); if (direct) return direct;
  const p = nPayload(n);
  if (n.type === 'new_signup' && p) return [p.nom, p.email].filter(Boolean).join(' · ') + ' — compte en attente de validation';
  return nExtra(n);
};
// un clic sur « Nouvelle inscription » ouvre directement la liste des inscriptions à valider
const _readNotif = readNotif;
readNotif = async function (id) { const n = ME.notifs.find(x => x.id === id); await _readNotif(id); if (n && n.type === 'new_signup' && role() === 'super_admin') nav('pending') };
const _vNotif = VIEWS.notifications;
VIEWS.notifications = async () => {
  await _vNotif();
  if (Date.now() - MSG.t > 15000) await loadMessages();
  const T = msgThreads().slice(0, 15); if (!T.length || view !== 'notifications') return;
  const html = `<div class="section-title"><h2>Messages</h2><button class="btn btn-secondary" onclick="nav('messages')">Ouvrir la messagerie</button></div>` + T.map(t => {
    const u = msgUnreadIn(t).length, l = t.last, txt = l.corps.length > 400 ? l.corps.slice(0, 400) + '…' : l.corps;
    return `<div class="card notif ${u ? 'unread' : ''}" onclick="msgOpen('${t.id}')"><div><b>${esc(msgTitle(t))}</b><div class="muted small">${esc(l.expediteur_id === msgMe() ? 'Moi' : (l.expediteur_nom || 'Administration'))}</div><div>${msgHtml(txt)}</div></div><small class="muted">${dmyhm(l.created_at)}</small></div>`;
  }).join('');
  $('#content').insertAdjacentHTML('afterbegin', html);
};
