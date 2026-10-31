// SPDX-License-Identifier: GPL-3.0-only
// Fail-closed release readiness assessment. Never infer permission or real-device success.
export function assessRelease({sources,approvals,summary,validation,deviceEvidence=[]}){
 const blockers=[];
 if(!validation?.valid||validation.errors?.length||validation.warnings?.length)blockers.push('selector-validation-not-clean');
 if(sources.some(s=>s.status!=='analyzed'||!/^[a-f0-9]{40}$/.test(s.commit??'')||!/^[a-f0-9]{64}$/.test(s.sha256??'')))blockers.push('upstream-provenance-incomplete');
 const sourceApproved=new Set((approvals.approvedSources??[]).filter(a=>a.reviewed===true&&a.redistributionApproved===true&&/^https:\/\//.test(a.evidenceUrl??'')).map(a=>a.id));
 const approvedGroups=(approvals.approvedGroups??[]).filter(a=>a.reviewed===true&&a.runtimeTested===true&&/^[a-f0-9]{64}$/.test(a.signature??'')&&typeof a.appId==='string');
 const sourceMissing=sources.filter(s=>!sourceApproved.has(s.source));
 if(sourceMissing.length)blockers.push('redistribution-permission-missing');
 if((summary.publishableCandidates??0)===0)blockers.push('no-publishable-candidates');
 if(approvedGroups.length===0)blockers.push('no-reviewed-and-runtime-tested-groups');
 // A checked flag is not evidence: require per-app test case artifacts with passing positive and negative tests.
 const tested=new Set(deviceEvidence.filter(e=>e.deviceId&&e.appId&&e.signature&&e.appVersion&&e.gkdVersion&&e.positivePass===true&&e.negativePass===true&&e.evidenceUrl?.startsWith('https://')).map(e=>e.appId+'|'+e.signature));
 if(approvedGroups.some(g=>!tested.has(g.appId+'|'+g.signature)))blockers.push('device-test-evidence-missing');
 if(approvedGroups.length&&!deviceEvidence.length)blockers.push('device-test-evidence-missing');
 return {ready:blockers.length===0,blockers:[...new Set(blockers)],sourceMissing:sourceMissing.map(s=>s.source),approvedGroups:approvedGroups.length,verifiedDeviceGroups:tested.size};
}
