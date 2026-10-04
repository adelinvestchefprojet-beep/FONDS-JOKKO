/* JOKKOO – authentification (Supabase Auth) : accueil, inscription, connexion, mot de passe, statut du compte */
const AUTHBOX = () => $('#auth');
const pname = () => (ME.platform && ME.platform.nom) || 'JOKKOO Diagnostic';
function showAuth(inner, wide) {
  $('#appShell').hidden = true; const a = AUTHBOX(); a.hidden = false;
  a.innerHTML = `<div class="auth-split">
    <div class="auth-hero"><img src="${IMG('hero')}" alt="" decoding="async" onerror="this.style.display='none'"><div class="claim"><h2>Collectez, suivez et analysez vos enquêtes de terrain</h2><p>Saisie même sans réseau, synchronisation automatique, rapports par commune.</p></div></div>
    <div class="auth-panel"><div class="auth-card${wide ? ' wide' : ''}"><div class="auth-badge"><img class="logo-round xl" src="${IMG('logo')}" alt="TAATAAN" onerror="this.outerHTML='<b class=auth-logo-txt>TAATAAN</b>'"></div><div class="auth-eyebrow">${esc(pname())}</div>${inner}</div></div></div>`;
}
function togglePw(id, btn) { const i = $('#' + id); i.type = i.type === 'password' ? 'text' : 'password'; btn.textContent = i.type === 'password' ? 'Afficher' : 'Masquer' }
const pwField = (id, label, auto, extra) => `<label>${label}<div class="pw"><input class="input" id="${id}" type="password" autocomplete="${auto}" ${extra || ''} required><button type="button" class="pw-toggle" onclick="togglePw('${id}',this)">Afficher</button></div></label>`;
const AUTH_ERR = { 'Invalid login credentials': 'Email ou mot de passe incorrect.', 'Email not confirmed': 'Veuillez d’abord confirmer votre email (lien reçu par message).', 'User already registered': 'Un compte existe déjà avec cet email.' };
const authErr = e => AUTH_ERR[(e && e.message) || ''] || (e && e.message) || 'Erreur inattendue.';
const msgBox = (id, t, ok) => { const m = $('#' + id); if (m) { m.className = 'form-msg ' + (ok ? 'ok' : 'err'); m.textContent = t } };

function showSetup() {
  showAuth(`<h2>Connexion au serveur</h2><p class="muted">Renseignez l’URL du projet Supabase et la clé <b>publique (anon)</b>. Ne collez jamais la clé <code>service_role</code> ici : elle sera refusée.</p>
  <form onsubmit="saveSetup(event)"><label>URL du projet<input class="input" id="s_url" placeholder="https://xxxx.supabase.co" required></label><label>Clé publique (anon)<input class="input" id="s_key" required></label><div id="s_msg" class="form-msg"></div><button class="btn btn-primary" style="width:100%">Enregistrer</button></form>
  <p class="muted small">Astuce : pour un déploiement, renseignez plutôt <code>config.js</code>.</p>`);
}
function saveSetup(e) {
  e.preventDefault(); const url = $('#s_url').value.trim().replace(/\/$/, ''), key = $('#s_key').value.trim();
  if (isSecretKey(key)) return msgBox('s_msg', 'Cette clé est PRIVÉE (service_role). Refusée : utilisez la clé anon publique.');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(url)) return msgBox('s_msg', 'URL invalide.');
  localStorage.setItem('jokkoo_supabase', JSON.stringify({ url, anonKey: key })); location.reload();
}

function showLanding() { showLogin() }
function showLogin(msg) {
  showAuth(`<h2>Connexion</h2><p class="muted auth-sub">Accédez à votre espace enquêteur ou administrateur.</p>${msg ? `<div class="form-msg ok">${esc(msg)}</div>` : ''}
  <form onsubmit="doLogin(event)"><label>Email<input class="input" id="l_email" type="email" autocomplete="username" inputmode="email" placeholder="vous@exemple.sn" required></label>
  ${pwField('l_pass', 'Mot de passe', 'current-password')}<div class="auth-links right"><a href="#" onclick="showForgot();return false">Mot de passe oublié ?</a></div>
  <div id="l_msg" class="form-msg" role="alert"></div><button class="btn btn-primary full" id="l_btn">Se connecter</button></form>
  <div class="auth-sep"><span>Pas encore de compte ?</span></div><button class="btn btn-secondary full" onclick="showSignup()">Créer un compte</button>
  <p class="muted small auth-foot">Les comptes sont validés par l’administration avant le premier accès.${ME.platform && ME.platform.contact_email ? ' Contact : ' + esc(ME.platform.contact_email) : ''}</p>`);
}
async function doLogin(e) {
  e.preventDefault(); const b = $('#l_btn'); b.disabled = true;
  if (!navigator.onLine) { msgBox('l_msg', 'Connexion impossible hors ligne la première fois.'); b.disabled = false; return }
  const r = await sb.auth.signInWithPassword({ email: $('#l_email').value.trim(), password: $('#l_pass').value });
  if (r.error) { msgBox('l_msg', authErr(r.error)); b.disabled = false; return }
  ME.offline = false; await afterAuth(r.data.user);
}
async function afterAuth(user) {
  const p = await loadProfile(user);
  if (!p) return showBlocked('missing');
  if (p.statut === 'active') return startSession();
  showBlocked(p.statut);
}

