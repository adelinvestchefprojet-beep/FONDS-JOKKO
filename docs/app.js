/* JOKKOO – fiches de diagnostic (formulaire, notation, exports). Données : voir core.js */
function getCurrent(){return db.diagnostics.find(d=>d.id===currentId)}
function renderDiagTable(ds){ds=ds.filter(d=>!d._unsaved);if(!ds.length)return '<div class="empty">Aucune enquête enregistrée. Commencez par créer une nouvelle fiche.</div>';return `<div class="card table-wrap"><table class="table"><thead><tr><th>N°</th><th>Organisation</th><th>Commune</th><th>Agent</th><th>Statut</th><th>Score</th><th></th></tr></thead><tbody>${ds.map(d=>{let s=scoreDiag(d);return `<tr><td><b>${esc(d.numero)}</b></td><td>${esc(d.meta.nom)||'—'}</td><td>${esc(d.meta.commune)||'—'}</td><td>${esc(d.meta.agent)||'—'}</td><td><span class="badge ${badgeCls(d.status)}">${d.status}</span>${d._dirty?' <small title="En attente d’envoi">⏳</small>':''}</td><td>${s.count?Math.round(s.pct*100)+'%':'—'}</td><td><button class="btn btn-secondary" onclick="openDiag('${d.id}')">${(isStaff()||isFinal(d))?'Voir le rapport':'Ouvrir / Modifier'}</button>${d.status==='Brouillon'&&d.meta.enqueteurId===(ME.profile||{}).id?` <button class="btn btn-danger" onclick="deleteDraft('${d.id}')">Supprimer</button>`:''}</td></tr>`}).join('')}</tbody></table></div>`}
let reportBack=null;
function ansCount(d){return Object.values((d&&d.answers)||{}).filter(v=>Array.isArray(v)?v.length:(v&&typeof v==='object'?(v.done||v.date):(v!==undefined&&v!==null&&v!==''))).length+Object.keys((d&&d.photos)||{}).length}
function openDiag(id){
  const d=db.diagnostics.find(x=>x.id===id);
  reportBack=null;
  // Résultats d'abord : personnel, fiches finalisées et toute fiche déjà renseignée.
  // Seule une fiche vide (nouveau brouillon) ouvre directement le formulaire.
  if(isStaff() || (d && (isFinal(d) || ansCount(d)>0))) return viewDiag(id);
  currentId=id;currentVisit=0;nav('new');refreshDiag(id)
}
function openOrgDiag(id){const d=db.diagnostics.find(x=>x.id===id);if(!d||d._unsaved){toast('Cette enquête n’est pas encore enregistrée');return}reportBack='organisations';viewDiag(id)}
function editDiag(id){reportBack=null;currentId=id;currentVisit=0;nav('new');refreshDiag(id)}
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
  $('#content').innerHTML='<div class="section-title report-actions"><div><h2>Rapport de résultats du diagnostic</h2><div class="muted">Document de synthèse · '+esc(d.numero||'Référence non attribuée')+'</div></div><div class="toolbar"><button class="btn btn-secondary" onclick="nav(\''+(reportBack||(role()==='enqueteur'?'list':'enquetes'))+'\')">'+(reportBack?'← Retour aux organisations':'← Retour aux enquêtes')+'</button>'+(canEdit(d)?'<button class="btn btn-secondary" onclick="editDiag(\''+d.id+'\')">✎ Modifier / Continuer l’enquête</button>':'')+'<button class="btn btn-secondary" onclick="exportDiagWord()">Télécharger Word</button><button class="btn btn-primary" onclick="window.print()">Télécharger PDF / Imprimer</button></div></div>'+
  '<article class="diag-report"><header class="report-cover"><div class="report-brand">JOKKOO <span>DIAGNOSTIC</span></div><div class="report-redline"></div><p class="report-kicker">RAPPORT DE RÉSULTATS</p><h1>DU DIAGNOSTIC</h1><div class="report-cover-org">'+esc(meta.nom||d.numero||'Organisation non renseignée')+'</div><div class="report-ref">Référence : '+esc(d.numero||'Non attribuée')+' <span>·</span> Statut : '+esc(d.status||'Non renseigné')+'</div></header>'+
  '<div class="report-meta-grid"><div><small>Organisation</small><strong>'+esc(meta.nom||'Non renseignée')+'</strong></div><div><small>Commune</small><strong>'+esc(meta.commune||'Non renseignée')+'</strong></div><div><small>Enquêteur</small><strong>'+esc(meta.agent||'Non renseigné')+'</strong></div><div><small>Score global</small><strong>'+(sc.count?Math.round(sc.pct*100)+'%':'Non calculé')+'</strong></div><div><small>Réponses enregistrées</small><strong>'+answered+'</strong></div></div>'+
  '<div class="report-confidential">Document confidentiel — réservé aux personnes autorisées.</div>'+
  '<section class="report-summary"><div class="report-summary-title"><h2>Synthèse du diagnostic</h2><p>Vue d’ensemble du taux de renseignement par étape du parcours de diagnostic.</p></div><table class="report-table report-summary-table"><thead><tr><th>N°</th><th>Étape</th><th>Renseignés</th><th>Avancement</th></tr></thead><tbody>'+summaryRows+'</tbody></table><p class="report-total">Total : <strong>'+answered+' champs renseignés</strong> sur '+JOKKOO_VISITES.reduce((n,v)=>n+v.questions.length,0)+'</p></section>'+sections+
  '<footer class="report-footer">JOKKOO DIAGNOSTIC <span>Document confidentiel — réservé aux personnes autorisées</span></footer></article>';
}

