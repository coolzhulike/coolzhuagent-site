// agent-chat.js — centered Agent console; POST /api/chat; server-side key only
(function () {
  'use strict';

  var form = document.getElementById('agent-form');
  if (!form) return;

  var COOLDOWN_MS = 3000;
  var WELCOME =
    '你好，我是 coolzhuagent 的站点 Agent。可以问我安装、七层能力、插件、权限安全、Goal 流水线、模型接入，或者直接说你想完成的任务。';

  var log = document.getElementById('agent-log');
  var input = document.getElementById('agent-input');
  var sendBtn = document.getElementById('agent-send');
  var statusEl = document.getElementById('agent-status');
  var remainingEl = document.getElementById('agent-remaining');
  var suggestions = document.getElementById('agent-suggestions');
  var resetBtn = document.getElementById('agent-reset');
  var engineEl = document.getElementById('agent-engine');
  var toastEl = document.getElementById('toast');

  var busy = false;
  var lastSend = 0;
  var requestSeq = 0;
  var currentController = null;
  var toastTimer = null;

  /* ---------------- tiny safe renderer ---------------- */

  function safeHref(url) {
    var value = String(url || '').trim();
    if (/^https?:\/\//i.test(value)) return value;
    if (/^\/(?!\/)/.test(value)) return value;
    return '';
  }

  function appendLink(parent, label, url) {
    var href = safeHref(url);
    if (!href) {
      parent.appendChild(document.createTextNode(label));
      return;
    }
    var a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (/^https?:\/\//i.test(href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    parent.appendChild(a);
  }

  function appendInline(parent, text) {
    var re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\)|https?:\/\/[^\s<>()]+|\/(?:docs|download|features|compare|changelog|privacy|contact|#)[^\s<>()]*)/g;
    var source = String(text == null ? '' : text);
    var last = 0;
    var match;

    while ((match = re.exec(source))) {
      if (match.index > last) {
        parent.appendChild(document.createTextNode(source.slice(last, match.index)));
      }
      var token = match[0];

      if (token.slice(0, 2) === '**' && token.slice(-2) === '**') {
        var strong = document.createElement('strong');
        appendInline(strong, token.slice(2, -2));
        parent.appendChild(strong);
      } else if (token.charAt(0) === '`' && token.slice(-1) === '`') {
        var code = document.createElement('code');
        code.textContent = token.slice(1, -1);
        parent.appendChild(code);
      } else if (token.charAt(0) === '[') {
        var link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
        if (link) appendLink(parent, link[1], link[2]);
        else parent.appendChild(document.createTextNode(token));
      } else {
        var url = token;
        var trailing = '';
        while (/[.,;:!?，。；：！？]$/.test(url)) {
          trailing = url.slice(-1) + trailing;
          url = url.slice(0, -1);
        }
        appendLink(parent, url, url);
        if (trailing) parent.appendChild(document.createTextNode(trailing));
      }

      last = match.index + token.length;
    }

    if (last < source.length) {
      parent.appendChild(document.createTextNode(source.slice(last)));
    }
  }

  function renderRich(container, text) {
    var source = String(text == null ? '' : text).replace(/\r\n/g, '\n').trim();
    if (!source) return;

    var lines = source.split('\n');
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }

      if (/^\s*[-*•]\s+/.test(line)) {
        var ul = document.createElement('ul');
        while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
          var li = document.createElement('li');
          appendInline(li, lines[i].replace(/^\s*[-*•]\s+/, ''));
          ul.appendChild(li);
          i++;
        }
        container.appendChild(ul);
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        var ol = document.createElement('ol');
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          var oli = document.createElement('li');
          appendInline(oli, lines[i].replace(/^\s*\d+[.)]\s+/, ''));
          ol.appendChild(oli);
          i++;
        }
        container.appendChild(ol);
        continue;
      }

      var p = document.createElement('p');
      var buf = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^\s*[-*•]\s+/.test(lines[i]) &&
        !/^\s*\d+[.)]\s+/.test(lines[i])
      ) {
        buf.push(lines[i]);
        i++;
      }
      for (var j = 0; j < buf.length; j++) {
        if (j) p.appendChild(document.createElement('br'));
        appendInline(p, buf[j]);
      }
      container.appendChild(p);
    }
  }

  /* ---------------- messages ---------------- */

  function scrollLog() {
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function setRemaining(value) {
    if (!remainingEl) return;
    if (typeof value !== 'number') {
      remainingEl.textContent = '';
      return;
    }
    remainingEl.textContent = value > 0 ? '今日剩余 ' + value + ' 次' : '今日额度已用完';
  }

  function setEngine(engine, model) {
    if (!engineEl) return;
    var isFaq = engine === 'faq';
    engineEl.classList.toggle('faq', isFaq);
    engineEl.textContent = '';
    var dot = document.createElement('span');
    dot.className = 'dot';
    engineEl.appendChild(dot);
    engineEl.appendChild(
      document.createTextNode(isFaq ? 'FAQ RETRIEVAL' : 'AGNES 3.0 FLASH')
    );
    engineEl.title = isFaq
      ? 'FAQ retrieval'
      : 'Model: ' + (model || 'agnes-3.0-flash');
  }

  function toast(message) {
    if (toastEl) {
      toastEl.textContent = message;
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toastEl.classList.remove('show');
      }, 2600);
    } else {
      setStatus(message);
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
      return;
    }
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
    } catch (err) {}
    area.remove();
  }

  function addMessage(role, text, opts) {
    opts = opts || {};
    var msg = document.createElement('div');
    msg.className = 'msg ' + role;

    var avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    if (role === 'bot') {
      var img = document.createElement('img');
      img.src = '/assets/logo.svg';
      img.alt = '';
      img.width = 22;
      img.height = 22;
      avatar.appendChild(img);
    } else {
      avatar.textContent = 'YOU';
    }

    var main = document.createElement('div');
    main.className = 'msg-main';

    var head = document.createElement('div');
    head.className = 'msg-head';
    var name = document.createElement('b');
    name.textContent = role === 'bot' ? 'COOLZHU AGENT' : 'YOU';
    var time = document.createElement('span');
    time.textContent = opts.time || '刚刚';
    head.appendChild(name);
    head.appendChild(time);

    var bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (opts.typing) {
      var typing = document.createElement('span');
      typing.className = 'typing';
      for (var t = 0; t < 3; t++) typing.appendChild(document.createElement('i'));
      bubble.appendChild(typing);
    } else if (opts.plain) {
      var plain = document.createElement('p');
      plain.textContent = String(text == null ? '' : text);
      bubble.appendChild(plain);
    } else {
      renderRich(bubble, text);
    }

    main.appendChild(head);
    main.appendChild(bubble);

    if (role === 'bot') {
      var meta = document.createElement('div');
      meta.className = 'msg-meta';
      var source = document.createElement('span');
      source.className = 'msg-source';
      source.textContent = opts.source || 'SITE FAQ';
      var note = document.createElement('span');
      note.textContent = opts.note || 'AI 辅助回答，仅供参考';
      meta.appendChild(source);
      meta.appendChild(note);

      if (!opts.typing && text) {
        var actions = document.createElement('span');
        actions.className = 'msg-actions';
        var copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'msg-copy';
        copy.textContent = '复制';
        copy.addEventListener('click', function () {
          copyText(String(text));
          copy.textContent = '已复制';
          setTimeout(function () {
            copy.textContent = '复制';
          }, 1500);
        });
        actions.appendChild(copy);
        meta.appendChild(actions);
      }

      main.appendChild(meta);
    }

    msg.appendChild(avatar);
    msg.appendChild(main);
    if (log) log.appendChild(msg);
    scrollLog();

    return { root: msg, bubble: bubble, main: main };
  }

  /* ---------------- chat actions ---------------- */

  function autoResize() {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }

  function resetChat() {
    requestSeq++;
    if (currentController) {
      try {
        currentController.abort();
      } catch (err) {}
      currentController = null;
    }
    busy = false;
    lastSend = 0;

    if (log) log.textContent = '';
    addMessage('bot', WELCOME, {
      source: 'SITE FAQ',
      note: '站点知识库 · 仅供参考',
    });
    if (suggestions) suggestions.classList.remove('hidden');
    if (sendBtn) sendBtn.disabled = false;
    setStatus('准备就绪 · 同一 IP 每日 5 次');
    setRemaining(undefined);
    setEngine('faq');
    if (input) {
      input.value = '';
      autoResize();
      input.focus();
    }
  }

  function send() {
    if (!input || busy) return;
    var question = input.value.trim();
    if (!question) return;

    if (question.length > 200) {
      setStatus('问题不能超过 200 字');
      return;
    }

    var now = Date.now();
    if (now - lastSend < COOLDOWN_MS) {
      setStatus('请稍候 ' + Math.ceil((COOLDOWN_MS - (now - lastSend)) / 1000) + ' 秒再发送');
      return;
    }

    lastSend = now;
    var seq = ++requestSeq;
    busy = true;
    if (sendBtn) sendBtn.disabled = true;
    if (suggestions) suggestions.classList.add('hidden');

    addMessage('user', question, { plain: true });
    input.value = '';
    autoResize();
    setStatus('Agent 正在思考…');

    var typing = addMessage('bot', '', {
      typing: true,
      source: 'THINKING',
      note: '正在生成回答',
    });

    var headers = { 'Content-Type': 'application/json' };

    var controller = null;
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      currentController = controller;
    }

    var options = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ question: question, page: location.pathname }),
    };
    if (controller) options.signal = controller.signal;

    fetch('/api/chat', options)
      .then(function (response) {
        return response.text().then(function (raw) {
          var data;
          try {
            data = JSON.parse(raw);
          } catch (err) {
            data = {
              ok: false,
              error: 'bad_response',
              message: '服务返回异常，请稍后再试。',
            };
          }
          return { status: response.status, data: data };
        });
      })
      .then(function (result) {
        if (seq !== requestSeq) return;
        if (typing.root.parentNode) typing.root.remove();

        var data = result.data || {};

        if (result.status === 429) {
          addMessage('bot', data.message || '今天的咨询次数已用完，请明天再来。', {
            source: 'RATE LIMIT',
            note: '每日限额',
          });
          setRemaining(0);
          setStatus('今日额度已用完 · 明天再来');
          return;
        }

        if (result.status === 401) {
          addMessage('bot', '服务端模型凭据异常，请稍后再试。', {
            source: 'SYSTEM',
            note: '服务不可用',
          });
          setStatus('服务暂时不可用，请稍后再试');
          return;
        }

        if (!data.ok) {
          addMessage('bot', data.message || '服务暂时不可用，请稍后再试。', {
            source: 'SYSTEM',
            note: '请求未完成',
          });
          setStatus('请求未完成，请稍后再试');
          return;
        }

        var engine = data.engine === 'agnes' ? 'agnes' : 'faq';
        setEngine(engine, data.model);

        var source = 'AGNES 3.0 FLASH';
        var note = 'AI 辅助回答，仅供参考';
        if (engine === 'faq') {
          note = '基于站点 FAQ 检索';
          if (data.source === 'faq') source = 'FAQ · ' + (data.faqId || 'MATCH');
          else if (data.source === 'fallback') source = 'FAQ 兜底';
          else source = 'SITE FAQ';
        }

        addMessage('bot', data.answer || '暂时没有拿到回答，请换一种问法。', {
          source: source,
          note: note,
        });

        if (typeof data.remaining === 'number') setRemaining(data.remaining);
        if (data.source === 'fallback') setStatus('模型暂不可用，已使用 FAQ 兜底');
        else if (data.source === 'refusal') setStatus('未命中 FAQ，可换一种问法');
        else setStatus('回答完成');
      })
      .catch(function (err) {
        if (seq !== requestSeq) return;
        if (typing.root.parentNode) typing.root.remove();
        if (err && err.name === 'AbortError') return;
        addMessage('bot', '网络异常，请稍后再试。', {
          source: 'SYSTEM',
          note: '连接失败',
        });
        setStatus('网络异常，请检查连接');
      })
      .finally(function () {
        if (seq !== requestSeq) return;
        busy = false;
        if (sendBtn) sendBtn.disabled = false;
        currentController = null;
        if (input) input.focus();
      });
  }

  /* ---------------- events ---------------- */

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    send();
  });

  if (input) {
    input.addEventListener('input', autoResize);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        send();
      }
    });
  }

  if (suggestions) {
    suggestions.addEventListener('click', function (event) {
      var button = event.target && event.target.closest
        ? event.target.closest('.suggestion')
        : null;
      if (!button) return;
      if (input) {
        input.value = button.getAttribute('data-q') || button.textContent || '';
        autoResize();
        input.focus();
      }
      send();
    });
  }

  if (resetBtn) resetBtn.addEventListener('click', resetChat);

  autoResize();
})();
