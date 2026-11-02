import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import * as modelFunctions from '../web/src/model.js';
import {optimize} from '../web/src/algorithms.js';
import {translate,languages,locales,theoryKeys,messages} from '../web/src/i18n.js';
import {validateSamples} from '../tools/import-samples.mjs';
import {renderTheory,bindTheory,acceptanceProbability,theoryLanguages} from '../web/src/theory.js';
import {geneticChild,particleProposal,gaParentPool,explorerCopy} from '../web/src/algorithm-explorers.js';
import {algorithmLabel,algorithmNames} from '../web/src/algorithm-names.js';
import {annealingDecision,sliceObjective,annealingCopy} from '../web/src/annealing-explorer.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const model=read('../web/public/data/model.json'),samples=read('../data/samples.json');
test('Every translation and teaching card is available in all three languages',()=>{
 for(const [key,values] of Object.entries(messages)){assert.equal(values.length,3,key);for(const lang of languages){assert.ok(translate(lang,key).length,key);assert.ok(!translate(lang,key).includes('undefined'),key);}}
 for(const lang of languages)for(const key of theoryKeys){assert.ok(translate(lang,'term'+key));assert.ok(translate(lang,'term'+key+'Body'));}
 assert.equal(translate('it','saved',{n:2}),'2 progetti salvati');
});
test('11 actual GH records pass schema; recomputed upper-node displacements equal exported results',()=>{
 assert.equal(samples.length,11);validateSamples(samples,model,read('../data/schema.json'));
 for(const s of samples){assert.equal(s.solver.version.Rhino,'8.23.25251.13001');assert.equal(s.solver.validated,true);const g=s.geometry;
 const u=Math.max(...g.upperLoaded.map((p,i)=>Math.hypot(...p.map((x,j)=>x-g.upperUnloaded[i][j]))));assert.ok(Math.abs(u-s.results.maxDisplacement_m)<1e-10);
 assert.equal(g.members.filter(m=>m.kind==='cable').length,90);assert.equal(g.members.filter(m=>m.kind==='strut').length,3);assert.equal(s.loading.forceVectors[0][2],-s.parameters.loadPerNode);
 const lengths=modelFunctions.memberLengths(g);assert.ok(lengths.cable>0&&lengths.strut>0);assert.equal(s.results.mass_kg,null);}
});
test('All 11 browser initial geometries reproduce GH input strut and cable endpoints',()=>{
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 const sameEdge=(a,b)=>distance(a[0],b[0])<1e-9&&distance(a[1],b[1])<1e-9||distance(a[0],b[1])<1e-9&&distance(a[1],b[0])<1e-9;
 for(const s of samples){const expected=modelFunctions.initialGeometry(s.parameters,model.topology),nodes=new Map(s.geometry.nodes.map(n=>[n.id,n.position]));
  const expectedNodes=new Map(expected.nodes.map(n=>[n.id,n.position]));
  const actualStruts=s.geometry.members.filter(m=>m.kind==='strut').map(m=>m.nodes.map(id=>nodes.get(id)));
  const segments=s.geometry.members.filter(m=>m.kind==='cable');const actualCables=Array.from({length:9},(_,i)=>[nodes.get(segments[i*10].nodes[0]),nodes.get(segments[i*10+9].nodes[1])]);
  for(const kind of ['strut','cable']){const actual=kind==='strut'?actualStruts:actualCables;
   for(const m of expected.members.filter(m=>m.kind===kind)){const edge=m.nodes.map(id=>expectedNodes.get(id));assert.equal(actual.filter(a=>sameEdge(a,edge)).length,1,`${s.id} ${m.id}`);}}
 }
});

