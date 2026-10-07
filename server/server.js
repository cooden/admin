/**
 * 零依赖支付后端（虎皮椒 xunhupay 对接）
 *
 * 启动：node server.js
 * 端口：3000（可在 config.json 改）
 *
 * 接口：
 *   POST /api/user/login      登录/注册（用户名+密码）
 *   GET  /api/user/info       获取当前用户信息（带金币）
 *   POST /api/pay/create      创建支付订单，返回二维码
 *   GET  /api/pay/query?orderId=xxx  查询订单状态（前端轮询）
 *   POST /api/pay/notify      虎皮椒异步回调（自动加金币）
 *
 * 配置：config.json
 *   {
 *     "port": 3000,
 *     "xunhu": {
 *       "appid": "替换为你的虎皮椒商户ID",
 *       "secret": "替换为你的虎皮椒密钥",
 *       "apiHost": "https://api.xunhupay.com",
 *       "notifyUrl": "http://101.96.236.163:3000/api/pay/notify",
 *       "returnUrl": "http://101.96.236.163/"
 *     }
 *   }
 *
 * 数据存储：data/users.json, data/orders.json（JSON 文件，无需数据库）
 */

var http = require('http');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var url = require('url');

var ROOT = __dirname;
var DATA_DIR = path.join(ROOT, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

var USERS_FILE = path.join(DATA_DIR, 'users.json');
var ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
var CONFIG_FILE = path.join(ROOT, 'config.json');

// 默认配置（真实部署时改 config.json）
var defaultConfig = {
  port: 3000,
  xunhu: {
    appid: '',
    secret: '',
    apiHost: 'https://api.xunhupay.com',
    notifyUrl: 'http://101.96.236.163:3000/api/pay/notify',
    returnUrl: 'http://101.96.236.163/'
  }
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      var c = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return Object.assign({}, defaultConfig, c, { xunhu: Object.assign({}, defaultConfig.xunhu, c.xunhu || {}) });
    }
  } catch (e) { console.error('config.json parse error:', e.message); }
  return defaultConfig;
}
var CONFIG = loadConfig();

// ============ 数据存储 ============
function loadUsers() {
  try { return fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) : {}; }
  catch (e) { return {}; }
}
function saveUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }

function loadOrders() {
  try { return fs.existsSync(ORDERS_FILE) ? JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')) : {}; }
  catch (e) { return {}; }
}
function saveOrders(o) { fs.writeFileSync(ORDERS_FILE, JSON.stringify(o, null, 2)); }

// ============ 工具函数 ============
function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

// 虎皮椒签名：参数按 key 字典序升序拼接，末尾追加 &key=SECRET，整体 MD5
function signXunhu(params, secret) {
  var keys = Object.keys(params).filter(function (k) { return params[k] !== '' && k !== 'sign' && k !== 'hash'; }).sort();
  var str = keys.map(function (k) { return k + '=' + params[k]; }).join('&');
  return md5(str + '&key=' + secret);
}

function send(res, status, data, headers) {
  var body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }, headers || {}));
  res.end(body);
}

function readBody(req, cb) {
  var chunks = [];
  req.on('data', function (c) { chunks.push(c); });
  req.on('end', function () {
    var raw = Buffer.concat(chunks).toString('utf8');
    try { cb(raw ? JSON.parse(raw) : {}); }
    catch (e) { cb(null); }
  });
}

// 生成订单号
function genOrderId() {
  return 'ORD' + Date.now() + Math.floor(Math.random() * 10000);
}

// ============ 用户系统 ============
function login(username, password) {
  if (!username || !password) return { ok: false, msg: '用户名和密码必填' };
  var users = loadUsers();
  var u = users[username];
  if (!u) {
    // 注册
    u = { username: username, password: md5(password), coins: 0, vip: false, createdAt: Date.now() };
    users[username] = u;
    saveUsers(users);
  } else {
    if (u.password !== md5(password)) return { ok: false, msg: '密码错误' };
  }
  // 简单 token
  var token = md5(username + ':' + Date.now() + Math.random());
  u.token = token;
  u.tokenExpire = Date.now() + 7 * 24 * 3600 * 1000;
  users[username] = u;
  saveUsers(users);
  return { ok: true, token: token, user: { username: u.username, coins: u.coins, vip: u.vip } };
}

