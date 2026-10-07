"""改端口为 80 + 重启 + 测试"""
import paramiko, time
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('101.96.236.163', username='root', key_filename=r'C:\Users\43447\.ssh\id_rsa')
print('SSH OK')

def run(cmd, t=60):
    print(f'$ {cmd}')
    _,o,e=c.exec_command(cmd, timeout=t)
    out=o.read().decode('utf-8','replace').strip(); err=e.read().decode('utf-8','replace').strip()
    if out: print(out)
    if err: print('[err]',err)
    return out

# 1. 改 systemd 服务端口为 80
print('\n=== 1. 改端口为 80 ===')
run("sed -i 's/Environment=PORT=3000/Environment=PORT=80/' /etc/systemd/system/pay-server.service")
run('grep Environment /etc/systemd/system/pay-server.service')

# 2. 重启
print('\n=== 2. 重启服务 ===')
run('systemctl daemon-reload && systemctl restart pay-server')
time.sleep(3)
run('systemctl is-active pay-server')

# 3. 本地 80 端口验证
print('\n=== 3. 本地 80 端口验证 ===')
run('curl -s http://127.0.0.1:80/')

# 4. 看日志
print('\n=== 4. 日志 ===')
run('journalctl -u pay-server --no-pager -n 10')

c.close()
print('\nDONE - 等待本地外网测试')
