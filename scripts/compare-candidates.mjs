// SPDX-License-Identifier: GPL-3.0-only
// Public-source comparison only. Unlicensed source rules must not enter dist.
import fs from 'node:fs';
import crypto from 'node:crypto';
import JSON5 from 'json5';
const candidates = JSON.parse(fs.readFileSync('config/candidate-sources.json','utf8'));
const current = JSON5.parse(fs.readFileSync('dist/gkd.json5','utf8'));
const existing = new Map(current.apps.map(app=>[app.id,app]));
const norm = value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const hash = value=>crypto.createHash('sha256').update(norm(value)).digest('hex');
const signature = group=>hash((Array.isArray(group.rules)?group.rules:[group.rules]).map(r=>typeof r==='string'?{matches:r}:r));
const baseSigs = new Map(current.apps.map(app=>[app.id,new Set((app.groups??[]).map(signature))]));
const report={schemaVersion:2,baseline:{apps:current.apps.length,globalGroups:current.globalGroups?.length??0},sources:[]};
const acrossApps=new Map();
const acrossGroups=new Map();
const addSource=(map,key,source)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(source);};
for(const source of candidates.sources){
  const entry={id:source.id,repository:source.repository,license:source.license,publicationApproved:false,status:'pending',exclusiveApps:[],sharedApps:0,novelGroupSignatures:0,duplicateGroupSignatures:0,appGroups:0,globalGroups:0};
  try{
    const url='https://raw.githubusercontent.com/'+source.repository+'/'+source.ref+'/'+source.file;
    const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    const body=await response.text();
    if(body.length>30_000_000)throw Error('source too large');
    const parsed=JSON5.parse(body);
    if(!Array.isArray(parsed.apps))throw Error('missing apps');
    entry.status='analyzed';entry.apps=parsed.apps.length;entry.globalGroups=parsed.globalGroups?.length??0;
    entry.sha256=crypto.createHash('sha256').update(body).digest('hex');
    for(const app of parsed.apps){
      addSource(acrossApps,app.id,source.id);
      if(!existing.has(app.id))entry.exclusiveApps.push({id:app.id,name:app.name??app.id,groups:app.groups?.length??0});
      else entry.sharedApps++;
      for(const group of app.groups??[]){
        entry.appGroups++;
        addSource(acrossGroups,app.id+'|'+signature(group),source.id);
        if(baseSigs.get(app.id)?.has(signature(group)))entry.duplicateGroupSignatures++;
        else entry.novelGroupSignatures++;
      }
    }
  }catch(error){entry.status='error';entry.error=String(error.message??error)}
  report.sources.push(entry);
}
const appRows=[...acrossApps].map(([id,sources])=>({appId:id,sources:[...sources].sort(),inBaseline:existing.has(id)})).sort((a,b)=>a.appId.localeCompare(b.appId));
const groupRows=[...acrossGroups].map(([identity,sources])=>({identity,sources:[...sources].sort(),inBaseline:baseSigs.get(identity.split('|')[0])?.has(identity.split('|')[1])??false})).sort((a,b)=>a.identity.localeCompare(b.identity));
report.crossSource={
  candidateUniqueApps:appRows.length,
  netNewApps:appRows.filter(r=>!r.inBaseline).length,
  candidateUniqueGroupSignatures:groupRows.length,
  netNovelGroupSignatures:groupRows.filter(r=>!r.inBaseline).length,
  sharedByMultipleCandidatesApps:appRows.filter(r=>r.sources.length>1).length,
  sharedByMultipleCandidatesGroupSignatures:groupRows.filter(r=>r.sources.length>1).length,
  note:'Signature equality is exact canonicalized rule-content equality, not semantic equivalence.'
};
fs.mkdirSync('reports/candidates',{recursive:true});
fs.writeFileSync('reports/candidates/app-provenance.json',JSON.stringify(appRows,null,2)+'\n');
fs.writeFileSync('reports/candidates/group-provenance.json',JSON.stringify(groupRows,null,2)+'\n');
fs.writeFileSync('reports/candidates/latest.json',JSON.stringify(report,null,2)+'\n');
const rows=['# Additional GKD sources: candidate audit','','No candidate rules are automatically republished. SHA256 fingerprints and package/group counts are for review.','','| Source | Status | Apps | New vs baseline Apps | Shared Apps | Groups with novel signatures | Duplicate signatures | License |','|---|---|---:|---:|---:|---:|---:|---|'];
for(const s of report.sources)rows.push('| '+[s.id,s.status,s.apps??'-',s.exclusiveApps.length,s.sharedApps,s.novelGroupSignatures,s.duplicateGroupSignatures,s.license].join(' | ')+' |');
rows.push('','## Cross-source deduplicated totals','','| Metric | Count |','|---|---:|',
...Object.entries(report.crossSource).filter(([,v])=>typeof v==='number').map(([k,v])=>'| '+k+' | '+v+' |'));
rows.push('','Note: novel signature does not imply safe, functional, or legally publishable. Cross-candidate duplication is not deducted.','');
fs.writeFileSync('reports/candidates/latest.md',rows.join('\n'));
console.log(rows.join('\n'));
if(report.sources.some(s=>s.status!=='analyzed'))process.exitCode=1;
