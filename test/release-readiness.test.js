import test from 'node:test';
import assert from 'node:assert/strict';
import {assessRelease} from '../src/release-readiness.js';
const source={source:'upstream',status:'analyzed',commit:'a'.repeat(40),sha256:'b'.repeat(64)};
const approval={schemaVersion:1,approvedSources:[{id:'upstream',reviewed:true,redistributionApproved:true,evidenceUrl:'https://example.org/permission',commit:'a'.repeat(40),sha256:'b'.repeat(64)}],approvedGroups:[{appId:'com.example',signature:'c'.repeat(64),reviewed:true,runtimeTested:true}]};
const device={deviceId:'test-phone',appId:'com.example',signature:'c'.repeat(64),appVersion:'1.0',gkdVersion:'1.0',positivePass:true,negativePass:true,evidenceUrl:'https://example.org/test',sourceCommit:'a'.repeat(40),sourceFileSha256:'b'.repeat(64)};
const valid={valid:true,errors:[],warnings:[]};
const candidates=[{appId:'com.example',signature:'c'.repeat(64),sources:[{source:'upstream'}]}];
const summary={publishableCandidates:1};
test('complete evidence can pass readiness assessment',()=>assert.equal(assessRelease({sources:[source],approvals:approval,summary,validation:valid,candidates,deviceEvidence:[device]}).ready,true));
test('missing permission fails closed',()=>assert.ok(assessRelease({sources:[source],approvals:{...approval,approvedSources:[]},summary,validation:valid,candidates,deviceEvidence:[device]}).blockers.includes('redistribution-permission-missing')));
test('missing negative device test fails closed',()=>assert.ok(assessRelease({sources:[source],approvals:approval,summary,validation:valid,candidates,deviceEvidence:[{...device,negativePass:false}]}).blockers.includes('device-test-evidence-missing')));
test('missing pinned upstream commit fails closed',()=>assert.ok(assessRelease({sources:[{...source,commit:null}],approvals:approval,summary,validation:valid,candidates,deviceEvidence:[device]}).blockers.includes('upstream-provenance-incomplete')));
test('selector warnings block release',()=>assert.ok(assessRelease({sources:[source],approvals:approval,summary,candidates,validation:{...valid,warnings:[{code:'test'}]},deviceEvidence:[device]}).blockers.includes('selector-validation-not-clean')));
test('zero publishable groups cannot pass',()=>assert.ok(assessRelease({sources:[source],approvals:approval,summary:{publishableCandidates:0},validation:valid,candidates,deviceEvidence:[device]}).blockers.includes('no-publishable-candidates')));

test('stale upstream source approval blocks release',()=>assert.ok(assessRelease({sources:[source],approvals:{...approval,approvedSources:[{...approval.approvedSources[0],commit:'f'.repeat(40)}]},summary,validation:valid,candidates,deviceEvidence:[device]}).blockers.includes('source-approval-not-pinned-to-current-content')));
test('approval for nonexistent candidate blocks release',()=>assert.ok(assessRelease({sources:[source],approvals:approval,summary,validation:valid,candidates:[],deviceEvidence:[device]}).blockers.includes('approved-group-not-found-in-candidate-review')));
test('device evidence must match pinned source content',()=>assert.ok(assessRelease({sources:[source],approvals:approval,summary,validation:valid,candidates,deviceEvidence:[{...device,sourceFileSha256:'f'.repeat(64)}]}).blockers.includes('device-test-evidence-missing')));
