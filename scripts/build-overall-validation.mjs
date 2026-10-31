// SPDX-License-Identifier: GPL-3.0-only
// Evidence-based publication gate and overall staging validation report.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {assessRelease} from '../src/release-readiness.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const review=read('reports/staging/review.json');
const validation=read('reports/staging/validation.json');
const licenses=read('reports/staging/license-evidence.json');
const licenseProvenanceMismatch=review.sources.filter(s=>{const l=licenses.sources.find(x=>x.id===s.source);return !l||l.commit!==s.commit||l.subscriptionSha256!==s.sha256||l.status!=='evidence-collected';}).map(s=>s.source);
const approvals=read('config/staging-approvals.json');
const releasePolicy=read('config/release-policy.json');
const preview=fs.readFileSync('reports/staging/gkd-preview.json5');
const digest=crypto.createHash('sha256').update(preview).digest('hex');
const sources=review.sources.map(s=>({id:s.source,status:s.status,commit:s.commit??null,sha256:s.sha256??null,license:s.declaredLicense,redistributionApproved:approvals.approvedSources.some(a=>a.id===s.source&&a.reviewed===true&&a.redistributionApproved===true)}));
const findings={
  candidateSources:sources.length,
  candidateSourceErrors:sources.filter(s=>s.status!=='analyzed').length,
  unapprovedSources:sources.filter(s=>!s.redistributionApproved).map(s=>s.id),
  licenseProvenanceMismatch,
  dependencyRiskCandidates:review.summary.dependencyRiskCandidates,
  genericSelectorRiskCandidates:review.summary.genericSelectorRiskCandidates,
  broadWithoutContextGuard:review.summary.broadWithoutContextGuard,
  cleanStaticCandidates:review.summary.cleanStaticCandidates,
  publishableCandidates:review.summary.publishableCandidates,
};
const deviceEvidence=fs.existsSync('config/device-test-evidence.json')?read('config/device-test-evidence.json').tests??[]:[];
const readiness=assessRelease({sources:review.sources,approvals,summary:review.summary,validation,deviceEvidence,candidates:review.deduplicatedReview,skipDeviceTests:releasePolicy.skipDeviceTests===true});
if(licenseProvenanceMismatch.length){readiness.ready=false;readiness.blockers.push('license-evidence-provenance-mismatch');}
const report={schemaVersion:2,publicationDecision:readiness.ready?'READY_FOR_FINAL_HUMAN_REVIEW':'BLOCK_NEW_CANDIDATE_MERGE',readiness,reason:readiness.blockers.join(', ')||'All automated gates passed; final human review required',baselinePreview:{sha256:digest,bytes:preview.length,source:'existing approved dist/gkd.json5'},findings,sources,selectorValidation:validation,licenseEvidencePresent:Boolean(licenses),deviceTesting:readiness.deviceTesting,runtimeTestedNewCandidates:0};
fs.writeFileSync('reports/staging/overall-validation.json',JSON.stringify(report,null,2)+'\n');
const md=['# Overall subscription validation report','','**Publication decision: '+report.publicationDecision+'**','','The preview remains the existing authorized baseline; it is not a newly fused subscription.','','## Release blockers','',...(readiness.blockers.length?readiness.blockers.map(b=>'- '+b):['- No automated blockers; final human review remains required']),'','## Counts','','| Metric | Value |','|---|---:|',...Object.entries(findings).map(([k,v])=>'| '+k+' | '+(Array.isArray(v)?v.length:v)+' |'),'','## Upstream provenance','','| Source | Commit | Content SHA256 | Approved |','|---|---|---|---|',...sources.map(s=>'| '+s.id+' | '+(s.commit??'unavailable')+' | '+(s.sha256??'unavailable')+' | '+(s.redistributionApproved?'yes':'no')+' |'),'','## Preview integrity','','SHA256: `'+digest+'`','','Selector validation result: see validation.json.','','**Limitations:** Static checks cannot establish device safety. Upstream source licenses, provenance and real-device behavior must be reviewed before redistribution.'];
fs.writeFileSync('reports/staging/overall-validation.md',md.join('\n')+'\n');
console.log(md.join('\n'));
