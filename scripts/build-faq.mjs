// scripts/build-faq.mjs — 校验 FAQ 源并生成 public/faq.json + edge-functions/api/faq.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const SRC = 'data/faq.source.json';
const OUT = 'public/faq.json';
const FAQ_MODULE = 'edge-functions/api/faq.js';
const MAX_ANSWER = 800;
const MAX_QUESTION = 100;

function fail(msg) {
  console.error(`[faq] ${msg}`);
  process.exit(1);
}

function normalize(s) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

const raw = JSON.parse(await readFile(SRC, 'utf8'));
if (!Array.isArray(raw.items) || raw.items.length === 0) {
  fail('items 不能为空');
}

const ids = new Set();
const items = [];

for (const item of raw.items) {
  for (const key of ['id', 'category', 'question', 'answer']) {
    if (!normalize(item[key])) fail(`${item.id || '(no id)'} 缺少 ${key}`);
  }
  if (ids.has(item.id)) fail(`ID 重复：${item.id}`);
  ids.add(item.id);

  const question = normalize(item.question);
  const answer = normalize(item.answer);
  if (question.length > MAX_QUESTION) fail(`${item.id} question 超过 ${MAX_QUESTION} 字`);
  if (answer.length > MAX_ANSWER) fail(`${item.id} answer 超过 ${MAX_ANSWER} 字`);

  const aliases = Array.isArray(item.aliases)
    ? item.aliases.map(normalize).filter(Boolean)
    : [];
  if (aliases.length < 1) fail(`${item.id} 至少需要 1 个 alias`);
  if (aliases.length > 8) fail(`${item.id} 的 aliases 不能超过 8 个`);

  const keywords = Array.isArray(item.keywords)
    ? item.keywords.map(normalize).filter(Boolean)
    : [];
  if (keywords.length < 1) fail(`${item.id} 至少需要 1 个 keyword`);
  if (keywords.length > 10) fail(`${item.id} 的 keywords 不能超过 10 个`);

  items.push({
    id: item.id,
    category: normalize(item.category),
    question,
    aliases,
    answer,
    keywords,
    related: Array.isArray(item.related) ? item.related : [],
    enabled: item.enabled !== false,
  });
}

for (const item of items) {
  for (const rel of item.related) {
    if (!ids.has(rel)) fail(`${item.id} 的 related 不存在：${rel}`);
  }
}

if (!items.some((i) => i.enabled)) fail('没有启用的 FAQ');

const out = {
  version: raw.version || 1,
  updatedAt: raw.updatedAt || new Date().toISOString().slice(0, 10),
  site: raw.site || {},
  items: items.filter((i) => i.enabled),
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out), 'utf8');

const synonymsRaw = await readFile('data/synonyms.json', 'utf8').catch(() => '{}');
let synonyms = {};
try {
  synonyms = JSON.parse(synonymsRaw);
} catch {
  fail('data/synonyms.json 不是合法 JSON');
}
for (const [key, value] of Object.entries(synonyms)) {
  if (!Array.isArray(value)) fail(`同义词 ${key} 的值必须是数组`);
}

const bundle = { ...out, synonyms };
await mkdir(dirname(FAQ_MODULE), { recursive: true });
await writeFile(
  FAQ_MODULE,
  `// 自动生成，请勿手工修改\nexport default ${JSON.stringify(bundle)};\n`,
  'utf8'
);

const cats = [...new Set(out.items.map((i) => i.category))];
console.log(`[faq] 输出 ${out.items.length} 条，分类 ${cats.length} 个`);
console.log(`[faq] 平均答案长度 ${Math.round(out.items.reduce((n, i) => n + i.answer.length, 0) / out.items.length)} 字`);
console.log(`[faq] 已生成 ${FAQ_MODULE}`);
