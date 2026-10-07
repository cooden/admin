/**
 * 支付与用户模块 (PaySDK) - 已对接真实后端
 *
 * 后端：server/server.js（虎皮椒 xunhupay 对接）
 * 流程：前端 → 后端创建订单 → 虎皮椒返回二维码 → 用户扫码支付
 *       → 虎皮椒异步回调后端 → 后端加金币 → 前端轮询检测到 paid → 自动刷新余额
 *
 * 配置：PaySDK.config.apiBase 指向服务器地址
 */
(function (window) {
  'use strict';

  var PaySDK = {
    config: {
      // 后端支付接口地址（80 端口，无需写端口号）
      apiBase: 'http://101.96.236.163',
      // 轮询间隔（毫秒）
      pollInterval: 2000
    },
    user: null,
    token: null,
    onBalanceChange: null
  };

  // ============ 用户系统（对接后端 + token 持久化） ============
  function loadUser() {
    try {
      var stored = localStorage.getItem('pay_user');
      if (stored) {
        var obj = JSON.parse(stored);
        PaySDK.user = obj.user;
        PaySDK.token = obj.token;
      }
    } catch (e) { PaySDK.user = null; PaySDK.token = null; }
    return PaySDK.user;
  }
  function saveUser(user, token) {
    PaySDK.user = user;
    PaySDK.token = token;
    localStorage.setItem('pay_user', JSON.stringify({ user: user, token: token }));
    if (PaySDK.onBalanceChange) PaySDK.onBalanceChange(user);
    if (document.getElementById('pay-user-bar')) PaySDK.showUserMenu();
  }

  // 带鉴权头的 fetch 封装
  function apiFetch(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (PaySDK.token) opts.headers['Authorization'] = 'Bearer ' + PaySDK.token;
    return fetch(PaySDK.config.apiBase + path, opts).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.msg || ('HTTP ' + r.status));
        return data;
      });
    });
  }

  PaySDK.login = function (username, password, callback) {
    if (!username || !password) { callback({ ok: false, msg: '请填写用户名和密码' }); return; }
    apiFetch('/api/user/login', {
      method: 'POST',
      body: JSON.stringify({ username: username, password: password })
    }).then(function (res) {
      if (res.ok) saveUser(res.user, res.token);
      callback(res);
    }).catch(function (e) { callback({ ok: false, msg: e.message }); });
  };

  // 从后端刷新余额
  PaySDK.refreshBalance = function (callback) {
    if (!PaySDK.token) { if (callback) callback(); return; }
    apiFetch('/api/user/info').then(function (res) {
      if (res.ok) {
        PaySDK.user = res.user;
        localStorage.setItem('pay_user', JSON.stringify({ user: res.user, token: PaySDK.token }));
        if (PaySDK.onBalanceChange) PaySDK.onBalanceChange(res.user);
        if (document.getElementById('pay-user-bar')) PaySDK.showUserMenu();
      }
      if (callback) callback(res);
    }).catch(function () { if (callback) callback(); });
  };

  PaySDK.logout = function () {
    localStorage.removeItem('pay_user');
    PaySDK.user = null;
    PaySDK.token = null;
    if (PaySDK.onBalanceChange) PaySDK.onBalanceChange(null);
  };

  // 兼容旧调用（实际加金币由后端回调做）
  PaySDK.addCoins = function (amount) {
    if (!PaySDK.user) return false;
    PaySDK.user.coins = (PaySDK.user.coins || 0) + amount;
    localStorage.setItem('pay_user', JSON.stringify({ user: PaySDK.user, token: PaySDK.token }));
    if (PaySDK.onBalanceChange) PaySDK.onBalanceChange(PaySDK.user);
    if (document.getElementById('pay-user-bar')) PaySDK.showUserMenu();
    return true;
  };

  function guestId() {
    var id = localStorage.getItem('pay_guest_id');
    if (!id) { id = 'g_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('pay_guest_id', id); }
    return id;
  }

  // ============ 创建订单（真实对接后端） ============
  PaySDK.createOrder = function (opts, callback) {
    // opts: { amount, payType: 'wechat'|'alipay', product }
    apiFetch('/api/pay/create', {
      method: 'POST',
      body: JSON.stringify({
        amount: opts.amount,
        payType: opts.payType,
        product: opts.product || '游戏金币'
      })
    }).then(function (res) {
      callback(res);
    }).catch(function (e) { callback({ ok: false, msg: e.message }); });
  };

  // 轮询订单状态，直到 paid 或超时
  PaySDK.pollOrder = function (orderId, onPaid, onTimeout) {
    var start = Date.now();
    var timeout = 5 * 60 * 1000; // 5 分钟超时
    function tick() {
      if (Date.now() - start > timeout) { if (onTimeout) onTimeout(); return; }
      fetch(PaySDK.config.apiBase + '/api/pay/query?orderId=' + orderId)
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.ok && res.status === 'paid') {
            // 已支付，刷新余额
            PaySDK.refreshBalance(function () {
              if (onPaid) onPaid(res);
            });
          } else {
            setTimeout(tick, PaySDK.config.pollInterval);
          }
        }).catch(function () { setTimeout(tick, PaySDK.config.pollInterval); });
    }
    tick();
  };

  // ============ 充值套餐 ============
  PaySDK.packages = [
    { id: 'p1', coins: 60,   price: 6,   label: '60 金币',  hot: false },
    { id: 'p2', coins: 300,  price: 30,  label: '300 金币', hot: true },
    { id: 'p3', coins: 680,  price: 68,  label: '680 金币', hot: false },
    { id: 'p4', coins: 1280, price: 128, label: '1280 金币',hot: false },
    { id: 'p5', coins: 3280, price: 328, label: '3280 金币',hot: false },
    { id: 'vip', coins: 0,   price: 30,  label: '月度会员',  hot: false, vip: true }
  ];

  // ============ UI：弹窗基础 ============
  function modal(title, bodyHtml, onClose) {
    var overlay = document.createElement('div');
    overlay.className = 'pay-overlay';
    overlay.innerHTML = '<div class="pay-modal"><div class="pay-modal-head"><h3>' + title + '</h3><span class="pay-close">×</span></div><div class="pay-modal-body">' + bodyHtml + '</div></div>';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.classList.contains('pay-close')) {
        overlay.remove();
        if (onClose) onClose();
      }
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  // ============ UI：登录弹窗 ============
  PaySDK.showLogin = function () {
    var m = modal('登录 / 注册',
      '<div class="pay-field"><label>用户名</label><input id="pay-user" placeholder="2-20 位字母数字"></div>' +
      '<div class="pay-field"><label>密码</label><input id="pay-pass" type="password" placeholder="设置或输入密码"></div>' +
      '<button class="pay-btn-primary" id="pay-do-login">登录 / 注册</button>' +
      '<p class="pay-tip">首次输入即注册，数据保存在服务器</p>'
    );
    m.querySelector('#pay-do-login').onclick = function () {
      var u = m.querySelector('#pay-user').value.trim();
      var p = m.querySelector('#pay-pass').value;
      var btn = m.querySelector('#pay-do-login');
      btn.disabled = true; btn.textContent = '登录中...';
      PaySDK.login(u, p, function (r) {
        if (r.ok) { m.remove(); PaySDK.showUserMenu(); }
        else { btn.disabled = false; btn.textContent = '登录 / 注册'; alert(r.msg); }
      });
    };
  };

  // ============ UI：用户菜单（右上角） ============
  PaySDK.showUserMenu = function () {
    var old = document.getElementById('pay-user-bar');
    if (old) old.remove();
    var u = PaySDK.user;
    var bar = document.createElement('div');
    bar.id = 'pay-user-bar';
    bar.className = 'pay-user-bar';
    if (u) {
      bar.innerHTML = '<span class="pay-coin">🪙 ' + u.coins + '</span>' +
        '<span class="pay-uname">' + u.username + '</span>' +
        '<button class="pay-btn-ghost" id="pay-recharge-btn">充值</button>' +
        '<button class="pay-btn-ghost" id="pay-logout-btn">退出</button>';
      bar.querySelector('#pay-recharge-btn').onclick = PaySDK.showRecharge;
      bar.querySelector('#pay-logout-btn').onclick = function () { PaySDK.logout(); PaySDK.showUserMenu(); };
    } else {
      bar.innerHTML = '<button class="pay-btn-primary" id="pay-login-btn">登录</button>';
      bar.querySelector('#pay-login-btn').onclick = PaySDK.showLogin;
    }
    document.body.appendChild(bar);
  };

  // ============ UI：充值弹窗 ============
  PaySDK.showRecharge = function () {
    if (!PaySDK.user) { PaySDK.showLogin(); return; }
    var pkgHtml = PaySDK.packages.map(function (p) {
      return '<div class="pay-pkg" data-id="' + p.id + '">' +
        '<div class="pay-pkg-name">' + p.label + '</div>' +
        '<div class="pay-pkg-price">¥' + p.price + '</div>' +
        (p.hot ? '<span class="pay-pkg-hot">🔥 热门</span>' : '') +
        '</div>';
    }).join('');
    var m = modal('充值中心',
      '<div class="pay-packages">' + pkgHtml + '</div>' +
      '<div class="pay-methods"><h4>选择支付方式</h4>' +
        '<label class="pay-method"><input type="radio" name="paytype" value="wechat" checked> <span class="pay-m-icon">💚</span> 微信支付</label>' +
        '<label class="pay-method"><input type="radio" name="paytype" value="alipay"> <span class="pay-m-icon">💙</span> 支付宝</label>' +
      '</div>' +
      '<div class="pay-qr-area" id="pay-qr-area"><p class="pay-tip">选择套餐后生成支付二维码</p></div>' +
      '<div class="pay-actions"><button class="pay-btn-primary" id="pay-confirm">确认支付</button></div>'
    );
    var selected = null;
    m.querySelectorAll('.pay-pkg').forEach(function (el) {
      el.onclick = function () {
        m.querySelectorAll('.pay-pkg').forEach(function (x) { x.classList.remove('active'); });
        el.classList.add('active');
        selected = el.getAttribute('data-id');
      };
    });
    m.querySelector('#pay-confirm').onclick = function () {
      if (!selected) { alert('请选择套餐'); return; }
      var pkg = PaySDK.packages.filter(function (p) { return p.id === selected; })[0];
      var payType = m.querySelector('input[name=paytype]:checked').value;
      var btn = m.querySelector('#pay-confirm');
      btn.disabled = true; btn.textContent = '生成订单中...';
      PaySDK.createOrder({ amount: pkg.price, payType: payType, product: pkg.label }, function (res) {
        btn.disabled = false; btn.textContent = '确认支付';
        if (!res.ok) { alert(res.msg); return; }
        var area = m.querySelector('#pay-qr-area');
        var isMock = res.mock ? '<p class="pay-tip">⚠️ 当前为模拟模式（后端未配置虎皮椒密钥）</p>' : '';
        area.innerHTML = '<div class="pay-qr-box">' +
          '<img src="' + res.qrUrl + '" alt="支付二维码">' +
          '<p>' + res.tip + '</p>' +
          '<p class="pay-amount">应付：<b>¥' + pkg.price + '</b></p>' +
          isMock +
          '<p class="pay-tip" id="pay-waiting">⏳ 等待支付结果...<span id="pay-dots"></span></p>' +
          '</div>';
        // 启动轮询
        PaySDK.pollOrder(res.orderId, function (paidRes) {
          area.innerHTML = '<div class="pay-success">✅ 支付成功！获得 ' + paidRes.coins + ' 金币</div>';
          setTimeout(function () { m.remove(); }, 1800);
        }, function () {
          area.innerHTML = '<div class="pay-fail">⌛ 等待超时，请重新发起</div>';
        });
        // 动画点
        var dots = area.querySelector('#pay-dots');
        if (dots) {
          var n = 0;
          setInterval(function () { n = (n + 1) % 4; dots.textContent = '.'.repeat(n); }, 500);
        }
      });
    };
  };

  // ============ 注入样式 ============
  function injectStyles() {
    if (document.getElementById('pay-styles')) return;
    var s = document.createElement('style');
    s.id = 'pay-styles';
    s.textContent = [
      '.pay-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9999}',
      '.pay-modal{background:#fff;border-radius:16px;width:90%;max-width:440px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}',
      '.pay-modal-head{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #eee}',
      '.pay-modal-head h3{margin:0;font-size:1.1rem;color:#1a1a1a}',
      '.pay-close{font-size:1.6rem;cursor:pointer;color:#999;line-height:1}',
      '.pay-modal-body{padding:20px}',
      '.pay-field{margin-bottom:14px}',
      '.pay-field label{display:block;font-size:.85rem;color:#666;margin-bottom:4px}',
      '.pay-field input{width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:.95rem;box-sizing:border-box}',
      '.pay-btn-primary{display:block;width:100%;padding:12px;background:linear-gradient(135deg,#f9d423,#ff4e50);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer}',
      '.pay-btn-ghost{padding:6px 14px;background:transparent;border:1px solid #ddd;border-radius:8px;cursor:pointer;font-size:.85rem;color:#555}',
      '.pay-tip{font-size:.8rem;color:#999;margin-top:10px;text-align:center}',
      '.pay-user-bar{position:fixed;top:12px;right:12px;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.95);padding:8px 12px;border-radius:30px;box-shadow:0 2px 12px rgba(0,0,0,.15);z-index:1000;backdrop-filter:blur(10px)}',
      '.pay-coin{font-weight:700;color:#f59e0b}',
      '.pay-uname{color:#333;font-size:.9rem}',
      '.pay-packages{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}',
      '.pay-pkg{position:relative;border:2px solid #eee;border-radius:12px;padding:14px;text-align:center;cursor:pointer;transition:all .2s}',
      '.pay-pkg:hover{border-color:#f9d423}',
      '.pay-pkg.active{border-color:#ff4e50;background:#fff5f5}',
      '.pay-pkg-name{font-weight:600;color:#1a1a1a}',
      '.pay-pkg-price{font-size:1.3rem;color:#ff4e50;font-weight:700;margin-top:4px}',
      '.pay-pkg-hot{position:absolute;top:-8px;right:-4px;background:#ff4e50;color:#fff;font-size:.7rem;padding:2px 8px;border-radius:10px}',
      '.pay-methods{margin-bottom:16px}',
      '.pay-methods h4{margin:0 0 10px;font-size:.9rem;color:#666}',
      '.pay-method{display:inline-flex;align-items:center;gap:6px;margin-right:20px;cursor:pointer}',
      '.pay-m-icon{font-size:1.2rem}',
      '.pay-qr-area{text-align:center;padding:16px;background:#f9fafb;border-radius:12px;min-height:80px}',
      '.pay-qr-box img{width:180px;height:180px;border:8px solid #fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1)}',
      '.pay-amount{font-size:1.1rem;margin:8px 0}',
      '.pay-amount b{color:#ff4e50}',
      '.pay-success{font-size:1.2rem;color:#10b981;font-weight:600;padding:20px 0}'
    ].join('');
    document.head.appendChild(s);
  }

  // ============ 暴露 ============
  PaySDK.guestId = guestId;
  PaySDK.loadUser = loadUser;
  PaySDK.injectStyles = injectStyles;
  window.PaySDK = PaySDK;
  loadUser();
  injectStyles();
})(window);
