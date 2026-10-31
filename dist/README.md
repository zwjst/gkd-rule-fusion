# 融合实验版产物

项目 v0.2.0；订阅 **ID 20261031、版本 1、experimental**；派生产物许可 **GPL-3.0-only**。

## 导入地址

```text
https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd.json5
```

在 GKD“订阅”页点 **+**，粘贴此地址。不要导入 `gkd.version.json`、manifest、来源 JSON 或软件目录。完整步骤见 [订阅说明](../docs/SUBSCRIPTIONS.md)。

## 当前范围

- 614 App：奥怪 72、甘霖补充 542；共享 App 选择奥怪整套应用规则。
- 1,328 应用规则组、9 个奥怪全局组，共 1,337 组、2,159 条规则记录。
- 已整体隔离 3 个上游问题组，未通过改写 key 或删除前置条件修补。
- Lin-arm 与木七未进入本实验版，仍可在四源调查目录对照。

初始类别默认值已解析为各组显式 enable；不代表你的设备已启用或页面操作已验证。加入补充 App 后，奥怪全局组按应用组名称进行的屏蔽可能发生变化，详见 [策略与交互](../docs/SUBSCRIPTIONS.md#初始开关与全局交互)。

## 文件

| 文件 | 用途 |
| --- | --- |
| [gkd.json5](gkd.json5) | 实际 GKD 订阅正文，采用合法 JSON 文本（也是 JSON5 子集） |
| [gkd.version.json](gkd.version.json) | 相同 id/version 的轻量更新描述，不包含规则 |
| [manifest.json](manifest.json) | 项目/订阅版本、范围、来源归档和文件摘要 |
| [apps.csv](apps.csv) | 实际订阅中的 614 个 App |
| [rule-groups.csv](rule-groups.csv) | 实际订阅中的 1,337 个规则组 |
| [provenance.json](provenance.json) | 逐组、逐规则上游身份与导出变更 |
| [quarantine.json](quarantine.json) | 未导出的问题组和原因 |
| [validation.json](validation.json) | 本次成品检查结果、工具链及未验证范围 |
| [files.sha256](files.sha256) | 文件 SHA-256 校验表 |
| [LICENSE](LICENSE) | GPL-3.0-only 许可文本；第三方原始许可另保留 |
| [NOTICE.md](NOTICE.md) | 修改日期、署名、来源归档和摘要说明 |

2,253 个不同选择器全部通过官方语法/类型及静态正则检查；基础结构和显式引用完整性检查 0 错误、0 警告。未完成 Android 客户端导入/实际执行、坐标表达式完整编译、正负快照与设备回归、耗电和性能验证。实验版没有被标为设备验证通过。

## 复现与更新

先按根目录 [开发命令](../README.md#开发与复现) 安装主依赖、独立校验工具依赖并取得锁定输入，然后运行：

```sh
npm run build:fusion
```

导出使用 [config/fusion.json](../config/fusion.json) 审核过的提交及来源/key 状态；原始输入绑定 [sources.lock.json](../sources.lock.json)。构建不自动拉取上游新版本，也不自动上传。内容改变须保持订阅 ID、递增整数 version；不可通过原地改字节复用同一版本。

对应源码、原始声明与许可见 [third_party](../third_party/README.md)。四源调查包含 1,053 个包名条目，范围大于本成品；不能以调查目录推断实际订阅支持范围。
