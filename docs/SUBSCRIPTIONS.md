# 订阅发布与使用说明

当前仓库只推荐一个对外订阅入口：**六源融合实验版**。旧 614 App 文件保留作构建基线和历史对照，不再作为用户导入入口。

## 当前唯一订阅入口

正文：

```text
https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd-fused.json5
```

版本检查文件：

```text
https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd-fused.version.json
```

| 项目 | 当前值 |
|---|---|
| 名称 | GKD Rule Fusion · 六源融合实验版 |
| ID | 20261031 |
| 整数订阅版本 | 2 |
| 通道 | experimental |
| App | 1,100 |
| 应用规则组 | 2,110 |
| 全局规则组 | 9 |
| 规则组总数 | 2,119 |
| 规则记录 | 3,228 |
| 更新检查 | 同目录 `./gkd-fused.version.json` |

## 在 GKD 中导入或切换

1. 打开 GKD 的订阅页，编辑原有 GKD Rule Fusion 订阅。
2. 将订阅地址替换为本页顶部的 `gkd-fused.json5` Raw 地址，不要新增重复订阅。
3. 手动刷新后确认订阅 ID 为 **20261031**、版本为 **2**、App 数为 **1,100**。
4. 如果客户端仍显示 614 App / 1,328 应用组，检查订阅地址是否仍是旧的 `dist/gkd.json5`，并检查刷新结果和缓存。
5. 正文内的 `checkUpdateUrl` 必须为 `./gkd-fused.version.json`；不要让新版正文引用旧的 `gkd.version.json`。

旧版地址 `https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd.json5` 仅保留为 614 App 基线，不是当前发布地址。

## 六源融合策略

在原 614 App 基线上追加六个候选来源中未重复、未触发静态风险筛选的完整 App。每个 App 只取一个来源，保留该 App 内的完整规则组及依赖，不对跨来源同包 App 做规则级拼接。六源新增 486 App、782 应用规则组；跳过 3,457 个已存在 App 候选和 12 个高风险 App 候选。来源固定提交、文件摘要及逐源计数见 [融合 manifest](../dist/gkd-fused-manifest.json)。

全局规则仍为 9 组，沿用旧基线的全局规则集；本轮六源构建只追加应用规则，不追加来源全局规则，避免跨来源全局规则叠加造成重复触发或相互干扰。

## 静态验证与风险边界

[融合验证报告](../dist/gkd-fused-validation.json) 记录 3,238 个不同选择器通过静态语法、类型及正则检查，0 错误、0 警告。它不证明 Android 客户端能成功导入，也不证明每个 App 页面都能正确匹配。

尚未完成 Android 实机导入与执行、正向/负向页面快照、坐标表达式完整编译、误触和耗电性能验证。设备测试状态为 `SKIPPED_UNVERIFIED`。来源授权为用户声明、未独立核验。使用者应逐步启用，并观察常用页面。

## 发布一致性检查

仓库的 `Subscription artifact and delivery checks` 工作流必须以六源融合文件为唯一发布目标：

- 本地检查 `dist/gkd-fused.json5` 是否可解析、ID/version 是否与 `dist/gkd-fused-manifest.json` 一致。
- 检查 App、应用组、全局组、规则数量与 manifest 一致。
- 检查正文 SHA-256 与 manifest 一致。
- 检查 `dist/gkd-fused.version.json` 的 ID/version 与正文一致。
- main 分支发布后，访问固定 Raw URL，下载正文和版本文件并再次核对 SHA-256、ID/version。
- PR、main 与定时检查使用相同的文件名和 manifest，不得回退到旧 `dist/gkd.json5`。

发布时必须同步更新正文、版本文件、manifest、验证报告及本页文档。版本 ID 保持 20261031；正文发生变化时递增整数版本。旧基线的 `dist/manifest.json` 与 `dist/gkd.version.json` 不得用于六源融合发布检查。

## 产物索引

- [融合正文](../dist/gkd-fused.json5)
- [融合版本文件](../dist/gkd-fused.version.json)
- [融合 manifest](../dist/gkd-fused-manifest.json)
- [融合验证报告](../dist/gkd-fused-validation.json)
- [产物说明](../dist/README.md)
- [根 README](../README.md)
