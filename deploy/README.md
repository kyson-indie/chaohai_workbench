# 部署说明：chaohai.ren（腾讯云 CVM）

目标：把 Next.js 14 项目部署到自有腾讯云 CVM，通过 `chaohai.ren` 域名访问，支持 HTTPS。

## 前置条件（部署前确认）

1. **DNS 解析**：到域名 DNS 管理处，为 `chaohai.ren` 添加 A 记录，指向 CVM 的公网 IP。
2. **ICP 备案**：如果 CVM 是大陆地域，`chaohai.ren` 必须完成 ICP 备案，否则 80/443 端口会被运营商拦截；香港/海外地域不需要备案。
3. **SSH 权限**：需要 CVM 的 root（或 sudo）权限登录服务器。
4. **安全组**：在腾讯云控制台放行 80、443 端口（入站 TCP）。

## 一键部署

```bash
# 登录服务器后执行
git clone https://github.com/kyson-indie/chaohai_workbench.git /tmp/chaohai_workbench
cd /tmp/chaohai_workbench
sudo bash deploy/setup.sh          # 首次部署：装 Node/pm2、构建、启动、配 nginx
```

脚本行为：
- 安装 Node.js 20、pm2、nginx（已装则跳过）
- 代码部署到 `/opt/chaohai_workbench`，以远端 `origin/main` 为准
- `npm ci && npm run build` 后用 pm2 常驻 `next start`（端口 3000），并设置开机自启
- 复制 `deploy/nginx.conf` 到 `/etc/nginx/conf.d/chaohai.ren.conf` 并 reload
- 内存检查：swap 不足 2G 时会提示先加 swap（2 核 2G 机器构建 Next.js 必须，防止 OOM）

## 后续更新

```bash
sudo bash deploy/setup.sh update   # 拉取最新 main、重新构建并重启
```

## 开启 HTTPS（DNS 生效后执行一次）

```bash
sudo bash deploy/setup.sh https    # 用 certbot 自动申请证书并改写 nginx 配置
```

## 手工验证

1. 浏览器打开 `http://chaohai.ren`，应看到居中的 **Hello World** 标题
2. 服务器上 `pm2 status` 应显示 `chaohai` 进程 online
3. `curl -I http://127.0.0.1:3000/` 返回 200

## 常用运维命令

```bash
pm2 logs chaohai       # 看应用日志
pm2 restart chaohai    # 重启应用
pm2 monit              # 资源监控
```
