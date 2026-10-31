import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSource, hash } from '../src/core.js';
import { dependencyIssues, fuse } from '../src/export.js';

const SHA = { a: 'a'.repeat(40), b: 'b'.repeat(40), c: 'c'.repeat(40) };
const group = (key = 0, props = {}) => ({ key, name: '开屏广告',
  rules: [{ key: 0, matches: '[text="关闭"]' }], ...props });
const app = (id, groups = [group()], props = {}) => ({ id, name: id, groups, ...props });
function source(id, apps = [app('shared.app')], props = {}) {
  const source = { id, repository: `test/${id}`, file: 'dist/gkd.json5', publicationApproved: true };
  const data = { id: id.charCodeAt(0), name: `source ${id}`, version: 1,
    categories: [{ key: 5, name: '开屏广告' }],
    globalGroups: [group(0, { name: `global ${id}` })], apps, ...props };
  const lock = { commit: SHA[id], files: { 'dist/gkd.json5': hash(data) } };
  return { source, data, lock, rows: normalizeSource(source, data, lock) };
}
const release = (props = {}) => ({ schemaVersion: 1, id: 9001, name: 'Fusion test', version: 1,
  author: 'test', repository: 'https://github.com/test/fusion', sourcePriority: ['a', 'b'],
  globalSource: 'a', reviewedCommits: { a: SHA.a, b: SHA.b }, ...props });
const get = (result, id) => result.subscription.apps.find(a => a.id === id);
const target = s => `${s.source.id}:${s.data.apps[0].id}:${s.data.apps[0].groups[0].key}`;
const fingerprint = s => s.rows.find(r => r.id === target(s)).fingerprint;

test('fusion selects a complete primary App, supplements unique Apps, and keeps one global set', () => {
  const a = source('a', [app('shared.app', [group(0), group(1, { name: 'primary only' })])]);
  const b = source('b', [app('shared.app', [group(2, { name: 'secondary must not splice' })]), app('only.b')]);
  const c = source('c', [app('not.approved.for.release')]);
  c.source.publicationApproved = false;
  const result = fuse([a, b, c], release());
  assert.deepEqual(get(result, 'shared.app').groups.map(g => g.key), [0, 1]);
  assert.ok(get(result, 'only.b'));
  assert.equal(get(result, 'not.approved.for.release'), undefined);
  assert.deepEqual(result.subscription.globalGroups.map(g => g.name), ['global a']);
  assert.deepEqual(result.counts, { apps: 2, appGroups: 3, globalGroups: 1, groups: 4, rules: 4, quarantinedGroups: 0 });
  assert.equal(result.provenance.excludedSources[0].source, 'c');
  assert.equal(result.subscription.id, 9001);
  assert.equal(result.subscription.checkUpdateUrl, './gkd.version.json');
  assert.equal(result.subscription.supportUri, release().repository);
});

test('category defaults materialize once into groups; output categories do not override them', () => {
  const a = source('a', [app('primary', [group(0, { enable: true })])], {
    categories: [{ key: 5, name: '开屏广告', enable: false }],
    globalGroups: [group(0, { name: 'global', enable: true })]
  });
  const b = source('b', [app('secondary', [group(0, { enable: true })])], {
    categories: [{ key: 17, name: '开屏广告' }]
  });
  const result = fuse([a, b], release());
  assert.equal(get(result, 'primary').groups[0].enable, false);
  assert.equal(get(result, 'secondary').groups[0].enable, true);
  assert.equal(result.subscription.globalGroups[0].enable, true);
  assert.ok(result.subscription.categories.every(c => !Object.hasOwn(c, 'enable')));
  assert.equal(result.subscription.categories.filter(c => c.name === '开屏广告').length, 1);
});

