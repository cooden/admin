"""一键部署脚本：SSH + SFTP 完成支付后端部署（使用 SSH key 免密）"""
import paramiko
import sys
import time

HOST = '101.96.236.163'
USER = 'root'
PORT = 22
APP_PORT = 3000
KEY_FILE = r'C:\Users\43447\.ssh\id_rsa'
REMOTE_DIR = '/opt/pay-server'
LOCAL_FILES = [
    (r'd:\Idea\make\server\server.js', 'server.js'),
    (r'd:\Idea\make\server\config.json', 'config.json'),
    (r'd:\Idea\make\server\deploy.sh', 'deploy.sh'),
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

def run(cmd, timeout=60, quiet=False):
    if not quiet: print(f'$ {cmd}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    code = stdout.channel.recv_exit_status()
    if not quiet:
        if out: print(out)
        if err: print(f'[stderr] {err}')
    return out, err, code

print(f'=== 连接 {USER}@{HOST}（SSH key 免密）===')
try:
    client.connect(HOST, port=PORT, username=USER, key_filename=KEY_FILE, timeout=20)
    print('SSH 登录成功\n')
except Exception as e:
    print(f'SSH 登录失败: {e}'); sys.exit(1)

# ============ 1. 系统探测 ============
print('=== 1. 系统探测 ===')
out, _, _ = run('uname -a')
distro, _, _ = run('cat /etc/os-release 2>/dev/null | grep -E "^(ID=|VERSION_ID=)" | head -2')
print(distro)

node_out, _, _ = run('node --version 2>&1 || echo "NOT_INSTALLED"', quiet=True)
print(f'Node: {node_out}')
is_ubuntu = 'ubuntu' in distro.lower() or 'ubuntu' in node_out.lower()
is_centos = 'centos' in distro.lower() or 'rhel' in distro.lower() or 'rocky' in distro.lower() or 'alma' in distro.lower()

# ============ 2. 安装 Node.js（如未装）============
if 'NOT_INSTALLED' in node_out or 'v1' not in node_out:
    print('\n=== 2. 安装 Node.js（apt 系统自带版本）===')
    if 'ubuntu' in distro.lower() or 'debian' in distro.lower():
        # Ubuntu 24.04 自带 node 18.x，够用，避免 nodesource 超时
        run('apt-get update -y', timeout=180)
        run('apt-get install -y nodejs', timeout=300)
    else:
        run('curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -', timeout=300)
        run('yum install -y nodejs', timeout=300)
    run('node --version')
else:
    print('\n=== 2. Node.js 已安装，跳过 ===')

# ============ 3. 创建目录 + 上传文件 ============
print('\n=== 3. 上传文件 ===')
run(f'mkdir -p {REMOTE_DIR}/data')

sftp = client.open_sftp()
for local, remote in LOCAL_FILES:
    print(f'  上传 {local} -> {REMOTE_DIR}/{remote}')
    sftp.put(local, f'{REMOTE_DIR}/{remote}')
sftp.close()
run(f'chmod +x {REMOTE_DIR}/deploy.sh && ls -la {REMOTE_DIR}/')

# ============ 4. 停止旧进程 ============
print('\n=== 4. 停止旧进程 ===')
run('pkill -f "node /opt/pay-server/server.js" 2>/dev/null || echo "无旧进程"')
run('systemctl stop pay-server 2>/dev/null || echo "无 systemd 服务"')
time.sleep(1)

# ============ 5. 启动服务 ============
print('\n=== 5. 启动服务 ===')
run(f'cd {REMOTE_DIR} && nohup node server.js > /var/log/pay-server.log 2>&1 &', quiet=True)
time.sleep(3)

# ============ 6. 本地验证 ============
print('\n=== 6. 本地验证 ===')
out, _, _ = run('curl -s http://127.0.0.1:3000/ || echo "FAIL"')
print(f'本地访问结果: {out}')

if 'pay-server' in out:
    print('\n[OK] 服务启动成功')
else:
    print('\n[ERR] 启动失败，查看日志：')
    run('tail -30 /var/log/pay-server.log')

# ============ 7. 防火墙 ============
print('\n=== 7. 防火墙配置 ===')
out, _, _ = run('systemctl is-active firewalld 2>/dev/null', quiet=True)
if out == 'active':
    run(f'firewall-cmd --permanent --add-port={APP_PORT}/tcp')
    run('firewall-cmd --reload')
else:
    out2, _, _ = run('command -v ufw 2>/dev/null', quiet=True)
    if out2:
        run(f'ufw allow {APP_PORT}/tcp')
    else:
        print('无 firewalld/ufw，若是云服务器请在控制台安全组放行 3000')

# ============ 8. 配置 systemd 开机自启 ============
print('\n=== 8. 配置开机自启 ===')
service = f'''[Unit]
Description=Pay Server
After=network.target

[Service]
Type=simple
WorkingDirectory={REMOTE_DIR}
ExecStart=/usr/bin/node {REMOTE_DIR}/server.js
Restart=always
RestartSec=5
Environment=PORT={APP_PORT}

[Install]
WantedBy=multi-user.target
'''
run(f"cat > /etc/systemd/system/pay-server.service << 'EOF'\n{service}\nEOF")
run('systemctl daemon-reload && systemctl enable pay-server')

# ============ 9. 最终验证 ============
print('\n=== 9. 最终验证 ===')
time.sleep(2)
out, _, _ = run('systemctl is-active pay-server')
run('curl -s http://127.0.0.1:3000/')

client.close()
print('\n====================================')
print(' 部署完成！')
print(' 外网访问: http://101.96.236.163:3000/')
print(' 日志: tail -f /var/log/pay-server.log')
print(' 重启: systemctl restart pay-server')
print('====================================')
