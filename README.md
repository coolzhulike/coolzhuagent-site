# coolzhuagent-site

coolzhuagent 主题官网：纯静态页 + EdgeOne Makers Edge Functions（FAQ 客服）。

## 结构

```text
public/          静态站点（页面、assets、releases.json、sitemap）
docs-src/        文档 md 源 → build-docs 渲染到 public/docs/
data/            faq.source.json + synonyms.json（客服知识库）
scripts/         build-docs / build-faq / check-releases
edge-functions/  api/chat.js（FAQ 问答）、api/health.js
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
| `MODEL_BASE_URL` / `MODEL_API_KEY` / `MODEL_NAME` | OpenAI 兼容模型（可后续再加） |
| `MODEL_ENABLED` | 未配模型时设 `false`，退化为纯检索 |
| `ALLOWED_ORIGIN` | 站点域名（免费子域名或自定义域） |
| `IP_HASH_SALT` | 随机 32 位，限流 IP 哈希盐 |
| `CONTACT_EMAIL` | 拒答话术邮箱 |
| `IP_DAILY_LIMIT` / `GLOBAL_DAILY_LIMIT` | 默认 5 / 500 |

KV：建命名空间 → 绑定变量名 `MY_KV`。

## 发布版本

`public/releases.json` 是唯一版本事实源：更新版本/文件/sha256/镜像后 push 即上线。
校验：`node scripts/check-releases.mjs --network` 可抽查链接可达。

完整方案见 `C:\Users\zhupu\coolzhuagent-site-edgeone-plan.md`。
