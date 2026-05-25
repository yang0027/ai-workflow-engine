---
description: 智能工作命令 - 开始或恢复工作（优化版）
allowed-tools: [Bash, Task]
argument-hint: "[issue-id]"
---

# /ccpm:work - 开始或恢复工作

**Token 预算:** ~5,000 tokens (对比 ~15,000 基线) | **减少 67%**

智能命令，可检测是开始新工作还是恢复进行中的任务。

## 模式检测

- **START**: 问题状态为 Planning/Backlog/Todo/Planned → 初始化实施
- **RESUME**: 问题状态为 In Progress/In Development/Doing → 显示进度和下一步行动
- **ERROR**: 问题状态为 Done/Completed/Cancelled → 无法处理已完成的任务

## 使用方法

```bash
# 从 git 分支自动检测问题
/ccpm:work

# 明确的问题 ID
/ccpm:work PSN-29

# 示例
/ccpm:work PROJ-123     # 开始或恢复 PROJ-123
/ccpm:work              # 从分支名称 "feature/PSN-29-add-auth" 自动检测
```

## 实现

### 第一步：解析参数并检测上下文

```javascript
// 从参数或 git 分支解析问题 ID
let issueId = args[0];

if (!issueId) {
  // 尝试从 git 分支名称中提取
  const branch = await Bash('git rev-parse --abbrev-ref HEAD');
  const match = branch.match(/([A-Z]+-\d+)/);

  if (!match) {
    return error('无法检测到问题 ID。用法: /ccpm:work [ISSUE-ID]');
  }

  issueId = match[1];
  console.log(`📌 从分支检测到问题: ${issueId}`);
}

// 验证格式
if (!/^[A-Z]+-\d+$/.test(issueId)) {
  return error(`无效的问题 ID 格式: ${issueId}。预期格式: PROJ-123`);
}
```

### 第二步：通过 Linear 子代理获取问题

**使用 Task 工具从 Linear 获取问题：**

调用 `ccpm:linear-operations` 子代理，使用以下参数：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**: 使用以下确切格式：
  ```
  operation: get_issue
  params:
    issueId: "{步骤 1 中的问题 ID}"
  context:
    cache: true
    command: "work"
  ```

**将响应存储为 `issue` 对象，包含：**
- `issue.id` - 内部 Linear ID
- `issue.identifier` - 可读 ID（例如，PSN-29）
- `issue.title` - 问题标题
- `issue.description` - 带检查清单的完整描述
- `issue.state.name` - 当前状态名称
- `issue.state.id` - 状态 ID
- `issue.labels` - 标签对象数组
- `issue.team.id` - 团队 ID

**错误处理：**
```javascript
if (subagentResponse.error) {
  console.log(`❌ 获取问题时出错: ${subagentResponse.error.message}`);
  console.log('\n建议：');
  subagentResponse.error.suggestions.forEach(s => console.log(`  - ${s}`));
  return;
}

const issue = subagentResponse.issue;
```

### 第三步：检测模式

```javascript
const status = issue.state.name;

const startStatuses = ['Planning', 'Backlog', 'Todo', 'Planned', 'Not Started'];
const resumeStatuses = ['In Progress', 'In Development', 'Doing', 'Started'];
const completeStatuses = ['Done', 'Completed', 'Closed', 'Cancelled'];

let mode;
if (startStatuses.includes(status)) {
  mode = 'START';
} else if (resumeStatuses.includes(status)) {
  mode = 'RESUME';
} else if (completeStatuses.includes(status)) {
  console.log(`❌ 无法处理已完成的任务: ${issueId}`);
  console.log(`状态: ${status}`);
  console.log('\n此任务已完成。您是否想开始其他任务？');
  return;
} else {
  // 未知状态 - 默认设置为 RESUME
  mode = 'RESUME';
}

console.log(`\n🎯 模式: ${mode}`);
console.log(`📋 问题: ${issue.identifier} - ${issue.title}`);
console.log(`📊 状态: ${status}\n`);
```

### 第四步A：START 模式实现

```yaml
## START 模式: 初始化实施

1. 更新问题状态和标签（批量操作）：

**使用 Task 工具更新 Linear 问题：**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: update_issue
  params:
    issueId: "{步骤 1 中的问题 ID}"
    state: "In Progress"
    labels: ["implementation"]
  context:
    cache: true
    command: "work"
  ```

显示: "✅ 更新状态: Planning → In Progress"

2. 使用智能代理选择分析代码库：

任务: `
分析代码库以为: ${issue.title} 创建实施计划

上下文:
- 问题: ${issueId}
- 描述:
${issue.description}

您的任务:
1. 确定需要修改的文件
2. 列出所需的依赖和导入
3. 概述测试策略
4. 注意潜在的挑战或风险
5. 估计复杂性（低/中/高）

提供一个结构化的实施计划，尽可能具体到文件路径和行号。
`

注意: smart-agent-selector 钩子将自动选择最佳代理：
- backend-architect 处理 API/backend 任务
- frontend-developer 处理 UI/React 任务
- mobile-developer 处理移动任务
- 等等。

