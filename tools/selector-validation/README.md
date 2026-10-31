# 官方 GKD 选择器独立校验

该工具独立于主项目依赖，固定使用 `@gkd-kit/selector@0.5.22`、`@gkd-kit/wasm_matches@0.0.1`、`json5@2.2.3`。需要 Node.js >=22（本轮验证为 24.19.0）和 Git。

从项目根目录复现：

```sh
npm run sync
npm --cache /tmp/gkd-npm-cache --prefix tools/selector-validation ci --ignore-scripts --no-audit --no-fund
npm --prefix tools/selector-validation test
node tools/selector-validation/check.mjs
```

默认从脚本位置定位项目，不依赖当前目录；默认输出 `reports/2026-10-31/selector-validation.json`。也可指定项目根和输出文件：

```sh
node tools/selector-validation/check.mjs --root /workspace/gkd-rule-fusion --out /tmp/selector-validation.json
```

自定义路径按当前工作目录解析。本工具只读取项目默认 `.cache/fusion` 的 Git 对象；若不存在，应先从项目根运行 `npm run sync`。不会更新锁文件或上游版本。先校验配置指纹与锁一致，再验证每个订阅文件的 SHA-256。

检查沿用官方 `@gkd-kit/tools@0.8.0` 的初始化和 `Selector.Companion.parse` / `checkType` 模式，直接使用官方解析器及官方 WASM 正则编译器。无需安装只提供类型声明的 `@gkd-kit/api`，也无需安装 tools。tools 0.8.0 的 `checkSubscription` 未遍历 `anyMatches`，本工具补全 `matches`、`anyMatches`、`excludeMatches`，同时覆盖应用/全局、组层声明与规则继承。

结果分别统计物理声明引用、各来源唯一选择器、跨来源唯一选择器和按规则继承后的有效引用数。同一字符串只编译一次，错误定位仍保留来源、App、groupKey、ruleIndex、field、selectorIndex。结果不复制上游选择器正文，只记录摘要与位置。工具同时运行正常、错误语法、错误正则、错误属性类型控制用例，并计数 WASM 正则编译实际调用。

控制用例不符合预期、配置/内容摘要不符、输入缺失或真实选择器失败都会返回非零退出码。真实选择器失败仍写 JSON 结果，错误消息只保留类型/位置等信息。

校验只证明对应解析器版本下的选择器语法、属性类型与静态正则编译通过，**不证明手机匹配结果、误触安全、耗电、快照回归、App 版本适配或完整订阅结构有效**。该工具不导出融合订阅、不批准许可证、不执行上游项目代码。
