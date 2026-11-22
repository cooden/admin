/**
 * 广告模块（独立版）—— 纯导流卡片，可直接复用到任意项目
 *
 * 兄弟站点列表已内置固定（DEFAULT_SITES），跨项目复用无需重复配置，
 * 传入的 siblingSites 会追加到固定列表后面（按 id 去重）。
 *
 * 最简用法：
 *   <script src="/assets/js/ad.js"></script>
 *   <div id="ad-top"></div>
 *   <script>
 *     Ad.init();
 *     document.getElementById('ad-top').appendChild(Ad.slot('leaderboard'));
 *   </script>
 *
 * 可选配置：
 *   Ad.init({
 *     currentSite: 'tools',                        // 过滤掉指向自身的卡片
 *     siblingSites: [{ id:'mine', icon:'✨', title:'我的站', desc:'...', href:'https://...' }]
 *   });
 *
 * 广告位类型：
 *   leaderboard : 横幅（3 张卡片），放页面顶部/底部
 *   rectangle   : 矩形（1 张卡片），放侧边栏
 *   sidebar     : 摩天大楼（2 张卡片），放长侧边栏
 */
(function (window) {
  'use strict';

  // 固定的兄弟站点导流列表（跨项目复用，绝对 URL 保证任意项目可跳转）
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
      currentSite: '',
      siblingSites: DEFAULT_SITES.slice()
    }
  };

  // 注入 CSS
  function injectCSS() {
    if (document.getElementById('ad-module-css')) return;
    var css = [
      '.ad-container { margin: 32px 0; }',
      '.ad-slot {',
      '  display: flex; align-items: center; justify-content: center;',
      '  padding: 20px;',
      '}',
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
    var style = document.createElement('style');
    style.id = 'ad-module-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // 生成广告位（纯兄弟站点导流卡片）
  function adSlot(type) {
    var others = Ad.config.siblingSites.filter(function (s) {
      return s.id !== Ad.config.currentSite;
    });
    others.sort(function () { return Math.random() - 0.5; });
    var count = type === 'leaderboard' ? 3 : (type === 'sidebar' ? 2 : 1);
    var picks = others.slice(0, count);

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

    var wrap = document.createElement('div');
    wrap.className = 'ad-container';
    wrap.innerHTML = '<div class="ad-slot ad-' + type + ' sibling-slot">' + cards + '</div>';
    wrap.addEventListener('click', function (e) {
      var card = e.target.closest('.sibling-card');
      if (card && typeof Ad.onSiblingClick === 'function') {
        Ad.onSiblingClick(card.getAttribute('data-site'));
      }
    });
    return wrap;
  }

  Ad.init = function (opts) {
    opts = opts || {};
    if (opts.currentSite) Ad.config.currentSite = opts.currentSite;
    if (opts.siblingSites) {
      var existIds = {};
      Ad.config.siblingSites.forEach(function (s) { existIds[s.id] = true; });
      opts.siblingSites.forEach(function (s) {
        if (!existIds[s.id]) Ad.config.siblingSites.push(s);
      });
    }
    injectCSS();
  };

  Ad.slot = adSlot;
  Ad.onSiblingClick = null;

  window.Ad = Ad;
})(window);
