// Native Firebase rules diagnostic. NO deployment and NO production credentials.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PROJECT,HOST,PORT,ROOT,TABLET,MANAGER,clone,assertIsolation,docPath,rebaseFixture,convertValues,isolateRules,helperChecks} from './support.mjs';
assertIsolation();
const {makeExtraCases} = await import('./patch3-cases.mjs');
const {makePatch4Cases,adjustRebasedCase} = await import('./patch4-cases.mjs');
const {logPosition,nativeBudgetEvidence,acceptanceMatches} = await import('./budget-evidence.mjs');
const {prepareTransactionWrites} = await import('./prepare-transaction.mjs');
const {initializeTestEnvironment} = await import('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc,runTransaction,writeBatch,serverTimestamp,Timestamp} = await import('firebase/firestore');
const baseline=fs.readFileSync('emulator-only.rules','utf8');
const fixture=JSON.parse(fs.readFileSync('fixtures.json','utf8'));
if(crypto.createHash('sha256').update(baseline).digest('hex')!==fixture.sourceRulesSha256)throw Error('STOP: rules and fixture SHA do not match; upload the complete new package.');
const out='results';fs.mkdirSync(out,{recursive:true});
const report={kind:'pioneer-native-engine-diagnostic',project:PROJECT,emulatorHost:`${HOST}:${PORT}`,startedAt:new Date().toISOString(),
  candidateRevision:fixture.sourceRulesRevision,sourceRulesSha256:fixture.sourceRulesSha256,emulatorRulesSha256:crypto.createHash('sha256').update(baseline).digest('hex'),
  sourceReportStartedAt:fixture.sourceReportStartedAt,productionContacted:false,productionRulesChanged:false,websiteChanged:false,
  note:'Native emulator, fictional UIDs, timestamp-rebased synthetic payloads. Isolated-validator cases intentionally bypass only supporting writes in this demo emulator. They are not release acceptance tests. A green diagnostic workflow is not launch approval.',cases:[]};
function save(){fs.writeFileSync(path.join(out,'native-report.json'),JSON.stringify(report,null,2)+'\n');}
function errorInfo(error){return {code:String(error?.code||error?.name||'unknown'),message:String(error?.message||error),stack:String(error?.stack||'').slice(0,12000)};}
function convert(value){return convertValues(value,ms=>Timestamp.fromMillis(ms),()=>serverTimestamp());}
function ref(db,p){return doc(db,docPath(p));}
let number=0;
async function coverage(tag){
  // Only unexpected results request coverage; never buffer/dump hundreds of MB.
  const limit=1024*1024;
  try{
    const response=await fetch(`http://${HOST}:${PORT}/emulator/v1/projects/${PROJECT}:ruleCoverage`,{signal:AbortSignal.timeout(8000)});
    if(!response.ok)return {httpStatus:response.status,error:'Native coverage endpoint failed'};
    const reader=response.body.getReader(),chunks=[];let size=0,truncated=false;
    while(true){const {value,done}=await reader.read();if(done)break;
      const remaining=limit-size;
      if(value.length>remaining){chunks.push(Buffer.from(value.subarray(0,remaining)));size+=remaining;truncated=true;await reader.cancel();break;}
      chunks.push(Buffer.from(value));size+=value.length;
    }
    const file=`${tag}-coverage${truncated?'-TRUNCATED.txt':'.json'}`;
    fs.writeFileSync(path.join(out,file),Buffer.concat(chunks));
    return {httpStatus:response.status,file,bytes:size,truncated,note:truncated?'Bounded excerpt, NOT complete coverage JSON. See per-case nativeBudget matchingLines.':'Complete response'};
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
      batch.set(ref(db,`audit/${r._op}`),{recordId:`${c.day}__${c.workerId}`,date:c.day,before:c.priorAuditBefore?convert(c.priorAuditBefore):null,after:r,byUid:TABLET,event:r._event,createdAt:r._serverAt});
    }
    await batch.commit();
    // All special preconditions are confined to the disposable demo emulator.
    // They NEVER reset or edit the published launch-check records.
    const extra=writeBatch(db);let count=0;
    for(const [p,data] of Object.entries(c.seedOverrides||{})){extra.set(ref(db,p),convert(data),{merge:true});count++;}
    if(c.seedReusedCollection){
      const w=c.writes.find(w=>w.path.startsWith(c.seedReusedCollection+'/'));
      if(!w||!['audit','receipts'].includes(c.seedReusedCollection))throw Error('Invalid synthetic reused-document seed');
      extra.set(ref(db,w.path),convert(w.data));count++;
    }
    if(Number.isInteger(c.seedStateDays)){
      const day=new Date(Date.parse(c.day+'T12:00:00.000Z')+c.seedStateDays*86400000).toISOString().slice(0,10);
      extra.set(ref(db,`state/${c.workerId}`),{recordId:day+'__'+c.workerId,date:day,open:c.seedStateOpen,revision:123,op:'native-other-day-operation'});count++;
    }
    if(count)await extra.commit();
  });
}
async function submit(db,c,row){
  return runTransaction(db,async transaction=>{
    const snapshots={};row.stage='reading';
    for(const p of c.readPaths)snapshots[p]=await transaction.get(ref(db,p));
    const submitted=prepareTransactionWrites(c,snapshots,convert);
    row.stage='committing-'+submitted.length+'-document-write';
    row.submittedWriteCount=submitted.length;
    fs.writeFileSync(path.join(out,`${row.tag}-submitted.json`),JSON.stringify({rebasedAt:c.rebasedAt,writes:submitted},null,2));
    for(const w of submitted)transaction.set(ref(db,w.path),w.data);
  },{maxAttempts:1});
}
async function oneCase(label,rules,c0,expected,scope='full-rules',operation=null){
  const tag=String(++number).padStart(2,'0')+'-'+label.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  const row={tag,label,scope,expected,startedAt:new Date().toISOString(),stage:'initializing-emulator-rules',observed:'not-run'};
  report.cases.push(row);save();console.log(`\n===== ${tag} =====`);
  const nativeLogStart=logPosition();
  fs.writeFileSync(path.join(out,`${tag}.rules`),rules);
  let env;
  try{
    env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:HOST,port:PORT,rules}});
    const c=adjustRebasedCase(rebaseFixture(fixture,c0));row.stage='seeding-local-emulator';await seed(env,c);
    const db=env.authenticatedContext(TABLET).firestore();
    row.stage='executing-client-operation';
    try{
      await (operation?operation(db,c,env):submit(db,c,row));row.observed='allowed';
    }catch(e){
      row.error=errorInfo(e);row.observed=e.code==='permission-denied'?'denied':'error';
    }
    row.nativeBudget=await nativeBudgetEvidence(nativeLogStart);
    row.matchesIntended=scope==='full-rules'?acceptanceMatches(expected,row.observed,row.nativeBudget):null;
    if(scope==='full-rules'&&row.matchesIntended!==true)row.coverage=await coverage(tag);
    if(row.nativeBudget.budgetError)console.log('NATIVE BUDGET FAILURE — expected denial is NOT a passing security test.');
    if(!row.nativeBudget.complete)console.log('NATIVE EVIDENCE INCOMPLETE — result cannot count as verified.');
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
const fullPhaseLogStart=logPosition();
const watchdog=setTimeout(()=>{report.fatal='Diagnostic exceeded 15 minutes';save();process.exit(2);},15*60000);
try{
  // Preserve the five supplied transaction shapes and all 40 original full-rule
  // expectations. Apply the Patch 4 candidate; do not rerun the old candidate.
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
  // Original Patch 3 acceptance cases retain all expected allow/deny outcomes.
  for(const c of makeExtraCases(fixture))await oneCase(c.name,baseline,c,c.expected,'full-rules');
  for(const c of makePatch4Cases(fixture))await oneCase(c.name,baseline,c,c.expected,'full-rules');
  // Also catch any delayed native errors in gaps between individual case scans.
  report.fullRulePhaseBudget=await nativeBudgetEvidence(fullPhaseLogStart,16*1024*1024);save();
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
  report.fullRules.nativeBudgetFailures=full.filter(c=>c.nativeBudget?.budgetError).length;
  report.fullRules.incompleteNativeEvidence=full.filter(c=>!c.nativeBudget?.complete).length;
  report.harnessErrors=report.cases.filter(c=>c.observed==='harness-error'||c.observed==='error').length;
  report.nativeAcceptancePassed=!report.fatal&&!report.harnessErrors&&full.length===101&&report.fullRules.mismatchedOrError===0&&report.fullRulePhaseBudget?.complete===true&&report.fullRulePhaseBudget?.budgetError===false;
  save();
  const summary=['# Pioneer native rules diagnostic','',
    '**PATCH 4 CANDIDATE — EMULATOR ONLY. No deployment or activation. Budget-error denials do NOT pass.**','',
    '| Case | Scope | Intended | Observed | Native budget | Matched |','|---|---|---|---|---|---|',
    ...report.cases.map(c=>`| ${c.label} | ${c.scope} | ${c.expected} | ${c.observed} | ${c.nativeBudget?.budgetError?'LIMIT ERROR':c.nativeBudget?.complete?'No limit error':'Unverified'} | ${c.matchesIntended===true?'PASS':c.scope==='full-rules'?'FAIL':'diagnostic only'} |`),
    '',`Full-rule cases matching intended behavior: ${report.fullRules.matchedIntended}/${full.length}.`,
    `Native budget failures in full-rule cases: ${report.fullRules.nativeBudgetFailures}. Incomplete native evidence: ${report.fullRules.incompleteNativeEvidence}.`,
    `Full-rule phase log: ${report.fullRulePhaseBudget?.complete?'complete':'UNVERIFIED'}; budget error: ${report.fullRulePhaseBudget?.budgetError?'YES':'no detected error'}.`,
    `Native acceptance gate: ${report.nativeAcceptancePassed?'PASS':'FAIL / NOT VERIFIED'}. This is NOT production activation approval.`,
    '',report.fatal?'**Harness error:** '+JSON.stringify(report.fatal):"Open this run’s menu, download the log archive, and send it to the assistant.",
    '', 'The collected job logs contain native-report.json, per-case native budget evidence, bounded failing coverage excerpts, and bounded emulator logs. No billable artifact or cache is uploaded.',''].join('\n');
  fs.writeFileSync(path.join(out,'SUMMARY.md'),summary);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
  console.log(summary);
  if(!report.nativeAcceptancePassed)process.exitCode=2;
}
