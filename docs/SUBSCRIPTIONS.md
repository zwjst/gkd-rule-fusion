# 融合订阅与使用说明

当前项目 **v0.2.0**，提供已生成的 GKD Rule Fusion **实验版**。软件调查目录与实际订阅采用不同范围：目录调查四源共 1,053 个包名条目，当前融合订阅包含 614 个 App；目录中的条目不能全部当成融合版已支持。

## 本仓库融合实验版

直接复制此地址添加至 GKD：

```text
https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd.json5
```

| 项目 | 当前值 |
| --- | --- |
| 名称 | GKD Rule Fusion · 融合实验版 |
| ID | 20261031 |
| 整数订阅版本 | 1 |
| 通道 | experimental，尚无独立稳定版 |
| 许可 | GPL-3.0-only |
| 内容 | 614 App、1,328 应用组、9 全局组，共 1,337 组 / 2,159 条规则记录 |
| 版本文件 | [gkd.version.json](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd.version.json) |

订阅已在项目内生成，文件及配套说明均位于 [dist](../dist/README.md)。静态校验通过，不代表 Android 导入、点击安全、特定版本适配或耗电已经验证。

## 在 GKD 中导入

1. 复制本仓库的 `dist/gkd.json5` 完整 raw 地址。
2. 打开 GKD 的“订阅”页，点 **+**，粘贴地址并确认添加。客户端版本不同，按钮文字可能略有差异。
3. 确认名称为“GKD Rule Fusion · 融合实验版”、ID 为 **20261031**、版本为 **1**。进入具体 App 或分类，按需开启规则。
4. 先观察常用页面的实际行为，出现误触时关闭对应组并记录 App 版本、页面和快照，再提交问题。详细来源可查 [provenance.json](../dist/provenance.json)。