3. 存储计划并通过 Linear 子代理添加评论：

**使用 Task 工具向 Linear 添加评论：**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: create_comment
  params:
    issueId: "{步骤 1 中的问题 ID}"
    body: |
      ## 🚀 实施已开始

      **状态:** Planning → In Progress

      ### 实施计划

      {在此粘贴步骤 2 的分析结果}

      ---
      *通过 /ccpm:work 启动*
  context:
    command: "work"
  ```

显示: "✅ 已将实施计划添加到 Linear"

4. 显示下一步行动：

console.log('\n═══════════════════════════════════════');
console.log('🎯 实施已开始');
console.log('═══════════════════════════════════════\n');
console.log('📝 计划已添加到 Linear 问题');
console.log('\n💡 下一步:');
console.log('  1. 审查上述实施计划');
console.log('  2. 开始编码');
console.log('  3. 使用 /ccpm:sync 保存进度');
console.log('  4. 使用 /ccpm:verify 准备进行审查时');
console.log('\n📌 快速命令:');
console.log(`  /ccpm:sync "${issueId}" "进度更新"`);
console.log(`  /ccpm:commit "${issueId}"`);
console.log(`  /ccpm:verify "${issueId}"`);
```

### 第四步B：RESUME 模式实现

```yaml
## RESUME 模式: 显示进度和下一步行动

1. 从检查清单计算进度：

const description = issue.description || '';
const checklistItems = description.match(/- \[([ x])\] .+/g) || [];
const totalItems = checklistItems.length;
const completedItems = checklistItems.filter(item => item.includes('[x]')).length;
const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

2. 确定下一步行动：

let nextAction = null;
let suggestion = null;

if (progress === 100) {
  suggestion = '所有检查清单项已完成！准备进行验证。';
  nextAction = '/ccpm:verify';
} else {
  // 找到第一个未完成的检查清单项
  const incompleteItem = checklistItems.find(item => item.includes('[ ]'));
  if (incompleteItem) {
    const itemText = incompleteItem.replace(/- \[ \] /, '');
    nextAction = `继续工作: ${itemText}`;
  } else {
    suggestion = '未找到检查清单。继续实施。';
  }
}

3. 显示进度和建议：

console.log('\n═══════════════════════════════════════');
console.log('📊 工作进行中');
console.log('═══════════════════════════════════════\n');
console.log(`📋 问题: ${issue.identifier} - ${issue.title}`);
console.log(`📊 状态: ${issue.state.name}`);
console.log(`✅ 进度: ${progress}% (${completedItems}/${totalItems} 项)\n`);

if (checklistItems.length > 0) {
  console.log('📝 检查清单:\n');
  checklistItems.forEach(item => {
    const isComplete = item.includes('[x]');
    const icon = isComplete ? '✅' : '⏳';
    const text = item.replace(/- \[([ x])\] /, '');
    console.log(`  ${icon} ${text}`);
  });
  console.log('');
}

if (suggestion) {
  console.log(`💡 建议: ${suggestion}\n`);
}

if (nextAction) {
  console.log(`🎯 下一步行动: ${nextAction}\n`);
}

4. 互动菜单：

console.log('可用操作:');
console.log('  1. ⭐ 同步进度      - /ccpm:sync');
console.log('  2. 📝 Git 提交       - /ccpm:commit');
console.log('  3. ✅ 运行验证       - /ccpm:verify');
console.log('  4. 🔍 查看问题详情   - /ccpm:utils:status ' + issueId);
console.log('  5. 🛠️ 修复问题        - /ccpm:verification:fix ' + issueId);
console.log('\n📌 快速命令:');
console.log(`  /ccpm:sync "完成 ${itemText}"`);
console.log(`  /ccpm:commit "feat: ${issue.title.toLowerCase()}"`);

if (progress === 100) {
  console.log('\n⭐ 推荐: /ccpm:verify (检查清单已完成)');
}
```

### 第五步：互动菜单

根据模式显示菜单：

**START 模式菜单:**
```
可用操作:
  1. ⭐ 开始编码        - 开始实施
  2. 📝 同步进度       - /ccpm:sync
  3. 🔍 查看问题详情   - /ccpm:utils:status PSN-29

快速命令:
  /ccpm:sync "实现 X 功能"
  /ccpm:commit "feat: 添加用户认证"
```

**RESUME 模式菜单:**
```
可用操作:
  1. ⭐ 同步进度       - /ccpm:sync
  2. 📝 Git 提交        - /ccpm:commit
  3. ✅ 运行验证       - /ccpm:verify
  4. 🔍 查看问题详情   - /ccpm:utils:status PSN-29
  5. 🛠️ 修复问题        - /ccpm:verification:fix PSN-29

快速命令:
  /ccpm:sync "进度更新"
  /ccpm:commit
  /ccpm:verify
```

## 错误处理

### 无效的问题 ID 格式
```
❌ 无效的问题 ID 格式: proj123
预期格式: PROJ-123（大写字母，连字符，数字）
```

