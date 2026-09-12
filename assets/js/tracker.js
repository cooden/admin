/**
 * 多站点流量统计 SDK (MTA - Multi-site Traffic Analytics)
 *
 * 功能：
 *   - 自动 PV / UV / 会话 / 来源 / 停留时长统计
 *   - 事件追踪 API: MTA.track(event, data)
 *   - 数据存 localStorage（开发/单域部署即可查看面板）
 *   - 可选上报到后端 endpoint（部署到多域时使用）
 *   - 支持通过 postMessage 向嵌入的 dashboard iframe 汇报数据
 *
 * 用法：
 *   <script src="/assets/js/tracker.js" data-site="moms"></script>
 *   MTA.track('use_tool', { tool: 'bmi' });
 */
(function (window) {
  'use strict';

  var MTA = {
    siteId: 'default',
    endpoint: '',          // 后端上报地址，留空则只存本地
    version: '1.0.0',
    _startTime: Date.now(),
    _sent: false
  };

  // ===== 工具函数 =====
  function uid() {
    var key = 'mta_uid';
    var id = localStorage.getItem(key);
    if (!id) {
      id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(key, id);
    }
    return id;
  }

  function sid() {
    // 会话：30 分钟内活跃算同一会话
    var key = 'mta_sid';
    var now = Date.now();
    var data = localStorage.getItem(key);
    var id, ts;
    if (data) {
      var p = data.split('|');
      id = p[0]; ts = +p[1];
      if (now - ts > 30 * 60 * 1000) id = ''; // 过期
    }
    if (!id) {
      id = 's_' + now.toString(36) + Math.random().toString(36).slice(2, 6);
    }
    localStorage.setItem(key, id + '|' + now);
    return id;
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch (e) { return {}; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  // 解析来源
  function parseReferrer() {
    var ref = document.referrer || '';
    var utm = {};
    location.search.slice(1).split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p[0] && p[0].indexOf('utm_') === 0) utm[p[0]] = decodeURIComponent(p[1] || '');
    });
    var source = utm.utm_source || (ref ? new URL(ref).hostname : '直接访问');
    return { ref: ref, source: source, medium: utm.utm_medium || '', campaign: utm.utm_campaign || '' };
  }

  // ===== 主存储 =====
  function storeKey() { return 'mta_store_' + MTA.siteId; }

  function getStore() {
    var s = read(storeKey());
    if (!s.daily) s.daily = {};
    if (!s.pages) s.pages = {};
    if (!s.refs) s.refs = {};
    if (!s.events) s.events = {};
    if (!s.total) s.total = { pv: 0, uv: 0, sessions: 0 };
    return s;
  }

  function saveStore(s) { write(storeKey(), s); }

  // ===== PV 追踪 =====
  function trackPageView() {
    var s = getStore();
    var t = today();
    var d = s.daily[t] = s.daily[t] || { pv: 0, uv: 0, sessions: 0 };
    var path = location.pathname;
    var uidv = uid();
    var sidv = sid();
    var ref = parseReferrer();

    // 记录是否新 UV / 新会话（用当天的 uid/sid 集合判断）
    d._uids = d._uids || {};
    d._sids = d._sids || {};
    var isNewUV = !d._uids[uidv];
    var isNewSession = !d._sids[sidv];
    d._uids[uidv] = 1;
    d._sids[sidv] = 1;

    d.pv++;
    if (isNewUV) d.uv++;
    if (isNewSession) d.sessions++;

    s.total.pv++;
    if (isNewUV) s.total.uv++;
    if (isNewSession) s.total.sessions++;

    // 页面热度
    s.pages[path] = s.pages[path] || { pv: 0, uv: 0 };
    s.pages[path].pv++;
    if (isNewUV) s.pages[path].uv++;

    // 来源
    s.refs[ref.source] = s.refs[ref.source] || { pv: 0, uv: 0 };
    s.refs[ref.source].pv++;
    if (isNewUV) s.refs[ref.source].uv++;

    s.lastUpdate = Date.now();
    s.siteId = MTA.siteId;
    saveStore(s);

    // 上报后端（如配置）
    if (MTA.endpoint) {
      sendBeacon(MTA.endpoint, {
        type: 'pv', site: MTA.siteId, path: path,
        uid: uidv, sid: sidv, ref: ref, ts: Date.now()
      });
    }
  }

  // ===== 事件追踪 =====
  MTA.track = function (event, data) {
    var s = getStore();
    var key = event + '|' + today();
    s.events[key] = s.events[key] || { count: 0, _uids: {} };
    s.events[key].count++;
    s.events[key]._uids[uid()] = 1;
    s.events[key].uv = Object.keys(s.events[key]._uids).length;
    if (data) {
      s.events[key].data = s.events[key].data || [];
      if (s.events[key].data.length < 50) s.events[key].data.push(data);
    }
    saveStore(s);

    if (MTA.endpoint) {
      sendBeacon(MTA.endpoint, {
        type: 'event', site: MTA.siteId, event: event,
        data: data, uid: uid(), ts: Date.now()
      });
    }
  };

  // ===== 停留时长（页面卸载时记录） =====
  function trackDuration() {
    if (MTA._sent) return;
    MTA._sent = true;
    var dur = Math.round((Date.now() - MTA._startTime) / 1000);
    var s = getStore();
    var path = location.pathname;
    s.pages[path] = s.pages[path] || { pv: 0, uv: 0 };
    s.pages[path].totalDur = (s.pages[path].totalDur || 0) + dur;
    s.pages[path].avgDur = Math.round(s.pages[path].totalDur / s.pages[path].pv);
    saveStore(s);

    if (MTA.endpoint) {
      sendBeacon(MTA.endpoint, {
        type: 'duration', site: MTA.siteId, path: path,
        dur: dur, uid: uid(), ts: Date.now()
      });
    }
  }

  // ===== 上报 =====
  function sendBeacon(url, payload) {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, JSON.stringify(payload));
      } else {
        var x = new XMLHttpRequest();
        x.open('POST', url, true);
        x.setRequestHeader('Content-Type', 'application/json');
        x.send(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  // ===== 响应 dashboard 的数据请求（跨域） =====
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'mta_fetch') return;
    // 安全检查：可校验 e.origin
    var s = getStore();
    e.source.postMessage({
      type: 'mta_data', site: MTA.siteId, store: s, uid: uid()
    }, '*');
  });

  // ===== 初始化 =====
  MTA.init = function (opts) {
    opts = opts || {};
    if (opts.siteId) MTA.siteId = opts.siteId;
    if (opts.endpoint) MTA.endpoint = opts.endpoint;

    // 自动 PV
    if (document.readyState === 'complete') {
      trackPageView();
    } else {
      window.addEventListener('load', trackPageView);
    }
    // 卸载时记录时长
    window.addEventListener('beforeunload', trackDuration);
    // 单页应用路由变化（兼容）
    if (window.history && history.pushState) {
      (function (push) {
        history.pushState = function () {
          var r = push.apply(this, arguments);
          trackPageView();
          return r;
        };
      })(history.pushState);
      window.addEventListener('popstate', trackPageView);
    }
  };

  // 从 script 标签 data-site 自动初始化
  var scripts = document.getElementsByTagName('script');
  var cur = scripts[scripts.length - 1];
  var siteAttr = cur && cur.getAttribute('data-site');
  if (siteAttr) MTA.init({ siteId: siteAttr });

  window.MTA = MTA;
})(window);
