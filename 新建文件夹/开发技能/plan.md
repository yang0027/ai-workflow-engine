---
description: 智能规划命令 - 创建、规划或更新任务（优化版）
allowed-tools: [Bash, Task, AskUserQuestion]
argument-hint: "[title]" 或 <issue-id> 或 <issue-id> "[changes]"
---

# /ccpm:plan - 智能规划命令

**Token 预算:** ~2,450 tokens (相较于 ~7,000 基线) | **减少 65%**

智能命令，用于创建新任务、规划现有任务或根据上下文更新计划。

## 模式检测

该命令有 **3 种模式**，检测清晰明确：

- **CREATE**: `plan "title" [project] [jira-ticket]` → 创建新任务并进行规划
- **PLAN**: `plan WORK-123` → 规划现有任务
- **UPDATE**: `plan WORK-123 "changes"` → 更新现有计划

## 使用方法

```bash
# 模式 1: CREATE - 新任务
/ccpm:plan "添加用户认证"
/ccpm:plan "添加暗黑模式" my-app TRAIN-456

# 模式 2: PLAN - 规划现有
/ccpm:plan PSN-27

# 模式 3: UPDATE - 更新计划
/ccpm:plan PSN-27 "也添加电子邮件通知"
/ccpm:plan PSN-27 "使用 Redis 替代内存缓存"
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

// 检测模式
let mode, issueId, title, project, jiraTicket, updateText;

if (ISSUE_ID_PATTERN.test(arg1)) {
  // 以问题 ID 开头
  issueId = arg1;
  if (arg2) {
    mode = 'update';
    updateText = arg2;
  } else {
    mode = 'plan';
  }
} else {
  // 第一个参数不是问题 ID = CREATE 模式
  mode = 'create';
  title = arg1;
  project = arg2 || null;
  jiraTicket = arg3 || null;
}

console.log(`\n🎯 模式: ${mode.toUpperCase()}`);
```

### 步骤 2A: CREATE 模式 - 创建并规划新任务

```yaml
## CREATE: 创建新任务并进行规划

1. 检测/加载项目配置：

Task(project-context-manager): `
${project ? `获取项目上下文: ${project}` : '获取活动项目上下文'}
格式: standard
包含所有部分: true
`

存储: projectId, teamId, projectLinearId, defaultLabels, externalPM config

2. 通过子代理创建 Linear 问题：

**使用 Task 工具创建新的 Linear 问题:**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: create_issue
  params:
    team: "{步骤 1 中的 team ID}"
    title: "{参数中的任务标题}"
    project: "{步骤 1 中的 project Linear ID}"
    state: "Backlog"
    labels: {步骤 1 中的默认标签}
    description: |
      ## 任务

      {任务标题}

      {如果提供了 Jira 票据: **Jira 参考**: {jiraTicket}}
      ---

      _规划进行中..._
  context:
    command: "plan"
    mode: "create"
  ```

存储: issue.id, issue.identifier (例如，PSN-30)

显示: "✅ 创建的问题: ${issue.identifier}"

3. 收集上下文（智能代理选择）：

Task: `
为: ${title} 创建实施计划

${jiraTicket ? `Jira 票据: ${jiraTicket}\n` : ''}

你的任务:
1. 如果提供了 Jira 票据，研究它和相关的 Confluence 文档
2. 分析代码库以识别需要修改的文件
3. 使用 Context7 MCP 研究最佳实践
4. 创建详细的实施检查清单（5-10 项）
5. 估计复杂性（低/中/高）
6. 识别潜在风险或挑战

提供结构化计划，包括:
- 实施检查清单（可操作的子任务）
- 需要修改的文件（附简要理由）
- 依赖关系和前提条件
- 测试方法
- 复杂性估计及其理由
`

注意: Smart-agent-selector 会根据任务类型自动选择最佳代理

4. 使用计划更新 Linear 问题：

