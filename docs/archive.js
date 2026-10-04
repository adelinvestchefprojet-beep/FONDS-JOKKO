/* JOKKOO – archive Excel complète (design moderne) + téléchargement automatique du vendredi.
   Réservé à l'administrateur et au super admin. Le fichier contient les données que le serveur autorise
   pour ce compte (RLS) : toutes les communes si l'administrateur a toutes les communes dans son périmètre. */
const ARCH = { busy: false, CDN: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js' };
const archKey = () => 'jokkoo_archive_v1_' + ((ME.profile && ME.profile.id) || 'x');
const archGet = () => { try { return JSON.parse(localStorage.getItem(archKey()) || '{}') || {} } catch { return {} } };
const archSet = o => { try { localStorage.setItem(archKey(), JSON.stringify(Object.assign(archGet(), o))) } catch { } };
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const lastFriday = (now = new Date()) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() - ((d.getDay() + 2) % 7)); return d };
const nextFriday = (now = new Date()) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); return d };
const longDate = d => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/* l'archive du vendredi est due si celle du dernier vendredi n'a pas encore été téléchargée */
function archiveDue() {
  if (!isStaff() || ME.offline || !navigator.onLine) return false;
  const st = archGet();
  return st.auto !== false && st.fridayKey !== ymd(lastFriday());
}

function archLoadLib() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = ARCH.CDN;
    s.onload = () => window.ExcelJS ? res(window.ExcelJS) : rej(new Error('Module Excel indisponible'));
    s.onerror = () => rej(new Error('Module Excel non chargé (connexion internet requise)'));
    document.head.appendChild(s);
  });
}

/* ---------- mise en forme ---------- */
const AC = { green: 'FF087443', greenD: 'FF04492A', red: 'FFC9232D', gold: 'FFD7A62A', light: 'FFE6F4EC', line: 'FFDBE7E0', ink: 'FF14231C', muted: 'FF66756E', zebra: 'FFF6FAF8', white: 'FFFFFFFF' };
const AST = { 'Définitive': ['FFD9F2E3', 'FF0B6B3E'], 'Validée': ['FFBFE8D2', 'FF04492A'], 'Sauvegardée': ['FFFFF1C7', 'FF8A6A00'], 'Brouillon': ['FFFDE3E4', 'FFA3171F'], 'Archivée': ['FFE7ECEF', 'FF4A5A64'] };
const aFill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
const aLine = c => ({ style: 'thin', color: { argb: c } });
const AFONT = 'Calibri';
const aCut = s => { s = String(s == null ? '' : s); return s.length > 32000 ? s.slice(0, 32000) + '…' : s };
function aVal(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(aVal).join('; ');
  if (typeof v === 'object') { if ('done' in v) return (v.done ? 'Réalisé' : 'Non réalisé') + (v.date ? ' le ' + v.date : ''); return JSON.stringify(v) }
  return String(v);
}
function aHeader(row, color) {
  row.height = 26;
  row.eachCell(c => { c.font = { name: AFONT, bold: true, color: { argb: AC.white }, size: 11 }; c.fill = aFill(color || AC.green); c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; c.border = { bottom: { style: 'medium', color: { argb: AC.red } } } });
}
function aBody(row, i, opt = {}) {
  row.eachCell({ includeEmpty: true }, (c, n) => {
    c.font = Object.assign({ name: AFONT, size: 10, color: { argb: AC.ink } }, opt.font || {});
    if (i % 2 === 0) c.fill = aFill(AC.zebra);
    c.border = { bottom: aLine(AC.line) };
    c.alignment = Object.assign({ vertical: 'top', wrapText: true }, (opt.align && opt.align[n]) ? { horizontal: opt.align[n] } : {});
  });
}
function aStatus(cell) {
  const s = AST[cell.value]; if (!s) return;
  cell.fill = aFill(s[0]); cell.font = { name: AFONT, size: 10, bold: true, color: { argb: s[1] } }; cell.alignment = { vertical: 'top', horizontal: 'center' };
}
const aScale = { type: 'colorScale', cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 0.5 }, { type: 'num', value: 1 }], color: [{ argb: 'FFF6B8BC' }, { argb: 'FFFFE8A3' }, { argb: 'FF8FD6AE' }] };
const aMean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

