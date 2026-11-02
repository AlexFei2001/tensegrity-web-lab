import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../data/stability/'+name,import.meta.url)));
test('Installed live GH lab decays at P=.55 and amplifies at P=.58',()=>{
 const stable=read('live-canvas-055.json'),unstable=read('live-canvas-058.json');
 assert.deepEqual(stable.errors,[]);assert.deepEqual(unstable.errors,[]);
 assert.ok(Number(stable.outputs.LambdaMin[0])>0);
 assert.ok(Number(unstable.outputs.LambdaMin[0])<0);
 for(const name of ['GainMinus','GainPlus']){
  assert.ok(Number(stable.outputs[name][0])<.2);
  assert.ok(Number(unstable.outputs[name][0])>10);
 }
 assert.match(stable.outputs.Report[0],/DECAYED/);
 assert.match(unstable.outputs.Report[0],/AMPLIFIED/);
});
test('Paused lab hides obsolete results and the saved GHX retains embedded code',()=>{
 const paused=read('live-canvas-paused.json'),final=read('perturbation-lab-final.json');
 assert.equal(paused.lambdaCount,0);
 assert.ok(paused.geometryCounts.every(n=>n===0));
 assert.ok(final.persistenceVerified);
 assert.ok(Math.abs(final.P-.543)<1e-9);
 assert.deepEqual(final.errors,[]);
 assert.equal(final.chartCount,4);
});
