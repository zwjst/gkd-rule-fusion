# 软件与规则完整清单

项目版本 **0.1.0**；固定输入快照见 [sources.lock.json](sources.lock.json)。

共 **1053 个包名条目**，其中 **1051 个有显式选择器**。
原始应用组 4275，全局组 15，规则记录 6787；跨来源保留重复。

## 查看与下载

- [在线阅读全部软件与逐组清单](APP_CATALOG.md)
- [软件总表 CSV](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/apps.csv)
- [逐组规则 CSV](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/rule-groups.csv)
- [完整机器数据 JSON](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/catalog.json)
- [下载交互清单 HTML](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/index.html)：保存为 HTML 后在浏览器本地打开，可搜索、筛选、展开；GitHub 文件页不执行 HTML。
- [校验说明](VALIDATION.md)、[选择器结果](selector-validation.json)、[审计摘要](AUDIT.md)、[统计 JSON](summary.json)
- [完整静态审计 JSON](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/audit.json)、[融合审核计划](https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/catalog/fusion-plan.json)
- [SHA-256 文件校验清单](files.sha256)

## 订阅入口与边界

[上游官方订阅地址与 GKD 导入步骤](../docs/SUBSCRIPTIONS.md)。本目录是数据清单，不是 GKD 订阅文件；catalog.json 和 fusion-plan.json 都不能作为订阅导入。

本仓库尚未发布融合订阅。规则名称代表上游收录功能，不表示实际匹配、点击或设备兼容已验证。
初始开关是订阅配置默认值，假设 App 已安装且无用户覆盖；实际运行还受组有效性、订阅/App总开关、版本、活动及其他条件影响。

## 来源与署名

| 来源 | 固定提交 | 上游版本 | 包名条目 |
| --- | --- | ---: | ---: |
| [aoguai](https://github.com/aoguai/subscription) | [e0ad57290fed](https://github.com/aoguai/subscription/tree/e0ad57290fed632e7305f67f92fcca8e775fb825) | 89 | 72 |
| [ganlinte](https://github.com/ganlinte/GKD-subscription) | [4746d192b4c5](https://github.com/ganlinte/GKD-subscription/tree/4746d192b4c57a4b62ed92a7f5deaf79e64fa811) | 72 | 610 |
| [Lin-arm](https://github.com/Lin-arm/GKD_subscription) | [ec30889b27a2](https://github.com/Lin-arm/GKD_subscription/tree/ec30889b27a22c0a8b7afc4e43e4e196e064fee9) | 622 | 997 |
| [yanmuq](https://github.com/yanmuq/muqi_gkd) | [8e166bb5662a](https://github.com/yanmuq/muqi_gkd/tree/8e166bb5662ace70bf09ddfb78fe0b40cf689b6f) | 53 | 34 |

感谢各上游维护者。本目录仅提供调查元数据、名称、约束、摘要及定位，不复制选择器定义、快照图像或上游源码。
许可证证据与未解决问题见 [调查结论](../docs/UPSTREAM_RESEARCH.md)。上游链接仍由原作者维护；链接列入本表不表示重新授权其内容。

## 复现

在项目根目录安装主依赖与独立校验工具依赖，运行 `npm run sync`，再运行 `npm run build:catalog`。
构建读取锁定提交，不更新上游，不上传或推送。发布文件使用固定输入元数据，不注入当前时间。