async function boot(){
 const dom=new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>',{url:'http://localhost/'});
 const source=fs.readFileSync(new URL('../web/src/main.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.env.BASE_URL','"/"');
 const dependencies={document:dom.window.document,localStorage:dom.window.localStorage,fetch:async path=>({ok:true,json:async()=>path.endsWith('model.json')?model:samples}),...modelFunctions,optimize,translate,languages,locales,theoryKeys,renderTheory,bindTheory,algorithmLabel,createViewport:()=>({draw(){},frame(){}}),setInterval,clearInterval,URL,Blob};
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 await new AsyncFunction(...Object.keys(dependencies),source)(...Object.values(dependencies));
 return {dom,$:id=>dom.window.document.getElementById(id),change:(id,value,type='change')=>{const el=dom.window.document.getElementById(id);el.value=value;el.dispatchEvent(new dom.window.Event(type));}};
}
test('Physics is populated on first load and sample selection restores an unmatched design',async()=>{
 const {$,change,dom}=await boot();assert.ok($('status').textContent.includes('精确匹配'));assert.ok($('metrics').textContent.includes('0.310456'));assert.equal($('sample-table').querySelectorAll('tbody tr').length,11);
 change('p-twist_deg','100','input');assert.ok($('status').textContent.includes('尚无匹配'));assert.equal($('deformed').disabled,true);
 change('sample-select','1');assert.equal($('p-twist_deg').value,'170');assert.ok($('metrics').textContent.includes('0.315041'));assert.equal($('deformed').disabled,false);dom.window.close();
});
test('Language switching translates all sections and preserves design, saved comparisons and algorithm history',async()=>{
 const {$,change,dom}=await boot();$('save').click();change('algorithm','PSO');$('step').click();
 const historyBefore=$('algo-status').textContent;assert.ok(historyBefore.includes('评价 1/200'));assert.equal($('pso-settings').classList.contains('hidden'),false);assert.equal($('sa-settings').classList.contains('hidden'),true);
 change('language','en');assert.equal(dom.window.document.documentElement.lang,'en-GB');assert.ok($('algo-status').textContent.includes('evaluation 1/200'));assert.ok($('comparison').textContent.includes('Design 1'));assert.ok($('terms').textContent.includes('inertia weight'));assert.ok($('status').textContent.includes('Exact match'));
 change('language','it');assert.equal(dom.window.document.documentElement.lang,'it-IT');assert.ok($('terms').textContent.includes('raffreddamento'));assert.ok($('algo-status').textContent.includes('valutazione 1/200'));assert.ok($('comparison').textContent.includes('Progetto 1'));assert.equal($('p-twist_deg').value,'187.193');
 change('algorithm','SA');assert.equal($('pso-settings').classList.contains('hidden'),true);assert.equal($('sa-settings').classList.contains('hidden'),false);assert.ok($('algo-status').textContent.includes('Ogni passo'));dom.window.close();
});
test('Theory is a separate navigable chapter, with equations and localized parameter tables',async()=>{
 const {$,change,dom}=await boot();const doc=dom.window.document;
 assert.equal(doc.querySelectorAll('[data-tab]').length,5);assert.ok($('Theory').classList.contains('hidden'));
 assert.equal($('terms').closest('.view').id,'Theory');
 $('read-theory').click();assert.equal($('Theory').classList.contains('hidden'),false);assert.ok($('Design').classList.contains('hidden'));
 assert.equal($('Theory').querySelectorAll('.algorithm-flow').length,3);assert.ok($('theory-pso').textContent.includes('gbest'));
 for(const lang of languages){change('language',lang);assert.equal($('Theory').classList.contains('hidden'),false);assert.ok($('Theory').textContent.includes(theoryLanguages[lang].title));assert.equal($('Theory').querySelectorAll('.theory-table').length,4);}
 $('theory-try').click();assert.equal($('Optimization').classList.contains('hidden'),false);assert.ok($('Theory').classList.contains('hidden'));dom.window.close();
});
test('SA theory calculator follows Metropolis probability and retains its values across languages',async()=>{
 assert.equal(acceptanceProbability(0,5),1);assert.equal(acceptanceProbability(-2,5),1);assert.ok(Math.abs(acceptanceProbability(2,5)-Math.exp(-.4))<1e-14);
 assert.ok(acceptanceProbability(2,10)>acceptanceProbability(2,5));assert.throws(()=>acceptanceProbability(2,0));
 const {$,change,dom}=await boot();assert.ok($('theory-probability').textContent.includes('67.03'));
 change('theory-temperature','10','input');change('theory-delta','3','input');assert.ok(Math.abs(parseFloat($('theory-probability-bar').style.width)-100*Math.exp(-.3))<1e-10);
 change('language','it');assert.equal($('theory-temperature').value,'10');assert.equal($('theory-delta').value,'3');assert.ok($('theory-probability').textContent.includes('74,08'));dom.window.close();
});
test('All theory chapter content has matching translated structures',()=>{
 const keys=Object.keys(theoryLanguages.zh).sort();for(const lang of languages){assert.deepEqual(Object.keys(theoryLanguages[lang]).sort(),keys);const c=theoryLanguages[lang];for(const rows of [c.gaParams,c.psoParams,c.saParams])assert.ok(rows.every(row=>row.length===3&&row.every(Boolean)));assert.equal(c.comparisons.length,3);assert.ok(!renderTheory(lang).includes('undefined'));}
});
test('GA explorer inherits exact coordinates, mutates only one gene, and enforces bounds',()=>{
 const r=geneticChild([.25,2],[3,-.8],1,.6);assert.deepEqual(r.crossed,[.25,-.8]);assert.equal(r.mutated[0],.25);assert.ok(Math.abs(r.mutated[1]+.2)<1e-12);
 assert.deepEqual(geneticChild([4.9,0],[0,1],0,1.024).mutated,[5.12,1]);assert.equal(gaParentPool.length,6);
 assert.throws(()=>geneticChild([0,0],[1,1],3,.1));
});
test('PSO explorer sums inertia, personal and social terms with fixed r=.5',()=>{
 const p={position:[-3,-2],velocity:[.8,.4],pbest:[-1,1],gbest:[1,0],w:.7,c1:1.5,c2:1.5};const r=particleProposal(p);
 assert.deepEqual(r.personal,[1.5,2.25]);assert.deepEqual(r.social,[3,1.5]);assert.ok(Math.abs(r.next[0]-2.06)<1e-12);assert.ok(Math.abs(r.next[1]-2.03)<1e-12);
 assert.deepEqual(particleProposal({...p,w:0,c1:0,c2:0}).next,p.position);
 const social=particleProposal({...p,w:0,c1:0,c2:3});assert.deepEqual(social.next,[3,1]);
 const bounded=particleProposal({...p,position:[4,4],velocity:[10,10],w:1.5,c1:0,c2:0});assert.equal(bounded.clipped,true);assert.deepEqual(bounded.next,[5.12,5.12]);
});
test('GA visual walkthrough and PSO movement retain state across translations and reset independently',async()=>{
 const {$,change,dom}=await boot();assert.equal($('ga-population').querySelectorAll('.ga-candidate').length,12);assert.equal($('ga-parent-a').options.length,6);assert.equal($('ga-mutate').disabled,true);
 $('ga-cross').click();assert.equal($('ga-mutate').disabled,false);assert.ok($('ga-result').textContent.includes('C: f='));
 change('ga-coordinate','1');change('ga-delta','-0.5','input');$('ga-mutate').click();assert.equal($('ga-genomes').querySelectorAll('.mutated-gene').length,1);assert.ok($('ga-result').textContent.includes('C′: f='));
 $('pso-personal').click();assert.equal($('pso-w').value,'0');assert.equal($('pso-c2').value,'0');$('pso-move').click();assert.ok($('pso-position').textContent.includes('已移动步数: 1'));assert.equal($('pso-diagram').querySelector('.particle-trail').getAttribute('points').split(' ').length,2);
 change('language','it');assert.equal($('ga-coordinate').value,'1');assert.equal($('ga-delta').value,'-0.5');assert.equal($('ga-genomes').querySelectorAll('.mutated-gene').length,1);assert.ok($('pso-position').textContent.includes('Passi eseguiti: 1'));assert.ok($('pso-diagram').querySelectorAll('[marker-end]').length===4);
 $('ga-reset').click();assert.equal($('ga-mutate').disabled,true);assert.ok($('pso-position').textContent.includes('Passi eseguiti: 1'));
 $('pso-reset').click();assert.ok($('pso-position').textContent.includes('Passi eseguiti: 0'));dom.window.close();
});
test('All explorer instructions and labels are available in three languages',()=>{
 const keys=Object.keys(explorerCopy.zh).sort();for(const lang of languages){assert.deepEqual(Object.keys(explorerCopy[lang]).sort(),keys);assert.ok(Object.values(explorerCopy[lang]).every(v=>typeof v==='string'&&v.length));}
});
test('All three full algorithm names are shown and selection values remain executable codes',async()=>{
 const {$,change,dom}=await boot();for(const lang of languages){change('language',lang);for(const code of ['GA','PSO','SA']){const option=[...$('algorithm').options].find(o=>o.value===code);assert.ok(option.textContent.includes(algorithmNames[code].english));assert.ok($('theory-content').textContent.includes(algorithmNames[code].english));}change('algorithm','SA');$('step').click();assert.ok($('algo-status').textContent.includes('SA'));}
 dom.window.close();
});
test('SA decision accepts the same uphill candidate when hot but rejects it when cold',()=>{
 const input={x:1,epsilon:-.2,temperature:10,alpha:.95,random:.35};const hot=annealingDecision(input),cold=annealingDecision({...input,temperature:.5});
 assert.ok(hot.delta>0);assert.equal(hot.acceptedWorse,true);assert.equal(hot.nextX,.8);assert.equal(hot.nextTemperature,9.5);assert.equal(cold.candidate,hot.candidate);assert.equal(cold.accepted,false);assert.equal(cold.nextX,1);assert.equal(cold.nextTemperature,.475);
 assert.equal(annealingDecision({...input,x:.8,epsilon:.2,temperature:1e-10,random:.999}).accepted,true);assert.equal(sliceObjective(0),0);
 const edge=annealingDecision({...input,x:5,epsilon:.7});assert.equal(edge.clipped,true);assert.equal(edge.candidate,5.12);assert.throws(()=>annealingDecision({...input,temperature:0}));
});
test('SA walkthrough cools, records decisions and preserves best/current states across language switches',async()=>{
 const {$,change,dom}=await boot();$('sa-hot').click();assert.ok($('sa-preview').textContent.includes('将接受候选'));$('sa-decide').click();assert.equal($('sa-temperature').value,'9.5');assert.ok($('sa-last').textContent.includes('接受较差解'));assert.equal($('sa-history').querySelectorAll('tbody tr').length,1);assert.ok($('sa-preview').textContent.includes('f*=1'));
 change('language','it');assert.ok($('sa-last').textContent.includes('Accettata una soluzione peggiore'));assert.equal($('sa-temperature').value,'9.5');assert.equal($('sa-history').querySelectorAll('tbody tr').length,1);
 $('sa-cold').click();assert.ok($('sa-preview').textContent.includes('sarà rifiutato'));$('sa-decide').click();assert.equal($('sa-temperature').value,'0.475');assert.ok($('sa-last').textContent.includes('posizione precedente mantenuta'));
 $('sa-reset').click();change('sa-temperature','');$('sa-decide').click();assert.equal($('sa-history').querySelectorAll('tbody tr').length,0);$('sa-reset').click();assert.equal($('sa-temperature').value,'10');dom.window.close();
});
test('SA instructions are complete in Chinese, English and Italian',()=>{
 const keys=Object.keys(annealingCopy.zh).sort();for(const lang of languages){assert.deepEqual(Object.keys(annealingCopy[lang]).sort(),keys);assert.ok(Object.values(annealingCopy[lang]).every(Boolean));}
});
