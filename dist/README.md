# 当前发布产物

当前唯一推荐导入的是六源融合实验版。项目 v0.2.0；订阅 **ID 20261031、版本 2、experimental**；设备测试状态为 **SKIPPED_UNVERIFIED**。

## 唯一导入地址

```text
https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd-fused.json5
```

版本检查地址：

```text
https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd-fused.version.json
```

在 GKD 订阅页编辑现有订阅，将地址替换为上述正文地址。确认 ID 为 20261031、版本为 2、App 数为 1,100。正文内的 `checkUpdateUrl` 使用相对路径 `./gkd-fused.version.json`，与正文同目录。

## 当前内容

| 指标 | 数量 |
|---|---:|
| App | 1,100 |
| 应用规则组 | 2,110 |
| 全局规则组 | 9 |
| 规则组总数 | 2,119 |
| 规则记录 | 3,228 |
| 六源新增 App | 486 |
| 六源新增应用规则组 | 782 |

六源来源及跳过统计见 [gkd-fused-manifest.json](gkd-fused-manifest.json)，静态检查见 [gkd-fused-validation.json](gkd-fused-validation.json)。

## 文件说明

| 文件 | 用途 |
|---|---|
| [gkd-fused.json5](gkd-fused.json5) | 当前唯一推荐导入的订阅正文 |
| [gkd-fused.version.json](gkd-fused.version.json) | 当前正文的更新检查文件，ID/version 必须一致 |
| [gkd-fused-manifest.json](gkd-fused-manifest.json) | 当前正文 SHA-256、数量、版本和六源来源信息 |
| [gkd-fused-validation.json](gkd-fused-validation.json) | 当前正文静态验证报告 |
| [gkd.json5](gkd.json5) | 旧 614 App 基线，仅供构建和对照，不要作为当前订阅导入 |
| [gkd.version.json](gkd.version.json) | 旧基线版本文件，不用于六源融合版 |
| [manifest.json](manifest.json) | 旧基线 manifest，不用于六源融合版 |

## 验证范围与限制

当前静态报告显示 3,238 个不同选择器通过语法、类型及静态正则检查，0 错误、0 警告。但 Android 客户端导入、设备实际执行、正负快照回归、坐标表达式完整语法、误触和耗电性能尚未验证。不要将静态验证通过描述为实机验证通过。

更新说明见 [订阅发布说明](../docs/SUBSCRIPTIONS.md)。
