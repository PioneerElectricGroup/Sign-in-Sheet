// Store the evidence in ordinary GitHub job logs, not billed artifact storage.
import fs from 'node:fs';
import path from 'node:path';
const dir='results';
if(!fs.existsSync(dir)){console.log('No results folder. Review earlier job steps. No production changes were made.');process.exit(0);}
const primary=['native-report.json','SUMMARY.md','dependency-versions.txt','NOT_FINISHED.txt'];
const coverage=fs.readdirSync(dir).filter(n=>/^\d+-.*-coverage\.json$/.test(n)).sort();
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