**使用 Task 工具更新问题描述以包含计划:**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: update_issue_description
  params:
    issueId: "{步骤 2 中的问题标识符}"
    description: |
      ## 实施检查清单

      {步骤 3 中规划结果生成的检查清单}

      > **复杂性**: {步骤 3 中的复杂性} | **估计**: {步骤 3 中的估计}

      ---

      ## 任务

      {任务标题}

      {如果有 Jira 票据: **Jira**: [{jiraTicket}](url)}

      ## 需要修改的文件

      {步骤 3 中规划结果生成的文件列表}

      ## 研究与上下文

      {步骤 3 中规划结果生成的研究}

      ## 测试策略

      {步骤 3 中规划结果生成的测试策略}

      ---

      *通过 /ccpm:plan 进行规划*
  context:
    command: "plan"
  ```

5. 更新问题状态和标签：

**使用 Task 工具更新问题状态:**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: update_issue
  params:
    issueId: "{步骤 2 中的问题标识符}"
    state: "Planned"
    labels: ["planned", "ready"]
  context:
    command: "plan"
  ```

6. 显示完成：

console.log('\n═══════════════════════════════════════');
console.log('✅ 任务已创建并规划！');
console.log('═══════════════════════════════════════\n');
console.log(`📋 问题: ${issue.identifier} - ${title}`);
console.log(`🔗 ${issue.url}`);
console.log(`\n📊 计划摘要:`);
console.log(`  ✅ 创建了 ${checklistCount} 个子任务`);
console.log(`  📁 需要修改 ${filesCount} 个文件`);
console.log(`  ⚡ 复杂性: ${complexity}`);
console.log(`\n💡 下一步: /ccpm:work ${issue.identifier}`);
```

### 步骤 2B: PLAN 模式 - 规划现有任务

```yaml
## PLAN: 规划现有任务

1. 通过子代理获取问题：

**使用 Task 工具从 Linear 获取问题:**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: get_issue
  params:
    issueId: "{参数中的问题 ID}"
  context:
    cache: true
    command: "plan"
  ```

存储: issue.id, issue.title, issue.description, issue.state, issue.team

显示: "📋 规划中: ${issue.identifier} - ${issue.title}"

2. 检查是否已规划：

const hasChecklist = issue.description.includes('## 实施检查清单');
const isPlanned = issue.state.name === 'Planned' || issue.state.name === 'Ready';

if (hasChecklist && isPlanned) {
  console.log('\nℹ️  任务已经有计划。使用以下之一:');
  console.log(`  • /ccpm:plan ${issueId} "changes" - 更新计划`);
  console.log(`  • /ccpm:work ${issueId} - 开始实施`);
  return;
}

3. 从描述中提取上下文：

// 检查 Jira 参考
const jiraMatch = issue.description.match(/\*\*Jira.*?\*\*:\s*([A-Z]+-\d+)/);
const jiraTicket = jiraMatch ? jiraMatch[1] : null;

4. 收集规划上下文（智能代理选择）：

Task: `
为: ${issue.title} 创建实施计划

当前描述:
${issue.description}

${jiraTicket ? `Jira 票据: ${jiraTicket}\n` : ''}

你的任务:
1. ${jiraTicket ? '研究 Jira 票据和相关的 Confluence 文档' : '使用当前描述作为需求'}
2. 分析代码库以识别需要修改的文件
3. 使用 Context7 MCP 研究最佳实践
4. 创建详细的实施检查清单（5-10 项）
5. 估计复杂性（低/中/高）
6. 识别潜在风险

提供结构化计划，包括:
- 实施检查清单（具体、可操作的项目）
- 需要修改的文件及其理由
- 依赖关系和前提条件
- 测试策略
- 复杂性及估计
`

5. 使用计划更新问题描述：

**使用 Task 工具更新问题描述:**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: update_issue_description
  params:
    issueId: "{步骤 1 中的问题 ID}"
    description: |
      ## 实施检查清单

      {步骤 4 中规划结果生成的检查清单}

      > **复杂性**: {步骤 4 中的复杂性} | **估计**: {步骤 4 中的估计}

      ---

      {步骤 1 中的原始问题描述}

      ## 需要修改的文件

      {步骤 4 中规划结果生成的文件列表}

      ## 研究与上下文

      {步骤 4 中规划结果生成的研究}

      ## 测试策略

      {步骤 4 中规划结果生成的测试策略}

      ---

      *通过 /ccpm:plan 进行规划*
  context:
    command: "plan"
  ```

