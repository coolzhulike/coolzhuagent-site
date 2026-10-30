// theme.js — header, mobile nav, reveal, promo film, download releases
(function () {
  'use strict';

  var path = location.pathname.replace(/\/index\.html$/, '/');
  var header = document.getElementById('site-header');
  var nav = document.getElementById('site-nav');
  var navToggle = document.getElementById('nav-toggle');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2600);
  }

  /* ---------------- active nav ---------------- */
  document.querySelectorAll('.nav a:not(.nav-cta)').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    var target = href.split('#')[0];
    if (!target) return;
    if (target === '/') {
      if (path === '/') a.classList.add('active');
      return;
    }
    if (target === '/docs/quickstart.html' && path.indexOf('/docs/') === 0) {
      a.classList.add('active');
      return;
    }
    if (path === target) a.classList.add('active');
  });

  /* ---------------- sticky header ---------------- */
  function onScroll() {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 8);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------- mobile nav ---------------- */
  function closeNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', '打开导航');
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
    });

    nav.addEventListener('click', function (event) {
      if (event.target && event.target.closest && event.target.closest('a')) closeNav();
    });

    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('open')) return;
      if (nav.contains(event.target) || navToggle.contains(event.target)) return;
      closeNav();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeNav();
    });
  }

  /* ---------------- reveal on scroll ---------------- */
  var reveals = document.querySelectorAll('[data-reveal]');
  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window) || reduceMotion) {
    reveals.forEach(function (el) {
      el.classList.add('is-visible');
    });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    reveals.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---------------- promo film ---------------- */
  var filmPlay = document.getElementById('film-play');
  var promoVideo = document.getElementById('promo-video');
  var filmOverlay = document.getElementById('film-overlay');
  var filmFrame = document.getElementById('film-frame');
  var filmAttempted = false;

  if (filmPlay && promoVideo && filmOverlay) {
    filmPlay.addEventListener('click', function () {
      filmAttempted = true;
      if (!promoVideo.querySelector('source') && promoVideo.getAttribute('data-src')) {
        var source = document.createElement('source');
        source.src = promoVideo.getAttribute('data-src');
        source.type = 'video/mp4';
        promoVideo.appendChild(source);
        promoVideo.load();
      }
      var promise = promoVideo.play();
      if (promise && promise.catch) {
        promise.catch(function () {
          toast('宣传片即将上线，敬请期待。');
        });
      }
    });

    promoVideo.addEventListener('playing', function () {
      filmOverlay.classList.add('hidden');
      promoVideo.controls = true;
      if (filmFrame) filmFrame.classList.add('controls-on');
    });

    promoVideo.addEventListener('ended', function () {
      filmOverlay.classList.remove('hidden');
      promoVideo.controls = false;
      if (filmFrame) filmFrame.classList.remove('controls-on');
    });

    promoVideo.addEventListener('error', function () {
      if (filmAttempted) {
        promoVideo.controls = false;
        if (filmFrame) filmFrame.classList.remove('controls-on');
        filmOverlay.classList.remove('hidden');
        toast('宣传片即将上线，敬请期待。');
      }
    });
  }

  /* ---------------- download page ---------------- */
  var relRoot = document.getElementById('release-list');
  if (relRoot) {
    fetch('/releases.json', { cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var items = (data && data.items) || [];
        if (!items.length) {
          relRoot.innerHTML =
            '<div class="empty-state"><h3>首个公开发布版筹备中</h3>' +
            '<p>当前最新内部版本 <b>0.2.142</b> 已通过安装版验收，公开发布包整理中。<br>' +
            '可先查看 <a href="/docs/quickstart.html">快速开始</a> 了解源码构建方式。</p></div>';
          return;
        }
        relRoot.innerHTML = items.map(renderRelease).join('');
      })
      .catch(function () {
        relRoot.innerHTML = '<div class="empty-state">版本清单加载失败，请稍后刷新。</div>';
      });
  }

  function fmtSize(n) {
    if (!n) return '—';
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderRelease(item) {
    var files = (item.files || [])
      .map(function (f) {
        var mirrors = (f.mirrors || [])
          .map(function (m, i) {
            return (
              ' · <a href="' + escAttr(m) + '" rel="noopener">镜像' + (i + 1) + '</a>'
            );
          })
          .join('');
        return (
          '<div class="rel-file">' +
          '<a class="btn btn-sm" href="' + escAttr(f.url) + '">下载</a>' +
          '<span class="fname">' + esc(f.name) + '</span>' +
          '<span class="fsize">' + esc(f.kind) + ' · ' + fmtSize(f.size) + '</span>' +
          mirrors +
          '<div class="sha">SHA-256&nbsp;' + esc(f.sha256) + '</div>' +
          '</div>'
        );
      })
      .join('');
    return (
      '<div class="rel-entry">' +
      '<div class="rel-head"><span class="rel-ver">v' + esc(item.version) + '</span>' +
      '<span class="rel-meta">' +
      esc(item.channel) + ' · ' + esc(item.date) + ' · ' + esc(item.platform) +
      '</span></div>' +
      (item.notes ? '<p>' + esc(item.notes) + '</p>' : '') +
      files +
      '</div>'
    );
  }
})();
