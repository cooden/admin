"""修复部署：等待 apt 锁、装 node、启动服务、验证"""
import paramiko, time, sys

HOST='101.96.236.163'; USER='root'; KEY=r'C:\Users\43447\.ssh\id_rsa'
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=20)
print('SSH OK')

def run(cmd, t=300):
    print(f'$ {cmd}')
    _,o,e=c.exec_command(cmd, timeout=t)
    out=o.read().decode('utf-8','replace').strip(); err=e.read().decode('utf-8','replace').strip()
    if out: print(out)
    if err: print('[err]',err)
    return out

# 1. 等 apt 锁（最多 5 分钟）
print('\n=== 1. 等待 apt 锁 ===')
run('for i in $(seq 1 60); do fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || break; echo "lock held, retry $i"; sleep 5; done; echo LOCK_FREE')

# 2. 装 node
print('\n=== 2. 安装 node ===')
run('apt-get install -y nodejs 2>&1 | tail -8')
run('node --version')

# 3. 启动服务
print('\n=== 3. 启动服务 ===')
run('systemctl start pay-server')
time.sleep(3)
run('systemctl is-active pay-server')

# 4. 本地验证
print('\n=== 4. 本地验证 ===')
run('curl -s http://127.0.0.1:3000/')

# 5. 如果失败看日志
print('\n=== 5. 日志检查 ===')
run('journalctl -u pay-server --no-pager -n 20 2>/dev/null || tail -30 /var/log/pay-server.log')

c.close()
print('\nDONE')
