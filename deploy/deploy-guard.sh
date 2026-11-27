#!/usr/bin/env bash
# 部署闭环守护：每分钟由 crontab 调用，监控「远端 main → 线上版本」的一致性。
# 解决的流程缺口（2026-11-27 复盘）：
#   ① 构建失败等异常只写 .deploy.log，无人知道线上卡在旧版本；
#   ② 失败靠人工救，恢复慢。
# 机制：
#   - 远端 main 与线上 /api/version 的 commit 不一致超过 DELAY_MIN 分钟 → 触发一次 auto-update.sh（自愈）；
#   - 自愈后仍不一致 → 通过飞书 webhook 告警（一天最多一次，避免轰炸）；
#   - 本地有已提交未推送内容也提示（防止「以为部署了其实没推送」）。
# 幂等：无异常时零输出、零副作用。
set -uo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
export PATH="/usr/local/node20/bin:$PATH"

# 允许的延迟：auto-update */5 分钟一跑，给 3 个周期余量（含构建耗时）
DELAY_MIN=15
# 告警去重：同一天最多告一次
STATE_FILE=".deploy-guard-state"
WEBHOOK_FILE="deploy/.alert-webhook"

now_epoch=$(date +%s)

# ---------- 工具 ----------

# 读 .build-info 的 commit（线上版本 = 正在运行的构建）
built_commit() {
  [ -f .build-info ] || return 0
  sed -n 's/.*"commit":"\([0-9a-f]*\)".*/\1/p' .build-info
}

# 读 .build-info 的 builtAt 并转 epoch（秒）
built_epoch() {
  [ -f .build-info ] || return 0
  local t
  t=$(sed -n 's/.*"builtAt":"\([^"]*\)".*/\1/p' .build-info)
  [ -n "$t" ] || return 0
  date -d "$t" +%s 2>/dev/null || return 0
}

send_alert() {
  local text="$1"
  # 未配置 webhook 则只写日志（本地可见），不报错
  if [ -f "$WEBHOOK_FILE" ]; then
    local url
    url=$(head -n1 "$WEBHOOK_FILE" | tr -d '[:space:]')
    if [ -n "$url" ]; then
      # msg_type=text，内容走 JSON 参数，无敏感信息
      curl -sS -m 10 -H 'Content-Type: application/json' \
        -d "{\"msg_type\":\"text\",\"content\":{\"text\":$(printf '%s' "$text" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo "\"(告警内容序列化失败)\"")}}" \
        "$url" >/dev/null 2>&1 || true
    fi
  fi
  echo "[deploy-guard $(date '+%F %T')] $text"
}

# ---------- 主检查 ----------

# 1. fetch 远端（网络失败不告警，下一分钟重试）
if ! git fetch origin main --quiet 2>/dev/null; then
  exit 0
fi
REMOTE=$(git rev-parse origin/main)
BUILT=$(built_commit)

if [ "$REMOTE" = "$BUILT" ]; then
  # 线上与远端一致，一切正常；顺带清掉过期的延迟状态
  [ -f "$STATE_FILE" ] && rm -f "$STATE_FILE"
  exit 0
fi

# 2. 不一致：先分清方向
if git merge-base --is-ancestor "$REMOTE" "$BUILT"; then
  # 本地领先远端：线上跑的是服务器上已提交但未推送的代码（过渡状态）。
  # 不算部署故障；当天提示一次推送，避免「以为部署了其实没推送」被遗忘。
  TODAY=$(date '+%F')
  LAST_ALERT=$(sed -n '1p' "$STATE_FILE" 2>/dev/null)
  UNPUSHED=$(git rev-list --count origin/main..HEAD)
  if [ "$UNPUSHED" -gt 0 ] && [ "$LAST_ALERT" != "$TODAY" ]; then
    printf '%s\n%s\n' "$TODAY" "$(date '+%s')" >"$STATE_FILE"
    send_alert "【潮海顾问工作台】提醒：服务器有 ${UNPUSHED} 个已提交未推送的 commit（线上 ${BUILT:0:7} 领先远端 ${REMOTE:0:7}），请尽快 git push，否则其他端拉不到这些改动"
  fi
  exit 0
fi

# 远端领先线上：是新提交刚到，还是卡住了？
#    判断依据：远端提交时间。若远端最新提交已超过 DELAY_MIN 分钟还没上线 → 异常。
REMOTE_TIME=$(git log -1 --format=%ct "$REMOTE" 2>/dev/null || echo 0)
AGE_MIN=$(( (now_epoch - REMOTE_TIME) / 60 ))

if [ "$AGE_MIN" -lt "$DELAY_MIN" ]; then
  # 新提交刚到，等 auto-update 正常节奏，不算异常
  exit 0
fi

# 3. 确认线上接口报的版本与 .build-info 一致（避免 .build-info 造假）
ONLINE=$(curl -s -m 10 http://127.0.0.1:3100/api/version 2>/dev/null | sed -n 's/.*"commit":"\([0-9a-f]*\)".*/\1/p')
if [ "$ONLINE" != "$BUILT" ]; then
  BUILT="$ONLINE" # 以线上接口为准
fi

# 4. 异常：先自愈（触发一次 auto-update，它自带互斥锁与构建流程）
echo "[deploy-guard $(date '+%F %T')] 检测到部署落后（远端 $REMOTE / 线上 $BUILT，落后 ${AGE_MIN} 分钟），尝试自愈"
bash deploy/auto-update.sh

# 5. 自愈后复查；仍失败 → 告警（当天去重）
NEW_BUILT=$(curl -s -m 10 http://127.0.0.1:3100/api/version 2>/dev/null | sed -n 's/.*"commit":"\([0-9a-f]*\)".*/\1/p')
if [ "$NEW_BUILT" != "$REMOTE" ]; then
  TODAY=$(date '+%F')
  LAST_ALERT=$(sed -n '1p' "$STATE_FILE" 2>/dev/null)
  if [ "$LAST_ALERT" != "$TODAY" ]; then
    # 本地是否有未推送提交（供告警信息判断原因）
    UNPUSHED=$(git rev-list --count origin/main..HEAD)
    EXTRA=""
    if [ "$UNPUSHED" -gt 0 ]; then
      EXTRA="；注意：服务器本地还有 ${UNPUSHED} 个已提交未推送的 commit（远端落后于本地）"
    fi
    printf '%s\n%s\n' "$TODAY" "$(date '+%s')" >"$STATE_FILE"
    send_alert "【潮海顾问工作台】部署异常：远端 main 为 ${REMOTE:0:7}，线上仍为 ${NEW_BUILT:0:7}（自愈失败）。请检查服务器 .deploy.log${EXTRA}"
  fi
fi

exit 0
