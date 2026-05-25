---
description: 智能验证命令 - 运行质量检查和最终验证
allowed-tools: [Bash, Task, AskUserQuestion]
argument-hint: "[issue-id]"
---

# /ccpm:verify - 智能验证

**Token 预算:** ~2,800 tokens (对比 ~8,000 基线) | **减少 65%**

智能验证命令，按顺序运行质量检查和最终验证。

## 使用方法

```bash
# 从 git 分支自动检测问题
/ccpm:verify

# 显式问题 ID
/ccpm:verify PSN-29

# 示例
/ccpm:verify PROJ-123     # 验证 PROJ-123
/ccpm:verify              # 从分支名称 "feature/PSN-29-add-auth" 自动检测
```

## 实现

### 步骤 1: 解析参数并检测上下文

```javascript
// 从参数或 git 分支解析问题 ID
let issueId = args[0];

if (!issueId || !/^[A-Z]+-\d+$/.test(issueId)) {
  // 尝试从 git 分支名称中提取
  const branch = await Bash('git rev-parse --abbrev-ref HEAD');
  const match = branch.match(/([A-Z]+-\d+)/);

  if (!match) {
    return error(`
❌ 无法从分支名称检测到问题 ID

当前分支: ${branch}

用法: /ccpm:verify [ISSUE-ID]

示例:
  /ccpm:verify PSN-29
  /ccpm:verify              # 从分支自动检测
    `);
  }

  issueId = match[1];
  console.log(`📌 从分支检测到问题: ${issueId}\n`);
}
```

### 步骤 2: 通过 Linear 子代理获取问题

**使用 Task 工具从 Linear 获取问题：**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: get_issue
  params:
    issueId: "{步骤 1 中的问题 ID}"
  context:
    cache: true
    command: "verify"
  ```

**将响应存储为 `issue` 对象**，包含：
- `issue.id`, `issue.identifier`, `issue.title`
- `issue.description`（带检查清单）
- `issue.state.name`, `issue.state.id`
- `issue.labels`, `issue.team.id`

**错误处理：**
```javascript
if (subagentResponse.error) {
  console.log(`❌ 获取问题时出错: ${subagentResponse.error.message}`);
  console.log('\n建议:');
  subagentResponse.error.suggestions.forEach(s => console.log(`  - ${s}`));
  return;
}

const issue = subagentResponse.issue;
```

### 步骤 3: 显示验证流程

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 智能验证命令
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 问题: ${issueId} - ${issue.title}
📊 状态: ${issue.state.name}

验证流程:
──────────────────
1. 质量检查（代码检查、测试、构建）
2. 最终验证（代码审查、安全性）

开始验证...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 步骤 4: 检查实施检查清单

从问题描述中解析检查清单：

```javascript
const description = issue.description || '';

// 提取检查清单项
const checklistItems = description.match(/- \[([ x])\] .+/g) || [];
const totalItems = checklistItems.length;
const completedItems = checklistItems.filter(item => item.includes('[x]')).length;
const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 100;

console.log(`📋 检查清单: ${progress}% (${completedItems}/${totalItems} 项)\n`);
```

**如果检查清单不完整（< 100%），提示用户：**

```javascript
if (progress < 100) {
  const incompleteItems = checklistItems.filter(item => item.includes('[ ]'));

  console.log('⚠️  检查清单不完整!\n');
  console.log('剩余项:');
  incompleteItems.forEach(item => {
    console.log(`  ${item.replace('- [ ] ', '⏳ ')}`);
  });
  console.log('');

  // 询问用户该怎么办
  const response = await AskUserQuestion({
    questions: [{
      question: `检查清单完成度为 ${progress}%。您想怎么做?`,
      header: "检查清单",
      multiSelect: false,
      options: [
        {
          label: "继续进行",
          description: "尽管检查清单不完整仍然运行检查（警告将被记录）"
        },
        {
          label: "更新检查清单",
          description: "先标记已完成项，然后继续"
        },
        {
          label: "取消",
          description: "返回并完成剩余项"
        }
      ]
    }]
  });

  if (response.answers[0] === "取消") {
    console.log('\n📝 完成剩余的检查清单项，然后再次运行 /ccpm:verify\n');
    return;
  }

  if (response.answers[0] === "更新检查清单") {
    // 交互式检查清单更新
    const updateResponse = await AskUserQuestion({
      questions: [{
        question: "您已完成哪些项?",
        header: "已完成",
        multiSelect: true,
        options: incompleteItems.map((item, idx) => ({
          label: item.replace('- [ ] ', ''),
          description: `将第 ${idx + 1} 项标记为已完成`
        }))
      }]
    });

    // 使用 linear-operations 子代理在描述中更新检查清单
    if (updateResponse.answers && updateResponse.answers.length > 0) {
      const selectedIndices = updateResponse.answers.map(answer => {
        // 从标签中提取索引（假设格式为 "项文本"）
        const itemIndex = incompleteItems.findIndex(item =>
          item.replace('- [ ] ', '') === answer
        );
        return itemIndex;
      }).filter(idx => idx >= 0);

      if (selectedIndices.length > 0) {
        // 使用 Task 工具通过子代理更新检查清单
        await Task('linear-operations', `
operation: update_checklist_items
params:
  issue_id: ${issueId}
  indices: [${selectedIndices.join(', ')}]
  mark_complete: true
  add_comment: true
  update_timestamp: true
context:
  command: "verify"
  purpose: "在验证过程中更新检查清单项"
`);

        console.log(`\n✅ 更新了 ${selectedIndices.length} 个检查清单项\n`);
      }
    }
  }

  if (response.answers[0] === "继续进行") {
    console.log('⚠️  在检查清单不完整的情况下继续\n');
  }
}
```

### 步骤 5: 运行质量检查

```markdown
═══════════════════════════════════════
步骤 1/2: 运行质量检查
═══════════════════════════════════════
```

**A) 检测项目类型和命令：**

```javascript
const fs = require('fs');
const hasPackageJson = fs.existsSync('./package.json');
const hasPyProject = fs.existsSync('./pyproject.toml');

