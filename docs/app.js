/* JOKKOO – fiches de diagnostic (formulaire, notation, exports). Données : voir core.js */
function getCurrent(){return db.diagnostics.find(d=>d.id===currentId)}
function renderDiagTable(ds){if(!ds.length)return '<div class="empty">Aucun diagnostic. Commencez par créer une nouvelle fiche.</div>';return `<div class="card table-wrap"><table class="table"><thead><tr><th>N°</th><th>Organisation</th><th>Commune</th><th>Agent</th><th>Statut</th><th>Score</th><th></th></tr></thead><tbody>${ds.map(d=>{let s=scoreDiag(d);return `<tr><td><b>${esc(d.numero)}</b></td><td>${esc(d.meta.nom)||'—'}</td><td>${esc(d.meta.commune)||'—'}</td><td>${esc(d.meta.agent)||'—'}</td><td><span class="badge ${badgeCls(d.status)}">${d.status}</span>${d._dirty?' <small title="En attente d’envoi">⏳</small>':''}</td><td>${s.count?Math.round(s.pct*100)+'%':'—'}</td><td><button class="btn btn-secondary" onclick="openDiag('${d.id}')">${(isStaff()||isFinal(d))?'Voir le rapport':'Ouvrir / Modifier'}</button>${d.status==='Brouillon'&&d.meta.enqueteurId===(ME.profile||{}).id?` <button class="btn btn-danger" onclick="deleteDraft('${d.id}')">Supprimer</button>`:''}</td></tr>`}).join('')}</tbody></table></div>`}
function openDiag(id){
  const d=db.diagnostics.find(x=>x.id===id);
  // Le personnel consulte les résultats sans ouvrir un formulaire vierge ou modifiable.
  if(isStaff() || (d && isFinal(d))) return viewDiag(id);
  currentId=id;currentVisit=0;nav('new');refreshDiag(id)
}
async function viewDiag(id){
  currentId=id;
  if(sb && !ME.offline && navigator.onLine){
    try{
      const r=await sb.from('enquetes').select('*').eq('id',id).maybeSingle();
      if(r.error) throw r.error;
      if(r.data){
        const n=fromServer(r.data), old=db.diagnostics.find(x=>x.id===id);
        if(old&&old._thumbs)n._thumbs=old._thumbs;
        const i=db.diagnostics.findIndex(x=>x.id===id);
        if(i>=0)db.diagnostics[i]=n;else db.diagnostics.unshift(n);
        saveDB();
      }
    }catch(e){console.warn('viewDiag: lecture serveur',e);toast('Affichage de la copie locale : actualisation serveur impossible')}
  }
  view='resultats';
  $('#pageTitle').textContent='Résultats de l’enquête';
  document.querySelectorAll('#sidebar nav button').forEach(b=>b.classList.remove('active'));
  render();
}
function resultValue(value){
  if(value===null||value===undefined||value==='')return '<span class="muted">— Non renseigné</span>';
  if(typeof value==='object'){
    if(!Array.isArray(value)&&('done' in value||'date' in value)){
      return (value.done?'✓ Réalisé':'Non réalisé')+(value.date?' · '+esc(value.date):'');
    }
    return esc(Array.isArray(value)?value.join(', '):Object.entries(value).map(([k,v])=>k+': '+v).join(' · '));
  }
  return esc(String(value));
}