6. 更新状态和标签：

**使用 Task 工具更新问题状态:**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: update_issue
  params:
    issueId: "{步骤 1 中的问题 ID}"
    state: "Planned"
    labels: ["planned", "ready"]
  context:
    command: "plan"
  ```

7. 显示完成：

console.log('\n═══════════════════════════════════════');
console.log('✅ 规划完成！');
console.log('═══════════════════════════════════════\n');
console.log(`📋 问题: ${issueId} - ${issue.title}`);
console.log(`🔗 ${issue.url}`);
console.log(`\n📊 添加的计划:`);
console.log(`  ✅ ${checklistCount} 个子任务`);
console.log(`  📁 需要修改 ${filesCount} 个文件`);
console.log(`  ⚡ 复杂性: ${complexity}`);
console.log(`\n💡 下一步: /ccpm:work ${issueId}`);
```

### 步骤 2C: UPDATE 模式 - 更新现有计划

```yaml
## UPDATE: 更新现有计划

1. 获取当前计划：

**使用 Task 工具从 Linear 获取问题:**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: get_issue
  params:
    issueId: "{参数中的问题 ID}"
  context:
    cache: true
    command: "plan"
  ```

存储: issue 的完整描述、检查清单、状态

2. 显示当前计划摘要：

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📋 当前计划: ${issueId}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`🏷️  标题: ${issue.title}`);
console.log(`📊 状态: ${issue.state.name}`);

const checklist = issue.description.match(/- \[([ x])\] .+/g) || [];
const completed = checklist.filter(i => i.includes('[x]')).length;
console.log(`🎯 进度: ${completed}/${checklist.length} 项\n`);

