// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import JSON5 from 'json5';
import { hash, normalizeSource } from '../src/core.js';
import { fuse } from '../src/export.js';
import { csv } from '../src/catalog.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceCache = process.env.FUSION_SOURCE_CACHE ? path.resolve(process.env.FUSION_SOURCE_CACHE) : path.join(root, '.cache/fusion');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n');
};
const git = (id, ...args) => execFileSync('git', ['-C', path.join(sourceCache, id), ...args],
  { maxBuffer: 100 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
const published = fs.existsSync(path.join(root, 'dist/manifest.json')) ? read('dist/manifest.json') : null;
function archivedSource(id, commit) {
  const record = published?.sourceArchives.find(s => s.source === id && s.commit === commit);
  if (!record || !record.archive.startsWith('third_party/sources/') || record.archive.split('/').includes('..')) {
    throw new Error(`No verified source archive for ${id}/${commit}; run npm run sync`);
  }
  const file = path.join(root, record.archive), bytes = fs.readFileSync(file);
  if (hash(bytes) !== record.sha256) throw new Error(`Source archive checksum mismatch: ${id}`);
  return { file, bytes };
}
function sourceFile(id, commit, file) {
  try { return git(id, 'show', `${commit}:${file}`); }
  catch {
    const archive = archivedSource(id, commit);
    return execFileSync('tar', ['-xOf', archive.file, `${id}/${file}`],
      { maxBuffer: 50 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  }
}

const config = read('config/sources.json'), lock = read('sources.lock.json');
const release = read('config/fusion.json'), policy = read('config/policy.json');
if (lock.configHash !== hash(config)) throw new Error('Source configuration/lock mismatch');
if (Object.keys(policy.decisions ?? {}).length) throw new Error('Audit group decisions need explicit migration before an atomic App-source release');
const previousState = fs.existsSync(path.join(root, 'config/fusion-state.json')) ? read('config/fusion-state.json') : {};
const loaded = [];
for (const source of config.sources) {
  if (!release.sourcePriority.includes(source.id)) {
    loaded.push({ source, lock: lock.sources[source.id] });
    continue;
  }
  const entry = lock.sources[source.id];
  if (!entry || !/^[a-f0-9]{40}$/.test(entry.commit) || entry.repository !== source.repository) throw new Error(`Invalid source lock: ${source.id}`);
  for (const file of [source.file, ...source.licenseFiles]) {
    if (hash(sourceFile(source.id, entry.commit, file)) !== entry.files[file]) throw new Error(`Source checksum mismatch: ${source.id}/${file}`);
  }
  const data = JSON5.parse(sourceFile(source.id, entry.commit, source.file).toString());
  loaded.push({ source, lock: entry, data, rows: normalizeSource(source, data, entry) });
}
const result = fuse(loaded, release, previousState, policy);
const subscriptionText = JSON.stringify(result.subscription, null, 2) + '\n';
const stage = path.join(root, '.cache', 'fusion-release');
fs.mkdirSync(stage, { recursive: true });
write(path.join(stage, 'gkd.json5'), subscriptionText);
execFileSync(process.execPath, ['tools/selector-validation/check-export.mjs', '--file', path.join(stage, 'gkd.json5'),
  '--out', path.join(stage, 'validation.json')], { cwd: root, stdio: 'inherit' });
const output = path.join(root, 'dist');
if (fs.existsSync(path.join(output, 'gkd.json5'))) {
  const previous = read('dist/gkd.json5');
  if (previous.id !== release.id || release.version < previous.version ||
      (previous.version === release.version && hash(fs.readFileSync(path.join(output, 'gkd.json5'))) !== hash(subscriptionText))) {
    throw new Error('Published identity/version invariant violated; increment the version for changed subscription bytes');
  }
}
const sourceArchives = [];
for (const id of release.sourcePriority) {
  const { source, lock: entry } = loaded.find(s => s.source.id === id);
  const archiveName = `third_party/sources/${id}-${entry.commit.slice(0, 12)}.tar.gz`;
  let archive;
  try { archive = git(id, 'archive', '--format=tar.gz', `--prefix=${id}/`, entry.commit); }
  catch { archive = archivedSource(id, entry.commit).bytes; }
  write(path.join(root, archiveName), archive);
  for (const file of source.licenseFiles) write(path.join(root, 'third_party/notices', id, path.basename(file)), sourceFile(id, entry.commit, file));
  write(path.join(root, 'third_party/notices', id, 'package.json'), sourceFile(id, entry.commit, 'package.json'));
  sourceArchives.push({ source: id, repository: source.repository, commit: entry.commit, license: source.license,
    archive: archiveName, sha256: hash(archive), subscriptionPath: source.file, subscriptionSha256: entry.files[source.file] });
}
write(path.join(output, 'gkd.json5'), subscriptionText);
write(path.join(output, 'gkd.version.json'), { id: release.id, version: release.version });
fs.copyFileSync(path.join(stage, 'validation.json'), path.join(output, 'validation.json'));
write(path.join(output, 'provenance.json'), result.provenance);
write(path.join(output, 'quarantine.json'), result.provenance.quarantine);
write(path.join(output, 'apps.csv'), csv([
  ['软件名称', '包名', '本订阅实际来源', '应用组数', '规则数', '配置默认开启组数'],
  ...result.subscription.apps.map(app => [app.name ?? app.id, app.id,
    [...new Set(result.provenance.included.filter(g => g.appId === app.id).map(g => g.source))].join('/'),
    app.groups.length, app.groups.reduce((n, g) => n + g.rules.length, 0), app.groups.filter(g => g.enable).length])
]));
write(path.join(output, 'rule-groups.csv'), csv([
  ['软件名称', '包名', '来源', '组key', '规则组名称', '规则数', '配置默认开关'],
  ...result.provenance.included.map(g => [
    g.appId === '@global' ? '全局规则' : result.subscription.apps.find(a => a.id === g.appId)?.name ?? g.appId,
    g.appId, g.source, g.outputKey, g.name, g.rules.length, g.initialEnable ? '开' : '关'])
]));
write(path.join(root, 'config/fusion-state.json'), result.state);
const manifest = {
  schemaVersion: 1, projectVersion: read('package.json').version,
  id: release.id, version: release.version, channel: release.channel,
  subscriptionUrl: 'https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd.json5',
  versionUrl: 'https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd.version.json',
  license: 'GPL-3.0-only', counts: result.counts, sourceArchives,
  inputFingerprint: hash(lock), releaseConfigSha256: hash(release), personalPolicySha256: hash(policy),
  subscriptionSha256: hash(subscriptionText),
  validationSha256: hash(fs.readFileSync(path.join(output, 'validation.json'))),
  deviceVerified: false, releaseStatus: 'experimental-not-device-verified'
};
write(path.join(output, 'manifest.json'), manifest);
write(path.join(output, 'LICENSE'), fs.readFileSync(path.join(root, 'LICENSE')));
write(path.join(output, 'NOTICE.md'), [
  '# 版权、许可与修改说明', '',
  `本派生订阅由 zwjst 于 ${release.modifiedAt} 修改并构建；订阅 ID ${release.id}，版本 ${release.version}。`,
  '派生订阅整体按 GPL-3.0-only 提供，完整条款见 [LICENSE](LICENSE)。', '',
  '基于 aoguai/subscription（GPL-3.0-only）和 ganlinte/GKD-subscription（MIT）。感谢两源维护者。',
  '保留 ganlinte 的 Copyright (c) 2024 ganlinte 及 MIT 全文；原许可证及声明见 [notices](../third_party/notices)。', '',
  '## 修改内容', '',
  '- 使用独立订阅身份、名称、版本、作者和本仓库更新地址。',
  '- 每个 App 固定一个来源，共享 App 优先 aoguai，其余由 ganlinte 补充；仅保留 aoguai 全局组。',
  '- 将来源分类默认值显式写入组 enable，分类按名称稳定分配 key；组名、组/规则 key、选择器及规则顺序保留。',
  '- 整组隔离未解析依赖与空占位组；详情见 [quarantine.json](quarantine.json)。不删除单条前置条件来掩盖问题。',
  '- 加入个人覆盖层、持久来源账本、官方选择器及独立结构/依赖检查。',
  '- 全局组会看到新增 App 组，disableIfAppGroupMatch 适用范围随结构改变；手机实际行为尚未验证。', '',
  '## 对应源码', '',
  '本仓库的 src/export.js、scripts/build-fusion.js、配置与锁文件是融合构建源码。两源固定提交完整源树也随本仓库提供：',
  ...sourceArchives.map(s => `- [${s.source} ${s.commit}]` + `(../${s.archive})；许可 ${s.license}；SHA-256 ${s.sha256}`),
  '', '归档包含上游 preferred TypeScript 源码、构建脚本、依赖锁、原始订阅及许可声明，不含 .git 或认证配置。',
  '不从未明确再发布许可的 Lin-arm、yanmuq 复制规则到此订阅。'
].join('\n') + '\n');
const sumFiles = ['gkd.json5', 'gkd.version.json', 'validation.json', 'provenance.json', 'quarantine.json', 'manifest.json', 'LICENSE', 'NOTICE.md', 'apps.csv', 'rule-groups.csv'];
if (fs.existsSync(path.join(output, 'README.md'))) sumFiles.push('README.md');
write(path.join(output, 'files.sha256'), sumFiles.map(file => `${hash(fs.readFileSync(path.join(output, file)))}  ${file}`).join('\n') + '\n');
console.log(JSON.stringify({ ...result.counts, id: release.id, version: release.version, channel: release.channel }, null, 2));
