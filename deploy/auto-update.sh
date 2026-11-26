#!/usr/bin/env bash
# 自动更新：拉取 origin/main → 有新提交才构建+重启 → 写 .build-info 版本文件
# 由 crontab 定时调用；也可手动执行：auto-update.sh
# 幂等：无新提交时什么都不做，不打断线上服务。
set -uo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
LOCK_FILE=".deploy.lock"
LOG_TAG="[auto-update $(date '+%F %T')]"

# ---------- 互斥锁：上一次更新还在跑就跳过 ----------
if [ -f "$LOCK_FILE" ] && kill -0 "$(cat "$LOCK_FILE" 2>/dev/null)" 2>/dev/null; then
  echo "$LOG_TAG 上一次更新仍在进行，跳过"
  exit 0
fi
echo $$ >"$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ---------- 1. 拉取远端 main ----------
git fetch origin main --quiet 2>&1 || { echo "$LOG_TAG git fetch 失败（网络），本次跳过"; exit 0; }
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

# 只统计「远端有、本地没有」的提交；本地领先远端（如脚本刚提交未推送）不算新版本
NEW_COUNT=$(git rev-list --count HEAD..origin/main)

if [ "$NEW_COUNT" -eq 0 ]; then
  echo "$LOG_TAG 已是最新 ($LOCAL)，无需更新"
  exit 0
fi

echo "$LOG_TAG 发现新提交 $LOCAL → $REMOTE，开始更新"

# ---------- 2. ff-only 合并（本地有冲突改动则中止，不动线上） ----------
if ! git merge --ff-only origin/main; then
  echo "$LOG_TAG 本地有未提交改动阻碍合并，中止本次更新（服务未受影响）"
  exit 1
fi

# ---------- 3. 构建（失败则保持旧构建继续跑） ----------
if ! npm run build --silent; then
  echo "$LOG_TAG 构建失败，保持旧版本运行，中止本次更新"
  git rev-parse HEAD >&2
  exit 1
fi

# ---------- 4. 重启服务 ----------
bash deploy/run-service.sh restart
sleep 5

# ---------- 5. 自检：本地 HTTP 必须 200，否则报错（不回滚，人工介入） ----------
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:3100/login" || echo 000)
if [ "$CODE" != "200" ]; then
  echo "$LOG_TAG 更新后自检失败 (HTTP $CODE)，请人工检查 .next-server.log"
  exit 1
fi

# ---------- 6. 写版本文件（/api/version 原样读出，供人工核对线上版本） ----------
printf '{"commit":"%s","builtAt":"%s"}\n' \
  "$(git rev-parse HEAD)" \
  "$(date '+%F %T')" >.build-info

echo "$LOG_TAG 更新完成：$(git rev-parse --short HEAD) 自检 200"
