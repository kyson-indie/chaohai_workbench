#!/usr/bin/env bash
# 启动/重启生产服务：next start -p 3100（单进程，PID 文件管理）
# 用法：run-service.sh start|restart|status
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$APP_DIR/.next-server.pid"
LOG_FILE="$APP_DIR/.next-server.log"
PORT=3100
CMD="$APP_DIR/node_modules/.bin/next"

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

stop() {
  if is_running; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    # 等待旧进程退出，最多 10 秒，避免新旧进程抢端口
    for _ in $(seq 1 20); do
      kill -0 "$(cat "$PID_FILE")" 2>/dev/null || break
      sleep 0.5
    done
    kill -9 "$(cat "$PID_FILE")" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  # 兜底：清理残留监听进程（如 PID 文件丢失的情况）。next-server 的进程名不含端口号，
  # 需同时匹配启动命令和端口监听两种方式。
  pkill -f "next start -p $PORT" 2>/dev/null || true
  fuser -k "$PORT/tcp" 2>/dev/null || true
  return 0
}

start() {
  if is_running; then
    echo "服务已在运行 (PID $(cat "$PID_FILE"))"
    return 0
  fi
  nohup "$CMD" start -p "$PORT" >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
}

case "${1:-status}" in
  start) start ;;
  restart) stop; start ;;
  status)
    if is_running; then echo "running (PID $(cat "$PID_FILE"))"; exit 0; else echo "stopped"; exit 1; fi
    ;;
  *) echo "用法: $0 start|restart|status" >&2; exit 2 ;;
esac