async function refreshDiag(id){if(!sb||ME.offline||!navigator.onLine||role()==='enqueteur')return;try{const r=await sb.from('enquetes').select('*').eq('id',id).maybeSingle();if(r.error||!r.data)return;const i=db.diagnostics.findIndex(x=>x.id===id);if(i<0)return;const n=fromServer(r.data);if(db.diagnostics[i]._thumbs)n._thumbs=db.diagnostics[i]._thumbs;db.diagnostics[i]=n;if(currentId===id&&view==='new')render()}catch(e){console.warn('refreshDiag',e)}}
function renderForm(){let d=getCurrent();if(!d){$('#content').innerHTML='<div class="empty">Aucun diagnostic sélectionné.</div>';return}let v=JOKKOO_VISITES[currentVisit];let pct=Math.round((currentVisit/JOKKOO_VISITES.length)*100);$('#content').innerHTML=`<div class="card"><div class="diagnostic-head"><div><h2 style="margin:0">${esc(d.numero)}</h2><div class="muted">Fiche diagnostic JOKKOO</div></div><div class="toolbar"><span class="badge ${badgeCls(d.status)}">${d._unsaved?'Non enregistrée':d.status}</span>${canEdit(d)?'<button class="btn btn-secondary" onclick="saveDiagnostic(\'Sauvegardée\')">💾 Sauvegarder</button>':''}${validateBtn(d)}</div></div><div class="diagnostic-meta"><div class="meta-box"><small>Organisation</small><strong>${esc(d.meta.nom)||'À renseigner'}</strong></div><div class="meta-box"><small>Commune</small><strong>${esc(d.meta.commune)||'—'}</strong></div><div class="meta-box"><small>Enquêteur</small><strong>${esc(d.meta.agent)||'—'}</strong></div><div class="meta-box"><small>Date</small><input class="input" type="date" value="${esc(d.meta.date)}" ${canEdit(d)?'':'disabled'} onchange="setMeta('date',this.value)"></div></div><div class="progress"><i style="width:${Math.max(4,pct)}%"></i></div><div class="visit-tabs">${JOKKOO_VISITES.map((x,i)=>`<button class="visit-tab ${i===currentVisit?'active':''} ${i<currentVisit?'done':''}" onclick="goVisit(${i})">${i+1}. ${esc(x.title)}</button>`).join('')}</div><div class="section-title"><div><h2>${esc(v.title)}</h2><div class="muted">${esc(v.subtitle)}</div></div><span class="small">Étape ${currentVisit+1}/${JOKKOO_VISITES.length}</span></div>${(!canEdit(d)&&!Object.keys(d.answers||{}).length)?'<div class="empty">Aucune réponse enregistrée pour cette fiche sur le serveur (brouillon vide).</div>':''}<fieldset class="ro" ${canEdit(d)?'':'disabled'}><div class="qgrid">${v.questions.map(renderQuestion).join('')}</div></fieldset><div class="sticky-actions"><button class="btn btn-secondary" ${currentVisit===0?'disabled':''} onclick="goVisit(${currentVisit-1})">← Précédent</button><div class="toolbar">${canEdit(d)?'<button class="btn btn-secondary" onclick="saveDiagnostic(\'Brouillon\')">Sauvegarder le brouillon</button>':''}${currentVisit<JOKKOO_VISITES.length-1?`<button class="btn btn-primary" onclick="saveAndContinue(${currentVisit+1})">${canEdit(d)?'Enregistrer et continuer →':'Suivant →'}</button>`:(canEdit(d)?`<button class="btn btn-gold" onclick="finalizeDiag()">🔒 Enregistrer définitivement</button>`:'')}</div></div></div>`}
function renderQuestion(q){let d=getCurrent(), val=d.answers[q.id];if(q.condition){let actual=d.answers[q.condition.id];if(q.condition.equals!==undefined&&actual!==q.condition.equals)return '';if(q.condition.notEquals!==undefined&&actual===q.condition.notEquals)return ''}let note='';let p=paramFor(q,val);if(p){note=`<div class="score"><span>Score automatique</span><b>${Math.round(p.score*100)/100}/3 — ${esc(p.commentaire)}</b></div>`}else if(q.unrated){note='<div class="condition-note">Question informative — non notée dans PARAMETRES.</div>'}if(q.type==='checkdate'){let x=val||{};return `<div class="qcard"><label class="qtitle">${esc(q.label)}</label><label class="choice"><input type="checkbox" ${x.done?'checked':''} onchange="setAns('${q.id}',{done:this.checked,date:(this.checked?(getAns('${q.id}').date||new Date().toISOString().slice(0,10)):getAns('${q.id}').date||'')})"> Réalisé</label><input class="input" type="date" value="${esc(x.date||'')}" onchange="setAns('${q.id}',{done:getAns('${q.id}').done,date:this.value})"></div>`}
if(q.type==='photoDoc'){let ph=d.photos[q.id];return `<div class="qcard"><label class="qtitle">${esc(q.label)}</label><div class="choices"><label class="choice"><input type="radio" name="doc_${q.id}" ${val==='Oui'?'checked':''} onchange="setAns('${q.id}','Oui')"> Oui — document disponible</label><label class="choice"><input type="radio" name="doc_${q.id}" ${val==='Non'?'checked':''} onchange="setAns('${q.id}','Non')"> Non</label></div><div class="photo-box" style="margin-top:8px"><button class="btn btn-secondary" onclick="takePhoto('${q.id}')">📷 Prendre une photo</button><button class="btn btn-secondary" onclick="choosePhoto('${q.id}')">🖼️ Photo existante</button></div><div class="photo-preview" id="preview_${q.id}" style="display:${ph?'block':'none'}">${ph?`<img src="${photoSrc(d,q.id)}" ${photoSrc(d,q.id)?'':'data-path="'+esc(ph)+'"'}>`:''}</div></div>`}
let input='';if(q.type==='textarea')input=`<textarea class="input" onchange="setAns('${q.id}',this.value)" placeholder="Saisir votre réponse...">${esc(val||'')}</textarea>`;else if(q.type==='text'||q.type==='tel'||q.type==='number'||q.type==='date')input=`<input class="input" type="${q.type==='text'?'text':q.type}" value="${esc(val||'')}" ${q.min!==undefined?'min="'+q.min+'"':''} ${q.max!==undefined?'max="'+q.max+'"':''} onchange="setAns('${q.id}',this.value)">`;else if(q.type==='select')input=`<select onchange="setAns('${q.id}',this.value);render()"><option value="">Sélectionner...</option>${q.options.map(o=>`<option ${val===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;else if(q.type==='multiselect'){let a=Array.isArray(val)?val:[];input=`<div class="choices">${q.options.map(o=>`<label class="choice"><input type="checkbox" ${a.includes(o)?'checked':''} onchange="toggleMulti('${q.id}',${JSON.stringify(o)})">${esc(o)}</label>`).join('')}</div>`}return `<div class="qcard ${q.type==='textarea'?'full':''}"><label class="qtitle">${esc(q.label)} ${q.required?'<span class="required">*</span>':''} ${q.unrated?'<span class="unrated">Non noté</span>':''}</label>${input}${q.source_label?`<div class="condition-note">Question Excel : ${esc(q.source_label)}</div>`:''}${note}</div>`}
function getAns(id){return getCurrent().answers[id]||{}}
function toggleMulti(id,o){let d=getCurrent(),a=Array.isArray(d.answers[id])?d.answers[id]:[];a=a.includes(o)?a.filter(x=>x!==o):[...a,o];setAns(id,a)}
function goVisit(i){if(i<0||i>=JOKKOO_VISITES.length)return;saveDB();currentVisit=i;render()}
function paramFor(q,val){if(q.unrated||val==null||val===''||(typeof val==='object'&&!Array.isArray(val)))return null;if(Array.isArray(val)){if(!val.length)return null;let ps=val.map(v=>paramFor(q,v)).filter(Boolean);if(!ps.length)return null;return {domaine:ps[0].domaine,critere:ps[0].critere,question:ps[0].question,reponse:val.join(', '),score:ps.reduce((a,p)=>a+Number(p.score),0)/ps.length,commentaire:ps.map(p=>p.commentaire).join(' ; ')}}let aliases={'bureau':'Bureau exécutif structuré','reunions':'Fréquence des réunions','pv':'PV de réunions rédigés et archivés','ag':'AG annuelle de renouvellement','decision':'Processus décisionnel','roles':'Rôles clairement définis','attributions':'Rôles clairement définis','fiches_poste':'Fiches de poste disponibles','organigramme':'Organigramme documenté','taches':'Répartition des tâches','processus_doc':'Processus internes documentés','outils_suivi':'Outils de suivi des activités','budget':'Budget annuel','compta':'Comptabilité à jour','frequence_etats':'États financiers','partage':'Rapports financiers partagés','compte':'Compte/caisse','agr':'Activités génératrices de revenus','autofin':'Part du budget couverte par revenus propres','types_part':'Types de partenariats','besoins':'Besoins prioritaires','diversification':'Stratégie de diversification'};let question=aliases[q.id];if(!question)return null;let resp=String(val).replace(/^Autres à préciser$/,'Autre').replace(/^Oui écrit et suivi$/,'Oui écrit et suivi').replace(/^Fixe$/,'Fixe').replace(/^Compte dans une SFD$/,'Compte dans une SFD');let p=JOKKOO_PARAMS.find(x=>x.question===question&&x.reponse===resp);if(!p&&q.id==='bureau')p=JOKKOO_PARAMS.find(x=>x.question===question&&x.reponse===(resp==='Oui, complet'?'Oui, complet':resp==='Partiel'?'Partiel':'Non'));if(!p&&q.id==='roles')p=JOKKOO_PARAMS.find(x=>x.question===question&&x.reponse===resp);return p||null}
function scoreDiag(d){let vals=[];for(const v of JOKKOO_VISITES){for(const q of v.questions){let p=paramFor(q,d.answers[q.id]);if(p)vals.push(Number(p.score)/3)}}return {pct:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0,count:vals.length}}
function domainScores(ds){let out={};for(const d of ds){for(const v of JOKKOO_VISITES){for(const q of v.questions){let p=paramFor(q,d.answers[q.id]);if(p){out[p.domaine]??=[];out[p.domaine].push(Number(p.score)/3)}}}}for(const k of Object.keys(out))out[k]=out[k].reduce((a,b)=>a+b,0)/out[k].length;return out}
function renderOrgs(){
  const map={};
  // Une fiche ouverte mais non enregistrée n'est pas une organisation enregistrée.
  db.diagnostics.filter(d=>!d._unsaved).forEach(d=>{const n=d.meta.nom||(d.answers&&d.answers.nom)||'Organisation sans nom';(map[n]??=[]).push(d)});
  const orgs=Object.entries(map).map(([n,a])=>{a.sort((x,y)=>ansCount(y)-ansCount(x)||String(y.numero).localeCompare(String(x.numero)));return [n,a]}).sort((x,y)=>ansCount(y[1][0])-ansCount(x[1][0])||x[0].localeCompare(y[0]));
  $('#content').innerHTML=`<div class="section-title"><div><h2>Organisations</h2><div class="muted">${orgs.length} organisation(s) · cliquez sur une enquête pour afficher son rapport de résultats</div></div></div><div class="grid">${orgs.map(([n,a])=>{
    const best=a[0],sc=scoreDiag(best),com=best.meta.commune||'';
    return `<div class="card"><h3 style="margin-top:0">${esc(n)}</h3><div class="muted">${com?esc(com)+' · ':''}${a.length} enquête(s)${sc.count?' · score '+Math.round(sc.pct*100)+'%':''}</div><div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">${a.map(d=>{const k=ansCount(d);return `<button class="btn ${d===best?'btn-primary':'btn-secondary'}" style="text-align:left" onclick="openOrgDiag('${d.id}')">Voir le rapport · ${esc(d.numero||'sans numéro')} · ${esc(d.status||'')} · ${k} réponse(s)</button>`}).join('')}</div></div>`}).join('')||'<div class="empty">Aucune organisation enregistrée.</div>'}</div>`
}
function renderRef(){let missing=[];JOKKOO_VISITES.forEach(v=>v.questions.forEach(q=>{if(q.domain&&!q.unrated&&!['text','textarea','number','date','tel','multiselect'].includes(q.type)&&!JOKKOO_PARAMS.some(p=>p.question && (p.question.toLowerCase().includes(q.label.split(' ')[0].toLowerCase())||q.id==='bureau'&&p.question==='Bureau exécutif structuré')))missing.push(q)}));$('#content').innerHTML=`<div class="section-title"><h2>Référentiel de notation</h2><div class="muted">69 règles importées depuis PARAMETRES</div></div><div class="card table-wrap"><table class="table"><thead><tr><th>Domaine</th><th>Critère</th><th>Question</th><th>Réponse</th><th>Score</th><th>Commentaire</th></tr></thead><tbody>${JOKKOO_PARAMS.map(p=>`<tr><td>${esc(p.domaine)}</td><td>${esc(p.critere)}</td><td>${esc(p.question)}</td><td>${esc(p.reponse)}</td><td><b>${Math.round(p.score*100)/100}/3</b></td><td>${esc(p.commentaire)}</td></tr>`).join('')}</tbody></table></div><div class="section-title"><h2>Questions à barème non défini</h2></div><div class="card"><div class="muted small">Le fichier Excel contient des questions dont la notation n'est pas entièrement présente dans PARAMETRES. Elles restent collectées mais ne sont pas notées automatiquement.</div><ul>${['Durée du mandat de chaque poste','Expérience passée du dirigeant','Participation financière des membres','Vision, mission, valeurs et objectifs partagés','Principales sources de financement'].map(x=>`<li>${x}</li>`).join('')}</ul></div>`}
function renderExports(){
  const total=(db.diagnostics||[]).length;
  const totalRep=(db.diagnostics||[]).reduce((n,d)=>n+Object.values(d.answers||{}).filter(v=>v!==undefined&&v!==null&&v!=='').length,0);
  $('#content').innerHTML=`<div class="section-title"><div><h2>Export des données</h2><div class="muted">Téléchargez un fichier Excel présenté et structuré pour le suivi au siège.</div></div></div>
  <div class="grid export-summary"><div class="card"><div class="muted">Dossiers disponibles</div><h3>${total}</h3></div><div class="card"><div class="muted">Réponses enregistrées</div><h3>${totalRep}</h3></div></div>
  <div class="card export-main-card"><div class="export-icon">📊</div><div class="export-main-copy"><h3>Rapport Excel JOKKOO</h3><p>Un classeur Excel en 3 feuilles : <b>Synthèse</b> (une ligne par dossier, avancement et score), <b>Rapport détaillé</b> (réponses regroupées par organisation puis par étape, sans répétition, avec plan repliable) et <b>Données</b> (tableau filtrable, une ligne par réponse, pour les tris et tableaux croisés).</p><div class="muted">Fichier .xlsx compatible Excel · Toutes les enquêtes accessibles à votre compte</div></div><button class="btn btn-primary" onclick="exportExcelStyled()">⇩ Télécharger Excel</button></div>
  <div class="card"><h3>Rapports individuels</h3><p class="muted">Pour télécharger une fiche complète en Word ou PDF, ouvrez <b>Mes enquêtes → Voir</b>, puis utilisez les boutons du rapport individuel. Les formats CSV et JSON sont masqués pour simplifier le menu.</p></div>`;
}
function takePhoto(id){let inp=$('#photoInput');inp.value='';inp.onchange=()=>handlePhoto(id,inp.files[0]);inp.click()}
function choosePhoto(id){takePhoto(id)}
/* ===== Export Excel JOKKOO : vrai fichier .xlsx en 3 feuilles =====
   1. Synthèse         : une ligne par dossier (l'organisation n'apparaît qu'une fois)
   2. Rapport détaillé : réponses regroupées par dossier puis par étape, sans répétition, avec plan repliable
   3. Données          : tableau à plat filtrable (une ligne par réponse) pour les tris et tableaux croisés */
const XL = { green: 'FF087443', greenD: 'FF04492A', red: 'FFC9232D', light: 'FFE6F4EC', band: 'FFD3EBDD', line: 'FFCBDCD1', ink: 'FF14231C', muted: 'FF5B6F65', zebra: 'FFF5FAF7', white: 'FFFFFFFF', amber: 'FFFFF1C7', rose: 'FFFDE3E4' };
const XL_FONT = 'Arial';
const XL_STATUT = { 'Définitive': ['FFD9F2E3', 'FF0B6B3E'], 'Validée': ['FFBFE8D2', 'FF04492A'], 'Sauvegardée': ['FFFFF1C7', 'FF8A6A00'], 'Brouillon': ['FFFDE3E4', 'FFA3171F'], 'Archivée': ['FFE7ECEF', 'FF4A5A64'] };
const xlFill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
const xlBorder = c => { const l = { style: 'thin', color: { argb: c || XL.line } }; return { top: l, left: l, bottom: l, right: l } };
const xlHas = v => v !== undefined && v !== null && v !== '' && (typeof v !== 'object' || (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0));
const xlFr = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s || '') };
const xlRef = d => d.numero || d.numero_local || 'Non attribuée';
const xlNom = d => (d.meta && d.meta.nom) || (d.answers && d.answers.nom) || 'Organisation sans nom';

