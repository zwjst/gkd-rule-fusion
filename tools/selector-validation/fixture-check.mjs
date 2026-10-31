import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('check.mjs', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
function fixture(t, groups) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gkd-selector-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, '.cache/fusion/fixture');
  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(path.join(root, 'config'));
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  const config = { schemaVersion: 1, sources: [{ id: 'fixture', repository: 'test/fixture', file: 'rules.json5' }] };
  const text = JSON.stringify({ apps: [{ id: 'test.app', groups }] });
  fs.writeFileSync(path.join(repo, 'rules.json5'), text);
  git('init', '-q'); git('add', '.');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'fixture');
  const lock = { schemaVersion: 1, configHash: hash(JSON.stringify(canonical(config))), sources: { fixture: {
    repository: 'test/fixture', commit: git('rev-parse', 'HEAD'), files: { 'rules.json5': hash(text) }
  } } };
  const saveConfig = () => fs.writeFileSync(path.join(root, 'config/sources.json'), JSON.stringify(config));
  const saveLock = () => fs.writeFileSync(path.join(root, 'sources.lock.json'), JSON.stringify(lock));
  saveConfig(); saveLock();
  const output = path.join(root, 'out.json');
  const run = () => spawnSync(process.execPath, [script, '--root', root, '--out', output], { encoding: 'utf8' });
  return { root, config, lock, output, saveConfig, saveLock, run };
}

test('real selector failure returns nonzero with locations and without selector bodies', t => {
  const f = fixture(t, [{ key: 0, rules: [{ matches: '[text=' }] }]);
  const result = f.run();
  assert.equal(result.status, 1);
  const text = fs.readFileSync(f.output, 'utf8');
  const report = JSON.parse(text);
  assert.equal(report.total.failedUniqueSelectorsAcrossSources, 1);
  assert.equal(report.failures[0].references[0].appId, 'test.app');
  assert.equal(report.failures[0].references[0].field, 'matches');
  assert.equal(text.includes('[text='), false);
});

test('configuration and locked content tampering both reject before producing a report', t => {
  const f = fixture(t, [{ key: 0, rules: [{ matches: '[text="test"]' }] }]);
  f.config.sources[0].repository = 'test/changed'; f.saveConfig();
  assert.match(f.run().stderr, /configuration hash/);
  assert.equal(fs.existsSync(f.output), false);
  f.config.sources[0].repository = 'test/fixture'; f.saveConfig();
  f.lock.sources.fixture.files['rules.json5'] = '0'.repeat(64); f.saveLock();
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /digest mismatch/);
  assert.equal(fs.existsSync(f.output), false);
});

test('all three selector fields, group inheritance, and duplicate references are counted', t => {
  const f = fixture(t, [{ key: 0, matches: '[text="test"]', rules: [
    { anyMatches: ['[text="test"]', '[text="other"]'] },
    { excludeMatches: '[text="exclude"]' }
  ] }]);
  assert.equal(f.run().status, 0);
  const report = JSON.parse(fs.readFileSync(f.output, 'utf8'));
  assert.equal(report.total.definitionReferences, 4);
  assert.equal(report.total.effectiveRuleReferences, 5);
  assert.equal(report.sources[0].inheritedEffectiveReferences, 2);
  assert.equal(report.total.uniqueSelectorsAcrossSources, 3);
  assert.equal(report.total.failedUniqueSelectorsAcrossSources, 0);
  assert.ok(Object.values(report.controls).every(control => control.ok));
});
