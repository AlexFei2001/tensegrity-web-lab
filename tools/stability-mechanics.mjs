// Conservative Spring + finite Anchor + dead Unary-load model, read from GH.
// A taut, straight serial cable is statically condensed without changing EA/k.
export const norm=a=>Math.hypot(...a);
const zeros=n=>Array.from({length:n},()=>Array(n).fill(0));
export function reducedModel(record){
 const system=record.system,corners=[...new Set(system.springs.filter(s=>s.kind==='strut').flatMap(s=>s.nodes))].sort((a,b)=>a-b),map=new Map(corners.map((id,i)=>[id,i]));
 if(corners.length!==6||system.springs.length!==93)throw Error('Unexpected topology');
 const springs=[];let maxCableDeviation=0;
 for(let j=0;j<9;j++){
  const chain=system.springs.slice(j*10,j*10+10),a=chain[0].nodes[0],b=chain.at(-1).nodes[1];
  if(!map.has(a)||!map.has(b)||chain.some((s,i)=>i&&s.nodes[0]!==chain[i-1].nodes[1]))throw Error('Cable chain order mismatch');
  const x=system.positions[a],y=system.positions[b],d=y.map((v,k)=>v-x[k]),length=norm(d);
  for(const s of chain){if(s.axial<=0)throw Error('Cannot condense a compressed cable chain');const q=system.positions[s.nodes[0]].map((v,k)=>v-x[k]);const t=q.reduce((sum,v,k)=>sum+v*d[k],0)/(length*length);maxCableDeviation=Math.max(maxCableDeviation,norm(q.map((v,k)=>v-t*d[k])));}
  springs.push({a:map.get(a),b:map.get(b),k:1/chain.reduce((sum,s)=>sum+1/s.k,0),rest:chain.reduce((sum,s)=>sum+s.rest,0),kind:'cable'});
 }
 if(maxCableDeviation>1e-5)throw Error('Cable chain is not straight enough for exact condensation');
 for(const s of system.springs.filter(s=>s.kind==='strut'))springs.push({a:map.get(s.nodes[0]),b:map.get(s.nodes[1]),k:s.k,rest:s.rest,kind:'strut'});
 const anchors=system.anchors.map(a=>({...a,node:map.get(a.node)}));
 const loadNodes=system.loads.map(l=>map.get(l.node));if(loadNodes.some(n=>n===undefined))throw Error('Load not on a corner');
 return {corners,springs,anchors,loadNodes,x:corners.flatMap(id=>system.positions[id]),maxCableDeviation,angle:record.angle};
}
export function mechanics(model,x,P){
 const n=x.length,gradient=Array(n).fill(0),K=zeros(n);let energy=0,minCableForce=Infinity;
 for(const s of model.springs){
  const d=[0,1,2].map(j=>x[3*s.b+j]-x[3*s.a+j]),l=norm(d);if(l<1e-10)throw Error('Degenerate member');
  const unit=d.map(v=>v/l),force=s.k*(l-s.rest);energy+=.5*s.k*(l-s.rest)**2;if(s.kind==='cable')minCableForce=Math.min(minCableForce,force);
  for(let j=0;j<3;j++){
   gradient[3*s.a+j]-=force*unit[j];gradient[3*s.b+j]+=force*unit[j];
   for(let k=0;k<3;k++){const value=s.k*((j===k?1-s.rest/l:0)+s.rest/l*unit[j]*unit[k]);
    K[3*s.a+j][3*s.a+k]+=value;K[3*s.b+j][3*s.b+k]+=value;K[3*s.a+j][3*s.b+k]-=value;K[3*s.b+j][3*s.a+k]-=value;}
  }
 }
 for(const a of model.anchors)for(let j=0;j<3;j++){const index=3*a.node+j,delta=x[index]-a.target[j];gradient[index]+=a.k*delta;K[index][index]+=a.k;energy+=.5*a.k*delta*delta;}
 for(const node of model.loadNodes){gradient[3*node+2]+=P;energy+=P*x[3*node+2];}
 return {energy,gradient,K,minCableForce};
}
export function solveLinear(A,b){
 const n=b.length,m=A.map((row,i)=>[...row,b[i]]);
 for(let k=0;k<n;k++){let pivot=k;for(let i=k+1;i<n;i++)if(Math.abs(m[i][k])>Math.abs(m[pivot][k]))pivot=i;
  if(Math.abs(m[pivot][k])<1e-14)throw Error('Singular system');[m[k],m[pivot]]=[m[pivot],m[k]];
  for(let i=k+1;i<n;i++){const f=m[i][k]/m[k][k];m[i][k]=0;for(let j=k+1;j<=n;j++)m[i][j]-=f*m[k][j];}}
 const result=Array(n).fill(0);for(let i=n-1;i>=0;i--){let value=m[i][n];for(let j=i+1;j<n;j++)value-=m[i][j]*result[j];result[i]=value/m[i][i];}return result;
}
export function eigenSymmetric(matrix){
 const n=matrix.length,A=matrix.map(row=>[...row]),V=zeros(n);for(let i=0;i<n;i++)V[i][i]=1;
 for(let iteration=0;iteration<100*n*n;iteration++){
  let p=0,q=1,max=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.abs(A[i][j])>max){max=Math.abs(A[i][j]);p=i;q=j;}
  if(max<1e-11)return Array.from({length:n},(_,i)=>({value:A[i][i],vector:V.map(row=>row[i])})).sort((a,b)=>a.value-b.value);
  const app=A[p][p],aqq=A[q][q],apq=A[p][q],angle=.5*Math.atan2(2*apq,aqq-app),c=Math.cos(angle),s=Math.sin(angle);
  for(let k=0;k<n;k++)if(k!==p&&k!==q){const akp=A[k][p],akq=A[k][q];A[k][p]=A[p][k]=c*akp-s*akq;A[k][q]=A[q][k]=s*akp+c*akq;}
  A[p][p]=c*c*app-2*s*c*apq+s*s*aqq;A[q][q]=s*s*app+2*s*c*apq+c*c*aqq;A[p][q]=A[q][p]=0;
  for(let k=0;k<n;k++){const vp=V[k][p],vq=V[k][q];V[k][p]=c*vp-s*vq;V[k][q]=s*vp+c*vq;}
 }
 throw Error('Eigen solver iteration cap');
}
export const height=(model,x)=>model.loadNodes.reduce((sum,node)=>sum+x[3*node+2],0)/model.loadNodes.length;
export function equilibrate(model,initial,P,targetHeight=null){
 let x=[...initial],load=P;
 const residual=(x,P)=>{const data=mechanics(model,x,P);return {data,r:targetHeight===null?data.gradient:[...data.gradient,height(model,x)-targetHeight]};};
 for(let iteration=0;iteration<80;iteration++){
  const {data,r}=residual(x,load);if(norm(r)<1e-10)return {x,P:load,iterations:iteration,residual:norm(r)};
  let J=data.K.map(row=>[...row]);
  if(targetHeight!==null){const n=x.length,b=Array(n).fill(0);for(const node of model.loadNodes)b[3*node+2]=1;J=J.map((row,i)=>[...row,b[i]]);J.push([...b.map(v=>v/model.loadNodes.length),0]);}
  const step=solveLinear(J,r.map(v=>-v));let accepted=false;
  for(let factor=1;factor>1e-8;factor/=2){const trial=x.map((v,i)=>v+factor*step[i]),trialP=targetHeight===null?load:load+factor*step[x.length];
   if(norm(residual(trial,trialP).r)<norm(r)){x=trial;load=trialP;accepted=true;break;}}
  if(!accepted)throw Error('Newton line search failed, residual '+norm(r));
 }
 throw Error('Newton iteration cap');
}
export function characterize(model,x,P,reference){
 const data=mechanics(model,x,P),eigen=eigenSymmetric(data.K);
 return {P,totalLoad:3*P,meanZ:height(model,x),u:Math.max(...model.loadNodes.map(node=>norm([0,1,2].map(j=>x[3*node+j]-reference[3*node+j])))),verticalDisplacement:height(model,reference)-height(model,x),lambdaMin:eigen[0].value,minCableForce:data.minCableForce,residual:norm(data.gradient),x,eigenvalues:eigen.map(e=>e.value),mode:eigen[0].vector};
}