function exportDiagWord(){
  const d=getCurrent();if(!d){toast('Aucune enquête sélectionnée');return}
  const report=document.querySelector('.diag-report');
  if(!report){toast('Ouvrez d’abord le rapport de cette enquête');return}
  const safeName=String((d.meta||{}).nom||d.numero||'diagnostic').replace(/[^a-z0-9_-]/gi,'_');
  const css='@page{size:A4 portrait;margin:14mm 14mm 16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#183326;font-size:9.5pt;line-height:1.4}.diag-report{width:100%;color:#183326}.report-cover{padding:30px 24px 25px;border-bottom:6px solid #c9232d;page-break-after:always}.report-brand{font-size:17pt;font-weight:bold;letter-spacing:2px;color:#087443}.report-brand span{color:#c9232d}.report-kicker{font-size:13pt;letter-spacing:1px;margin-top:45px;color:#476353}.report-cover h1{font-size:24pt;color:#087443;margin:5px 0 35px}.report-cover-org{font-size:21pt;font-weight:bold;margin:0 0 12px;overflow-wrap:anywhere}.report-meta-grid{width:100%;display:block;margin:25px 0}.report-meta-grid>div{display:inline-block;width:31%;padding:10px;border:1px solid #d5e3da;vertical-align:top;margin:0 1% 8px 0}.report-meta-grid small{display:block;text-transform:uppercase;font-size:8pt;color:#60756a;margin-bottom:4px}.report-meta-grid strong{font-size:10pt}.report-confidential{font-size:8pt;color:#60756a;margin-top:32px;border-top:1px solid #d5e3da;padding-top:10px}.report-summary{page-break-after:always}.report-summary-title p{color:#60756a}.report-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:8px 0 18px;font-size:9pt}.report-table th,.report-table td{border:1px solid #d5e3da;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-wrap:break-word}.report-table th{background:#edf6f0;color:#174d32}.report-summary-table th:first-child{width:8%}.report-summary-table th:nth-child(3){width:16%}.report-summary-table th:nth-child(4){width:30%}.report-progress{display:inline-block;width:80px;height:8px;background:#e5eee8;vertical-align:middle}.report-progress span{display:block;height:8px;background:#087443}.report-stage-heading{border-bottom:2px solid #087443;margin:25px 0 8px;padding-bottom:6px;page-break-after:avoid}.report-stage-heading h2{display:inline;color:#087443;font-size:14pt;margin:0}.report-stage-heading>span{font-size:9pt;letter-spacing:1px;color:#087443}.report-stage-heading small{float:right;color:#60756a}.report-photo img{max-width:220px;max-height:180px;object-fit:contain;margin-top:8px}.report-empty{color:#60756a}.report-footer{border-top:1px solid #d5e3da;margin-top:28px;padding-top:10px;font-size:8pt;color:#60756a}.report-footer span{float:right}tr{page-break-inside:avoid}';
  const html='<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Rapport JOKKOO - '+safeName+'</title><style>'+css+'</style></head><body>'+report.outerHTML+'</body></html>';
  const blob=new Blob(['\\ufeff',html],{type:'application/msword;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='JOKKOO_Rapport_'+safeName+'.doc';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function renderDiagResults(){
  const d=getCurrent();
  if(!d){$('#content').innerHTML='<div class="empty">Aucun résultat sélectionné. Retournez dans Mes enquêtes.</div>';return}
  const meta=d.meta||{}, answers=d.answers||{}, sc=scoreDiag(d);
  const hasVal=v=>v!==undefined&&v!==null&&v!==''&&(typeof v!=='object'||(Array.isArray(v)?v.length>0:Object.keys(v).length>0));
  const answered=Object.values(answers).filter(hasVal).length;
  const visitStats=JOKKOO_VISITES.map((v,i)=>{const n=v.questions.filter(q=>hasVal(answers[q.id])).length;return {v,i,n,total:v.questions.length,pct:v.questions.length?Math.round(n/v.questions.length*100):0}});
  const sections=visitStats.map(st=>{
    const rows=st.v.questions.map(q=>{
      const val=answers[q.id], photo=d.photos&&d.photos[q.id];
      let value=hasVal(val)?resultValue(val):'<span class="report-empty">Non renseigné</span>';
      if(photo){const src=photoSrc(d,q.id);if(src)value+='<div class="report-photo"><img src="'+esc(src)+'" alt="Photo jointe"></div>'}
      return '<tr><th>'+esc(q.label)+'</th><td>'+value+'</td></tr>';
    }).join('');
    return '<section class="report-section"><div class="report-stage-heading"><span>ÉTAPE '+(st.i+1)+'</span><h2>'+esc(st.v.title)+'</h2><small>'+st.n+' / '+st.total+' renseigné(s)</small></div>'+(st.v.subtitle?'<p class="report-subtitle">'+esc(st.v.subtitle)+'</p>':'')+'<table class="report-table"><tbody>'+rows+'</tbody></table></section>';
  }).join('');
  const summaryRows=visitStats.map(st=>'<tr><td class="report-num">'+(st.i+1)+'</td><td>'+esc(st.v.title)+'</td><td>'+st.n+' / '+st.total+'</td><td><div class="report-progress"><span style="width:'+st.pct+'%"></span></div><b>'+st.pct+'%</b></td></tr>').join('');
  $('#content').innerHTML='<div class="section-title report-actions"><div><h2>Rapport de résultats du diagnostic</h2><div class="muted">Document de synthèse · '+esc(d.numero||'Référence non attribuée')+'</div></div><div class="toolbar"><button class="btn btn-secondary" onclick="nav(\''+(role()==='enqueteur'?'list':'enquetes')+'\')">← Retour aux enquêtes</button><button class="btn btn-secondary" onclick="exportDiagWord()">Télécharger Word</button><button class="btn btn-primary" onclick="window.print()">Télécharger PDF / Imprimer</button></div></div>'+
  '<article class="diag-report"><header class="report-cover"><div class="report-brand">JOKKOO <span>DIAGNOSTIC</span></div><div class="report-redline"></div><p class="report-kicker">RAPPORT DE RÉSULTATS</p><h1>DU DIAGNOSTIC</h1><div class="report-cover-org">'+esc(meta.nom||d.numero||'Organisation non renseignée')+'</div><div class="report-ref">Référence : '+esc(d.numero||'Non attribuée')+' <span>·</span> Statut : '+esc(d.status||'Non renseigné')+'</div></header>'+
  '<div class="report-meta-grid"><div><small>Organisation</small><strong>'+esc(meta.nom||'Non renseignée')+'</strong></div><div><small>Commune</small><strong>'+esc(meta.commune||'Non renseignée')+'</strong></div><div><small>Enquêteur</small><strong>'+esc(meta.agent||'Non renseigné')+'</strong></div><div><small>Score global</small><strong>'+(sc.count?Math.round(sc.pct*100)+'%':'Non calculé')+'</strong></div><div><small>Réponses enregistrées</small><strong>'+answered+'</strong></div></div>'+
  '<div class="report-confidential">Document confidentiel — réservé aux personnes autorisées.</div>'+
  '<section class="report-summary"><div class="report-summary-title"><h2>Synthèse du diagnostic</h2><p>Vue d’ensemble du taux de renseignement par étape du parcours de diagnostic.</p></div><table class="report-table report-summary-table"><thead><tr><th>N°</th><th>Étape</th><th>Renseignés</th><th>Avancement</th></tr></thead><tbody>'+summaryRows+'</tbody></table><p class="report-total">Total : <strong>'+answered+' champs renseignés</strong> sur '+JOKKOO_VISITES.reduce((n,v)=>n+v.questions.length,0)+'</p></section>'+sections+
  '<footer class="report-footer">JOKKOO DIAGNOSTIC <span>Document confidentiel — réservé aux personnes autorisées</span></footer></article>';
}

async function refreshDiag(id){if(!sb||ME.offline||!navigator.onLine||role()==='enqueteur')return;try{const r=await sb.from('enquetes').select('*').eq('id',id).maybeSingle();if(r.error||!r.data)return;const i=db.diagnostics.findIndex(x=>x.id===id);if(i<0)return;const n=fromServer(r.data);if(db.diagnostics[i]._thumbs)n._thumbs=db.diagnostics[i]._thumbs;db.diagnostics[i]=n;if(currentId===id&&view==='new')render()}catch(e){console.warn('refreshDiag',e)}}
function renderForm(){let d=getCurrent();if(!d){$('#content').innerHTML='<div class="empty">Aucun diagnostic sélectionné.</div>';return}let v=JOKKOO_VISITES[currentVisit];let pct=Math.round((currentVisit/JOKKOO_VISITES.length)*100);$('#content').innerHTML=`<div class="card"><div class="diagnostic-head"><div><h2 style="margin:0">${esc(d.numero)}</h2><div class="muted">Fiche diagnostic JOKKOO</div></div><div class="toolbar"><span class="badge ${badgeCls(d.status)}">${d.status}</span>${canEdit(d)?'<button class="btn btn-secondary" onclick="saveDiagnostic(\'Sauvegardée\')">💾 Sauvegarder</button>':''}${validateBtn(d)}</div></div><div class="diagnostic-meta"><div class="meta-box"><small>Organisation</small><strong>${esc(d.meta.nom)||'À renseigner'}</strong></div><div class="meta-box"><small>Commune</small><strong>${esc(d.meta.commune)||'—'}</strong></div><div class="meta-box"><small>Enquêteur</small><strong>${esc(d.meta.agent)||'—'}</strong></div><div class="meta-box"><small>Date</small><input class="input" type="date" value="${esc(d.meta.date)}" ${canEdit(d)?'':'disabled'} onchange="setMeta('date',this.value)"></div></div><div class="progress"><i style="width:${Math.max(4,pct)}%"></i></div><div class="visit-tabs">${JOKKOO_VISITES.map((x,i)=>`<button class="visit-tab ${i===currentVisit?'active':''} ${i<currentVisit?'done':''}" onclick="goVisit(${i})">${i+1}. ${esc(x.title)}</button>`).join('')}</div><div class="section-title"><div><h2>${esc(v.title)}</h2><div class="muted">${esc(v.subtitle)}</div></div><span class="small">Étape ${currentVisit+1}/${JOKKOO_VISITES.length}</span></div>${(!canEdit(d)&&!Object.keys(d.answers||{}).length)?'<div class="empty">Aucune réponse enregistrée pour cette fiche sur le serveur (brouillon vide).</div>':''}<fieldset class="ro" ${canEdit(d)?'':'disabled'}><div class="qgrid">${v.questions.map(renderQuestion).join('')}</div></fieldset><div class="sticky-actions"><button class="btn btn-secondary" ${currentVisit===0?'disabled':''} onclick="goVisit(${currentVisit-1})">← Précédent</button><div class="toolbar">${canEdit(d)?'<button class="btn btn-secondary" onclick="saveDiagnostic(\'Brouillon\')">Sauvegarder le brouillon</button>':''}${currentVisit<JOKKOO_VISITES.length-1?`<button class="btn btn-primary" onclick="goVisit(${currentVisit+1})">${canEdit(d)?'Enregistrer et continuer →':'Suivant →'}</button>`:(canEdit(d)?`<button class="btn btn-gold" onclick="finalizeDiag()">🔒 Enregistrer définitivement</button>`:'')}</div></div></div>`}
function renderQuestion(q){let d=getCurrent(), val=d.answers[q.id];if(q.condition){let actual=d.answers[q.condition.id];if(q.condition.equals!==undefined&&actual!==q.condition.equals)return '';if(q.condition.notEquals!==undefined&&actual===q.condition.notEquals)return ''}let note='';let p=paramFor(q,val);if(p){note=`<div class="score"><span>Score automatique</span><b>${Math.round(p.score*100)/100}/3 — ${esc(p.commentaire)}</b></div>`}else if(q.unrated){note='<div class="condition-note">Question informative — non notée dans PARAMETRES.</div>'}if(q.type==='checkdate'){let x=val||{};return `<div class="qcard"><label class="qtitle">${esc(q.label)}</label><label class="choice"><input type="checkbox" ${x.done?'checked':''} onchange="setAns('${q.id}',{done:this.checked,date:(this.checked?(getAns('${q.id}').date||new Date().toISOString().slice(0,10)):getAns('${q.id}').date||'')})"> Réalisé</label><input class="input" type="date" value="${esc(x.date||'')}" onchange="setAns('${q.id}',{done:getAns('${q.id}').done,date:this.value})"></div>`}
if(q.type==='photoDoc'){let ph=d.photos[q.id];return `<div class="qcard"><label class="qtitle">${esc(q.label)}</label><div class="choices"><label class="choice"><input type="radio" name="doc_${q.id}" ${val==='Oui'?'checked':''} onchange="setAns('${q.id}','Oui')"> Oui — document disponible</label><label class="choice"><input type="radio" name="doc_${q.id}" ${val==='Non'?'checked':''} onchange="setAns('${q.id}','Non')"> Non</label></div><div class="photo-box" style="margin-top:8px"><button class="btn btn-secondary" onclick="takePhoto('${q.id}')">📷 Prendre une photo</button><button class="btn btn-secondary" onclick="choosePhoto('${q.id}')">🖼️ Photo existante</button></div><div class="photo-preview" id="preview_${q.id}" style="display:${ph?'block':'none'}">${ph?`<img src="${photoSrc(d,q.id)}" ${photoSrc(d,q.id)?'':'data-path="'+esc(ph)+'"'}>`:''}</div></div>`}
let input='';if(q.type==='textarea')input=`<textarea class="input" onchange="setAns('${q.id}',this.value)" placeholder="Saisir votre réponse...">${esc(val||'')}</textarea>`;else if(q.type==='text'||q.type==='tel'||q.type==='number'||q.type==='date')input=`<input class="input" type="${q.type==='text'?'text':q.type}" value="${esc(val||'')}" ${q.min!==undefined?'min="'+q.min+'"':''} ${q.max!==undefined?'max="'+q.max+'"':''} onchange="setAns('${q.id}',this.value)">`;else if(q.type==='select')input=`<select onchange="setAns('${q.id}',this.value);render()"><option value="">Sélectionner...</option>${q.options.map(o=>`<option ${val===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;else if(q.type==='multiselect'){let a=Array.isArray(val)?val:[];input=`<div class="choices">${q.options.map(o=>`<label class="choice"><input type="checkbox" ${a.includes(o)?'checked':''} onchange="toggleMulti('${q.id}',${JSON.stringify(o)})">${esc(o)}</label>`).join('')}</div>`}return `<div class="qcard ${q.type==='textarea'?'full':''}"><label class="qtitle">${esc(q.label)} ${q.required?'<span class="required">*</span>':''} ${q.unrated?'<span class="unrated">Non noté</span>':''}</label>${input}${q.source_label?`<div class="condition-note">Question Excel : ${esc(q.source_label)}</div>`:''}${note}</div>`}
function getAns(id){return getCurrent().answers[id]||{}}
function toggleMulti(id,o){let d=getCurrent(),a=Array.isArray(d.answers[id])?d.answers[id]:[];a=a.includes(o)?a.filter(x=>x!==o):[...a,o];setAns(id,a)}
function goVisit(i){if(i<0||i>=JOKKOO_VISITES.length)return;saveDB();currentVisit=i;render()}
function paramFor(q,val){if(q.unrated||val==null||val===''||(typeof val==='object'&&!Array.isArray(val)))return null;if(Array.isArray(val)){if(!val.length)return null;let ps=val.map(v=>paramFor(q,v)).filter(Boolean);if(!ps.length)return null;return {domaine:ps[0].domaine,critere:ps[0].critere,question:ps[0].question,reponse:val.join(', '),score:ps.reduce((a,p)=>a+Number(p.score),0)/ps.length,commentaire:ps.map(p=>p.commentaire).join(' ; ')}}let aliases={'bureau':'Bureau exécutif structuré','reunions':'Fréquence des réunions','pv':'PV de réunions rédigés et archivés','ag':'AG annuelle de renouvellement','decision':'Processus décisionnel','roles':'Rôles clairement définis','attributions':'Rôles clairement définis','fiches_poste':'Fiches de poste disponibles','organigramme':'Organigramme documenté','taches':'Répartition des tâches','processus_doc':'Processus internes documentés','outils_suivi':'Outils de suivi des activités','budget':'Budget annuel','compta':'Comptabilité à jour','frequence_etats':'États financiers','partage':'Rapports financiers partagés','compte':'Compte/caisse','agr':'Activités génératrices de revenus','autofin':'Part du budget couverte par revenus propres','types_part':'Types de partenariats','besoins':'Besoins prioritaires','diversification':'Stratégie de diversification'};let question=aliases[q.id];if(!question)return null;let resp=String(val).replace(/^Autres à préciser$/,'Autre').replace(/^Oui écrit et suivi$/,'Oui écrit et suivi').replace(/^Fixe$/,'Fixe').replace(/^Compte dans une SFD$/,'Compte dans une SFD');let p=JOKKOO_PARAMS.find(x=>x.question===question&&x.reponse===resp);if(!p&&q.id==='bureau')p=JOKKOO_PARAMS.find(x=>x.question===question&&x.reponse===(resp==='Oui, complet'?'Oui, complet':resp==='Partiel'?'Partiel':'Non'));if(!p&&q.id==='roles')p=JOKKOO_PARAMS.find(x=>x.question===question&&x.reponse===resp);return p||null}
function scoreDiag(d){let vals=[];for(const v of JOKKOO_VISITES){for(const q of v.questions){let p=paramFor(q,d.answers[q.id]);if(p)vals.push(Number(p.score)/3)}}return {pct:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0,count:vals.length}}
function domainScores(ds){let out={};for(const d of ds){for(const v of JOKKOO_VISITES){for(const q of v.questions){let p=paramFor(q,d.answers[q.id]);if(p){out[p.domaine]??=[];out[p.domaine].push(Number(p.score)/3)}}}}for(const k of Object.keys(out))out[k]=out[k].reduce((a,b)=>a+b,0)/out[k].length;return out}
function renderOrgs(){let map={};db.diagnostics.forEach(d=>{let n=d.meta.nom||'Organisation sans nom';map[n]??=[];map[n].push(d)});$('#content').innerHTML=`<div class="section-title"><h2>Organisations</h2></div><div class="grid">${Object.entries(map).map(([n,a])=>`<div class="card"><h3 style="margin-top:0">${esc(n)}</h3><div class="muted">${a.length} diagnostic(s)</div><div class="toolbar" style="margin-top:12px"><button class="btn btn-secondary" onclick="openDiag('${a[0].id}')">Ouvrir</button></div></div>`).join('')||'<div class="empty">Aucune organisation enregistrée.</div>'}</div>`}
function renderRef(){let missing=[];JOKKOO_VISITES.forEach(v=>v.questions.forEach(q=>{if(q.domain&&!q.unrated&&!['text','textarea','number','date','tel','multiselect'].includes(q.type)&&!JOKKOO_PARAMS.some(p=>p.question && (p.question.toLowerCase().includes(q.label.split(' ')[0].toLowerCase())||q.id==='bureau'&&p.question==='Bureau exécutif structuré')))missing.push(q)}));$('#content').innerHTML=`<div class="section-title"><h2>Référentiel de notation</h2><div class="muted">69 règles importées depuis PARAMETRES</div></div><div class="card table-wrap"><table class="table"><thead><tr><th>Domaine</th><th>Critère</th><th>Question</th><th>Réponse</th><th>Score</th><th>Commentaire</th></tr></thead><tbody>${JOKKOO_PARAMS.map(p=>`<tr><td>${esc(p.domaine)}</td><td>${esc(p.critere)}</td><td>${esc(p.question)}</td><td>${esc(p.reponse)}</td><td><b>${Math.round(p.score*100)/100}/3</b></td><td>${esc(p.commentaire)}</td></tr>`).join('')}</tbody></table></div><div class="section-title"><h2>Questions à barème non défini</h2></div><div class="card"><div class="muted small">Le fichier Excel contient des questions dont la notation n'est pas entièrement présente dans PARAMETRES. Elles restent collectées mais ne sont pas notées automatiquement.</div><ul>${['Durée du mandat de chaque poste','Expérience passée du dirigeant','Participation financière des membres','Vision, mission, valeurs et objectifs partagés','Principales sources de financement'].map(x=>`<li>${x}</li>`).join('')}</ul></div>`}
function renderExports(){
  const total=(db.diagnostics||[]).length;
  const totalRep=(db.diagnostics||[]).reduce((n,d)=>n+Object.values(d.answers||{}).filter(v=>v!==undefined&&v!==null&&v!=='').length,0);
  $('#content').innerHTML=`<div class="section-title"><div><h2>Export des données</h2><div class="muted">Téléchargez un fichier Excel présenté et structuré pour le suivi au siège.</div></div></div>
  <div class="grid export-summary"><div class="card"><div class="muted">Dossiers disponibles</div><h3>${total}</h3></div><div class="card"><div class="muted">Réponses enregistrées</div><h3>${totalRep}</h3></div></div>
  <div class="card export-main-card"><div class="export-icon">📊</div><div class="export-main-copy"><h3>Rapport Excel JOKKOO</h3><p>Un tableau avec en-têtes colorés, bordures, lignes alternées et colonnes clairement séparées. Chaque ligne correspond à une réponse, avec le dossier, l’organisation, la commune, l’enquêteur, la question, la réponse et le score disponible.</p><div class="muted">Format compatible avec Microsoft Excel · Toutes les enquêtes accessibles à votre compte</div></div><button class="btn btn-primary" onclick="exportExcelStyled()">⇩ Télécharger Excel</button></div>
  <div class="card"><h3>Rapports individuels</h3><p class="muted">Pour télécharger une fiche complète en Word ou PDF, ouvrez <b>Mes enquêtes → Voir</b>, puis utilisez les boutons du rapport individuel. Les rapports individuels sont disponibles en Word ou PDF depuis la fiche de chaque enquête.</p></div>`;
}
function takePhoto(id){let inp=$('#photoInput');inp.value='';inp.onchange=()=>handlePhoto(id,inp.files[0]);inp.click()}
function choosePhoto(id){takePhoto(id)}
function exportExcelStyled(){
  const diagnostics=db.diagnostics||[];
  if(!diagnostics.length){toast('Aucune enquête à exporter');return}
  const escX=v=>String(v===undefined||v===null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmt=v=>Array.isArray(v)?v.join(' ; '):(v&&typeof v==='object'?JSON.stringify(v):String(v??''));
  const rows=[];
  diagnostics.forEach(d=>{const answers=d.answers||{};JOKKOO_VISITES.forEach(v=>v.questions.forEach(q=>{const val=answers[q.id];if(val===undefined||val===null||val==='')return;const p=paramFor(q,val);rows.push([d.numero,d.meta&&d.meta.nom,d.meta&&d.meta.commune,d.meta&&d.meta.agent,d.status,q.label,fmt(val),p&&p.score!==undefined?p.score:'',p&&p.commentaire||''])}))});
  if(!rows.length){toast('Aucune réponse renseignée à exporter');return}
  const headers=['Référence dossier','Organisation','Commune','Enquêteur','Statut','Question / Indicateur','Réponse enregistrée','Score','Commentaire / Analyse'];
  const today=new Date().toLocaleDateString('fr-FR');
  const html='<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Réponses JOKKOO</x:Name><x:WorksheetOptions><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>4</x:SplitHorizontal><x:TopRowBottomPane>4</x:TopRowBottomPane><x:ActivePane>2</x:ActivePane></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--><style>body{font-family:Calibri,Arial,sans-serif;color:#20372b}table{border-collapse:collapse;width:100%}.title{background:#087443;color:#fff;font-size:18pt;font-weight:bold;padding:14px}.sub{background:#eaf4ee;color:#315b43;font-size:10pt;padding:8px}.meta{background:#f4f8f5;color:#456453;padding:7px}.head th{background:#087443;color:#fff;font-weight:bold;border:1px solid #075c35;padding:9px;text-align:left;vertical-align:middle;white-space:normal}.data td{border:1px solid #cbdcd1;padding:7px;vertical-align:top;mso-number-format:"\\@";white-space:normal;word-wrap:break-word}.data:nth-child(even) td{background:#edf6f0}.foot{color:#60756a;font-size:9pt;padding:10px;border-top:2px solid #c9232d}</style></head><body><table><tr><td colspan="9" class="title">JOKKOO DIAGNOSTIC — EXPORT DES ENQUÊTES</td></tr><tr><td colspan="9" class="sub">Rapport de suivi des diagnostics · Généré le '+escX(today)+'</td></tr><tr><td colspan="3" class="meta">Dossiers exportés : '+diagnostics.length+'</td><td colspan="3" class="meta">Réponses renseignées : '+rows.length+'</td><td colspan="3" class="meta">Document interne — données confidentielles</td></tr><tr class="head">'+headers.map(h=>'<th>'+escX(h)+'</th>').join('')+'</tr>'+rows.map(r=>'<tr class="data">'+r.map(v=>'<td>'+escX(v)+'</td>').join('')+'</tr>').join('')+'<tr><td colspan="9" class="foot">JOKKOO DIAGNOSTIC · Export de travail — conserver dans un emplacement sécurisé.</td></tr></table></body></html>';
  const blob=new Blob(['\ufeff',html],{type:'application/vnd.ms-excel;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='JOKKOO_Export_Enquetes_'+new Date().toISOString().slice(0,10)+'.xls';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
/* ===== Ajouts : droits d'édition, enquêtes de l'enquêteur, tableau de bord, statistiques ===== */
const canEdit = d => !!d && role() === 'enqueteur' && d.meta.enqueteurId === ME.profile.id && ['Brouillon', 'Sauvegardée'].includes(d.status) && !d._conflict;
const validateBtn = d => d && d.status === 'Définitive' && (role() === 'super_admin' || (role() === 'admin' && (ME.profile.permissions || []).includes('enquetes.validate')))
  ? `<button class="btn btn-gold" onclick="enqStatus('${d.id}','validated')">✓ Valider l’enquête</button>` : '';

function newDiagnostic() {
  if (role() !== 'enqueteur') { toast('Seuls les enquêteurs créent des enquêtes'); return }
  if (!ME.profile.commune_id) { toast('Votre compte n’est rattaché à aucune commune : contactez l’administration'); return }
  const now = new Date().toISOString(), loc = 'LOC-' + now.slice(0, 10).replace(/-/g, '') + '-' + uid().slice(0, 4).toUpperCase();
  const d = { id: uid(), numero: loc, numero_local: loc, createdAt: now, updatedAt: now, status: 'Brouillon',
    meta: { nom: '', date: now.slice(0, 10), commune: communeName(ME.profile.commune_id), agent: fullName(ME.profile), communeId: ME.profile.commune_id, enqueteurId: ME.profile.id },
    answers: {}, photos: {}, history: [] };
  db.diagnostics.unshift(d); currentId = d.id; currentVisit = 0; touch(d); nav('new'); toast('Nouvelle enquête créée');
}
function setAns(id, val) { const d = getCurrent(); if (!canEdit(d)) return; d.answers[id] = val; if (id === 'nom') d.meta.nom = String(val || '').trim(); touch(d); if (id === 'nom') render() }
function setMeta(k, v) { const d = getCurrent(); if (!canEdit(d)) return; d.meta[k] = v; touch(d) }
function saveDiagnostic(status) {
  const d = getCurrent(); if (!canEdit(d)) return;
  d.status = status; d.history.push({ at: new Date().toISOString(), action: 'sauvegarde', status }); touch(d);
  toast(navigator.onLine ? 'Diagnostic sauvegardé' : 'Sauvegardé sur l’appareil — envoi dès le retour du réseau'); render(); syncNow();
}
function finalizeDiag() {
  const d = getCurrent(); if (!canEdit(d)) return;
  if (!d.meta.nom) { toast('Renseignez le nom de l’organisation'); currentVisit = 1; render(); return }
  if (!confirm('Une fiche définitive ne pourra plus être modifiée. Continuer ?')) return;
  d.status = 'Définitive'; d.history.push({ at: new Date().toISOString(), action: 'enregistrement définitif' }); touch(d);
  toast('Fiche définitive verrouillée'); syncNow(); newDiagnostic();
}
function handlePhoto(id, file) {
  if (!file) return; const d = getCurrent(); if (!canEdit(d)) return;
  const r = new FileReader();
  r.onload = () => { const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'), max = 1280, s = Math.min(1, max / Math.max(img.width, img.height));
    c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    d.photos[id] = c.toDataURL('image/jpeg', .72); touch(d); render(); toast('Photo enregistrée sur l’appareil');
  }; img.src = r.result };
  r.readAsDataURL(file);
}
async function deleteDraft(id) {
  const d = db.diagnostics.find(x => x.id === id); if (!d || d.status !== 'Brouillon') return;
  if (!confirm('Supprimer ce brouillon ?')) return;
  if (d._server) {
    if (!navigator.onLine || ME.offline) { toast('Suppression d’un brouillon déjà envoyé : possible uniquement en ligne'); return }
    const r = await sb.from('enquetes').delete().eq('id', id); if (r.error) { toast('Suppression refusée'); return }
  }
  db.diagnostics = db.diagnostics.filter(x => x.id !== id); if (currentId === id) currentId = null; saveDB(); render(); toast('Brouillon supprimé');
}

/* ---- Liste ---- */
const LF = { q: '', statut: '' };
function renderList() {
  const f = db.diagnostics.filter(d => (!LF.statut || d.status === LF.statut) && (!LF.q || (d.meta.nom + ' ' + d.numero).toLowerCase().includes(LF.q.toLowerCase())));
  $('#content').innerHTML = `<div class="section-title"><h2>Mes enquêtes</h2><div class="toolbar"><button class="btn btn-primary" onclick="newDiagnostic()">＋ Nouvelle</button></div></div>
  <div class="toolbar filters"><input class="input" placeholder="Rechercher (n°, organisation)" value="${esc(LF.q)}" onchange="LF.q=this.value;renderList()"><select class="input" onchange="LF.statut=this.value;renderList()"><option value="">Tous les statuts</option>${['Brouillon', 'Sauvegardée', 'Définitive', 'Validée', 'Archivée'].map(s => `<option ${LF.statut === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>${renderDiagTable(f)}`;
}

/* ---- Tableau de bord enquêteur ("Mon espace") ---- */
function legacyData() { try { const x = JSON.parse(localStorage.getItem('jokkoo_diagnostics_v1') || 'null'); return x && x.diagnostics ? x.diagnostics : [] } catch { return [] } }
function dashEnqueteur() {
  const ds = db.diagnostics, today = new Date().toISOString().slice(0, 10);
  const fin = ds.filter(isFinal).length, td = ds.filter(d => sameDay(d.createdAt, today)).length, wk = ds.filter(d => since(d.createdAt, 7)).length;
  const sc = ds.map(scoreDiag).filter(x => x.count), avg = sc.length ? sc.reduce((a, x) => a + x.pct, 0) / sc.length : 0, dom = domainScores(ds), L = legacyData().length;
  $('#content').innerHTML = `${L ? `<div class="card banner"><div><b>${L} diagnostic(s) de l’ancienne version trouvé(s) sur cet appareil.</b><div class="muted small">Ils seront rattachés à votre compte et à votre commune, puis envoyés au serveur. Une copie de sauvegarde est téléchargée avant l’import.</div></div><button class="btn btn-gold" onclick="importLegacy()">Importer</button></div>` : ''}
  <div class="card hello"><div><h2 style="margin:0">Bonjour ${esc(ME.profile.prenom || '')}</h2><div class="muted">Commune : <b>${esc(communeName(ME.profile.commune_id) || 'non rattachée')}</b> · Compte <span class="badge b-final">Actif</span></div></div><button class="btn btn-primary" onclick="newDiagnostic()">＋ Nouvelle enquête</button></div>
  <div class="grid" style="margin-top:16px">${kpi(ds.length, 'Enquêtes')}${kpi(fin, 'Terminées', 'var(--red)')}${kpi(ds.length - fin, 'En cours / brouillons', 'var(--gold)')}${kpi(td, 'Aujourd’hui')}</div>
  <div class="grid" style="margin-top:16px"><div class="card"><div class="muted small">Score moyen des diagnostics notés</div><div class="score-big">${Math.round(avg * 100)}%</div><div class="bar"><i style="width:${Math.round(avg * 100)}%"></i></div><div class="muted small" style="margin-top:8px">Cette semaine : <b>${wk}</b> enquête(s)</div></div>
  <div class="card" style="grid-column:span 3"><h3 style="margin-top:0">Scores moyens par domaine</h3>${Object.entries(dom).map(([k, v]) => `<div class="domain-row"><b>${esc(k)}</b><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div><strong>${Math.round(v * 100)}%</strong></div>`).join('') || '<div class="empty">Les scores apparaîtront après les premières réponses.</div>'}</div></div>
  <div class="section-title"><h2>Dernières enquêtes</h2></div>${renderDiagTable(ds.slice(0, 8))}`;
}
function importLegacy() {
  const L = legacyData(); if (!L.length) return;
  if (!ME.profile.commune_id) { toast('Compte sans commune : import impossible'); return }
  download('sauvegarde-avant-import.json', JSON.stringify({ diagnostics: L }), 'application/json');
  const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s)); let n = 0;
  for (const o of L) {
    const id = isUuid(o.id) ? o.id : uid(); if (db.diagnostics.some(d => d.id === id)) continue;
    const m = o.meta || {}, now = new Date().toISOString();
    db.diagnostics.push({ id, numero: o.numero, numero_local: o.numero, createdAt: o.createdAt || now, updatedAt: o.updatedAt || now,
      status: ['Brouillon', 'Sauvegardée', 'Définitive'].includes(o.status) ? o.status : 'Brouillon',
      meta: { nom: m.nom || (o.answers || {}).nom || '', date: m.date || '', commune: communeName(ME.profile.commune_id), agent: fullName(ME.profile), communeId: ME.profile.commune_id, enqueteurId: ME.profile.id },
      answers: o.answers || {}, photos: o.photos || {}, history: o.history || [], _dirty: true, _v: 1 }); n++;
  }
  localStorage.removeItem('jokkoo_diagnostics_v1'); db.diagnostics.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  saveDB(); toast(n + ' fiche(s) importée(s) — envoi en cours'); syncNow(); render();
}

/* ---- Statistiques (enquêteur : les siennes ; admin/super admin : le périmètre visible) ---- */
function avgScore(L) { const s = L.map(scoreDiag).filter(x => x.count); return s.length ? Math.round(s.reduce((a, x) => a + x.pct, 0) / s.length * 100) + ' %' : '—' }
function renderStats() {
  const ds = db.diagnostics, dom = domainScores(ds), today = new Date().toISOString().slice(0, 10);
  let h = `<div class="grid">${kpi(ds.length, 'Enquêtes')}${kpi(ds.filter(isFinal).length, 'Terminées', 'var(--red)')}${kpi(ds.filter(d => since(d.createdAt, 7)).length, 'Cette semaine', 'var(--gold)')}${kpi(ds.filter(d => sameDay(d.createdAt, today)).length, 'Aujourd’hui')}</div>
  <div class="section-title"><h2>Activité — 14 derniers jours</h2></div><div class="card">${barsOf(daysSeries(ds, 14))}</div>
  <div class="section-title"><h2>Scores moyens par domaine</h2></div><div class="card">${Object.entries(dom).map(([k, v]) => `<div class="domain-row"><b>${esc(k)}</b><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div><strong>${Math.round(v * 100)}%</strong></div>`).join('') || '<div class="empty">Aucune réponse notée pour le moment.</div>'}</div>`;
  if (isStaff()) {
    const grp = (f) => { const m = {}; ds.forEach(d => (m[f(d) || '—'] = m[f(d) || '—'] || []).push(d)); return Object.entries(m) };
    h += `<div class="section-title"><h2>Par commune</h2></div>` + tableOf(['Commune', 'Enquêtes', 'En cours', 'Terminées', 'Enquêteurs', 'Score moyen'],
      grp(d => d.meta.commune).map(([n, L]) => [`<b>${esc(n)}</b>`, L.length, L.filter(d => !isFinal(d)).length, L.filter(isFinal).length, new Set(L.map(d => d.meta.enqueteurId)).size, avgScore(L)]));
    h += `<div class="section-title"><h2>Par enquêteur</h2></div>` + tableOf(['Enquêteur', 'Enquêtes', 'Terminées', 'En cours', 'Aujourd’hui', 'Cette semaine'],
      grp(d => d.meta.agent).map(([n, L]) => [`<b>${esc(n)}</b>`, L.length, L.filter(isFinal).length, L.filter(d => !isFinal(d)).length, L.filter(d => sameDay(d.createdAt, today)).length, L.filter(d => since(d.createdAt, 7)).length]));
  }
  if (role() === 'super_admin') h += `<div class="section-title"><h2>Inscriptions — 30 derniers jours</h2></div><div class="card">${barsOf(daysSeries(ME.profiles.map(p => ({ createdAt: p.created_at })), 30))}</div>`;
  $('#content').innerHTML = h;
}

/* ---- Paramètres de l'enquêteur (synchronisation, cache) ---- */
function renderSettings() {
  const n = pendingCount();
  $('#content').innerHTML = `<div class="section-title"><h2>Paramètres</h2></div>
  <div class="card"><h3 style="margin-top:0">Synchronisation</h3><p class="muted">Les enquêtes sont enregistrées sur l’appareil, même sans réseau, puis envoyées automatiquement dès que la connexion revient.</p>
  <p><b>${n}</b> fiche(s) en attente d’envoi. ${ME.syncError ? `<span class="danger-text">Dernière erreur : ${esc(ME.syncError)}</span>` : ''}</p>
  <div class="toolbar"><button class="btn btn-secondary" onclick="syncNow(true)">↻ Synchroniser maintenant</button><button class="btn btn-danger" onclick="clearLocal()">Libérer l’espace (fiches déjà envoyées)</button></div></div>
  ${role() === 'super_admin' ? `<div class="card" style="margin-top:16px"><h3 style="margin-top:0">Connexion au serveur</h3><p class="muted small">Projet : ${esc(getCfg().url || '—')} · seule la clé publique (anon) est utilisée dans cette application.</p></div>` : ''}`;
}
function clearLocal() {
  if (!confirm('Supprimer de cet appareil les fiches déjà envoyées au serveur ? Les fiches en attente d’envoi sont conservées.')) return;
  db.diagnostics = db.diagnostics.filter(d => d._dirty || !d._server); saveDB(); toast('Espace libéré'); render();
}
Object.assign(VIEWS, { new: renderForm, resultats: renderDiagResults, list: renderList, organisations: renderOrgs, referentiel: renderRef, exports: renderExports, stats: renderStats, settings: renderSettings });
