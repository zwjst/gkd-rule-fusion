# GKD Rule Fusion — 项目需求（MVP）

## 目标
建立多源 GKD 订阅规则审计、去重、冲突检测、选择性融合、个人覆盖与自动发布系统。不是简单拼接 JSON5。静态分析不能替代真机验证。

## 候选来源（开发前核实）
- https://github.com/Lin-arm/GKD_subscription
- https://github.com/ganlinte/GKD-subscription
- https://github.com/aoguai/subscription
- https://github.com/yanmuq/muqi_gkd
- 官方模板 https://github.com/gkd-kit/subscription-template

核实各仓库许可证、实际结构、输出文件、分支、更新方式与 GKD schema。许可证不清晰的内容只能审计，不得默认再发布。锁定 commit SHA 和内容哈希。

## P0
1. 多源同步：配置上游 URL、ref、启用状态；安全下载已构建 JSON5，CI 不执行不可信上游脚本。
2. 解析规范化：按官方 schema 验证；保留包名、Activity、规则组、选择器、动作、触发/重置条件、启用状态、快照、来源及未知字段；未知字段不得静默丢弃。
3. 审计：每源 App/组/规则数量，跨源重叠，精确重复、疑似重复、互补和冲突；报告 Markdown + JSON；质量评分须解释依据，不等于真实成功率。
4. 融合：支持 keep / disable / replace / append / prefer-source / manual-review；个人覆盖优先；上游发生变化时提示冲突；不确定冲突不自动进入稳定版；防止 key 冲突。
5. 安全：敏感点击（支付、授权、删除等）默认禁用；规则缺少验证时不得标注已验证。
6. 发布：stable / preview 两套订阅，先校验再发布；失败不覆盖上次稳定产物。
7. 自动化：GitHub Actions 定时检查上游、生成审计、运行测试；变更通过 PR 审核，不自动合并高风险规则。
8. 测试：解析、去重、冲突、覆盖、许可证策略、稳定构建的单元与集成测试。

## P1
逐 App 深度定制；GKD 快照链接与版本适配；回归验证记录；变更影响分析。

## P2
可视化规则管理、审核界面和搜索。

## 推荐目录
src/{sources,parser,audit,merge,overrides,build}/
config/sources.json
overrides/
tests/
reports/
dist/
.github/workflows/
docs/

## 验收
可在干净环境安装、测试和构建；报告可追溯每条规则来源；稳定订阅可由 GKD 导入；上游冲突不会覆盖个人定制；许可证未确认的来源不进入稳定发布；提供清晰 README、运行命令、限制说明和真实测试结果。