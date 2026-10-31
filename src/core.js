import { createHash } from 'node:crypto';

export function canonical(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite number');
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(k => [k, canonical(value[k])])
  );
  return value;
}
export const hash = value => createHash('sha256').update(
  typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(canonical(value))
).digest('hex');
const omit = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const metadata = ['name', 'desc', 'exampleUrls', 'snapshotUrls', 'excludeSnapshotUrls'];
const listFields = ['matches', 'anyMatches', 'excludeMatches', 'activityIds', 'excludeActivityIds',
  'versionCodes', 'excludeVersionCodes', 'versionNames', 'excludeVersionNames', 'preKeys'];
const asList = value => value === undefined ? [] : Array.isArray(value) ? value : [value];

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(omit(value, metadata)).map(([k, v]) =>
    [k, listFields.includes(k) ? asList(v).map(normalize) : normalize(v)]));
}

export function validateSubscription(data) {
  if (!data || !Number.isSafeInteger(data.id) || !Number.isSafeInteger(data.version) ||
      typeof data.name !== 'string') throw new Error('Invalid subscription metadata');
  if (!Array.isArray(data.apps)) throw new Error('apps must be an array');
  const appIds = new Set();
  for (const app of data.apps) {
    if (typeof app.id !== 'string' || !app.id || appIds.has(app.id)) throw new Error('Invalid/duplicate app id');
    appIds.add(app.id);
    if (!Array.isArray(app.groups)) throw new Error(`${app.id}: groups must be an array`);
  }
  for (const groups of [data.globalGroups ?? [], ...data.apps.map(a => a.groups)]) {
    if (!Array.isArray(groups)) throw new Error('globalGroups must be an array');
    const keys = new Set();
    for (const group of groups) {
      if (!Number.isSafeInteger(group.key) || keys.has(group.key)) throw new Error('Invalid/duplicate group key');
      keys.add(group.key);
      if (typeof group.name !== 'string' || group.rules === undefined) throw new Error('Invalid group');
      const ruleKeys = new Set();
      for (const raw of asList(group.rules)) {
        const r = typeof raw === 'string' ? { matches: raw } : raw;
        if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('Invalid rule');
        if (r.key !== undefined) {
          if (!Number.isSafeInteger(r.key) || ruleKeys.has(r.key)) throw new Error('Invalid/duplicate rule key');
          ruleKeys.add(r.key);
        }
        for (const field of ['matches', 'anyMatches', 'excludeMatches']) {
          if (r[field] !== undefined && (!asList(r[field]).length ||
              asList(r[field]).some(x => typeof x !== 'string' || !x))) throw new Error(`Invalid ${field}`);
        }
      }
    }
  }
  canonical(data); // Reject Infinity/NaN before fingerprinting.
  return data;
}

