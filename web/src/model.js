// Initial geometry transcribed from audited GHX Polygon/Rotate/List Item wiring.
// This is NOT a form-finding or mechanics solver.
export function initialGeometry(p, topology) {
  const nodes=[];
  for(let level=0;level<2;level++) for(let i=0;i<3;i++) {
    const a=2*Math.PI*i/3+(level?p.twist_deg*Math.PI/180:0);
    const r=level?p.topRadius:p.bottomRadius;
    nodes.push({id:nodes.length,position:[r*Math.cos(a),r*Math.sin(a),level?p.topZ:p.bottomZ]});
  }
  const members=Object.entries(topology).flatMap(([kind,edges])=>edges.map((nodes,i)=>({id:`${kind[0].toUpperCase()}${i}`,kind:kind==='struts'?'strut':'cable',nodes})));
  return {nodes,members};
}
export function exactSample(samples, parameters, modelHash) {
  return samples.find(s=>s.modelHash===modelHash && Object.keys(parameters).length===Object.keys(s.parameters).length &&
    Object.entries(parameters).every(([k,v])=>s.parameters[k]===v))??null;
}
export function memberLengths(geometry) {
  const points=new Map(geometry.nodes.map(n=>[n.id,n.position]));
  const result={cable:0,strut:0};
  for(const member of geometry.members){const [a,b]=member.nodes.map(id=>points.get(id));result[member.kind]+=Math.hypot(...a.map((v,i)=>v-b[i]));}
  return result;
}
export function fitness(sample) {
  if(!sample || !sample.solver.validated || !sample.solver.converged || !sample.results.feasible ||
    !Number.isFinite(sample.results.maxDisplacement_m)) return Infinity;
  return .5*(1-sample.parameters.loadPerNode)+.5*sample.results.maxDisplacement_m/.431399;
}
export function csv(rows) {
  if(!rows.length)return '';
  const keys=Object.keys(rows[0]);
  const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  return [keys.map(quote).join(','),...rows.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\r\n');
}
export function checkGeometry(g) {
  const ids=new Set(g.nodes.map(n=>n.id));
  if(ids.size!==g.nodes.length)throw Error('Duplicate node ID');
  for(const n of g.nodes)for(const key of ['position','deformedPosition'])if(n[key] && (n[key].length!==3||!n[key].every(Number.isFinite)))throw Error('Nonfinite geometry');
  for(const m of g.members)if(!m.nodes.every(id=>ids.has(id))||m.nodes[0]===m.nodes[1])throw Error('Invalid member endpoints');
}
export function assertDataset(rows,model) {
  if(!Array.isArray(rows))throw Error('Sample dataset must be an array');
  const ids=new Set();
  for(const r of rows){
    if(!r || ids.has(r.id) || r.modelHash!==model.modelHash)throw Error('Sample identity/model mismatch');
    ids.add(r.id);
    if(!r.parameters || model.parameters.some(p=>!Number.isFinite(r.parameters[p.key])||r.parameters[p.key]<p.min||r.parameters[p.key]>p.max))throw Error('Invalid sample parameters');
    if(!r.solver || !r.results || !Array.isArray(r.results.failureReasons))throw Error('Missing sample result status');
    if(r.units?.length!=='m'||r.units?.displacement!=='m')throw Error('Sample units must be meters');
    if(r.solver.validated && (!r.solver.converged||r.solver.status!=='precomputed'||!Number.isFinite(r.results.maxDisplacement_m)||r.results.maxDisplacement_m<0||r.geometry?.nodes?.length<6))throw Error('Invalid verified sample');
    if(r.results.feasible && (!r.solver.validated||r.results.maxDisplacement_m>=.431399))throw Error('Invalid feasibility');
    if(!r.solver.validated && !r.results.failureReasons.length)throw Error('Missing failure reason');
    checkGeometry(r.geometry);
  }
}
