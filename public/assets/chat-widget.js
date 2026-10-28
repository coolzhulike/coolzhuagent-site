// chat-widget.js — FAQ 悬浮客服；POST /api/chat；textContent 渲染防注入
(function () {
  var COOLDOWN_MS = 3000;
  var lastSend = 0;

  var fab = document.createElement('button');
  fab.className = 'cw-fab';
  fab.setAttribute('aria-label', '打开 FAQ 客服');
  fab.textContent = '💬';

  var panel = document.createElement('div');
  panel.className = 'cw-panel';
  panel.innerHTML =
    '<div class="cw-head"><span>FAQ 客服<small>基于本站知识库 · AI 辅助</small></span>' +
    '<button class="cw-close" aria-label="关闭">×</button></div>' +
    '<div class="cw-log"></div>' +
    '<div class="cw-status"></div>' +
    '<div class="cw-input"><input type="text" maxlength="200" placeholder="输入问题（200 字内）…" />' +
    '<button type="button">发送</button></div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var log = panel.querySelector('.cw-log');
  var status = panel.querySelector('.cw-status');
  var input = panel.querySelector('input');
  var sendBtn = panel.querySelector('.cw-input button');

  fab.addEventListener('click', function () {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && !log.children.length) {
      addMsg('bot', '你好，我是 coolzhuagent 的 FAQ 助手。可以问我安装、功能、插件、安全相关的问题。', 'hint');
    }
  });
  panel.querySelector('.cw-close').addEventListener('click', function () {
    panel.classList.remove('open');
  });

  function addMsg(who, text, src) {
    var div = document.createElement('div');
    div.className = 'cw-msg ' + who;
    div.textContent = text; // 关键：textContent 渲染，防注入
    if (src) {
      var s = document.createElement('span');
      s.className = 'src';
      s.textContent = src;
      div.appendChild(s);
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function setStatus(t) { status.textContent = t || ''; }

  function send() {
    var q = input.value.trim();
    if (!q) return;
    var now = Date.now();
    if (now - lastSend < COOLDOWN_MS) { setStatus('请稍候再发送…'); return; }
    lastSend = now;
    input.value = '';
    addMsg('user', q);
    sendBtn.disabled = true;
    setStatus('正在查询…');
    var thinking = addMsg('bot', '…');

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, page: location.pathname }),
    })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        var d = res.d;
        thinking.remove();
        if (res.status === 429) {
          addMsg('bot', d.message || '今天的咨询次数已用完，请明天再来。');
          setStatus('');
          return;
        }
        if (!d.ok) {
          addMsg('bot', '服务暂时不可用，请稍后再试。');
          setStatus('');
          return;
        }
        var tag = d.faqId ? ('来源 ' + d.faqId) : (d.source === 'refusal' ? '未命中 FAQ' : '');
        addMsg('bot', d.answer, tag);
        setStatus(typeof d.remaining === 'number' ? '今日剩余 ' + d.remaining + ' 次' : '');
      })
      .catch(function () {
        thinking.remove();
        addMsg('bot', '网络异常，请稍后再试。');
        setStatus('');
      })
      .finally(function () { sendBtn.disabled = false; input.focus(); });
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.isComposing) send();
  });
})();
