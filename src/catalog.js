import { hash } from './core.js';

const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
export function initialGroupState(group, categories, global = false) {
  const category = global ? undefined : categories.find(c => group.name.startsWith(c.name));
  return {
    enabled: global ? (group.enable ?? true) : (category?.enable ?? group.enable ?? true),
    category: category?.name ?? null,
    categoryEnable: category?.enable ?? null,
    groupEnable: group.enable ?? null,
    basis: global ? 'group.enable ?? true' : 'category.enable ?? group.enable ?? true'
  };
}

export function createCatalog(loaded, report, reviewPlan, projectVersion) {
  const index = new Map(report.groups.map(g => [g.id, g]));
  const statuses = new Map();
  for (const [field, status] of [['selected', '拟选待验证'], ['pending', '待审核'], ['rejected', '已拒绝']]) {
    for (const g of reviewPlan[field]) {
      statuses.set(g.id, status);
      for (const duplicate of g.duplicates ?? []) statuses.set(duplicate, '重复候选');
    }
  }
  const apps = new Map(), groups = [], sourceSummary = [];
  for (const { source, data, lock } of loaded) {
    const summary = { source: source.id, version: data.version, commit: lock.commit,
      appEntries: data.apps.length, appGroups: 0, globalGroups: 0,
      appRuleRecords: 0, globalRuleRecords: 0, selectorBearingRuleRecords: 0,
      initialEnabledAppGroups: 0, initialEnabledGlobalGroups: 0 };
    for (const app of [{ id: '@global', name: '全局规则', groups: data.globalGroups ?? [] }, ...data.apps]) {
      const global = app.id === '@global';
      if (!global) {
        if (!apps.has(app.id)) apps.set(app.id, { id: app.id, names: [], sources: [], groups: [] });
        const entry = apps.get(app.id);
        if (app.name && !entry.names.includes(app.name)) entry.names.push(app.name);
        entry.sources.push(source.id);
      }
      for (const group of app.groups) {
        const id = `${source.id}:${app.id}:${group.key}`, audited = index.get(id);
        if (!audited || audited.rawFingerprint !== hash(group)) throw new Error(`Catalog/audit mismatch: ${id}`);
        const initial = initialGroupState(group, data.categories ?? [], global);
        const rules = list(group.rules).map((raw, i) => {
          const r = typeof raw === 'string' ? { matches: raw } : raw;
          const effective = { ...group, ...r };
          return {
            index: i, key: r.key ?? null, name: r.name ?? null,
            action: r.action ?? group.action ?? null,
            hasExplicitSelector: Boolean(effective.matches || effective.anyMatches),
            snapshotReferenceCount: list(r.snapshotUrls ?? group.snapshotUrls).length,
            constraints: Object.fromEntries(['activityIds', 'excludeActivityIds', 'versionCode', 'versionName',
              'versionCodes', 'excludeVersionCodes', 'versionNames', 'excludeVersionNames',
              'preKeys', 'scopeKeys', 'matchTime', 'actionCd', 'actionMaximum']
              .filter(k => effective[k] !== undefined).map(k => [k, effective[k]])),
            verifiedOnDevice: false
          };
        });
        const entry = {
          id, appId: app.id, appName: app.name ?? app.id, source: source.id, key: group.key,
          name: group.name, category: initial.category ?? (global ? '全局规则' : '未分类'),
          initial, ruleRecords: rules.length,
          selectorBearingRules: rules.filter(r => r.hasExplicitSelector).length,
          status: statuses.get(id) ?? '未纳入计划', findings: audited.referenceFindings,
          fingerprint: audited.fingerprint, provenance: audited.provenance, rules
        };
        groups.push(entry);
        if (!global) apps.get(app.id).groups.push(id);
        summary[global ? 'globalGroups' : 'appGroups']++;
        summary[global ? 'globalRuleRecords' : 'appRuleRecords'] += rules.length;
        summary.selectorBearingRuleRecords += entry.selectorBearingRules;
        if (initial.enabled) summary[global ? 'initialEnabledGlobalGroups' : 'initialEnabledAppGroups']++;
      }
    }
    sourceSummary.push(summary);
  }
  const appList = [...apps.values()].map(app => {
    const own = app.groups.map(id => groups.find(g => g.id === id));
    return { ...app, name: app.names[0] ?? app.id,
      groupRecords: own.length, ruleRecords: own.reduce((n, g) => n + g.ruleRecords, 0),
      hasExplicitSelector: own.some(g => g.selectorBearingRules > 0),
      initialEnabledGroupRecords: own.filter(g => g.initial.enabled).length };
  }).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const categorySummary = [];
  for (const source of sourceSummary) {
    const categories = new Set(groups.filter(g => g.source === source.source).map(g => g.category));
    for (const category of categories) {
      const own = groups.filter(g => g.source === source.source && g.category === category);
      categorySummary.push({ source: source.source, category, groupRecords: own.length,
        appEntries: new Set(own.filter(g => g.appId !== '@global').map(g => g.appId)).size,
        ruleRecords: own.reduce((n, g) => n + g.ruleRecords, 0),
        initialEnabledGroupRecords: own.filter(g => g.initial.enabled).length });
    }
  }
  return { schemaVersion: 1, projectVersion, inputFingerprint: report.inputFingerprint,
    definition: 'Locked upstream inventory, not an exported or device-verified fusion subscription.',
    initialStateAssumption: 'Fresh subscription; app installed; no user/category/group overrides; runtime validity and version matching not included.',
    totals: { appEntriesUnion: appList.length,
      appsWithExplicitSelectors: appList.filter(a => a.hasExplicitSelector).length,
      appGroupRecords: groups.filter(g => g.appId !== '@global').length,
      globalGroupRecords: groups.filter(g => g.appId === '@global').length,
      ruleRecords: groups.reduce((n, g) => n + g.ruleRecords, 0),
      selectorBearingRuleRecords: groups.reduce((n, g) => n + g.selectorBearingRules, 0),
      groupsWithExplicitSelectors: groups.filter(g => g.selectorBearingRules > 0).length,
      initialEnabledGroupRecords: groups.filter(g => g.initial.enabled).length,
      exportedSubscriptions: 0, deviceVerifiedRules: 0 },
    sources: sourceSummary, categories: categorySummary, apps: appList, groups };
}

