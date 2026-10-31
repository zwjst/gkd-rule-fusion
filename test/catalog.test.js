import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash, normalizeSource, audit, plan } from '../src/core.js';
import { initialGroupState, createCatalog, csv, catalogHtml } from '../src/catalog.js';

test('application category default takes precedence over explicit group enable', () => {
  const result = initialGroupState({ name: '权限控制-通知', enable: false }, [{ name: '权限控制', enable: true }]);
  assert.equal(result.enabled, true);
});
test('category matching uses first prefix instead of longest prefix', () => {
  const result = initialGroupState({ name: '广告-全屏-关闭' }, [
    { name: '广告', enable: false }, { name: '广告-全屏', enable: true }]);
  assert.equal(result.enabled, false);
  assert.equal(result.category, '广告');
});
test('undefined category enable falls back to group, then true', () => {
  assert.equal(initialGroupState({ name: '开屏', enable: false }, [{ name: '开屏' }]).enabled, false);
  assert.equal(initialGroupState({ name: '开屏' }, []).enabled, true);
});
test('global groups ignore categories', () => {
  assert.equal(initialGroupState({ name: '开屏' }, [{ name: '开屏', enable: false }], true).enabled, true);
});
test('catalog separates placeholder packages and raw rule records from explicit selectors', () => {
  const data = { id: 1, version: 1, name: 'test', apps: [
    { id: 'test.real', name: '真实示例', groups: [{ key: 0, name: '开屏', rules: '[text="test"]' }] },
    { id: 'test.empty', name: '提示示例', groups: [{ key: 0, name: '请移步其他App', rules: [{}] }] }] };
  const source = { id: 'fixture', repository: 'test/fixture', file: 'rules.json5' };
  const lock = { commit: 'a'.repeat(40), files: { 'rules.json5': hash(data) } };
  const loaded = [{ source, data, lock, rows: normalizeSource(source, data, lock) }];
  const report = audit(loaded), reviewPlan = plan(report, {});
  const c = createCatalog(loaded, report, reviewPlan, '0.1.0');
  assert.equal(c.totals.appEntriesUnion, 2);
  assert.equal(c.totals.appsWithExplicitSelectors, 1);
  assert.equal(c.totals.ruleRecords, 2);
  assert.equal(c.totals.selectorBearingRuleRecords, 1);
  assert.equal(c.groups.find(g => g.appId === 'test.empty').status, '待审核');
  assert.equal(JSON.stringify(c).includes('[text='), false);
  assert.ok(catalogHtml(c).includes('test.real'));
});
test('CSV escapes embedded quotes and upstream spreadsheet formulas', () => {
  const output = csv([['=SUM(1,2)', 'a"b', '@foo']]);
  assert.equal(output, '\uFEFF"\'=SUM(1,2)","a""b","\'@foo"\r\n');
});