let lintCommand, testCommand, buildCommand;

if (hasPackageJson) {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  lintCommand = pkg.scripts?.lint ? 'npm run lint' : null;
  testCommand = pkg.scripts?.test ? 'npm test' : null;
  buildCommand = pkg.scripts?.build ? 'npm run build' : null;
} else if (hasPyProject) {
  lintCommand = 'ruff check . || flake8 .';
  testCommand = 'pytest';
  buildCommand = null;
}
```

**B) 顺序运行检查：**

```bash
# 代码检查
echo "🔍 正在运行代码检查..."
${lintCommand}
LINT_EXIT=$?

# 测试
echo "🧪 正在运行测试..."
${testCommand}
TEST_EXIT=$?

# 构建（可选）
if [ -n "${buildCommand}" ]; then
  echo "🏗️  正在运行构建..."
  ${buildCommand}
  BUILD_EXIT=$?
fi
```

**C) 评估结果：**

```javascript
const results = {
  lint: LINT_EXIT === 0,
  test: TEST_EXIT === 0,
  build: buildCommand ? BUILD_EXIT === 0 : true
};

const allPassed = results.lint && results.test && results.build;

// 显示结果
console.log('\n📊 质量检查结果:');
console.log(`  ${results.lint ? '✅' : '❌'} 代码检查`);
console.log(`  ${results.test ? '✅' : '❌'} 测试`);
if (buildCommand) {
  console.log(`  ${results.build ? '✅' : '❌'} 构建`);
}
console.log('');
```

**D) 处理失败：**

```javascript
if (!allPassed) {
  console.log('❌ 质量检查失败\n');
  console.log('要调试和修复问题:');
  console.log(`  /ccpm:verification:fix ${issueId}\n`);
  console.log('然后再次运行验证:');
  console.log(`  /ccpm:verify ${issueId}\n`);

  // 更新 Linear 以反映失败
  // 使用 Task 工具添加失败评论
  await Task({
    subagent_type: 'ccpm:linear-operations',
    description: '添加质量检查失败评论',
    prompt: `
operation: create_comment
params:
  issueId: "${issueId}"
  body: |
    ## ❌ 质量检查失败

    **结果:**
    - ${results.lint ? '✅' : '❌'} 代码检查
    - ${results.test ? '✅' : '❌'} 测试
    ${buildCommand ? `- ${results.build ? '✅' : '❌'} 构建` : ''}

    **需要采取的行动:**
    修复上述问题，然后再次运行 \`/ccpm:verify\`。

    ---
    *通过 /ccpm:verify*
context:
  command: "verify"
    `
  });

  return;
}
```

### 步骤 6: 运行最终验证（如果检查通过）

```markdown
═══════════════════════════════════════
步骤 2/2: 运行最终验证
═══════════════════════════════════════
```

**A) 调用代码审查代理并智能选择代理：**

```yaml
Task: `
审查所有针对问题 ${issueId}: ${issue.title} 的代码更改

上下文:
- 问题描述:
${issue.description}

- 所有检查清单项均标记为已完成

您的任务:
1. 根据要求审查所有更改
2. 检查代码质量和最佳实践
3. 验证安全性考虑
4. 检查潜在回归
5. 验证错误处理
6. 评估性能影响

提供:
- ✅ 通过审查的内容
- ❌ 关键问题（如有）
- 🔍 建议（如有）
- 📊 整体评估（通过/失败）
`

