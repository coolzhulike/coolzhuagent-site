# Goal 模式（多阶段任务）

Goal 模式把大任务拆成四个角色的流水线，每阶段产出可验证。

## 四个角色

```text
commander（指挥官）→ planner（规划）→ implementer（执行）→ verifier（验证）
```

- **commander**：审视任务意图与约束，决定是否立项；
- **planner**：产出分步计划与验收条件；
- **implementer**：逐步执行，产物落盘；
- **verifier**：确定性门（FilesExist / Command）逐条验收。

## 失败回退链

- implementer 受阻 → 回 planner 重新规划；
- verifier 门不通过 → 回 implementer 重改（携带原因与证据）；
- `retry_count` 有上限，预算不因回退而重置；
- 普通 handoff 防环不误拒合法的 Goal 恢复交接。

## 什么时候用

适合「结果可验证」的长任务：写一组文件、完成一个功能并跑通测试、
产出报告并校验关键字段。闲聊与一次性问答不需要 Goal。

## 前端入口

任务链与任务卡片在主控制台任务页：`refreshOpenGoalTaskChain` /
`openGoalTaskChain` / 阶段卡片显示 commander→verifier 各阶段状态与交接摘要。