export function normalizeSource(source, data, lock) {
  validateSubscription(data);
  const rows = [];
  for (const app of [{ id: '@global', groups: data.globalGroups ?? [] }, ...data.apps]) {
    for (const group of app.groups) {
      const context = { app: omit(app, ['groups', 'name', 'desc']), categories: data.categories ?? [] };
      const rawRules = asList(group.rules).map(r => typeof r === 'string' ? { matches: r } : r);
      const comparisonContext = { app: normalize(context.app), categories: context.categories,
        categoryNameInput: group.name, groupKey: group.key };
      // Scope targets are behavior, even when only the referring group is compared.
      const scopeKeys = new Set([...asList(group.scopeKeys), ...rawRules.flatMap(r => asList(r.scopeKeys))]);
      if (scopeKeys.size) comparisonContext.scopeGroups = app.groups.filter(g => scopeKeys.has(g.key));
      const semantic = { context: comparisonContext, group: normalize({
        ...omit(group, ['key', 'rules']), rules: rawRules
      }) };
      const groupDefaults = omit(group, ['rules', ...metadata]);
      const rules = rawRules.map((r, index) => {
        const effective = { ...groupDefaults, ...r };
        return {
          index, key: r.key ?? null,
          fingerprint: hash({ context: comparisonContext, rule: normalize(effective) }),
          structureFingerprint: hash(normalize(effective)),
          selectorFingerprint: hash({ app: app.id, selectors: Object.fromEntries(
            ['matches', 'anyMatches', 'excludeMatches'].filter(k => effective[k] !== undefined)
              .map(k => [k, asList(effective[k])])) }),
          hasActivityLimit: Boolean(effective.activityIds),
          hasVersionLimit: ['versionCode', 'versionName', 'versionCodes', 'versionNames', 'excludeVersionCodes', 'excludeVersionNames']
            .some(k => effective[k] !== undefined),
          hasTimingLimit: ['matchTime', 'actionMaximum', 'actionCd'].some(k => effective[k] !== undefined),
          hasSnapshotReference: Boolean(asList(r.snapshotUrls ?? group.snapshotUrls).length),
          // A URL is evidence of a reference, never evidence of a successful verification.
          verification: 'unverified'
        };
      });
      const referenceFindings = rawRules.length ? [] : [{ kind: 'empty-placeholder-group', certainty: 'confirmed' }];
      for (const [index, r] of rawRules.entries()) {
        if (!r.matches && !r.anyMatches && !group.matches && !group.anyMatches) {
          referenceFindings.push({ kind: 'rule-without-explicit-selector', ruleIndex: index, certainty: 'potential',
            note: 'Review empty placeholder/client default matching behavior.' });
        }
        const scope = asList(r.scopeKeys ?? group.scopeKeys);
        const scopedGroups = app.groups.filter(g => g === group || scope.includes(g.key));
        for (const key of asList(r.preKeys)) {
          if (!scopedGroups.some(g => asList(g.rules).some(rule => rule?.key === key))) {
            referenceFindings.push({ kind: 'unresolved-explicit-preKey', ruleIndex: index, key,
              certainty: 'potential', note: 'Check client implicit-key semantics and scoped references before declaring invalid.' });
          }
        }
        for (const key of scope) if (!app.groups.some(g => g.key === key)) {
          referenceFindings.push({ kind: 'missing-scope-group', ruleIndex: index, key, certainty: 'potential' });
        }
      }
      rows.push({
        id: `${source.id}:${app.id}:${group.key}`, source: source.id, app: app.id,
        key: group.key, name: group.name, fingerprint: hash(semantic),
        structureFingerprint: hash(semantic.group), rawFingerprint: hash(group),
        rules, referenceFindings, publicationApproved: source.publicationApproved === true,
        provenance: { repository: source.repository, commit: lock.commit, path: source.file,
          sha256: lock.files[source.file], pointer: app.id === '@global'
            ? `/globalGroups/${app.groups.indexOf(group)}`
            : `/apps/${data.apps.indexOf(app)}/groups/${app.groups.indexOf(group)}` }
      });
    }
  }
  return rows;
}

function buckets(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return [...map.values()];
}
const crossSource = rows => new Set(rows.map(r => r.source)).size > 1;

