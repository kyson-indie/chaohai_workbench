# chaohai_workbench

## 部署说明（自动更新机制）

合入 main 后**无需人工部署**：服务器 crontab 每 5 分钟执行 `deploy/auto-update.sh`（拉取 → 构建 → 重启 → 自检），每分钟执行 `deploy/health-check.sh`（服务异常自动拉起）。

验证线上版本：访问 `/api/version`，返回当前运行的 git commit 与构建时间。若更新未生效，先看该接口返回的 commit 是否等于 GitHub main 最新提交，再看服务器上 `.deploy.log`。
<!-- 闭环验证标记 v-loop-1 -->