### 找不到问题
```
❌ 获取问题时出错: 找不到问题

建议:
  - 验证问题 ID 是否正确
  - 检查您是否有访问此 Linear 团队的权限
  - 确保问题未被删除
```

### Git 分支检测失败
```
❌ 无法从 git 分支检测到问题 ID

当前分支: main

用法: /ccpm:work [ISSUE-ID]

示例: /ccpm:work PSN-29
```

### 已完成的任务
```
❌ 无法处理已完成的任务: PSN-29
状态: Done

此任务已完成。您是否想开始其他任务？
```

### 网络错误
```
❌ 获取问题时出错: 网络请求失败

建议:
  - 检查您的互联网连接
  - 验证 Linear MCP 服务器是否正在运行
  - 稍后再试
```

## 示例

### 示例 1: 开始工作（从分支自动检测）

```bash
# 当前分支: feature/PSN-29-add-auth
/ccpm:work

# 输出:
# 📌 从分支检测到问题: PSN-29
#
# 🎯 模式: START
# 📋 问题: PSN-29 - 添加用户认证
# 📊 状态: Planning
#
# ✅ 更新状态: Planning → In Progress
#
# [智能代理分析代码库...]
#
# ✅ 已将实施计划添加到 Linear
#
# ═══════════════════════════════════════
# 🎯 实施已开始
# ═══════════════════════════════════════
#
# 📝 计划已添加到 Linear 问题
#
# 💡 下一步:
#   1. 审查上述实施计划
#   2. 开始编码
#   3. 使用 /ccpm:sync 保存进度
#   4. 使用 /ccpm:verify 准备进行审查时
```

### 示例 2: 恢复工作（明确的问题 ID）

```bash
/ccpm:work PSN-29

# 输出:
# 🎯 模式: RESUME
# 📋 问题: PSN-29 - 添加用户认证
# 📊 状态: In Progress
#
# ═══════════════════════════════════════
# 📊 工作进行中
# ═══════════════════════════════════════
#
# 📋 问题: PSN-29 - 添加用户认证
# 📊 状态: In Progress
# ✅ 进度: 60% (3/5 项)
#
# 📝 检查清单:
#
#   ✅ 创建认证端点
#   ✅ 添加 JWT 验证
#   ✅ 实现登录流程
#   ⏳ 添加密码重置
#   ⏳ 编写测试
#
# 🎯 下一步行动: 继续工作: 添加密码重置
#
# 可用操作:
#   1. ⭐ 同步进度      - /ccpm:sync
#   2. 📝 Git 提交       - /ccpm:commit
#   3. ✅ 运行验证       - /ccpm:verify
```

### 示例 3: 恢复已完成的工作（错误）

```bash
/ccpm:work PSN-28

# 输出:
# 🎯 模式: ERROR
# 📋 问题: PSN-28 - 修复导航错误
# 📊 状态: Done
#
# ❌ 无法处理已完成的任务: PSN-28
# 状态: Done
#
# 此任务已完成。您是否想开始其他任务？
```

## Token 预算分解

| 部分 | Tokens | 备注 |
|------|--------|------|
| Frontmatter & description | 100 | 最小元数据 |
| 第一步: 参数解析 | 300 | Git 检测 + 验证 |
| 第二步: 获取问题 | 400 | Linear 子代理 + 错误处理 |
| 第三步: 模式检测 | 200 | 状态检查 + 显示 |
| 第四步A: START 模式 | 1,500 | 更新 + 分析 + 评论 |
| 第四步B: RESUME 模式 | 1,000 | 进度 + 下一步行动 + 菜单 |
| 第五步: 互动菜单 | 600 | 模式特定菜单 |
| 示例 | 400 | 3 个简洁示例 |
| 错误处理 | 500 | 5 种错误场景 |
| **总计** | **~5,000** | **对比 ~15,000 基线（减少 67%）** |

## 关键优化

1. ✅ **无路由开销** - 直接实现两种模式
2. ✅ **Linear 子代理** - 所有 Linear 操作缓存（85-95% 命中率）
3. ✅ **智能代理选择** - 自动选择最佳代理进行分析
4. ✅ **批量操作** - 单次 update_issue 调用（状态 + 标签）
5. ✅ **简洁示例** - 仅 3 个必要示例
6. ✅ **聚焦范围** - START 模式简化（无完整代理发现）

## 与其他命令的集成

- **在 /ccpm:plan 之后** → 使用 /ccpm:work 开始实施
- **在工作期间** → 使用 /ccpm:sync 保存进度
- **Git 提交** → 使用 /ccpm:commit 进行常规提交
- **在完成之前** → 使用 /ccpm:verify 进行质量检查
- **完成** → 使用 /ccpm:done 创建 PR 并完成

## 注意事项

- **Git 分支检测**: 从分支名称中提取问题 ID，例如 `feature/PSN-29-add-auth`
- **智能代理选择**: 根据任务类型自动调用最佳代理
- **进度跟踪**: 从问题描述中的检查清单项计算
- **缓存**: Linear 子代理缓存问题数据，使后续操作快 85-95%
- **错误恢复**: 针对所有错误场景提供可操作的建议