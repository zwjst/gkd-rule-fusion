# GKD Rule Fusion

多源 GKD 订阅融合、去重、来源追溯与静态安全审核。**当前唯一推荐导入版本为六源融合实验版**；Android 实机测试尚未完成，状态为 `SKIPPED_UNVERIFIED`。

## 当前发布：六源融合实验版

**唯一订阅正文：**

```text
https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd-fused.json5
```

**唯一版本检查文件：**

```text
https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd-fused.version.json
```

| 项目 | 当前发布值 |
|---|---:|
| 订阅 ID | 20261031 |
| 订阅版本 | 2 |
| App | 1,100 |
| 应用规则组 | 2,110 |
| 全局规则组 | 9 |
| 规则组总数 | 2,119 |
| 规则记录 | 3,228 |
| 新增 App（相对旧基线） | 486 |
| 新增应用规则组 | 782 |

六源来源、固定提交及新增/跳过统计见 [融合 manifest](dist/gkd-fused-manifest.json)，静态验证见 [融合验证报告](dist/gkd-fused-validation.json)。本版本在旧基线上追加六个候选来源中未重复且通过静态风险筛选的完整 App；并非把所有来源的所有规则无差别合并。

### 导入与更新

1. 在 GKD 订阅页编辑现有 **GKD Rule Fusion** 订阅，将订阅地址替换为上面的 `gkd-fused.json5`。
2. 确认订阅 ID 为 `20261031`、版本为 `2`、App 数为 `1,100`。
3. 订阅正文中的 `checkUpdateUrl` 指向同目录的 `gkd-fused.version.json`。版本校验文件必须与正文保持相同 ID 和版本。
4. 不要再导入旧地址 `dist/gkd.json5`；该文件仅保留为 614 App 的历史基线及六源融合构建输入，不是当前发布入口。

完整步骤、校验机制和限制见 [订阅发布说明](docs/SUBSCRIPTIONS.md) 与 [dist 产物说明](dist/README.md)。

## 六源融合统计

| 来源 | 新增 App | 跳过已存在 App | 跳过高风险 App |
|---|---:|---:|---:|
| Lin-arm | 426 | 561 | 10 |
| Tsuk1ko | 1 | 10 | 0 |
| Antiwall | 14 | 717 | 0 |
| AIsouler | 3 | 881 | 2 |
| lyc452 | 27 | 625 | 0 |
| Adpro-Team | 15 | 663 | 0 |
| **合计** | **486** | **3,457** | **12** |

静态验证报告记录 3,238 个不同选择器全部通过，0 错误、0 警告。此结果不等于 Android 客户端导入、正负快照、误触安全或性能测试通过。来源授权为用户声明、未经独立法律核验；设备测试明确标记为未验证。

## 版本与文件职责

- `dist/gkd-fused.json5`：当前唯一推荐导入的六源融合订阅正文。
- `dist/gkd-fused.version.json`：与正文同版本的 GKD 更新检查文件。
- `dist/gkd-fused-manifest.json`：订阅身份、版本、数量、SHA-256、来源提交和融合统计。
- `dist/gkd-fused-validation.json`：融合订阅静态验证报告。
- `dist/gkd.json5`、`dist/gkd.version.json`、`dist/manifest.json`：旧 614 App 基线及历史产物，仅供复现/对照，不作为当前发布入口。
- `dist/README.md`、`docs/SUBSCRIPTIONS.md`：导入、更新与校验说明。

## 开发与复现

需要 Node.js >=22、npm 和 Git：

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix tools/selector-validation ci --ignore-scripts --no-audit --no-fund
npm test
npm --prefix tools/selector-validation test
node scripts/build-user-authorized-fusion.mjs
node tools/selector-validation/check-export.mjs --file dist/gkd-fused.json5 --out dist/gkd-fused-validation.json
node scripts/check-subscription.mjs
```

六个候选来源已在 `config/candidate-sources.json` 中固定到审核过的 40 位 commit SHA；构建不会跟随浮动分支。更换来源提交前必须重新审查差异与许可，并更新固定 SHA。内容改变时保持订阅 ID 不变、递增整数版本，并同步更新正文、版本文件、manifest 与验证报告。发布检查工作流会检查正文/版本文件的 ID、版本、数量、SHA-256，并对比 GitHub Raw 公网实际返回内容。

四源调查目录与旧基线资料仍保留在仓库中，但不能把调查目录条目数量当作当前融合订阅数量。
