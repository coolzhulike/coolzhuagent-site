# 架构总览

coolzhuagent 是一个 Rust workspace，按「运行时 → 工具 → 编排 → 交互」分层。

## 模块地图

| 模块 | 职责 |
|---|---|
| `modules/core-runtime` | 会话运行时、权限、记忆 beads、conversation |
| `modules/llm-adapter` | Provider 适配、真实模型调用、流式输出 |
| `modules/tooling` | 工具注册、插件系统、命令路由、路径影响分析 |
| `modules/vision` | 截图、UIA、本地与远端视觉定位 |
| `modules/computer-use` | 鼠标键盘、坐标映射、输入安全控制 |
| `modules/gui-web` | 主控制台（web-console）、实时语音、浏览器桥接、微信连接 |
| `modules/gui-desktop` | 桌面控制台、桌宠、Tauri shell |
| `modules/cli`、`modules/diagnostics` | 命令行与诊断 |

## 会话回合

`ConversationRuntime::run_turn` 驱动一个回合：

1. 追加用户输入、捕获上下文快照；
2. 流式获取模型响应，记录推理与 token 用量；
3. 提取工具调用块；
4. 对每个调用：权限闸门 → pre-hook → 重判 → executor → post-hook；
5. 结果回注会话，循环直到本轮无工具调用或出错；
6. 全程发出结构化 `AgentEvent`，返回 `TurnSummary`。

## 统一工具协议

所有工具走同一协议：`ToolInvoke`（call_id/tool_name/input/caller/workspace）
→ `PermissionDecision`（AllowAuto/AllowApproved/RequireApproval/RequireConfirm/Deny）
→ `ToolOutcome`（Ok/DryRunOnly/Rejected/Timeout/Failed）+ `PermissionGateReport` 写回。

调用方来源有五种：Llm / WebUi / Cli / Mcp / Plugin——同一闸门，不因来源绕过。

## 与 Claude Code harness 的关系

两者骨架同构。详细逐项对比见[对标页](/compare.html)。
