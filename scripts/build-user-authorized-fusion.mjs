// SPDX-License-Identifier: GPL-3.0-only
// Build a separate, explicitly unverified fusion subscription.
// Redistribution authorization was asserted by the repository owner; it was not independently verified.
import fs from 'node:fs';
import crypto from 'node:crypto';
import JSON5 from 'json5';
import { dependencyIssues } from '../src/export.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sources=read('config/candidate-sources.json').sources;
const policy=read('config/release-policy.json');
if(policy.skipDeviceTests!==true)throw Error('This unverified build requires explicit skipDeviceTests policy');
const baseline=JSON5.parse(fs.readFileSync('dist/gkd.json5','utf8'));
const result=structuredClone(baseline);
result.version=Number(baseline.version)+1;
if(!Number.isSafeInteger(result.version))throw Error('Invalid baseline version');
const seen=new Set(result.apps.map(a=>a.id));
const log={schemaVersion:1,deviceTesting:'SKIPPED_UNVERIFIED',authorization:'USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED',baseVersion:baseline.version,version:result.version,sources:[],addedApps:0,addedGroups:0,skippedExistingApps:0,skippedRiskyApps:0};
const broad=/(@TextView|@ImageView|\\btext\\s*==\\s*['"]?[xX×✕关闭]|text\\s*\\*=\\s*['"]?[xX×]|clickable\\s*==\\s*true)/i;
const list=v=>v===undefined?[]:Array.isArray(v)?v:[v];
for(const source of sources){
 const api=await fetch('https://api.github.com/repos/'+source.repository+'/commits/'+encodeURIComponent(source.ref),{headers:{Accept:'application/vnd.github+json','User-Agent':'gkd-rule-fusion-release'},signal:AbortSignal.timeout(20000)});
 if(!api.ok)throw Error(source.id+': unable to pin commit HTTP '+api.status);
 const commit=(await api.json()).sha;
 if(!/^[a-f0-9]{40}$/.test(commit))throw Error(source.id+': invalid commit');
 const url='https://raw.githubusercontent.com/'+source.repository+'/'+commit+'/'+source.file;
 const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(source.id+': HTTP '+response.status);
 const raw=await response.text();
 if(raw.length>30000000)throw Error(source.id+': oversized subscription');
 const parsed=JSON5.parse(raw);
 if(!Array.isArray(parsed.apps))throw Error(source.id+': invalid apps');
 const sourceLog={id:source.id,repository:source.repository,commit,file:source.file,sha256:sha(raw),addedApps:0,skippedExistingApps:0,skippedRiskyApps:0};
 for(const app of parsed.apps){
  if(!app||typeof app.id!=='string'||!Array.isArray(app.groups)||!app.groups.length)continue;
  if(seen.has(app.id)){sourceLog.skippedExistingApps++;log.skippedExistingApps++;continue;}
  // Preserve original group keys and cross-group dependencies by adding only complete, low-risk app definitions.
  const risky=app.groups.some(group=>{
    const issues=dependencyIssues(group,app.groups);
    const selectors=[...list(group.matches),...list(group.anyMatches),...list(group.rules).flatMap(r=>typeof r==='string'?[r]:[...list(r.matches),...list(r.anyMatches)])];
    const guarded=Boolean(group.activityIds||group.excludeActivityIds||group.scopeKeys||group.preKeys||list(group.rules).some(r=>r&&typeof r==='object'&&(r.activityIds||r.excludeActivityIds||r.preKeys||r.scopeKeys)));
    return issues.length>0||selectors.some(s=>typeof s==='string'&&broad.test(s)&&!guarded);
  });
  if(risky){sourceLog.skippedRiskyApps++;log.skippedRiskyApps++;continue;}
  result.apps.push(app);seen.add(app.id);sourceLog.addedApps++;log.addedApps++;log.addedGroups+=app.groups.length;
 }
 log.sources.push(sourceLog);
}
if(!log.addedApps)throw Error('No safely addable new apps; refusing to publish unchanged fusion');
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/gkd-fused.json5',JSON.stringify(result,null,2)+'\n');
fs.writeFileSync('dist/gkd-fused-manifest.json',JSON.stringify(log,null,2)+'\n');
console.log('Fusion created:',JSON.stringify({apps:result.apps.length,addedApps:log.addedApps,addedGroups:log.addedGroups,version:result.version,deviceTesting:log.deviceTesting}));
