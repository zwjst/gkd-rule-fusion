import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';
import { Selector, initDefaultTypeInfo, updateWasmToMatches } from '@gkd-kit/selector';
import matchesInstantiate from '@gkd-kit/wasm_matches';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const present = value => value !== undefined && value !== null;
const array = value => !present(value) ? [] : Array.isArray(value) ? value : [value];
const int32 = value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
const listFields = ['matches', 'anyMatches', 'excludeMatches', 'excludeAllMatches'];
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${name} value`);
  const value = args[index + 1]; args.splice(index, 2); return value;
}

let output;
const result = {
  schemaVersion: 1, valid: false,
  scope: 'Export-policy basic shape, duplicate identities, explicit dependency integrity, official selector syntax/type and static regex compilation. This is not exhaustive GKD client schema/import/behavior validation.',
  clientReference: {
    repository: 'gkd-kit/gkd', commit: 'be5eb76caabbec5cca1ec45569773b2b5f742ef7',
    explicitRuleKeys: 'ResolvedRule.kt:54-55 and RawSubscriptionParser.kt:303: no implicit index key.',
    referenceScope: 'ResolvedRule.kt:111-153: own group followed by group.scopeKeys in source order; preKeys selects all matching explicit keys; shared keys find first.',
    inheritedKeys: 'RuleExecutionParameters.kt:38-39: rule actionCdKey/actionMaximumKey override group; preKeys is rule-only.',
    url: 'https://github.com/gkd-kit/gkd/blob/be5eb76caabbec5cca1ec45569773b2b5f742ef7/gkd-app/src/commonMain/kotlin/li/gkd/app/rule/ResolvedRule.kt#L111'
  },
  counts: { apps: 0, categories: 0, appGroups: 0, globalGroups: 0, rules: 0,
    selectorReferences: 0, uniqueSelectors: 0, passedUniqueSelectors: 0, failedUniqueSelectors: 0,
    scopeReferences: 0, preKeyReferences: 0, sharedCooldownReferences: 0, sharedMaximumReferences: 0,
    versionPatternReferences: 0, positionObjects: 0, swipeArguments: 0 },
  controls: {}, errors: [], warnings: [],
  unchecked: [
    'Android client import and device execution, actual installed App versions, UI snapshot matching and negative cases.',
    'Position/swipe expressions are checked for shape/coordinate presence only, not expression grammar/evaluation; action execution, performance, global/app interaction and timing behavior are unverified.',
    'Exhaustive unknown/extension-field schema compatibility, snapshot URL availability, licensing and publication permission.'
  ]
};
const error = (code, location, detail, extra = {}) => result.errors.push({ code, location, detail, ...extra });
const warning = (code, location, detail, extra = {}) => result.warnings.push({ code, location, detail, ...extra });
function requiredString(value, location) {
  if (typeof value !== 'string' || !value.trim()) { error('schema-string', location, 'Expected a non-empty string'); return false; }
  return true;
}
function optionalType(value, type, location) {
  if (present(value) && typeof value !== type) error('schema-type', location, `Expected ${type} or null`);
}
function integerList(value, location) {
  if (!present(value)) return [];
  const list = array(value);
  if (list.some(item => !int32(item))) { error('schema-integer-list', location, 'Expected an integer or array of 32-bit integers'); return []; }
  return list;
}
function stringList(value, location) {
  if (!present(value)) return [];
  const list = array(value);
  if (list.some(item => typeof item !== 'string' || !item)) {
    error('schema-string-list', location, 'Expected a non-empty string or array of non-empty strings'); return [];
  }
  return list;
}
function requiredArray(value, location, optional = true) {
  if (!present(value) && optional) return [];
  if (!Array.isArray(value)) { error('schema-array', location, 'Expected an array'); return []; }
  return value;
}
function nonFinite(value, location = '$') {
  if (typeof value === 'number' && !Number.isFinite(value)) error('schema-nonfinite', location, 'Non-finite numbers are not permitted');
  if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) nonFinite(item, `${location}/${key}`);
}

try {
  const file = option('--file');
  output = path.resolve(option('--out', path.join(toolDir, '../../dist/validation.json')));
  if (!file || args.length) throw new Error('Usage: node check-export.mjs --file SUBSCRIPTION_JSON5 [--out RESULT_JSON]');
  const bytes = fs.readFileSync(path.resolve(file));
  result.input = { file: path.basename(file), sha256: sha256(bytes) };
  let data;
  try { data = JSON5.parse(bytes.toString()); }
  catch { error('json5-parse', '$', 'Input is not valid JSON/JSON5; parser text omitted to avoid reproducing rule bodies'); }

  let regexCompilerCalls = 0;
  const wasmBytes = fs.readFileSync(fileURLToPath(import.meta.resolve('@gkd-kit/wasm_matches/dist/mod.wasm')));
  const module = await matchesInstantiate(wasmBytes);
  if (typeof module.exports.toMatches !== 'function') throw new Error('Official WASM regex compiler unavailable');
  const compileRegex = pattern => { regexCompilerCalls++; return module.exports.toMatches(pattern); };
  updateWasmToMatches(compileRegex);
  const contextType = initDefaultTypeInfo().contextType;
  const parse = text => { const compiled = Selector.Companion.parse(text); compiled.checkType(contextType); return compiled; };
  for (const [id, text, shouldPass] of [
    ['valid', '[text="test"]', true], ['syntax', '[text=', false],
    ['invalidRegex', '[text~="["]', false], ['invalidType', '[unknownAttribute=1]', false]
  ]) {
    let passed = true;
    try { parse(text); } catch { passed = false; }
    result.controls[id] = { expected: shouldPass ? 'pass' : 'reject', actual: passed ? 'pass' : 'reject', ok: passed === shouldPass };
  }
  result.controlRegexCompilerCalls = regexCompilerCalls;
  if (Object.values(result.controls).some(control => !control.ok) || !regexCompilerCalls) throw new Error('Official validator control check failed');
  regexCompilerCalls = 0;
  result.toolchain = { tool: 'gkd-rule-fusion-export-validation', version: readJson(path.join(toolDir, 'package.json')).version,
    node: process.version,
    selector: readJson(fileURLToPath(import.meta.resolve('@gkd-kit/selector/package.json'))).version,
    wasm_matches: readJson(fileURLToPath(import.meta.resolve('@gkd-kit/wasm_matches/package.json'))).version,
    json5: readJson(fileURLToPath(import.meta.resolve('json5/package.json'))).version,
    wasmSha256: sha256(wasmBytes), packageLockSha256: sha256(fs.readFileSync(path.join(toolDir, 'package-lock.json'))),
    referenceImplementation: '@gkd-kit/tools@0.8.0 parseSelector initialization; all four selector fields checked here'
  };

  const selectorCache = new Map();
  const selectorRefs = [];
  function selectorFields(rule, location) {
    for (const field of listFields) {
      for (const [index, text] of stringList(rule[field], `${location}/${field}`).entries()) {
        const ref = { location: `${location}/${field}/${index}`, field, sha256: sha256(text) };
        selectorRefs.push(ref);
        if (!selectorCache.has(text)) {
          let compiled;
          try { parse(text); compiled = { valid: true }; }
          catch (caught) { compiled = { valid: false, errorType: caught.constructor.name, errorIndex: caught.index ?? null }; }
          selectorCache.set(text, compiled);
        }
        const checked = selectorCache.get(text);
        if (!checked.valid) error('selector-syntax-or-type', ref.location, 'Official selector syntax/type/regex compilation rejected this value',
          { selectorSha256: ref.sha256, errorType: checked.errorType, errorIndex: checked.errorIndex });
      }
    }
  }
  function versionMatchers(props, location) {
    if (present(props.versionCode)) {
      if (!object(props.versionCode)) error('schema-version-code', `${location}/versionCode`, 'Expected an integer matcher object');
      else {
        for (const key of ['minimum', 'maximum']) if (present(props.versionCode[key]) && !int32(props.versionCode[key])) error('schema-integer', `${location}/versionCode/${key}`, 'Expected a 32-bit integer');
        for (const key of ['include', 'exclude']) integerList(props.versionCode[key], `${location}/versionCode/${key}`);
      }
    }
    if (present(props.versionName)) {
      if (!object(props.versionName)) error('schema-version-name', `${location}/versionName`, 'Expected a string matcher object');
      else {
        for (const key of ['include', 'exclude']) stringList(props.versionName[key], `${location}/versionName/${key}`);
        const pattern = props.versionName.pattern;
        if (present(pattern)) {
          if (typeof pattern !== 'string') error('schema-string', `${location}/versionName/pattern`, 'Expected a string');
          else {
            result.counts.versionPatternReferences++;
            try { compileRegex(pattern); }
            catch { error('invalid-version-pattern', `${location}/versionName/pattern`, 'Official WASM regex compiler rejected this version pattern', { patternSha256: sha256(pattern) }); }
          }
        }
      }
    }
    for (const field of ['versionCodes', 'excludeVersionCodes']) integerList(props[field], `${location}/${field}`);
    for (const field of ['versionNames', 'excludeVersionNames', 'activityIds', 'excludeActivityIds']) stringList(props[field], `${location}/${field}`);
  }
  function commonTypes(props, location) {
    for (const field of ['name', 'desc', 'action', 'resetMatch']) optionalType(props[field], 'string', `${location}/${field}`);
    for (const field of ['enable', 'fastQuery', 'matchRoot', 'ignoreGlobalGroupMatch', 'matchAnyApp', 'matchSystemApp', 'matchLauncher']) optionalType(props[field], 'boolean', `${location}/${field}`);
    for (const field of ['actionCdKey', 'actionMaximumKey', 'actionMaximum', 'priorityActionMaximum', 'order']) {
      if (present(props[field]) && !int32(props[field])) error('schema-integer', `${location}/${field}`, 'Expected a 32-bit integer');
    }
    for (const field of ['actionCd', 'cd', 'actionDelay', 'delay', 'matchDelay', 'matchTime', 'forcedTime', 'priorityTime']) {
      if (present(props[field]) && !Number.isSafeInteger(props[field])) error('schema-integer', `${location}/${field}`, 'Expected a safe integer');
    }
    versionMatchers(props, location);
    for (const field of ['snapshotUrls', 'excludeSnapshotUrls', 'exampleUrls']) stringList(props[field], `${location}/${field}`);
  }
  function position(value, location, required = false) {
    if (!present(value) && !required) return;
    if (!object(value)) { error('schema-position', location, 'Expected a coordinate object'); return; }
    result.counts.positionObjects++;
    for (const field of ['left', 'top', 'right', 'bottom', 'x', 'y']) {
      if (!present(value[field])) continue;
      if (!((typeof value[field] === 'number' && Number.isFinite(value[field])) ||
          (typeof value[field] === 'string' && value[field].trim()))) {
        error('schema-position-coordinate', `${location}/${field}`, 'Expected a finite numeric coordinate or non-empty expression string');
      }
    }
    if (!['left', 'right', 'x'].some(field => present(value[field]))) {
      error('missing-horizontal-coordinate', location, 'Position requires left, right, or x');
    }
    if (!['top', 'bottom', 'y'].some(field => present(value[field]))) {
      error('missing-vertical-coordinate', location, 'Position requires top, bottom, or y');
    }
  }
  function locationProps(rule, location) {
    position(rule.position, `${location}/position`);
    if (present(rule.swipeArg)) {
      if (!object(rule.swipeArg)) { error('schema-swipe-arg', `${location}/swipeArg`, 'Expected a swipe argument object'); return; }
      result.counts.swipeArguments++;
      position(rule.swipeArg.start, `${location}/swipeArg/start`, true);
      position(rule.swipeArg.end, `${location}/swipeArg/end`);
      if (!Number.isSafeInteger(rule.swipeArg.duration) || rule.swipeArg.duration < 0) {
        error('schema-swipe-duration', `${location}/swipeArg/duration`, 'Expected a nonnegative safe integer duration');
      }
    }
  }
  function globalApps(props, location, allowEnable) {
    const ids = new Set();
    for (const [index, app] of requiredArray(props.apps, `${location}/apps`).entries()) {
      const loc = `${location}/apps/${index}`;
      if (!object(app)) { error('schema-object', loc, 'Expected a global App override object'); continue; }
      if (requiredString(app.id, `${loc}/id`)) {
        if (ids.has(app.id)) error('duplicate-global-app-id', `${loc}/id`, 'App id repeats within global override list');
        ids.add(app.id);
      }
      if (allowEnable) optionalType(app.enable, 'boolean', `${loc}/enable`);
      else if (present(app.enable)) warning('unsupported-global-rule-app-enable', `${loc}/enable`, 'Client RawGlobalRuleApp does not define enable');
      versionMatchers(app, loc);
    }
  }

  function groupsInScope(groups, location, appId, isGlobal) {
    const prepared = [];
    const groupKeys = new Set();
    for (const [index, group] of groups.entries()) {
      const loc = `${location}/${index}`;
      if (!object(group)) { error('schema-object', loc, 'Expected a rule group object'); continue; }
      if (!int32(group.key)) error('schema-group-key', `${loc}/key`, 'Expected a required 32-bit group key');
      else {
        if (groupKeys.has(group.key)) error('duplicate-group-key', `${loc}/key`, 'Group key repeats within this App/global scope');
        groupKeys.add(group.key);
      }
      requiredString(group.name, `${loc}/name`);
      commonTypes(group, loc);
      const scopeKeys = integerList(group.scopeKeys, `${loc}/scopeKeys`);
      if (present(group.preKeys)) warning('unsupported-group-prekeys', `${loc}/preKeys`, 'Client reads preKeys only from rules; group-level value is not inherited');
      for (const field of listFields) if (present(group[field])) {
        warning('unsupported-group-selector', `${loc}/${field}`, 'Client RawGroupProps does not inherit selector fields; value is still syntax-checked here');
      }
      selectorFields(group, loc);
      if (isGlobal) globalApps(group, loc, true);
      const rules = [];
      const ruleKeys = new Set();
      for (const [ruleIndex, raw] of array(group.rules).entries()) {
        const rloc = `${loc}/rules/${ruleIndex}`;
        if (isGlobal && !object(raw)) { error('schema-global-rule', rloc, 'Global rules must be objects in the referenced client parser'); continue; }
        const rule = typeof raw === 'string' || Array.isArray(raw) ? { matches: raw } : raw;
        if (!object(rule)) { error('schema-rule', rloc, 'Expected a rule object, selector string, or selector list'); continue; }
        if (present(rule.key)) {
          if (!int32(rule.key)) error('schema-rule-key', `${rloc}/key`, 'Expected a 32-bit rule key');
          else {
            if (ruleKeys.has(rule.key)) error('duplicate-rule-key', `${rloc}/key`, 'Explicit rule key repeats within group');
            ruleKeys.add(rule.key);
          }
        }
        commonTypes(rule, rloc);
        locationProps(rule, rloc);
        const preKeys = integerList(rule.preKeys, `${rloc}/preKeys`);
        if (present(rule.scopeKeys)) warning('unsupported-rule-scopekeys', `${rloc}/scopeKeys`, 'Client scopeKeys belongs to groups, not rules');
        selectorFields(rule, rloc);
        if (!array(rule.matches).length && !array(rule.anyMatches).length) {
          error('export-rule-without-positive-selector', rloc, 'Export policy requires at least one matches/anyMatches selector; this is not a claim that client parsing itself rejects empty rules');
        }
        if (isGlobal) globalApps(rule, rloc, false);
        rules.push({ rule, ruleIndex, loc: rloc, preKeys });
        result.counts.rules++;
      }
      if (!rules.length) warning('empty-group', loc, 'Empty placeholder group has no executable rule records');
      prepared.push({ group, loc, rules, scopeKeys, appId });
      result.counts[isGlobal ? 'globalGroups' : 'appGroups']++;
    }
    // Preserve source order: the client builds self + scopeKeys in original order.
    for (const entry of prepared) {
      const scope = [entry];
      for (const key of [...new Set(entry.scopeKeys)].filter(key => key !== entry.group.key)) {
        result.counts.scopeReferences++;
        const target = prepared.find(other => other.group.key === key);
        if (!target) error('missing-scope-group', `${entry.loc}/scopeKeys`, 'Referenced group key is absent from this App/global scope', { key, appId });
        else scope.push(target);
      }
      const rulePool = scope.flatMap(group => group.rules);
      for (const record of entry.rules) {
        for (const key of record.preKeys) {
          result.counts.preKeyReferences++;
          if (!rulePool.some(other => present(other.rule.key) && other.rule.key === key)) {
            error('unresolved-prekey', `${record.loc}/preKeys`, 'No explicit rule key matches in the client reference scope; client silently leaves dependency unbound, export policy rejects it', { key, appId, groupKey: entry.group.key, ruleIndex: record.ruleIndex });
          }
        }
        for (const [field, counter] of [['actionCdKey', 'sharedCooldownReferences'], ['actionMaximumKey', 'sharedMaximumReferences']]) {
          const key = record.rule[field] ?? entry.group[field];
          if (!present(key) || !int32(key)) continue;
          result.counts[counter]++;
          const targets = rulePool.filter(other => other.rule.key === key);
          if (!targets.length) error(`unresolved-${field}`, `${record.loc}/${field}`, 'No explicit rule key matches the inherited/shared key; client silently leaves state unshared, export policy rejects it', { key, inherited: !present(record.rule[field]), appId, groupKey: entry.group.key, ruleIndex: record.ruleIndex });
          else if (targets.length > 1) warning(`ambiguous-${field}`, `${record.loc}/${field}`, 'Several scoped explicit keys match; client uses first match in self-then-scope order', { key, targetLocations: targets.map(target => target.loc), resolvedLocation: targets[0].loc });
        }
      }
    }
  }

  if (data !== undefined) {
    if (!object(data)) error('schema-subscription', '$', 'Expected a subscription object');
    else {
      nonFinite(data);
      if (!Number.isSafeInteger(data.id)) error('schema-id', '$/id', 'Expected a safe integer subscription id');
      requiredString(data.name, '$/name');
      if (!int32(data.version)) error('schema-version', '$/version', 'Expected a 32-bit integer version');
      for (const field of ['author', 'updateUrl', 'supportUri', 'checkUpdateUrl']) optionalType(data[field], 'string', `$/${field}`);
      const categoryKeys = new Set();
      for (const [index, category] of requiredArray(data.categories, '$/categories').entries()) {
        const loc = `$/categories/${index}`;
        if (!object(category)) { error('schema-category', loc, 'Expected a category object'); continue; }
        if (!int32(category.key)) error('schema-category-key', `${loc}/key`, 'Expected a 32-bit category key');
        else {
          if (categoryKeys.has(category.key)) error('duplicate-category-key', `${loc}/key`, 'Category key repeats');
          categoryKeys.add(category.key);
        }
        requiredString(category.name, `${loc}/name`);
        optionalType(category.enable, 'boolean', `${loc}/enable`);
        optionalType(category.desc, 'string', `${loc}/desc`);
        result.counts.categories++;
      }
      const appIds = new Set();
      for (const [index, app] of requiredArray(data.apps, '$/apps').entries()) {
        const loc = `$/apps/${index}`;
        if (!object(app)) { error('schema-app', loc, 'Expected an App object'); continue; }
        if (requiredString(app.id, `${loc}/id`)) {
          if (appIds.has(app.id)) error('duplicate-app-id', `${loc}/id`, 'App id repeats');
          appIds.add(app.id);
        }
        optionalType(app.name, 'string', `${loc}/name`);
        if (present(app.enable)) warning('unsupported-app-enable', `${loc}/enable`, 'Client RawApp does not define a subscription App enable field');
        groupsInScope(requiredArray(app.groups, `${loc}/groups`), `${loc}/groups`, app.id, false);
        result.counts.apps++;
      }
      groupsInScope(requiredArray(data.globalGroups, '$/globalGroups'), '$/globalGroups', '@global', true);
    }
  }
  result.counts.selectorReferences = selectorRefs.length;
  result.counts.uniqueSelectors = selectorCache.size;
  result.counts.passedUniqueSelectors = [...selectorCache.values()].filter(item => item.valid).length;
  result.counts.failedUniqueSelectors = [...selectorCache.values()].filter(item => !item.valid).length;
  result.regexCompilerCalls = regexCompilerCalls;
  if (!result.counts.uniqueSelectors) error('no-selectors-validated', '$', 'No selector strings were validated');
  result.valid = result.errors.length === 0;
} catch (caught) {
  // Library exceptions can contain selectors. Only our non-content operational messages are safe to retain.
  const safeMessages = /^(Usage:|Missing --|Official |Locked )/;
  error('validation-operation-failed', '$', safeMessages.test(caught.message) ? caught.message : 'Validation operation failed; exception content omitted');
  result.valid = false;
}

if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(result, null, 2) + '\n');
  fs.renameSync(temporary, output);
}
console.log(`Export validation: ${result.valid ? 'PASS' : 'FAIL'}; ${result.errors.length} errors, ${result.warnings.length} warnings; ${result.counts.uniqueSelectors} unique selectors`);
if (!result.valid) process.exitCode = 1;
