// theme.js — 顶栏当前页高亮 + 下载页 releases.json 渲染
(function () {
  var path = location.pathname;
  document.querySelectorAll('.topnav a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === path || (href !== '/' && path.startsWith(href))) a.classList.add('active');
    if (path === '/' && href === '/') a.classList.add('active');
  });

  // 下载页：渲染 releases.json
  var relRoot = document.getElementById('release-list');
  if (relRoot) {
    fetch('/releases.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
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
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
  }
  function renderRelease(item) {
    var files = (item.files || []).map(function (f) {
      var mirrors = (f.mirrors || []).map(function (m, i) {
        return ' · <a href="' + esc(m) + '" rel="noopener">镜像' + (i + 1) + '</a>';
      }).join('');
      return '<div class="rel-file">' +
        '<a class="button" href="' + esc(f.url) + '">下载</a>' +
        '<span class="fname">' + esc(f.name) + '</span>' +
        '<span class="fsize">' + esc(f.kind) + ' · ' + fmtSize(f.size) + '</span>' +
        mirrors +
        '<div class="sha">SHA-256&nbsp;' + esc(f.sha256) + '</div>' +
        '</div>';
    }).join('');
    return '<div class="rel-entry">' +
      '<div class="rel-head"><span class="rel-ver">v' + esc(item.version) + '</span>' +
      '<span class="rel-meta">' + esc(item.channel) + ' · ' + esc(item.date) + ' · ' + esc(item.platform) + '</span></div>' +
      (item.notes ? '<p>' + esc(item.notes) + '</p>' : '') + files + '</div>';
  }
})();
