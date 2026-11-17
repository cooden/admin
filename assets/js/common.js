/**
 * 公共组件：导航、页脚、广告位、Toast、Google Analytics/AdSense 注入
 *
 * 用法（页面底部）：
 *   <script src="/assets/js/common.js"></script>
 *   <script>
 *     App.mount({ site: 'moms', nav: [...], footerNote: '...' });
 *   </script>
 */
(function (window) {
  'use strict';

  var App = {
    config: {
      // Google Analytics ID（部署后替换为你的 G-XXXX）
      gaId: '',
      // Google AdSense Publisher ID（部署后替换为 ca-pub-XXXX）
      adsenseId: '',
      // 当前站点 id（用于过滤掉指向自身的推荐卡片）
      currentSite: ''
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

  function toast(msg) {
    var t = el('div', { class: 'toast', html: msg });
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove && t.remove(); }, 300);
    }, 2000);
  }

  function copy(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('已复制'); } catch (e) {}
      ta.remove();
    }
  }

  // ============ 导航 ============
  function mountNav(navItems, brand, brandIcon) {
    var cur = location.pathname.split('/').pop() || 'index.html';
    var links = navItems.map(function (it) {
      return '<a href="' + it.href + '"' + (it.href === cur ? ' class="active"' : '') + '>' + it.label + '</a>';
    }).join('');
    var nav = el('nav', { class: 'navbar' }, [
      el('div', { class: 'container' }, [
        el('a', { class: 'logo', href: 'index.html' }, [
          el('span', { class: 'logo-icon', html: brandIcon || '&#128295;' }),
          brand || '工具箱'
        ]),
        el('ul', { class: 'nav-links', html: links })
      ])
    ]);
    document.body.insertBefore(nav, document.body.firstChild);
  }

  // ============ 页脚 ============
  function mountFooter(siteName, links) {
    var year = new Date().getFullYear();
    var toolsHtml = (links.tools || []).map(function (l) {
      return '<li><a href="' + l.href + '">' + l.label + '</a></li>';
    }).join('');
    var articlesHtml = (links.articles || []).map(function (l) {
      return '<li><a href="' + l.href + '">' + l.label + '</a></li>';
    }).join('');
    var gridHtml =
      '<div class="footer-col">' +
        '<h4>' + siteName + '</h4>' +
        '<p>提供实用的在线工具，让生活更简单。</p>' +
        '<p>&copy; ' + year + ' ' + siteName + '</p>' +
      '</div>' +
      '<div class="footer-col"><h4>工具</h4><ul>' + toolsHtml + '</ul></div>' +
      '<div class="footer-col"><h4>文章</h4><ul>' + articlesHtml + '</ul></div>' +
      '<div class="footer-col"><h4>关于</h4><ul>' +
        '<li><a href="../dashboard/index.html" target="_blank">流量监测面板</a></li>' +
        '<li><a href="about.html">关于我们</a></li>' +
        '<li><a href="privacy.html">隐私政策</a></li>' +
      '</ul></div>';
    var f = el('footer', { class: 'footer' }, [
      el('div', { class: 'container' }, [
        el('div', { class: 'footer-grid', html: gridHtml }),
        el('div', { class: 'footer-bottom', html: '本站工具结果仅供参考。' + siteName + ' &copy; ' + year })
      ])
    ]);
    document.body.appendChild(f);
  }

  // ============ 广告位 ============
  function adSlot(type) {
    // 已配置 AdSense → 显示真实广告
    if (App.config.adsenseId) {
      var ins = el('ins', {
        class: 'adsbygoogle',
        style: 'display:block',
        'data-ad-client': App.config.adsenseId,
        'data-ad-slot': '',
        'data-ad-format': 'auto'
      });
      var sc = document.createElement('script');
      sc.textContent = '(adsbygoogle = window.adsbygoogle || []).push({});';
      return el('div', { class: 'ad-container' }, [
        el('div', { class: 'ad-slot ad-' + type }, [ins, sc])
      ]);
    }
    // 未配置 AdSense → 用兄弟站点推荐导流（替代空广告位）
    var base = getBasePath();
    var others = SIBLING_SITES.filter(function (s) { return s.id !== App.config.currentSite; });
    // 随机打乱，每次刷新展示不同站点
    others.sort(function () { return Math.random() - 0.5; });
    var count = type === 'leaderboard' ? 3 : (type === 'sidebar' ? 2 : 1);
    var picks = others.slice(0, count);
    var cards = picks.map(function (s) {
      return '<a href="' + base + s.href + '" class="sibling-card" data-site="' + s.id + '">' +
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
      if (card && window.MTA && MTA.track) {
        MTA.track('sibling_click', { target: card.getAttribute('data-site') });
      }
    });
    return wrap;
  }

  function injectAdSense() {
    if (!App.config.adsenseId) return;
    var s = el('script', {
      async: true,
      src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + App.config.adsenseId,
      crossorigin: 'anonymous'
    });
    document.head.appendChild(s);
  }

  // ============ Google Analytics ============
  function injectGA() {
    if (!App.config.gaId) return;
    var s = el('script', {
      async: true,
      src: 'https://www.googletagmanager.com/gtag/js?id=' + App.config.gaId
    });
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', App.config.gaId, { send_page_view: true });
  }

  // ============ 跨站推荐（兄弟站点导流） ============
  var SIBLING_SITES = [
    { id: 'students',  icon: '🎯', title: '趣味测试站', desc: '动物性格、星座配对、生日密码，学生最爱', href: 'students/index.html' },
    { id: 'tools',     icon: '🔧', title: '在线工具箱', desc: '单位换算、BMI、密码生成，实用小工具',    href: 'tools/index.html' },
    { id: 'blog',      icon: '📝', title: '生活百科',   desc: '健康科普、省电技巧、密码安全文章',       href: 'blog/index.html' },
    { id: 'resources', icon: '📚', title: '资源导航',   desc: '设计、开发、学习、效率精选资源',         href: 'resources/index.html' },
    { id: 'reviews',   icon: '⭐', title: '产品测评',   desc: '主流工具深度对比测评，帮你选对',         href: 'reviews/index.html' },
    { id: 'games',     icon: '🎮', title: '小游戏站',   desc: '刀光剑影躲避飞刀，扁平3D质感休闲游戏',   href: 'games/index.html' }
  ];

  // 计算当前页面到站点根目录的相对路径前缀（兼容 GitHub Pages 子路径）
  function getBasePath() {
    var parts = location.pathname.split('/').filter(Boolean);
    var siteDirs = ['students', 'tools', 'blog', 'resources', 'reviews', 'dashboard', 'games'];
    var siteIdx = -1;
    for (var i = 0; i < parts.length; i++) {
      if (siteDirs.indexOf(parts[i]) !== -1) { siteIdx = i; break; }
    }
    if (siteIdx === -1) return '';
    var subDepth = parts.length - siteIdx - 1;
    var base = '';
    for (var j = 0; j < subDepth; j++) base += '../';
    return base;
  }

  // ============ SEO meta（可选） ============
  function seo(opts) {
    if (opts.title) document.title = opts.title;
    if (opts.desc) {
      var m = el('meta', { name: 'description', content: opts.desc });
      document.head.appendChild(m);
    }
    if (opts.keywords) {
      document.head.appendChild(el('meta', { name: 'keywords', content: opts.keywords }));
    }
    if (opts.canonical) {
      document.head.appendChild(el('link', { rel: 'canonical', href: opts.canonical }));
    }
  }

  // ============ 主挂载入口 ============
  App.mount = function (opts) {
    opts = opts || {};
    if (opts.gaId) App.config.gaId = opts.gaId;
    if (opts.adsenseId) App.config.adsenseId = opts.adsenseId;
    if (opts.site) App.config.currentSite = opts.site;

    if (opts.nav) mountNav(opts.nav, opts.brand, opts.brandIcon);
    injectAdSense();
    injectGA();
    if (opts.footer) mountFooter(opts.brand || '工具箱', opts.footer);
  };

  // 工具方法暴露
  App.toast = toast;
  App.copy = copy;
  App.ad = adSlot;
  App.seo = seo;
  App.el = el;

  window.App = App;
})(window);
