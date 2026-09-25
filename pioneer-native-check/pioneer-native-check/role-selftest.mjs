// Role-cutover source/harness checks only. Google's native engine is not run here.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {TABLET,MANAGER,MANAGER_JAKE,MANAGER_ERIC,MANAGERS} from './support.mjs';
const rules=fs.readFileSync('emulator-only.rules','utf8'),run=fs.readFileSync('run.mjs','utf8'),fixture=JSON.parse(fs.readFileSync('fixtures.json','utf8')),proof=JSON.parse(fs.readFileSync('role-source-proof.json','utf8')),tests=[];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');function test(name,fn){fn();tests.push({name,result:'pass'});}
test('candidate hash matches role proof and fixture',()=>{assert.equal(hash(rules),proof.candidateRulesSha256);assert.equal(hash(rules),fixture.sourceRulesSha256);});
test('role-only normalization recovers exact accepted Patch 4 source',()=>assert.equal(hash(rules.replace(proof.addedComment,'').replace(proof.roleAfter,proof.roleBefore)),proof.basePatch4RulesSha256));
test('three fictional managers and one separate field kiosk',()=>{assert.deepEqual(MANAGERS,[MANAGER,MANAGER_JAKE,MANAGER_ERIC]);for(const manager of MANAGERS)assert.notEqual(TABLET,manager);for(const uid of [TABLET,...MANAGERS])assert.ok(rules.includes(uid));});
test('field kiosk is the fixture writer',()=>assert.ok(fixture.cases.every(c=>c.writes.find(w=>w.path.startsWith('punches/')).data._writer===TABLET)));
test('eleven explicit role regressions added',()=>{for(const label of ['field-kiosk-read-roster','isaac-manager-read-private-pin','jake-manager-read-private-pin','isaac-manager-add-crew','jake-manager-add-crew','jake-manager-remove-crew','jake-manager-approve-record','eric-manager-read-private-pin','eric-manager-add-crew','eric-manager-remove-crew','eric-manager-approve-record'])assert.ok(run.includes(label));});
test('native gate requires 112 full-rule outcomes',()=>assert.ok(run.includes('full.length===112')));
test('no real production UID in emulator files',()=>{for(const uid of Object.values(proof.productionRoles).flat())assert.ok(!rules.includes(uid));});
console.log(JSON.stringify({kind:'role-cutover-source-harness-checks-NOT-native',nativeFirestoreExecuted:false,passed:tests.length,failed:0,fullRuleCasesPrepared:112,tests},null,2));
