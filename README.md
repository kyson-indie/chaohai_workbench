# chaohai_workbench

## 部署说明（自动更新机制）

合入 main 后**无需人工部署**：服务器 crontab 每 5 分钟执行 `deploy/auto-update.sh`（拉取 → 构建 → 重启 → 自检），每分钟执行 `deploy/health-check.sh`（服务异常自动拉起）。

验证线上版本：访问 `/api/version`，返回当前运行的 git commit 与构建时间。若更新未生效，先看该接口返回的 commit 是否等于 GitHub main 最新提交，再看服务器上 `.deploy.log`。

## 部署闭环守护（2026-11-27 起，防「线上悄悄停在旧版本」）

每分钟执行 `deploy/deploy-guard.sh`，三层防护：

1. **滞后自愈**：GitHub main 有新提交但线上 `/api/version` 落后超过 3 分钟 → 自动再触发一次 `auto-update.sh`（覆盖构建偶发失败、cron 抖动等场景）；
2. **飞书告警**：自愈后仍不一致 → 向 `deploy/.alert-webhook` 里配置的飞书群机器人 webhook 发告警（每天最多一条，不轰炸）。**部署完新环境后记得把群机器人 webhook 地址写进该文件（仅第一行）**；
3. **未推送提醒**：服务器上有已提交未 push 的 commit（线上领先远端）→ 当天提醒一次尽快推送。

历史上两类静默故障（cron 环境缺 PATH 导致 npm not found；构建失败后提交被「已是最新」永久跳过）已分别在 `auto-update.sh` 内修复，守护脚本作为第三道兜底，保证同类问题再发生时**最多 15 分钟内自动恢复或人工收到告警**，不再依赖用户发现。

## 交付纪律（给 AI 协作者与开发者）

- 代码 commit 到服务器本地 main 后**必须尽快 push 到 GitHub**，否则其他端拉不到、且守护脚本会每日提醒；
- 交付任何改动后，用 `curl /api/version` 确认线上 commit 与预期一致，才算交付完成；
- `.deploy.log` / `.deploy-guard.log` 出现「构建失败」「部署异常」字样时优先处理，不要只看服务是否 200（旧版本也能 200）。

<!-- 闭环验证标记 v-loop-1 -->
