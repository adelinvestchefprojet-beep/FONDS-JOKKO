/* JOKKOO – Module Rapports : par commune, collectif, performance des enquêteurs */
(function(){
const R={tab:'collectif',commune:'',agent:'',final:false};
const DOMS=['Gouvernance','Organisation','Finance','Modèle économique','Partenariats','Besoins & perspectives'];
const RECO={'Gouvernance':'Formaliser les décisions : PV, réunions régulières, AG annuelle, rôles et délégations.','Organisation':'Documenter l’organisation : organigramme, fiches de poste, répartition des tâches.','Finance':'Installer des outils de gestion : comptabilité, budget, suivi de trésorerie, justificatifs.','Modèle économique':'Mesurer coûts, marges et sources de revenus ; diversifier les ressources.','Partenariats':'Structurer le portefeuille de partenaires : conventions, échéances, résultats.','Besoins & perspectives':'Prioriser les besoins exprimés et bâtir un plan d’accompagnement.'};
const pc=x=>Math.round(x*100), col=p=>p<40?'var(--red)':p<55?'var(--gold)':'var(--green)';
const bg=p=>p<40?'#ffe3e4':p<55?'#fff2cc':p<70?'#e6f4ec':'#c9ecd9';
const prio=p=>p<40?['Très haute','b-warning']:p<55?['Haute','b-draft']:p<70?['Moyenne','b-saved']:['Basse','b-final'];
const lvlTxt=p=>p<40?'structuration insuffisante':p<55?'niveau à consolider':p<70?'niveau satisfaisant':'niveau solide';
const norm=s=>String(s||'').trim().replace(/\s+/g,' ');
const comOf=d=>norm(d.meta.commune)||'Non renseignée', agOf=d=>norm(d.meta.agent)||'Non renseigné';
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const filtered=()=>db.diagnostics.filter(d=>!R.final||isFinal(d));
const group=(ds,f)=>{const m={};ds.forEach(d=>(m[f(d)]??=[]).push(d));return m};
function items(d){const o=[];for(const v of JOKKOO_VISITES)for(const q of v.questions){const p=paramFor(q,d.answers[q.id]);if(p)o.push({dom:p.domaine,s:Number(p.score)/3,c:p.commentaire})}return o}
function comp(d){let rt=0,ra=0,t=0,a=0;for(const v of JOKKOO_VISITES)for(const q of v.questions){const x=d.answers[q.id];const has=q.type==='photoDoc'?!!(d.photos||{})[q.id]:Array.isArray(x)?x.length>0:(x!=null&&x!=='');t++;if(has)a++;if(q.required){rt++;if(has)ra++}}return{all:t?a/t:0,req:rt?ra/rt:1,photos:Object.values(d.photos||{}).filter(Boolean).length}}
function agg(ds){const dom={},all=[];for(const d of ds)for(const i of items(d)){(dom[i.dom]??=[]).push(i.s);all.push(i.s)}const r={};for(const k in dom)r[k]=mean(dom[k]);return{g:mean(all),dom:r}}
function pts(ds){const f={},w={};for(const d of ds)for(const i of items(d)){if(!i.c)continue;const t=i.dom+' — '+i.c;if(i.s===1)f[t]=(f[t]||0)+1;else if(i.s<=1/3)w[t]=(w[t]||0)+1}const top=m=>Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,6);return{f:top(f),w:top(w)}}
const bars=dom=>Object.entries(dom).sort((a,b)=>a[1]-b[1]).map(([k,v])=>`<div class="domain-row"><span>${esc(k)}</span><div class="bar"><i style="width:${pc(v)}%;background:${col(pc(v))}"></i></div><b>${pc(v)} %</b></div>`).join('')||'<div class="empty">Aucune réponse notée pour le moment.</div>';
const prioTable=dom=>{const r=Object.entries(dom).sort((a,b)=>a[1]-b[1]);return r.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Domaine</th><th>Score</th><th>Lecture</th><th>Priorité</th><th>Action recommandée</th></tr></thead><tbody>${r.map(([k,v])=>{const p=pc(v),[l,b]=prio(p);return`<tr><td><b>${esc(k)}</b></td><td>${p} %</td><td>${lvlTxt(p)}</td><td><span class="badge ${b}">${l}</span></td><td>${esc(RECO[k]||'')}</td></tr>`}).join('')}</tbody></table></div>`:''};
const list=a=>a.length?`<ul class="rpt-ul">${a.map(([t,n])=>`<li>${esc(t)}${n>1?` <small class="muted">(×${n})</small>`:''}</li>`).join('')}</ul>`:'<p class="muted">Aucun élément pour le moment.</p>';
const stamp=()=>new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
const head=(t,s)=>`<div class="rpt-head"><img class="brand-mark" src="${IMG('icon')}" alt=""><div><h2>${t}</h2><p class="muted">${s} · Généré le ${stamp()}${R.final?' · Diagnostics définitifs':''}</p></div></div>`;
const kpi=(n,l,c)=>`<div class="card kpi" style="border-top-color:${c||'var(--green)'}"><div class="num">${n}</div><div class="lbl">${l}</div></div>`;
const summary=a=>{if(a.g==null)return'';const p=pc(a.g),e=Object.entries(a.dom).sort((x,y)=>x[1]-y[1]);return`<p><b>Score global : ${p} %</b> — ${lvlTxt(p)}.${e.length>1?` Point le plus fragile : <b>${esc(e[0][0])}</b> (${pc(e[0][1])} %). Point le plus solide : <b>${esc(e.at(-1)[0])}</b> (${pc(e.at(-1)[1])} %).`:''}</p>`};
const empty='<div class="empty">Aucun diagnostic à analyser. Créez et renseignez des fiches pour générer les rapports.</div>';

function communeDoc(name){const ds=filtered().filter(d=>comOf(d)===name),a=agg(ds),p=pts(ds);
 const orgs=ds.map(d=>{const s=scoreDiag(d),c=comp(d);return`<tr><td>${esc(d.numero)}</td><td>${esc(d.meta.nom||'—')}</td><td>${esc(agOf(d))}</td><td>${esc(d.status)}</td><td>${s.count?pc(s.pct)+' %':'—'}</td><td>${pc(c.req)} %</td></tr>`}).join('');
 return`<div id="rptDoc" class="card rpt-doc">${head('Rapport de diagnostic — Commune de '+esc(name),`${ds.length} diagnostic(s)`)}
 <h3>1. Résumé</h3>${summary(a)}<h3>2. Scores par domaine</h3>${bars(a.dom)}
 <h3>3. Priorités et recommandations</h3>${prioTable(a.dom)}
 <div class="rpt-cols"><div><h3>4. Points forts</h3>${list(p.f)}</div><div><h3>5. Points de vigilance</h3>${list(p.w)}</div></div>
 <h3>6. Organisations diagnostiquées</h3><div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Organisation</th><th>Enquêteur</th><th>Statut</th><th>Score</th><th>Complétude</th></tr></thead><tbody>${orgs}</tbody></table></div></div>`}

function collectif(){const ds=filtered(),g=group(ds,comOf),a=agg(ds);
 const rows=Object.entries(g).map(([n,L])=>({n,L,a:agg(L),req:mean(L.map(d=>comp(d).req)),ag:new Set(L.map(agOf)).size})).sort((x,y)=>(y.a.g??-1)-(x.a.g??-1));
 const fin=ds.filter(d=>isFinal(d)).length;
 const mx=`<div class="table-wrap"><table class="table"><thead><tr><th>Commune</th>${DOMS.map(d=>`<th>${esc(d)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.n)}</b></td>${DOMS.map(d=>{const v=r.a.dom[d];return v==null?'<td>—</td>':`<td style="background:${bg(pc(v))};font-weight:700">${pc(v)} %</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
 const rk=`<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Commune</th><th>Diagnostics</th><th>Score</th><th>Priorité</th><th>Complétude</th><th>Enquêteurs</th></tr></thead><tbody>${rows.map((r,i)=>{const p=r.a.g==null?null:pc(r.a.g),[l,b]=prio(p??0);return`<tr><td>${i+1}</td><td><b>${esc(r.n)}</b></td><td>${r.L.length}</td><td style="min-width:140px">${p==null?'—':`<div class="bar"><i style="width:${p}%;background:${col(p)}"></i></div><b>${p} %</b>`}</td><td>${p==null?'—':`<span class="badge ${b}">${l}</span>`}</td><td>${pc(r.req)} %</td><td>${r.ag}</td></tr>`}).join('')}</tbody></table></div>`;
 return ds.length?`<div id="rptDoc" class="card rpt-doc">${head('Rapport collectif',`${rows.length} commune(s) · ${ds.length} diagnostic(s)`)}
 <div class="grid">${kpi(rows.length,'Communes couvertes')}${kpi(ds.length,'Diagnostics','var(--red)')}${kpi(a.g==null?'—':pc(a.g)+' %','Score moyen global','var(--gold)')}${kpi(pc(fin/ds.length)+' %','Définitifs')}</div>
 <h3>1. Résumé</h3>${summary(a)}<h3>2. Classement des communes</h3>${rk}<h3>3. Scores moyens par domaine</h3>${bars(a.dom)}
 <h3>4. Carte de chaleur communes × domaines</h3>${mx}<h3>5. Priorités d’accompagnement</h3>${prioTable(a.dom)}</div>`:empty}

function perf(){const ds=filtered(),G=agg(ds).g;
 return Object.entries(group(ds,agOf)).map(([a,L])=>{const cs=L.map(comp),m=f=>mean(cs.map(f));const req=m(c=>c.req),fin=L.filter(d=>isFinal(d)).length/L.length,ph=m(c=>Math.min(c.photos,3)/3);
  const days=new Set(L.map(d=>String(d.meta.date||d.createdAt||'').slice(0,10))).size||1,ryt=Math.min(L.length/days/2,1);const s=agg(L).g;
  return{a,L,n:L.length,com:new Set(L.map(comOf)).size,req,fin,ph,ryt,s,idx:.4*req+.3*fin+.15*ph+.15*ryt,ec:s!=null&&G!=null?s-G:null}}).sort((x,y)=>y.idx-x.idx)}
const grade=i=>i>=.75?['Excellent','b-final']:i>=.55?['Bon','b-saved']:i>=.35?['À améliorer','b-draft']:['Insuffisant','b-warning'];
function perfView(){const P=perf();if(!P.length)return empty;if(!P.find(x=>x.a===R.agent))R.agent=P[0].a;const cur=P.find(x=>x.a===R.agent);
 const alerts=r=>[r.req<.6?'Fiches incomplètes':'',r.fin<.4?'Peu de fiches finalisées':'',r.ec!=null&&Math.abs(r.ec)>.15?'Notation à vérifier (écart '+(r.ec>0?'+':'')+pc(r.ec)+' pts)':'',r.ph===0?'Aucune photo':''].filter(Boolean);
 return`<div id="rptDoc" class="card rpt-doc">${head('Performance des enquêteurs',`${P.length} enquêteur(s) · ${ds0().length} diagnostic(s)`)}
 <div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Enquêteur</th><th>Diag.</th><th>Communes</th><th>Complétude</th><th>Finalisées</th><th>Photos</th><th>Rythme</th><th>Score moyen donné</th><th>Indice</th><th>Appréciation</th></tr></thead><tbody>${P.map((r,i)=>{const[l,b]=grade(r.idx);return`<tr class="${r.a===R.agent?'rpt-sel':''}" onclick="RPT.agent(${i})" style="cursor:pointer"><td>${i+1}</td><td><b>${esc(r.a)}</b></td><td>${r.n}</td><td>${r.com}</td><td>${pc(r.req)} %</td><td>${pc(r.fin)} %</td><td>${pc(r.ph)} %</td><td>${pc(r.ryt)} %</td><td>${r.s==null?'—':pc(r.s)+' %'}</td><td><b>${pc(r.idx)}</b>/100</td><td><span class="badge ${b}">${l}</span></td></tr>`}).join('')}</tbody></table></div>
 <div class="card" style="margin-top:16px"><h3>Détail : ${esc(cur.a)}</h3>${alerts(cur).length?alerts(cur).map(x=>`<span class="badge b-warning" style="margin:0 6px 6px 0">⚠ ${esc(x)}</span>`).join(''):'<span class="badge b-final">✓ Aucun point d’alerte</span>'}
 <div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>N°</th><th>Organisation</th><th>Commune</th><th>Statut</th><th>Complétude</th><th>Photos</th><th>Score</th></tr></thead><tbody>${cur.L.map(d=>{const c=comp(d),s=scoreDiag(d);return`<tr><td>${esc(d.numero)}</td><td>${esc(d.meta.nom||'—')}</td><td>${esc(comOf(d))}</td><td>${esc(d.status)}</td><td>${pc(c.req)} %</td><td>${c.photos}</td><td>${s.count?pc(s.pct)+' %':'—'}</td></tr>`}).join('')}</tbody></table></div></div>
 <p class="small muted"><b>Indice de performance (/100)</b> = 40 % complétude des champs obligatoires + 30 % fiches finalisées + 15 % photos justificatives (objectif : 3 par fiche) + 15 % rythme (objectif : 2 diagnostics par jour actif). L’écart de notation compare le score moyen donné par l’enquêteur à la moyenne de tous : un écart de plus de 15 points suggère de vérifier la cohérence de la notation.</p></div>`}
const ds0=filtered;

function csv(name,rows){download(name,'\ufeff'+rows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(';')).join('\n'),'text/csv')}
function render_(){
 const tabs=[['collectif','▣ Rapport collectif'],['commune','◉ Rapport par commune'],['perf','★ Performance des enquêteurs']].filter(t=>t[0]!=='perf'||role()!=='enqueteur');
 const names=Object.keys(group(filtered(),comOf)).sort();if(!names.includes(R.commune))R.commune=names[0]||'';
 const body=R.tab==='collectif'?collectif():R.tab==='commune'?(names.length?communeDoc(R.commune):empty):perfView();
 $('#content').innerHTML=`<div class="rpt-bar no-print"><div class="visit-tabs">${tabs.map(([k,l])=>`<button class="visit-tab ${R.tab===k?'active':''}" onclick="RPT.tab('${k}')">${l}</button>`).join('')}</div>
 <div class="toolbar">${R.tab==='commune'&&names.length?`<select class="input" style="width:auto" onchange="RPT.commune(this.value)">${names.map(n=>`<option ${n===R.commune?'selected':''}>${esc(n)}</option>`).join('')}</select>`:''}
 <label class="rpt-chk"><input type="checkbox" ${R.final?'checked':''} onchange="RPT.final(this.checked)"> Définitifs uniquement</label>
 <button class="btn btn-primary" onclick="window.print()">⎙ Imprimer / PDF</button><button class="btn btn-secondary" onclick="RPT.word()">⇩ Word</button>${R.tab!=='commune'?'<button class="btn btn-gold" onclick="RPT.csv()">⇩ CSV</button>':''}</div></div>${body}`}
window.RPT={tab:t=>{R.tab=t;render_()},commune:c=>{R.commune=c;render_()},final:v=>{R.final=v;render_()},agent:i=>{R.agent=perf()[i].a;render_()},
 word(){const el=$('#rptDoc');if(!el)return toast('Rien à exporter');download('rapport-jokkoo-'+R.tab+'.doc','<html><head><meta charset="utf-8"><style>body{font-family:Calibri,Arial}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:5px;font-size:11pt}th{background:#e3f1e9}h2,h3{color:#087443}.bar{display:none}</style></head><body>'+el.innerHTML+'</body></html>','application/msword');toast('Rapport Word téléchargé')},
 csv(){if(R.tab==='perf'){csv('performance-enqueteurs.csv',[['Enquêteur','Diagnostics','Communes','Complétude %','Finalisées %','Photos %','Rythme %','Score moyen %','Indice /100'],...perf().map(r=>[r.a,r.n,r.com,pc(r.req),pc(r.fin),pc(r.ph),pc(r.ryt),r.s==null?'':pc(r.s),pc(r.idx)])])}
  else{const g=group(filtered(),comOf);csv('rapport-collectif.csv',[['Commune','Diagnostics','Score global %',...DOMS],...Object.entries(g).map(([n,L])=>{const a=agg(L);return[n,L.length,a.g==null?'':pc(a.g),...DOMS.map(d=>a.dom[d]==null?'':pc(a.dom[d]))]})])}}};
VIEWS.rapports=function(){$('#pageTitle').textContent=role()==='enqueteur'?'Mes rapports':'Rapports & performance';render_()};
})();