export function audit(sources) {
  const rows = sources.flatMap(s => s.rows);
  const rules = rows.flatMap(g => g.rules.map(r => ({ ...r, group: g.id, source: g.source, app: g.app })));
  const exactGroups = buckets(rows, r => `${r.app}:${r.fingerprint}`)
    .filter(x => x.length > 1).map(x => ({ fingerprint: x[0].fingerprint, members: x.map(g => g.id) }));
  const exactRules = buckets(rules, r => `${r.app}:${r.fingerprint}`)
    .filter(x => x.length > 1).map(x => ({ fingerprint: x[0].fingerprint,
      members: x.map(r => ({ group: r.group, index: r.index })) }));
  const structuralGroups = buckets(rows, r => `${r.app}:${r.structureFingerprint}`)
    .filter(x => crossSource(x)).map(x => ({ fingerprint: x[0].structureFingerprint, members: x.map(g => g.id) }));
  const structuralRules = buckets(rules, r => `${r.app}:${r.structureFingerprint}`)
    .filter(x => crossSource(x)).map(x => ({ fingerprint: x[0].structureFingerprint,
      members: x.map(r => ({ group: r.group, index: r.index })) }));
  const conflicts = buckets(rules, r => r.selectorFingerprint)
    .filter(x => crossSource(x) && new Set(x.map(r => r.fingerprint)).size > 1)
    .map(x => ({ kind: 'same-selector-different-context', certainty: 'potential',
      members: [...new Set(x.map(r => r.group))].sort() }));
  const variants = buckets(rows, r => `${r.app}:${r.name.normalize('NFKC').trim()}`)
    .filter(x => crossSource(x) && new Set(x.map(r => r.fingerprint)).size > 1)
    .map(x => ({ kind: 'same-name-different-implementation', certainty: 'potential', members: x.map(r => r.id) }));
  const appSets = Object.fromEntries(sources.map(s => [s.source.id,
    new Set(s.rows.filter(r => r.app !== '@global').map(r => r.app))]));
  const summary = sources.map(s => ({
    source: s.source.id, repository: s.source.repository, commit: s.lock.commit,
    committedAt: s.lock.committedAt, version: s.data.version, license: s.source.license,
    publicationApproved: s.source.publicationApproved,
    apps: appSets[s.source.id].size,
    exclusiveApps: [...appSets[s.source.id]].filter(id =>
      Object.entries(appSets).every(([other, ids]) => other === s.source.id || !ids.has(id))).sort(),
    appGroups: s.rows.filter(r => r.app !== '@global').length,
    globalGroups: s.rows.filter(r => r.app === '@global').length,
    rules: s.rows.reduce((n, r) => n + r.rules.length, 0),
    referenceFindings: s.rows.reduce((n, r) => n + r.referenceFindings.length, 0),
    indicators: Object.fromEntries(['hasActivityLimit', 'hasVersionLimit', 'hasTimingLimit', 'hasSnapshotReference']
      .map(k => [k, s.rows.flatMap(r => r.rules).filter(r => r[k]).length]))
  }));
  const overlaps = [];
  for (let i = 0; i < summary.length; i++) for (let j = i + 1; j < summary.length; j++) {
    const a = appSets[summary[i].source], b = appSets[summary[j].source];
    overlaps.push({ sources: [summary[i].source, summary[j].source],
      commonApps: [...a].filter(id => b.has(id)).length,
      onlyFirst: [...a].filter(id => !b.has(id)).length,
      onlySecond: [...b].filter(id => !a.has(id)).length });
  }
  return { schemaVersion: 1, summary, overlaps, exactGroups, exactRules, structuralGroups, structuralRules,
    conflicts: [...conflicts, ...variants], groups: rows,
    limitations: ['Static conservative comparison; no selector equivalence proof.',
      'Snapshot URLs are unverified; no Android execution or regression evidence.',
      'Group keys are scoped to source and app. No rule chains are split or renumbered.',
      'Quality indicators are not a correctness or performance score.'] };
}

export function applyOverrides(rows, overrides = []) {
  const result = structuredClone(rows);
  const touched = new Set();
  for (const op of overrides) {
    if (!op.reason || touched.has(op.target)) throw new Error('Override needs a reason and unique target');
    touched.add(op.target);
    if (op.operation === 'add') {
      if (typeof op.app !== 'string' || !op.app || op.app === '@global' ||
          op.target !== `personal:${op.app}:${op.group?.key}` || result.some(r => r.id === op.target)) {
        throw new Error('Invalid personal addition identity');
      }
      const data = { id: 1, name: 'personal', version: 1, apps: [{ id: op.app, groups: [op.group] }] };
      const [row] = normalizeSource({ id: 'personal', repository: 'local/personal', file: 'config/policy.json' },
        data, { commit: 'local', files: { 'config/policy.json': hash(op.group) } });
      row.override = { operation: 'add', reason: op.reason };
      result.push(row);
      continue;
    }
    const row = result.find(r => r.id === op.target);
    if (!row) throw new Error(`Unknown override target: ${op.target}`);
    if (op.expectedFingerprint !== row.fingerprint) throw new Error(`Stale override: ${op.target}`);
    if (op.operation === 'disable') row.disabled = true;
    else if (op.operation === 'replace') {
      if (op.group?.key !== row.key) throw new Error('Replacement must preserve group key');
      validateSubscription({ id: 1, name: 'override', version: 1,
        apps: [{ id: row.app, groups: [op.group] }] });
      row.fingerprint = hash({ base: row.fingerprint, replacement: op.group });
      row.personalReplacement = true;
    } else throw new Error(`Unsupported override operation: ${op.operation}`);
    row.override = { operation: op.operation, reason: op.reason, baseFingerprint: op.expectedFingerprint };
  }
  return result;
}

