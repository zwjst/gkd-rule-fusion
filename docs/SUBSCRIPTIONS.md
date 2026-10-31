# 订阅链接与使用说明

本页提供四个上游仓库公布的订阅文件地址。**当前 GKD Rule Fusion v0.1.0 仅发布审计和软件规则目录，没有导出本仓库自己的融合订阅，也没有稳定版/测试版融合订阅链接。** `catalog/` 中的 Markdown、CSV、HTML 和 JSON 是查询清单，不能导入 GKD 作为订阅。

## 上游官方链接

| 来源 | 可复制的官方订阅地址 | 本轮 ID / 版本 | 来源定位 |
| --- | --- | --- | --- |
| [奥怪 aoguai](https://github.com/aoguai/subscription) | [aoguai_gkd.json5](https://raw.githubusercontent.com/aoguai/subscription/custom/dist/aoguai_gkd.json5) | 86 / v89 | 维护范围较精简的主来源候选，72 个 App 条目 |
| [甘霖 ganlinte](https://github.com/ganlinte/GKD-subscription) | [ganlin_gkd.json5](https://raw.githubusercontent.com/ganlinte/GKD-subscription/main/dist/ganlin_gkd.json5) | 233 / v72 | 主来源或补充来源候选，610 个 App 条目 |
| [Lin-arm](https://github.com/Lin-arm/GKD_subscription) | [gkd.json5](https://raw.githubusercontent.com/Lin-arm/GKD_subscription/main/dist/gkd.json5) | 667 / v622 | 社区续更来源，997 个 App 条目；再发布许可待明确 |
| [木七 yanmuq](https://github.com/yanmuq/muqi_gkd) | [gkd.json5](https://raw.githubusercontent.com/yanmuq/muqi_gkd/main/dist/gkd.json5) | 808 / v53 | 附加规则，34 个 App 条目，无全局规则组 |

以下纯文本便于复制。链接中的 `custom` / `main` 是上游分支，会随上游更新，不固定到本仓库审计版本。

奥怪：

```text
https://raw.githubusercontent.com/aoguai/subscription/custom/dist/aoguai_gkd.json5
```

甘霖：

```text
https://raw.githubusercontent.com/ganlinte/GKD-subscription/main/dist/ganlin_gkd.json5
```

Lin-arm：

```text
https://raw.githubusercontent.com/Lin-arm/GKD_subscription/main/dist/gkd.json5
```

木七：

```text
https://raw.githubusercontent.com/yanmuq/muqi_gkd/main/dist/gkd.json5
```

上述路径均取自 [锁定提交](../sources.lock.json) 的上游 README。2026-10-31 实际 HTTPS GET 验证：四条正文链接均为 **HTTP 200**，内容能以 JSON5 解析，ID、版本和 App 数与上表及快照一致。链接可访问不等于已经完成手机端导入或自动更新测试；后续上游变化也不由本仓库控制。

## 在 GKD 中导入

1. 先在 [软件完整清单](../catalog/APP_CATALOG.md) 中查找软件名称或包名，确认需要的来源与规则组。
2. 复制上面的订阅文件地址，打开 GKD 的“订阅”页面，点 **+**，粘贴地址并确认添加。不同客户端版本的按钮文字可能略有差异。
3. 检查订阅名称、ID 和版本，进入对应 App 或规则分类，按自己的需求开启规则。链接应指向 `.json5` 文件，仓库首页或 HTML 清单不能作为订阅导入。
4. 使用时观察是否正确命中。若误触，先关闭对应规则组并保留 App 版本、页面和快照信息，再向对应上游反馈。规则详细名称与来源可在 [逐组清单](../catalog/rule-groups.csv) 查询。

需要 GKD 本身的功能和权限设置时，参考 [GKD 官方使用文档](https://gkd.li/guide/)。本仓库没有实测你的设备权限、App 版本或页面状态。

## 主来源与附加来源

建议先选择一个满足常用 App 需求的主来源，再按具体缺口启用补充来源。多来源的规则组可能使用不同选择器完成同一操作；“附加订阅”定位也不能证明完全无冲突。

主来源之间有大量共享 App。不要仅因来源不同就同时开启同一 App 的所有组，尤其不要同时启用多套全局广告规则。木七没有全局组，但其共享 App 仍需逐组对照。四源的静态覆盖、默认开关和待审核状态见 [完整目录说明](../catalog/README.md)，重复与差异见 [审计报告](../reports/2026-10-31/AUDIT.md)。

## 默认启用状态怎么看

清单中的“初始开关”表示无用户覆盖时的**订阅配置默认值**，假设 App 已安装；不表示当前手机已经实际启用，也不保证规则有效。

| 来源 | 应用组默认开 / 关 | 全局组默认开 / 关 |
| --- | ---: | ---: |
| aoguai | 4 / 276 | 1 / 8 |
| ganlinte | 104 / 1,285 | 3 / 0 |
| Lin-arm | 180 / 2,310 | 3 / 0 |
| yanmuq | 16 / 100 | 0 / 0 |

分类与组开关有继承关系，不能只看 `group.enable`。各源也不能统一概括为“全部开屏规则默认开启”：本轮木七的 12 个开屏组均默认关闭，默认开启的是 12 个“全屏弹窗”组与 4 个“权限控制”组。

实际执行还受订阅总开关、App 总开关、规则有效性、活动/版本限制、用户排除和设备条件影响。全局组还受 App 排除、系统 App/桌面策略、同名应用组覆盖等限制，不能给每个软件直接加上全部全局组。公式和官方证据见 [校验报告](../reports/2026-10-31/VALIDATION.md#默认开关)。

## 更新状态与奥怪版本检查路径

上表的分支订阅地址随上游维护更新。GKD 客户端的检测/刷新方式参考其界面和上游说明；本轮仅验证远程文件获取和静态内容，未实测手机端更新。

奥怪本轮订阅正文包含 `checkUpdateUrl: './gkd.version.json5'`，其实际解析到的地址是：

```text
https://raw.githubusercontent.com/aoguai/subscription/custom/dist/gkd.version.json5
```

该地址在本轮请求中返回 **HTTP 404**。同一提交实际提供的版本文件是：

```text
https://raw.githubusercontent.com/aoguai/subscription/custom/dist/aoguai_gkd.version.json5
```

后者本轮返回 **HTTP 200**。因此可以确认订阅正文能取得，但**尚未确认客户端是否会回退获取完整订阅，以及自动更新是否正常**。本仓库没有修改上游文件；若遇更新失败，请向 aoguai 上游核实并按上游指导处理。不要把版本描述文件本身作为规则订阅导入。

其余三源的正文 `checkUpdateUrl` 文件名与锁定提交中的版本文件名一致；这只是路径核对结果，不代表客户端更新测试通过。

## 许可证与本仓库融合发布状态

| 来源 | 许可调查结果 | 本仓库当前处理 |
| --- | --- | --- |
| aoguai | package 声明 GPL-3.0-only，并有 LICENSE、LEGAL.md；LEGAL 1.4 说明其声明不追加授权条件 | 提供上游官方链接与审计元数据；融合再发布需准备相应源码、修改和署名等交付 |
| ganlinte | LICENSE 为 MIT | 提供上游官方链接与审计元数据；融合再发布仍需保留版权许可并核对派生来源 |
| Lin-arm | 当前提交未见 LICENSE/COPYING；README 有禁止国内平台传播声明及派生链说明 | 不将“GitHub 公开”视作再发布授权；保持许可待明确 |
| yanmuq | 有 GPL v3 文本，only/or-later 范围未明确；README 另有传播限制声明 | 保持再发布条件待核实 |

详细证据见 [上游调查](UPSTREAM_RESEARCH.md)。所有来源的 `publicationApproved` 目前均为 `false`，融合计划的 `publicationReady` 也为 `false`。上游链接可被个人用于订阅，不表示本仓库已经获得将上游正文合并再发布的全部许可。

本仓库公开的是名称、包名、组名、规则名称、配置与定位等目录数据，未把上游选择器正文作为融合订阅再发布。稳定版/测试版导出、完整订阅结构验证、设备回归和发布门禁仍在 [后续开发范围](ROADMAP.md) 中。未来只有实际生成并发布合格产物后，才会在本页增加本仓库的融合订阅地址。
