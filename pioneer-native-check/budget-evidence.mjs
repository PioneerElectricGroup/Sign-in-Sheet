// Read-only native-emulator evidence; bounded to avoid giant duplicate log dumps.
import fs from 'node:fs';
export const BUDGET_PATTERN=/maximum of\s+1,?000\s+expressions|maximum[^\n]{0,100}expressions[^\n]{0,100}reached|too many[^\n]{0,50}(?:get|exists|access)\s*(?:\(\))?\s*calls|(?:document access|access call)[^\n]{0,100}(?:exceeded|limit reached)/i;
export function logPosition(file='firestore-debug.log') {
  try{return {file,exists:true,size:fs.statSync(file).size};}
  catch{return {file,exists:false,size:0};}
}
export function readBudgetEvidence(start,maxBytes=1024*1024) {
  const end=logPosition(start.file);
  if(!end.exists)return {complete:false,reason:'Native firestore-debug.log missing; budget evidence not established.',budgetError:false};
  const offset=start.exists?start.size:0;
  if(end.size<offset)return {complete:false,reason:'Native log rotated inside case.',budgetError:false};
  const bytes=end.size-offset,readBytes=Math.min(bytes,maxBytes),fd=fs.openSync(end.file,'r');
  let text;try{const buf=Buffer.alloc(readBytes);fs.readSync(fd,buf,0,readBytes,offset);text=buf.toString('utf8');}finally{fs.closeSync(fd);}
  const matches=text.split(/\r?\n/).filter(line=>BUDGET_PATTERN.test(line));
  return {file:end.file,startByte:offset,endByte:end.size,bytes,complete:bytes<=maxBytes,
    ...(bytes>maxBytes?{reason:'Per-case log exceeds bounded scan; cannot count this result as verified.'}:{}),
    budgetError:matches.length>0,matchingLines:matches.slice(0,6).map(line=>line.slice(0,1600))};
}
export async function nativeBudgetEvidence(start,maxBytes=1024*1024) {
  // Google emulator writes error details asynchronously. Cases are serialized;
  // retain their own byte ranges and briefly allow log output to settle.
  await new Promise(resolve=>setTimeout(resolve,160));
  return readBudgetEvidence(start,maxBytes);
}
export function acceptanceMatches(expected,observed,evidence) {
  return (expected==='allow'?observed==='allowed':expected==='deny'?observed==='denied':false)
    && evidence?.complete===true && evidence?.budgetError===false;
}
