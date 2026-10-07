"""SSH 探测脚本：登录服务器，检查系统环境"""
import paramiko
import sys

HOST = '101.96.236.163'
USER = 'root'
PASS = 'wC.123123'

def run(cmd, timeout=15):
    """执行命令并返回输出"""
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return out, err

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

print(f'=== 连接 {USER}@{HOST} ===')
try:
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    print('SSH 登录成功')
except Exception as e:
    print(f'SSH 登录失败: {e}')
    sys.exit(1)

# 系统信息
print('\n=== 系统信息 ===')
out, _ = run('uname -a'); print(out)
out, _ = run('cat /etc/os-release 2>/dev/null | head -5'); print(out)

# Node.js 检查
print('\n=== Node.js / npm ===')
out, _ = run('node --version 2>&1'); print(f'node: {out or "未安装"}')
out, _ = run('npm --version 2>&1'); print(f'npm: {out or "未安装"}')

# 端口检查
print('\n=== 端口 3000 占用情况 ===')
out, _ = run('ss -tlnp 2>/dev/null | grep ":3000 " || echo "3000 空闲"'); print(out)

# 防火墙
print('\n=== 防火墙状态 ===')
out, _ = run('systemctl is-active firewalld 2>/dev/null || systemctl is-active ufw 2>/dev/null || echo "无 firewalld/ufw"'); print(out)

# 资源
print('\n=== 资源 ===')
out, _ = run('df -h / 2>/dev/null | tail -1'); print('磁盘:', out)
out, _ = run('free -h 2>/dev/null | grep Mem'); print('内存:', out)

# 检查已有部署
print('\n=== 现有部署检查 ===')
out, _ = run('ls -la /root/pay-server 2>/dev/null || echo "/root/pay-server 不存在"'); print(out)
out, _ = run('ps aux | grep "server.js" | grep -v grep || echo "无 server.js 进程"'); print(out)

# 工作目录
print('\n=== 工作目录 ===')
out, _ = run('pwd && ls'); print(out)

client.close()
print('\n=== 探测完成 ===')
