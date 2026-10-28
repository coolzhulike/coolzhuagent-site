# 权限与安全模型

## 权限闸门

所有工具调用先过 `authorize_call`：模式（ReadOnly / WorkspaceWrite / DangerFullAccess /
Prompt / Allow / Unspecified）× 配置（WorkspaceAuto / OutsideApproval / FullAccess）×
受保护规则 × 会话授权 × 路径目标。

要点：

- `Unspecified` 是 fail-closed：未知权限元数据按配置错误处理，不默放；
- 审批结果写回 `outcome.permission_gate`，executor 无法伪造；
- hook 跑过之后原审批作废重判（hook 可改变世界）。

## 桌面操作安全

- UIA 与视觉模型双通道定位元素，再执行点击；
- 安全点击路径与分辨率映射；
- 文件删除走回收站；
- 默认工程（用户目录下 `coolzhuagent`）受保护：禁止移除、删除、重命名，
  也不能通过变更父工程带走；
- 默认档以外目录写入逐次审批；完全访问需二次确认、可撤销、重启失效；
- 可选 Windows 低完整性沙箱执行。

## 数据边界

- 会话与工程数据在本机 `.coolzhu/`；
- 仅主动发起的模型调用出网；
- 运行记录按约 12 小时窗口清理；
- 子进程输出按 GBK/UTF-8 双解码处理，避免中文 Windows 乱码。
