// Store the evidence in ordinary GitHub job logs, not billed artifact storage.
import fs from 'node:fs';
import path from 'node:path';
const dir='results';
if(!fs.existsSync(dir)){console.log('No results folder. Review earlier job steps. No production changes were made.');process.exit(0);}
const primary=['native-report.json','SUMMARY.md','dependency-versions.txt','NOT_FINISHED.txt'];
let report={};try{report=JSON.parse(fs.readFileSync(path.join(dir,'native-report.json'),'utf8'));}catch{}
// Preserve complete failed native coverage, without printing hundreds of MB of passing data.
const failed=(report.cases||[]).filter(c=>c.scope==='full-rules'&&c.matchesIntended!==true);
const coverage=failed.map(c=>c.coverage?.file).filter(Boolean);
console.log('Full rule coverage included for failing acceptance cases: '+coverage.length);
for(const name of [...primary,...coverage,'firestore-debug.log']){
 const file=path.join(dir,name);if(!fs.existsSync(file))continue;
 let text=fs.readFileSync(file,'utf8');
 if(name.endsWith('.json'))try{text=JSON.stringify(JSON.parse(text),null,2);}catch{}
 console.log(`\n========== BEGIN ${name} ==========\n`);
 // Do not truncate error evidence; splitting lines avoids one giant log record.
 for(const line of text.split('\n'))console.log(line);
 console.log(`\n========== END ${name} ==========\n`);
}
console.log('DIAGNOSTIC COLLECTION FINISHED. No deployment or activation occurred.');
