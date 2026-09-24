// Synthetic regression fixtures only. No credentials, network or live records.
import {clone} from './support.mjs';
export const punchOf=c=>c.writes.find(w=>w.path.startsWith('punches/')).data;
const snap=r=>({...clone(r),_serverAt:{__timestampMillis:r._clientMs}});
function blocksOf(r,through=r.segmentCount){return Array.from({length:through},(_,i)=>({__pegArray:[r.segments['s'+i].in,r.segments['s'+i].out]}));}
function closeSegment(inMs,outMs,hm,code){const sig=signature(outMs);sig.for={blocks:[],code};return {in:hm,inAt:stamp(inMs),inMs,out:hm,outAt:stamp(outMs),outMs,sigIn:signature(inMs),sigOut:sig};}
const stamp=ms=>new Date(ms).toISOString();
function metadata(r,ms,op,event,rev){Object.assign(r,{_capturedMs:ms,_clientMs:ms,_op:op,_event:event,_rev:rev,updatedAt:stamp(ms),_serverAt:{__serverTimestamp:true}});}
function signature(ms){return {at:stamp(ms),w:400,h:160,strokes:[{__pegArray:[10,10,120,80,240,20]}]};}
function summarize(r){const a=r.segments.s0,b=r.segments['s'+(r.segmentCount-1)];Object.assign(r,{inLocal:a?a.in:null,inAt:a?a.inAt:null,outLocal:b?b.out:null,outAt:b?b.outAt:null});}
function relink(c){
 const r=punchOf(c),id=r.date+'__'+r.workerId;
 c.readPaths=['receipts/'+r._op,'punches/'+id,'roster/'+r.workerId,'state/'+r.workerId];
 if(r._event==='worker_out'&&!r.noHours&&typeof r.code==='string'&&r.code==='1000')c.readPaths.push('codes/1000');
 c.writes=[{kind:'set',path:'punches/'+id,data:r},
 {kind:'set',path:'audit/'+r._op,data:{recordId:id,date:r.date,before:clone(c.before),after:clone(r),byUid:r._writer,event:r._event,createdAt:{__serverTimestamp:true}}},
 {kind:'set',path:'state/'+r.workerId,data:{recordId:id,date:r.date,open:r.segmentCount>0&&r.outLocal===null&&!r.voided,revision:r._rev,op:r._op}},
 {kind:'set',path:'receipts/'+r._op,data:{op:r._op,uid:r._writer,deviceId:r._deviceId,recordId:id,capturedMs:r._capturedMs,revision:r._rev,receivedAt:{__serverTimestamp:true}}}];
 return c;
}
export function makeExtraCases(f){
 const named=n=>clone(f.cases.find(c=>c.name===n)),out=[];
 let serial=100;
 function add(name,expected,c,change){c.name=name;c.expected=expected;c.sourceObserved='not-previously-run';change?.(c,punchOf(c));punchOf(c)._op='native-patch3-'+(++serial);out.push(relink(c));return c;}
 for(const pay of ['hourly','salary']){
  add(pay+'-offline-marked-departure','allow',named(pay+'-departure'),(_c,r)=>{r._captureMode='offline';});
  add(pay+'-explicit-review-false','allow',named(pay+'-departure'),(c,r)=>{c.before.reviewRequired=false;r.reviewRequired=false;});
 }
 const h=named('hourly-departure');
 add('departure-code-is-required','deny',clone(h),(_c,r)=>{r.code=null;r.segments.s0.sigOut.for.code=null;});
 add('departure-signature-code-mismatch','deny',clone(h),(_c,r)=>{r.segments.s0.sigOut.for.code=null;});
 add('departure-cannot-alter-arrival-time','deny',clone(h),(_c,r)=>{r.segments.s0.in='01:00';r.inLocal='01:00';});
 add('departure-cannot-alter-arrival-signature','deny',clone(h),(_c,r)=>{r.segments.s0.sigIn.strokes=[{__pegArray:[30,30,100,100]}];});
 add('departure-cannot-set-approval','deny',clone(h),(_c,r)=>{r.approved=true;});
 add('departure-wrong-revision','deny',clone(h),(_c,r)=>{r._rev+=1;});
 add('departure-rejects-wrong-ISO-time','deny',clone(h),(_c,r)=>{r.updatedAt=stamp(r._capturedMs+1);});
 add('departure-rejects-unknown-event','deny',clone(h),(_c,r)=>{r._event='office';});
 for(const n of [2,40]){
  const c=clone(h),r=punchOf(c),open=clone(c.before.segments.s0),closed=clone(r.segments.s0);
  c.before.segments={};r.segments={};
  for(let i=0;i<n;i++){const past=closeSegment(open.inMs-2*(n-i),open.inMs-2*(n-i)+1,f.originalLocalTime,'1000');c.before.segments['s'+i]=clone(i===n-1?open:past);r.segments['s'+i]=clone(i===n-1?closed:past);}
  c.before.segmentCount=r.segmentCount=n;c.before._rev=2*n-1;r._rev=2*n;
  for(let i=0;i<n;i++){const blocks=blocksOf(r,i+1);r.segments['s'+i].sigOut.for.blocks=clone(blocks);if(i<n-1)c.before.segments['s'+i].sigOut.for.blocks=clone(blocks);}
  summarize(c.before);summarize(r);
  add('departure-'+n+'-blocks','allow',c);
  if(n===2)add('departure-cannot-rewrite-earlier-block','deny',clone(c),(_c,p)=>{p.segments.s0.out='00:00';});
 }
 function reentry(pay,count){
  const c=named(pay+'-departure'),r=punchOf(c),before=snap(r),closed=clone(before.segments.s0);before.segments={};
  for(let i=0;i<count;i++)before.segments['s'+i]=closeSegment(closed.outMs-2*(count-i)+1,closed.outMs-2*(count-i)+2,f.originalLocalTime,before.code);
  before.segmentCount=count;before._rev=2*count;for(let i=0;i<count;i++)before.segments['s'+i].sigOut.for.blocks=blocksOf(before,i+1);summarize(before);c.before=before;
  const ms=r._capturedMs+1500;
  r.segments=clone(before.segments);r.segments['s'+count]={in:f.originalLocalTime,inAt:stamp(ms),inMs:ms,out:null,outAt:null,sigIn:signature(ms)};
  r.segmentCount=count+1;metadata(r,ms,'native-patch3-reentry','worker_in',before._rev+1);summarize(r);return c;
 }
 add('hourly-second-arrival','allow',reentry('hourly',1));
 add('salary-second-arrival','allow',reentry('salary',1));
 add('hourly-fortieth-arrival','allow',reentry('hourly',39));
 add('hourly-forty-first-arrival-denied','deny',reentry('hourly',40));
 add('approved-record-reentry-invalidates-approval','allow',reentry('hourly',1),(c,r)=>{c.before.approved=true;c.before.approvedBy='native-test-manager';c.before.approvedAt=c.before.updatedAt;r.reviewRequired=true;r.approved=false;});
 add('approved-record-reentry-must-require-review','deny',reentry('hourly',1),(c,r)=>{c.before.approved=true;delete r.reviewRequired;});
 const undoIn=named('hourly-arrival');undoIn.before=snap(punchOf(undoIn));
 add('undo-first-arrival','allow',undoIn,(c,r)=>{metadata(r,r._capturedMs+1500,'native-patch3-undo-in','undo',c.before._rev+1);r.segments={};r.segmentCount=0;r.voided=true;r.code=null;r.note='';summarize(r);});
 const undoOut=named('hourly-departure'),previous=clone(undoOut.before),closed=snap(punchOf(undoOut));
 undoOut.before=closed;undoOut.priorAuditBefore=previous;undoOut.writes[0].data=clone(previous);
 add('undo-signed-departure','allow',undoOut,(c,r)=>{metadata(r,closed._capturedMs+1500,'native-patch3-undo-out','undo',closed._rev+1);});
 const afterUndo=reentry('hourly',1),prior=clone(out.find(c=>c.name==='undo-first-arrival'));afterUndo.before=snap(punchOf(prior));
 add('reentry-after-undone-first-arrival','allow',afterUndo,(c,r)=>{
  const ms=r._capturedMs;
  r.segments={s0:{in:f.originalLocalTime,inAt:stamp(ms),inMs:ms,out:null,outAt:null,sigIn:signature(ms)}};
  r.segmentCount=1;r.code=null;r.note='';delete r.voided;r._rev=c.before._rev+1;summarize(r);
 });
 return out;
}