function getUserByToken(token) {
  if (!token) return null;
  var users = loadUsers();
  for (var k in users) {
    if (users[k].token === token && users[k].tokenExpire > Date.now()) {
      return users[k];
    }
  }
  return null;
}

function addCoins(username, amount) {
  var users = loadUsers();
  if (!users[username]) return false;
  users[username].coins = (users[username].coins || 0) + amount;
  saveUsers(users);
  return true;
}

// ============ 虎皮椒下单 ============
function createXunhuOrder(opts, cb) {
  // opts: { orderId, amount, title, payType: 'wechat'|'alipay' }
  var params = {
    version: '1.1',
    appid: CONFIG.xunhu.appid,
    trade_product_id: opts.orderId,
    out_trade_no: opts.orderId,
    payment_type: 'TRADE_H5',
    total_amount: opts.amount.toFixed(2),
    notify_url: CONFIG.xunhu.notifyUrl,
    return_url: CONFIG.xunhu.returnUrl,
    title: opts.title || '游戏金币',
    type: opts.payType === 'wechat' ? 'WAP' : 'WAP',
    hash: ''
  };
  if (!CONFIG.xunhu.appid || !CONFIG.xunhu.secret) {
    // 配置未填，返回本地模拟二维码
    var mockQr = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent('pay://' + opts.orderId + '/' + opts.amount);
    cb({ ok: true, qrUrl: mockQr, mock: true, orderId: opts.orderId });
    return;
  }
  params.hash = signXunhu(params, CONFIG.xunhu.secret);
  var query = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
  var apiUrl = CONFIG.xunhu.apiHost + '/payment/do.html?' + query;

  // 用 https 模块请求
  var lib = apiUrl.indexOf('https://') === 0 ? require('https') : require('http');
  lib.get(apiUrl, function (resp) {
    var data = '';
    resp.on('data', function (c) { data += c; });
    resp.on('end', function () {
      try {
        var json = JSON.parse(data);
        if (json.errcode === 0 && json.url) {
          // 虎皮椒返回的 url 就是支付页，再生成二维码
          var qr = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(json.url);
          cb({ ok: true, qrUrl: qr, orderId: opts.orderId, payUrl: json.url });
        } else {
          cb({ ok: false, msg: '虎皮椒返回错误: ' + (json.errmsg || data) });
        }
      } catch (e) {
        cb({ ok: false, msg: '虎皮椒响应解析失败: ' + data });
      }
    });
  }).on('error', function (e) {
    cb({ ok: false, msg: '网络错误: ' + e.message });
  });
}

// ============ 异步回调处理 ============
function handleNotify(params) {
  // 验签
  var expectedSign = signXunhu(params, CONFIG.xunhu.secret);
  if (CONFIG.xunhu.secret && params.hash !== expectedSign && params.sign !== expectedSign) {
    return { ok: false, msg: '签名错误' };
  }
  var orderId = params.out_trade_no || params.trade_product_id;
  var orders = loadOrders();
  var order = orders[orderId];
  if (!order) return { ok: false, msg: '订单不存在' };
  if (order.status === 'paid') return { ok: true, msg: '已处理' };

  // 更新订单
  order.status = 'paid';
  order.paidAt = Date.now();
  order.transactionId = params.transaction_id || params.order_no || '';
  orders[orderId] = order;
  saveOrders(orders);

  // 加金币（1 元 = 10 金币）
  var coins = Math.floor(order.amount * 10);
  addCoins(order.username, coins);
  console.log('[OK] 订单 ' + orderId + ' 已支付，用户 ' + order.username + ' +' + coins + ' 金币');
  return { ok: true };
}

