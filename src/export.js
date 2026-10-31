// SPDX-License-Identifier: GPL-3.0-only
import { hash } from './core.js';
import { initialGroupState } from './catalog.js';

const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const rules = group => list(group.rules).map(r => typeof r === 'string' ? { matches: r } : r);

// Mirror the client's direct group scope and explicit rule-key binding. Do not
// invent index-based keys or remove prerequisites from an imported rule chain.
export function dependencyIssues(group, groups) {
  const findings = [];
  const own = rules(group);
  if (!own.length) findings.push({ type: 'empty-group' });
  for (const [index, rule] of own.entries()) {
    if (!rule.matches && !rule.anyMatches && !group.matches && !group.anyMatches) {
      findings.push({ type: 'no-explicit-selector', index });
    }
    const scopeKeys = list(group.scopeKeys);
    for (const key of scopeKeys) if (!groups.some(g => g.key === key)) findings.push({ type: 'missing-scope-group', key });
    const scoped = [group, ...scopeKeys.flatMap(key => groups.filter(g => g.key === key))];
    const keys = new Set(scoped.flatMap(g => rules(g)).map(r => r.key).filter(k => k !== undefined));
    for (const key of list(rule.preKeys)) if (!keys.has(key)) findings.push({ type: 'missing-preKey', index, key });
    for (const field of ['actionCdKey', 'actionMaximumKey']) {
      const key = rule[field] ?? group[field];
      if (key !== undefined && !keys.has(key)) findings.push({ type: `missing-${field}`, index, key });
    }
  }
  return findings;
}