/* ---------- construction du classeur ---------- */
function archBuild(X, auditRows) {
  const L = (db.diagnostics || []).slice().sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'fr', { numeric: true }));
  const DOMS = [...new Set((window.JOKKOO_PARAMS || []).map(p => p.domaine).filter(Boolean))];
  const now = new Date(), who = fullName(ME.profile), roleLbl = ROLE_LBL[role()] || '';
  const wb = new X.Workbook(); wb.creator = 'JOKKOO – ' + who; wb.created = now; wb.title = 'Archive JOKKOO';
  const info = L.map(d => { const s = scoreDiag(d); return { d, pct: s.count ? s.pct : null, count: s.count, dom: domainScores([d]) } });
  const fin = s => s === 'Définitive' || s === 'Validée';

  /* ===== 1. Synthèse ===== */
  const ws = wb.addWorksheet('Synthèse', { properties: { tabColor: { argb: AC.green } }, views: [{ showGridLines: false }] });
  ws.columns = [{ width: 2 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  ws.mergeCells('B1:I2'); const t = ws.getCell('B1'); t.value = 'JOKKOO · Archive des enquêtes'; t.font = { name: AFONT, size: 22, bold: true, color: { argb: AC.white } }; t.fill = aFill(AC.greenD); t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 24; ws.getRow(2).height = 24;
  [['B3:D3', AC.green], ['E3:F3', AC.gold], ['G3:I3', AC.red]].forEach(([r, c]) => { ws.mergeCells(r); ws.getCell(r.split(':')[0]).fill = aFill(c) }); ws.getRow(3).height = 6;
  ws.mergeCells('B4:I4'); const g = ws.getCell('B4'); g.value = `Généré le ${longDate(now)} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · par ${who}${roleLbl ? ' (' + roleLbl + ')' : ''}`; g.font = { name: AFONT, size: 10, italic: true, color: { argb: AC.muted } }; g.alignment = { indent: 1, vertical: 'middle' }; ws.getRow(4).height = 22;

  const nFin = L.filter(d => fin(d.status)).length, nProg = L.filter(d => d.status === 'Brouillon' || d.status === 'Sauvegardée').length, avg = aMean(info.filter(x => x.pct != null).map(x => x.pct));
  const cards = [['B', 'C', 'ENQUÊTES', L.length, AC.green, '0'], ['D', 'E', 'FINALISÉES', nFin, AC.red, '0'], ['F', 'G', 'EN COURS / BROUILLONS', nProg, AC.gold, '0'], ['H', 'I', 'SCORE MOYEN', avg, AC.green, '0%']];
  cards.forEach(([a, b, lbl, val, col, fmt]) => {
    ws.mergeCells(`${a}6:${b}6`); ws.mergeCells(`${a}7:${b}8`);
    const l = ws.getCell(a + '6'); l.value = lbl; l.font = { name: AFONT, size: 9, bold: true, color: { argb: AC.muted } }; l.fill = aFill(AC.white); l.alignment = { horizontal: 'center', vertical: 'middle' }; l.border = { top: { style: 'thick', color: { argb: col } } };
    const v = ws.getCell(a + '7'); v.value = val == null ? '—' : val; v.numFmt = fmt; v.font = { name: AFONT, size: 28, bold: true, color: { argb: col === AC.gold ? 'FF9A7410' : col } }; v.fill = aFill(AC.light); v.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(b + '7').fill = aFill(AC.light); ws.getCell(a + '8').fill = aFill(AC.light); ws.getCell(b + '8').fill = aFill(AC.light);
  });
  ws.getRow(6).height = 22; ws.getRow(7).height = 24; ws.getRow(8).height = 24;

  let r = 10; ws.mergeCells(`B${r}:I${r}`); const s1 = ws.getCell('B' + r); s1.value = 'Répartition par commune'; s1.font = { name: AFONT, size: 14, bold: true, color: { argb: AC.green } }; s1.border = { bottom: { style: 'medium', color: { argb: AC.red } } }; ws.getRow(r).height = 24;
  r++; const h1 = ws.getRow(r); h1.values = [null, 'Commune', 'Enquêtes', 'Brouillons', 'Sauvegardées', 'Définitives', 'Validées', 'Archivées', 'Score moyen']; aHeader(h1);
  const comIds = [...new Set([...ME.communes.map(c => c.id), ...L.map(d => d.meta.communeId).filter(Boolean)])];
  const comRows = comIds.map(id => ({ nom: communeName(id) || '(commune inconnue)', L: info.filter(x => x.d.meta.communeId === id) })).filter(c => c.L.length).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const cnt = (A, s) => A.filter(x => x.d.status === s).length, first = r + 1;
  comRows.forEach((c, i) => {
    const row = ws.addRow([null, c.nom, c.L.length, cnt(c.L, 'Brouillon'), cnt(c.L, 'Sauvegardée'), cnt(c.L, 'Définitive'), cnt(c.L, 'Validée'), cnt(c.L, 'Archivée'), aMean(c.L.filter(x => x.pct != null).map(x => x.pct))]); r++;
    aBody(row, i, { align: { 3: 'center', 4: 'center', 5: 'center', 6: 'center', 7: 'center', 8: 'center', 9: 'center' } }); row.getCell(2).font = { name: AFONT, size: 10, bold: true, color: { argb: AC.ink } }; row.getCell(9).numFmt = '0%';
  });
  if (!comRows.length) { ws.addRow([null, 'Aucune enquête à archiver.']); r++ }
  const tot = ws.addRow([null, 'TOTAL', L.length, cnt(info, 'Brouillon'), cnt(info, 'Sauvegardée'), cnt(info, 'Définitive'), cnt(info, 'Validée'), cnt(info, 'Archivée'), avg]); r++;
  tot.eachCell((c, n) => { if (n < 2) return; c.font = { name: AFONT, size: 11, bold: true, color: { argb: AC.greenD } }; c.fill = aFill(AC.light); c.border = { top: { style: 'medium', color: { argb: AC.green } } }; c.alignment = { horizontal: n === 2 ? 'left' : 'center' } }); tot.getCell(9).numFmt = '0%';
  if (comRows.length) ws.addConditionalFormatting({ ref: `I${first}:I${first + comRows.length - 1}`, rules: [Object.assign({ priority: 1 }, aScale)] });

  r += 2; ws.mergeCells(`B${r}:I${r}`); const s2 = ws.getCell('B' + r); s2.value = 'Score moyen par domaine'; s2.font = { name: AFONT, size: 14, bold: true, color: { argb: AC.green } }; s2.border = { bottom: { style: 'medium', color: { argb: AC.red } } }; ws.getRow(r).height = 24;
  r++; const h2 = ws.getRow(r); h2.getCell(2).value = 'Domaine'; h2.getCell(3).value = 'Score moyen'; h2.getCell(4).value = 'Fiches notées'; aHeader(h2);
  const d0 = r + 1; let di = 0;
  DOMS.forEach(dn => {
    const vals = info.map(x => x.dom[dn]).filter(v => v != null); const row = ws.getRow(++r);
    row.getCell(2).value = dn; row.getCell(3).value = aMean(vals); row.getCell(3).numFmt = '0%'; row.getCell(4).value = vals.length;
    [2, 3, 4].forEach(n => { const c = row.getCell(n); c.font = { name: AFONT, size: 10, bold: n === 2, color: { argb: AC.ink } }; if (di % 2 === 0) c.fill = aFill(AC.zebra); c.border = { bottom: aLine(AC.line) }; c.alignment = { horizontal: n === 2 ? 'left' : 'center' } }); di++;
  });
  if (DOMS.length) ws.addConditionalFormatting({ ref: `C${d0}:C${d0 + DOMS.length - 1}`, rules: [Object.assign({ priority: 2 }, aScale)] });
  r += 2; ws.mergeCells(`B${r}:I${r + 2}`); const nt = ws.getCell('B' + r);
  nt.value = 'Contenu du fichier : « Enquêtes » (une ligne par fiche, avec scores), « Réponses (détail) » (toutes les réponses notées), « Enquêteurs » (activité), « Journal d’activité » (qui a fait quoi, réservé au super admin) et « Sauvegarde brute » (copie complète des fiches au format JSON, pour restauration en cas de problème). À conserver sur le PC de l’administrateur.';
  nt.font = { name: AFONT, size: 9, italic: true, color: { argb: AC.muted } }; nt.alignment = { wrapText: true, vertical: 'top', indent: 1 };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  /* ===== 2. Enquêtes ===== */
  const we = wb.addWorksheet('Enquêtes', { properties: { tabColor: { argb: AC.red } }, views: [{ state: 'frozen', xSplit: 2, ySplit: 1, showGridLines: false }] });
  const heads = ['N°', 'Organisation', 'Commune', 'Enquêteur', 'Statut', 'Date de l’enquête', 'Créée le', 'Dernière mise à jour', 'Score global', ...DOMS, 'Questions notées', 'Photos'];
  we.columns = heads.map((h, i) => ({ header: h, width: i === 0 ? 14 : i === 1 ? 34 : i < 4 ? 22 : i === 4 ? 14 : i < 8 ? 18 : i === 8 ? 12 : 16 }));
  aHeader(we.getRow(1), AC.green);
  const toDate = s => { if (!s) return null; const d = new Date(s); return isNaN(d) ? String(s) : d };
  info.forEach((x, i) => {
    const d = x.d, row = we.addRow([d.numero || '', d.meta.nom || '', d.meta.commune || '', d.meta.agent || '', d.status, toDate(d.meta.date), toDate(d.createdAt), toDate(d.updatedAt), x.pct, ...DOMS.map(dn => x.dom[dn] == null ? null : x.dom[dn]), x.count, Object.keys(d.photos || {}).length]);
    const al = {}; for (let n = 5; n <= heads.length; n++) al[n] = 'center'; aBody(row, i, { align: al });
    row.getCell(2).font = { name: AFONT, size: 10, bold: true, color: { argb: AC.ink } }; aStatus(row.getCell(5));
    row.getCell(6).numFmt = 'dd/mm/yyyy'; row.getCell(7).numFmt = 'dd/mm/yyyy'; row.getCell(8).numFmt = 'dd/mm/yyyy hh:mm';
    for (let n = 9; n <= 9 + DOMS.length; n++) row.getCell(n).numFmt = '0%';
  });
  if (info.length) { we.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + info.length, column: heads.length } }; we.addConditionalFormatting({ ref: `I2:${we.getColumn(9 + DOMS.length).letter}${info.length + 1}`, rules: [Object.assign({ priority: 3 }, aScale)] }) }
  we.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  /* ===== 3. Réponses (détail) ===== */
  const wd = wb.addWorksheet('Réponses (détail)', { properties: { tabColor: { argb: AC.gold } }, views: [{ state: 'frozen', xSplit: 1, ySplit: 1, showGridLines: false }] });
  wd.columns = [{ header: 'N°', width: 14 }, { header: 'Organisation', width: 28 }, { header: 'Commune', width: 20 }, { header: 'Enquêteur', width: 20 }, { header: 'Statut', width: 14 }, { header: 'Visite', width: 22 }, { header: 'Question', width: 56 }, { header: 'Réponse', width: 40 }, { header: 'Score /3', width: 10 }, { header: 'Commentaire', width: 38 }];
  aHeader(wd.getRow(1), AC.green); let k = 0;
  L.forEach(d => (window.JOKKOO_VISITES || []).forEach(v => v.questions.forEach(q => {
    const val = d.answers ? d.answers[q.id] : undefined; if (val === undefined || val === null || val === '') return;
    const p = paramFor(q, val), row = wd.addRow([d.numero || '', d.meta.nom || '', d.meta.commune || '', d.meta.agent || '', d.status, v.title || v.id, aCut(q.label), aCut(aVal(val)), p ? Number(p.score) : null, p ? aCut(p.commentaire) : '']);
    aBody(row, k++, { align: { 5: 'center', 9: 'center' } }); aStatus(row.getCell(5));
  })));
  if (k) { wd.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + k, column: 10 } }; wd.addConditionalFormatting({ ref: `I2:I${k + 1}`, rules: [{ type: 'colorScale', priority: 4, cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1.5 }, { type: 'num', value: 3 }], color: [{ argb: 'FFF6B8BC' }, { argb: 'FFFFE8A3' }, { argb: 'FF8FD6AE' }] }] }) }

  /* ===== 4. Enquêteurs ===== */
  const wa = wb.addWorksheet('Enquêteurs', { properties: { tabColor: { argb: AC.greenD } }, views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  wa.columns = [{ header: 'Enquêteur', width: 30 }, { header: 'Commune', width: 24 }, { header: 'Enquêtes', width: 12 }, { header: 'Finalisées', width: 12 }, { header: 'En cours', width: 12 }, { header: 'Score moyen', width: 14 }, { header: 'Dernière activité', width: 20 }];
  aHeader(wa.getRow(1), AC.green);
  const byA = new Map(); info.forEach(x => { const key = (x.d.meta.agent || '—') + '|' + (x.d.meta.communeId || ''); if (!byA.has(key)) byA.set(key, { nom: x.d.meta.agent || '—', com: x.d.meta.commune || '', A: [] }); byA.get(key).A.push(x) });
  [...byA.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).forEach((e, i) => {
    const last = e.A.map(x => x.d.updatedAt || x.d.createdAt).filter(Boolean).sort().pop();
    const row = wa.addRow([e.nom, e.com, e.A.length, e.A.filter(x => fin(x.d.status)).length, e.A.filter(x => !fin(x.d.status) && x.d.status !== 'Archivée').length, aMean(e.A.filter(x => x.pct != null).map(x => x.pct)), toDate(last)]);
    aBody(row, i, { align: { 3: 'center', 4: 'center', 5: 'center', 6: 'center', 7: 'center' } }); row.getCell(1).font = { name: AFONT, size: 10, bold: true, color: { argb: AC.ink } }; row.getCell(6).numFmt = '0%'; row.getCell(7).numFmt = 'dd/mm/yyyy hh:mm';
  });
  if (byA.size) wa.addConditionalFormatting({ ref: `F2:F${byA.size + 1}`, rules: [Object.assign({ priority: 5 }, aScale)] });

  if (auditRows && auditRows.length) archAuditSheet(wb, auditRows);

  /* ===== 5. Sauvegarde brute (restauration) ===== */
  const wr = wb.addWorksheet('Sauvegarde brute', { properties: { tabColor: { argb: 'FF8A9A93' } }, views: [{ state: 'frozen', ySplit: 1 }] });
  wr.columns = [{ header: 'Identifiant', width: 38 }, { header: 'N°', width: 14 }, { header: 'Commune', width: 20 }, { header: 'Partie', width: 8 }, { header: 'Données JSON', width: 90 }];
  aHeader(wr.getRow(1), 'FF4A5A64');
  L.forEach(d => {
    const json = JSON.stringify({ id: d.id, numero: d.numero, status: d.status, createdAt: d.createdAt, updatedAt: d.updatedAt, meta: d.meta, answers: d.answers, photos: d.photos, history: d.history });
    for (let p = 0, n = 1; p < json.length; p += 30000, n++) wr.addRow([d.id, d.numero || '', d.meta.commune || '', n, json.slice(p, p + 30000)]).eachCell(c => { c.font = { name: 'Consolas', size: 9, color: { argb: AC.muted } }; c.alignment = { vertical: 'top' } });
  });
  return wb;
}


/* ---------- journal d'activité (super admin) ---------- */
const AUD_TONE = { ok: ['FFD9F2E3', 'FF0B6B3E'], info: ['FFFFF1C7', 'FF8A6A00'], warn: ['FFE7ECEF', 'FF4A5A64'], bad: ['FFFDE3E4', 'FFA3171F'] };
function archAuditSheet(wb, rows) {
  const w = wb.addWorksheet('Journal d’activité', { properties: { tabColor: { argb: AC.red } }, views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  w.columns = [{ header: 'Date et heure', width: 18 }, { header: 'Qui', width: 26 }, { header: 'Type', width: 11 }, { header: 'Ce qui a été fait', width: 28 }, { header: 'Concerne', width: 38 }, { header: 'Précisions', width: 52 }];
  aHeader(w.getRow(1), AC.green);
  rows.forEach((r, i) => {
    const d = new Date(r.date), row = w.addRow([isNaN(d) ? String(r.date) : d, r.who, r.type, r.label, r.cible || '', r.detail || '']);
    aBody(row, i, { align: { 3: 'center' } }); row.getCell(1).numFmt = 'dd/mm/yyyy hh:mm';
    const t = AUD_TONE[r.tone]; if (t) { const c = row.getCell(4); c.fill = aFill(t[0]); c.font = { name: AFONT, size: 10, bold: true, color: { argb: t[1] } } }
  });
  if (rows.length) w.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + rows.length, column: 6 } };
  w.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return w;
}
async function exportJournal() {
  if (role() !== 'super_admin') return;
  try {
    await jrnLoad(true); if (JRN.err) throw new Error(JRN.err);
    const rows = jrnFiltered(); if (!rows.length) return toast('Aucune action à exporter avec ces filtres.');
    const X = await archLoadLib(), wb = new X.Workbook(), now = new Date(); wb.creator = 'JOKKOO – ' + fullName(ME.profile); wb.created = now;
    archAuditSheet(wb, rows);
    const buf = await wb.xlsx.writeBuffer(), name = `JOKKOO_Journal_${ymd(now)}.xlsx`;
    download(name, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Journal téléchargé : ' + name);
  } catch (e) { toast('Export impossible : ' + errMsg(e)) }
}

/* ---------- export ---------- */
async function exportArchive(opts = {}) {
  if (ARCH.busy) return false;
  if (!isStaff()) return false;
  ARCH.busy = true;
  try {
    if (!opts.auto) {
      if (!navigator.onLine || ME.offline) throw new Error('connexion internet requise pour récupérer toutes les données');
      toast('Récupération des données du serveur…'); await pullAll();
    }
    const X = await archLoadLib();
    let audit = null;
    if (role() === 'super_admin' && sb && !ME.offline && typeof jrnLoad === 'function') { try { await jrnLoad(true); if (!JRN.err) audit = jrnRows(JRN.logs) } catch { } }
    const wb = archBuild(X, audit), buf = await wb.xlsx.writeBuffer();
    const name = `JOKKOO_Archive_${ymd(new Date())}.xlsx`;
    download(name, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    archSet({ last: new Date().toISOString(), lastName: name, lastCount: (db.diagnostics || []).length, fridayKey: ymd(lastFriday()) });
    toast(`${opts.auto ? 'Archive du vendredi téléchargée' : 'Archive téléchargée'} : ${name}`);
    if (typeof view !== 'undefined' && view === 'archive') render();
    return true;
  } catch (e) { toast('Archive impossible : ' + errMsg(e)); return false }
  finally { ARCH.busy = false }
}

/* appelé après l'ouverture de session (administrateur / super admin) */
async function archiveCheck() {
  try {
    if (!archiveDue() || ME.syncError || !(db.diagnostics || []).length) return;
    await exportArchive({ auto: true });
  } catch (e) { console.warn('archive', e) }
}

/* ---------- écran « Archive Excel » ---------- */
VIEWS.archive = () => {
  const st = archGet(), L = db.diagnostics || [], due = archiveDue();
  const com = new Set(L.map(d => d.meta.communeId).filter(Boolean)).size, nf = L.filter(d => d.status === 'Définitive' || d.status === 'Validée').length;
  $('#content').innerHTML = `<div class="card"><h3 style="margin-top:0">Archive Excel de sécurité</h3>
  <p class="muted">Un fichier Excel complet (synthèse par commune, toutes les enquêtes, toutes les réponses, activité des enquêteurs et copie brute des fiches) à conserver sur le PC de l’administrateur, en plus des données du serveur.</p>
  ${due ? '<div class="form-msg err" style="margin:8px 0">L’archive du vendredi n’a pas encore été téléchargée : elle se télécharge à l’ouverture de l’application, ou cliquez ci-dessous.</div>' : ''}
  <div class="toolbar"><button class="btn btn-primary" onclick="exportArchive()">⇩ Télécharger l’archive Excel maintenant</button></div>
  <p class="small" style="margin:14px 0 4px"><b>Dernière archive :</b> ${st.last ? esc(dmyhm(st.last)) + ' — ' + esc(st.lastName || '') + ' (' + (st.lastCount || 0) + ' enquête(s))' : '<span class="muted">aucune sur cet appareil</span>'}</p>
  <p class="small" style="margin:4px 0"><b>Prochain vendredi :</b> ${esc(longDate(nextFriday()))}</p>
  <label class="choice" style="margin-top:10px"><input type="checkbox" ${st.auto === false ? '' : 'checked'} onchange="archSet({auto:this.checked});render()"> Télécharger automatiquement chaque vendredi, à l’ouverture de l’application</label>
  <p class="muted small" style="margin-top:8px">Le téléchargement automatique se fait quand l’application est ouverte sur cet appareil (le vendredi, ou à la première ouverture suivante si le vendredi a été manqué). Gardez aussi une copie sur un disque externe.</p></div>` +
    kpiBlock('Contenu de la prochaine archive', [[L.length, 'Enquêtes'], [com, 'Communes', 'var(--red)'], [nf, 'Fiches finalisées', 'var(--gold)']]);
};