/* Valeur lisible d'une réponse : { v: valeur de cellule, f: format numérique éventuel } */
function xlValue(q, val, photo) {
  if (q.type === 'checkdate' || (val && typeof val === 'object' && !Array.isArray(val) && ('done' in val || 'date' in val)))
    return { v: (val.done ? '✔ Réalisé' : 'Non réalisé') + (val.date ? ' · le ' + xlFr(val.date) : '') };
  if (q.type === 'photoDoc') return { v: (val === 'Oui' ? 'Oui — document disponible' : String(val || 'Document joint')) + (photo ? ' · photo jointe' : '') };
  if (val instanceof Date) return { v: val, f: 'dd/mm/yyyy' };
  if (Array.isArray(val)) return { v: val.join(' ; ') };
  if (typeof val === 'object') return { v: Object.entries(val).map(([k, x]) => k + ' : ' + x).join(' ; ') };
  if (q.type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(String(val))) { const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/); return { v: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), f: 'dd/mm/yyyy' } }
  if (q.type === 'number' && String(val).trim() !== '' && isFinite(Number(val))) { const n = Number(val); return { v: n, f: Number.isInteger(n) ? '#,##0' : '#,##0.00' } }
  return { v: String(val) };
}

/* Prépare les données une seule fois : un objet par dossier, avec ses étapes et ses réponses */
function xlPrepare(diagnostics) {
  const stepsN = JOKKOO_VISITES.length;
  const total = JOKKOO_VISITES.reduce((a, v) => a + v.questions.length, 0);
  return diagnostics.map(d => {
    const answers = d.answers || {}, photos = d.photos || {};
    const steps = JOKKOO_VISITES.map((v, i) => {
      const rows = [];
      v.questions.forEach(q => {
        const val = answers[q.id];
        const has = q.type === 'photoDoc' ? (xlHas(val) || !!photos[q.id]) : xlHas(val);
        if (!has) return;
        const p = paramFor(q, val), x = xlValue(q, val, photos[q.id]);
        rows.push({ q, label: q.label, domain: (p && p.domaine) || q.domain || '', val: x.v, fmt: x.f, score: p && p.score !== undefined && p.score !== null && p.score !== '' ? Number(p.score) : null, comment: (p && p.commentaire) || '' });
      });
      return { n: i + 1, title: v.title, done: rows.length, total: v.questions.length, rows };
    });
    const got = steps.reduce((a, s) => a + s.done, 0), sc = scoreDiag(d);
    return { d, ref: xlRef(d), nom: xlNom(d), commune: (d.meta && d.meta.commune) || '', agent: (d.meta && d.meta.agent) || '', statut: d.status || '', steps, got, total, pct: total ? got / total : 0, score: sc && sc.count ? sc.pct : null, stepsN };
  }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || String(a.ref).localeCompare(String(b.ref)));
}

