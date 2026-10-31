// SPDX-License-Identifier: GPL-3.0-only
// Prepare review candidates; never redistribute unlicensed upstream rules.
import fs from 'node:fs';
import crypto from 'node:crypto';
import JSON5 from 'json5';
import { dependencyIssues } from '../src/export.js';
const read = p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sources=read('config/candidate-sources.json').sources;
const current=JSON5.parse(fs.readFileSync('dist/gkd.json5','utf8'));
const known=new Map(current.apps.map(a=>[a.id,a]));
const report={schemaVersion:1,baseline:{id:current.id,version:current.version,apps:current.apps.length},sources:[],reviewQueue:[],preview:{status:'baseline-only',containsUnapprovedRules:false}};
const list=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const text=v=>typeof v==='string'?v:JSON.stringify(v);
const broad=/(@TextView|@ImageView|\btext\s*==\s*['"]?[xX×✕关闭]|text\s*\*=\s*['"]?[xX×]|clickable\s*==\s*true)/i;
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
        const risky=selectors.some(s=>broad.test(s));
        const relevant=suspicious.test([group.name,group.desc,...list(group.category)].join(' '));
        const risk=[...(issues.length?['dependency']:[]),...(risky?['generic-selector']:[]),...(selectors.length===0?['no-rule-selector']:[])];
        row.dependencyIssues+=issues.length;row.riskySelectors+=Number(risky);
        if(!relevant)continue;
        const record={source:src.id,appId:app.id,appName:app.name??app.id,groupKey:group.key,groupName:group.name??'',inBaseline:known.has(app.id),risk,issues,publication:'blocked-unverified-license'};
        report.reviewQueue.push(record);row.review++;
        row.blocked++;
      }
    }
    row.status='analyzed';
  }catch(e){row.status='error';row.error=String(e.message??e)}
  report.sources.push(row);
}
report.reviewQueue.sort((a,b)=>Number(a.risk.length>0)-Number(b.risk.length>0)||Number(a.inBaseline)-Number(b.inBaseline)||a.appId.localeCompare(b.appId));
fs.mkdirSync('reports/staging',{recursive:true});
fs.writeFileSync('reports/staging/review.json',JSON.stringify(report,null,2)+'\n');
const md=['# GKD staging review','','**No unapproved third-party rules are redistributed.**','','| Source | Status | Apps | Groups | Ad/popup candidates | Dependency findings | Generic selector groups | License |','|---|---|---:|---:|---:|---:|---:|---|'];
for(const r of report.sources)md.push('| '+[r.source,r.status,r.apps,r.groups,r.review,r.dependencyIssues,r.riskySelectors,r.declaredLicense].join(' | ')+' |');
md.push('','Candidates are heuristic, not proof of correct functionality. Group dependencies are checked within the same app; cross-group behavior and runtime safety need manual review.','', '## Test subscription','The preview is a copy of the existing approved baseline, not a six-source fusion. Its name and version are unchanged to avoid implying a new release.','');
fs.writeFileSync('reports/staging/README.md',md.join('\n'));
fs.writeFileSync('reports/staging/gkd-preview.json5',JSON.stringify(current,null,2)+'\n');
console.log(md.join('\n'));
if(report.sources.some(s=>s.status!=='analyzed'))process.exitCode=1;
