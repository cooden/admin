/**
 * 广告模块（独立版）—— 可直接复用到任意项目
 *
 * 功能：
 *   1. 配置了 AdSense → 显示真实 Google 广告
 *   2. 未配置 AdSense → 用兄弟站点推荐卡片替代空广告位（导流）
 *
 * 用法（页面任意位置）：
 *   <script src="/assets/js/ad.js"></script>
 *   <script>
 *     Ad.init({
 *       adsenseId: 'ca-pub-XXXXXXXX',        // 可选，配置后显示真实广告
 *       siblingSites: [                        // 可选，未配置 AdSense 时的导流卡片
 *         { id: 'blog', icon: '📝', title: '博客', desc: '...', href: '/blog/' }
 *       ],
 *       currentSite: 'tools'                   // 可选，过滤掉指向自身的卡片
 *     });
 *   </script>
 *
 *   <!-- 在需要广告位的地方放占位符 -->
 *   <div id="ad-top"></div>
 *   <div id="ad-bottom"></div>
 *
 *   <!-- 填充广告位（Ad.init 之后调用） -->
 *   <script>
 *     document.getElementById('ad-top').appendChild(Ad.slot('leaderboard'));
 *     document.getElementById('ad-bottom').appendChild(Ad.slot('rectangle'));
 *   </script>
 *
 * 广告位类型：
 *   - leaderboard : 横幅（728x90），放页面顶部/底部
 *   - rectangle   : 矩形（300x250），放侧边栏
 *   - sidebar     : 摩天大楼（160x600），放长侧边栏
 */
(function (window) {
  'use strict';

  var Ad = {
    config: {
      adsenseId: '',
      currentSite: '',
      siblingSites: []
    }
  };

  // ============ 工具函数 ============
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    if (children) (Array.isArray(children) ? children : [children]).forEach(function (c) {
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  // ============ 注入 CSS ============
  function injectCSS() {
    if (document.getElementById('ad-module-css')) return;
    var css = [
      '.ad-container { margin: 32px 0; }',
      '.ad-slot {',
      '  background: repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 10px,#e2e8f0 10px,#e2e8f0 20px);',
      '  border: 1px dashed #cbd5e1; border-radius: 10px; min-height: 90px;',
      '  display: flex; align-items: center; justify-content: center;',
      '  color: #94a3b8; font-size: 0.85rem; text-align: center; padding: 20px;',
      '}',
      '.ad-slot.ad-leaderboard { min-height: 90px; }',
      '.ad-slot.ad-rectangle { min-height: 250px; }',
      '.ad-slot.ad-sidebar { min-height: 600px; }',
      '.ad-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px;',
      '  color: #94a3b8; text-align: center; margin-bottom: 6px; }',
      '.sibling-slot { display: flex; gap: 12px; flex-wrap: wrap; }',
      '.ad-sidebar .sibling-slot { flex-direction: column; }',
      '.sibling-card {',
      '  display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;',
      '  padding: 14px 16px; background: linear-gradient(135deg,#eef2ff,#f5f3ff);',
      '  border: 1px solid #e0e7ff; border-radius: 10px; text-decoration: none;',
      '  color: inherit; transition: all .2s;',
      '}',
      '.sibling-card:hover {',
      '  background: linear-gradient(135deg,#e0e7ff,#ede9fe); border-color: #a5b4fc;',
      '  transform: translateY(-2px); box-shadow: 0 4px 12px rgba(79,70,229,.15);',
      '}',
      '.sibling-icon { font-size: 1.8rem; flex-shrink: 0; }',
      '.sibling-body { flex: 1; min-width: 0; }',
      '.sibling-body h4 { margin: 0 0 2px; font-size: .95rem; color: #3730a3; }',
      '.sibling-body p { margin: 0; font-size: .8rem; color: #64748b; line-height: 1.4; }',
      '.sibling-arrow { color: #a5b4fc; font-weight: bold; flex-shrink: 0; }',
      '.ad-rectangle .sibling-card { flex-direction: column; text-align: center; }',
      '.ad-rectangle .sibling-arrow { margin-top: 6px; }'
    ].join('\n');
    var style = el('style', { id: 'ad-module-css' });
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ============ 注入 AdSense 脚本 ============
  function injectAdSense() {
    if (!Ad.config.adsenseId) return;
    if (document.querySelector('script[src*="adsbygoogle"]')) return;
    var s = el('script', {
      async: true,
      src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + Ad.config.adsenseId,
      crossorigin: 'anonymous'
    });
    document.head.appendChild(s);
  }

  // ============ 生成广告位 ============
  function adSlot(type) {
    // 已配置 AdSense → 显示真实广告
    if (Ad.config.adsenseId) {
      var ins = el('ins', {
        class: 'adsbygoogle',
        style: 'display:block',
        'data-ad-client': Ad.config.adsenseId,
        'data-ad-slot': '',
        'data-ad-format': 'auto'
      });
      var sc = document.createElement('script');
      sc.textContent = '(adsbygoogle = window.adsbygoogle || []).push({});';
      return el('div', { class: 'ad-container' }, [
        el('div', { class: 'ad-slot ad-' + type }, [ins, sc])
      ]);
    }

    // 未配置 AdSense → 用兄弟站点推荐导流
    var others = (Ad.config.siblingSites || []).filter(function (s) {
      return s.id !== Ad.config.currentSite;
    });
    others.sort(function () { return Math.random() - 0.5; });
    var count = type === 'leaderboard' ? 3 : (type === 'sidebar' ? 2 : 1);
    var picks = others.slice(0, count);

    if (picks.length === 0) {
      return el('div', { class: 'ad-container' }, [
        el('div', { class: 'ad-slot ad-' + type }, '广告位')
      ]);
    }

    var cards = picks.map(function (s) {
      return '<a href="' + s.href + '" class="sibling-card" data-site="' + s.id + '">' +
               '<span class="sibling-icon">' + s.icon + '</span>' +
               '<div class="sibling-body">' +
                 '<h4>' + s.title + '</h4>' +
                 '<p>' + s.desc + '</p>' +
               '</div>' +
               '<span class="sibling-arrow">→</span>' +
             '</a>';
    }).join('');

    var wrap = el('div', { class: 'ad-container' }, [
      el('div', { class: 'ad-slot ad-' + type + ' sibling-slot', html: cards })
    ]);
    wrap.addEventListener('click', function (e) {
      var card = e.target.closest('.sibling-card');
      if (card && typeof Ad.onSiblingClick === 'function') {
        Ad.onSiblingClick(card.getAttribute('data-site'));
      }
    });
    return wrap;
  }

  // ============ 初始化 ============
  Ad.init = function (opts) {
    opts = opts || {};
    if (opts.adsenseId) Ad.config.adsenseId = opts.adsenseId;
    if (opts.currentSite) Ad.config.currentSite = opts.currentSite;
    if (opts.siblingSites) Ad.config.siblingSites = opts.siblingSites;
    injectCSS();
    injectAdSense();
  };

  // 暴露方法
  Ad.slot = adSlot;
  Ad.el = el;
  Ad.onSiblingClick = null; // 可自定义点击回调

  window.Ad = Ad;
})(window);
