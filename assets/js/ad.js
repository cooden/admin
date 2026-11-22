/**
 * 广告模块（独立版）—— 可直接复用到任意项目
 *
 * 功能：
 *   1. 配置了 AdSense → 显示真实 Google 广告
 *   2. 未配置 AdSense → 用兄弟站点推荐卡片替代空广告位（导流）
 *
 * 兄弟站点列表已内置固定（DEFAULT_SITES），跨项目复用无需重复配置，
 * 传入的 siblingSites 会追加到固定列表后面（按 id 去重）。
 *
 * 最简用法（页面任意位置）：
 *   <script src="/assets/js/ad.js"></script>
 *   <div id="ad-top"></div>
 *   <script>
 *     Ad.init();  // 不传参也能用固定列表导流
 *     document.getElementById('ad-top').appendChild(Ad.slot('leaderboard'));
 *   </script>
 *
 * 完整配置（可选）：
 *   <script src="/assets/js/ad.js"></script>
 *   <script>
 *     Ad.init({
 *       adsenseId: 'ca-pub-XXXXXXXX',   // 可选，配置后显示真实广告
 *       currentSite: 'tools',           // 可选，过滤掉指向自身的卡片
 *       siblingSites: [                 // 可选，追加额外导流卡片
 *         { id: 'mine', icon: '✨', title: '我的站', desc: '...', href: 'https://...' }
 *       ]
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

  // 固定的兄弟站点导流列表（跨项目复用，使用绝对 URL 保证在任意项目都能跳转）
  var DEFAULT_SITES = [
    { id: 'students',  icon: '🎯', title: '趣味测试站', desc: '动物性格、星座配对、生日密码，学生最爱', href: 'https://cooden.github.io/admin/students/index.html' },
    { id: 'tools',     icon: '🔧', title: '在线工具箱', desc: '单位换算、BMI、密码生成、SQL 学习，实用小工具', href: 'https://cooden.github.io/admin/tools/index.html' },
    { id: 'blog',      icon: '📝', title: '生活百科',   desc: '健康科普、省电技巧、密码安全文章',       href: 'https://cooden.github.io/admin/blog/index.html' },
    { id: 'resources', icon: '📚', title: '资源导航',   desc: '设计、开发、学习、效率精选资源',         href: 'https://cooden.github.io/admin/resources/index.html' },
    { id: 'reviews',   icon: '⭐', title: '产品测评',   desc: '主流工具深度对比测评，帮你选对',         href: 'https://cooden.github.io/admin/reviews/index.html' },
    { id: 'games',     icon: '🎮', title: '小游戏站',   desc: '刀光剑影躲避飞刀，扁平3D质感休闲游戏',   href: 'https://cooden.github.io/admin/games/index.html' },
    { id: 'school',    icon: '🎓', title: '技校分布',   desc: '全国技校分布查询，学校信息、专业设置、招生详情', href: 'https://cooden.github.io/school' },
    { id: 'flower',    icon: '💐', title: '贺卡工坊',   desc: '定制电子贺卡，节日花束、祝福语，为她定制心意', href: 'https://cooden.github.io/flower' },
    { id: 'usa',       icon: '🗺️', title: '美国文化地图', desc: '50个州文化名片：音乐、美食、地标、人物，可交互地图探索', href: 'https://cooden.github.io/usa' }
  ];

  var Ad = {
    config: {
      adsenseId: '',
      currentSite: '',
      siblingSites: DEFAULT_SITES.slice()
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
      var isExternal = /^https?:\/\//i.test(s.href);
      var attrs = isExternal ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + s.href + '" class="sibling-card" data-site="' + s.id + '"' + attrs + '>' +
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
    if (opts.siblingSites) {
      // 追加到固定列表，按 id 去重（固定列表始终保留）
      var existIds = {};
      Ad.config.siblingSites.forEach(function (s) { existIds[s.id] = true; });
      opts.siblingSites.forEach(function (s) {
        if (!existIds[s.id]) Ad.config.siblingSites.push(s);
      });
    }
    injectCSS();
    injectAdSense();
  };

  // 暴露方法
  Ad.slot = adSlot;
  Ad.el = el;
  Ad.onSiblingClick = null; // 可自定义点击回调

  window.Ad = Ad;
})(window);
