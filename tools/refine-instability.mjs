import fs from 'node:fs';
import {reducedModel,mechanics,eigenSymmetric,equilibrate,height,characterize,norm} from './stability-mechanics.mjs';
const root=new URL('../data/stability/',import.meta.url),read=file=>JSON.parse(fs.readFileSync(new URL(file,root)));
const continuation=read('continuation.json'),{model,baseline,points}=continuation;
let index=points.findIndex(p=>p.lambdaMin<0),lo=points[index-1],hi=points[index];
for(let i=0;i<30;i++){
 const h=(lo.meanZ+hi.meanZ)/2,solution=equilibrate(model,lo.x,lo.P,h),point=characterize(model,solution.x,solution.P,baseline.x);
 if(point.lambdaMin>0)lo=point;else hi=point;
}
const critical=characterize(model,lo.x.map((v,i)=>(v+hi.x[i])/2),(lo.P+hi.P)/2,baseline.x);
let maxHessianError=0;const checkPoint=points[40],K=mechanics(model,checkPoint.x,checkPoint.P).K;
for(let j=0;j<18;j++){
 const plus=[...checkPoint.x],minus=[...checkPoint.x],step=1e-6;plus[j]+=step;minus[j]-=step;
 const gPlus=mechanics(model,plus,checkPoint.P).gradient,gMinus=mechanics(model,minus,checkPoint.P).gradient;
 for(let i=0;i<18;i++)maxHessianError=Math.max(maxHessianError,Math.abs((gPlus[i]-gMinus[i])/(2*step)-K[i][j]));
}
const point64=characterize(model,points.find(p=>p.P>.64).x,points.find(p=>p.P>.64).P,baseline.x);
const v=point64.mode,energy=mechanics(model,point64.x,point64.P).energy;
const energyPerturbations=[-1e-4,1e-4].map(a=>({amplitude:a,energyChange:mechanics(model,point64.x.map((x,i)=>x+a*v[i]),point64.P).energy-energy}));
const eigen=eigenSymmetric(mechanics(model,point64.x,point64.P).K)[0],eigResidual=norm(mechanics(model,point64.x,point64.P).K.map((row,i)=>row.reduce((sum,k,j)=>sum+k*eigen.vector[j],0)-eigen.value*eigen.vector[i]));
const result={angle:critical.angle??model.angle,classification:'first loss of positive definiteness of symmetric equilibrium branch; two lateral modes',critical,bracket:{stable:{P:lo.P,u:lo.u,lambdaMin:lo.lambdaMin},unstable:{P:hi.P,u:hi.u,lambdaMin:hi.lambdaMin}},verification:{maxHessianFiniteDifferenceError:maxHessianError,eigenResidual:eigResidual,energyPerturbations},jumpBracketFromGH:{stableSymmetricAt:0.672,otherEquilibriumAt:0.6722},physicalMaterialCalibrated:false};
fs.writeFileSync(new URL('critical-result.json',root),JSON.stringify(result,null,2));
console.log(JSON.stringify({P:critical.P,totalLoad:critical.totalLoad,u:critical.u,vertical:critical.verticalDisplacement,lambdaMin:critical.lambdaMin,verification:result.verification},null,2));
