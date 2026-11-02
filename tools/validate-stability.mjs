import fs from 'node:fs';
import {reducedModel,mechanics,eigenSymmetric,equilibrate,norm} from './stability-mechanics.mjs';
const root=new URL('../data/stability/',import.meta.url),input=JSON.parse(fs.readFileSync(new URL('verification.json',root))),checks=[],seeds=[];
function cholesky(A){const n=A.length,L=Array.from({length:n},()=>Array(n).fill(0));for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let sum=A[i][j];for(let k=0;k<j;k++)sum-=L[i][k]*L[j][k];if(i===j){if(sum<=0)throw Error('Internal cable stiffness not positive definite');L[i][j]=Math.sqrt(sum);}else L[i][j]=sum/L[j][j];}return L;}
function cholSolve(L,b){const n=b.length,y=Array(n),x=Array(n);for(let i=0;i<n;i++){let s=b[i];for(let j=0;j<i;j++)s-=L[i][j]*y[j];y[i]=s/L[i][i];}for(let i=n-1;i>=0;i--){let s=y[i];for(let j=i+1;j<n;j++)s-=L[j][i]*x[j];x[i]=s/L[i][i];}return x;}
for(const row of input.samples.filter(r=>r.P<.61)){
 const reduced=reducedModel(row),state=equilibrate(reduced,reduced.x,row.P),K=mechanics(reduced,state.x,row.P).K,eigen=eigenSymmetric(K);
 const s=row.system,full={springs:s.springs.map(v=>({a:v.nodes[0],b:v.nodes[1],...v})),anchors:s.anchors,loadNodes:s.loads.map(l=>l.node)};
 const fullData=mechanics(full,s.positions.flat(),row.P),fullK=fullData.K,c=reduced.corners.flatMap(node=>[3*node,3*node+1,3*node+2]),cset=new Set(c),interior=Array.from({length:fullK.length},(_,i)=>i).filter(i=>!cset.has(i));
 const L=cholesky(interior.map(i=>interior.map(j=>fullK[i][j]))),solves=c.map(j=>cholSolve(L,interior.map(i=>fullK[i][j])));
 const condensed=c.map((i,a)=>c.map((j,b)=>fullK[i][j]-interior.reduce((sum,k,t)=>sum+fullK[i][k]*solves[b][t],0)));
 let difference=0;for(let i=0;i<18;i++)for(let j=0;j<18;j++)difference=Math.max(difference,Math.abs(condensed[i][j]-K[i][j]));
 const min=eigenSymmetric(condensed)[0];checks.push({P:row.P,fullResidual:norm(fullData.gradient),schurVsReducedMaxDifference:difference,lambdaMinReduced:eigen[0].value,lambdaMinFullSchur:min.value,minCableForce:Math.min(...s.springs.filter(v=>v.kind==='cable').map(v=>v.axial))});
 if(Math.abs(row.P-.55)<1e-8||Math.abs(row.P-.58)<1e-8){
  const amplitude=1e-4,scale=amplitude/Math.max(...Array.from({length:6},(_,i)=>norm(eigen[0].vector.slice(3*i,3*i+3)))),cornerMode=new Map(reduced.corners.map((node,i)=>[node,eigen[0].vector.slice(3*i,3*i+3).map(v=>v*scale)])),perturb=s.positions.map(()=>[0,0,0]);
  for(const [id,v] of cornerMode)perturb[id]=v;
  for(let g=0;g<9;g++){const chain=s.springs.slice(10*g,10*g+10),a=cornerMode.get(chain[0].nodes[0]),b=cornerMode.get(chain[9].nodes[1]);for(let i=0;i<10;i++)perturb[chain[i].nodes[0]]=a.map((v,j)=>v+(b[j]-v)*i/10);}
  seeds.push({P:row.P,lambdaMin:eigen[0].value,amplitude,system:s,corners:reduced.corners,perturb});
 }
}
fs.writeFileSync(new URL('full-system-check.json',root),JSON.stringify(checks,null,2));
fs.writeFileSync(new URL('perturbation-seeds.json',root),JSON.stringify(seeds,null,2));console.log(JSON.stringify(checks,null,2));
