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
| `AGNES_API_KEY` | Agnes API Key；站点公共额度使用。未配置时只能走 FAQ 检索 |
| `AGNES_BASE_URL` | 默认 `https://apihub.agnes-ai.com/v1` |
| `AGNES_MODEL` | 默认 `agnes-3.0-flash` |
| `MODEL_BASE_URL` / `MODEL_API_KEY` / `MODEL_NAME` | 兼容旧配置；`AGNES_*` 未设置时回退到这些变量 |
| `MODEL_ENABLED` | 设为 `false` 可关闭模型调用，退化为纯 FAQ 检索 |
| `MODEL_TIMEOUT_MS` / `MODEL_MAX_TOKENS` | 可选，默认 12000 / 500 |
| `ALLOWED_ORIGIN` | 站点域名（免费子域名或自定义域），多个用逗号分隔 |
| `IP_HASH_SALT` | 随机 32 位，限流 IP 哈希盐 |
| `CONTACT_EMAIL` | 可选：拒答话术中的联系邮箱（留空则只引导联系页） |
| `IP_DAILY_LIMIT` / `GLOBAL_DAILY_LIMIT` | 默认 5 / 500，按 UTC+8 重置 |

KV：建命名空间 → 绑定变量名 `MY_KV`。未绑定 KV 时函数会记录错误并跳过限流（仅建议本地调试）。

### BYOK（用户自带 Agnes Key）

首页中央 Agent 窗口提供 Key 输入框：

- Key 只写入当前浏览器 `sessionStorage`，关闭标签页即失效。
- 请求通过 `X-Agnes-Key` 头传给边缘函数；函数只把它用于当次 Agnes 请求。
- 不写入 KV、不写入日志、不回显。
- 自带 Key 仍受同 IP 每日 5 次、全站每日 500 次限流保护。
- 服务端 `AGNES_API_KEY` 作为未填 Key 时的公共额度回退。

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
