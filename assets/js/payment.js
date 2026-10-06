/**
 * 支付与用户模块 (PaySDK)
 *
 * 当前模式：模拟支付（演示完整流程，待接入真实支付）
 * 真实接入说明：
 *   1. 微信支付：需营业执照 + 微信商户号 + APIv3 密钥，后端调用统一下单
 *   2. 支付宝电脑网站支付：需企业支付宝 + 应用公钥/私钥，后端调用 alipay.trade.page.pay
 *   3. 个人可用方案：虎皮椒(xunhupay) / Payjs / 爱发电（第三方代收，有抽成）
 *
 * 接入真实支付只需替换 PaySDK.config.apiBase 和 createOrder 内部逻辑。
 */
(function (window) {
  'use strict';

  var PaySDK = {
    config: {
      // 后端支付接口地址（留空则使用模拟模式）
      apiBase: '',
      // 商户信息（真实接入时填写）
      merchant: {
        name: '',
        alipayAccount: ''
      }
    },
    user: null,
    onBalanceChange: null
  };

  // ============ 用户系统（localStorage 模拟） ============
  function loadUser() {
    try {
      var u = localStorage.getItem('pay_user');
      PaySDK.user = u ? JSON.parse(u) : null;
    } catch (e) { PaySDK.user = null; }
    return PaySDK.user;
  }
  function saveUser(u) {
    PaySDK.user = u;
    localStorage.setItem('pay_user', JSON.stringify(u));
    if (PaySDK.onBalanceChange) PaySDK.onBalanceChange(u);
    // 自动刷新右上角用户栏
    if (document.getElementById('pay-user-bar')) PaySDK.showUserMenu();
  }
  function guestId() {
    var id = localStorage.getItem('pay_guest_id');
    if (!id) { id = 'g_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('pay_guest_id', id); }
    return id;
  }

  PaySDK.login = function (username, password) {
    // 模拟登录：密码不校验，仅记录用户名
    if (!username) return { ok: false, msg: '请输入用户名' };
    var u = {
      username: username,
      coins: parseInt(localStorage.getItem('pay_coins_' + username) || '0', 10),
      vip: false,
      createdAt: Date.now()
    };
    saveUser(u);
    return { ok: true, user: u };
  };

  PaySDK.logout = function () {
    localStorage.removeItem('pay_user');
    PaySDK.user = null;
    if (PaySDK.onBalanceChange) PaySDK.onBalanceChange(null);
  };

  PaySDK.addCoins = function (amount) {
    if (!PaySDK.user) return false;
    PaySDK.user.coins += amount;
    localStorage.setItem('pay_coins_' + PaySDK.user.username, PaySDK.user.coins);
    saveUser(PaySDK.user);
    return true;
  };

  // ============ 创建订单 ============
  PaySDK.createOrder = function (opts, callback) {
    // opts: { amount, payType: 'wechat'|'alipay', product }
    var order = {
      orderId: 'ORD' + Date.now() + Math.floor(Math.random() * 1000),
      amount: opts.amount,
      payType: opts.payType,
      product: opts.product || '游戏金币',
      status: 'pending',
      createdAt: Date.now()
    };

    // 真实接入：调用后端创建订单，获取支付二维码/链接
    if (PaySDK.config.apiBase) {
      // TODO: 真实接口调用
      // fetch(PaySDK.config.apiBase + '/pay/create', { method:'POST', body: JSON.stringify(order) })
      //   .then(r => r.json()).then(data => callback(data));
      callback({ ok: false, msg: '支付接口未配置' });
      return;
    }

    // 模拟模式：直接返回二维码（用占位图）
    var qrUrl = opts.payType === 'wechat'
      ? 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=weixin://wxpay/bizpayurl?pr=' + order.orderId
      : 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=alipays://platformapi/startapp?saId=10000007&clientVersion=3.7.0.0718&qrcode=' + encodeURIComponent('https://qr.alipay.com/' + order.orderId);

    callback({
      ok: true,
      order: order,
      qrUrl: qrUrl,
      tip: opts.payType === 'wechat' ? '请使用微信扫一扫支付' : '请使用支付宝扫一扫支付'
    });
  };

  // ============ 模拟支付成功（演示用，真实由后端回调触发） ============
  PaySDK.mockPaySuccess = function (order) {
    // 金币比例：1 元 = 10 金币
    var coins = Math.floor(order.amount * 10);
    PaySDK.addCoins(coins);
    return coins;
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
      '<div class="pay-field"><label>用户名</label><input id="pay-user" placeholder="输入用户名（无需密码）"></div>' +
      '<div class="pay-field"><label>密码（模拟，可任意填）</label><input id="pay-pass" type="password" placeholder="随便填"></div>' +
      '<button class="pay-btn-primary" id="pay-do-login">登录</button>' +
      '<p class="pay-tip">演示模式：输入用户名即可登录，数据保存在本地浏览器</p>'
    );
    m.querySelector('#pay-do-login').onclick = function () {
      var u = m.querySelector('#pay-user').value.trim();
      var p = m.querySelector('#pay-pass').value;
      var r = PaySDK.login(u, p);
      if (r.ok) { m.remove(); PaySDK.showUserMenu(); }
      else alert(r.msg);
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
      PaySDK.createOrder({ amount: pkg.price, payType: payType, product: pkg.label }, function (res) {
        if (!res.ok) { alert(res.msg); return; }
        var area = m.querySelector('#pay-qr-area');
        area.innerHTML = '<div class="pay-qr-box">' +
          '<img src="' + res.qrUrl + '" alt="支付二维码">' +
          '<p>' + res.tip + '</p>' +
          '<p class="pay-amount">应付：<b>¥' + res.order.amount + '</b></p>' +
          '<button class="pay-btn-ghost" id="pay-mock-success">模拟支付成功（演示）</button>' +
          '</div>';
        area.querySelector('#pay-mock-success').onclick = function () {
          var coins = PaySDK.mockPaySuccess(res.order);
          area.innerHTML = '<div class="pay-success">✅ 支付成功！获得 ' + coins + ' 金币</div>';
          setTimeout(function () { m.remove(); }, 1500);
        };
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