async function showSignup() {
  let cs = []; if (sb && navigator.onLine) { const r = await sb.from('communes').select('id,nom').eq('actif', true).order('nom'); if (!r.error) cs = r.data }
  showAuth(`<h2>Créer mon compte enquêteur</h2>
  <form onsubmit="doSignup(event)"><div class="two"><label>Prénom<input class="input" id="g_prenom" required></label><label>Nom<input class="input" id="g_nom" required></label></div>
  <label>Commune<select class="input" id="g_commune" required><option value="">— Choisir —</option>${cs.map(c => `<option value="${c.id}">${esc(c.nom)}</option>`).join('')}</select></label>
  <div class="two"><label>Email<input class="input" id="g_email" type="email" autocomplete="username" required></label><label>Téléphone<input class="input" id="g_tel" type="tel" required></label></div>
  <div class="two">${pwField('g_pass', 'Mot de passe (8 car. min.)', 'new-password', 'minlength="8"')}${pwField('g_pass2', 'Confirmation', 'new-password', 'minlength="8"')}</div>
  <div id="g_msg" class="form-msg"></div><button class="btn btn-primary" id="g_btn" style="width:100%">Créer mon compte</button></form>
  <div class="auth-links"><a href="#" onclick="showLogin();return false">J’ai déjà un compte</a></div>`, true);
}
async function doSignup(e) {
  e.preventDefault(); const v = id => $('#' + id).value.trim();
  if ($('#g_pass').value !== $('#g_pass2').value) return msgBox('g_msg', 'Les mots de passe ne correspondent pas.');
  if ($('#g_pass').value.length < 8) return msgBox('g_msg', 'Mot de passe : 8 caractères minimum.');
  if (!navigator.onLine) return msgBox('g_msg', 'Une connexion est nécessaire pour créer un compte.');
  $('#g_btn').disabled = true;
  const r = await sb.auth.signUp({ email: v('g_email'), password: $('#g_pass').value, options: { data: { prenom: v('g_prenom'), nom: v('g_nom'), telephone: v('g_tel'), commune_id: v('g_commune') } } });
  if (r.error) { msgBox('g_msg', authErr(r.error)); $('#g_btn').disabled = false; return }
  if (r.data.session) await sb.auth.signOut(); // aucun accès avant validation
  showAuth(`<h2>Votre demande a été enregistrée</h2><p>Votre compte est actuellement <b>en attente de validation</b> par l’administration.</p><p class="muted">Vous recevrez un email lorsque votre compte sera validé. Si un lien de confirmation vous a été envoyé, ouvrez-le d’abord.</p><div class="auth-actions"><button class="btn btn-primary" onclick="showLogin()">Retour à la connexion</button></div>`);
}

function showForgot() {
  showAuth(`<h2>Mot de passe oublié</h2><p class="muted">Saisissez votre email : un lien de réinitialisation vous sera envoyé.</p>
  <form onsubmit="doForgot(event)"><label>Email<input class="input" id="f_email" type="email" required></label><div id="f_msg" class="form-msg"></div><button class="btn btn-primary" style="width:100%">Envoyer le lien</button></form>
  <div class="auth-links"><a href="#" onclick="showLogin();return false">Retour</a></div>`);
}
async function doForgot(e) {
  e.preventDefault(); if (!navigator.onLine) return msgBox('f_msg', 'Connexion requise.');
  const r = await sb.auth.resetPasswordForEmail($('#f_email').value.trim(), { redirectTo: location.origin + location.pathname });
  msgBox('f_msg', r.error ? authErr(r.error) : 'Si ce compte existe, un email vient d’être envoyé.', !r.error);
}
function showReset() {
  showAuth(`<h2>Nouveau mot de passe</h2><form onsubmit="doReset(event)"><label>Nouveau mot de passe<input class="input" id="r_pass" type="password" minlength="8" autocomplete="new-password" required></label>
  <label>Confirmation<input class="input" id="r_pass2" type="password" minlength="8" autocomplete="new-password" required></label><div id="r_msg" class="form-msg"></div><button class="btn btn-primary" style="width:100%">Enregistrer</button></form>`);
}
async function doReset(e) {
  e.preventDefault(); if ($('#r_pass').value !== $('#r_pass2').value) return msgBox('r_msg', 'Les mots de passe ne correspondent pas.');
  const r = await sb.auth.updateUser({ password: $('#r_pass').value });
  if (r.error) return msgBox('r_msg', authErr(r.error));
  history.replaceState(null, '', location.pathname); await sb.auth.signOut(); showLogin('Mot de passe modifié. Connectez-vous.');
}

