import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import JSON5 from 'json5';
import { audit, hash, markdown, normalizeSource, plan } from './core.js';
import { createCatalog, appCsv, groupCsv, catalogMarkdown, catalogHtml } from './catalog.js';

const args = process.argv.slice(2);
const command = args.shift();
function option(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing ${name} value`);
  const value = args[i + 1]; args.splice(i, 2); return value;
}
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args],
  { maxBuffer: 50 * 1024 * 1024, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });

try {
  const configPath = option('--sources', 'config/sources.json');
  const lockPath = option('--lock', 'sources.lock.json');
  const cache = path.resolve(option('--cache', '.cache/fusion'));
  const out = option('--out', 'reports/latest');
  const policyPath = option('--policy', 'config/policy.json');
  const update = args.includes('--update');
  if (update) args.splice(args.indexOf('--update'), 1);
  if (args.length || !['sync', 'audit', 'plan', 'catalog'].includes(command)) throw new Error(
    'Usage: node src/cli.js sync [--update] | audit | plan | catalog [--cache DIR --out DIR --sources FILE --lock FILE --policy FILE]');
  if (update && command !== 'sync') throw new Error('--update only valid for sync');
  const config = read(configPath);
  if (config.schemaVersion !== 1 || !Array.isArray(config.sources) || !config.sources.length) throw new Error('Invalid sources');
  const ids = new Set();
  for (const s of config.sources) {
    if (!/^[A-Za-z0-9_-]+$/.test(s.id) || ids.has(s.id) ||
        !/^[\w.-]+\/[\w.-]+$/.test(s.repository) || !s.ref || s.ref.startsWith('-')) throw new Error('Invalid source identity');
    ids.add(s.id);
    for (const p of [s.file, ...s.licenseFiles]) if (path.isAbsolute(p) || p.split('/').includes('..') || !p) throw new Error('Unsafe source path');
  }
  const configHash = hash(config);
  let lock = update ? { schemaVersion: 1, configHash, sources: {} } : read(lockPath);
  if (!update && (lock.schemaVersion !== 1 || lock.configHash !== configHash)) throw new Error('Source configuration changed; run sync --update and review lock diff');
  const loaded = [];
  for (const source of config.sources) {
    const dir = path.join(cache, source.id);
    if (command === 'sync') {
      fs.mkdirSync(cache, { recursive: true });
      if (!fs.existsSync(dir)) execFileSync('git', ['init', '--quiet', dir], { timeout: 30000 });
      const remote = `https://github.com/${source.repository}.git`;
      const target = update ? source.ref : lock.sources[source.id]?.commit;
      if (!target || (!update && !/^[a-f0-9]{40}$/.test(target))) throw new Error('Invalid locked commit');
      git(dir, 'fetch', '--depth=1', '--no-tags', remote, target);
      const commit = git(dir, 'rev-parse', 'FETCH_HEAD^{commit}').toString().trim();
      if (!update && commit !== target) throw new Error('Fetched commit mismatch');
      if (update) {
        const files = {};
        for (const file of [source.file, ...source.licenseFiles]) files[file] = hash(git(dir, 'show', `${commit}:${file}`));
        lock.sources[source.id] = { repository: source.repository, commit,
          committedAt: git(dir, 'show', '-s', '--format=%cI', commit).toString().trim(), files };
      }
    }
    const entry = lock.sources[source.id];
    if (!entry || entry.repository !== source.repository || !/^[a-f0-9]{40}$/.test(entry.commit)) throw new Error(`Invalid lock: ${source.id}`);
    for (const file of [source.file, ...source.licenseFiles]) {
      if (hash(git(dir, 'show', `${entry.commit}:${file}`)) !== entry.files[file]) throw new Error(`Digest mismatch: ${source.id}/${file}`);
    }
    const data = JSON5.parse(git(dir, 'show', `${entry.commit}:${source.file}`).toString());
    loaded.push({ source, lock: entry, data, rows: normalizeSource(source, data, entry) });
    console.log(`${source.id}: ${entry.commit} (${data.apps.length} apps)`);
  }
  if (command === 'sync') {
    if (update) write(lockPath, lock);
    console.log(update ? `Updated ${lockPath}; inspect and commit this diff.` : 'Locked inputs verified.');
  } else {
    const report = audit(loaded);
    report.inputFingerprint = hash(lock);
    write(path.join(out, 'audit.json'), report);
    write(path.join(out, 'AUDIT.md'), markdown(report));
    const summary = {
      schemaVersion: 1, inputFingerprint: report.inputFingerprint,
      unionApps: new Set(report.groups.filter(g => g.app !== '@global').map(g => g.app)).size,
      summary: report.summary, overlaps: report.overlaps,
      counts: { groups: report.groups.length, exactGroupClusters: report.exactGroups.length,
        exactRuleClusters: report.exactRules.length, structuralGroupClusters: report.structuralGroups.length,
        structuralRuleClusters: report.structuralRules.length, potentialConflictSignals: report.conflicts.length },
      referenceFindings: report.groups.filter(g => g.referenceFindings.length).map(g => ({
        id: g.id, findings: g.referenceFindings, provenance: g.provenance })),
      reportSha256: hash(fs.readFileSync(path.join(out, 'audit.json')))
    };
    if (command === 'plan' || command === 'catalog') {
      const policy = read(policyPath);
      if (policy.schemaVersion !== 1) throw new Error('Unsupported policy version');
      const result = plan(report, policy);
      result.inputFingerprint = hash(lock);
      result.policyFingerprint = hash(policy);
      write(path.join(out, 'fusion-plan.json'), result);
      summary.plan = { proposed: result.selected.length, pending: result.pending.length,
        rejected: result.rejected.length, multiSourceApps: result.multiSourceApps.length,
        publicationReady: result.publicationReady };
      summary.planSha256 = hash(fs.readFileSync(path.join(out, 'fusion-plan.json')));
      console.log(`Plan: ${result.selected.length} proposed, ${result.pending.length} pending; publicationReady=false`);
      if (command === 'catalog') {
        const catalog = createCatalog(loaded, report, result, read(new URL('../package.json', import.meta.url)).version);
        write(path.join(out, 'catalog.json'), catalog);
        write(path.join(out, 'apps.csv'), appCsv(catalog));
        write(path.join(out, 'rule-groups.csv'), groupCsv(catalog));
        write(path.join(out, 'APP_CATALOG.md'), catalogMarkdown(catalog));
        write(path.join(out, 'catalog.html'), catalogHtml(catalog));
        summary.inventory = catalog.totals;
        console.log(`Catalog: ${catalog.totals.appEntriesUnion} app entries; ${catalog.totals.appsWithExplicitSelectors} with explicit selectors.`);
      }
    }
    write(path.join(out, 'summary.json'), summary);
    console.log(`Wrote ${out}`);
  }
} catch (error) {
  // Avoid dumping child-process stderr: proxies may include credential details.
  console.error(error.stderr ? `Git operation failed (exit ${error.status}); check repository/ref and proxy access.` : error.message);
  process.exitCode = 1;
}