function xlTitle(ws, cols, title, sub, meta) {
  const last = ws.getColumn(cols).letter;
  ws.mergeCells('A1:' + last + '1'); ws.mergeCells('A2:' + last + '2'); ws.mergeCells('A3:' + last + '3');
  const t = ws.getCell('A1'); t.value = title; t.font = { name: XL_FONT, size: 16, bold: true, color: { argb: XL.white } }; t.fill = xlFill(XL.green); t.alignment = { vertical: 'middle', indent: 1 };
  const s = ws.getCell('A2'); s.value = sub; s.font = { name: XL_FONT, size: 10, color: { argb: XL.greenD } }; s.fill = xlFill(XL.light); s.alignment = { vertical: 'middle', indent: 1 };
  const m = ws.getCell('A3'); m.value = meta; m.font = { name: XL_FONT, size: 9, italic: true, color: { argb: XL.muted } }; m.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 30; ws.getRow(2).height = 20; ws.getRow(3).height = 18;
  ws.getRow(3).border = { bottom: { style: 'medium', color: { argb: XL.red } } };
  for (let c = 1; c <= cols; c++) ws.getRow(3).getCell(c).border = { bottom: { style: 'medium', color: { argb: XL.red } } };
}
function xlHead(ws, rowN, headers) {
  const r = ws.getRow(rowN); r.height = 32;
  headers.forEach((h, i) => { const c = r.getCell(i + 1); c.value = h; c.font = { name: XL_FONT, size: 10, bold: true, color: { argb: XL.white } }; c.fill = xlFill(XL.greenD); c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; c.border = xlBorder(XL.greenD) });
}
function xlPage(ws, titleRows) {
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } };
  if (titleRows) ws.pageSetup.printTitlesRow = titleRows;
  ws.headerFooter.oddFooter = '&L&8JOKKOO DIAGNOSTIC — document confidentiel&R&8Page &P / &N';
}

