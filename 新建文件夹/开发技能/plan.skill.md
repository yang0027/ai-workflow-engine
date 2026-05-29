---
name: plan
description: "智能规划命令 — 创建、规划或更新任务（CREATE / PLAN / UPDATE 三种模式）"
---

# /ccpm:plan - 智能规划命令

智能命令，用于创建新任务、规划现有任务或根据上下文更新计划。

## 模式检测 (3 种模式)

- **CREATE**: `plan "title" [project] [jira-ticket]` → 创建新任务并进行规划
- **PLAN**: `plan WORK-123` → 规划现有任务
- **UPDATE**: `plan WORK-123 "changes"` → 更新现有计划

## 使用方法

```bash
# 模式 1: CREATE
/ccpm:plan "添加用户认证"
/ccpm:plan "添加暗黑模式" my-app TRAIN-456

# 模式 2: PLAN
/ccpm:plan PSN-27

# 模式 3: UPDATE
/ccpm:plan PSN-27 "也添加电子邮件通知"
```

## 实现

### 步骤 1: 解析参数并检测模式

```javascript
const args = process.argv.slice(2);
const arg1 = args[0];
const arg2 = args[1];
const arg3 = args[2];

// 问题 ID 模式: PROJECT-NUMBER (例如，PSN-27, WORK-123)
const ISSUE_ID_PATTERN = /^[A-Z]+-\d+$/;

if (!arg1) {
  return error(`
❌ 缺少参数

用法:
  /ccpm:plan "任务标题" [project] [jira]  # 创建新任务
  /ccpm:plan WORK-123                     # 规划现有任务
  /ccpm:plan WORK-123 "changes"           # 更新计划
  `);
}

let mode, issueId, title, project, jiraTicket, updateText;

if (ISSUE_ID_PATTERN.test(arg1)) {
  issueId = arg1;
  if (arg2) { mode = 'update'; updateText = arg2; }
  else { mode = 'plan'; }
} else {
  mode = 'create';
  title = arg1;
  project = arg2 || null;
  jiraTicket = arg3 || null;
}
```

### 步骤 2A: CREATE 模式 — 创建并规划新任务

1. 检测/加载项目配置
2. 创建 Linear 问题 (通过 `ccpm:linear-operations` 子代理)
3. 收集上下文（智能代理选择，分析代码库，研究最佳实践）
4. 使用计划更新 Linear 问题描述
5. 更新问题状态和标签
6. 显示完成摘要

### 步骤 2B: PLAN 模式 — 规划现有任务

1. 从 Linear 获取问题详情
2. 检查是否已规划（避免重复）
3. 从描述中提取上下文（Jira 引用等）
4. 收集规划上下文（代码分析、最佳实践研究）
5. 使用实施计划更新问题描述
6. 更新状态为 "Planned"

### 步骤 2C: UPDATE 模式 — 更新现有计划

1. 获取当前计划详情
2. 显示当前计划摘要（标题、状态、进度、检查清单）
3. 分析更新请求（变更类型检测）
4. 必要时进行互动确认 (AskUserQuestion)
5. 生成更新后的计划
6. 显示更改预览（保留/修改/添加/删除）
7. 确认并应用更改

## 辅助函数

```javascript
function detectChangeType(text) {
  const lower = text.toLowerCase();
  if (/(add|also|include|plus|additionally)/i.test(lower)) return 'scope_change';
  if (/(instead|different|change|use.*not)/i.test(lower)) return 'approach_change';
  if (/(remove|don't need|skip|simpler)/i.test(lower)) return 'simplification';
  if (/(blocked|can't|doesn't work|issue|problem)/i.test(lower)) return 'blocker';
  return 'clarification';
}
```

## 错误处理

| 场景 | 响应 |
|------|------|
| 无效问题 ID 格式 | `❌ 预期格式: PROJ-123` |
| 找不到问题 | `❌ 验证 ID 和访问权限` |
| 缺少标题 | `❌ 显示用法说明` |
| 项目配置错误 | `❌ 指定或配置项目` |

## 工作流集成

- **规划后** → 使用 `/ccpm:work` 开始实施
- **工作中** → 使用 `/ccpm:sync` 保存进度
- **完成前** → 使用 `/ccpm:verify` 进行质量检查
- **完成** → 使用 `/ccpm:done` 创建 PR 并完成

## 注意事项

- **模式检测**: 清晰明确的模式（问题 ID vs 引用字符串）
- **智能代理**: 根据任务类型自动选择（后端/前端/移动）
- **项目检测**: 自动检测或使用显式项目参数
- **错误恢复**: 结构化错误消息附带可操作建议
