// Package, source integrity and fixture tests ONLY. No native engine runs here.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {makeExtraCases,punchOf} from './patch3-cases.mjs';
import {makePatch4Cases,adjustRebasedCase} from './patch4-cases.mjs';
import {rebaseFixture,docPath,clone,convertValues} from './support.mjs';
import {prepareTransactionWrites} from './prepare-transaction.mjs';
import {logPosition,readBudgetEvidence,acceptanceMatches} from './budget-evidence.mjs';
const f=JSON.parse(fs.readFileSync('fixtures.json','utf8')),rules=fs.readFileSync('emulator-only.rules','utf8'),proof=JSON.parse(fs.readFileSync('patch4-source-proof.json','utf8')),roleProof=JSON.parse(fs.readFileSync('role-source-proof.json','utf8'));
const patch4Rules=rules.replace(roleProof.addedComment,'').replace(roleProof.roleAfter,roleProof.roleBefore);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),tests=[];
function test(name,fn){fn();tests.push({name,result:'pass'});}
test('Exact role candidate source matches fixture and role proof',()=>{assert.equal(hash(rules),roleProof.candidateRulesSha256);assert.equal(hash(rules),f.sourceRulesSha256);});
test('Normalizing only the role block recovers exact accepted Patch 4 source',()=>assert.equal(hash(patch4Rules),proof.patch4RulesSha256));
test('Only the two documented v19 helper bodies and candidate comments differ from Patch 3',()=>{
 let original=patch4Rules.replace(proof.addedComment,'').replace(proof.headerAfter,proof.headerBefore);
 for(const {before,after} of Object.values(proof.changedFunctions)){assert.equal(original.split(after).length,2);original=original.replace(after,before);}
 assert.equal(hash(original),proof.patch3RulesSha256);
});
test('Both new links require nonexistence before and a linked record after the atomic request',()=>{
 for(const {after} of Object.values(proof.changedFunctions))assert.ok(after.includes('return !exists(p) && getAfter(p).data.recordId == id;'));
});
test('All 24 earlier regression fixture expectations retained',()=>assert.equal(makeExtraCases(f).length,24));
const additions=makePatch4Cases(f);
test('61 extra native cases; expected full-rule count is 101',()=>assert.equal(additions.length+24+5+11,101));
test('Unique new case labels and synthetic operation IDs',()=>{assert.equal(new Set(additions.map(c=>c.name)).size,61);assert.equal(new Set(additions.map(c=>punchOf(c)._op)).size,61);});
const now=Date.parse('2026-09-24T19:49:22.321Z');
for(const c0 of [...f.cases,...makeExtraCases(f),...additions])test(c0.name+': source paths and rebased controls',()=>{
 const c=adjustRebasedCase(rebaseFixture(f,c0,now),now),r=punchOf(c);
 c.readPaths.forEach(docPath);c.writes.forEach(w=>docPath(w.path));
 assert.deepEqual(c.writes.find(w=>w.path.startsWith('audit/')).data.after,r);
 assert.equal(c.writes.find(w=>w.path.startsWith('receipts/')).data.op,r._op);
 if(c.expected==='allow'){
   assert.equal(r.updatedAt,new Date(r._capturedMs).toISOString());
   assert.equal(r.date,new Date(r._capturedMs+r._offset*60000).toISOString().slice(0,10));
   assert.ok(now-r._capturedMs>=-120000 && now-r._capturedMs<=604800000);
   const segs=Object.values(r.segments);for(let i=0;i<segs.length;i++){
     const a=segs[i];assert.equal(a.inAt,new Date(a.inMs).toISOString());assert.equal(a.in,new Date(a.inMs+r._offset*60000).toISOString().slice(11,16));
     assert.ok(a.sigIn.strokes.length);assert.equal(a.sigIn.at,a.inAt);
     if(a.outMs!=null){assert.equal(a.outAt,new Date(a.outMs).toISOString());assert.equal(a.out,new Date(a.outMs+r._offset*60000).toISOString().slice(11,16));assert.ok(a.outMs>=a.inMs);}
     if(i)assert.ok(a.inMs>=segs[i-1].outMs);
   }
   if(r._event==='worker_in'&&c.before){const n=c.before.segmentCount;for(let i=0;i<n;i++)assert.deepEqual(r.segments['s'+i],c.before.segments['s'+i]);}
 }
});
const convert=v=>convertValues(v,x=>({nativeTimestampMillis:x}),()=>({nativeServerTimestamp:true}));
const second=adjustRebasedCase(rebaseFixture(f,additions[2],now),now);
function prepared(c){const r=punchOf(c),snapshot=clone(c.before);return prepareTransactionWrites(c,{['punches/'+r.date+'__'+r.workerId]:{exists:()=>!!snapshot,data:()=>snapshot}},convert,now);}
for(const c0 of additions)test(c0.name+': mutations/omissions are actually submitted',()=>{
 const c=adjustRebasedCase(rebaseFixture(f,c0,now),now),saved=JSON.stringify(c),writes=prepared(c);
 assert.equal(writes.length,4-(c.omitWrites||[]).length);
 for(const missing of c.omitWrites||[])assert.ok(!writes.some(w=>w.path.startsWith(missing+'/')));
 for(const mutation of c.alterWrites||[]){let v=writes.find(w=>w.path.startsWith(mutation.collection+'/')).data;for(const key of mutation.field.split('.'))v=v[key];assert.deepEqual(v,convert(mutation.value));}
 assert.equal(JSON.stringify(c),saved,'Source fixture mutated');
});
test('Native audit.before snapshot is preserved without JSON timestamp conversion',()=>{
 const c=clone(f.cases.find(c=>c.name==='hourly-departure')),r=punchOf(c);class NativeTimestamp{constructor(){this.seconds=123;this.nanoseconds=456789;}}
 const snapshot={native:new NativeTimestamp()};
 const writes=prepareTransactionWrites(c,{['punches/'+r.date+'__'+r.workerId]:{exists:()=>true,data:()=>snapshot}},convert,now);
 assert.equal(writes.find(w=>w.path.startsWith('audit/')).data.before,snapshot);
 assert.ok(snapshot.native instanceof NativeTimestamp);
});
test('Expected denial caused by native expression limit cannot count as a pass',()=>assert.equal(acceptanceMatches('deny','denied',{complete:true,budgetError:true}),false));
test('Missing native budget evidence cannot count as a pass',()=>assert.equal(acceptanceMatches('allow','allowed',{complete:false,budgetError:false}),false));
test('Allowed and denied outcomes both require complete non-budget evidence',()=>{assert.ok(acceptanceMatches('allow','allowed',{complete:true,budgetError:false}));assert.ok(acceptanceMatches('deny','denied',{complete:true,budgetError:false}));});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pioneer-budget-'));
try{
 const file=path.join(temp,'native.log');fs.writeFileSync(file,'old native output\n');let start=logPosition(file);
 test('Reads only this native case log range and detects the exact supplied budget error',()=>{fs.appendFileSync(file,'Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached.\n');const e=readBudgetEvidence(start);assert.ok(e.complete&&e.budgetError);assert.equal(e.matchingLines.length,1);});
 test('Old-case budget error is not attributed to the next case',()=>{start=logPosition(file);fs.appendFileSync(file,'ordinary permission denied\n');const e=readBudgetEvidence(start);assert.ok(e.complete&&!e.budgetError);});
 test('Oversized native evidence fails closed instead of pretending complete',()=>{const e=readBudgetEvidence({file,exists:true,size:0},10);assert.equal(e.complete,false);});
 test('Missing native emulator log fails closed',()=>assert.equal(readBudgetEvidence({file:path.join(temp,'missing'),exists:false,size:0}).complete,false));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log(JSON.stringify({kind:'patch4-package-source-fixture-checks-NOT-native',nativeFirestoreExecuted:false,passed:tests.length,failed:0,fullRuleCasesPreparedBeforeRoleCases:101,tests},null,2));