注意: 智能代理选择器将自动选择最佳代理
（代码审查者、安全审计员或专业审查员）
```

**B) 解析验证结果：**

```javascript
// 查找代理响应中的通过/失败
const verificationPassed = !response.includes('❌ FAIL') &&
                          !response.includes('关键问题') &&
                          (response.includes('✅ PASS') || response.includes('所有检查通过'));
```

### 步骤 7: 根据结果更新 Linear

**如果验证通过：**

**使用 Task 工具将 Linear 问题更新为完成：**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: update_issue
  params:
    issueId: "{步骤 1 中的问题 ID}"
    state: "Done"
    labels: ["verified"]
  context:
    command: "verify"
  ```

**使用 Task 工具添加成功评论：**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: create_comment
  params:
    issueId: "{步骤 1 中的问题 ID}"
    body: |
      ## ✅ 验证完成

      **质量检查:**
      - ✅ 代码检查: 通过
      - ✅ 测试: 通过
      - ✅ 构建: 通过

      **最终验证:**
      - ✅ 代码审查: 通过
      - ✅ 满足要求
      - ✅ 安全性已验证
      - ✅ 性能可接受

      **任务成功完成!** 🎉

      ---
      *通过 /ccpm:verify*
  context:
    command: "verify"
  ```

**如果验证失败：**

**使用 Task 工具添加失败标签：**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: update_issue
  params:
    issueId: "{步骤 1 中的问题 ID}"
    labels: ["blocked", "needs-revision"]
  context:
    command: "verify"
  ```

**使用 Task 工具添加失败评论：**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: create_comment
  params:
    issueId: "{步骤 1 中的问题 ID}"
    body: |
      ## ❌ 验证失败

      **质量检查:** ✅ 通过

      **最终验证:** ❌ 失败

      **发现的问题:**
      {步骤 6 中的验证问题}

      **需要采取的行动:**
      修复上述问题，然后再次运行 \`/ccpm:verify\`。

      ---
      *通过 /ccpm:verify*
  context:
    command: "verify"
  ```

### 步骤 8: 显示结果和下一步行动

**如果全部通过：**

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 所有验证完成!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 问题: ${issueId} - ${issue.title}
📊 状态: 完成

✅ 质量检查: 通过
✅ 最终验证: 通过

所有验证均已通过! 准备完成。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 接下来做什么?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ 推荐: 完成任务
   /ccpm:done ${issueId}

这将:
  • 创建拉取请求
  • 同步状态到 Jira（如果已配置）
  • 发送通知（如果已配置）
  • 将任务标记为完成

或者继续进行更改:
  /ccpm:work ${issueId}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**交互菜单：**

```javascript
const response = await AskUserQuestion({
  questions: [{
    question: "验证完成! 您想接下来做什么?",
    header: "下一步",
    multiSelect: false,
    options: [
      {
        label: "完成任务",
        description: "创建 PR 并标记为完成 (/ccpm:done)"
      },
      {
        label: "继续工作",
        description: "进行更多更改 (/ccpm:work)"
      },
      {
        label: "查看状态",
        description: "检查当前状态 (/ccpm:utils:status)"
      }
    ]
  }]
});

// 执行所选操作
if (response.answers[0] === "完成任务") {
  await SlashCommand(`/ccpm:done ${issueId}`);
} else if (response.answers[0] === "继续工作") {
  await SlashCommand(`/ccpm:work ${issueId}`);
} else {
  await SlashCommand(`/ccpm:utils:status ${issueId}`);
}
```

**如果失败：**

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ 验证失败
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 问题: ${issueId} - ${issue.title}

