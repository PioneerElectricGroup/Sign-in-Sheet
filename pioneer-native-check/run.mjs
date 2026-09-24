// Native Firebase rules diagnostic. NO deployment and NO production credentials.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PROJECT,HOST,PORT,ROOT,TABLET,MANAGER,clone,assertIsolation,docPath,rebaseFixture,convertValues,isolateRules,helperChecks} from './support.mjs';
assertIsolation();
const {initializeTestEnvironment} = await import('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc,runTransaction,writeBatch,serverTimestamp,Timestamp} = await import('firebase/firestore');
const baseline=fs.readFileSync('emulator-only.rules','utf8');
const fixture=JSON.parse(fs.readFileSync('fixtures.json','utf8'));
const out='results';fs.mkdirSync(out,{recursive:true});
const report={kind:'pioneer-native-engine-diagnostic',project:PROJECT,emulatorHost:`${HOST}:${PORT}`,startedAt:new Date().toISOString(),
  sourceRulesSha256:fixture.sourceRulesSha256,emulatorRulesSha256:crypto.createHash('sha256').update(baseline).digest('hex'),
  sourceReportStartedAt:fixture.sourceReportStartedAt,productionContacted:false,productionRulesChanged:false,websiteChanged:false,
  note:'Native emulator, fictional UIDs, timestamp-rebased synthetic payloads. Isolated-validator cases intentionally bypass only supporting writes in this demo emulator. They are not release acceptance tests. A green diagnostic workflow is not launch approval.',cases:[]};
function save(){fs.writeFileSync(path.join(out,'native-report.json'),JSON.stringify(report,null,2)+'\n');}
function errorInfo(error){return {code:String(error?.code||error?.name||'unknown'),message:String(error?.message||error),stack:String(error?.stack||'').slice(0,12000)};}
function convert(value){return convertValues(value,ms=>Timestamp.fromMillis(ms),()=>serverTimestamp());}
function ref(db,p){return doc(db,docPath(p));}
let number=0;
async function coverage(tag){
  try{
    const response=await fetch(`http://${HOST}:${PORT}/emulator/v1/projects/${PROJECT}:ruleCoverage`,{signal:AbortSignal.timeout(10000)});
    const text=await response.text();fs.writeFileSync(path.join(out,`${tag}-coverage.json`),text);
    return {httpStatus:response.status,file:`${tag}-coverage.json`};
  }catch(e){return {error:errorInfo(e)};}
}
async function seed(env,c){
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context=>{
    const db=context.firestore(), batch=writeBatch(db);
    for(const [p,data] of Object.entries(fixture.seed))batch.set(ref(db,p),convert(data));
    // A fictional PIN exists only in this throwaway emulator for denial tests.
    batch.set(ref(db,'config/security'),{pins:{'0000':'NATIVE TEST ONLY'}});
    if(c.before){
      const r=convert(c.before);batch.set(ref(db,`punches/${c.day}__${c.workerId}`),r);
      batch.set(ref(db,`state/${c.workerId}`),{recordId:`${c.day}__${c.workerId}`,date:c.day,open:r.outLocal===null,revision:r._rev,op:r._op});
      batch.set(ref(db,`receipts/${r._op}`),{op:r._op,uid:TABLET,deviceId:r._deviceId,recordId:`${c.day}__${c.workerId}`,capturedMs:r._capturedMs,revision:r._rev,receivedAt:r._serverAt});
      batch.set(ref(db,`audit/${r._op}`),{recordId:`${c.day}__${c.workerId}`,date:c.day,before:null,after:r,byUid:TABLET,event:r._event,createdAt:r._serverAt});
    }
    await batch.commit();
  });
}
async function submit(db,c,row){
  return runTransaction(db,async transaction=>{
    const snapshots={};row.stage='reading';
    for(const p of c.readPaths)snapshots[p]=await transaction.get(ref(db,p));
    const writes=clone(c.writes),punch=writes.find(w=>w.path.startsWith('punches/'));
    const audit=writes.find(w=>w.path.startsWith('audit/'));
    punch.data._clientMs=Date.now();audit.data.after=clone(punch.data);
    const native=writes.map(w=>({...w,data:convert(w.data)}));
    // Matches the actual application: history.before is the server snapshot,
    // not a JSON conversion that could lose Timestamp precision.
    native.find(w=>w.path.startsWith('audit/')).data.before=snapshots[punch.path]?.exists()?snapshots[punch.path].data():null;
    row.stage='committing-four-document-write';
    fs.writeFileSync(path.join(out,`${row.tag}-submitted.json`),JSON.stringify({rebasedAt:c.rebasedAt,writes:native},null,2));
    for(const w of native)transaction.set(ref(db,w.path),w.data);
  },{maxAttempts:1});
}
async function oneCase(label,rules,c0,expected,scope='full-rules',operation=null){
  const tag=String(++number).padStart(2,'0')+'-'+label.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  const row={tag,label,scope,expected,startedAt:new Date().toISOString(),stage:'initializing-emulator-rules',observed:'not-run'};
  report.cases.push(row);save();console.log(`\n===== ${tag} =====`);
  fs.writeFileSync(path.join(out,`${tag}.rules`),rules);
  let env;
  try{
    env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:HOST,port:PORT,rules}});
    const c=rebaseFixture(fixture,c0);row.stage='seeding-local-emulator';await seed(env,c);
    const db=env.authenticatedContext(TABLET).firestore();
    row.stage='executing-client-operation';
    try{
      await (operation?operation(db,c,env):submit(db,c,row));row.observed='allowed';
    }catch(e){
      row.error=errorInfo(e);row.observed=e.code==='permission-denied'?'denied':'error';
    }
    row.matchesIntended=expected==='allow'?row.observed==='allowed':expected==='deny'?row.observed==='denied':null;
    row.coverage=await coverage(tag);
  }catch(e){row.observed='harness-error';row.error=errorInfo(e);}
  finally{
    if(env)try{await env.cleanup();}catch(e){row.cleanupError=errorInfo(e);}
    row.finishedAt=new Date().toISOString();save();
    console.log(`${row.label}: observed=${row.observed}; intended=${expected}; stage=${row.stage}`);
    if(row.error)console.log(row.error.message);
  }
  return row;
}
const byName=name=>{const c=fixture.cases.find(c=>c.name===name);if(!c)throw Error(`Missing fixture ${name}`);return c;};
const watchdog=setTimeout(()=>{report.fatal='Diagnostic exceeded 15 minutes';save();process.exit(2);},15*60000);
try{
  // First reproduce all five actual submitted record shapes under the unchanged
  // Patch 2 validators. This includes the intentional blank-signature rejection.
  for(const c of fixture.cases)await oneCase(c.name,baseline,c,c.expected);
  const h=byName('hourly-departure');
  const recordId=c=>`${c.day}__${c.workerId}`;
  const beforeOp=c=>c.before._op;
  const negatives=[
    ['tablet-private-pin','deny',(db)=>getDoc(ref(db,'config/security'))],
    ['tablet-add-crew','deny',(db)=>setDoc(ref(db,'roster/__permission_probe'),{name:'CHECK EXTRA',active:true})],
    ['tablet-malformed-record','deny',(db)=>setDoc(ref(db,'punches/__permission_probe'),{approved:true})],
    ['tablet-approve-record','deny',(db,c)=>updateDoc(ref(db,`punches/${recordId(c)}`),{approved:true})],
    ['tablet-rewrite-arrival','deny',(db,c)=>updateDoc(ref(db,`punches/${recordId(c)}`),{'segments.s0.in':'01:00'})],
    ['tablet-delete-record','deny',(db,c)=>deleteDoc(ref(db,`punches/${recordId(c)}`))],
    ['tablet-private-audit','deny',(db,c)=>getDoc(ref(db,`audit/${beforeOp(c)}`))],
    ['tablet-modify-receipt','deny',(db,c)=>updateDoc(ref(db,`receipts/${beforeOp(c)}`),{revision:999})],
    ['tablet-delete-receipt','deny',(db,c)=>deleteDoc(ref(db,`receipts/${beforeOp(c)}`))],
    ['unauthenticated-roster','deny',(_db,_c,env)=>getDoc(ref(env.unauthenticatedContext().firestore(),'roster/check-hourly'))],
    ['other-uid-roster','deny',(_db,_c,env)=>getDoc(ref(env.authenticatedContext('native-unapproved-person').firestore(),'roster/check-hourly'))],
  ];
  for(const [name,expected,fn] of negatives)await oneCase(name,baseline,h,expected,'full-rules',fn);
  // Isolation is forensic only. The four related records are still submitted
  // together, but just one collection's original validator controls permission.
  for(const name of ['hourly-departure','salary-departure']){
    const c=byName(name);
    for(const focus of ['punches','audit','state','receipts']){
      await oneCase(`${name}-only-${focus}-validator`,isolateRules(baseline,focus),c,'diagnostic','one-original-collection-validator');
    }
  }
  // On the submitted hourly departure, isolate each shared helper with its actual
  // arguments. This locates a semantic failure even when the top-level denial
  // says only permission-denied. These rows are NOT counted as security passes.
  for(const [helper,expression] of Object.entries(helperChecks)){
    await oneCase(`hourly-departure-helper-${helper}`,isolateRules(baseline,'punches',expression),h,'diagnostic','one-original-helper');
  }
}catch(e){report.fatal=errorInfo(e);}
finally{
  clearTimeout(watchdog);report.finishedAt=new Date().toISOString();
  const full=report.cases.filter(c=>c.scope==='full-rules');
  report.fullRules={cases:full.length,matchedIntended:full.filter(c=>c.matchesIntended===true).length,mismatchedOrError:full.filter(c=>c.matchesIntended!==true).length};
  report.harnessErrors=report.cases.filter(c=>c.observed==='harness-error'||c.observed==='error').length;
  save();
  const summary=['# Pioneer native rules diagnostic','',
    '**This run does not deploy or activate anything. A green workflow only means the diagnostic completed.**','',
    '| Case | Scope | Intended | Observed |','|---|---|---|---|',
    ...report.cases.map(c=>`| ${c.label} | ${c.scope} | ${c.expected} | ${c.observed} |`),
    '',`Full-rule cases matching intended behavior: ${report.fullRules.matchedIntended}/${full.length}.`,
    '',report.fatal?'**Harness error:** '+JSON.stringify(report.fatal):"Open this run’s menu, download the log archive, and send it to the assistant.",
    '', 'The collected job logs contain native-report.json, rule-coverage output, and emulator logs. No billable artifact or cache is uploaded.',''].join('\n');
  fs.writeFileSync(path.join(out,'SUMMARY.md'),summary);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
  console.log(summary);
  if(report.fatal||report.harnessErrors)process.exitCode=2;
}