test('category key ledger survives source category reordering and reserves removed keys', () => {
  const a = source('a', undefined, { categories: [{ key: 80, name: '开屏广告' }, { key: 81, name: '更新提示' }] });
  const b = source('b', [app('only.b')], { categories: [] });
  const first = fuse([a, b], release());
  const changed = source('a', undefined, { categories: [{ key: 2, name: '通知提示' }, { key: 4, name: '开屏广告' }] });
  const before = structuredClone(first.state);
  const second = fuse([changed, b], release({ version: 2 }), first.state);
  assert.equal(second.state.categoryKeys['开屏广告'], first.state.categoryKeys['开屏广告']);
  assert.equal(second.state.categoryKeys['更新提示'], first.state.categoryKeys['更新提示']);
  assert.ok(second.state.categoryKeys['通知提示'] > Math.max(...Object.values(first.state.categoryKeys)));
  assert.deepEqual(first.state, before);
});

test('App source ledger prevents a newly added primary App replacing a secondary App', () => {
  const a = source('a', [app('original.a')]), b = source('b', [app('later.primary', [group(9)])]);
  const first = fuse([a, b], release());
  const laterA = source('a', [app('original.a'), app('later.primary', [group(1)])]);
  const second = fuse([laterA, b], release({ version: 2 }), first.state);
  assert.equal(second.state.appSources['later.primary'], 'b');
  assert.deepEqual(get(second, 'later.primary').groups.map(g => g.key), [9]);
});

test('pinned App source disappearance fails instead of silently migrating or removing it', () => {
  const a = source('a', [app('original.a')]), b = source('b', [app('pinned.b')]);
  const first = fuse([a, b], release());
  const laterA = source('a', [app('original.a'), app('pinned.b')]);
  assert.throws(() => fuse([laterA, source('b', [])], release(), first.state), /Pinned App source missing/);
  assert.throws(() => fuse([a, b], release({ sourcePriority: ['a'] }), first.state), /Pinned App source missing/);
});

test('group key ledger and subscription identity cannot change silently', () => {
  const a = source('a'), b = source('b', []), first = fuse([a, b], release());
  const changedKeys = structuredClone(first.state); changedKeys.groupKeys[target(a)] = 8;
  assert.throws(() => fuse([a, b], release(), changedKeys), /Group key ledger changed/);
  assert.throws(() => fuse([a, b], release({ id: 9002 }), first.state), /Subscription identity changed/);
});

test('unapproved sources and unreviewed source commits are publication blockers', () => {
  const a = source('a'), b = source('b'); a.source.publicationApproved = false;
  assert.throws(() => fuse([a, b], release()), /Publication not approved: a/);
  a.source.publicationApproved = true; a.lock.commit = SHA.c;
  assert.throws(() => fuse([a, b], release()), /commit requires publication review: a/);
  assert.throws(() => fuse([source('a'), b], release({ id: 'a'.charCodeAt(0) })), /ID must differ/);
  assert.throws(() => fuse([source('a'), b], release({ sourcePriority: ['a', 'a'] })), /Invalid fusion source/);
});

test('publication approval must be the boolean true, not another truthy value', () => {
  for (const approval of ['false', 'true', 1, {}]) {
    const a = source('a'); a.source.publicationApproved = approval;
    assert.throws(() => fuse([a, source('b', [])], release()), /Publication not approved/);
  }
});

test('dependency checker does not invent implicit index keys', () => {
  const g = group(0, { rules: [{ matches: '[text="first"]' }, { preKeys: 0, matches: '[text="second"]' }] });
  assert.deepEqual(dependencyIssues(g, [g]), [{ type: 'missing-preKey', index: 1, key: 0 }]);
});

test('missing preKeys quarantine the complete group, retaining unrelated groups', () => {
  const broken = group(0, { rules: [{ key: 0, matches: '[text="first"]' },
    { preKeys: 99, matches: '[text="second"]' }] });
  const a = source('a', [app('chain.app', [broken, group(1)])]), b = source('b', []);
  const result = fuse([a, b], release());
  assert.deepEqual(get(result, 'chain.app').groups.map(g => g.key), [1]);
  assert.equal(result.provenance.quarantine.length, 1);
  assert.equal(result.provenance.quarantine[0].originalKey, 0);
  assert.equal(result.provenance.quarantine[0].reasons[0].type, 'missing-preKey');
  assert.equal(a.data.apps[0].groups[0].rules.length, 2);
});

