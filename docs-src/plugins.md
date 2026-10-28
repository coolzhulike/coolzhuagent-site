# 插件与技能

## 插件系统

plugin-system 管理插件全生命周期：

- **manifest**：声明元数据、权限、工具清单、命令清单；
- **类型**：内置（bundled）与外部（external），统一进 InstalledRegistry；
- **安装**：`install_transaction` 原子事务——来源与兼容校验、失败可回滚；
- **权限**：插件声明的权限与运行时权限闸门是两个层次，互不替代。

## 内置插件（9 个）

| 插件 | 用途 |
|---|---|
| tdd-runner | 测试驱动开发流程 |
| git-workflow | Git 分支/提交工作流 |
| code-review | 代码评审 |
| orchestrator | 多 Agent 编排 |
| docgen | 文档生成 |
| db-tools | 数据库工具 |
| debug-diag | 调试诊断 |
| monitor | 监控 |
| marketplace | 插件市场 |

插件源码在 `.coolzhu/plugins/` 下的 Cargo workspace 成员 crate。

## 技能（Skill）

技能是更轻的能力单元：支持创建、安装、按会话启用。Superpowers 技能包
按固定版本安装，默认禁用，需要时在会话中启用。

## 开发一个插件（要点）

1. 在 `.coolzhu/plugins/` 建 crate，声明 `Plugin` trait 实现与 manifest；
2. 声明所需权限与工具清单；
3. 经市场或本地安装事务安装；
4. 权限闸门照常生效——插件不获得豁免。
