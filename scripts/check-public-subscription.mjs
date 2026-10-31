import fs from 'node:fs';
import crypto from 'node:crypto';
import JSON5 from 'json5';

const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));
const expected = manifest.subscriptionSha256;
const url = process.env.SUBSCRIPTION_URL ?? manifest.subscriptionUrl;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let lastError;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let response;
    try { response = await fetch(url, {signal:controller.signal, headers:{'cache-control':'no-cache'}}); }
    finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length < 1000) throw new Error('Public subscription empty or too small');
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    if (sha256 !== expected) throw new Error('Published content differs from checked-in manifest (SHA-256 mismatch)');
    const sub = JSON5.parse(data.toString('utf8'));
    if (sub.id !== manifest.id || sub.version !== manifest.version || !Array.isArray(sub.apps) || !sub.apps.length) throw new Error('Invalid public subscription');
    console.log(JSON.stringify({url,bytes:data.length,sha256,apps:sub.apps.length,version:sub.version},null,2));
    process.exit(0);
  } catch (e) {
    lastError = e;
    console.error('Attempt ' + attempt + ' failed: ' + e.message);
    if (attempt < 3) await sleep(2000 * attempt);
  }
}
throw new Error('Public delivery verification failed: ' + lastError?.message);