if (checklist.length > 0) {
  console.log('当前检查清单:');
  checklist.slice(0, 5).forEach((item, idx) => {
    const icon = item.includes('[x]') ? '✅' : '⏳';
    const text = item.replace(/- \[([ x])\] /, '');
    console.log(`  ${icon} ${idx + 1}. ${text}`);
  });
  if (checklist.length > 5) console.log(`  ... 还有 ${checklist.length - 5} 项\n`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 更新请求');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(updateText);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

3. 分析更新请求：

// 检测变更类型
const changeType = detectChangeType(updateText);
// 返回: 'scope_change', 'approach_change', 'simplification', 'blocker', 'clarification'

4. 互动确认（如有必要）：

if (requiresClarification(changeType, updateText)) {
  const questions = generateClarificationQuestions(changeType, updateText, issue);

  AskUserQuestion({
    questions: questions  // 1-4 个针对更新的具体问题
  });

  // 使用答案来完善更新请求
}

5. 使用智能代理生成更新后的计划：

Task: `
为: ${issue.title} 更新实施计划

更新请求: ${updateText}
变更类型: ${changeType}
${clarification ? `澄清: ${JSON.stringify(clarification)}` : ''}

当前计划:
${issue.description}

你的任务:
1. 分析更新请求和当前计划
2. 确定需要更改的内容（保留/修改/添加/删除）
3. 使用 Context7 MCP 研究任何新需求
4. 相应地更新实施检查清单
5. 如有必要，调整复杂性估计
6. 记录所做的更改

提供:
- 更新后的检查清单，突出显示更改
- 变更摘要（保留/修改/添加/删除的内容）
- 如果有变化，更新复杂性
- 更改理由
`

6. 显示更改预览：

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 提议更改');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('✅ 保留:');
keptItems.forEach(i => console.log(`  • ${i}`));
console.log('\n✏️  修改:');
modifiedItems.forEach(i => console.log(`  • ${i.old} → ${i.new}`));
console.log('\n➕ 添加:');
addedItems.forEach(i => console.log(`  • ${i}`));
if (removedItems.length > 0) {
  console.log('\n❌ 移除:');
  removedItems.forEach(i => console.log(`  • ${i}`));
}

7. 确认并更新：

AskUserQuestion({
  questions: [{
    question: "将这些更改应用于计划吗？",
    header: "确认",
    multiSelect: false,
    options: [
      { label: "是的，应用更改", description: "使用上面显示的更改更新计划" },
      { label: "需要调整", description: "先完善更改" }
    ]
  }]
});

if (confirmed) {
  // 使用 Task 工具更新问题描述
  Invoke the `ccpm:linear-operations` subagent:
  - **工具**: Task
  - **子代理**: ccpm:linear-operations
  - **提示**:
    ```
    operation: update_issue_description
    params:
      issueId: "{步骤 1 中的问题 ID}"
      description: {步骤 5 中的更新描述}
    context:
      command: "plan"
      changeType: "{步骤 3 中的变更类型}"
    ```

  // 使用 Task 工具添加评论以记录更改
  Invoke the `ccpm:linear-operations` subagent:
  - **工具**: Task
  - **子代理**: ccpm:linear-operations
  - **提示**:
    ```
    operation: create_comment
    params:
      issueId: "{步骤 1 中的问题 ID}"
      body: |
        ## 📝 计划已更新

        **变更类型**: {步骤 3 中的变更类型}
        **请求**: {参数中的更新文本}

        ### 所做的更改

        {步骤 5 中的更改摘要}

        ---
        *通过 /ccpm:plan 更新*
    context:
      command: "plan"
    ```
}

8. 显示完成：

console.log('\n✅ 计划已更新！');
console.log(`📋 问题: ${issueId} - ${issue.title}`);
console.log(`🔗 ${issue.url}`);
console.log(`\n📊 更改: ${changes.added} 添加, ${changes.modified} 修改, ${changes.removed} 移除`);
console.log(`\n💡 下一步: /ccpm:work ${issueId}`);
```

### 辅助函数

```javascript
// 从更新请求中检测变更类型
function detectChangeType(text) {
  const lower = text.toLowerCase();

  if (/(add|also|include|plus|additionally)/i.test(lower)) return 'scope_change';
  if (/(instead|different|change|use.*not)/i.test(lower)) return 'approach_change';
  if (/(remove|don't need|skip|simpler)/i.test(lower)) return 'simplification';
  if (/(blocked|can't|doesn't work|issue|problem)/i.test(lower)) return 'blocker';
  return 'clarification';
}

// 从规划结果生成检查清单
function generateChecklist(plan) {
  return plan.subtasks.map(task => `- [ ] ${task}`).join('\n');
}

// 格式化文件列表
function formatFilesList(files) {
  return files.map(f => `- **${f.path}**: ${f.rationale}`).join('\n');
}

// 根据变更类型生成澄清问题
function generateClarificationQuestions(changeType, updateText, issue) {
  // 返回 1-4 个 AskUserQuestion 格式的问题
  // 基于变更类型和上下文
}
```

## 错误处理

### 无效的问题 ID 格式
```
❌ 无效的问题 ID 格式: proj123
预期格式: PROJ-123
```

### 找不到问题
```
❌ 获取问题时出错: 找不到问题

建议:
  - 验证问题 ID 是否正确
  - 检查您是否有权访问此 Linear 团队
```

### 缺少标题
```
❌ 缺少参数

用法:
  /ccpm:plan "任务标题" [project] [jira]  # 创建新任务
  /ccpm:plan WORK-123                     # 规划现有任务
  /ccpm:plan WORK-123 "changes"           # 更新计划
```

### 项目配置错误
```
❌ 无法检测到项目配置

建议:
  - 指定项目: /ccpm:plan "title" my-project
  - 配置项目: /ccpm:project:add my-project
```

## 示例

### 示例 1: CREATE 模式

```bash
/ccpm:plan "添加用户认证"

# 输出:
# 🎯 模式: CREATE
#
# ✅ 创建的问题: PSN-30
# 📋 规划中: PSN-30 - 添加用户认证
#
# [智能代理分析需求...]
#
# ═══════════════════════════════════════
# ✅ 任务已创建并规划！
# ═══════════════════════════════════════
#
# 📋 问题: PSN-30 - 添加用户认证
# 🔗 https://linear.app/.../PSN-30
#
# 📊 计划摘要:
#   ✅ 创建了 7 个子任务
#   📁 需要修改 5 个文件
#   ⚡ 复杂性: 中
#
# 💡 下一步: /ccpm:work PSN-30
```

### 示例 2: PLAN 模式

```bash
/ccpm:plan PSN-29

# 输出:
# 🎯 模式: PLAN
#
# 📋 规划中: PSN-29 - 实现暗黑模式
#
# [智能代理创建计划...]
#
# ═══════════════════════════════════════
# ✅ 规划完成！
# ═══════════════════════════════════════
#
# 📋 问题: PSN-29 - 实现暗黑模式
# 🔗 https://linear.app/.../PSN-29
#
# 📊 添加的计划:
#   ✅ 6 个子任务
#   📁 需要修改 8 个文件
#   ⚡ 复杂性: 低
#
# 💡 下一步: /ccpm:work PSN-29
```

### 示例 3: UPDATE 模式

```bash
/ccpm:plan PSN-29 "也添加电子邮件通知"

# 输出:
# 🎯 模式: UPDATE
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 当前计划: PSN-29
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# 🏷️  标题: 实现暗黑模式
# 📊 状态: 已规划
# 🎯 进度: 0/6 项
#
# [显示澄清问题...]
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📝 提议更改
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# ✅ 保留: 6 项
# ➕ 添加:
#   • 设置电子邮件服务集成
#   • 添加通知模板
#
# [确认提示...]
#
# ✅ 计划已更新！
# 📊 更改: 2 添加, 0 修改, 0 移除
```

## Token 预算分解

| 部分 | Tokens | 备注 |
|------|--------|------|
| Frontmatter & description | 100 | 最小元数据 |
| 步骤 1: 解析 & 检测模式 | 200 | 参数解析 |
| 步骤 2A: CREATE 模式 | 600 | 创建 + 规划工作流 |
| 步骤 2B: PLAN 模式 | 550 | 规划现有工作流 |
| 步骤 2C: UPDATE 模式 | 500 | 带澄清的更新工作流 |
| 辅助函数 | 150 | 可重用工具 |
| 错误处理 | 100 | 4 种错误场景 |
| 示例 | 250 | 3 个简洁示例 |
| **总计** | **~2,450** | **相较于 ~7,000 基线（减少 65%）** |

## 关键优化

1. ✅ **无路由开销** - 直接实现所有 3 种模式
2. ✅ **Linear 子代理** - 所有 Linear 操作缓存（85-95% 命中率）
3. ✅ **智能代理选择** - 自动选择最佳代理进行规划
4. ✅ **批量操作** - 单次 update_issue 调用（状态 + 标签 + 描述）
5. ✅ **简洁示例** - 仅 3 个必要示例
6. ✅ **聚焦范围** - 简化规划工作流（默认不进行全面的外部 PM 研究）

## 与其他命令的集成

- **规划后** → 使用 /ccpm:work 开始实施
- **工作中** → 使用 /ccpm:sync 保存进度
- **完成前** → 使用 /ccpm:verify 进行质量检查
- **完成** → 使用 /ccpm:done 创建 PR 并完成

## 注意事项

- **模式检测**: 清晰明确的模式（问题 ID 与引用字符串）
- **智能代理**: 根据任务类型自动选择（后端/前端/移动）
- **项目检测**: 自动检测或使用显式项目参数
- **缓存**: Linear 子代理缓存所有数据以实现 85-95% 更快的操作
- **错误恢复**: 结构化错误消息附带可操作建议