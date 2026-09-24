// Bounded evidence in ordinary GitHub job logs. No billed artifact storage.
import fs from 'node:fs';import path from 'node:path';
const dir='results';
if(!fs.existsSync(dir)){console.log('No results folder. Review earlier steps. No production change.');process.exit(0);}
function printBounded(name,limit=256*1024){
  const file=path.join(dir,name);if(!fs.existsSync(file))return;
  const size=fs.statSync(file).size,fd=fs.openSync(file,'r');
  console.log(`\n========== BEGIN ${name} (${size} bytes) ==========`);
  try{
    if(size<=limit){const b=Buffer.alloc(size);fs.readSync(fd,b,0,size,0);console.log(b.toString('utf8'));}
    else {const half=Math.floor(limit/2),a=Buffer.alloc(half),b=Buffer.alloc(half);fs.readSync(fd,a,0,half,0);fs.readSync(fd,b,0,half,size-half);
      console.log(a.toString('utf8'));console.log(`\n[BOUNDED EXCERPT: ${size-2*half} bytes omitted; NOT a complete log/JSON file.]\n`);console.log(b.toString('utf8'));}
  }finally{fs.closeSync(fd);}
  console.log(`========== END ${name} ==========`);
}
for(const n of ['native-report.json','SUMMARY.md','dependency-versions.txt','NOT_FINISHED.txt'])printBounded(n,n==='native-report.json'?2*1024*1024:256*1024);
let report={};try{report=JSON.parse(fs.readFileSync(path.join(dir,'native-report.json'),'utf8'));}catch{}
const failed=(report.cases||[]).filter(c=>c.scope==='full-rules'&&c.matchesIntended!==true);
console.log(`Unexpected/unverified full-rule cases: ${failed.length}. Native budget-error excerpts are in native-report.json.`);
for(const c of failed.slice(0,5)){printBounded(`${c.tag}-submitted.json`,256*1024);if(c.coverage?.file)printBounded(c.coverage.file,64*1024);}
if(failed.length>5)console.log('Additional cases remain fully listed in native-report.json; duplicate coverage printing capped.');
printBounded('firestore-debug.log',384*1024);
console.log('COLLECTION FINISHED. No deployment or activation.');
