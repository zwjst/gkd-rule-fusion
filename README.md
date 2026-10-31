# GKD Rule Fusion

多源 GKD 规则的版本锁定、静态审计、融合决策与个人覆盖工程。

当前交付为**第一阶段：真实四源审计 + 可运行的融合决策基础框架**。输出审计报告和待审核计划，尚不生成可导入 GKD 的订阅，也不自动发布稳定版/测试版。后续验收见 [开发路线](docs/ROADMAP.md)。

## 查看完整软件与规则清单

当前项目 **v0.1.0**，数据快照 **2026-10-31（北京时间）**：四源包名去重后有 **1,053 个条目**，其中 **1,051 个至少有显式选择器**；累计 **4,290 个规则组、6,787 条原始规则记录**。跨来源仍有重复，不能解释为融合后的唯一规则数。两条仅含提示占位的软件条目已在清单中标识。

| 入口 | 内容 |
| --- | --- |
| [完整软件与规则组清单](catalog/APP_CATALOG.md) | 在仓库直接查看软件名称、包名、各来源规则组、初始开关与审核状态 |
| [软件总表 CSV](catalog/apps.csv) | 按软件筛选、排序及导入表格工具 |
| [逐组规则 CSV](catalog/rule-groups.csv) | 逐组规则名称、记录数、来源、配置默认开关与审核线索；详细约束见 JSON 或交互清单 |
| [下载离线交互清单](catalog/index.html) | 下载文件后在浏览器打开，搜索和筛选；这是离线文件，非在线预览 |
| [完整机器数据 JSON](catalog/catalog.json) | 应用、逐组规则与来源等完整目录数据 |
| [清单说明与更新方式](catalog/README.md) | 数据口径、文件用途及复现方式 |

本轮 **35 项测试通过（主项目 32 + 独立选择器工具 3）**；官方工具检查的 **5,634 个不同选择器语法和类型均通过**。这些是静态校验结果，不代表手机端导入、点击安全或耗电验证通过。细节见 [校验报告](reports/2026-10-31/VALIDATION.md)。

## 可使用的上游订阅链接

以下是四个上游 README 公布的订阅文件链接，随各自分支更新。**它们属于上游订阅，本仓库当前没有已导出的融合订阅链接。** 完整清单是规则目录，不是 GKD 可导入文件。

