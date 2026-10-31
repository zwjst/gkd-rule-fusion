# 历史审计记录与当前成品验证

本页以下保留 v0.1.0 阶段的四源审计口径；当前项目已导出 v1 融合实验订阅。成品检查请看 [dist/validation.json](../dist/validation.json)，导入和范围见 [订阅说明](../dist/README.md)。

# 当前版本校验结果与数据说明

项目版本：**0.1.0**。数据快照日期：**2026-10-31（北京时间）**。本轮未更新上游分支，复用 sources.lock.json 的四个完整提交。项目是第一阶段审计/决策工具，还没有可导入的融合订阅。

仓库公开文件及校验清单统一在 [catalog 目录](https://github.com/zwjst/gkd-rule-fusion/tree/main/catalog)。本报告提及的本地生成文件可在那里下载，公开 HTML 文件名为 `index.html`。

## 校验结论

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| 固定输入完整性 | 通过 | 四源 JSON5 均与锁定 SHA-256 一致；来源声明文件也由主 CLI 校验 |
| 主项目测试 | 32 / 32 通过 | 解析、重复/冲突候选、个人覆盖、跨组引用、数据目录、默认开关、CSV、CLI、确定性等 |
| 独立选择器工具测试 | 3 / 3 通过 | 错误输入非零退出、摘要/配置篡改拒绝、三种选择器字段及继承计数 |
| 官方选择器语法与类型 | 5,634 / 5,634 通过 | 共 7,577 处引用，去重后编译；含 matches、anyMatches、excludeMatches |
| 官方 WASM 正则编译 | 已执行 | 真实选择器触发 464 次；另有错误语法/正则/属性类型负向控制 |
| 软件/规则目录 | 通过 | 独立从 Git 对象复算 4,290 组，与生成 JSON 计数、名称和配置默认值一致 |
| 离线清单交互 | 通过 | JSDOM 检查搜索、展开、来源/分类/开关/状态筛选、分页、空结果与占位提示；不加载网络资源 |
| 官方完整订阅结构校验 | 尚未执行 | 选择器通过不能代替完整订阅、引用关系和客户端兼容性验证 |
| Android 实机、正负快照回归 | 尚未执行 | 不宣称命中、点击安全、耗电或特定版本实际适配通过 |
| 融合订阅导出、稳定/测试发布 | 尚未实现 | publicationReady=false，已发布融合订阅数为 0 |

官方解析器版本为 `@gkd-kit/selector@0.5.22`、`@gkd-kit/wasm_matches@0.0.1`，Node.js 24.19.0。完整结果和工具链摘要见 [selector-validation.json](selector-validation.json)，复现工具见 [说明](../tools/selector-validation/README.md)。这不是通过 GKD 手机端导入执行得到的结果。

## 四源具体数据

| 来源 | 上游版本 | 软件包条目 | 应用组 | 全局组 | 应用规则记录 | 全局规则记录 | 合计 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aoguai | 89 | 72 | 280 | 9 | 645 | 57 | 702 |
| ganlinte | 72 | 610 | 1,389 | 3 | 1,987 | 3 | 1,990 |
| Lin-arm | 622 | 997 | 2,490 | 3 | 3,928 | 4 | 3,932 |
| yanmuq | 53 | 34 | 116 | 0 | 163 | 0 | 163 |
| 按来源累计 | — | 1,713 | 4,275 | 15 | 6,723 | 64 | 6,787 |

包名去重并集 **1,053**，其中 **1,051** 个至少有显式选择器。4,290 组中 **4,286** 组至少有显式选择器；6,787 条原始记录中 **6,784** 条带显式选择器（应用 6,720，全局 64）。跨来源的组和规则记录仍重复计数，不能当成融合后唯一数量。

### 占位和统计修正

- Gemini `com.google.android.apps.bard` 与原版 InstallerX `com.rosan.installer.x` 只有移步其他 App 的提示组、`rules:[{}]`，不应列为实际可操作适配。
- Lin-arm 的 InstallerX revived 另有一条空对象占位；该包在其他来源/规则组仍有实际选择器，因此不从 1,051 中剔除。
- 甘霖优酷 `com.youku.phone` 的“更新提示”是 `rules:[]` 空占位组，不能视为可执行更新提示规则。
- 已修正 `hasVersionLimit` 遗漏新版 `versionCode` / `versionName` 的统计问题。Lin-arm 实际有 **14 条**版本约束规则：番茄免费小说 2、汽水音乐 10、微信 2。其余三源在本次订阅中未发现这类运行版本约束；这不表示规则兼容所有版本。

## 默认开关

以下是**订阅配置默认值**：假设 App 已安装、无用户覆盖，不含组有效性、App 总开关、订阅总开关、活动/版本匹配和设备条件。

| 来源 | 应用组默认开 / 关 | 全局组默认开 / 关 |
| --- | ---: | ---: |
| aoguai | 4 / 276 | 1 / 8 |
| ganlinte | 104 / 1,285 | 3 / 0 |
| Lin-arm | 180 / 2,310 | 3 / 0 |
| yanmuq | 16 / 100 | 0 / 0 |
| 按来源累计 | 304 / 3,971 | 7 / 8 |

应用分类按原列表**第一个名称前缀匹配**，默认值为 `category?.enable ?? group.enable ?? true`；全局组为 `group.enable ?? true`。分类 enable 可覆盖显式 group.enable。木七 12 个开屏组都默认关，默认开的是 12 个“全屏弹窗”组和 4 个“权限控制”组。各源不同，不能统一说“所有开屏规则默认开”。

依据官方 GKD 固定提交 `be5eb76caabbec5cca1ec45569773b2b5f742ef7`：

- [分类匹配](https://github.com/gkd-kit/gkd/blob/be5eb76caabbec5cca1ec45569773b2b5f742ef7/gkd-app/src/commonMain/kotlin/li/gkd/app/subscription/RawSubscription.kt#L71)
- [组开关优先级与有效性](https://github.com/gkd-kit/gkd/blob/be5eb76caabbec5cca1ec45569773b2b5f742ef7/gkd-app/src/commonMain/kotlin/li/gkd/app/rule/RuleGroupPolicy.kt#L118)
- [新旧版本约束](https://github.com/gkd-kit/gkd/blob/be5eb76caabbec5cca1ec45569773b2b5f742ef7/gkd-app/src/commonMain/kotlin/li/gkd/app/subscription/RawSubscriptionParser.kt#L249)

全局组不计入每个 App 的组数；是否适用还受 apps 排除、系统 App/桌面策略、disableIfAppGroupMatch 等条件影响。

## 融合与差异结果

37 簇跨来源结构重复组、79 簇结构重复规则、1,467 条潜在差异/冲突线索。它们是保守静态线索，可能重叠，不能解释为 1,467 个确定故障。上下文完全重复为 0 簇，未自动折叠结构相同但上下文不同的组。

当前计划为 **2,423 个拟选组、1,867 个待审核组、0 个拒绝组**。325 个 App 存在多来源拟选，需要进一步审查。拟选不是实机验证通过，也不是最终融合订阅规则数。许可尚未获准发布的来源仍保持独立状态。

## 软件与规则类型

完整 1,053 个包名条目及逐组规则见 [APP_CATALOG.md](APP_CATALOG.md)。便于筛选的文件为 `index.html`（离线交互）、`apps.csv`（软件总表）、`rule-groups.csv`（逐组规则与名称）、`catalog.json`（完整机器数据）。

按上游分类、跨来源累计的应用组记录：全屏广告 1,394、局部广告 756、功能类 628、更新提示 428、开屏广告 301、权限提示 258、分段广告 202、通知提示 99、评价提示 73、其他 71、青少年模式 48、全屏弹窗 12、权限控制 4、青少年弹窗 1。不能据此认为同一软件具备所有类型。

## 复现命令

```sh
cd gkd-rule-fusion
npm --cache /tmp/gkd-npm-cache ci --ignore-scripts --no-audit --no-fund
npm test
npm run catalog -- --out reports/2026-10-31
npm --cache /tmp/gkd-npm-cache --prefix tools/selector-validation ci --ignore-scripts --no-audit --no-fund
npm --prefix tools/selector-validation test
node tools/selector-validation/check.mjs
```

若固定 Git 缓存缺失，先 `npm run sync`；复现不要使用 `--update`。真实 CI 托管执行尚未验证；本轮对应本地命令和离线界面交互已执行。
