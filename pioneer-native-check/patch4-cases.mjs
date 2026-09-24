// Additional SYNTHETIC native-engine regressions. No production credentials/data.
import {clone} from './support.mjs';
import {makeExtraCases,punchOf} from './patch3-cases.mjs';
export function makePatch4Cases(f) {
  const prior=makeExtraCases(f), cases=[]; let serial=0;
  const from=name=>clone([...f.cases,...prior].find(c=>c.name===name));
  function add(name,expected,base='hourly-second-arrival',edit=()=>{}) {
    const c=from(base); if(!c) throw Error(`Missing control fixture ${base}`);
    c.name=name;c.expected=expected;c.sourceObserved='not-previously-run';
    const r=punchOf(c);r._op='native-patch4-'+String(++serial).padStart(4,'0');
    edit(c,r);
    const id=r.date+'__'+r.workerId;
    c.readPaths=['receipts/'+r._op,'punches/'+id,'roster/'+r.workerId,'state/'+r.workerId];
    if(r._event==='worker_out'&&!r.noHours&&r.code==='1000')c.readPaths.push('codes/1000');
    c.writes=[
      {kind:'set',path:'punches/'+id,data:r},
      {kind:'set',path:'audit/'+r._op,data:{recordId:id,date:r.date,before:clone(c.before),after:clone(r),byUid:r._writer,event:r._event,createdAt:{__serverTimestamp:true}}},
      {kind:'set',path:'state/'+r.workerId,data:{recordId:id,date:r.date,open:r.segmentCount>0&&r.outLocal===null&&!r.voided,revision:r._rev,op:r._op}},
      {kind:'set',path:'receipts/'+r._op,data:{op:r._op,uid:r._writer,deviceId:r._deviceId,recordId:id,capturedMs:r._capturedMs,revision:r._rev,receivedAt:{__serverTimestamp:true}}}
    ];
    cases.push(c);return c;
  }
  for(const base of ['hourly-arrival','hourly-second-arrival','hourly-departure','undo-first-arrival','undo-signed-departure']) {
    for(const collection of ['audit','receipts'])
      add(`${base}-missing-${collection}`,'deny',base,c=>{c.omitWrites=[collection];});
  }
  for(const collection of ['punches','state'])
    add(`reentry-missing-${collection}`,'deny','hourly-second-arrival',c=>{c.omitWrites=[collection];});

  const mutation=(collection,field,value)=>c=>{c.alterWrites=[{collection,field,value}];};
  for(const [field,value] of [['recordId','__permission_probe'],['date','1900-01-01'],['byUid','native-unapproved-person'],['event','office'],['before',null],['after.approved',true],['after._rev',999],['createdAt',null]])
    add(`reentry-audit-tamper-${field.replaceAll('.','-')}`,'deny','hourly-second-arrival',mutation('audit',field,value));
  for(const [field,value] of [['recordId','__permission_probe'],['op','native-wrong-operation'],['uid','native-unapproved-person'],['capturedMs',0],['revision',999],['deviceId','native-wrong-device'],['receivedAt',null],['extraField',true]])
    add(`reentry-receipt-tamper-${field}`,'deny','hourly-second-arrival',mutation('receipts',field,value));
  for(const [field,value] of [['recordId','__permission_probe'],['date','1900-01-01'],['op','native-wrong-operation'],['revision',999],['open',false]])
    add(`reentry-state-tamper-${field}`,'deny','hourly-second-arrival',mutation('state',field,value));
  for(const collection of ['audit','receipts']) {
    add(`reentry-stale-${collection}-cannot-substitute-for-new-write`,'deny','hourly-second-arrival',c=>{c.seedReusedCollection=collection;c.omitWrites=[collection];});
    add(`reentry-existing-${collection}-cannot-be-overwritten`,'deny','hourly-second-arrival',c=>{c.seedReusedCollection=collection;});
  }
  add('reentry-blank-arrival-signature','deny','hourly-second-arrival',(_c,r)=>{r.segments.s1.sigIn.strokes=[];});
  add('reentry-missing-arrival-signature','deny','hourly-second-arrival',(_c,r)=>{delete r.segments.s1.sigIn;});
  add('reentry-signature-time-mismatch','deny','hourly-second-arrival',(_c,r)=>{r.segments.s1.sigIn.at='1900-01-01T00:00:00.000Z';});
  add('reentry-cannot-rewrite-prior-signature','deny','hourly-second-arrival',(_c,r)=>{r.segments.s0.sigIn.strokes=[];});
  add('reentry-cannot-rewrite-prior-departure','deny','hourly-second-arrival',(_c,r)=>{r.segments.s0.out='00:00';});
  add('reentry-cannot-change-daily-code','deny','hourly-second-arrival',(_c,r)=>{r.code=null;});
  add('reentry-wrong-revision','deny','hourly-second-arrival',(_c,r)=>{r._rev++;});
  add('reentry-before-prior-departure','deny','hourly-second-arrival',(c,r)=>{c.before.segments.s0.outMs=r._capturedMs+1000;r.segments.s0.outMs=r._capturedMs+1000;});
  add('reentry-cannot-retain-approval-author','deny','approved-record-reentry-invalidates-approval',(_c,r)=>{r.approvedBy='native-test-manager';});
  add('reentry-inactive-worker','deny','hourly-second-arrival',c=>{c.seedOverrides={'roster/check-hourly':{active:false}};});
  add('reentry-pay-type-no-longer-matches','deny','hourly-second-arrival',c=>{c.seedOverrides={'roster/check-hourly':{noHours:true}};});
  add('reentry-disabled-site','deny','hourly-second-arrival',c=>{c.seedOverrides={'config/setup':{enabled:false}};});
  add('reentry-prior-day-still-open','deny','hourly-second-arrival',c=>{c.seedStateDays=-1;c.seedStateOpen=true;});
  add('reentry-cannot-roll-head-back-from-later-day','deny','hourly-second-arrival',c=>{c.seedStateDays=1;c.seedStateOpen=false;});

  add('hourly-repeat-sign-in-six-days-offline','allow','hourly-second-arrival',(c,r)=>{r._captureMode='offline';c.captureShiftMs=-6*86400000;});
  add('salary-repeat-sign-in-six-days-offline','allow','salary-second-arrival',(c,r)=>{r._captureMode='offline';c.captureShiftMs=-6*86400000;});
  add('repeat-sign-in-eight-day-capture-rejected','deny','hourly-second-arrival',c=>{c.captureShiftMs=-8*86400000;});
  add('repeat-sign-in-future-capture-rejected','deny','hourly-second-arrival',c=>{c.captureShiftMs=6*60000;});
  add('repeat-sign-in-future-upload-rejected','deny','hourly-second-arrival',c=>{c.clientMsShiftMs=6*60000;});
  add('repeat-sign-in-stale-upload-rejected','deny','hourly-second-arrival',c=>{c.clientMsShiftMs=-6*60000;});
  // Special captures near local midnight remain within the permitted age window.
  // Recompute ALL local time strings after rebasing; do not reuse one minute's text.
  for(const pay of ['hourly','salary']) for(const offset of [-240,-300])
    add(`${pay}-reentry-local-midnight-offset-${Math.abs(offset)}`,'allow',`${pay}-second-arrival`,c=>{c.localMidnightOffset=offset;});
  return cases;
}
// Pure transformations, run BEFORE seeding/committing. Keep numeric/ISO/local
// captures and receipt/audit links consistent for delayed and midnight controls.
export function adjustRebasedCase(sourceCase,now=Date.now()) {
  let c=clone(sourceCase),shift=c.captureShiftMs||0;
  if(c.localMidnightOffset!==undefined) {
    const old=punchOf(c),offset=c.localMidnightOffset;
    const today=new Date(now+offset*60000).toISOString().slice(0,10);
    const yesterday=new Date(Date.parse(today+'T12:00:00.000Z')-86400000).toISOString().slice(0,10);
    const target=Date.parse(yesterday+'T00:01:20.000Z')-offset*60000;
    shift=target-old._capturedMs;
  }
  if(!shift&&c.localMidnightOffset===undefined)return c;
  const originalDay=c.day;
  const offset=c.localMidnightOffset??punchOf(c)._offset;
  const localStamp=new Date(punchOf(c)._capturedMs+shift+offset*60000).toISOString();
  const day=localStamp.slice(0,10),hm=localStamp.slice(11,16);
  function walk(v,k='') {
    if(typeof v==='number'&&v>1e12)return v+shift;
    if(typeof v==='string') {
      if(v===sourceCase.hm)return hm;
      if(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v))return new Date(Date.parse(v)+shift).toISOString();
      return v.replaceAll(originalDay,day);
    }
    if(Array.isArray(v))return v.map(x=>walk(x));
    if(v&&typeof v==='object') {
      const o=Object.fromEntries(Object.entries(v).map(([key,value])=>[key,walk(value,key)]));
      if('inMs' in o){o.in=new Date(o.inMs+offset*60000).toISOString().slice(11,16);if(o.outMs!=null)o.out=new Date(o.outMs+offset*60000).toISOString().slice(11,16);}
      if('segments' in o&&'segmentCount' in o){o._offset=offset;const a=o.segments.s0,b=o.segments['s'+(o.segmentCount-1)];o.inLocal=a?.in??null;o.outLocal=b?.out??null;}
      return o;
    }
    return v;
  }
  c=walk(c);c.day=day;c.adjustedCaptureShiftMs=shift;
  // Preserve the source test controls themselves, not shifted timestamps.
  c.captureShiftMs=sourceCase.captureShiftMs;
  return c;
}