| 来源 | 官方订阅文件 | 本轮订阅 ID / 版本 |
| --- | --- | --- |
| [奥怪 aoguai](https://github.com/aoguai/subscription) | [复制订阅链接](https://raw.githubusercontent.com/aoguai/subscription/custom/dist/aoguai_gkd.json5) | 86 / v89 |
| [甘霖 ganlinte](https://github.com/ganlinte/GKD-subscription) | [复制订阅链接](https://raw.githubusercontent.com/ganlinte/GKD-subscription/main/dist/ganlin_gkd.json5) | 233 / v72 |
| [Lin-arm](https://github.com/Lin-arm/GKD_subscription) | [复制订阅链接](https://raw.githubusercontent.com/Lin-arm/GKD_subscription/main/dist/gkd.json5) | 667 / v622 |
| [木七 yanmuq](https://github.com/yanmuq/muqi_gkd) | [复制订阅链接](https://raw.githubusercontent.com/yanmuq/muqi_gkd/main/dist/gkd.json5) | 808 / v53 |

在 GKD 的“订阅”页点 **+**，粘贴订阅文件地址并确认添加，再按自己的 App 和功能开启规则。建议先选择一个主来源，附加来源按需启用；同时导入并全部开启可能重复执行。详见 [导入、更新、默认开关与许可说明](docs/SUBSCRIPTIONS.md)。

本轮四个文件均返回 HTTP 200，解析出的版本与锁定快照一致。奥怪订阅正文声明的版本检查路径另返回 404，尚未确认客户端自动更新回退；具体路径见订阅说明。Lin-arm 的许可证未明确，木七另有传播声明；本仓库保留上游链接和审计元数据，未将其规则正文再发布为融合订阅。

## 快速运行

需要 Node.js >=22（已在 Node.js 24 验证）、npm 和 Git。无需 API Key，不执行上游 TypeScript 或安装上游依赖。

```sh
git clone https://github.com/zwjst/gkd-rule-fusion.git
cd gkd-rule-fusion
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run sync
npm run plan
npm run catalog
```

重新生成仓库中的公开清单：

```sh
npm --prefix tools/selector-validation ci --ignore-scripts --no-audit --no-fund
npm --prefix tools/selector-validation test
npm run build:catalog
```

`build:catalog` 将锁定输入生成到 `catalog/`，执行官方选择器检查并生成公开文件 SHA-256 清单。它不会导出订阅或执行 Git 推送。输入快照改变后，需先更新并复核日期报告，再刷新公开清单。

若云环境默认 npm 缓存不可写，给 npm 命令增加 `--cache /tmp/gkd-npm-cache`，例如 `npm --cache /tmp/gkd-npm-cache ci --ignore-scripts --no-audit --no-fund`。

- `sync` 获取锁定完整提交并校验订阅、许可证/声明文件的 SHA-256，不跟随浮动分支。
- `audit` 离线解析已缓存锁定输入，生成 `reports/latest/AUDIT.md` 与 `audit.json`。
- `plan` 另生成 `fusion-plan.json`，包含拟选、隔离、拒绝、许可证阻塞和多来源 App 清单。
- `catalog` 另生成可离线筛选的 `catalog.html`、完整 `APP_CATALOG.md`、`apps.csv`、`rule-groups.csv`、`catalog.json`。含名称、包名、来源、逐组配置默认开关、审核状态、规则名称及约束，不含选择器正文。
- `sync -- --update` 显式跟随配置分支，生成新锁文件；需要审阅 diff 后纳入版本控制。

仓库已提供真实审计的 `sources.lock.json`，日常复现不要使用 `--update`。首次无锁文件才运行 `npm run sync -- --update`。缓存默认 `.cache/fusion`；`--cache DIR` 可指定。所有命令从项目根目录执行，`--sources`、`--lock`、`--policy`、`--out` 可指定独立路径。

## 已调查来源

| 来源 | 分支 | 订阅文件 | 本轮 App / 应用组 / 全局组 |
| --- | --- | --- | --- |
| [aoguai/subscription](https://github.com/aoguai/subscription) | custom | dist/aoguai_gkd.json5 | 72 / 280 / 9 |
| [ganlinte/GKD-subscription](https://github.com/ganlinte/GKD-subscription) | main | dist/ganlin_gkd.json5 | 610 / 1389 / 3 |
| [Lin-arm/GKD_subscription](https://github.com/Lin-arm/GKD_subscription) | main | dist/gkd.json5 | 997 / 2490 / 3 |
| [yanmuq/muqi_gkd](https://github.com/yanmuq/muqi_gkd) | main | dist/gkd.json5 | 34 / 116 / 0 |

详见 [固定版本审计](reports/2026-10-31/AUDIT.md)、[调查结论与许可证证据](docs/UPSTREAM_RESEARCH.md)、[本轮校验结果](reports/2026-10-31/VALIDATION.md) 和 [全部软件规则](catalog/APP_CATALOG.md)。数字来自实际文件，不从 README 推算。aoguai 的 280 是应用规则组数。

## 比较与融合边界

组身份为 `source:appId:groupKey`，全局组 appId 为 `@global`。每条规则保留索引、原 key、来源提交、文件摘要、JSON Pointer 和指纹。输入从 Git 对象读取，缓存工作树改动不会替代锁定内容。

结构重复仅比较规范化规则内容；上下文完全重复还比较 App 元数据、组 key/名称、分类默认值、作用域目标。已知列表字段统一字符串/单元素数组形式，选择器文本、顺序、引用及未知字段保留。结构重复不能直接合并。当前采用保守分类上下文，因此四源中未判定上下文完全重复组。

同 App 同名不同实现、同选择器不同上下文列为**潜在差异/冲突**，不宣称行为等价或互斥。不同选择器也可能执行同一件事，当前检测并不完备。快照链接只表示存在引用，不表示验证通过。约束指示项不作质量分数。跨来源多选 App 另列入人工复核。

完整重复组才按来源偏好合并拟选身份，并保留全部来源；差异候选默认隔离。来源偏好不代表质量排名。计划 `publicationReady` 固定为 `false`，第一阶段没有导出器，修改 `publicationApproved` 也不会开启发布。

## 个人定制与审核

`config/policy.json` 独立于缓存和锁文件，同步不会改写它。已有组修改/禁用绑定审计 `fingerprint`，上游行为改变时报 stale 并终止计划生成。说明性文字变化不改变行为指纹。

禁用项放入 `overrides`：

```json
{
  "target": "ganlinte:com.example:0",
  "operation": "disable",
  "expectedFingerprint": "从 audit.json 复制真实 fingerprint",
  "reason": "此版本会误触"
}
```

`replace` 还须提供完整 `group`、保留原 key，替换默认待审核。`add` 提供 `target: personal:包名:key`、`app`、`group`、`reason`，在个人命名空间新增应用组；暂不支持个人全局组新增。更改只形成计划，不改写上游，也未在手机验证。

`decisions` 以完整组身份为 key，值为 `{ "action": "select 或 reject", "expectedFingerprint": "真实指纹", "reason": "审核依据" }`。明确决策可解除潜在冲突隔离。未知身份、过期指纹和缺少理由均报错。

## CI 与复现

`.github/workflows/audit.yml` 在 push、PR、手动触发及每日北京时间 03:20 运行测试、同步**固定版本**并上传审计 artifacts。不会创建 Release、推送分支或自动批准许可证。GitHub 托管执行尚未验证，本地对应步骤已验证。

旧锁文件/策略恢复后执行 sync 和 plan，可复现对应计划。输出不含当前时间，可逐字节对比。上游删除提交会导致拉取失败，需要后续合规归档策略，当前不承诺永久远程可用。

固定摘要保存在 `reports/2026-10-31/AUDIT.md`、`summary.json`。完整机器报告和计划较大、可复现，默认忽略，不提交上游规则正文：

```sh
npm run sync
npm run plan -- --out reports/2026-10-31
```

测试使用合成规则和临时本地 Git 仓库，验证重复/差异、跨组引用、个人覆盖、篡改拒绝与确定性。真实四源同步、解析和计划另已实际执行。尚未进行 GKD 导入、设备快照执行、误触/耗电测量，也未实现发布通道。
