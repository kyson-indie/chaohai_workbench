#!/usr/bin/env bash
# 健康自愈：每分钟由 crontab 调用。
# 服务未运行或本地 HTTP 非 200 时自动拉起/重启，防止「进程挂了没人管」。
set -uo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:3100/login" || echo 000)
if [ "$CODE" = "200" ]; then
  exit 0
fi

echo "[health-check $(date '+%F %T')] HTTP $CODE，重启服务"
bash deploy/run-service.sh restart
sleep 5
CODE2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:3100/login" || echo 000)
if [ "$CODE2" != "200" ]; then
  echo "[health-check $(date '+%F %T')] 重启后仍异常 (HTTP $CODE2)"
  exit 1
fi
echo "[health-check $(date '+%F %T')] 重启后恢复 200"
