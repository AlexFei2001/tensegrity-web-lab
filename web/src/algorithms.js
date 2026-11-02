// Browser teaching port of repository PSO_GA_python operator concepts.
// Separate mathematical experiment, never a substitute structural evaluator.
export function rng(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export const rastrigin=([x,y])=>20+x*x+y*y-10*(Math.cos(2*Math.PI*x)+Math.cos(2*Math.PI*y));
export function* optimize({algorithm='GA',seed=42,budget=200,population=12,w=.7,c1=1.5,c2=1.5,cooling=.95,temperature=10}) {
  const random=rng(seed), point=()=>[0,1].map(()=>random()*10.24-5.12), clip=x=>Math.max(-5.12,Math.min(5.12,x));
  budget=Math.max(1,Math.min(10000,Math.floor(budget)));population=Math.max(2,Math.min(population,budget));
  let count=0,best=Infinity,bestPoint=null;
  function evaluate(x,extra={}){const f=rastrigin(x);if(f<best){best=f;bestPoint=[...x];}count++;return {algorithm,seed,evaluation:count,fitness:f,best,bestPoint:[...bestPoint],point:[...x],realStructuralEvaluations:0,feasibleFraction:1,...extra};}
  if(algorithm==='SA') {
    let x=point(),row=evaluate(x,{temperature,accepted:true,acceptedWorse:false});let fx=row.fitness;yield row;
    while(count<budget){const next=x.map(v=>clip(v+(random()-.5)*1.4));const f=rastrigin(next),delta=f-fx,probability=delta<=0?1:Math.exp(-delta/temperature),accepted=random()<probability;
      row=evaluate(next,{temperature,delta,probability,accepted,acceptedWorse:accepted&&delta>0});if(accepted){x=next;fx=f;}yield row;temperature=Math.max(1e-10,temperature*cooling);}
  } else if(algorithm==='PSO') {
    const swarm=Array.from({length:population},()=>({x:point(),v:[0,0],p:null,f:Infinity}));
    while(count<budget)for(const s of swarm){if(count>=budget)break;const row=evaluate(s.x);if(row.fitness<s.f){s.f=row.fitness;s.p=[...s.x];}yield {...row,velocity:[...s.v],pbest:[...s.p]};
      s.v=s.v.map((v,i)=>w*v+c1*random()*(s.p[i]-s.x[i])+c2*random()*(bestPoint[i]-s.x[i]));s.x=s.x.map((v,i)=>clip(v+s.v[i]));}
  } else if(algorithm==='GA') {
    let pop=Array.from({length:population},point),generation=0;
    while(count<budget){const scored=[];for(const x of pop){if(count>=budget)break;const row=evaluate(x,{generation});scored.push({x,f:row.fitness});yield row;}scored.sort((a,b)=>a.f-b.f);if(count>=budget)break;
      const parents=scored.slice(0,Math.max(2,Math.floor(scored.length/2))),next=[[...scored[0].x]];
      while(next.length<population){const a=parents[Math.floor(random()*parents.length)].x,b=parents[Math.floor(random()*parents.length)].x;let child=[a[0],b[1]];const j=Math.floor(random()*2);child[j]=clip(child[j]+(random()-.5)*2.048);next.push(child);}pop=next;generation++;}
  } else throw Error('Unknown algorithm');
}
