// SPDX-License-Identifier: GPL-3.0-only
// Fail-closed release readiness assessment. Never infer permission or real-device success.
export function assessRelease({sources,approvals,summary,validation,deviceEvidence=[],candidates=[]}){
 const blockers=[];
 if(!validation?.valid||validation.errors?.length||validation.warnings?.length)blockers.push('selector-validation-not-clean');
 if(sources.some(s=>s.status!=='analyzed'||!/^[a-f0-9]{40}$/.test(s.commit??'')||!/^[a-f0-9]{64}$/.test(s.sha256??'')))blockers.push('upstream-provenance-incomplete');
 const sourceById=new Map(sources.map(s=>[s.source,s]));
 const candidateByKey=new Map(candidates.map(c=>[c.appId+'|'+c.signature,c]));
 const sourceApproved=new Set((approvals.approvedSources??[]).filter(a=>a.reviewed===true&&a.redistributionApproved===true&&/^https:\/\//.test(a.evidenceUrl??'')).map(a=>a.id));
 const approvedGroups=(approvals.approvedGroups??[]).filter(a=>a.reviewed===true&&a.runtimeTested===true&&/^[a-f0-9]{64}$/.test(a.signature??'')&&typeof a.appId==='string');
 const sourceMissing=sources.filter(s=>!sourceApproved.has(s.source));
 const staleSourceApprovals=(approvals.approvedSources??[]).filter(a=>sourceApproved.has(a.id)&&(!sourceById.has(a.id)||a.commit!==sourceById.get(a.id).commit||a.sha256!==sourceById.get(a.id).sha256));
 if(staleSourceApprovals.length)blockers.push('source-approval-not-pinned-to-current-content');
 if(sourceMissing.length)blockers.push('redistribution-permission-missing');
 if((summary.publishableCandidates??0)===0)blockers.push('no-publishable-candidates');
 const missingCandidateApprovals=approvedGroups.filter(g=>!candidateByKey.has(g.appId+'|'+g.signature));
 if(missingCandidateApprovals.length)blockers.push('approved-group-not-found-in-candidate-review');
 const unauthorizedGroupApprovals=approvedGroups.filter(g=>{
   const candidate=candidateByKey.get(g.appId+'|'+g.signature);
   return candidate&&!candidate.sources?.some(s=>sourceApproved.has(s.source)&&!staleSourceApprovals.some(a=>a.id===s.source));
 });
 if(unauthorizedGroupApprovals.length)blockers.push('approved-group-has-no-current-authorized-source');
 if(approvedGroups.length===0)blockers.push('no-reviewed-and-runtime-tested-groups');
 // A checked flag is not evidence: require per-app test case artifacts with passing positive and negative tests.
 const tested=new Set(deviceEvidence.filter(e=>e.deviceId&&e.appId&&e.signature&&e.appVersion&&e.gkdVersion&&e.positivePass===true&&e.negativePass===true&&e.evidenceUrl?.startsWith('https://')&&e.sourceCommit&&e.sourceFileSha256&&candidates.some(c=>c.appId===e.appId&&c.signature===e.signature&&c.sources?.some(s=>sourceById.get(s.source)?.commit===e.sourceCommit&&sourceById.get(s.source)?.sha256===e.sourceFileSha256))).map(e=>e.appId+'|'+e.signature));
 if(approvedGroups.some(g=>!tested.has(g.appId+'|'+g.signature)))blockers.push('device-test-evidence-missing');
 if(approvedGroups.length&&!deviceEvidence.length)blockers.push('device-test-evidence-missing');
 return {ready:blockers.length===0,blockers:[...new Set(blockers)],sourceMissing:sourceMissing.map(s=>s.source),approvedGroups:approvedGroups.length,verifiedDeviceGroups:tested.size};
}
