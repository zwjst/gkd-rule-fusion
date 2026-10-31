# 多源规则静态审计

统计来自 sources.lock.json 固定提交中的实际订阅文件；不代表设备验证结果。

| 来源 | App | 独占 App | 应用组 | 全局组 | 规则 | 许可证 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| aoguai | 72 | 0 | 280 | 9 | 702 | GPL-3.0-only |
| ganlinte | 610 | 51 | 1389 | 3 | 1990 | MIT |
| Lin-arm | 997 | 429 | 2490 | 3 | 3932 | NOASSERTION |
| yanmuq | 34 | 3 | 116 | 0 | 163 | GPL-3.0-unresolved-version |

保守识别：0 簇上下文完全相同规则组、0 簇上下文完全相同规则、1467 条潜在冲突/实现差异。

另有 37 簇跨来源规则组结构重复、79 簇跨来源规则结构重复。结构重复未证明分类、默认开关和作用域相同，不自动去重。

| 来源组合 | 共同 App | 仅前者 | 仅后者 |
| --- | ---: | ---: | ---: |
| aoguai / ganlinte | 68 | 4 | 542 |
| aoguai / Lin-arm | 71 | 1 | 926 |
| aoguai / yanmuq | 11 | 61 | 23 |
| ganlinte / Lin-arm | 557 | 53 | 440 |
| ganlinte / yanmuq | 24 | 586 | 10 |
| Lin-arm / yanmuq | 30 | 967 | 4 |

完整规则身份、提交、文件摘要、JSON Pointer、差异候选和质量指示项见 audit.json。

## 口径与边界

- Static conservative comparison; no selector equivalence proof.
- Snapshot URLs are unverified; no Android execution or regression evidence.
- Group keys are scoped to source and app. No rule chains are split or renumbered.
- Quality indicators are not a correctness or performance score.

来源许可状态见摘要。本四源研究报告不是可导入的订阅；实际融合范围以 dist/manifest.json 为准。报告只含元数据、摘要和定位信息，不包含上游选择器正文。