`catalog.json`、`fusion-plan.json`、CSV、HTML，以及只含 id/version 的版本文件，都不是规则订阅。GKD 本身的权限设置见 [官方使用文档](https://gkd.li/guide/)。

已使用融合版时，通常不应同时启用其已纳入的奥怪和甘霖原订阅相同规则。其他附加订阅需要逐 App、逐组对照，不保证天然无冲突。

## 融合策略与隔离组

每个 App 选择一个上游：共享 App 选择奥怪的完整应用规则，奥怪未包含的 App 选择甘霖。当前是奥怪 **72 App**、甘霖 **542 App**。全局规则仅来自奥怪的 **9 组**，未叠加甘霖全局组。

组 key、规则 key、顺序、scopeKeys、preKeys 以及共享计数/冷却引用均保留。选入范围中存在以下三个上游问题组，已作为明确例外整体隔离，其他保留组没有指向它们的依赖：

| 来源 / App | 隔离组 | 原因 |
| --- | --- | --- |
| 甘霖 / 刺猬猫阅读 `com.kuangxiangciweimao.novel` | key 5，功能类-签到 | 两条规则继承 actionCdKey=2，但显式作用域内无规则 key 2 |
| 甘霖 / 懂车帝 `com.ss.android.auto` | key 1，全屏广告-首页推荐卡片广告 | 两条规则的 preKeys=1 无可解析的显式目标 |
| 甘霖 / 优酷 `com.youku.phone` | key 1，更新提示 | rules=[]，为空占位组 |

隔离从原始候选 1,340 组 / 2,164 记录中移除了 3 组 / 5 记录，留下 1,337 组 / 2,159 记录。三个 App 的其他保留组仍在订阅内，所以 App 总数为 614。没有通过补造 key 或删除前置条件来使错误规则“通过”。完整原因与定位见 [quarantine.json](../dist/quarantine.json)。

Lin-arm 和木七仍可用于四源对照目录，但目前未进入成品：Lin-arm 许可未明确，木七的 GPL 版本范围和传播声明关系待核实。发布范围没有默认扩展为全部四源。

## 初始开关与全局交互

为保留各来源初始配置，导出器按原分类列表第一个名称前缀匹配，计算应用组 `category?.enable ?? group.enable ?? true`，并写为每组显式 `enable`；融合分类不写默认 enable。全局组使用其原 `group.enable ?? true`。这保留初始组开关，不保证运行时一定启用。

用户修改类别、App、组或订阅总开关后，实际启用状态会改变。规则有效性、App 安装状态、版本/活动限制、用户排除和设备页面也会影响执行。

奥怪全局组的 `disableIfAppGroupMatch` 会按组名匹配同订阅内的应用组；加入甘霖补充 App 后，某些全局组可能在这些 App 上被屏蔽，以避免与应用组重复。匹配还受 `ignoreGlobalGroupMatch`、全局 apps 排除、桌面和系统 App 策略等影响。这是融合结构带来的交互变化，尚未完成实机回归；不能把 9 个全局组直接加到每个 App 的支持组数中。

## 校验与证据

本次成品静态校验：**2,253 / 2,253 个不同选择器通过，0 错误、0 警告**。还检查基础结构、重复身份、显式 scope/pre/shared 引用完整性。官方工具执行选择器语法、属性类型与静态正则编译；完整范围和工具链摘要见 [validation.json](../dist/validation.json)。

尚未执行 Android 客户端完整导入或设备操作、正负快照回归、坐标表达式完整语法/求值验证、耗电与性能测量。静态通过不表示全量兼容、无误触或任何 App 版本都有效。

- [成品 manifest](../dist/manifest.json)：订阅身份、内容数量、输入与产物摘要、源码归档信息。
- [实际软件 CSV](../dist/apps.csv)、[实际规则组 CSV](../dist/rule-groups.csv)：仅列当前融合订阅中的 614 个 App、1,337 组。
- [逐组/逐规则来源](../dist/provenance.json)：固定提交、路径、JSON Pointer 和导出变更。
- [隔离组](../dist/quarantine.json)：未导出问题及原因。
- [SHA-256 校验表](../dist/files.sha256)：成品与配套元数据摘要。
- [对应源码与许可](../third_party/README.md)：两个固定提交完整源码、原始声明及重建方法。
- [修改声明与署名](../dist/NOTICE.md)：修改日期、派生处理说明与源码归档摘要。

## 更新与版本

本仓库订阅声明 `checkUpdateUrl: './gkd.version.json'`，对应同目录版本文件。文件只需包含相同订阅 ID 与整数版本；版本增加后，GKD 才会替换旧内容。本仓库未来发布内容变化必须保持 ID **20261031** 并递增订阅版本。

当前产物基于锁定且审核过的两个提交。**尚未宣称自动同步上游、自动晋升稳定版或手机端更新回退已验证。** 更新候选需要审核来源提交、许可、引用、隔离变化和回归结果；详细计划见 [ROADMAP](ROADMAP.md)。

奥怪原订阅另有路径问题：其 `checkUpdateUrl` 指向 `custom/dist/gkd.version.json5`，本轮返回 HTTP 404；实际提供的 `custom/dist/aoguai_gkd.version.json5` 返回 HTTP 200。官方客户端源码在检查版本失败后会继续尝试抓完整订阅，但本轮没有实机验证。**本仓库使用独立生成的 gkd.version.json，不继承该错误路径。**

## 可选上游原订阅

以下链接来自各上游 README，由原作者独立维护，**不是本仓库融合版的镜像或其他通道**。本轮正文请求均为 HTTP 200，ID/版本与锁定快照一致；浮动分支后续可继续变化。

| 来源 | 官方订阅地址 | 本轮 ID / 版本 |
| --- | --- | --- |
| [奥怪](https://github.com/aoguai/subscription) | [aoguai_gkd.json5](https://raw.githubusercontent.com/aoguai/subscription/custom/dist/aoguai_gkd.json5) | 86 / v89 |
| [甘霖](https://github.com/ganlinte/GKD-subscription) | [ganlin_gkd.json5](https://raw.githubusercontent.com/ganlinte/GKD-subscription/main/dist/ganlin_gkd.json5) | 233 / v72 |
| [Lin-arm](https://github.com/Lin-arm/GKD_subscription) | [gkd.json5](https://raw.githubusercontent.com/Lin-arm/GKD_subscription/main/dist/gkd.json5) | 667 / v622 |
| [木七](https://github.com/yanmuq/muqi_gkd) | [gkd.json5](https://raw.githubusercontent.com/yanmuq/muqi_gkd/main/dist/gkd.json5) | 808 / v53 |

本次融合采用奥怪 GPL-3.0-only 与甘霖 MIT，按 GPL-3.0-only 提供派生产物，并保留两源许可、版权和对应源码。完整说明见 [third_party](../third_party/README.md)。其他两源的官方链接列出供用户对照，不表示本仓库获得其再发布授权。

`reports/2026-10-31/` 的早期 v0.1 文档保留历史审计状态。当前订阅范围和校验以本页、[manifest](../dist/manifest.json) 和 [validation](../dist/validation.json) 为准。
