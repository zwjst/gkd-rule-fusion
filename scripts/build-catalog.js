import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { hash } from '../src/core.js';

// Build public metadata only. This command neither exports subscriptions nor pushes Git.
const root = fileURLToPath(new URL('../', import.meta.url));
const stage = path.join(root, '.cache', 'catalog-publication');
const target = path.join(root, 'catalog');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, value) => fs.writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const run = args => execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' });

run(['src/cli.js', 'catalog', '--out', stage]);
run(['tools/selector-validation/check.mjs', '--out', path.join(stage, 'selector-validation.json')]);
const catalog = read(path.join(stage, 'catalog.json'));
const selectors = read(path.join(stage, 'selector-validation.json'));
const summary = read(path.join(stage, 'summary.json'));
const lock = read(path.join(root, 'sources.lock.json'));
const fixedDate = '2026-10-31';
const reviewedSnapshot = read(path.join(root, 'reports', fixedDate, 'summary.json'));
if (reviewedSnapshot.inputFingerprint !== hash(lock)) {
  throw new Error('The publication validation note belongs to a different snapshot; regenerate and review the dated reports before publishing.');
}
if (catalog.inputFingerprint !== hash(lock) || summary.inputFingerprint !== hash(lock)) {
  throw new Error('Public catalog input fingerprint mismatch');
}
if (selectors.total.failedUniqueSelectorsAcrossSources ||
    !Object.values(selectors.controls).every(c => c.ok)) throw new Error('Selector validation did not pass');
for (const source of selectors.sources) {
  if (source.commit !== lock.sources[source.source]?.commit ||
      source.sha256 !== lock.sources[source.source]?.files[
        catalog.groups.find(g => g.source === source.source)?.provenance.path]) {
    throw new Error(`Selector/catalog inputs differ: ${source.source}`);
  }
}

const files = new Map([
  ['APP_CATALOG.md', 'APP_CATALOG.md'], ['catalog.html', 'index.html'],
  ['catalog.json', 'catalog.json'], ['apps.csv', 'apps.csv'],
  ['rule-groups.csv', 'rule-groups.csv'], ['AUDIT.md', 'AUDIT.md'],
  ['audit.json', 'audit.json'], ['fusion-plan.json', 'fusion-plan.json'],
  ['summary.json', 'summary.json'], ['selector-validation.json', 'selector-validation.json']
]);
const lines = [
  '# 软件与规则完整清单', '',
  `项目版本 **${catalog.projectVersion}**；固定输入快照见 [sources.lock.json](sources.lock.json)。`, '',
  `共 **${catalog.totals.appEntriesUnion} 个包名条目**，其中 **${catalog.totals.appsWithExplicitSelectors} 个有显式选择器**。`,
  `原始应用组 ${catalog.totals.appGroupRecords}，全局组 ${catalog.totals.globalGroupRecords}，规则记录 ${catalog.totals.ruleRecords}；跨来源保留重复。`, '',
  '## 查看与下载', '',
  '- [在线阅读全部软件与逐组清单](APP_CATALOG.md)',
  '- [软件总表 CSV](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/apps.csv)',
  '- [逐组规则 CSV](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/rule-groups.csv)',
  '- [完整机器数据 JSON](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/catalog.json)',
  '- [下载交互清单 HTML](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/index.html)：保存为 HTML 后在浏览器本地打开，可搜索、筛选、展开；GitHub 文件页不执行 HTML。',
  '- [校验说明](VALIDATION.md)、[选择器结果](selector-validation.json)、[审计摘要](AUDIT.md)、[统计 JSON](summary.json)',
  '- [完整静态审计 JSON](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/audit.json)、[融合审核计划](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/fusion-plan.json)',
  '- [SHA-256 文件校验清单](files.sha256)', '',
  '## 订阅入口与边界', '',
  '[上游官方订阅地址与 GKD 导入步骤](../docs/SUBSCRIPTIONS.md)。本目录是数据清单，不是 GKD 订阅文件；catalog.json 和 fusion-plan.json 都不能作为订阅导入。', '',
  '本仓库尚未发布融合订阅。规则名称代表上游收录功能，不表示实际匹配、点击或设备兼容已验证。',
  '初始开关是订阅配置默认值，假设 App 已安装且无用户覆盖；实际运行还受组有效性、订阅/App总开关、版本、活动及其他条件影响。', '',
  '## 来源与署名', '',
  '| 来源 | 固定提交 | 上游版本 | 包名条目 |',
  '| --- | --- | ---: | ---: |'
];
for (const source of catalog.sources) {
  const group = catalog.groups.find(g => g.source === source.source);
  lines.push(`| [${source.source}](https://github.com/${group.provenance.repository}) | [${source.commit.slice(0, 12)}](https://github.com/${group.provenance.repository}/tree/${source.commit}) | ${source.version} | ${source.appEntries} |`);
}
lines.push('', '感谢各上游维护者。本目录仅提供调查元数据、名称、约束、摘要及定位，不复制选择器定义、快照图像或上游源码。',
  '许可证证据与未解决问题见 [调查结论](../docs/UPSTREAM_RESEARCH.md)。上游链接仍由原作者维护；链接列入本表不表示重新授权其内容。', '',
  '## 复现', '',
  '在项目根目录安装主依赖与独立校验工具依赖，运行 `npm run sync`，再运行 `npm run build:catalog`。',
  '构建读取锁定提交，不更新上游，不上传或推送。发布文件使用固定输入元数据，不注入当前时间。', '');

// The allowlist protects unrelated user files when refreshing an existing catalog.
const owned = new Set([...files.values(), 'README.md', 'VALIDATION.md', 'sources.lock.json', 'version.json', 'files.sha256']);
if (fs.existsSync(target)) {
  for (const name of fs.readdirSync(target)) if (!owned.has(name)) throw new Error(`Unmanaged public catalog file: ${name}`);
}
fs.mkdirSync(target, { recursive: true });
for (const [from, to] of files) {
  if (from === 'APP_CATALOG.md') {
    write(path.join(target, to), fs.readFileSync(path.join(stage, from), 'utf8').replaceAll('catalog.html', 'index.html'));
  } else fs.copyFileSync(path.join(stage, from), path.join(target, to));
}
write(path.join(target, 'README.md'), lines.join('\n'));
let validation = fs.readFileSync(path.join(root, 'reports', fixedDate, 'VALIDATION.md'), 'utf8');
validation = validation.replaceAll('../../tools/', '../tools/').replaceAll('`catalog.html`', '`index.html`')
  .replaceAll('cd /workspace/gkd-rule-fusion', 'cd gkd-rule-fusion');
write(path.join(target, 'VALIDATION.md'), validation);
fs.copyFileSync(path.join(root, 'sources.lock.json'), path.join(target, 'sources.lock.json'));
write(path.join(target, 'version.json'), {
  schemaVersion: 1, projectVersion: catalog.projectVersion, inputFingerprint: hash(lock),
  catalogSha256: hash(fs.readFileSync(path.join(target, 'catalog.json'))),
  subscriptionStatus: 'not-published', metadataOnly: true
});
const sums = [...owned].filter(f => f !== 'files.sha256').sort().map(file =>
  `${hash(fs.readFileSync(path.join(target, file)))}  ${file}`);
write(path.join(target, 'files.sha256'), sums.join('\n') + '\n');
console.log(`Built ${owned.size} public catalog files in ${target}; no subscription exported and no Git push performed.`);
