# 一键部署脚本：chaohai_workbench → chaohai.ren
# 用途：在腾讯云 CVM 上以 root（或 sudo）执行，完成 Node/pm2 安装、代码更新、构建、pm2 常驻和 nginx 配置
# 用法：
#   首次部署：sudo bash deploy/setup.sh
#   后续更新：sudo bash deploy/setup.sh update
#   配置 HTTPS：先完成 DNS 解析，再执行 sudo bash deploy/setup.sh https
set -euo pipefail

APP_DIR="/opt/chaohai_workbench"
REPO="https://github.com/kyson-indie/chaohai_workbench.git"
DOMAIN="chaohai.ren"
PORT=3000

log() { echo -e "\n===== $* ====="; }

# ---------- 0. 基础检查 ----------
[ "$(id -u)" = "0" ] || { echo "请用 root 或 sudo 运行本脚本"; exit 1; }

# 内存检查：2G 机器执行 npm build 前建议有 2GiB swap，防止构建被 OOM 杀掉
if [ "$(free -m | awk '/^Swap:/{print $2}')" -lt 1900 ]; then
  echo "提示：检测到 swap 不足 2G，npm run build 可能因内存不足失败。"
  echo "可先执行以下命令添加 2G 交换分区后重试："
  echo "  dd if=/dev/zero of=/swapfile bs=1M count=2048 && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile"
  exit 1
fi

# ---------- 1. 安装 Node.js 20 与 pm2 ----------
if ! command -v node >/dev/null || [ "$(node -v | sed 's/v0*\([0-9]*\).*/\1/')" -lt 18 ]; then
  log "安装 Node.js 20"
  if command -v dnf >/dev/null; then
    dnf install -y nodejs20 || { curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && dnf install -y nodejs; }
  else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
  fi
fi
command -v pm2 >/dev/null || npm install -g pm2
node -v

# ---------- 2. 获取/更新代码并构建 ----------
log "更新代码到 $APP_DIR"
mkdir -p "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main   # 部署机以远端为准，本地改动会被覆盖

log "安装依赖并构建"
npm ci
npm run build

# ---------- 3. pm2 常驻 ----------
log "pm2 启动应用（端口 $PORT）"
pm2 delete chaohai >/dev/null 2>&1 || true
pm2 start npm --name chaohai -- start -- -p "$PORT"
pm2 save
pm2 startup >/dev/null || true   # 开机自启（已配置过则跳过）

# ---------- 4. nginx ----------
log "配置 nginx"
if ! command -v nginx >/dev/null; then
  if command -v dnf >/dev/null; then dnf install -y nginx; else apt-get install -y nginx; fi
fi
cp deploy/nginx.conf "/etc/nginx/conf.d/${DOMAIN}.conf"
nginx -t && systemctl enable --now nginx && systemctl reload nginx

# ---------- 5. HTTPS（可选，需 DNS 已解析到本机公网 IP） ----------
if [ "${1:-}" = "https" ]; then
  log "申请 HTTPS 证书（certbot）"
  if ! command -v certbot >/dev/null; then
    if command -v dnf >/dev/null; then dnf install -y certbot python3-certbot-nginx; else apt-get install -y certbot python3-certbot-nginx; fi
  fi
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
fi

log "完成。访问 http://$DOMAIN 验证 Hello World 页面"
curl -s -o /dev/null -w "本机自检: HTTP %{http_code}\n" "http://127.0.0.1:$PORT/" || true
