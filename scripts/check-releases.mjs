// scripts/check-releases.mjs — 校验 public/releases.json 结构；--network 时抽查链接
import { readFile } from 'node:fs/promises';

const FILE = 'public/releases.json';
const withNetwork = process.argv.includes('--network');
const skipNetwork = process.argv.includes('--skip-network') || !withNetwork;

function fail(msg) {
  console.error(`[releases] ${msg}`);
  process.exit(1);
}

const raw = JSON.parse(await readFile(FILE, 'utf8'));
if (typeof raw.latest !== 'string' || !raw.latest) fail('缺少 latest');
if (!Array.isArray(raw.items)) fail('items 必须是数组');

const versions = new Set();
for (const item of raw.items) {
  if (!/^\d+\.\d+\.\d+$/.test(item.version || '')) fail(`version 非 semver：${item.version}`);
  if (versions.has(item.version)) fail(`version 重复：${item.version}`);
  versions.add(item.version);
  for (const k of ['channel', 'date', 'platform']) {
    if (!item[k]) fail(`${item.version} 缺少 ${k}`);
  }
  if (!Array.isArray(item.files)) fail(`${item.version} 缺少 files 数组`);
  for (const f of item.files) {
    for (const k of ['name', 'kind', 'size', 'sha256', 'url']) {
      if (f[k] === undefined || f[k] === null || f[k] === '') fail(`${item.version}/${f.name || '?'} 缺少 ${k}`);
    }
    if (!/^[0-9a-f]{64}$/i.test(f.sha256)) fail(`${item.version}/${f.name} sha256 不是 64 位 hex`);
    if (!/^https:\/\/|^\/releases\//.test(f.url)) fail(`${item.version}/${f.name} url 必须是 https 或 /releases/`);
    if (!Number.isInteger(f.size) || f.size <= 0) fail(`${item.version}/${f.name} size 非法`);
    if (f.mirrors && !Array.isArray(f.mirrors)) fail(`${item.version}/${f.name} mirrors 必须是数组`);
  }
}

if (raw.items.length && !versions.has(raw.latest)) {
  fail(`latest=${raw.latest} 不在 items 中`);
}
if (!raw.items.length) {
  console.log('[releases] items 为空（预览态），结构合法');
}

if (!skipNetwork) {
  for (const item of raw.items) {
    for (const f of item.files) {
      if (!f.url.startsWith('https://')) continue;
      try {
        const res = await fetch(f.url, { method: 'HEAD', redirect: 'follow' });
        console.log(`[releases] HEAD ${f.name} → ${res.status}`);
        if (!res.ok) fail(`${f.name} 链接 ${res.status}`);
      } catch (e) {
        fail(`${f.name} HEAD 失败：${e.message}`);
      }
    }
  }
}
console.log(`[releases] 校验通过：latest=${raw.latest}，${raw.items.length} 个版本`);
