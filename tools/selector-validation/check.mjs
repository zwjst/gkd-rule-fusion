import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';
import { Selector, initDefaultTypeInfo, updateWasmToMatches } from '@gkd-kit/selector';
import matchesInstantiate from '@gkd-kit/wasm_matches';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(toolDir, '../..');
const hashBytes = value => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite number in input');
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])])
  );
  return value;
}
const hashObject = value => hashBytes(JSON.stringify(canonical(value)));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${name} value`);
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

try {
  const root = path.resolve(option('--root', defaultRoot));
  const output = path.resolve(option('--out', path.join(root, 'reports/2026-10-31/selector-validation.json')));
  if (args.length) throw new Error('Usage: node check.mjs [--root PROJECT_ROOT] [--out RESULT_JSON]');
  const config = readJson(path.join(root, 'config/sources.json'));
  const lock = readJson(path.join(root, 'sources.lock.json'));
  if (config.schemaVersion !== 1 || lock.schemaVersion !== 1 || !Array.isArray(config.sources) || !config.sources.length) {
    throw new Error('Unsupported source/lock schema');
  }
  if (lock.configHash !== hashObject(config)) throw new Error('Source configuration hash does not match lock');

  let regexCompilerCalls = 0;
  const wasmBytes = fs.readFileSync(fileURLToPath(import.meta.resolve('@gkd-kit/wasm_matches/dist/mod.wasm')));
  const mod = await matchesInstantiate(wasmBytes);
  if (typeof mod.exports.toMatches !== 'function') throw new Error('Official WASM regex compiler unavailable');
  updateWasmToMatches(pattern => {
    regexCompilerCalls++;
    return mod.exports.toMatches(pattern);
  });
  const typeInfo = initDefaultTypeInfo();
  function validate(text) {
    const selector = Selector.Companion.parse(text);
    selector.checkType(typeInfo.contextType);
    return selector;
  }

  const controls = {};
  for (const [id, text, shouldPass] of [
    ['valid', '[text="test"]', true],
    ['syntax', '[text=', false],
    ['invalidRegex', '[text~="["]', false],
    ['invalidType', '[unknownAttribute=1]', false]
  ]) {
    let passed = true;
    try { validate(text); } catch { passed = false; }
    controls[id] = { expected: shouldPass ? 'pass' : 'reject', actual: passed ? 'pass' : 'reject', ok: passed === shouldPass };
  }
  if (Object.values(controls).some(control => !control.ok)) throw new Error('Validator control check failed');
  const controlRegexCompilerCalls = regexCompilerCalls;
  if (controlRegexCompilerCalls === 0) throw new Error('Regex negative control did not exercise official WASM');
  regexCompilerCalls = 0;

  const cache = new Map();
  const sources = [];
  const fields = ['matches', 'anyMatches', 'excludeMatches'];
  for (const source of config.sources) {
    if (!/^[A-Za-z0-9_-]+$/.test(source.id) || typeof source.file !== 'string' ||
        path.isAbsolute(source.file) || source.file.split('/').includes('..')) throw new Error('Invalid source path');
    const locked = lock.sources[source.id];
    if (!locked || !/^[a-f0-9]{40}$/.test(locked.commit) || locked.repository !== source.repository) {
      throw new Error(`Invalid lock entry: ${source.id}`);
    }
    let buffer;
    try {
      buffer = execFileSync('git', ['-C', path.join(root, '.cache/fusion', source.id),
        'show', `${locked.commit}:${source.file}`], { maxBuffer: 50 * 1024 * 1024, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      throw new Error(`Locked Git input unavailable: ${source.id}; run npm run sync from project root`);
    }
    if (hashBytes(buffer) !== locked.files[source.file]) throw new Error(`Locked input digest mismatch: ${source.id}`);
    const data = JSON5.parse(buffer.toString());
    const refs = [];
    const effectiveRefs = [];
    for (const app of [{ id: '@global', groups: data.globalGroups ?? [] }, ...(data.apps ?? [])]) {
      for (const group of app.groups) {
        const base = { source: source.id, appId: app.id, groupKey: group.key };
        for (const field of fields) {
          for (const [selectorIndex, text] of array(group[field]).entries()) {
            refs.push({ text, ...base, ruleIndex: null, field, selectorIndex });
          }
        }
        const rules = array(group.rules).map(rule => typeof rule === 'string' ? { matches: rule } : rule);
        for (const [ruleIndex, rule] of rules.entries()) {
          for (const field of fields) {
            for (const [selectorIndex, text] of array(rule[field]).entries()) {
              refs.push({ text, ...base, ruleIndex, field, selectorIndex });
            }
            for (const [selectorIndex, text] of array(rule[field] ?? group[field]).entries()) {
              effectiveRefs.push({ text, ...base, ruleIndex, field, selectorIndex, inherited: rule[field] === undefined });
            }
          }
        }
      }
    }
    for (const ref of refs) {
      const { text, ...location } = ref;
      if (typeof text !== 'string') throw new Error(`Non-string selector reference: ${source.id}`);
      const sha256 = hashBytes(text);
      if (!cache.has(text)) {
        let result = { sha256, ok: true };
        try {
          const compiled = validate(text);
          result.regexExpressions = compiled.expression.binaryExpressionList.asJsReadonlyArrayView()
            .filter(expression => ['~=', '!~='].includes(expression.operator.key)).length;
        } catch (error) {
          // Exception messages can contain selector bodies; emit identifiers/locations only.
          result = { sha256, ok: false, errorType: error.constructor.name,
            errorIndex: error.index ?? null, expectedValue: error.expectedValue ?? null };
        }
        cache.set(text, { ...result, references: [] });
      }
      cache.get(text).references.push(location);
    }
    const unique = new Set(refs.map(ref => ref.text));
    const failed = [...unique].filter(text => !cache.get(text).ok);
    sources.push({ source: source.id, commit: locked.commit, sha256: hashBytes(buffer),
      definitionReferences: refs.length, effectiveRuleReferences: effectiveRefs.length,
      inheritedEffectiveReferences: effectiveRefs.filter(ref => ref.inherited).length,
      uniqueSelectors: unique.size, passedUniqueSelectors: unique.size - failed.length,
      failedUniqueSelectors: failed.length,
      failedDefinitionReferences: refs.filter(ref => !cache.get(ref.text).ok).length,
      failedEffectiveRuleReferences: effectiveRefs.filter(ref => !cache.get(ref.text).ok).length,
      byField: Object.fromEntries(fields.map(field => [field, {
        definitionReferences: refs.filter(ref => ref.field === field).length,
        uniqueSelectors: new Set(refs.filter(ref => ref.field === field).map(ref => ref.text)).size
      }])) });
  }

  const versions = Object.fromEntries(['selector', 'wasm_matches'].map(name => [name,
    readJson(fileURLToPath(import.meta.resolve(`@gkd-kit/${name}/package.json`))).version]));
  versions.json5 = readJson(fileURLToPath(import.meta.resolve('json5/package.json'))).version;
  const values = [...cache.values()];
  if (!values.length) throw new Error('No selector strings found; input not validated');
  const result = {
    schemaVersion: 1,
    inputFingerprint: hashObject(lock),
    scope: 'Official selector syntax + context type checking, including anyMatches and group-level inherited selectors; not Android behavior or complete subscription schema validation.',
    toolchain: { tool: 'gkd-rule-fusion-selector-validation', version: readJson(path.join(toolDir, 'package.json')).version,
      node: process.version, ...versions, referenceImplementation: '@gkd-kit/tools@0.8.0 parseSelector initialization',
      wasmSha256: hashBytes(wasmBytes), packageLockSha256: hashBytes(fs.readFileSync(path.join(toolDir, 'package-lock.json'))) },
    controls, wasmRegexCompilerInitialized: true, controlRegexCompilerCalls, regexCompilerCalls,
    uniqueRegexExpressionCount: values.reduce((total, value) => total + (value.regexExpressions ?? 0), 0),
    sources,
    total: { definitionReferences: sources.reduce((total, source) => total + source.definitionReferences, 0),
      effectiveRuleReferences: sources.reduce((total, source) => total + source.effectiveRuleReferences, 0),
      uniqueSelectorsAcrossSources: values.length,
      passedUniqueSelectorsAcrossSources: values.filter(value => value.ok).length,
      failedUniqueSelectorsAcrossSources: values.filter(value => !value.ok).length },
    failures: values.filter(value => !value.ok),
    notes: [
      'Execution uses official selector and WASM packages through the same parse/checkType initialization pattern as @gkd-kit/tools@0.8.0; neither tools nor the type-only api package is required.',
      'Official tools checkSubscription@0.8.0 skips anyMatches; this audit explicitly checks matches/anyMatches/excludeMatches.',
      'Official WASM regex compiler invocations are instrumented; control invocations are tracked separately.',
      'No selector bodies are written into this result. Definition references count physical declarations; effective references include per-rule inheritance.',
      'A syntax/type pass does not establish rule matching, click safety, performance, snapshot success or Android-version compatibility.'
    ]
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(`Checked ${values.length} unique selectors: ${result.total.passedUniqueSelectorsAcrossSources} passed, ${result.total.failedUniqueSelectorsAcrossSources} failed; wrote ${output}`);
  if (result.total.failedUniqueSelectorsAcrossSources) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
