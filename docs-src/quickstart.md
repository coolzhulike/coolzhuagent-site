# 快速开始

coolzhuagent 是面向 Windows 的本地优先 AI Agent 工作区。本页覆盖两种上手方式。

## 方式一：安装版（推荐）

1. 在[下载页](/download.html)获取最新 MSI（当前最新 0.2.142）。
2. 用 `certutil -hashfile 文件名 SHA256` 核对下载页给出的哈希。
3. 双击安装 → 启动器首次打开显示启动动画 → 自动创建默认工程并进入主控制台。

首次启动会经历：启动动画 → 后台就绪 → 控制台显示。0.2.142 安装版实测动画出现 P95 为 5.470s。

## 方式二：源码构建

环境要求：Windows、Rust stable、PowerShell 5.1 或更高版本。

```powershell
cargo build -p coolzhu-web-console --offline
cargo run -p coolzhu-web-console -- --open
```

主控制台默认监听 `http://127.0.0.1:8765/`。注意：前端资源由 Rust 在编译期内联，
修改 `index.html`、`src/app.js`、`src/styles.css` 后必须重新构建才能看到效果。

## 第一步配置

- 打开「模型」设置：API 与订阅分栏。API 填 OpenAI 兼容端点与 Key；首批订阅支持
  Devin、OpenAI / ChatGPT。
- 打开聊天室：权限按聊天室归属，外部目录写入逐次审批。
- 常用入口：任务页（定时/后台/轨迹/电脑操作）、文件树、终端、媒体、诊断。

## 常用验证命令

```powershell
cargo test -p coolzhu-web-console --offline
cargo test -p coolzhu-computer-use-core --offline
cargo test --test module_linkage_smoke --offline
```
