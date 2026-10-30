// scripts/build-docs.mjs — docs-src/*.md → public/docs/*.html（极简渲染，无依赖）
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

const SRC_DIR = 'docs-src';
const OUT_DIR = 'public/docs';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) =>
      `<a href="${esc(u)}">${t}</a>`);
}

// 极简 md → html：# 标题 / ``` 代码块 / | 表格 / - 列表 / > 引用 / 其余段落
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\s*$/.test(line)) { i++; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      const anchor = text.replace(/[^\w\u4e00-\u9fff]+/g, '-').toLowerCase();
      html.push(`<h${level + 1} id="${anchor}">${inline(text)}</h${level + 1}>`);
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${buf.map(inline).join('<br>')}</blockquote>`);
      continue;
    }
    if (/^\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      const th = head ? `<tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr>` : '';
      const tb = body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
      html.push(`<table>${th}${tb}</table>`);
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && (/^[-*]\s+/.test(lines[i]) || /^\d+\.\s+/.test(lines[i]))) {
        items.push(`<li>${inline(lines[i].replace(/^([-*]|\d+\.)\s+/, ''))}</li>`);
        i++;
      }
      html.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^---+\s*$/.test(line)) { html.push('<hr>'); i++; continue; }
    const buf = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^(#{1,4}\s|```|>\s?|\|.*\|\s*$|[-*]\s+|\d+\.\s+|---+\s*$)/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    html.push(`<p>${buf.map(inline).join('<br>')}</p>`);
  }
  return html.join('\n');
}

function titleOf(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

const FOOTER_HTML = `<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <a class="brand" href="/" aria-label="coolzhuagent 首页">
        <img class="brand-mark" src="/assets/logo.svg" alt="" width="42" height="42">
        <span class="brand-type"><b>COOLZHU</b><span>AGENT RUNTIME</span></span>
      </a>
      <p>本地优先的 Rust AI Agent 工作台。让 Agent 真正动手，让权限始终在你手里。</p>
      <span class="footer-badge"><i></i> MIT License · Windows 10/11</span>
    </div>
    <div class="footer-col">
      <h4>产品</h4>
      <a href="/features.html">能力总览</a>
      <a href="/download.html">下载 Windows 版</a>
      <a href="/changelog.html">更新记录</a>
      <a href="/compare.html">与 Claude Code 对比</a>
    </div>
    <div class="footer-col">
      <h4>资源</h4>
      <a href="/docs/quickstart.html">快速开始</a>
      <a href="/docs/architecture.html">架构总览</a>
      <a href="/docs/security-model.html">安全模型</a>
      <a href="/docs/plugins.html">插件开发</a>
    </div>
    <div class="footer-col">
      <h4>项目</h4>
      <a href="https://github.com/coolzhulike/coolzhuagent" target="_blank" rel="noopener noreferrer">GitHub 仓库</a>
      <a href="/contact.html">联系与反馈</a>
      <a href="/privacy.html">隐私说明</a>
      <a href="/#agent">Agent 对话</a>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 coolzhuagent · MIT License</span>
    <span class="notice">站点 Agent 由 AI 辅助生成回答，仅供参考；不构成价格、时效或功能承诺。</span>
  </div>
  <div class="footer-ghost" aria-hidden="true">COOLZHU</div>
</footer>`;

function page(title, body, nav) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#040807">
<meta name="description" content="${esc(title)} — coolzhuagent 文档">
<title>${esc(title)} · coolzhuagent 文档</title>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/theme.css">
</head>
<body class="docs-body">
<a class="skip-link" href="#main">跳到主要内容</a>
<header class="site-header" id="site-header">
  <div class="header-inner">
    <a class="brand" href="/" aria-label="coolzhuagent 首页">
      <img class="brand-mark" src="/assets/logo.svg" alt="" width="38" height="38">
      <span class="brand-type"><b>COOLZHU</b><span>AGENT RUNTIME</span></span>
    </a>
    <nav class="nav" id="site-nav" aria-label="主导航">
      <a href="/#capabilities">能力</a>
      <a href="/#film">宣传片</a>
      <a href="/#agent">Agent 对话</a>
      <a href="/docs/quickstart.html" class="active">文档</a>
      <a href="/download.html">下载</a>
      <a href="/compare.html">对标</a>
      <a class="nav-cta" href="/download.html">下载 Windows 版</a>
    </nav>
    <button class="nav-toggle" id="nav-toggle" type="button" aria-label="打开导航" aria-expanded="false" aria-controls="site-nav">
      <span></span>
    </button>
  </div>
</header>
<main id="main" class="docs-layout">
  <aside class="docs-nav"><h3>文档</h3>${nav}</aside>
  <div class="docs-content">
    <article>${body}</article>
    <div class="docs-footer">coolzhuagent docs · MIT License · <a href="/">返回官网</a></div>
  </div>
</main>
${FOOTER_HTML}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/assets/theme.js"></script>
</body>
</html>`;
}

await mkdir(OUT_DIR, { recursive: true });
const files = (await readdir(SRC_DIR)).filter((f) => f.endsWith('.md')).sort();
if (files.length === 0) {
  console.error('[docs] docs-src 下没有 .md 文件');
  process.exit(1);
}

const pages = [];
for (const f of files) {
  const md = await readFile(join(SRC_DIR, f), 'utf8');
  const slug = basename(f, '.md');
  const title = titleOf(md, slug);
  pages.push({ slug, title, body: mdToHtml(md) });
}

const nav = pages
  .map((p) => `<a href="/docs/${p.slug}.html" data-doc="${p.slug}">${esc(p.title)}</a>`)
  .join('\n');

for (const p of pages) {
  const navWithActive = nav.replace(
    `data-doc="${p.slug}"`,
    `data-doc="${p.slug}" class="active"`
  );
  await writeFile(join(OUT_DIR, `${p.slug}.html`), page(p.title, p.body, navWithActive, p.slug), 'utf8');
}
console.log(`[docs] 渲染 ${pages.length} 篇 → ${OUT_DIR}`);
