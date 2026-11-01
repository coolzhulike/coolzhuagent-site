# coolzhuagent-site

coolzhuagent 主题官网：纯静态页 + EdgeOne Makers Edge Functions（站点 Agent 对话）。

## 结构

```text
public/          静态站点（页面、assets、releases.json、sitemap）
docs-src/        文档 md 源 → build-docs 渲染到 public/docs/
data/            faq.source.json + synonyms.json（Agent 知识库）
scripts/         build-docs / build-faq / check-releases
edge-functions/  api/chat.js（FAQ + Agnes）、api/health.js
```

## 本地

```powershell
npm run build          # 渲染 docs + 校验 FAQ + 校验 releases
npx serve public       # 本地预览
edgeone makers dev     # 本地连函数一起跑（需 EdgeOne CLI）
```

## 部署

EdgeOne Makers：构建命令 `npm run build`，输出目录 `public`，函数目录 `edge-functions`。

必需环境变量（控制台 → 项目 → 设置）：

| 变量 | 说明 |
|---|---|
| `AGNES_API_KEY` | Agnes API Key，仅服务端使用；不下发浏览器。未配置时只能走 FAQ 检索 |
| `AGNES_BASE_URL` | 默认 `https://apihub.agnes-ai.com/v1` |
| `AGNES_MODEL` | 默认 `agnes-3.0-flash` |
| `MODEL_BASE_URL` / `MODEL_API_KEY` / `MODEL_NAME` | 兼容旧配置；`AGNES_*` 未设置时回退到这些变量 |
| `MODEL_ENABLED` | 设为 `false` 可关闭模型调用，退化为纯 FAQ 检索 |
| `MODEL_TIMEOUT_MS` / `MODEL_MAX_TOKENS` | 可选，默认 12000 / 500 |
| `ALLOWED_ORIGIN` | 可选：额外可信来源，多个用逗号分隔；同源始终允许，`*` 会被忽略 |
| `IP_HASH_SALT` | 随机字符串，限流 IP 哈希盐；更换后当日配额重新计数 |
| `CONTACT_EMAIL` | 可选：拒答话术中的联系邮箱（留空则只引导联系页） |
| `IP_DAILY_LIMIT` / `GLOBAL_DAILY_LIMIT` | 默认 5 / 500，按 UTC+8 重置 |

限流存储：使用 EdgeOne Blob（首次写入时平台自动创建命名空间，无需在控制台手动绑定）。每次请求写入一个唯一标记，再用强一致 `list` 统计当日标记数；被拒绝的请求会清理自己的标记。这样并发突发时不会超发（可能少放行，fail closed）。**存储不可用或读写失败时函数会拒绝请求**，避免端点失去限流保护。

### 安全与反滥用

- **Key 只在服务端**：`AGNES_API_KEY` 仅存在于 EdgeOne 边缘函数环境变量，浏览器不接触、不存储、不传输。
- **同源校验**：`/api/chat` 只接受同源请求；`ALLOWED_ORIGIN` 可额外放行可信来源，`*` 不再生效。
- **字段白名单**：请求体只允许 `question` 与 `page`，拒绝 `messages`、`model`、`stream` 等通用 Chat Completions 字段，避免被当作 sub2api 反代。
- **输入边界**：问题 ≤200 字，请求体 ≤4KB，仅接受 `application/json`。
- **限流**：同 IP 每日 5 次、全站每日 500 次，按 UTC+8 重置；Blob 唯一标记 + 强一致计数，限流存储不可用时拒绝服务。
- **错误脱敏**：上游模型错误只记录状态码，不回传响应体；日志不记录问题原文、原始 IP、API Key。
- **密钥轮换**：如怀疑泄露，在控制台更新 `AGNES_API_KEY` 并重新部署；旧 Key 立即失效。

### 宣传片

首页视频位已经预留：

1. 将正片放到 `public/assets/promo.mp4`（H.264 / AAC，16:9）。
2. 封面背景为 `public/assets/promo-poster.svg`；标题与说明在 `index.html` 的 `.film-overlay` 中，可直接改文案。
3. 社交分享图使用 `public/assets/og-image.svg`，改标题时同步更新。
4. 正片加载前点击播放会提示「即将上线」；加载成功后播放、显示原生控制条并自动隐藏封面层。

## 发布版本

`public/releases.json` 是唯一版本事实源：更新版本/文件/sha256/镜像后 push 即上线。
校验：`node scripts/check-releases.mjs --network` 可抽查链接可达。

## 站点域名

当前部署：`https://coolzhuagent-site-dpf2vj3ilcui.edgeone.dev`。
`public/sitemap.xml`、`public/robots.txt` 中的域名按实际自定义域更新。

完整方案见 `C:\Users\zhupu\coolzhuagent-site-edgeone-plan.md`。
