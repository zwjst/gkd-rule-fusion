# 四源调查结论

调查日期：2026-10-31（北京时间）。依据为 `sources.lock.json` 的真实 Git 提交和订阅文件，不使用搜索索引摘要作事实依据。完整 SHA、订阅/声明文件 SHA-256 均可在锁文件核对。

## 事实与建议

| 来源 | 固定提交 | 提交日期（北京时间） | 订阅版本 | App | 四源独占 App |
| --- | --- | --- | ---: | ---: | ---: |
| aoguai | e0ad57290fed | 2026-09-26 | 89 | 72 | 0 |
| ganlinte | 4746d192b4c5 | 2026-09-24 | 72 | 610 | 51 |
| Lin-arm | ec30889b27a2 | 2026-10-31 | 622 | 997 | 429 |
| yanmuq | 8e166bb5662a | 2026-10-29 | 53 | 34 | 3 |

四源 App 并集为 **1,053**，但 App 出现不等于覆盖其所有功能，更不等于在当前设备有效。木七没有全局规则的定位已由实际文件验证。所有来源均提供 dist JSON5，也有 src/apps TypeScript；本框架仅读取提交中的 dist，不执行上游代码。上游源码改动尚未发布到 dist 时，不会被当成已发布规则。

- **aoguai**：适合作为精简、明确维护范围的主来源候选；实际覆盖 72 App，不能把 280 应用组说成 280 App，也不能称为四源覆盖最广。没有四源独占 App，并不意味着其实现没有改进价值。
- **ganlinte**：可作为主来源或补充来源候选，有 51 个其他三源未出现的 App；优先抽查独占覆盖及共享 App 的规则差异。MIT 文本明确，但派生历史与署名仍需随发布工序记录。
- **Lin-arm**：四源覆盖最广，独占 429 App；README 明确是 AIsouler 停更后的社区续更，不能视为独立原创数据集。固定提交未发现 LICENSE/COPYING 文件，README 有传播限制，适合先审计对照，当前不纳入自动再发布。
- **yanmuq**：附加来源定位成立，34 App、116 组且无全局组。三个独占包名为 `com.meizu.media.music`、`com.microsoft.office.officehubrow`、`com.rt.market.fresh`。对共享 App 仍可能增加功能；“附加订阅”本身不能证明不会冲突。

不建议同时打开三个主来源的全局规则。第一阶段保留来源偏好为 aoguai → ganlinte → Lin-arm → yanmuq，仅用于完全重复候选的稳定排序；没有把该顺序当成质量分数。真正的主来源选择需依据用户常用 App 和正负快照结果。

## 重复与差异

本轮识别 37 簇跨来源结构重复组、79 簇结构重复规则、1,467 条潜在差异/冲突线索。线索按同选择器不同上下文、同 App 同名不同实现产生，可能指向同一对规则，不应相加解释为独立故障数。

上下文完全重复为 0：保守比较保留整套分类默认值、App 上下文、原组身份与作用域目标。结构重复也可能由于分类、默认 enable、计时、App 排除、组链等差异而行为不同。当前不会以结构重复结果直接去重，不声称这 37 簇必须重复执行。

静态审计另记录：甘霖 1 个空占位组及 3 处未在显式作用域内解析到的 preKeys 引用；Lin-arm 共 11 条引用/缺省选择器等待查项。它们进入待审核，**尚不能仅凭静态工具认定为 GKD 客户端缺陷**，需核对客户端隐式 key 和默认匹配行为。Lin-arm 的跨组 scopeKeys 在分析时保留，不能把所有跨组 preKeys 误报为悬空。

各源大量存在 snapshotUrls，但本轮没有下载或执行快照。hasSnapshotReference 仅统计引用存在；activity/time/version 等指示项也不是正确性/耗电评分。来源提交时间不是每条规则的维护时间。

## 许可证证据与发布状态

| 来源 | 实际检查的证据 | 当前判断 | 自动发布 |
| --- | --- | --- | --- |
| aoguai | LICENSE、package.json、README、LEGAL.md | package 明确 GPL-3.0-only；LEGAL 1.4 明确其声明不补充限制 LICENSE 的授权 | 未批准，需准备 GPL 对应源码、修改与署名等交付 |
| ganlinte | LICENSE、package.json、README | MIT；需要保留完整版权与许可并调查派生来源 | 未批准，第一阶段不生成订阅 |
| Lin-arm | 完整 Git 文件树、package.json、README | 未见许可证；README 含禁止国内平台传播声明，且明确派生链 | NOASSERTION，待维护者澄清 |
| yanmuq | LICENSE、package.json、README | GPL v3 文本；未找到清晰 only/or-later 声明，README 另有传播限制 | 待核实声明关系、版本范围与发布条件 |

许可证判定是调查记录，不是自动授权。四源在 config/sources.json 中均为 publicationApproved=false。锁文件绑定 LICENSE（存在时）及 README/LEGAL 的内容摘要，变更会进入显式更新 diff。本文未复制上游规则正文；机器报告保留身份、哈希、组名与位置等元数据。

可通过固定版本 URL 查看证据，以下以 aoguai 为例，其余按锁文件 repository/commit/path 构造：

- [aoguai LICENSE](https://github.com/aoguai/subscription/blob/e0ad57290fed632e7305f67f92fcca8e775fb825/LICENSE)
- [aoguai LEGAL](https://github.com/aoguai/subscription/blob/e0ad57290fed632e7305f67f92fcca8e775fb825/LEGAL.md)
- [ganlinte LICENSE](https://github.com/ganlinte/GKD-subscription/blob/4746d192b4c57a4b62ed92a7f5deaf79e64fa811/LICENSE)
- [Lin-arm README](https://github.com/Lin-arm/GKD_subscription/blob/ec30889b27a22c0a8b7afc4e43e4e196e064fee9/README.md)
- [yanmuq LICENSE](https://github.com/yanmuq/muqi_gkd/blob/8e166bb5662ace70bf09ddfb78fe0b40cf689b6f/LICENSE)
- [yanmuq README](https://github.com/yanmuq/muqi_gkd/blob/8e166bb5662ace70bf09ddfb78fe0b40cf689b6f/README.md)

## 下一轮深度适配候选

| App 包名 | aoguai / ganlinte / Lin-arm / yanmuq 组数 | 潜在差异线索数 |
| --- | --- | ---: |
| com.tencent.mm | 14 / 21 / 46 / 3 | 39 |
| tv.danmaku.bili | 13 / 12 / 33 / 3 | 29 |
| com.taobao.taobao | 8 / 14 / 16 / 11 | 29 |
| com.eg.android.AlipayGphone | 12 / 7 / 26 / 10 | 38 |

以上只按多源差异提出调查候选，不代表用户已安装这些 App，也不表示组数较多者更优。下一阶段应由实际版本、需要自动化的具体操作及误触负例来决定投入顺序。
