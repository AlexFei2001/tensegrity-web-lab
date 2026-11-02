import fs from 'node:fs';
import Ajv from 'ajv';
import {checkGeometry,exactSample} from '../web/src/model.js';
const root=new URL('../',import.meta.url);
export function validateSamples(rows,model,schema) {
  const validate=new Ajv({strict:false,allErrors:true}).compile(schema);
  if(!validate(rows))throw Error(JSON.stringify(validate.errors));
  const seen=[];
  for(const r of rows){
    if(r.modelHash!==model.modelHash)throw Error('Model hash mismatch');
    checkGeometry(r.geometry);
    if(seen.some(s=>s.id===r.id)||exactSample(seen,r.parameters,r.modelHash))throw Error('Duplicate ID or conflicting parameter vector');
    if(r.results.feasible && r.results.maxDisplacement_m>=.431399)throw Error('Displacement gate mismatch');
    if(r.solver.validated && !Object.keys(r.solver.version).length)throw Error('Missing solver versions');
    seen.push(r);
  }
  return rows;
}
if(process.argv[1]?.endsWith('import-samples.mjs')){
  if(!process.argv[2])throw Error('Usage: node tools/import-samples.mjs path/to/samples.json');
  const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
  const rows=validateSamples(read(process.argv[2]),read(new URL('web/public/data/model.json',root)),read(new URL('data/schema.json',root)));
  const data=JSON.stringify(rows,null,2);
  fs.writeFileSync(new URL('data/samples.json',root),data);fs.writeFileSync(new URL('web/public/data/samples.json',root),data);
  console.log(`Imported ${rows.length} records; ${rows.filter(r=>r.solver.validated).length} numerically verified.`);
}