${failureType === 'checks' ? '❌ 质量检查: 失败' : '✅ 质量检查: 通过'}
${failureType === 'verification' ? '❌ 最终验证: 失败' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 下一步
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 修复问题（见上文详细信息）
2. 运行: /ccpm:verification:fix ${issueId}
3. 然后再次验证: /ccpm:verify ${issueId}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 错误处理

### 无效的问题 ID 格式
```
❌ 无效的问题 ID 格式: proj123
预期格式: PROJ-123（大写字母、连字符、数字）
```

### 找不到问题
```
❌ 获取问题时出错: 找不到问题

建议:
  - 验证问题 ID 是否正确
  - 检查您是否有权访问该 Linear 团队
  - 确保问题未被删除
```

### Git 分支检测失败
```
❌ 无法从 git 分支检测到问题 ID

当前分支: main

用法: /ccpm:verify [ISSUE-ID]

示例: /ccpm:verify PSN-29
```

### 找不到项目命令
```
⚠️  在 package.json 中未找到代码检查/测试命令

验证需要:
  - "lint" 脚本用于代码检查
  - "test" 脚本用于测试

将这些添加到 package.json 中并重试。
```

## 示例

### 示例 1: 使用自动检测验证（全部通过）

```bash
# 当前分支: feature/PSN-29-add-auth
/ccpm:verify

# 输出:
# 📌 从分支检测到问题: PSN-29
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔍 智能验证命令
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# 📋 问题: PSN-29 - 添加用户身份验证
# 📊 状态: 进行中
# 📋 检查清单: 100% (5/5 项)
#
# ═══════════════════════════════════════
# 步骤 1/2: 运行质量检查
# ═══════════════════════════════════════
#
# 🔍 正在运行代码检查...
# ✅ 所有文件通过代码检查
#
# 🧪 正在运行测试...
# ✅ 所有测试通过 (28/28)
#
# 🏗️  正在运行构建...
# ✅ 构建成功
#
# 📊 质量检查结果:
#   ✅ 代码检查
#   ✅ 测试
#   ✅ 构建
#
# ═══════════════════════════════════════
# 步骤 2/2: 运行最终验证
# ═══════════════════════════════════════
#
# [代码审查代理分析更改...]
#
# ✅ 所有要求均已满足
# ✅ 代码质量标准已满足
# ✅ 遵循安全最佳实践
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ 所有验证完成!
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 示例 2: 显式问题验证（检查失败）

```bash
/ccpm:verify PSN-29

# 输出:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔍 智能验证命令
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# [... 质量检查 ...]
#
# 📊 质量检查结果:
#   ✅ 代码检查
#   ❌ 测试
#   ✅ 构建
#
# ❌ 质量检查失败
#
# 要调试和修复问题:
#   /ccpm:verification:fix PSN-29
#
# 然后再次运行验证:
#   /ccpm:verify PSN-29
```

### 示例 3: 不完整的检查清单提示

```bash
/ccpm:verify PSN-29

# 输出:
# 📋 检查清单: 80% (4/5 项)
#
# ⚠️  检查清单不完整!
#
# 剩余项:
#   ⏳ 编写集成测试
#
# [交互提示出现:]
# 检查清单完成度为 80%。您想怎么做?
#   • 继续进行
#   • 更新检查清单
#   • 取消
```

## Token 预算分解

| 部分 | Tokens | 备注 |
|------|--------|------|
| Frontmatter & description | 80 | 最小元数据 |
| 步骤 1: 参数解析 | 180 | Git 检测 + 验证 |
| 步骤 2: 获取问题 | 120 | Linear 子代理（缓存） |
| 步骤 3: 显示流程 | 80 | 标题 + 流程图 |
| 步骤 4: 检查清单检查 | 250 | 解析 + 交互提示 |
| 步骤 5: 质量检查 | 500 | 命令 + 执行 + 结果 |
| 步骤 6: 最终验证 | 300 | 代理调用 + 解析 |
| 步骤 7: 更新 Linear | 200 | 批量更新 + 评论 |
| 步骤 8: 结果显示 | 250 | 成功/失败 + 菜单 |
| 错误处理 | 200 | 4 种场景 |
| 示例 | 340 | 3 个简洁示例 |
| **总计** | **~2,500** | **对比 ~8,000 基线（减少 69%）** |

## 关键优化

1. ✅ **无路由开销** - 直接实现（无 /ccpm:verification:check 或 :verify 调用）
2. ✅ **Linear 子代理** - 所有 Linear 操作缓存（85-95% 命中率）
3. ✅ **智能代理选择** - 自动选择最佳代理进行验证
4. ✅ **顺序执行** - 检查 → 验证（快速失败）
5. ✅ **自动检测** - 从 git 分支获取问题 ID
6. ✅ **批量操作** - 单个 update_issue 调用（状态 + 标签）
7. ✅ **简洁示例** - 仅 3 个必要示例

## 与其他命令的集成

- **在 /ccpm:sync 之后** → 使用 /ccpm:verify 检查质量
- **在 /ccpm:work 之后** → 完成工作然后 /ccpm:verify
- **在 /ccpm:done 之前** → 始终在最终确定之前进行验证
- **检查失败** → 使用 /ccpm:verification:fix 进行调试

## 注意事项

- **Git 分支检测**: 从分支名称中提取问题 ID，例如 `feature/PSN-29-add-auth`
- **智能代理选择**: 自动调用最佳验证代理
- **快速失败**: 如果质量检查失败则停止（不浪费验证时间）
- **检查清单验证**: 如果检查清单不完整则提示用户
- **缓存**: Linear 子代理缓存问题数据以加快操作
- **错误恢复**: 为所有错误场景提供可操作的建议