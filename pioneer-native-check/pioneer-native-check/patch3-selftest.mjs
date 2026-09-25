// Package/source checks only: these do NOT evaluate Google's Security Rules engine.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';import vm from 'node:vm';
import {makeExtraCases,punchOf} from './patch3-cases.mjs';import {rebaseFixture,docPath} from './support.mjs';
const f=JSON.parse(fs.readFileSync('fixtures.json'));const rules=fs.readFileSync('emulator-only.rules','utf8');const tests=[];
function test(name,fn){fn();tests.push({name,result:'pass'});}
const scoped=rules.slice(rules.indexOf('match /attendanceSites/{siteId}'));
const formatSource=scoped.slice(scoped.indexOf('      function isoMillis'),scoped.indexOf('      function capturedMs'))
 .replaceAll('[1:3]','.slice(1,3)').replaceAll('[1:4]','.slice(1,4)');
const sandbox={string:String,int:Math.trunc,timestamp:{value:ms=>{const d=new Date(ms);return {year:()=>d.getUTCFullYear(),month:()=>d.getUTCMonth()+1,day:()=>d.getUTCDate(),hours:()=>d.getUTCHours(),minutes:()=>d.getUTCMinutes()};}}};vm.createContext(sandbox);vm.runInContext(formatSource,sandbox);
test('actual candidate formatting helper syntax translates for local calculation',()=>assert.equal(typeof sandbox.isoMillis,'function'));
test('all two-digit component values keep identical padding',()=>{for(let n=0;n<100;n++)assert.equal(sandbox.pad(n),String(n).padStart(2,'0'));});
test('all millisecond suffixes keep exact UTC ISO formatting',()=>{const t=Date.parse('2026-09-24T14:02:30.000Z');for(let n=0;n<1000;n++)assert.equal(sandbox.isoMillis(t+n),new Date(t+n).toISOString());});
test('calendar/time formatting across leap dates, year-end and both allowed offsets',()=>{
 for(const date of ['2026-01-01','2026-09-24','2026-12-31','2028-02-29'])for(let h=0;h<24;h++)for(const m of [0,1,9,10,59])for(const second of [0,9,10,59])for(const ms of [0,9,10,99,100,999]){
  const t=Date.parse(date+'T00:00:00.000Z')+h*3600000+m*60000+second*1000+ms;assert.equal(sandbox.isoMillis(t),new Date(t).toISOString());
  for(const offset of [-240,-300]){const local=new Date(t+offset*60000).toISOString();assert.equal(sandbox.localDate(t,offset),local.slice(0,10));assert.equal(sandbox.localTime(t,offset),local.slice(11,16));}
 }
});
const cases=makeExtraCases(f);
test('24 additional native cases prepared',()=>assert.equal(cases.length,24));
for(const c of cases)test(c.name+': fixture consistency and safe paths',()=>{
 c.readPaths.forEach(docPath);c.writes.forEach(w=>docPath(w.path));const r=punchOf(c);const a=c.writes.find(w=>w.path.startsWith('audit/')).data;
 assert.deepEqual(a.after,r);assert.equal(r._op,c.writes.find(w=>w.path.startsWith('receipts/')).data.op);
 const b=rebaseFixture(f,c,Date.parse('2026-09-24T17:40:20.000Z')),p=punchOf(b);
 if(c.expected==='allow'){
  assert.equal(p.updatedAt,new Date(p._capturedMs).toISOString());
  const segs=Object.values(p.segments);for(let i=0;i<segs.length;i++){const s=segs[i];assert.equal(s.inAt,new Date(s.inMs).toISOString());if(s.out){assert.equal(s.outAt,new Date(s.outMs).toISOString());assert.ok(s.outMs>=s.inMs);}if(i)assert.ok(s.inMs>=segs[i-1].outMs);}
 }
});
test('candidate remains restricted to the four fictional role accounts',()=>{for(const uid of ['native-test-field-kiosk','native-test-manager-isaac','native-test-manager-jake','native-test-manager-eric'])assert.ok(rules.includes(uid));for(const uid of ['d3GUR1ht0DQSss1mS5t9jOgChfq2','hnLcbI2FI1eeQhhmxjxXnVpgwpG2','x0rz86ZAguRMYdrEznbH1eMq1lG3','XfYuiG6r22V3Hxr7vobDD0Q8G5j1'])assert.ok(!rules.includes(uid));});
test('candidate operation dispatch is explicit and still uses all linked validators',()=>{assert.ok(scoped.includes("r._event == 'worker_out'\n            ? closeDeparture(r,old)"));assert.ok(scoped.includes('&& headMatches(id,r) && auditMatches(id,r) && receiptRequired(id,r)'));});
test('no HTML or service-worker implementation in this patch module',()=>assert.ok(!fs.readFileSync('patch3-cases.mjs','utf8').includes('firebase.initializeApp')));
const summary={kind:'patch3-package-checks-NOT-native-rules',passed:tests.length,failed:0,nativeFirestoreExecuted:false,candidateRulesSha256:crypto.createHash('sha256').update(rules).digest('hex'),tests};
console.log(JSON.stringify(summary,null,2));