test('missing shared cooldown or action counter targets quarantine the complete group', () => {
  for (const field of ['actionCdKey', 'actionMaximumKey']) {
    const a = source('a', [app('shared.state', [group(0, { [field]: 99 }), group(1)])]);
    const result = fuse([a, source('b', [])], release());
    assert.deepEqual(get(result, 'shared.state').groups.map(g => g.key), [1]);
    assert.ok(result.provenance.quarantine[0].reasons.some(r => r.type === `missing-${field}`));
  }
});

test('quarantine follows dependency closure in later passes without dropping prerequisites', () => {
  const broken = group(1, { rules: [{ key: 10, preKeys: 99, matches: '[text="broken"]' }] });
  const dependent = group(2, { scopeKeys: [1], rules: [{ key: 20, preKeys: 10, matches: '[text="depends"]' }] });
  const further = group(3, { scopeKeys: [2], rules: [{ preKeys: 20, matches: '[text="further"]' }] });
  const result = fuse([source('a', [app('cascade', [broken, dependent, further, group(4)])]), source('b', [])], release());
  assert.deepEqual(get(result, 'cascade').groups.map(g => g.key), [4]);
  assert.deepEqual(result.provenance.quarantine.map(g => g.originalKey), [1, 2, 3]);
  assert.ok(result.provenance.quarantine[1].reasons.some(r => r.type === 'missing-scope-group'));
});

test('legal scoped prerequisites and shared state retain original keys and selector text', () => {
  const selector = '@View[text="a b"] > [desc~="(?is)Close.*"]';
  const first = group(10, { rules: [{ key: 80, matches: '[text="first"]' }] });
  const second = group(20, { scopeKeys: [10], actionCdKey: 80, actionMaximumKey: 80,
    rules: [{ key: 90, preKeys: [80], matches: selector }] });
  assert.deepEqual(dependencyIssues(second, [first, second]), []);
  const a = source('a', [app('scoped', [first, second])]);
  const result = fuse([a, source('b', [])], release());
  const out = get(result, 'scoped').groups[1];
  assert.equal(result.provenance.quarantine.length, 0);
  assert.deepEqual(out.scopeKeys, [10]); assert.equal(out.key, 20);
  assert.deepEqual(out.rules[0].preKeys, [80]); assert.equal(out.rules[0].key, 90);
  assert.equal(out.rules[0].matches, selector);
  assert.equal(out.actionCdKey, 80); assert.equal(out.actionMaximumKey, 80);
});

test('empty groups and empty rule objects quarantine without becoming executable output', () => {
  const a = source('a', [app('placeholders', [group(0, { rules: [] }), group(1, { rules: [{}] }), group(2)])]);
  const result = fuse([a, source('b', [])], release());
  assert.deepEqual(get(result, 'placeholders').groups.map(g => g.key), [2]);
  assert.equal(result.provenance.quarantine.length, 2);
});

test('scalar rules normalize to matches objects without rewriting selector text or input data', () => {
  const text = '[text="keep  two spaces"]';
  const a = source('a', [app('scalar', [group(0, { rules: text })])]), before = structuredClone(a);
  const result = fuse([a, source('b', [])], release());
  assert.deepEqual(get(result, 'scalar').groups[0].rules, [{ matches: text }]);
  assert.deepEqual(a, before);
});

test('personal disable binds the upstream fingerprint and keeps the group present', () => {
  const a = source('a'), b = source('b', []);
  const op = { operation: 'disable', target: target(a), expectedFingerprint: fingerprint(a), reason: 'my device' };
  const result = fuse([a, b], release(), {}, { overrides: [op] });
  assert.equal(get(result, 'shared.app').groups[0].enable, false);
  assert.ok(result.provenance.included.find(g => g.id === target(a)).changes.some(c => c.operation === 'disable'));
  const changed = source('a', [app('shared.app', [group(0, { actionCd: 999 })])]);
  assert.throws(() => fuse([changed, b], release(), {}, { overrides: [op] }), /stale personal target/);
});