function xlBuild(X, diagnostics) {
  const data = xlPrepare(diagnostics), today = new Date().toLocaleDateString('fr-FR');
  const nAns = data.reduce((a, o) => a + o.got, 0);
  const wb = new X.Workbook(); wb.creator = 'JOKKOO DIAGNOSTIC'; wb.created = new Date(); wb.title = 'Export des enquêtes JOKKOO';
  const meta = 'Dossiers : ' + data.length + '   ·   Réponses renseignées : ' + nAns + '   ·   Document interne — données confidentielles';

  /* ---------- 1. Synthèse ---------- */
  const s1 = wb.addWorksheet('Synthèse', { views: [{ state: 'frozen', ySplit: 5, xSplit: 2, showGridLines: false }], properties: { tabColor: { argb: XL.green } } });
  const stepsN = JOKKOO_VISITES.length, c1 = 8 + stepsN;
  xlTitle(s1, c1, 'JOKKOO DIAGNOSTIC — EXPORT DES ENQUÊTES', 'Synthèse par dossier · Généré le ' + today, meta);
  const widths = [18, 30, 16, 20, 14, 12, 13, 12]; for (let i = 0; i < stepsN; i++) widths.push(15);
  widths.forEach((w, i) => s1.getColumn(i + 1).width = w);
  s1.getRow(4).height = 6;
  xlHead(s1, 5, ['Référence', 'Organisation', 'Commune', 'Enquêteur', 'Statut', 'Réponses renseignées', 'Avancement', 'Score global'].concat(JOKKOO_VISITES.map((v, i) => (i + 1) + '. ' + v.title)));
  s1.getRow(5).height = 60;
  data.forEach((o, i) => {
    const r = s1.getRow(6 + i), zebra = i % 2 ? XL.zebra : XL.white;
    const vals = [o.ref, o.nom, o.commune, o.agent, o.statut, o.got, o.pct, o.score];
    vals.forEach((v, k) => { const c = r.getCell(k + 1); c.value = v; c.font = { name: XL_FONT, size: 10, bold: k === 1, color: { argb: XL.ink } }; c.fill = xlFill(zebra); c.border = xlBorder(); c.alignment = { vertical: 'middle', wrapText: true, horizontal: k >= 5 ? 'center' : 'left' } });
    r.getCell(6).value = { formula: 'COUNTIFS(Données!$A:$A,A' + (6 + i) + ',Données!$B:$B,B' + (6 + i) + ')', result: o.got };
    r.getCell(6).numFmt = '0'; r.getCell(7).numFmt = '0%'; r.getCell(8).numFmt = '0%';
    const st = XL_STATUT[o.statut]; if (st) { const c = r.getCell(5); c.fill = xlFill(st[0]); c.font = { name: XL_FONT, size: 10, bold: true, color: { argb: st[1] } }; c.alignment = { vertical: 'middle', horizontal: 'center' } }
    o.steps.forEach((s, k) => { const c = r.getCell(9 + k); c.value = s.done + ' / ' + s.total; c.font = { name: XL_FONT, size: 10, color: { argb: s.done === 0 ? 'FF9AA7A0' : XL.ink }, bold: s.done === s.total }; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.fill = xlFill(s.done === s.total ? 'FFD9F2E3' : zebra) });
    r.height = 24;
  });
  const lastD = 5 + data.length, tr = s1.getRow(lastD + 1);
  tr.height = 24;
  for (let k = 1; k <= c1; k++) { const c = tr.getCell(k); c.fill = xlFill(XL.band); c.border = xlBorder(XL.green); c.font = { name: XL_FONT, size: 10, bold: true, color: { argb: XL.greenD } }; c.alignment = { vertical: 'middle', horizontal: k >= 6 ? 'center' : 'left' } }
  tr.getCell(1).value = 'TOTAL / MOYENNE';
  tr.getCell(2).value = { formula: 'COUNTA(B6:B' + lastD + ')&" dossier(s)"', result: data.length + ' dossier(s)' };
  tr.getCell(6).value = { formula: 'SUM(F6:F' + lastD + ')', result: nAns }; tr.getCell(6).numFmt = '0';
  tr.getCell(7).value = { formula: 'IFERROR(AVERAGE(G6:G' + lastD + '),0)', result: data.length ? data.reduce((a, o) => a + o.pct, 0) / data.length : 0 }; tr.getCell(7).numFmt = '0%';
  const sc = data.filter(o => o.score != null);
  tr.getCell(8).value = { formula: 'IFERROR(AVERAGE(H6:H' + lastD + '),"—")', result: sc.length ? sc.reduce((a, o) => a + o.score, 0) / sc.length : '—' }; tr.getCell(8).numFmt = '0%';
  s1.getCell('A' + (lastD + 3)).value = 'Lecture : « Réponses renseignées » = nombre de questions ayant une réponse ; « Avancement » = réponses renseignées / ' + (data[0] ? data[0].total : 0) + ' questions ; « Score global » vide = non calculé (réponses insuffisantes). Le détail est dans « Rapport détaillé », le tableau filtrable dans « Données ».';
  s1.getCell('A' + (lastD + 3)).font = { name: XL_FONT, size: 9, italic: true, color: { argb: XL.muted } };
  s1.addConditionalFormatting({ ref: 'H6:H' + lastD, rules: [
    { type: 'expression', formulae: ['AND(ISNUMBER(H6),H6>=0.7)'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD9F2E3' } }, font: { bold: true, color: { argb: 'FF0B6B3E' } } } },
    { type: 'expression', formulae: ['AND(ISNUMBER(H6),H6>=0.4,H6<0.7)'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: XL.amber } }, font: { bold: true, color: { argb: 'FF8A6A00' } } } },
    { type: 'expression', formulae: ['AND(ISNUMBER(H6),H6<0.4)'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: XL.rose } }, font: { bold: true, color: { argb: 'FFA3171F' } } } }] });
  s1.addConditionalFormatting({ ref: 'G6:G' + lastD, rules: [{ type: 'dataBar', gradient: false, cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }], color: { argb: 'FF7CC4A0' } }] });
  s1.autoFilter = 'A5:' + s1.getColumn(c1).letter + lastD;
  xlPage(s1, '5:5');

  /* ---------- 2. Rapport détaillé ---------- */
  const s2 = wb.addWorksheet('Rapport détaillé', { views: [{ state: 'frozen', ySplit: 5, showGridLines: false }], properties: { tabColor: { argb: XL.greenD }, outlineProperties: { summaryBelow: false }, outlineLevelRow: 3 } });
  [8, 56, 46, 9, 44].forEach((w, i) => s2.getColumn(i + 1).width = w);
  xlTitle(s2, 5, 'JOKKOO DIAGNOSTIC — RAPPORT DÉTAILLÉ PAR DOSSIER', 'Réponses regroupées par organisation puis par étape · Généré le ' + today, meta);
  s2.getRow(4).height = 6;
  xlHead(s2, 5, ['N°', 'Question / Indicateur', 'Réponse enregistrée', 'Score', 'Commentaire / Analyse']);
  let r = 6;
  const mergeRow = (n, fill, font, h, text, level, align) => { s2.mergeCells('A' + n + ':E' + n); const c = s2.getCell('A' + n); c.value = text; c.fill = xlFill(fill); c.font = font; c.alignment = { vertical: 'middle', indent: 1, wrapText: true, horizontal: align || 'left' }; for (let k = 1; k <= 5; k++) s2.getRow(n).getCell(k).border = xlBorder(fill === XL.greenD ? XL.greenD : XL.line); s2.getRow(n).height = h; if (level) { s2.getRow(n).outlineLevel = level; s2.getRow(n).collapsed = false } };
  data.filter(o => o.got > 0).forEach(o => {
    mergeRow(r, XL.greenD, { name: XL_FONT, size: 13, bold: true, color: { argb: XL.white } }, 28, o.nom.toUpperCase() + (o.commune ? '   —   ' + o.commune : ''), 0); r++;
    const sc2 = o.score != null ? Math.round(o.score * 100) + ' %' : 'non calculé';
    mergeRow(r, XL.light, { name: XL_FONT, size: 10, color: { argb: XL.greenD } }, 22, 'Référence : ' + o.ref + '    ·    Enquêteur : ' + (o.agent || '—') + '    ·    Statut : ' + (o.statut || '—') + '    ·    Réponses : ' + o.got + ' / ' + o.total + ' (' + Math.round(o.pct * 100) + ' %)    ·    Score global : ' + sc2, 0); r++;
    o.steps.filter(s => s.done > 0).forEach(s => {
      mergeRow(r, XL.band, { name: XL_FONT, size: 11, bold: true, color: { argb: XL.greenD } }, 22, 'ÉTAPE ' + s.n + '  |  ' + s.title + '     (' + s.done + ' / ' + s.total + ' renseigné(s))', 1); r++;
      s.rows.forEach((x, k) => {
        const row = s2.getRow(r), z = k % 2 ? XL.zebra : XL.white;
        const vals = [s.n + '.' + (k + 1), x.label, x.val, x.score, x.comment];
        vals.forEach((v, j) => { const c = row.getCell(j + 1); c.value = v; c.font = { name: XL_FONT, size: 10, bold: j === 2, color: { argb: XL.ink } }; c.fill = xlFill(z); c.border = xlBorder(); c.alignment = { vertical: 'top', wrapText: true, horizontal: j === 0 || j === 3 ? 'center' : 'left' } });
        if (x.fmt) row.getCell(3).numFmt = x.fmt;
        if (x.score != null) { const c = row.getCell(4); const col = x.score >= 2.5 ? ['FFD9F2E3', 'FF0B6B3E'] : x.score >= 1.5 ? [XL.amber, 'FF8A6A00'] : [XL.rose, 'FFA3171F']; c.fill = xlFill(col[0]); c.font = { name: XL_FONT, size: 10, bold: true, color: { argb: col[1] } } }
        row.outlineLevel = 2; row.collapsed = false; row.hidden = false; r++;
      });
    });
    const sp = s2.getRow(r); sp.height = 14; sp.addPageBreak(); r++;
  });
  if (r === 6) { s2.getCell('A6').value = 'Aucune réponse renseignée à afficher.'; s2.getCell('A6').font = { name: XL_FONT, italic: true, color: { argb: XL.muted } } }
  xlPage(s2, '5:5');

  /* ---------- 3. Données (tableau à plat, filtrable) ---------- */
  const s3 = wb.addWorksheet('Données', { views: [{ state: 'frozen', ySplit: 5, xSplit: 2, showGridLines: false }], properties: { tabColor: { argb: 'FF7CC4A0' } } });
  const H3 = ['Référence', 'Organisation', 'Commune', 'Enquêteur', 'Statut', 'N° étape', 'Étape', 'Domaine', 'Question / Indicateur', 'Réponse enregistrée', 'Score', 'Commentaire / Analyse'];
  [18, 28, 15, 18, 13, 9, 26, 20, 52, 40, 8, 40].forEach((w, i) => s3.getColumn(i + 1).width = w);
  xlTitle(s3, H3.length, 'JOKKOO DIAGNOSTIC — DONNÉES DÉTAILLÉES (TABLEAU FILTRABLE)', 'Une ligne par réponse · filtres actifs sur chaque colonne · Généré le ' + today, meta);
  s3.getRow(4).height = 6; xlHead(s3, 5, H3);
  let n3 = 6;
  data.forEach(o => o.steps.forEach(s => s.rows.forEach(x => {
    const row = s3.getRow(n3), z = (n3 % 2) ? XL.zebra : XL.white;
    [o.ref, o.nom, o.commune, o.agent, o.statut, s.n, s.title, x.domain, x.label, x.val, x.score, x.comment].forEach((v, j) => { const c = row.getCell(j + 1); c.value = v; c.font = { name: XL_FONT, size: 10, color: { argb: XL.ink } }; c.fill = xlFill(z); c.border = xlBorder(); c.alignment = { vertical: 'top', wrapText: true, horizontal: j === 5 || j === 10 ? 'center' : 'left' } });
    if (x.fmt) row.getCell(10).numFmt = x.fmt;
    n3++;
  })));
  if (n3 > 6) s3.autoFilter = 'A5:L' + (n3 - 1);
  xlPage(s3, '5:5');
  return wb;
}

