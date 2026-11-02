import fs from 'node:fs';
import crypto from 'node:crypto';
import JSON5 from 'json5';
const manifestPath=process.argv[2]??'dist/gkd-fused-manifest.json';
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const base='https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/';
const urls={subscription:manifest.subscriptionUrl??base+'gkd-fused.json5',version:manifest.versionUrl??base+'gkd-fused.version.json'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let lastError;
for(let attempt=1;attempt<=3;attempt++){
 try{
  const fetchBytes=async url=>{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);try{const response=await fetch(url,{signal:controller.signal,headers:{'cache-control':'no-cache'}});if(!response.ok)throw Error(url+' HTTP '+response.status);return Buffer.from(await response.arrayBuffer())}finally{clearTimeout(timeout)}};
  const [data,versionBytes]=await Promise.all([fetchBytes(urls.subscription),fetchBytes(urls.version)]);
  if(data.length<1000)throw Error('Public fusion subscription empty or too small');
  const sha256=crypto.createHash('sha256').update(data).digest('hex');
  if(sha256!==manifest.subscriptionSha256)throw Error('Public fusion content SHA-256 mismatch');
  const sub=JSON5.parse(data.toString('utf8'));
  const version=JSON.parse(versionBytes.toString('utf8'));
  if(sub.id!==manifest.id||sub.version!==manifest.version||version.id!==sub.id||version.version!==sub.version)throw Error('Public subscription/version file identity mismatch');
  if(sub.checkUpdateUrl!=='./gkd-fused.version.json')throw Error('Public subscription points to an unexpected version file');
  if(sub.apps?.length!==manifest.counts?.apps)throw Error('Public app count mismatch');
  console.log(JSON.stringify({urls,bytes:data.length,sha256,id:sub.id,version:sub.version,apps:sub.apps.length,versionFile:version},null,2));
  process.exit(0);
 }catch(e){lastError=e;console.error('Attempt '+attempt+' failed: '+e.message);if(attempt<3)await sleep(2000*attempt)}
}
throw Error('Public fusion delivery verification failed: '+lastError?.message);
