// SPDX-License-Identifier: GPL-3.0-only
// Prepare review candidates; never redistribute unlicensed upstream rules.
import fs from 'node:fs';
import crypto from 'node:crypto';
import JSON5 from 'json5';
import { dependencyIssues } from '../src/export.js';
const read = p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sources=read('config/candidate-sources.json').sources;
const approvals=read('config/staging-approvals.json');
if(approvals.schemaVersion!==1||!Array.isArray(approvals.approvedSources)||!Array.isArray(approvals.approvedGroups))throw Error('Invalid staging approvals');
const approvedSources=new Set(approvals.approvedSources.filter(x=>x.reviewed===true&&x.redistributionApproved===true&&typeof x.evidenceUrl==='string'&&/^https:\/\//.test(x.evidenceUrl)).map(x=>x.id));
const approvedGroups=new Set(approvals.approvedGroups.filter(x=>x.reviewed===true&&x.runtimeTested===true&&typeof x.appId==='string'&&/^[a-f0-9]{64}$/.test(x.signature)).map(x=>x.appId+'|'+x.signature));
const current=JSON5.parse(fs.readFileSync('dist/gkd.json5','utf8'));
const known=new Map(current.apps.map(a=>[a.id,a]));
const report={schemaVersion:2,baseline:{id:current.id,version:current.version,apps:current.apps.length},sources:[],reviewQueue:[],preview:{status:'baseline-only',containsUnapprovedRules:false}};
const list=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const text=v=>typeof v==='string'?v:JSON.stringify(v);
const broad=/(@TextView|@ImageView|\btext\s*==\s*['"]?[xX×✕关闭]|text\s*\*=\s*['"]?[xX×]|clickable\s*==\s*true)/i;
const fingerprint=v=>crypto.createHash('sha256').update(JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x)).digest('hex');
const signature=g=>fingerprint(list(g.rules).map(r=>typeof r==='string'?{matches:r}:r));
const baselineSignatures=new Map(current.apps.map(a=>[a.id,new Set((a.groups??[]).map(signature))]));
const selectorContext=group=>{
  const rr=list(group.rules).filter(r=>r&&typeof r==='object');
  const strings=[...list(group.matches),...list(group.anyMatches),...rr.flatMap(r=>[...list(r.matches),...list(r.anyMatches)])].filter(x=>typeof x==='string');
  const hasGuard=Boolean(group.activityIds||group.excludeActivityIds||group.scopeKeys||group.preKeys||rr.some(r=>r.activityIds||r.excludeActivityIds||r.preKeys||r.scopeKeys));
  return {strings,hasGuard};
};
const suspicious=/开屏|广告|弹窗|跳过|关闭|跳过广告|splash|ad.?skip|popup/i;
for(const src of sources){
  const row={source:src.id,repository:src.repository,declaredLicense:src.license,publicationApproved:false,status:'pending',apps:0,groups:0,review:0,blocked:0,dependencyIssues:0,riskySelectors:0};
  try{
    const url='https://raw.githubusercontent.com/'+src.repository+'/'+src.ref+'/'+src.file;
    const res=await fetch(url,{signal:AbortSignal.timeout(45000)});
    if(!res.ok)throw Error('HTTP '+res.status);
    const body=await res.text();if(body.length>30_000_000)throw Error('source too large');
    const data=JSON5.parse(body);if(!Array.isArray(data.apps))throw Error('missing apps');
    row.apps=data.apps.length;row.sha256=crypto.createHash('sha256').update(body).digest('hex');
    for(const app of data.apps){
      for(const group of app.groups??[]){
        row.groups++;
        const issues=dependencyIssues(group,app.groups??[]);
        const selectors=list(group.rules).flatMap(r=>typeof r==='string'?[r]:[r.matches,r.anyMatches]).filter(Boolean).map(text);
        const context=selectorContext(group);
        const risky=context.strings.some(s=>broad.test(s));
        const riskReasons=[
          ...(risky?['broad-selector']:[]),
          ...(risky&&!context.hasGuard?['broad-selector-without-context-guard']:[])
        ];
        const relevant=suspicious.test([group.name,group.desc,...list(group.category)].join(' '));
        const risk=[...(issues.length?['dependency']:[]),...riskReasons.map(x=>x==='broad-selector'?'generic-selector':x),...(selectors.length===0?['no-rule-selector']:[])];
        row.dependencyIssues+=issues.length;row.riskySelectors+=Number(risky);
        if(!relevant)continue;
        const record={source:src.id,signature:signature(group),alreadyInBaseline:baselineSignatures.get(app.id)?.has(signature(group))??false,appId:app.id,appName:app.name??app.id,groupKey:group.key,groupName:group.name??'',inBaseline:known.has(app.id),risk,issues,selectorReview:{hasContextGuard:context.hasGuard,selectorCount:context.strings.length,reasonCodes:riskReasons},publication:'blocked-unverified-license'};
        report.reviewQueue.push(record);row.review++;
        row.blocked++;
      }
    }
    row.status='analyzed';
  }catch(e){row.status='error';row.error=String(e.message??e)}
  report.sources.push(row);
}
const merged=new Map();
for(const item of report.reviewQueue){
  const id=item.appId+'|'+item.signature;
  if(!merged.has(id))merged.set(id,{appId:item.appId,appName:item.appName,signature:item.signature,inBaseline:item.inBaseline,alreadyInBaseline:item.alreadyInBaseline,sources:[],risk:[],issues:[],publication:'blocked-unverified-license'});
  const entry=merged.get(id);
  entry.sources.push({source:item.source,groupKey:item.groupKey,groupName:item.groupName});
  entry.risk=[...new Set([...entry.risk,...item.risk])].sort();
  entry.issues.push(...item.issues.map(issue=>({...issue,source:item.source})));
  entry.selectorReview??={};
  entry.selectorReview[item.source]=item.selectorReview;
}
for(const entry of merged.values()){
  const legal=entry.sources.some(x=>approvedSources.has(x.source));
  const checked=approvedGroups.has(entry.appId+'|'+entry.signature);
  entry.reviewStatus=entry.alreadyInBaseline?'already-published':entry.risk.length?'risk-review-required':!legal?'license-review-required':!checked?'runtime-review-required':'approved-for-staging';
  entry.publication=entry.reviewStatus==='approved-for-staging'?'staging-approved':'blocked';
}
report.deduplicatedReview=[...merged.values()].sort((a,b)=>Number(a.risk.length>0)-Number(b.risk.length>0)||Number(a.inBaseline)-Number(b.inBaseline)||a.appId.localeCompare(b.appId));
report.summary={
  rawCandidates:report.reviewQueue.length,
  uniqueCandidates:report.deduplicatedReview.length,
  duplicateOccurrences:report.reviewQueue.length-report.deduplicatedReview.length,
  alreadyInBaseline:report.deduplicatedReview.filter(x=>x.alreadyInBaseline).length,
  newApplicationCandidates:report.deduplicatedReview.filter(x=>!x.inBaseline).length,
  dependencyRiskCandidates:report.deduplicatedReview.filter(x=>x.risk.includes('dependency')).length,
  genericSelectorRiskCandidates:report.deduplicatedReview.filter(x=>x.risk.includes('generic-selector')).length,
  broadWithoutContextGuard:report.deduplicatedReview.filter(x=>x.risk.includes('broad-selector-without-context-guard')).length,
  cleanStaticCandidates:report.deduplicatedReview.filter(x=>!x.risk.length&&!x.alreadyInBaseline).length,
  publishableCandidates:report.deduplicatedReview.filter(x=>x.reviewStatus==='approved-for-staging').length
};
report.reviewQueue.sort((a,b)=>Number(a.risk.length>0)-Number(b.risk.length>0)||Number(a.inBaseline)-Number(b.inBaseline)||a.appId.localeCompare(b.appId));
fs.mkdirSync('reports/staging',{recursive:true});
// A focused manual-review queue: licensing first, then runtime checks; never publish automatically.
const reviewPriority=report.deduplicatedReview.filter(x=>!x.alreadyInBaseline).map(x=>({
  appId:x.appId,appName:x.appName,signature:x.signature,
  sources:x.sources.map(s=>s.source),groupNames:[...new Set(x.sources.map(s=>s.groupName))],
  reviewStatus:x.reviewStatus,risk:x.risk,
  priority:x.risk.includes('dependency')?'P0-dependency':
    x.risk.includes('generic-selector')?'P1-false-positive':
    x.risk.includes('no-rule-selector')?'P1-missing-selector':
    x.sources.length>1?'P2-cross-source-verification':'P3-manual-verification'
})).sort((a,b)=>a.priority.localeCompare(b.priority)||b.sources.length-a.sources.length||a.appId.localeCompare(b.appId));
fs.writeFileSync('reports/staging/manual-review-queue.json',JSON.stringify(reviewPriority,null,2)+'\\n');
const reviewMd=['# Manual review priorities','','All entries remain blocked until license evidence and device testing are approved.','','| Priority | Count |','|---|---:|'];
for(const p of [...new Set(reviewPriority.map(x=>x.priority))])reviewMd.push('| '+p+' | '+reviewPriority.filter(x=>x.priority===p).length+' |');
reviewMd.push('','## First 30 candidates','','| Priority | Application | Group | Sources | Risks |','|---|---|---|---|---|');
for(const x of reviewPriority.slice(0,30))reviewMd.push('| '+[x.priority,x.appId,x.groupNames.join(', ').replaceAll('|','/').slice(0,70),x.sources.join(', '),x.risk.join(', ')||'none'].join(' | ')+' |');
fs.writeFileSync('reports/staging/manual-review-queue.md',reviewMd.join('\\n')+'\\n');
const buckets={};
for(const entry of report.deduplicatedReview)(buckets[entry.reviewStatus]??=[]).push(entry);
for(const [status,entries] of Object.entries(buckets))fs.writeFileSync('reports/staging/'+status+'.json',JSON.stringify(entries,null,2)+'\n');
fs.writeFileSync('reports/staging/deduplicated-review.json',JSON.stringify({summary:report.summary,candidates:report.deduplicatedReview},null,2)+'\n');
fs.writeFileSync('reports/staging/review.json',JSON.stringify(report,null,2)+'\n');
const md=['# GKD staging review','','**No unapproved third-party rules are redistributed.**','','| Source | Status | Apps | Groups | Ad/popup candidates | Dependency findings | Generic selector groups | License |','|---|---|---:|---:|---:|---:|---:|---|'];
for(const r of report.sources)md.push('| '+[r.source,r.status,r.apps,r.groups,r.review,r.dependencyIssues,r.riskySelectors,r.declaredLicense].join(' | ')+' |');
md.push('','## Deduplicated review','','| Metric | Count |','|---|---:|',...Object.entries(report.summary).map(([k,v])=>'| '+k+' | '+v+' |'));
md.push('','Candidates are heuristic, not proof of correct functionality. Group dependencies are checked within the same app; cross-group behavior and runtime safety need manual review.','', '## Test subscription','The preview is a copy of the existing approved baseline, not a six-source fusion. Its name and version are unchanged to avoid implying a new release.','');
fs.writeFileSync('reports/staging/README.md',md.join('\n'));
fs.writeFileSync('reports/staging/gkd-preview.json5',JSON.stringify(current,null,2)+'\n');
console.log(md.join('\n'));
if(report.sources.some(s=>s.status!=='analyzed'))process.exitCode=1;