export function plan(report, policy) {
  const rows = applyOverrides(report.groups, policy.overrides);
  const known = new Set(rows.map(r => r.id));
  const decisions = policy.decisions ?? {};
  for (const [id, decision] of Object.entries(decisions)) {
    if (!known.has(id) || !['select', 'reject'].includes(decision.action) || !decision.reason ||
        decision.expectedFingerprint !== rows.find(r => r.id === id).fingerprint) throw new Error(`Invalid/stale decision: ${id}`);
  }
  const rank = source => {
    const i = (policy.preferredSources ?? []).indexOf(source);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const selected = [], rejected = [], pending = [];
  const conflicts = new Set([...report.conflicts.flatMap(c => c.members),
    ...rows.filter(r => r.referenceFindings?.length || r.personalReplacement).map(r => r.id)]);
  // Only exact groups are coalesced; never splice rules or infer equivalence.
  for (const bucket of buckets(rows, r => `${r.app}:${r.fingerprint}`)) {
    const active = bucket.filter(r => !r.disabled && decisions[r.id]?.action !== 'reject');
    rejected.push(...bucket.filter(r => !active.includes(r)).map(r => ({ id: r.id, reason: r.override?.reason ?? decisions[r.id].reason })));
    if (!active.length) continue;
    active.sort((a, b) => rank(a.source) - rank(b.source) || a.id.localeCompare(b.id, 'en'));
    const chosen = active.filter(r => decisions[r.id]?.action === 'select');
    const winner = chosen[0] ?? active[0];
    const entry = { id: winner.id, fingerprint: winner.fingerprint,
      provenance: active.map(r => r.provenance), duplicates: active.filter(r => r !== winner).map(r => r.id),
      override: winner.override ?? null,
      reason: chosen.length ? decisions[winner.id].reason : 'exact-group or sole candidate; source preference is not quality proof' };
    if (chosen.length > 1 || (!chosen.length && active.some(r => conflicts.has(r.id)))) {
      pending.push({ ...entry, reason: 'potential conflict requires an explicit fingerprint-bound decision' });
    } else selected.push(entry);
  }
  // Same selectors and same names miss dissimilar rules doing the same job. Any app
  // with multiple selected sources needs manual review before a future exporter.
  const multiSourceApps = buckets(selected.map(e => ({ ...e, row: rows.find(r => r.id === e.id) })), e => e.row.app)
    .filter(b => new Set(b.map(e => e.row.source)).size > 1).map(b => b[0].row.app).sort();
  return { schemaVersion: 1, artifact: 'review-plan-not-a-GKD-subscription',
    publicationReady: false, selected, rejected, pending, multiSourceApps,
    licenseBlockedSources: report.summary.filter(s => !s.publicationApproved).map(s => s.source),
    limitations: ['No subscription exporter in phase 1; selection is a proposal.',
      'Cross-group references, category defaults, global overlap and key allocation need export-stage validation.'] };
}

export function markdown(report) {
  const lines = ['# 多源规则静态审计', '',
    '统计来自 sources.lock.json 固定提交中的实际订阅文件；不代表设备验证结果。', '',
    '| 来源 | App | 独占 App | 应用组 | 全局组 | 规则 | 许可证 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |'];
  for (const s of report.summary) lines.push(`| ${s.source} | ${s.apps} | ${s.exclusiveApps.length} | ${s.appGroups} | ${s.globalGroups} | ${s.rules} | ${s.license} |`);
  lines.push('', `保守识别：${report.exactGroups.length} 簇上下文完全相同规则组、${report.exactRules.length} 簇上下文完全相同规则、${report.conflicts.length} 条潜在冲突/实现差异。`, '',
    `另有 ${report.structuralGroups.length} 簇跨来源规则组结构重复、${report.structuralRules.length} 簇跨来源规则结构重复。结构重复未证明分类、默认开关和作用域相同，不自动去重。`, '',
    '| 来源组合 | 共同 App | 仅前者 | 仅后者 |', '| --- | ---: | ---: | ---: |');
  for (const p of report.overlaps) lines.push(`| ${p.sources.join(' / ')} | ${p.commonApps} | ${p.onlyFirst} | ${p.onlySecond} |`);
  lines.push('', '完整规则身份、提交、文件摘要、JSON Pointer、差异候选和质量指示项见 audit.json。', '',
    '## 口径与边界', '', ...report.limitations.map(s => `- ${s}`), '',
    '所有来源默认尚未获准自动发布。报告只含元数据、摘要和定位信息，不包含上游选择器正文。', '');
  return lines.join('\n');
}
