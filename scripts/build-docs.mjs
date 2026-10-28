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

function page(title, body, nav, current) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="description" content="${esc(title)} — coolzhuagent 文档">
<title>${esc(title)} · coolzhuagent 文档</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23050b0a'/%3E%3Cpath d='M18 18h28v8H27v12h19v8H18z' fill='%2377e6ad'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/assets/theme.css">
</head>
<body class="docs-body">
<header class="topbar"><a class="brand" href="/">COOLZHU<span>AGENT</span></a>
<nav class="topnav"><a href="/features.html">特性</a><a href="/docs/quickstart.html" class="active">文档</a><a href="/download.html">下载</a><a href="/compare.html">对标</a></nav>
</header>
<div class="docs-layout">
<aside class="docs-nav"><h3>文档</h3>${nav}</aside>
<main class="docs-content"><article>${body}</article>
<footer class="site-footer"><a href="/docs/quickstart.html">文档首页</a> · <a href="/privacy.html">隐私</a> · <a href="/contact.html">联系</a></footer>
</main>
</div>
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
