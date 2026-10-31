# 版权、许可与修改说明

本派生订阅由 zwjst 于 2026-10-31 修改并构建；订阅 ID 20261031，版本 1。
派生订阅整体按 GPL-3.0-only 提供，完整条款见 [LICENSE](LICENSE)。

基于 aoguai/subscription（GPL-3.0-only）和 ganlinte/GKD-subscription（MIT）。感谢两源维护者。
保留 ganlinte 的 Copyright (c) 2024 ganlinte 及 MIT 全文；原许可证及声明见 [notices](../third_party/notices)。

## 修改内容

- 使用独立订阅身份、名称、版本、作者和本仓库更新地址。
- 每个 App 固定一个来源，共享 App 优先 aoguai，其余由 ganlinte 补充；仅保留 aoguai 全局组。
- 将来源分类默认值显式写入组 enable，分类按名称稳定分配 key；组名、组/规则 key、选择器及规则顺序保留。
- 整组隔离未解析依赖与空占位组；详情见 [quarantine.json](quarantine.json)。不删除单条前置条件来掩盖问题。
- 加入个人覆盖层、持久来源账本、官方选择器及独立结构/依赖检查。
- 全局组会看到新增 App 组，disableIfAppGroupMatch 适用范围随结构改变；手机实际行为尚未验证。

## 对应源码

本仓库的 src/export.js、scripts/build-fusion.js、配置与锁文件是融合构建源码。两源固定提交完整源树也随本仓库提供：
- [aoguai e0ad57290fed632e7305f67f92fcca8e775fb825](../third_party/sources/aoguai-e0ad57290fed.tar.gz)；许可 GPL-3.0-only；SHA-256 dc9690de3463f60f3b22eb2d409c329f63569ad015ea876b0d547b943572aaaf
- [ganlinte 4746d192b4c57a4b62ed92a7f5deaf79e64fa811](../third_party/sources/ganlinte-4746d192b4c5.tar.gz)；许可 MIT；SHA-256 05ed1ac52c94604f34886c40ce8706c6b29c9cd54a1d09135055798c64b22932

归档包含上游 preferred TypeScript 源码、构建脚本、依赖锁、原始订阅及许可声明，不含 .git 或认证配置。
不从未明确再发布许可的 Lin-arm、yanmuq 复制规则到此订阅。