export function csv(rows) {
  // Escape spreadsheet formulas as data, including upstream-controlled names.
  const cell = value => {
    let text = value === undefined || value === null ? '' : String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
export function appCsv(catalog) {
  return csv([['软件名称', '包名', '上游来源', '是否有显式选择器', '原始规则组记录', '原始规则记录', '初始开启组记录'],
    ...catalog.apps.map(a => [a.names.join(' / ') || a.id, a.id, a.sources.join(' / '),
      a.hasExplicitSelector ? '是' : '否（仅提示占位）', a.groupRecords, a.ruleRecords, a.initialEnabledGroupRecords])]);
}
export function groupCsv(catalog) {
  return csv([['软件名称', '包名', '来源', '组key', '规则组名称', '分类', '原始规则记录', '有显式选择器的记录',
    '初始组开关（非手机实际状态）', '计划状态', '规则名称（未命名时仅列序号）', '校验线索', '源提交'],
    ...catalog.groups.map(g => [g.appName, g.appId, g.source, g.key, g.name, g.category,
      g.ruleRecords, g.selectorBearingRules, g.initial.enabled ? '开' : '关', g.status,
      g.rules.map(r => `${r.index + 1}. ${r.name ?? '未命名规则'}`).join('；'),
      g.findings.map(f => f.kind).join('；'), g.provenance.commit])]);
}
export function catalogMarkdown(catalog) {
  const esc = s => String(s).replaceAll('|', '\\|').replace(/[\r\n]/g, ' ');
  const lines = ['# 软件与规则完整清单', '',
    `项目 v${catalog.projectVersion}；${catalog.totals.appEntriesUnion} 个包名条目，${catalog.totals.appsWithExplicitSelectors} 个至少有显式选择器。`, '',
    '这是固定上游版本的规则清单，不代表融合订阅已经导出或通过手机验证。规则组/记录跨来源重复计数；同名软件以包名区分。', '',
    '“初始开关”假设 App 已安装且没有用户覆盖，不含选择器有效性、版本匹配、App 总开关及设备条件。全局组单列。', '',
    '完整规则名称、来源、约束与定位见 catalog.json / rule-groups.csv；离线筛选见 catalog.html。', ''];
  lines.push('仓库公开文件下载入口：[完整清单目录](https://github.com/zwjst/gkd-rule-fusion/tree/main/catalog)。', '');
  const byId = new Map(catalog.groups.map(g => [g.id, g]));
  for (const app of [...catalog.apps, { id: '@global', name: '全局规则',
    groups: catalog.groups.filter(g => g.appId === '@global').map(g => g.id) }]) {
    lines.push(`## ${esc(app.name)} · ${esc(app.id)}`, '', '| 来源 | 规则组 | 记录数 | 初始开关 | 计划状态 |',
      '| --- | --- | ---: | --- | --- |');
    for (const id of app.groups) {
      const g = byId.get(id);
      lines.push(`| ${g.source} | ${esc(g.name)} | ${g.ruleRecords}${g.selectorBearingRules ? '' : '（占位）'} | ${g.initial.enabled ? '开' : '关'} | ${g.status} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function catalogHtml(catalog) {
  const payload = JSON.stringify(catalog).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  return `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GKD 软件与规则清单</title>
<style>
body{font:15px/1.6 system-ui,sans-serif;background:#f4f6f9;color:#17263a;margin:0}main{max-width:1200px;margin:auto;padding:30px 20px}h1{margin:0}header p{max-width:1000px;color:#4c5c70}.stats{display:flex;gap:12px;flex-wrap:wrap}.stat{background:white;padding:12px 22px;border-radius:10px}.stat b{display:block;font-size:25px}.filters{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0 8px}input,select,button{font:inherit;padding:9px;border:1px solid #b7c2cf;border-radius:6px;background:white}input{flex:1;min-width:220px}button{cursor:pointer}summary{cursor:pointer;padding:15px;font-weight:600}details{background:white;margin:10px 0;border:1px solid #dce2e9;border-radius:8px}small,.muted{color:#526278}.box{padding:0 15px 15px}.group{border-top:1px solid #dce2e9;padding:12px 0}.badge{display:inline-block;font-size:12px;background:#edf2f8;border-radius:4px;padding:2px 6px;margin:0 5px 4px 0}.on{background:#e2f3e8}.off{background:#f1eef6}.warning{background:#fff0cf}.rules{margin:5px 0 0;padding-left:22px}code{word-break:break-all}a{color:#175ba6}#count{margin-bottom:15px}footer{margin-top:20px}.pages{display:flex;align-items:center;gap:10px;margin:20px 0}*:focus-visible{outline:3px solid #1166bb;outline-offset:2px}
</style><main><header><h1>GKD 软件与规则清单 <small>v${catalog.projectVersion}</small></h1>
<p>固定上游输入的可查清单。不是已发布的融合订阅；尚未通过手机验证。规则组与记录数保留各来源重复。初始开关假设 App 已安装、无用户覆盖，不能代表实际运行状态。</p></header>
<div class="stats"><div class="stat"><b>${catalog.totals.appEntriesUnion}</b>软件包条目</div><div class="stat"><b>${catalog.totals.appsWithExplicitSelectors}</b>至少有显式选择器</div><div class="stat"><b>${catalog.totals.appGroupRecords + catalog.totals.globalGroupRecords}</b>原始规则组</div><div class="stat"><b>${catalog.totals.ruleRecords}</b>原始规则记录</div><div class="stat"><b>0</b>已导出融合订阅</div></div>
<div class="filters"><label for="q" hidden>搜索软件和规则</label><input id="q" type="search" placeholder="软件名称、包名或规则，如：微信、通知、原图"><label for="source" hidden>来源</label><select id="source"><option value="">全部来源</option></select><label for="category" hidden>分类</label><select id="category"><option value="">全部分类</option></select><label for="state" hidden>初始组开关</label><select id="state"><option value="">全部初始开关</option><option value="on">初始开启</option><option value="off">初始关闭</option></select><label for="status" hidden>计划状态</label><select id="status"><option value="">全部计划状态</option><option>拟选待验证</option><option>待审核</option></select></div>
<p id="count" role="status" aria-live="polite"></p><div id="apps"></div><div class="pages"><button id="prev">上一页</button><span id="page"></span><button id="next">下一页</button></div>
<footer class="muted">数据以包名区分应用。展开软件可查看逐组来源、名称、规则名称、约束及待查项。全局组作为独立条目显示。此文件可离线使用，不发起网络请求；源文件链接仅在点击时打开。</footer></main>
<script id="data" type="application/json">${payload}</script>
<script>
const data=JSON.parse(document.getElementById('data').textContent), $=id=>document.getElementById(id);
const allApps=[...data.apps,{id:'@global',name:'全局规则',names:['全局规则']}];
const byApp=new Map(allApps.map(a=>[a.id,[]]));for(const g of data.groups)byApp.get(g.appId).push(g);
const text=(tag,value,cls)=>{const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el};
for(const s of data.sources)$('source').append(new Option(s.source,s.source));
for(const c of [...new Set(data.groups.map(g=>g.category))].sort())$('category').append(new Option(c,c));
let page=0,filtered=[];
function update(){page=0;const q=$('q').value.trim().toLocaleLowerCase(),source=$('source').value,category=$('category').value,state=$('state').value,status=$('status').value;filtered=[];
for(const a of allApps){const appMatch=(a.names||[a.name]).join(' ').toLocaleLowerCase().includes(q)||a.id.toLowerCase().includes(q);
const gs=byApp.get(a.id).filter(g=>(!source||g.source===source)&&(!category||g.category===category)&&(!state||g.initial.enabled===(state==='on'))&&(!status||g.status===status)&&(appMatch||g.name.toLocaleLowerCase().includes(q)||g.rules.some(r=>(r.name||'').toLocaleLowerCase().includes(q))));
if(gs.length)filtered.push({app:a,groups:gs});}render();}
function render(){const holder=$('apps');holder.replaceChildren();const start=page*25;
$('count').textContent='匹配 '+filtered.filter(x=>x.app.id!=='@global').length+' 个软件包 / '+filtered.reduce((n,x)=>n+x.groups.length,0)+' 个规则组（按来源计数）；每页 25 项。';
for(const {app,groups} of filtered.slice(start,start+25)){const detail=document.createElement('details');
detail.append(text('summary',app.name+' · '+app.id+' · '+groups.length+' 组'));const box=text('div','','box');
if(!groups.some(g=>g.selectorBearingRules))box.append(text('p','此条目仅含占位/提示记录，没有显式选择器。','warning'));
detail.addEventListener('toggle',()=>{if(!detail.open||box.dataset.loaded)return;box.dataset.loaded='1';
for(const g of groups){const section=text('section','','group');section.append(text('strong',g.name));const badges=text('div','');
for(const [s,c]of [[g.source,''],[g.category,''],['初始'+(g.initial.enabled?'开':'关'),g.initial.enabled?'on':'off'],[g.status,g.status==='待审核'?'warning':''],[g.ruleRecords+' 条记录 / '+g.selectorBearingRules+' 条有显式选择器','']])badges.append(text('span',s,'badge '+c));section.append(badges);
const a=document.createElement('a');a.href='https://github.com/'+g.provenance.repository+'/blob/'+g.provenance.commit+'/'+g.provenance.path;a.target='_blank';a.rel='noopener noreferrer';a.textContent='固定版本源文件';section.append(a,text('small',' · key='+g.key+' · '+g.provenance.pointer));
const list=document.createElement('ol');list.className='rules';for(const r of g.rules){let s=r.name||'未命名规则 #'+(r.index+1);if(r.action)s+=' · 动作 '+r.action;const constraints=Object.entries(r.constraints).map(([k,v])=>k+'='+JSON.stringify(v));if(constraints.length)s+=' · '+constraints.join(' / ');if(!r.hasExplicitSelector)s+=' · 无显式选择器（占位/默认行为待核实）';list.append(text('li',s));}section.append(list);
if(g.findings.length)section.append(text('p','待查：'+g.findings.map(f=>f.kind).join('；'),'warning'));box.append(section);}});detail.append(box);holder.append(detail);}
$('page').textContent=(page+1)+' / '+Math.max(1,Math.ceil(filtered.length/25));$('prev').disabled=page===0;$('next').disabled=(page+1)*25>=filtered.length;
}
for(const id of ['q','source','category','state','status'])$(id).addEventListener(id==='q'?'input':'change',update);
$('prev').onclick=()=>{page--;render()};$('next').onclick=()=>{page++;render()};update();
</script></html>`;
}
