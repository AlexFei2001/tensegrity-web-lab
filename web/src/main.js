import {initialGeometry,exactSample,fitness,csv,assertDataset,memberLengths} from './model.js';
import {optimize} from './algorithms.js';
import {translate,languages,locales,theoryKeys} from './i18n.js';
import {createViewport} from './viewport.js';
import {renderTheory,bindTheory} from './theory.js';
import {algorithmLabel} from './algorithm-names.js';
import './style.css';
import './explorers.css';
import './annealing.css';

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let language='zh';try{const stored=localStorage.getItem('tensegrity-language');if(languages.includes(stored))language=stored;}catch{}
const t=(key,values)=>translate(language,key,values);
const fmt=v=>Number.isFinite(v)?v.toLocaleString(locales[language],{maximumFractionDigits:6}):'— '+t('notProvided');
const text=(key,tag='span')=>`<${tag} data-i18n="${key}">${esc(t(key))}</${tag}>`;
const button=(id,key)=>`<button id="${id}">${text(key)}</button>`;
const download=(name,data)=>{const url=URL.createObjectURL(new Blob(['\uFEFF'+data],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
async function load(path){const r=await fetch(import.meta.env.BASE_URL+path);if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json();}

try {
 const [model,samples]=await Promise.all([load('data/model.json'),load('data/samples.json')]);assertDataset(samples,model);
 let params=Object.fromEntries(model.parameters.map(p=>[p.key,p.default])),current=null,saved=[],history=[],iterator=null,timer=null,viewport=null;
 const verified=samples.filter(s=>s.solver.validated&&s.solver.converged);
 const candidates=verified.filter(s=>Number.isFinite(fitness(s))).sort((a,b)=>fitness(a)-fitness(b));
 const theoryExploration={delta:2,temperature:5};
 const unitKey=p=>p.key==='twist_deg'?'degrees':p.key==='loadPerNode'?'relativeUnit':p.key==='pretension_parameter'?'dimensionless':'lengthUnit';
 const setting=(id,key,value,min,max,step=1,hint='')=>`<label class="algorithm-setting">${text(key)}<input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" data-aria="${key}">${hint?text(hint,'small'):''}</label>`;
 $('app').innerHTML=`
 <header><div><div class="eyebrow">${text('eyebrow')}</div>${text('title','h1')}<div class="subtle">${text('subtitle')}</div></div><div class="header-actions"><label class="language-control">${text('language')}<select id="language" aria-label="Language / Lingua / 语言"><option value="zh">中文</option><option value="en">English</option><option value="it">Italiano</option></select></label><span class="badge">${text('verifiedBadge')}</span><small>${text('topology')}</small></div></header>
 <nav>${['Design','Physics','Optimization','Comparison','Theory'].map((key,i)=>`<button data-tab="${key}" class="${i?'':'active'}">0${i+1} / ${text(key)}</button>`).join('')}</nav>
 <main><section id="Design" class="view"><div class="workspace"><aside class="panel">${text('variables','h2')}<p class="subtle">${text('ranges')}</p><div class="controls">${model.parameters.map(p=>`<label class="control"><span>${text(p.key)}<output id="value-${p.key}"></output></span><input id="p-${p.key}" type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.default}" data-aria="${p.key}">${text(unitKey(p),'small')}</label>`).join('')}</div><div class="toolbar">${button('reset','reset')}${button('save','save')}</div></aside><div><div id="viewport" class="viewport"><div class="overlay"><span id="geometry-status" class="badge"></span><p class="subtle">${text('orbit')}</p></div><div class="legend"><span><i class="dot"></i>${text('struts')}</span><span><i class="dot cable"></i>${text('cables')}</span>${text('modelTopology')}</div></div><div class="toolbar"><label><input id="deformed" type="checkbox" disabled>${text('deformed')}</label>${button('fit','fit')}</div><div class="notes">${text('geometryNote')}</div></div></div></section>
 <section id="Physics" class="view hidden"><div class="panel">${text('physicsTitle','h2')}<p id="physics-intro" class="subtle"></p><div id="status" class="status" aria-live="polite"></div><div class="toolbar"><label>${text('sample')} <select id="sample-select"></select></label>${button('load-default','loadDefault')}${button('download-samples','downloadSamples')}</div><div id="metrics" class="metrics"></div><p class="subtle">${text('displacementDefinition')}</p><p id="provenance" class="subtle"></p><p class="notes">${text('physicalLimits')}</p>${text('angleDisplacement','h3')}<svg id="physics-chart" class="chart" viewBox="0 0 600 230" role="img" data-aria="angleDisplacement"></svg><p class="chartcaption">${text('angleAxes')}</p>${text('sampleTable','h3')}<div id="sample-table" class="tablewrap"></div></div></section>
 <section id="Optimization" class="view hidden"><div class="panel">${text('optimizationTitle','h2')}<div class="objective-grid"><article class="objective-card"><span class="badge">${text('mathBadge')}</span><p>${text('mathObjective')}</p><div class="formula">min f(x,y) = 20 + x² + y² − 10[cos(2πx) + cos(2πy)]</div><p class="subtle">${text('mathMinimum')}</p></article><article class="objective-card">${text('structureObjectiveTitle','h3')}<p>${text('structureObjective')}</p><div class="formula">min F = 0.5(1 − P/P_ref) + 0.5(u/u_lim)</div><p class="subtle">${text('structureFormula')}</p><p class="subtle">${text('constraints')}</p></article></div>
 <div class="algorithm-settings"><label class="algorithm-setting">${text('algorithm')}<select id="algorithm"><option>GA</option><option>PSO</option><option>SA</option></select></label>${setting('seed','seed',42,0,4294967295,1,'seedHint')}${setting('budget','budget',200,12,1000,1,'budgetHint')}</div><div id="pso-settings" class="algorithm-settings">${setting('w','w',.7,0,1.5,.1,'wHint')}${setting('c1','c1',1.5,0,3,.1,'c1Hint')}${setting('c2','c2',1.5,0,3,.1,'c2Hint')}</div><div id="sa-settings" class="algorithm-settings">${setting('temperature','temperature',10,.01,100,.01,'temperatureHint')}${setting('cooling','cooling',.95,.01,.999,.001,'coolingHint')}</div>
 <div class="toolbar">${button('run','run')}${button('pause','pause')}${button('step','step')}${button('restart','restart')}${button('history','downloadHistory')}</div><div id="algo-status" class="status" aria-live="polite"></div><div class="split"><div>${text('convergence','h3')}<svg id="convergence" class="chart" viewBox="0 0 600 230" role="img" data-aria="convergence"></svg><p class="chartcaption">${text('curveAxes')}</p></div><div>${text('trajectory','h3')}<svg id="trajectory" class="chart" viewBox="0 0 600 230" role="img" data-aria="trajectory"></svg><p class="chartcaption">${text('trajectoryAxes')}</p></div></div></div><div class="panel section-gap">${text('candidatesTitle','h3')}<p id="structure-status" class="subtle"></p>${button('best-structure','chooseBest')}<p class="subtle">${text('candidateNote')}</p></div></section>
 <section id="Comparison" class="view hidden"><div class="panel">${text('compareTitle','h2')}<div class="toolbar">${button('example','example')}${button('clear','clear')}${button('export-designs','downloadDesigns')}</div><div id="comparison" class="tablewrap"></div><p class="subtle">${text('comparisonNote')}</p><svg id="scatter" class="chart" viewBox="0 0 600 230" role="img" data-aria="comparisonNote"></svg></div></section>
 <section id="Theory" class="view hidden"><div id="theory-content"></div></section><div id="footer" class="footer"></div></main>`;
 $('Optimization').querySelector('h2').insertAdjacentHTML('afterend',`<div class="toolbar">${button('read-theory','openTheory')}</div>`);
 let webglReason=null;
 try{viewport=createViewport($('viewport'));}catch(e){webglReason=e.message;$('viewport').insertAdjacentHTML('beforeend','<p id="webgl-error" class="error"></p>');}
 function chart(id,points,{scatter=false}={}){
  const svg=$(id);if(!points.length){svg.innerHTML=`<text x="25" y="115" fill="#62766f" font-size="14">${esc(t('noData'))}</text>`;return;}
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);const xy=([x,y])=>[55+(x-xmin)/(xmax-xmin||1)*515,185-(y-ymin)/(ymax-ymin||1)*150];
  svg.innerHTML=`<path d="M55 20V185H580" fill="none" stroke="#bac9bc"/><text x="55" y="215" font-size="11" fill="#62766f">${fmt(xmin)}</text><text x="520" y="215" font-size="11" fill="#62766f">${fmt(xmax)}</text><text x="5" y="23" font-size="11" fill="#62766f">${fmt(ymax)}</text>`+(scatter?points.map(p=>{const [x,y]=xy(p);return `<circle cx="${x}" cy="${y}" r="4" fill="#ab674b"><title>${fmt(p[0])}, ${fmt(p[1])}</title></circle>`;}).join(''):`<polyline points="${points.map(p=>xy(p).join(',')).join(' ')}" fill="none" stroke="#2b7865" stroke-width="2.5"/>`);
 }
 function loadSample(index){params={...samples[index].parameters};update();viewport?.frame(params);}
 function update(){
  for(const p of model.parameters){$('p-'+p.key).value=params[p.key];$('value-'+p.key).textContent=fmt(params[p.key]);}
  current=exactSample(samples,params,model.modelHash);const valid=current?.solver.validated&&current?.solver.converged;
  $('deformed').disabled=!valid;if(!valid)$('deformed').checked=false;
  $('geometry-status').textContent=t(valid?($('deformed').checked?'solvedDeformed':'solvedInitial'):'initial');
  $('status').textContent=current?(valid?t('matched',{feasible:t(current.results.feasible?'feasible':'infeasible')}):t('failed',{reason:current.results.failureReasons.join('; ')})):t('unmatched');$('status').classList.toggle('verified-status',!!valid);
  $('sample-select').value=current?String(samples.indexOf(current)):'';
  const lengths=valid?memberLengths(current.geometry):{};
  const metrics=[['displacement',valid?current.results.maxDisplacement_m:null],['totalLoad',3*params.loadPerNode],['cableLength',lengths.cable],['strutLength',lengths.strut],['mass',valid?current.results.mass_kg:null],['weighted',fitness(current)]];
  $('metrics').innerHTML=metrics.map(([key,value])=>`<div class="metric"><small>${esc(t(key))}</small><strong>${fmt(value)}</strong></div>`).join('');
  $('provenance').textContent=valid?t('provenance',{source:'Rhino '+current.solver.version.Rhino+' / Kangaroo',iterations:current.solver.iterations.join(' / '),seconds:fmt(current.solver.elapsedSeconds)}):'';
  const sweep=verified.filter(s=>model.parameters.every(p=>p.key==='twist_deg'||s.parameters[p.key]===params[p.key])).sort((a,b)=>a.parameters.twist_deg-b.parameters.twist_deg);
  chart('physics-chart',sweep.map(s=>[s.parameters.twist_deg,s.results.maxDisplacement_m]),{scatter:true});viewport?.draw(valid?current.geometry:initialGeometry(params,model.topology),$('deformed').checked);
 }
 function renderSamples(){
  $('physics-intro').textContent=t('physicsIntro',{n:verified.length});
  $('sample-select').innerHTML=`<option value="">${esc(t('selectSample'))}</option>`+samples.map((s,i)=>`<option value="${i}">${fmt(s.parameters.twist_deg)}° · P=${fmt(s.parameters.loadPerNode)} · u=${fmt(s.results.maxDisplacement_m)} m</option>`).join('');
  $('sample-table').innerHTML=`<table><thead><tr>${['angle','loadColumn','uColumn','iterations','status','action'].map(k=>`<th>${esc(t(k))}</th>`).join('')}</tr></thead><tbody>${samples.map((s,i)=>`<tr><td>${fmt(s.parameters.twist_deg)}</td><td>${fmt(s.parameters.loadPerNode)}</td><td>${fmt(s.results.maxDisplacement_m)}</td><td>${s.solver.iterations?.join(' / ')??'—'}</td><td>${esc(t(s.results.feasible?'feasible':'infeasible'))}</td><td><button data-sample="${i}">${esc(t('load'))}</button></td></tr>`).join('')}</tbody></table>`;
  for(const b of document.querySelectorAll('[data-sample]'))b.onclick=()=>loadSample(Number(b.dataset.sample));
  $('structure-status').textContent=t('candidatesStatus',{n:candidates.length,total:samples.length});$('best-structure').disabled=!candidates.length;
 }
 function compare(){
  const rows=saved.map((p,i)=>({label:t('design',{n:i+1}),params:p,sample:exactSample(samples,p,model.modelHash)}));
  $('comparison').innerHTML=rows.length?`<table><thead><tr>${['Design','angle','loadColumn','uColumn','massColumn','status','action'].map(k=>`<th>${esc(t(k))}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${r.label}</td><td>${fmt(r.params.twist_deg)}</td><td>${fmt(r.params.loadPerNode)}</td><td>${fmt(r.sample?.solver.validated?r.sample.results.maxDisplacement_m:null)}</td><td>${fmt(r.sample?.solver.validated?r.sample.results.mass_kg:null)}</td><td>${esc(t(!r.sample?'notEvaluated':r.sample.results.feasible?'feasible':'infeasible'))}</td><td><button data-restore="${i}">${esc(t('load'))}</button></td></tr>`).join('')}</tbody></table>`:`<p class="subtle">${esc(t('compareEmpty'))}</p>`;
  for(const b of document.querySelectorAll('[data-restore]'))b.onclick=()=>{params={...saved[Number(b.dataset.restore)]};update();document.querySelector('[data-tab="Design"]').click();};
  chart('scatter',rows.filter(r=>r.sample?.solver.validated&&Number.isFinite(r.sample.results.mass_kg)).map(r=>[r.sample.results.mass_kg,r.sample.results.maxDisplacement_m]),{scatter:true});$('save').textContent=saved.length?t('saved',{n:saved.length}):t('save');
 }
 function renderAlgorithm(){
  $('pso-settings').classList.toggle('hidden',$('algorithm').value!=='PSO');$('sa-settings').classList.toggle('hidden',$('algorithm').value!=='SA');const r=history.at(-1);
  $('algo-status').textContent=r?t('algoStatus',{algorithm:r.algorithm,n:r.evaluation,budget:$('budget').value,current:fmt(r.fitness),best:fmt(r.best)})+(r.algorithm==='SA'?` · T=${fmt(r.temperature)} · `+t(r.acceptedWorse?'acceptedWorse':r.accepted?'accepted':'rejected'):''):t('ready');chart('convergence',history.map(r=>[r.evaluation,r.best]));chart('trajectory',history.map(r=>r.point),{scatter:true});
 }
 function applyLanguage(){
  document.documentElement.lang=locales[language];document.title=t('title');$('language').value=language;
  for(const option of $('algorithm').options){const code=option.getAttribute('value')??option.textContent;option.value=code;option.textContent=algorithmLabel(language,code);}
  $('theory-content').innerHTML=renderTheory(language);bindTheory(document,language,theoryExploration);
  $('theory-try').onclick=()=>document.querySelector('[data-tab="Optimization"]').click();
  for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
  for(const el of document.querySelectorAll('[data-aria]'))el.setAttribute('aria-label',t(el.dataset.aria));
  $('terms').innerHTML=theoryKeys.map(key=>`<article><h3>${esc(t('term'+key))}</h3><p>${esc(t('term'+key+'Body'))}</p></article>`).join('');
  $('footer').textContent=t('footer',{source:model.source})+' · SHA256 '+model.modelHash.slice(0,16)+'…';if(webglReason)$('webgl-error').textContent=t('webgl',{reason:webglReason});renderSamples();update();compare();renderAlgorithm();
 }
 $('language').onchange=e=>{language=e.target.value;try{localStorage.setItem('tensegrity-language',language);}catch{}applyLanguage();};
 for(const p of model.parameters)$('p-'+p.key).oninput=e=>{params[p.key]=Number(e.target.value);update();};
 $('reset').onclick=()=>{params=Object.fromEntries(model.parameters.map(p=>[p.key,p.default]));update();viewport?.frame(params);};$('fit').onclick=()=>viewport?.frame(params);$('deformed').onchange=update;
 for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{for(const v of document.querySelectorAll('.view'))v.classList.toggle('hidden',v.id!==b.dataset.tab);for(const x of document.querySelectorAll('[data-tab]'))x.classList.toggle('active',x===b);};
 $('read-theory').onclick=()=>document.querySelector('[data-tab="Theory"]').click();
 $('sample-select').onchange=e=>{if(e.target.value!=='')loadSample(Number(e.target.value));};$('load-default').onclick=()=>{params=Object.fromEntries(model.parameters.map(p=>[p.key,p.default]));update();};
 $('download-samples').onclick=()=>download('grasshopper-samples.csv',csv(samples.map(s=>({id:s.id,...s.parameters,maxDisplacement_m:s.results.maxDisplacement_m,mass_kg:s.results.mass_kg,feasible:s.results.feasible,validated:s.solver.validated,iterationsUnloaded:s.solver.iterations?.[0],iterationsLoaded:s.solver.iterations?.[1],modelHash:s.modelHash}))));
 $('save').onclick=()=>{saved.push({...params});compare();};$('clear').onclick=()=>{saved=[];compare();};$('example').onclick=()=>{saved=verified.slice(0,2).map(s=>({...s.parameters}));compare();};
 $('export-designs').onclick=()=>download('design-comparison.csv',csv(saved.map(p=>{const s=exactSample(samples,p,model.modelHash);return {...p,status:s?.solver.status??'not evaluated',maxDisplacement_m:s?.solver.validated?s.results.maxDisplacement_m:null};})));
 function pause(){clearInterval(timer);timer=null;}
 function restart(){pause();iterator=null;history=[];renderAlgorithm();}
 function step(){if(!iterator){const algorithm=$('algorithm').value,config={algorithm};const relevant=['seed','budget',...(algorithm==='PSO'?['w','c1','c2']:algorithm==='SA'?['temperature','cooling']:[])];for(const key of relevant){const el=$(key);if(!el.checkValidity()){el.reportValidity();pause();return;}config[key]=Number(el.value);}iterator=optimize(config);}const {value,done}=iterator.next();if(done){pause();return;}history.push(value);renderAlgorithm();}
 $('run').onclick=()=>{if(!timer){step();if(iterator)timer=setInterval(step,70);}};$('pause').onclick=pause;$('step').onclick=()=>{pause();step();};$('restart').onclick=restart;
 for(const id of ['algorithm','seed','budget','w','c1','c2','temperature','cooling'])$(id).onchange=restart;
 $('history').onclick=()=>download('algorithm-history.csv',csv(history.map(r=>({algorithm:r.algorithm,seed:r.seed,evaluation:r.evaluation,x:r.point[0],y:r.point[1],fitness:r.fitness,best:r.best,accepted:r.accepted,acceptedWorse:r.acceptedWorse,temperature:r.temperature,realStructuralEvaluations:0,feasibleFraction:1}))));
 $('best-structure').onclick=()=>{params={...candidates[0].parameters};saved.push({...params});update();compare();document.querySelector('[data-tab="Design"]').click();};applyLanguage();viewport?.frame(params);
}catch(e){$('app').innerHTML=`<main><h1>${esc(t('title'))}</h1><p class="error">${esc(t('loadError',{reason:e.message}))}</p><p>${esc(t('httpHelp'))}</p></main>`;console.error(e);}
