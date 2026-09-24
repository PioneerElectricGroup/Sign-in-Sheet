import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PROJECT,ROOT,TABLET,MANAGER,assertIsolation,docPath,rebaseFixture,convertValues,isolateRules,helperChecks} from './support.mjs';
const fixtures=JSON.parse(fs.readFileSync('fixtures.json','utf8'));
const rules=fs.readFileSync('emulator-only.rules','utf8');
const checks=[];
function test(name,fn){fn();checks.push({name,result:'pass'});}
const h=fixtures.cases.find(c=>c.name==='hourly-departure');
const salary=fixtures.cases.find(c=>c.name==='salary-departure');
const blank=fixtures.cases.find(c=>c.name==='hourly-blank-signature');
const punch=c=>c.writes.find(w=>w.path.startsWith('punches/')).data;
const audit=c=>c.writes.find(w=>w.path.startsWith('audit/')).data;
const fakeNow=Date.parse('2026-09-24T17:40:20.000Z');
test('Demo project is fixed',()=>assert.equal(PROJECT,'demo-pioneer-v19'));
test('Production host is refused',()=>assert.throws(()=>assertIsolation({FIRESTORE_EMULATOR_HOST:'firestore.googleapis.com:443'})));
test('Absent emulator host is refused',()=>assert.throws(()=>assertIsolation({})));
test('Unexpected project is refused',()=>assert.throws(()=>assertIsolation({FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',GCLOUD_PROJECT:'not-a-demo'})));
test('Production credentials are refused',()=>assert.throws(()=>assertIsolation({FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_TOKEN:'example'})));
test('Expected loopback host accepted',()=>assert.doesNotThrow(()=>assertIsolation({FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',GCLOUD_PROJECT:PROJECT})));
test('Path escapes refused',()=>assert.throws(()=>docPath('../real-attendance')));
test('Only test workers accepted',()=>assert.throws(()=>docPath('roster/a-real-person')));
test('Validation root is explicit',()=>assert.equal(docPath('roster/check-hourly'),ROOT+'/roster/check-hourly'));
test('Five reported transaction shapes present',()=>assert.equal(fixtures.cases.length,5));
test('Hourly departure has synthetic signature',()=>assert.ok(punch(h).segments.s0.sigOut.strokes.length));
test('Salary departure has synthetic signature',()=>assert.ok(punch(salary).segments.s0.sigOut.strokes.length));
test('Intentional blank test remains separate',()=>assert.equal(punch(blank).segments.s0.sigOut.strokes.length,0));
test('Code retained on hourly record',()=>assert.equal(punch(h).code,'1000'));
test('Salary record remains attendance-only',()=>assert.ok(punch(salary).code===null&&punch(salary).noHours));
test('Uploaded report source summary identified',()=>assert.equal(fixtures.sourceReportStartedAt,'2026-09-24T14:02:24.590Z'));
test('No diagnostic truncation markers in generated fixtures',()=>assert.ok(!JSON.stringify(fixtures).includes('[DEPTH LIMIT]')));
test('No original account UID in generated rules',()=>assert.deepEqual([...new Set([...rules.matchAll(/request\.auth\.uid == '([^']+)'/g)].map(m=>m[1]))].sort(),[MANAGER,TABLET].sort()));
test('No original account UID or device ID in generated fixtures',()=>assert.ok(fixtures.cases.every(c=>punch(c)._writer===TABLET&&punch(c)._deviceId.startsWith('native-device-'))));
test('Mock rule UIDs present',()=>assert.ok(rules.includes(TABLET)&&rules.includes(MANAGER)));
for(const c of fixtures.cases){
 test(c.name+': four linked writes',()=>assert.equal(c.writes.length,4));
 test(c.name+': audit after matches punch',()=>assert.deepEqual(audit(c).after,punch(c)));
 test(c.name+': linked operation paths match',()=>{
  const r=punch(c);assert.ok(c.writes.some(w=>w.path==='audit/'+r._op));assert.ok(c.writes.some(w=>w.path==='receipts/'+r._op));
  assert.ok(c.readPaths.includes('receipts/'+r._op));
 });
 test(c.name+': only allowed fixture paths',()=>{c.readPaths.forEach(docPath);c.writes.forEach(w=>docPath(w.path));});
 test(c.name+': rebasing retains ISO/numeric consistency',()=>{
  const b=rebaseFixture(fixtures,c,fakeNow),r=punch(b);
  assert.equal(r.updatedAt,new Date(r._capturedMs).toISOString());
  assert.equal(r.date,b.day);assert.equal(r._writer,TABLET);
  const seg=r.segments.s0;const moment=r._event==='worker_out'?seg.outMs:seg.inMs;
  assert.equal(moment,r._capturedMs);assert.equal(seg['in'],b.hm);
  if(seg.out)assert.equal(seg.out,b.hm);
  assert.deepEqual(audit(b).after,r);
  assert.ok(fakeNow-r._capturedMs<120000&&fakeNow-r._capturedMs>0);
 });
}
test('Source fixtures are not mutated by rebasing',()=>assert.equal(punch(h).updatedAt,'2026-09-24T14:02:29.014Z'));
test('Timestamp transforms stay native-value placeholders',()=>{
 const x=convertValues({a:{__timestampMillis:123},b:{__serverTimestamp:true}},n=>({timestamp:n}),()=>({transform:true}));
 assert.deepEqual(x,{a:{timestamp:123},b:{transform:true}});
});
for(const focus of ['punches','audit','state','receipts']){
 test('Isolated '+focus+': retains v18 prefix byte-for-byte',()=>{
  const v=isolateRules(rules,focus);assert.equal(v.slice(0,v.indexOf('match /attendanceSites/{siteId}')),rules.slice(0,rules.indexOf('match /attendanceSites/{siteId}')));
 });
 test('Isolated '+focus+': still fixed-account gated',()=>assert.ok(isolateRules(rules,focus).includes('isTablet() && siteAllowed()')));
}
for(const [name,expression] of Object.entries(helperChecks)){
 test('Helper '+name+': original function call inserted',()=>assert.ok(isolateRules(rules,'punches',expression).includes('allow update: if liveTablet() && ('+expression+');')));
}
test('Workflow does not contain deploy command',()=>assert.ok(!/firebase\s+deploy|firebase login|login:ci|id-token:\s*write/.test(fs.readFileSync('../.github/workflows/pioneer-native-rule-check.yml','utf8'))));
test('Native runner checks isolation before loading the SDK',()=>{
 const s=fs.readFileSync('run.mjs','utf8');assert.ok(s.indexOf('assertIsolation();')<s.indexOf("await import('@firebase/rules-unit-testing')"));
});
const result={kind:'package-selftest-only',nativeFirestoreExecuted:false,passed:checks.length,failed:0,checks};
console.log(JSON.stringify(result,null,2));

// Source/fixture checks for the expression-budget candidate; still not native execution.
await import('./patch3-selftest.mjs');

// Patch 4 package/source checks; still not native-engine validation.
await import('./patch4-selftest.mjs');
