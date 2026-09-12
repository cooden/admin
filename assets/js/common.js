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
      adsenseId: ''
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
    var label = '广告位';
    var sizes = {
      leaderboard: '728x90 / 横幅广告',
      rectangle: '300x250 / 矩形广告',
      sidebar: '300x600 / 侧栏广告'
    };
    return el('div', { class: 'ad-container' }, [
      el('div', { class: 'ad-label', html: label }),
      el('div', { class: 'ad-slot ad-' + type, html:
        (App.config.adsenseId
          ? '<ins class="adsbygoogle" style="display:block" ' +
            'data-ad-client="' + App.config.adsenseId + '" ' +
            'data-ad-slot="" data-ad-format="auto"></ins>' +
            '<script>(adsbygoogle = window.adsbygoogle || []).push({});<\/script>'
          : 'Google AdSense 广告位<br>(' + (sizes[type] || '') + ')<br><small>配置 ca-pub-XXXX 后启用</small>')
      })
    ]);
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
