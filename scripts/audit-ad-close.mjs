// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs';
import JSON5 from 'json5';
const candidates = JSON.parse(fs.readFileSync('config/ad-close-candidates.json','utf8'));
const subscription = JSON5.parse(fs.readFileSync('dist/gkd.json5','utf8'));
const groups = [
  ...(subscription.globalGroups ?? []).map(g => ({scope:'global',group:g})),
  ...(subscription.apps ?? []).flatMap(a => (a.groups ?? []).map(g => ({scope:a.id,group:g}))),
];
function strings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.entries(value).filter(([k])=>['matches','excludeMatches','anyMatches'].includes(k)).flatMap(([,v])=>strings(v));
  return [];
}
const existing = groups.flatMap(({scope,group})=>(Array.isArray(group.rules)?group.rules:[group.rules]).flatMap(rule=>strings(rule).map(selector=>({scope,group:group.name,selector}))));
const report = candidates.candidates.map(c=>({
  id:c.id,risk:c.risk,context:c.context,
  selectors:c.selectors.map(selector=>({selector,exactMatches:existing.filter(e=>e.selector===selector)})),
}));
console.log(JSON.stringify({subscription:{apps:subscription.apps?.length,globalGroups:subscription.globalGroups?.length},candidateGroups:report},null,2));
