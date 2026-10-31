import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hash } from '../src/core.js';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'cache', 'fixture'); fs.mkdirSync(repo, { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  git('init', '--quiet');
  const content = `{id:1, name:'fixture', version:1, apps:[{id:'test.app',groups:[{key:0,name:'test',rules:'[text="test"]'}]}]}`;
  fs.writeFileSync(path.join(repo, 'rules.json5'), content);
  fs.writeFileSync(path.join(repo, 'LICENSE'), 'Fixture only');
  git('add', '.'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'fixture');
  const config = { schemaVersion: 1, sources: [{ id: 'fixture', repository: 'test/fixture', ref: 'main',
    file: 'rules.json5', licenseFiles: ['LICENSE'], license: 'test', publicationApproved: false }] };
  const lock = { schemaVersion: 1, configHash: hash(config), sources: { fixture: {
    repository: 'test/fixture', commit: git('rev-parse', 'HEAD'), files: {
      'rules.json5': hash(content), LICENSE: hash('Fixture only') } } } };
  fs.writeFileSync(path.join(root, 'sources.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(root, 'lock.json'), JSON.stringify(lock));
  fs.writeFileSync(path.join(root, 'policy.json'), JSON.stringify({ schemaVersion: 1, overrides: [], decisions: {} }));
  const run = command => spawnSync(process.execPath, [cli, command, '--sources', 'sources.json', '--lock', 'lock.json',
    '--cache', 'cache', '--out', 'out', '--policy', 'policy.json'], { cwd: root, encoding: 'utf8' });
  return { root, repo, lock, run };
}
test('CLI offline plan verifies locked Git content and writes reproducible reports', t => {
  const f = fixture(t);
  assert.equal(f.run('plan').status, 0);
  const output = fs.readFileSync(path.join(f.root, 'out/fusion-plan.json'), 'utf8');
  assert.equal(JSON.parse(output).selected.length, 1);
  assert.equal(f.run('plan').status, 0);
  assert.equal(fs.readFileSync(path.join(f.root, 'out/fusion-plan.json'), 'utf8'), output);
  // Working tree edits never replace locked blobs.
  fs.writeFileSync(path.join(f.repo, 'rules.json5'), 'tampered');
  assert.equal(f.run('audit').status, 0);
});
test('CLI refuses lockfile content checksum mismatch', t => {
  const f = fixture(t); f.lock.sources.fixture.files['rules.json5'] = '0'.repeat(64);
  fs.writeFileSync(path.join(f.root, 'lock.json'), JSON.stringify(f.lock));
  const result = f.run('audit'); assert.equal(result.status, 1); assert.match(result.stderr, /Digest mismatch/);
  assert.equal(fs.existsSync(path.join(f.root, 'out/audit.json')), false);
});
test('CLI refuses stale source configuration', t => {
  const f = fixture(t); const configPath = path.join(f.root, 'sources.json');
  const config = JSON.parse(fs.readFileSync(configPath)); config.sources[0].publicationApproved = true;
  fs.writeFileSync(configPath, JSON.stringify(config));
  assert.match(f.run('audit').stderr, /configuration changed/);
});
test('CLI catalog generates consistent inventory and readable exports', t => {
  const f = fixture(t), result = f.run('catalog');
  assert.equal(result.status, 0, result.stderr);
  const get = file => fs.readFileSync(path.join(f.root, 'out', file), 'utf8');
  const catalog = JSON.parse(get('catalog.json')), summary = JSON.parse(get('summary.json'));
  assert.equal(catalog.totals.appEntriesUnion, 1);
  assert.deepEqual(summary.inventory, catalog.totals);
  assert.match(get('APP_CATALOG.md'), /test.app/);
  assert.match(get('apps.csv'), /test.app/);
  assert.match(get('rule-groups.csv'), /test.app/);
  assert.match(get('catalog.html'), /test.app/);
  assert.equal(get('catalog.json').includes('[text='), false);
});
