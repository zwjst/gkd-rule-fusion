import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('check-export.mjs', import.meta.url));
const rule = (key, fields = {}) => ({ key, matches: '[text="fixture"]', ...fields });
const group = (key, rules = [rule(0)], fields = {}) => ({ key, name: 'fixture', rules, ...fields });
const subscription = groups => ({ id: 1, name: 'fixture', version: 1,
  categories: [{ key: 0, name: 'fixture', enable: true }], apps: [{ id: 'test.app', groups }], globalGroups: [] });
function run(t, data) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gkd-export-validation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'input.json5'), out = path.join(root, 'result.json');
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
  const command = spawnSync(process.execPath, [script, '--file', file, '--out', out], { encoding: 'utf8' });
  return { command, report: JSON.parse(fs.readFileSync(out, 'utf8')), text: fs.readFileSync(out, 'utf8') };
}

test('export validates explicit cross-group dependencies and all selector fields', t => {
  const data = subscription([
    group(1, [rule(42, { anyMatches: '[desc="fixture"]', excludeMatches: '[text="skip"]', excludeAllMatches: '[text="blocked"]' })]),
    group(2, [rule(0, { preKeys: 42, actionCdKey: 42, actionMaximumKey: 42 })], { scopeKeys: [1] })
  ]);
  const { command, report } = run(t, data);
  assert.equal(command.status, 0);
  assert.equal(report.valid, true);
  assert.equal(report.counts.preKeyReferences, 1);
  assert.equal(report.counts.sharedCooldownReferences, 1);
  assert.equal(report.counts.sharedMaximumReferences, 1);
  assert.equal(report.counts.uniqueSelectors, 4);
  assert.ok(Object.values(report.controls).every(control => control.ok));
});

test('missing preKeys and shared keys are errors; rule index is never an implicit key', t => {
  const { command, report } = run(t, subscription([group(0, [
    { matches: '[text="fixture"]' }, rule(8, { preKeys: [0], actionCdKey: 99, actionMaximumKey: 88 })
  ])]));
  assert.equal(command.status, 1);
  assert.ok(report.errors.some(error => error.code === 'unresolved-prekey'));
  assert.ok(report.errors.some(error => error.code === 'unresolved-actionCdKey'));
  assert.ok(report.errors.some(error => error.code === 'unresolved-actionMaximumKey'));
});

test('duplicate identities and missing scope groups fail export policy', t => {
  const data = subscription([group(0, [rule(1), rule(1)], { scopeKeys: [4] }), group(0)]);
  data.categories.push(data.categories[0]); data.apps.push(data.apps[0]);
  const { command, report } = run(t, data);
  assert.equal(command.status, 1);
  for (const code of ['duplicate-category-key', 'duplicate-app-id', 'duplicate-group-key', 'duplicate-rule-key', 'missing-scope-group']) {
    assert.ok(report.errors.some(error => error.code === code), code);
  }
});

test('same rule key in separate scopes is allowed; ambiguous sharing follows client order', t => {
  const data = subscription([group(1, [rule(0)]), group(2, [rule(0, { actionCdKey: 0 })], { scopeKeys: [1] })]);
  data.globalGroups.push(group(1, [rule(0)]));
  const { command, report } = run(t, data);
  assert.equal(command.status, 0);
  assert.ok(report.warnings.some(warning => warning.code === 'ambiguous-actionCdKey'));
});

test('bad syntax and anyMatches type failures reject without selector bodies', t => {
  const { command, report, text } = run(t, subscription([group(0, [rule(0, { anyMatches: '[unknownAttribute=1]', matches: '[text=' })])]));
  assert.equal(command.status, 1);
  assert.equal(report.counts.failedUniqueSelectors, 2);
  assert.equal(text.includes('[text='), false);
  assert.equal(text.includes('[unknownAttribute='), false);
});

test('wrong basic shape and invalid regex reject', t => {
  const data = subscription([group(0, [rule(0, { matches: '[text~="["]' })])]);
  data.id = 'one'; data.version = 'one'; data.categories[0].enable = 'yes';
  const { command, report } = run(t, data);
  assert.equal(command.status, 1);
  assert.ok(report.errors.some(error => error.code === 'schema-id'));
  assert.ok(report.errors.some(error => error.code === 'schema-version'));
  assert.ok(report.regexCompilerCalls >= 1);
});

test('group shared keys inherit, version patterns compile, and invalid version regex rejects', t => {
  const data = subscription([group(0, [rule(0)], { actionMaximumKey: 0, versionName: { pattern: '[' } })]);
  const { command, report } = run(t, data);
  assert.equal(command.status, 1);
  assert.ok(report.errors.some(error => error.code === 'invalid-version-pattern'));
  assert.equal(report.counts.sharedMaximumReferences, 1);
});

test('empty placeholders do not produce a passing executable export', t => {
  const { command, report } = run(t, subscription([group(0, [{}]), group(1, [])]));
  assert.equal(command.status, 1);
  assert.ok(report.errors.some(error => error.code === 'export-rule-without-positive-selector'));
  assert.ok(report.warnings.some(warning => warning.code === 'empty-group'));
});

test('invalid JSON5 produces a failed report without echoing input', t => {
  const { command, report, text } = run(t, '{ secretSelectorBody: ');
  assert.equal(command.status, 1);
  assert.ok(report.errors.some(error => error.code === 'json5-parse'));
  assert.equal(text.includes('secretSelectorBody'), false);
});

test('description names may repeat and coordinate/swipe shapes accept supported defaults', t => {
  const data = subscription([group(0, [
    rule(0, { name: 'same description', position: { left: 10, top: 'height * 0.5' } }),
    rule(1, { name: 'same description', action: 'swipe', swipeArg: { start: { x: 10, y: 20 }, duration: 100 } })
  ])]);
  const { command, report } = run(t, data);
  assert.equal(command.status, 0);
  assert.equal(report.counts.positionObjects, 2);
  assert.equal(report.counts.swipeArguments, 1);
});

test('bad coordinate shape, missing axes and swipe duration are rejected', t => {
  const data = subscription([group(0, [rule(0, {
    position: { left: [] }, swipeArg: { start: { x: 1, y: 2 }, end: false, duration: -10 }
  })])]);
  const { command, report } = run(t, data);
  assert.equal(command.status, 1);
  for (const code of ['schema-position-coordinate', 'missing-vertical-coordinate', 'schema-position', 'schema-swipe-duration']) {
    assert.ok(report.errors.some(error => error.code === code), code);
  }
});

test('32-bit key/version bounds reject values that are still JS-safe integers', t => {
  const data = subscription([group(2147483648)]);
  data.version = 2147483648;
  const { command, report } = run(t, data);
  assert.equal(command.status, 1);
  assert.ok(report.errors.some(error => error.code === 'schema-version'));
  assert.ok(report.errors.some(error => error.code === 'schema-group-key'));
});
