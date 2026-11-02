import fs from 'node:fs';
import {reducedModel,mechanics,eigenSymmetric,equilibrate,height,characterize,norm} from './stability-mechanics.mjs';
const root=new URL('../data/stability/',import.meta.url),read=file=>JSON.parse(fs.readFileSync(new URL(file,root)));
const zero=read('fine.json').samples.find(r=>r.P===0),coarse=read('coarse.json').samples;
const model=reducedModel(zero),baseline=equilibrate(model,model.x,0);const points=[];
let state=baseline;
const start=height(model,baseline.x);
for(let target=start;target>=.70;target-=.002){state=equilibrate(model,state.x,state.P,target);points.push(characterize(model,state.x,state.P,baseline.x));}
const validation=coarse.filter(r=>r.meanZ>0).map(r=>{const original=model.corners.flatMap(id=>r.system.positions[id]);const refined=equilibrate(model,original,r.P);return {P:r.P,ghResidual:r.residualMax,cornerDifference:norm(refined.x.map((v,i)=>v-original[i])),uDifference:characterize(model,refined.x,r.P,baseline.x).u-r.u,lambdaMin:eigenSymmetric(mechanics(model,refined.x,r.P).K)[0].value};});
const firstNegative=points.findIndex(r=>r.lambdaMin<0),peak=points.reduce((a,b)=>a.P>b.P?a:b);
const result={method:'Displacement-control equilibrium continuation of exact taut-chain-condensed GH spring model',angle:zero.angle,model,baseline,validation,firstNegativeIndex:firstNegative,peak,points};
fs.writeFileSync(new URL('continuation.json',root),JSON.stringify(result,null,2));
console.log(JSON.stringify({start,validation,firstNegative:firstNegative<0?null:points[firstNegative],peak},null,2));
