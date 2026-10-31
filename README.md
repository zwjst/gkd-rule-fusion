# GKD Rule Fusion

**项目简介：** 多源 GKD 规则融合、去重、静态安全审核与自动订阅发布。提供原有稳定基线和独立的六源融合实验通道；新增规则跳过 Android 实机测试，需自行承担误触风险。

## 六源融合实验通道（构建中）

目标订阅地址：

\`\`\`text
https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd-fused.json5
\`\`\`

该地址**只有在融合构建、选择器验证和 PR 合并成功后才可导入**，目前不得视为已发布。融合策略优先保留原有订阅的应用配置，对六个候选来源只追加尚不存在且未触发静态风险拦截的完整应用，跳过冲突应用与高风险应用；不代表六源全部规则已合并。来源授权依据仓库所有者的声明，尚未由本项目独立验证；设备测试状态为 **SKIPPED_UNVERIFIED**。详细来源和跳过统计以发布后的 \`dist/gkd-fused-manifest.json\` 为准。


GKD 多源规则融合、审计与个人定制工程。当前项目 **v0.2.0**，已生成可导入的**融合实验版**；稳定版和 Android 实机验证仍待完成。

## 导入融合实验版

复制以下订阅地址，在 GKD 的“订阅”页点 **+** 并粘贴：

```text
https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd.json5
```

订阅名称：**GKD Rule Fusion · 融合实验版**；ID **20261031**；订阅版本 **1**；通道 **experimental**。这是本仓库生成的融合订阅，采用 **GPL-3.0-only** 许可。

| 当前成品 | 数量 |
| --- | ---: |
| 软件 App | 614 |
| 应用规则组 | 1,328 |
| 全局规则组 | 9 |
| 规则组总数 | 1,337 |
| 规则记录 | 2,159 |
| 隔离未导出的上游问题组 | 3 |

本次成品的 **2,253 个不同选择器**通过官方选择器语法、类型与静态正则检查；成品基础结构、重复身份和显式引用完整性检查为 **0 错误、0 警告**。尚未执行 Android 客户端导入、正负快照回归、点击安全或耗电验证，坐标表达式也未完整编译验证。实验版适合按需试用，不能把静态检查通过当成所有设备都有效。

- [订阅、导入与更新说明](docs/SUBSCRIPTIONS.md)
- [成品文件说明](dist/README.md)、[版本描述文件](dist/gkd.version.json)
- [成品清单与摘要](dist/manifest.json)、[逐组与逐规则来源](dist/provenance.json)
- [实际 614 个 App CSV](dist/apps.csv)、[实际 1,337 个规则组 CSV](dist/rule-groups.csv)
- [成品校验结果](dist/validation.json)、[隔离清单](dist/quarantine.json)、[SHA-256 校验表](dist/files.sha256)
- [修改声明与署名](dist/NOTICE.md)、[完整对应源码、原始许可](third_party/README.md)

## 融合范围与规则选择

当前选用 **奥怪 aoguai 的 72 个 App**，再加入**甘霖 ganlinte 中奥怪未包含的 542 个 App**。共享 App 选择奥怪整套应用规则；每个 App 仅来自一个上游，保留原组 key、规则 key、顺序和引用。全局规则只选奥怪的 9 组，避免叠加多个来源的全局规则。

三个存在空占位或悬空引用的甘霖组已整体隔离，未静默修 key、删除前置条件或拆散其规则链。其余保留组的显式引用已重新检查。详细策略、隔离原因和全局交互变化见 [订阅说明](docs/SUBSCRIPTIONS.md#融合策略与隔离组)。

原来源的分类默认值已解析为每组显式 `enable`，融合分类不设置默认开关，以保留初始组配置。用户后续在 GKD 中修改类别、App 或组开关仍会改变实际启用状态。融合后全局组的 `disableIfAppGroupMatch` 会看到补充 App 的组，这是需要设备回归验证的交互变化。

**Lin-arm 和木七目前只参与调查清单，未进入融合订阅。** 前者当前提交缺少明确许可，后者 GPL 版本范围及传播声明关系待核实。已纳入的奥怪采用 GPL-3.0-only、甘霖采用 MIT；完整原始源码与声明随项目提供。

## 查看四源完整调查清单

清单快照为 **2026-10-31（北京时间）**：四源包名去重后 **1,053 个条目**，其中 **1,051 个至少有显式选择器**；跨来源累计 **4,290 个规则组、6,787 条原始记录**。这些是调查范围，**不等于当前融合订阅的 614 个 App**；跨来源重复和占位均保留标识。

| 入口 | 内容 |
| --- | --- |
| [全部软件与规则组](catalog/APP_CATALOG.md) | 软件名称、包名、各来源规则组、初始开关和审核状态 |
| [软件总表 CSV](catalog/apps.csv) | 软件筛选与表格导入 |
| [逐组规则 CSV](catalog/rule-groups.csv) | 规则名称、记录数、来源和默认开关；详细约束见 JSON 或交互清单 |
| [下载离线交互清单](catalog/index.html) | 下载后用浏览器本地打开，支持搜索筛选；非在线预览 |
| [完整机器数据 JSON](catalog/catalog.json) | 四源目录数据，不能作为 GKD 订阅导入 |
| [清单口径与更新方式](catalog/README.md) | 调查范围、历史校验和复现说明 |

## 可选的上游订阅

以下由上游独立维护，**不是本仓库融合订阅的其他通道**。已使用融合版时，再同时开启奥怪/甘霖原订阅可能重复执行；附加来源也应按具体缺口逐组启用。

| 来源 | 官方订阅文件 | 锁定快照版本 / App / 应用组 / 全局组 |
| --- | --- | --- |
| [奥怪 aoguai](https://github.com/aoguai/subscription) | [aoguai_gkd.json5](https://raw.githubusercontent.com/aoguai/subscription/custom/dist/aoguai_gkd.json5) | v89 / 72 / 280 / 9 |
| [甘霖 ganlinte](https://github.com/ganlinte/GKD-subscription) | [ganlin_gkd.json5](https://raw.githubusercontent.com/ganlinte/GKD-subscription/main/dist/ganlin_gkd.json5) | v72 / 610 / 1,389 / 3 |
| [Lin-arm](https://github.com/Lin-arm/GKD_subscription) | [gkd.json5](https://raw.githubusercontent.com/Lin-arm/GKD_subscription/main/dist/gkd.json5) | v622 / 997 / 2,490 / 3 |
| [木七 yanmuq](https://github.com/yanmuq/muqi_gkd) | [gkd.json5](https://raw.githubusercontent.com/yanmuq/muqi_gkd/main/dist/gkd.json5) | v53 / 34 / 116 / 0 |

上游四个正文链接在本轮请求中均为 HTTP 200。奥怪上游的版本检查路径另有 404，不影响本仓库单独生成的版本文件；详情见 [更新说明](docs/SUBSCRIPTIONS.md#更新与版本)。

## 开发与复现

需要 Node.js >=22（本轮为 Node.js 24）、npm 和 Git。读取固定 Git 对象，不执行上游源码或安装上游依赖。

```sh
git clone https://github.com/zwjst/gkd-rule-fusion.git
cd gkd-rule-fusion
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix tools/selector-validation ci --ignore-scripts --no-audit --no-fund
npm test
npm --prefix tools/selector-validation test
npm run sync
npm run build:fusion
npm run build:catalog
```

若默认 npm 缓存不可写，可给 npm 命令增加 `--cache /tmp/gkd-npm-cache`。

- `sync` 拉取并校验 `sources.lock.json` 的固定提交，不跟随浮动分支。
- `build:fusion` 按 `config/fusion.json`、已审核提交和来源/key 状态账本生成成品、校验、来源、隔离记录及源码归档。它会更新本地生成文件，不自动上传。
- `build:catalog` 生成仓库内完整四源调查目录。
- `audit`、`plan`、`catalog` 仍可生成 `reports/latest/` 的四源研究报告和审核计划。审核计划不是当前成品，不可导入 GKD。
- `sync -- --update` 才显式更新来源锁文件。上游变化需重新审核提交、许可和规则差异；不应把此命令用于日常复现。

当前使用锁定的、已审核的两个提交；**尚未宣称已自动跟随上游更新**。成品内容变化必须增加 `config/fusion.json` 的整数订阅版本，保持订阅 ID 不变。来源迁移和类别/key 状态不得静默重置；详见 [开发路线](docs/ROADMAP.md)。

## 个人定制与历史报告

`config/policy.json` 独立于上游，已有组的禁用/替换绑定指纹，上游行为变化要求重新审核；个人新增使用独立命名空间。发布器会校验支持的个人覆盖，四源研究计划中的逐组 decisions 需要先明确迁移，不能绕过整 App 发布策略。具体支持范围以构建错误和测试为准。

[上游研究](docs/UPSTREAM_RESEARCH.md)、[四源静态审计](reports/2026-10-31/AUDIT.md) 和 [v0.1 校验报告](reports/2026-10-31/VALIDATION.md) 保留早期阶段结论，可能描述当时“尚无融合导出”。**当前成品状态以本 README 和 dist/manifest.json、dist/validation.json 为准。**