async function exportExcelStyled() {
  const diagnostics = db.diagnostics || [];
  if (!diagnostics.length) { toast('Aucune enquête à exporter'); return }
  let X;
  try { X = await archLoadLib() } catch (e) { toast('Export Excel impossible : ' + errMsg(e)); return }
  try {
    const wb = xlBuild(X, diagnostics), buf = await wb.xlsx.writeBuffer();
    download('JOKKOO_Export_Enquetes_' + new Date().toISOString().slice(0, 10) + '.xlsx', buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toast('Export Excel téléchargé');
  } catch (e) { console.error(e); toast('Export Excel impossible : ' + errMsg(e)) }
}
/* ===== Ajouts : droits d'édition, enquêtes de l'enquêteur, tableau de bord, statistiques ===== */
const canEdit = d => !!d && role() === 'enqueteur' && d.meta.enqueteurId === ME.profile.id && ['Brouillon', 'Sauvegardée'].includes(d.status) && !d._conflict;
const validateBtn = d => d && d.status === 'Définitive' && (role() === 'super_admin' || (role() === 'admin' && (ME.profile.permissions || []).includes('enquetes.validate')))
  ? `<button class="btn btn-gold" onclick="enqStatus('${d.id}','validated')">✓ Valider l’enquête</button>` : '';

function newDiagnostic() {
  if (role() !== 'enqueteur') { toast('Seuls les enquêteurs créent des enquêtes'); return }
  if (!ME.profile.commune_id) { toast('Votre compte n’est rattaché à aucune commune : contactez l’administration'); return }
  // Une fiche ouverte mais jamais enregistrée ne doit ni être persistée ni être envoyée au serveur.
  db.diagnostics = db.diagnostics.filter(x => !x._unsaved);
  const now = new Date().toISOString(), loc = 'LOC-' + now.slice(0, 10).replace(/-/g, '') + '-' + uid().slice(0, 4).toUpperCase();
  const d = { id: uid(), numero: loc, numero_local: loc, createdAt: now, updatedAt: now, status: 'Brouillon', _unsaved: true,
    meta: { nom: '', date: now.slice(0, 10), commune: communeName(ME.profile.commune_id), agent: fullName(ME.profile), communeId: ME.profile.commune_id, enqueteurId: ME.profile.id },
    answers: {}, photos: {}, history: [] };
  db.diagnostics.unshift(d); currentId = d.id; currentVisit = 0; nav('new'); toast('Nouvelle enquête ouverte — elle ne sera créée qu’à l’enregistrement');
}
function setAns(id, val) { const d = getCurrent(); if (!canEdit(d)) return; d.answers[id] = val; if (id === 'nom') d.meta.nom = String(val || '').trim(); touch(d); if (id === 'nom') render() }
function setMeta(k, v) { const d = getCurrent(); if (!canEdit(d)) return; d.meta[k] = v; touch(d) }
function saveDiagnostic(status) {
  const d = getCurrent(); if (!canEdit(d)) return;
  d._unsaved = false;
  d.status = status; d.history.push({ at: new Date().toISOString(), action: 'sauvegarde', status }); touch(d);
  toast(navigator.onLine ? (status === 'Brouillon' ? 'Brouillon enregistré' : 'Enquête sauvegardée') : 'Enregistré sur l’appareil — envoi dès le retour du réseau'); render(); syncNow();
}
function saveAndContinue(nextVisit) {
  const d = getCurrent(); if (!canEdit(d)) return;
  saveDiagnostic('Sauvegardée');
  currentVisit = nextVisit;
  render();
}
function finalizeDiag() {
  const d = getCurrent(); if (!canEdit(d)) return;
  if (!d.meta.nom) { toast('Renseignez le nom de l’organisation'); currentVisit = 1; render(); return }
  if (!confirm('Une fiche définitive ne pourra plus être modifiée. Continuer ?')) return;
  d._unsaved = false; d.status = 'Définitive'; d.history.push({ at: new Date().toISOString(), action: 'enregistrement définitif' }); touch(d);
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
  const f = db.diagnostics.filter(d => !d._unsaved && (!LF.statut || d.status === LF.statut) && (!LF.q || (d.meta.nom + ' ' + d.numero).toLowerCase().includes(LF.q.toLowerCase())));
  $('#content').innerHTML = `<div class="section-title"><h2>Mes enquêtes</h2><div class="toolbar"><button class="btn btn-primary" onclick="newDiagnostic()">＋ Nouvelle</button></div></div>
  <div class="toolbar filters"><input class="input" placeholder="Rechercher (n°, organisation)" value="${esc(LF.q)}" onchange="LF.q=this.value;renderList()"><select class="input" onchange="LF.statut=this.value;renderList()"><option value="">Tous les statuts</option>${['Brouillon', 'Sauvegardée', 'Définitive', 'Validée', 'Archivée'].map(s => `<option ${LF.statut === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>${renderDiagTable(f)}`;
}

/* ---- Tableau de bord enquêteur ("Mon espace") ---- */
function legacyData() { try { const x = JSON.parse(localStorage.getItem('jokkoo_diagnostics_v1') || 'null'); return x && x.diagnostics ? x.diagnostics : [] } catch { return [] } }
function dashEnqueteur() {
  const ds = db.diagnostics.filter(d => !d._unsaved), today = new Date().toISOString().slice(0, 10);
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
  const ds = db.diagnostics.filter(d => !d._unsaved), dom = domainScores(ds), today = new Date().toISOString().slice(0, 10);
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
