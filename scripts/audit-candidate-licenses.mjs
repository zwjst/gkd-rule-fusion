// SPDX-License-Identifier: GPL-3.0-only
// Evidence discovery is not a legal authorization decision.
import fs from 'node:fs';
const sources=JSON.parse(fs.readFileSync('config/candidate-sources.json','utf8')).sources;
const headers={'Accept':'application/vnd.github+json','User-Agent':'gkd-rule-fusion-license-audit'};
const review=JSON.parse(fs.readFileSync('reports/staging/review.json','utf8'));
const provenance=new Map(review.sources.map(s=>[s.source,s]));
const markers=[/禁止.{0,24}(传播|转载|商用|二次分发)/i,/仅供.{0,20}(学习|交流|个人使用)/i,/不得.{0,24}(传播|转载|商用|分发)/i,/no\s+(redistribution|commercial use)/i,/all rights reserved/i];
const report={schemaVersion:1,generatedAt:new Date().toISOString(),sources:[]};
for(const source of sources){
  const row={id:source.id,repository:source.repository,declaredLicense:source.license,status:'pending',publicationApproved:false,evidence:[],restrictions:[]};
  try{
    const pinned=provenance.get(source.id);
    if(pinned?.status!=='analyzed'||!/^[a-f0-9]{40}$/.test(pinned.commit??'')||!/^[a-f0-9]{64}$/.test(pinned.sha256??''))throw Error('No verified candidate provenance for '+source.id);
    row.commit=pinned.commit;
    row.subscriptionSha256=pinned.sha256;
    const base='https://raw.githubusercontent.com/'+source.repository+'/'+pinned.commit+'/';
    const endpoints=['LICENSE','LICENSE.md','LICENSE.txt','COPYING','README.md','README.MD','LEGAL.md','package.json'];
    for(const file of endpoints){
      const res=await fetch(base+file,{headers,signal:AbortSignal.timeout(20000)});
      if(res.status===404)continue;
      if(!res.ok){row.evidence.push({file,status:'http-'+res.status});continue}
      const body=await res.text();if(body.length>250000){row.evidence.push({file,status:'oversize'});continue}
      const findings=markers.flatMap((re,i)=>[...body.matchAll(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))].slice(0,3).map(m=>({marker:i,excerpt:m[0].slice(0,120)})));
      row.evidence.push({file,url:base+file,sha256:(await import('node:crypto')).createHash('sha256').update(body).digest('hex'),findings});
      row.restrictions.push(...findings.map(x=>({file,...x})));
    }
    row.status=row.evidence.some(e=>e.sha256)?'evidence-collected':'no-evidence-found';
    row.reviewRequired=true;
  }catch(e){row.status='error';row.error=String(e.message??e)}
  report.sources.push(row);
}
fs.mkdirSync('reports/staging',{recursive:true});
fs.writeFileSync('reports/staging/license-evidence.json',JSON.stringify(report,null,2)+'\n');
const lines=['# Candidate source redistribution evidence','','Evidence is advisory only. No source is approved automatically.','','| Source | Status | Files inspected | Restriction matches | Declared license |','|---|---|---:|---:|---|'];
for(const r of report.sources)lines.push('| '+[r.id,r.status,r.evidence.length,r.restrictions.length,r.declaredLicense].join(' | ')+' |');
lines.push('','A restriction marker is not a legal conclusion; verify full license terms, provenance, and compatibility before any redistribution.','');
fs.writeFileSync('reports/staging/license-evidence.md',lines.join('\n'));
console.log(lines.join('\n'));
if(report.sources.some(x=>x.status==='error'||x.status==='no-evidence-found'))process.exitCode=1;
