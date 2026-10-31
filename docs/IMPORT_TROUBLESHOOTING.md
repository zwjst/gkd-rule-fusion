# GKD 订阅导入超时排查

当前发布是实验版，不等同于手机端已验证。订阅源文件约 1.23 MB，含 614 App；实际大小以 manifest 和检查脚本输出为准。

## 先确认网络还是规则格式

1. 用**同一部手机、同一网络**在浏览器访问订阅 URL： https://raw.githubusercontent.com/zwjst/gkd-rule-fusion/main/dist/gkd.json5
2. 浏览器也超时：优先排查 DNS、代理分流、GitHub Raw 可达性、运营商网络；换 Wi-Fi/移动网络对比。
3. 浏览器可完整下载而 GKD 超时：记录 GKD 版本、Android 版本、网络环境、耗时、错误提示；尝试将下载的 JSON5 从本地导入（仅在客户端版本支持本地导入时）。若本地成功，优先调查 GKD 网络请求；若本地失败，调查客户端解析/规则兼容。
4. 不要将 `gkd.version.json`、`manifest.json` 或 CSV 当作订阅正文导入。
5. 使用其他托管服务之前，先确保该服务实际返回同一 SHA-256 文件；不要随意使用第三方公开代理传递隐私信息。

## 自动校验
- `node scripts/check-subscription.mjs`：本地检查文件非空、JSON5、ID、版本、App/组/规则数量与 manifest SHA-256。
- `node scripts/check-public-subscription.mjs`：读取 Raw 公网地址，最多重试三次，核对发布文件 SHA-256 和结构。
- GitHub Actions `Subscription artifact and delivery checks` 在 PR 检查本地文件，main 更新及定时运行时检查公网分发。

## 限制
GitHub Actions 运行机房访问成功不代表用户手机访问成功。脚本检查不能证明 GKD 客户端可导入，也不能证明规则不会误触。发布流程目前仍需人工审核，未自动切换镜像或自动回滚。
