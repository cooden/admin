#!/bin/bash
# 支付后端一键部署脚本
# 用法：在服务器上执行 bash deploy.sh
set -e

WORK_DIR=/opt/pay-server
PORT=3000

echo "===================================="
echo " 支付后端部署开始"
echo "===================================="

# ============ 1. 检查/安装 Node.js ============
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node --version)
  echo "[OK] Node.js 已安装: $NODE_VER"
else
  echo "[!] Node.js 未安装，开始安装..."
  if command -v apt-get >/dev/null 2>&1; then
    # Ubuntu/Debian
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif command -v yum >/dev/null 2>&1; then
    # CentOS/RHEL
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  else
    echo "[ERR] 不支持的系统，请手动安装 Node.js 20+"
    exit 1
  fi
  echo "[OK] Node.js 安装完成: $(node --version)"
fi

# ============ 2. 创建工作目录 ============
echo "[*] 创建工作目录 $WORK_DIR"
mkdir -p $WORK_DIR

# ============ 3. 复制文件（假设脚本同目录有 server.js, config.json）============
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "[*] 从 $SCRIPT_DIR 复制文件"
cp -f $SCRIPT_DIR/server.js $WORK_DIR/ 2>/dev/null || echo "[!] server.js 不存在"
cp -f $SCRIPT_DIR/config.json $WORK_DIR/ 2>/dev/null || echo "[!] config.json 不存在"
mkdir -p $WORK_DIR/data

# ============ 4. 停止旧进程 ============
echo "[*] 停止旧进程"
pkill -f "node $WORK_DIR/server.js" 2>/dev/null || echo "[*] 无旧进程"
sleep 1

# ============ 5. 启动服务（nohup 后台）============
echo "[*] 启动服务（端口 $PORT）"
cd $WORK_DIR
nohup node server.js > /var/log/pay-server.log 2>&1 &
echo $! > /var/run/pay-server.pid
sleep 2

# ============ 6. 检查启动结果 ============
if curl -s http://127.0.0.1:$PORT/ >/dev/null 2>&1; then
  echo "[OK] 服务启动成功，本地访问正常"
  curl -s http://127.0.0.1:$PORT/
  echo ""
else
  echo "[ERR] 服务启动失败，查看日志："
  tail -20 /var/log/pay-server.log
  exit 1
fi

# ============ 7. 开放防火墙端口 ============
echo "[*] 配置防火墙"
if command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port=$PORT/tcp 2>/dev/null && firewall-cmd --reload 2>/dev/null
  echo "[OK] firewalld 已开放 $PORT"
elif command -v ufw >/dev/null 2>&1; then
  ufw allow $PORT/tcp 2>/dev/null
  echo "[OK] ufw 已开放 $PORT"
else
  echo "[!] 无 firewalld/ufw，如果是云服务器请在控制台安全组放行 $PORT"
fi

# ============ 8. 设置开机自启（systemd）============
echo "[*] 配置 systemd 开机自启"
cat > /etc/systemd/system/pay-server.service <<EOF
[Unit]
Description=Pay Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$WORK_DIR
ExecStart=$(which node) $WORK_DIR/server.js
Restart=always
RestartSec=5
Environment=PORT=$PORT

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pay-server 2>/dev/null
echo "[OK] 已配置开机自启"

echo ""
echo "===================================="
echo " 部署完成！"
echo "===================================="
echo " 本地访问:  http://127.0.0.1:$PORT/"
echo " 外网访问:  http://101.96.236.163:$PORT/"
echo " 日志:      tail -f /var/log/pay-server.log"
echo " 重启:      systemctl restart pay-server"
echo " 停止:      systemctl stop pay-server"
echo "===================================="
