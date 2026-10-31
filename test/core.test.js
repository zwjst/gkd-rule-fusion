import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audit, applyOverrides, hash, normalizeSource, plan, validateSubscription } from '../src/core.js';

const group = (fields = {}) => ({ key: 0, name: '开屏广告', rules: [{ key: 0, matches: '[text="跳过"]' }], ...fields });
const data = (groups = [group()], fields = {}) => ({ id: 1, name: 'test', version: 1,
  categories: [{ key: 0, name: '开屏广告', enable: true }], apps: [{ id: 'com.example', groups }], ...fields });
function source(id, d = data()) {
  const source = { id, repository: `test/${id}`, file: 'dist/gkd.json5', publicationApproved: false };
  const lock = { commit: 'a'.repeat(40), files: { 'dist/gkd.json5': hash(d) } };
  return { source, lock, data: d, rows: normalizeSource(source, d, lock) };
}
const policy = { preferredSources: ['a', 'b'], decisions: {}, overrides: [] };

test('hash ignores object key order but preserves array order and selector whitespace', () => {
  assert.equal(hash({ a: 1, b: 2 }), hash({ b: 2, a: 1 }));
  assert.notEqual(hash([1, 2]), hash([2, 1]));
  assert.notEqual(hash('[text="a b"]'), hash('[text="ab"]'));
});
test('reject nonfinite data instead of silently serializing to null', () => {
  assert.throws(() => hash({ a: Infinity }), /Non-finite/);
});
test('parses scalar rules and selectors without executing code', () => {
  const a = source('a', data([group({ rules: '[text="跳过"]' })]));
  assert.equal(a.rows[0].rules.length, 1);
});
test('exact groups coalesce with all provenance retained', () => {
  const report = audit([source('a'), source('b')]);
  assert.equal(report.exactGroups.length, 1);
  const p = plan(report, policy);
  assert.equal(p.selected.length, 1);
  assert.equal(p.selected[0].provenance.length, 2);
  assert.equal(p.selected[0].id, 'a:com.example:0');
  assert.equal(p.publicationReady, false);
});
test('metadata changes do not imply a behavioral difference', () => {
  assert.equal(source('a').rows[0].fingerprint,
    source('b', data([group({ desc: 'new note', snapshotUrls: ['https://example.test'] })])).rows[0].fingerprint);
});
test('category default changes prevent exact deduplication', () => {
  const a = source('a'), b = source('b', data(undefined, { categories: [{ key: 0, name: '开屏广告', enable: false }] }));
  const r = audit([a, b]);
  assert.equal(r.exactGroups.length, 0);
  assert.ok(r.conflicts.length);
  assert.equal(plan(r, policy).selected.length, 0);
  assert.equal(r.structuralGroups.length, 1);
});
test('empty placeholders are reported rather than aborting the entire audit', () => {
  const a = source('a', data([group({ rules: [] })]));
  assert.equal(a.rows[0].referenceFindings[0].kind, 'empty-placeholder-group');
  assert.equal(plan(audit([a]), policy).pending.length, 1);
});
test('different actions on same selector are quarantined', () => {
  const r = audit([source('a'), source('b', data([group({ action: 'back' })]))]);
  assert.ok(r.conflicts.some(c => c.kind === 'same-selector-different-context'));
  assert.equal(plan(r, policy).pending.length, 2);
});
test('activity and timing differences survive normalization', () => {
  const a = source('a');
  for (const fields of [{ activityIds: '.Main' }, { actionCd: 999 }, { enable: false }, { versionCodes: [12] }, { versionCode: { minimum: 12 } }]) {
    assert.notEqual(a.rows[0].fingerprint, source('b', data([group(fields)])).rows[0].fingerprint);
  }
});
test('version indicator recognizes current versionCode and versionName constraints', () => {
  for (const limits of [{ versionCode: { minimum: 10 } }, { versionName: { include: ['1.0'] } }]) {
    const r = source('a', data([group(limits)])).rows[0].rules[0];
    assert.equal(r.hasVersionLimit, true);
  }
});
test('selector-string and singleton-list forms normalize equivalently', () => {
  const a = source('a'), b = source('b', data([group({ rules: [{ key: 0, matches: ['[text="跳过"]'] }] })]));
  assert.equal(a.rows[0].fingerprint, b.rows[0].fingerprint);
});
test('rule order, keys and preKeys remain significant', () => {
  const g = group({ rules: [{ key: 4, matches: '[text="a"]' }, { key: 5, preKeys: [4], matches: '[text="b"]' }] });
  const a = source('a', data([g]));
  assert.notEqual(a.rows[0].fingerprint, source('b', data([{ ...g, rules: [...g.rules].reverse() }])).rows[0].fingerprint);
});
test('scoped preKeys can resolve across groups', () => {
  const a = source('a', data([group({ key: 1, rules: [{ key: 42, matches: '[text="a"]' }] }),
    group({ key: 2, scopeKeys: [1], rules: [{ preKeys: 42, matches: '[text="b"]' }] })]));
  assert.equal(a.rows[1].referenceFindings.length, 0);
});
test('changing a scope target changes referring group fingerprint', () => {
  const g = group({ key: 2, scopeKeys: [1], rules: [{ preKeys: 42, matches: '[text="b"]' }] });
  const a = source('a', data([group({ key: 1 }), g]));
  const b = source('b', data([group({ key: 1, action: 'back' }), g]));
  assert.notEqual(a.rows[1].fingerprint, b.rows[1].fingerprint);
});
test('unresolved explicit preKeys produce findings and block automatic proposal', () => {
  const a = source('a', data([group({ rules: [{ preKeys: 99, matches: '[text="b"]' }] })]));
  assert.equal(a.rows[0].referenceFindings.length, 1);
  assert.equal(plan(audit([a]), policy).pending.length, 1);
});
test('identical keys from different apps are distinct identities', () => {
  const d = data(); d.apps.push({ id: 'other.app', groups: [group()] });
  assert.deepEqual(source('a', d).rows.map(r => r.id), ['a:com.example:0', 'a:other.app:0']);
});
test('disabled override survives resync but stale upstream changes fail closed', () => {
  const a = source('a'), op = { target: a.rows[0].id, operation: 'disable',
    expectedFingerprint: a.rows[0].fingerprint, reason: 'personal choice' };
  const p = plan(audit([a]), { ...policy, overrides: [op] });
  assert.equal(p.selected.length, 0); assert.equal(p.rejected.length, 1);
  assert.equal(a.rows[0].disabled, undefined);
  assert.throws(() => applyOverrides(source('a', data([group({ action: 'back' })])).rows, [op]), /Stale/);
});
test('replacement must preserve key and is proposed for review', () => {
  const a = source('a');
  const op = { target: a.rows[0].id, operation: 'replace', expectedFingerprint: a.rows[0].fingerprint,
    reason: 'specific version', group: group({ actionCd: 900 }) };
  assert.equal(plan(audit([a]), { ...policy, overrides: [op] }).pending.length, 1);
  assert.throws(() => applyOverrides(a.rows, [{ ...op, group: group({ key: 3 }) }]), /preserve/);
});
test('personal addition has a stable independent namespace', () => {
  const op = { target: 'personal:com.personal:10', app: 'com.personal', operation: 'add',
    reason: 'own rule', group: group({ key: 10 }) };
  const p = plan(audit([source('a')]), { ...policy, overrides: [op] });
  assert.ok(p.selected.some(r => r.id === op.target));
});
test('fingerprint-bound decisions resolve differences without rewriting inputs', () => {
  const a = source('a'), b = source('b', data([group({ action: 'back' })]));
  const decisions = Object.fromEntries([a, b].map((s, i) => [s.rows[0].id, {
    action: i ? 'reject' : 'select', reason: 'reviewed on my device', expectedFingerprint: s.rows[0].fingerprint }]));
  const p = plan(audit([a, b]), { ...policy, decisions });
  assert.equal(p.selected.length, 1); assert.equal(p.rejected.length, 1); assert.equal(p.pending.length, 0);
  assert.throws(() => plan(audit([a, b]), { ...policy, decisions: { unknown: { action: 'select' } } }), /Invalid/);
});
test('snapshot reference is never treated as verified evidence', () => {
  const a = source('a', data([group({ rules: [{ matches: '[text="x"]', snapshotUrls: 'https://example.test' }] })]));
  assert.equal(a.rows[0].rules[0].hasSnapshotReference, true);
  assert.equal(a.rows[0].rules[0].verification, 'unverified');
});
test('reject duplicate app/group/rule keys and malformed selectors', () => {
  const d = data(); d.apps.push(d.apps[0]); assert.throws(() => validateSubscription(d), /duplicate app/);
  assert.throws(() => source('a', data([group(), group()])), /duplicate group/);
  assert.throws(() => source('a', data([group({ rules: [{ key: 1, matches: 'x' }, { key: 1, matches: 'y' }] })])), /duplicate rule/);
  assert.throws(() => source('a', data([group({ rules: [{ matches: [42] }] })])), /Invalid matches/);
});
