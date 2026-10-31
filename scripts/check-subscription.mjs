import fs from 'node:fs';
import crypto from 'node:crypto';
import JSON5 from 'json5';

const file = process.argv[2] ?? 'dist/gkd.json5';
const manifestPath = process.argv[3] ?? 'dist/manifest.json';
const bytes = fs.readFileSync(file);
if (bytes.length < 1000) throw new Error('Subscription unexpectedly empty or tiny');
const subscription = JSON5.parse(bytes.toString('utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const fail = message => { throw new Error(message); };
if (!Number.isSafeInteger(subscription.id) || !Number.isSafeInteger(subscription.version) || subscription.version < 1) fail('Invalid subscription identity/version');
if (subscription.id !== manifest.id || subscription.version !== manifest.version) fail('Subscription and manifest identity/version mismatch');
if (!Array.isArray(subscription.apps) || subscription.apps.length === 0) fail('Missing apps');
if (!Array.isArray(subscription.globalGroups)) fail('Missing globalGroups');
const groups = subscription.apps.reduce((n, app) => {
  if (typeof app.id !== 'string' || !Array.isArray(app.groups)) fail('Malformed app');
  return n + app.groups.length;
}, 0) + subscription.globalGroups.length;
const rules = [...subscription.globalGroups, ...subscription.apps.flatMap(a => a.groups)]
  .reduce((n, group) => n + (Array.isArray(group.rules) ? group.rules.length : 0), 0);
if (groups < 1 || rules < 1) fail('Missing groups/rules');
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
if (sha256 !== manifest.subscriptionSha256) fail('Manifest SHA-256 mismatch');
for (const [field, actual] of [['apps', subscription.apps.length], ['groups', groups], ['rules', rules]]) {
  if (manifest.counts?.[field] !== actual) fail('Manifest count mismatch: ' + field);
}
console.log(JSON.stringify({file,bytes:bytes.length,sha256,id:subscription.id,version:subscription.version,apps:subscription.apps.length,groups,rules},null,2));
