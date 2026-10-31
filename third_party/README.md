# 第三方来源、对应源码与许可

GKD Rule Fusion v0.2.0 融合实验版仅采用以下两个已锁定提交。派生订阅和本项目按根目录 [GPL-3.0-only LICENSE](../LICENSE) 提供；甘霖原始 MIT 版权与许可继续保留，不将其上游项目重新标记为 GPL。

| 来源 | 固定完整提交 | 原始许可 | 完整源码归档 |
| --- | --- | --- | --- |
| [aoguai/subscription](https://github.com/aoguai/subscription) | e0ad57290fed632e7305f67f92fcca8e775fb825 | GPL-3.0-only | [aoguai-e0ad57290fed.tar.gz](sources/aoguai-e0ad57290fed.tar.gz) |
| [ganlinte/GKD-subscription](https://github.com/ganlinte/GKD-subscription) | 4746d192b4c57a4b62ed92a7f5deaf79e64fa811 | MIT | [ganlinte-4746d192b4c5.tar.gz](sources/ganlinte-4746d192b4c5.tar.gz) |

感谢两源维护者和贡献者。原版权声明、LICENSE、README、package 元数据以及奥怪 LEGAL 声明保存在 [notices/aoguai](notices/aoguai) 与 [notices/ganlinte](notices/ganlinte)。奥怪 LEGAL 1.4 说明其风险声明不构成对 LICENSE 的附加授权条件。

## 归档内容与完整性

`sources/` 归档通过固定 Git 提交的 `git archive` 生成，保留该提交所有跟踪文件，包括原始 src、构建脚本、依赖声明/锁文件、dist、许可和说明；不包含 `.git` 历史或任何运行时凭证。

归档完整 SHA-256、来源正文摘要与完整提交见 [dist/manifest.json](../dist/manifest.json)。导出器实际读取锁定 dist JSON5；同时提供原始维护形式的 src 和上游构建文件，便于查看与继续修改。

复现本仓库订阅无需执行上游代码。需要在项目根目录安装主依赖与独立校验工具依赖，取得锁定 Git 对象后，运行 `npm run build:fusion`。本仓库构建脚本、配置、锁文件与来源/key 状态均随仓库提供，具体命令见 [开发说明](../README.md#开发与复现)。

即使没有上游 Git 缓存，发布器也可从已随仓库提供的源码归档构建：先核对 manifest 中的归档 SHA-256，再逐个校验原订阅与许可文件的锁定摘要。可用 `FUSION_SOURCE_CACHE=/tmp/empty-fusion-cache npm run build:fusion` 验证此路径；不会关闭校验或改变预期摘要。

## 本仓库对原始内容的处理

- 每个 App 只选一个来源：优先奥怪，甘霖补充奥怪没有的 App；全局规则仅选奥怪。
- 保留原组/规则 key、顺序和引用；原类别默认值转为每组显式 enable，融合分类不设置默认 enable。
- 甘霖三个有空占位或悬空引用的问题组整体隔离，未静默重写其前置条件或共享状态 key。
- 使用独立订阅 ID、名称、整数版本及正确版本文件路径，不沿用奥怪原订阅的错误版本检查路径。
- 未宣称通过 Android 实机验证；选择器静态检查与保留引用检查结果另行提供。

逐组/逐规则来源、上游文件指针与修改记录见 [provenance.json](../dist/provenance.json)，隔离原因见 [quarantine.json](../dist/quarantine.json)，检查范围见 [validation.json](../dist/validation.json)。

[dist/NOTICE.md](../dist/NOTICE.md) 随成品提供修改日期、来源署名、归档链接及摘要，与本说明和原始许可一并保留。

## 其他调查来源

Lin-arm 和 yanmuq/木七参与四源静态审计与软件目录，但**没有规则正文进入当前融合订阅或这些源码归档**。Lin-arm 许可未明确，木七的 GPL 版本范围及传播声明关系待核实，不能仅因公开可访问就默认纳入再发布。

相关研究元数据和官方链接仍在 [上游调查](../docs/UPSTREAM_RESEARCH.md)、[四源清单](../catalog/README.md) 及 [订阅说明](../docs/SUBSCRIPTIONS.md) 中。那些目录与本次两个来源的实际派生产物应区分。