export function fuse(loaded, release, previousState = {}, policy = {}) {
  if (release.schemaVersion !== 1 || !Number.isSafeInteger(release.id) || release.id <= 0 ||
      !Number.isSafeInteger(release.version) || release.version < 1 || typeof release.name !== 'string') {
    throw new Error('Invalid fusion release configuration');
  }
  if (new Set(release.sourcePriority).size !== release.sourcePriority.length ||
      !release.sourcePriority.includes(release.globalSource)) throw new Error('Invalid fusion source selection');
  const bySource = new Map(loaded.map(s => [s.source.id, s]));
  for (const id of release.sourcePriority) {
    const source = bySource.get(id);
    if (source?.source.publicationApproved !== true) throw new Error(`Publication not approved: ${id}`);
    if (source.data.id === release.id) throw new Error('Fusion ID must differ from source IDs');
    if (release.reviewedCommits[id] !== source.lock.commit) throw new Error(`Source commit requires publication review: ${id}`);
  }
  if (previousState.subscriptionId !== undefined && previousState.subscriptionId !== release.id) throw new Error('Subscription identity changed');
  const state = { schemaVersion: 1, subscriptionId: release.id,
    appSources: { ...(previousState.appSources ?? {}) },
    groupKeys: { ...(previousState.groupKeys ?? {}) },
    categoryKeys: { ...(previousState.categoryKeys ?? {}) } };
  const byApp = new Map();
  for (const id of release.sourcePriority) {
    const source = bySource.get(id);
    for (const app of source.data.apps) {
      const pinned = state.appSources[app.id];
      if (pinned && pinned !== id) continue;
      if (!byApp.has(app.id)) byApp.set(app.id, { source, app: structuredClone(app), original: app });
    }
  }
  for (const [appId, pinned] of Object.entries(state.appSources)) {
    if (!byApp.has(appId)) throw new Error(`Pinned App source missing: ${appId}/${pinned}; review removal explicitly`);
  }
  const globalSource = bySource.get(release.globalSource);
  const contexts = [{ source: globalSource, app: { id: '@global', groups: structuredClone(globalSource.data.globalGroups ?? []) } },
    ...[...byApp.values()].sort((a, b) => a.app.id.localeCompare(b.app.id, 'en'))];
  const metadata = new Map();
  for (const context of contexts) {
    const { source, app } = context;
    if (app.id !== '@global') state.appSources[app.id] = source.source.id;
    for (const group of app.groups) {
      const id = `${source.source.id}:${app.id}:${group.key}`;
      const row = source.rows.find(r => r.id === id);
      if (!row) throw new Error(`Missing source provenance: ${id}`);
      metadata.set(id, { id, source: source.source.id, appId: app.id, originalKey: group.key,
        outputKey: group.key, fingerprint: row.fingerprint, provenance: row.provenance,
        changes: ['resolved-source-category-default-to-explicit-group-enable'] });
      if (state.groupKeys[id] !== undefined && state.groupKeys[id] !== group.key) throw new Error(`Group key ledger changed: ${id}`);
      state.groupKeys[id] = group.key;
      group.enable = initialGroupState(group, source.data.categories ?? [], app.id === '@global').enabled;
      group.rules = rules(group);
    }
  }

  // Personal policy is independent of upstream files and commit state. An
  // unselected/stale target is an error, not a silently lost customization.
  const touched = new Set();
  for (const op of policy.overrides ?? []) {
    if (!op.reason || touched.has(op.target)) throw new Error('Personal override requires a reason and unique target');
    touched.add(op.target);
    if (op.operation === 'add') {
      if (typeof op.app !== 'string' || !op.app || op.app === '@global' || !Number.isSafeInteger(op.group?.key) ||
          op.target !== `personal:${op.app}:${op.group.key}`) throw new Error('Invalid personal group identity');
      let context = contexts.find(c => c.app.id === op.app);
      if (!context) {
        context = { source: null, app: { id: op.app, name: op.app, groups: [] } };
        contexts.push(context);
      }
      if (context.app.groups.some(g => g.key === op.group.key) ||
          Object.entries(state.groupKeys).some(([id, key]) => id !== op.target && id.split(':')[1] === op.app && key === op.group.key)) {
        throw new Error('Personal group key is occupied/reserved');
      }
      const group = structuredClone(op.group);
      group.rules = rules(group); group.enable ??= false;
      context.app.groups.push(group);
      state.groupKeys[op.target] = group.key;
      metadata.set(op.target, { id: op.target, source: 'personal', appId: op.app,
        outputKey: group.key, changes: [{ operation: 'add', reason: op.reason }], provenance: { path: 'config/policy.json' } });
      continue;
    }
    const info = metadata.get(op.target);
    if (!info || info.fingerprint !== op.expectedFingerprint) throw new Error(`Unknown or stale personal target: ${op.target}`);
    const context = contexts.find(c => c.app.id === info.appId);
    const i = context.app.groups.findIndex(g => g.key === info.outputKey);
    if (op.operation === 'disable') context.app.groups[i].enable = false;
    else if (op.operation === 'replace') {
      if (op.group?.key !== info.outputKey) throw new Error('Personal replacement must preserve group key');
      const group = structuredClone(op.group);
      group.enable ??= context.app.groups[i].enable;
      group.rules = rules(group);
      context.app.groups[i] = group;
    } else throw new Error(`Unsupported personal override: ${op.operation}`);
    info.changes.push({ operation: op.operation, reason: op.reason });
  }

  const quarantine = [];
  for (const context of contexts) {
    let changed;
    do {
      changed = false;
      const rejected = new Map(context.app.groups.map(g => [g.key, dependencyIssues(g, context.app.groups)])
        .filter(([, issues]) => issues.length));
      if (rejected.size) {
        const personal = context.app.groups.filter(g => rejected.has(g.key)).some(g =>
          [...metadata.values()].some(m => m.appId === context.app.id && m.outputKey === g.key &&
            (m.source === 'personal' || m.changes.some(c => typeof c === 'object'))));
        if (personal) throw new Error(`Personal override has invalid references/selectors: ${context.app.id}`);
        for (const group of context.app.groups.filter(g => rejected.has(g.key))) {
          const info = [...metadata.values()].find(m => m.appId === context.app.id && m.outputKey === group.key);
          quarantine.push({ ...info, name: group.name, reasons: rejected.get(group.key) });
        }
        context.app.groups = context.app.groups.filter(g => !rejected.has(g.key));
        changed = true;
      }
    } while (changed);
  }
  const categories = [];
  for (const id of release.sourcePriority) for (const category of bySource.get(id).data.categories ?? []) {
    if (categories.some(c => c.name === category.name)) continue;
    let key = state.categoryKeys[category.name];
    if (key === undefined) {
      key = Math.max(-1, ...Object.values(state.categoryKeys)) + 1;
      state.categoryKeys[category.name] = key;
    }
    // No category enable: each group's materialized source default takes effect.
    categories.push({ key, name: category.name });
  }
  const subscription = {
    id: release.id, name: release.name, version: release.version, author: release.author,
    checkUpdateUrl: './gkd.version.json', supportUri: release.repository,
    categories,
    globalGroups: contexts.find(c => c.app.id === '@global').app.groups,
    apps: contexts.filter(c => c.app.id !== '@global' && c.app.groups.length).map(c => c.app)
      .sort((a, b) => a.id.localeCompare(b.id, 'en'))
  };
  const included = [];
  for (const app of [{ id: '@global', groups: subscription.globalGroups }, ...subscription.apps]) {
    for (const group of app.groups) {
      const info = [...metadata.values()].find(m => m.appId === app.id && m.outputKey === group.key);
      included.push({ ...info, name: group.name, initialEnable: group.enable, outputSha256: hash(group),
        rules: group.rules.map((r, index) => ({ index, key: r.key ?? null, sha256: hash(r),
          sourceRuleIndex: info.source === 'personal' || info.changes.some(c => typeof c === 'object' && c.operation === 'replace') ? null : index })) });
    }
  }
  return { subscription, state, provenance: { schemaVersion: 1, strategy: 'one-source-per-app; quarantine-whole-invalid-groups; single-global-source',
    included, quarantine, excludedSources: loaded.filter(s => !release.sourcePriority.includes(s.source.id)).map(s => ({
      source: s.source.id, reason: 'not-approved-for-this-release', commit: s.lock.commit })) },
    counts: { apps: subscription.apps.length, appGroups: subscription.apps.reduce((n, a) => n + a.groups.length, 0),
      globalGroups: subscription.globalGroups.length, groups: included.length,
      rules: included.reduce((n, g) => n + g.rules.length, 0), quarantinedGroups: quarantine.length } };
}