const BLOCK_MSG = {
  pending: ['Compte en attente de validation', 'Votre inscription a bien été reçue. L’administration doit valider votre compte avant que vous puissiez utiliser l’application. Vous serez prévenu par email.'],
  rejected: ['Inscription refusée', 'Votre demande d’inscription a été refusée par l’administration.'],
  inactive: ['Compte désactivé', 'Votre compte a été désactivé par l’administration. Contactez-la pour le réactiver.'],
  deleted: ['Compte supprimé', 'Ce compte n’est plus actif.'],
  missing: ['Profil introuvable', 'Aucun profil n’est associé à ce compte. Contactez l’administration.']
};
function showBlocked(st) {
  const [t, m] = BLOCK_MSG[st] || BLOCK_MSG.missing;
  showAuth(`<h2>${t}</h2><p>${m}</p><div class="auth-actions"><button class="btn btn-secondary" onclick="recheck()">Actualiser</button><button class="btn btn-primary" onclick="logout(true)">Se déconnecter</button></div>`);
}
async function recheck() { const r = await sb.auth.getSession(); if (!r.data.session) return showLogin(); await afterAuth(r.data.session.user) }

/* ---------- session ---------- */
async function loadProfile(user) {
  ME.user = user; let p = null;
  if (navigator.onLine) {
    try {
      const r = await sb.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (!r.error && r.data) { p = r.data; localStorage.setItem('jokkoo_last', JSON.stringify({ uid: user.id, email: user.email, profile: p })) }
      else if (!r.error) { localStorage.removeItem('jokkoo_last'); ME.profile = null; return null }
    } catch (e) { /* réseau instable : cache */ }
  }
  if (!p) { const c = lastUser(); if (c && c.uid === user.id) { p = c.profile; ME.offline = true } }
  ME.profile = p; return p;
}
const lastUser = () => { try { return JSON.parse(localStorage.getItem('jokkoo_last') || 'null') } catch { return null } };
async function startSession() {
  await IDB.open('jokkoo_' + ME.user.id);
  const saved = await IDB.get('db'); db = saved && saved.diagnostics ? saved : { diagnostics: [] }; db.diagnostics.forEach(fixNom);
  $('#auth').hidden = true; $('#appShell').hidden = false; buildNav(); updateSync(); nav('dashboard');
  try { await pullAll() } catch (e) { ME.syncError = errMsg(e) }
  buildNav(); render(); syncNow();
  clearInterval(startSession._t); startSession._t = setInterval(() => { if (!document.hidden) { syncNow(); loadNotifs() } }, 60000);
}
async function revalidate() { // retour du réseau après un mode hors ligne : on vérifie que le compte est toujours actif
  const r = await sb.auth.getSession(); if (!r.data.session) { toast('Session expirée : reconnectez-vous (vos fiches restent sur l’appareil)'); return logout(false) }
  ME.offline = false; const p = await loadProfile(r.data.session.user);
  if (!p || p.statut !== 'active') { logout(false); showBlocked(p ? p.statut : 'missing') }
}
async function logout(skipConfirm) {
  if (!skipConfirm && ME.profile && pendingCount() && !confirm(pendingCount() + ' fiche(s) ne sont pas encore envoyées : elles resteront sur cet appareil. Se déconnecter ?')) return;
  await flushDB(); clearInterval(startSession._t);
  try { await sb.auth.signOut() } catch { }
  localStorage.removeItem('jokkoo_last'); ME.user = null; ME.profile = null; ME.profiles = []; ME.notifs = []; db = { diagnostics: [] }; currentId = null;
  showLanding();
}

async function boot() {
  sb = initSb();
  document.addEventListener('click', e => { if (e.target.closest('#hamb')) $('#sidebar').classList.toggle('open'); if (e.target.classList.contains('nav-overlay')) $('#sidebar').classList.remove('open'); if (e.target.id === 'modal') closeModal() });
  $('#newTop').onclick = () => newDiagnostic(); $('#logoutBtn').onclick = () => logout();
  if (!sb) return showSetup();
  if (navigator.onLine) { try { const r = await sb.from('app_settings').select('cle,valeur').eq('cle', 'plateforme'); if (!r.error && r.data[0]) ME.platform = r.data[0].valeur } catch { } }
  sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') showReset() });
  if (/type=recovery/.test(location.hash)) return;
  let session = null; try { session = (await sb.auth.getSession()).data.session } catch { }
  if (!session) {
    const c = lastUser();
    if (!navigator.onLine && c && c.profile && c.profile.statut === 'active') { // ouverture hors ligne sur un appareil déjà connecté
      ME.user = { id: c.uid, email: c.email }; ME.profile = c.profile; ME.offline = true; return startSession();
    }
    return showLanding();
  }
  await afterAuth(session.user);
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
window.addEventListener('DOMContentLoaded', boot);