// ============ HTTP 路由 ============
var server = http.createServer(function (req, res) {
  var parsed = url.parse(req.url, true);
  var pathname = parsed.pathname;
  var method = req.method;

  if (method === 'OPTIONS') { send(res, 204, ''); return; }

  // ---- 静态健康检查 ----
  if (pathname === '/' && method === 'GET') {
    send(res, 200, { ok: true, service: 'pay-server', time: Date.now(), xunhu: !!CONFIG.xunhu.appid });
    return;
  }

  // ---- 用户登录 ----
  if (pathname === '/api/user/login' && method === 'POST') {
    readBody(req, function (body) {
      if (!body) { send(res, 400, { ok: false, msg: '参数错误' }); return; }
      var r = login(body.username, body.password);
      send(res, r.ok ? 200 : 400, r);
    });
    return;
  }

  // ---- 用户信息 ----
  if (pathname === '/api/user/info' && method === 'GET') {
    var token = (req.headers.authorization || '').replace('Bearer ', '');
    var u = getUserByToken(token);
    if (!u) { send(res, 401, { ok: false, msg: '未登录' }); return; }
    send(res, 200, { ok: true, user: { username: u.username, coins: u.coins, vip: u.vip } });
    return;
  }

  // ---- 创建订单 ----
  if (pathname === '/api/pay/create' && method === 'POST') {
    readBody(req, function (body) {
      if (!body) { send(res, 400, { ok: false, msg: '参数错误' }); return; }
      var token = (req.headers.authorization || '').replace('Bearer ', '');
      var u = getUserByToken(token);
      if (!u) { send(res, 401, { ok: false, msg: '请先登录' }); return; }
      if (!body.amount || !body.payType) { send(res, 400, { ok: false, msg: '缺少参数' }); return; }

      var orderId = genOrderId();
      var order = {
        orderId: orderId,
        username: u.username,
        amount: parseFloat(body.amount),
        product: body.product || '游戏金币',
        payType: body.payType,
        status: 'pending',
        createdAt: Date.now()
      };
      var orders = loadOrders();
      orders[orderId] = order;
      saveOrders(orders);

      createXunhuOrder({ orderId: orderId, amount: order.amount, title: order.product, payType: order.payType }, function (r) {
        if (!r.ok) { send(res, 500, r); return; }
        send(res, 200, {
          ok: true,
          orderId: orderId,
          qrUrl: r.qrUrl,
          payUrl: r.payUrl || null,
          mock: r.mock || false,
          tip: body.payType === 'wechat' ? '请用微信扫码支付' : '请用支付宝扫码支付'
        });
      });
    });
    return;
  }

  // ---- 查询订单状态（前端轮询） ----
  if (pathname === '/api/pay/query' && method === 'GET') {
    var orderId = parsed.query.orderId;
    var orders = loadOrders();
    var order = orders[orderId];
    if (!order) { send(res, 404, { ok: false, msg: '订单不存在' }); return; }
    var u = getUserByToken((req.headers.authorization || '').replace('Bearer ', ''));
    send(res, 200, {
      ok: true,
      status: order.status,
      amount: order.amount,
      paidAt: order.paidAt,
      coins: order.status === 'paid' ? Math.floor(order.amount * 10) : 0,
      balance: u ? u.coins : null
    });
    return;
  }

  // ---- 虎皮椒异步回调 ----
  if (pathname === '/api/pay/notify' && method === 'POST') {
    readBody(req, function (body) {
      // 虎皮椒可能用 form-urlencoded 或 json
      var params = body;
      if (typeof body === 'object' && Object.keys(body).length === 0) {
        // 尝试从 query 解析
        params = parsed.query;
      }
      var r = handleNotify(params);
      // 虎皮椒要求返回 success
      send(res, r.ok ? 200 : 400, r.ok ? 'success' : r);
    });
    return;
  }

  // ---- 404 ----
  send(res, 404, { ok: false, msg: 'not found' });
});

var listenPort = process.env.PORT ? parseInt(process.env.PORT, 10) : CONFIG.port;
server.listen(listenPort, function () {
  console.log('====================================');
  console.log(' 支付后端已启动');
  console.log(' 端口: ' + listenPort);
  console.log(' 虎皮椒: ' + (CONFIG.xunhu.appid ? '已配置' : '未配置（走模拟模式）'));
  console.log(' 回调URL: ' + CONFIG.xunhu.notifyUrl);
  console.log(' 数据目录: ' + DATA_DIR);
  console.log('====================================');
});