test('personal replacement preserves group key and records loss of direct source-rule identity', () => {
  const a = source('a'), b = source('b', []);
  const op = { operation: 'replace', target: target(a), expectedFingerprint: fingerprint(a),
    reason: 'new app version', group: group(0, { rules: [{ key: 42, matches: '[text="personal"]' }] }) };
  const result = fuse([a, b], release(), {}, { overrides: [op] });
  assert.equal(get(result, 'shared.app').groups[0].rules[0].matches, '[text="personal"]');
  assert.equal(result.provenance.included.find(g => g.id === target(a)).rules[0].sourceRuleIndex, null);
  assert.throws(() => fuse([a, b], release(), {}, { overrides: [{ ...op, group: group(8) }] }), /preserve group key/);
  assert.throws(() => fuse([a, b], release(), {}, { overrides: [{ ...op, expectedFingerprint: '0'.repeat(64) }] }), /stale personal target/);
});

test('personal addition persists its reserved key and cannot overwrite an upstream group', () => {
  const a = source('a'), b = source('b', []);
  const op = { operation: 'add', target: 'personal:shared.app:99', app: 'shared.app',
    reason: 'extra feature', group: group(99) };
  const first = fuse([a, b], release(), {}, { overrides: [op] });
  assert.equal(get(first, 'shared.app').groups.find(g => g.key === 99).enable, false);
  assert.equal(first.state.groupKeys[op.target], 99);
  const second = fuse([a, b], release({ version: 2 }), first.state, { overrides: [op] });
  assert.ok(get(second, 'shared.app').groups.some(g => g.key === 99));
  const updated = source('a', [app('shared.app', [group(), group(99)])]);
  assert.throws(() => fuse([updated, b], release(), first.state, { overrides: [op] }), /occupied\/reserved/);
  assert.throws(() => fuse([a, b], release(), {}, { overrides: [{ ...op, target: 'personal:shared.app:0', group: group(0) }] }), /occupied\/reserved/);
});

test('personal additions support a new App without importing another upstream App', () => {
  const op = { operation: 'add', target: 'personal:own.app:7', app: 'own.app', reason: 'local rules', group: group(7) };
  const result = fuse([source('a'), source('b', [])], release(), {}, { overrides: [op] });
  assert.equal(get(result, 'own.app').groups[0].key, 7);
  assert.equal(result.provenance.included.find(g => g.id === op.target).source, 'personal');
});

test('unselected personal targets and invalid added/replaced dependency chains fail closed', () => {
  const a = source('a'), b = source('b');
  const op = { operation: 'disable', target: target(b), expectedFingerprint: fingerprint(b), reason: 'not selected' };
  assert.throws(() => fuse([a, b], release(), {}, { overrides: [op] }), /stale personal target/);
  const add = { operation: 'add', target: 'personal:shared.app:9', app: 'shared.app', reason: 'test',
    group: group(9, { rules: [{ preKeys: 999, matches: '[text="broken"]' }] }) };
  assert.throws(() => fuse([a, b], release(), {}, { overrides: [add] }), /Personal override has invalid/);
  const replace = { operation: 'replace', target: target(a), expectedFingerprint: fingerprint(a), reason: 'test', group: group(0, { rules: [{}] }) };
  assert.throws(() => fuse([a, b], release(), {}, { overrides: [replace] }), /Personal override has invalid/);
});

test('personal overrides require unique targets and a review reason', () => {
  const a = source('a'), b = source('b', []);
  const op = { operation: 'disable', target: target(a), expectedFingerprint: fingerprint(a), reason: 'my device' };
  assert.throws(() => fuse([a, b], release(), {}, { overrides: [op, op] }), /reason and unique target/);
  assert.throws(() => fuse([a, b], release(), {}, { overrides: [{ ...op, reason: '' }] }), /reason and unique target/);
});
