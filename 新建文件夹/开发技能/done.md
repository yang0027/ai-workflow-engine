---
description: 智能完成命令 - 创建 PR，同步状态，完成任务（优化版）
allowed-tools: [Bash, Task, AskUserQuestion]
argument-hint: "[issue-id]"
---

# /ccpm:done - 完成任务

**Token 预算:** ~2,100 tokens（相比 ~6,000 基线）| **减少 65%**

完成一个已完成的任务：创建 GitHub PR，更新 Linear 状态，并可选择与外部 PM 系统同步。

## 安全规则

**请先阅读**: `commands/SAFETY_RULES.md`

- ✅ **Linear** 操作是自动的（内部跟踪）
- ✅ **GitHub** PR 创建是自动的（代码托管）
- ⛔ **Jira/Confluence/Slack** 写入需要用户确认

## 使用方法

```bash
# 从 git 分支自动检测问题
/ccpm:done

# 显式问题 ID
/ccpm:done PSN-29

# 示例
/ccpm:done PROJ-123     # 完成 PROJ-123
/ccpm:done              # 从分支 "feature/PSN-29-add-auth" 自动检测
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
    return error('无法从 git 分支检测到问题 ID。\n\n用法: /ccpm:done [ISSUE-ID]\n示例: /ccpm:done PSN-29');
  }

  issueId = match[1];
  console.log(`📌 从分支检测到问题: ${issueId}`);
}

// 验证格式
if (!/^[A-Z]+-\d+$/.test(issueId)) {
  return error(`无效的问题 ID 格式: ${issueId}. 预期: PROJ-123`);
}
```

### 第二步：预飞行安全检查

```javascript
// 1. 检查是否在主分支上
const currentBranch = await Bash('git rev-parse --abbrev-ref HEAD');

if (currentBranch === 'main' || currentBranch === 'master') {
  console.log('❌ 错误: 您在主分支上\n');
  console.log('请先切换到功能分支:');
  console.log(`  git checkout -b your-name/${issueId}-feature-name\n`);
  return;
}

// 2. 检查未提交的更改
const hasUncommitted = (await Bash('git status --porcelain')).trim().length > 0;

if (hasUncommitted) {
  const status = await Bash('git status --short');
  console.log('⚠️  您有未提交的更改\n');
  console.log(status);
  console.log('\n请先提交您的更改:');
  console.log('  /ccpm:commit\n');
  console.log('然后再次运行 /ccpm:done');
  return;
}

// 3. 检查分支是否已推送到远程
try {
  await Bash('git rev-parse @{u}', { stdio: 'ignore' });
} catch {
  console.log('⚠️  分支未推送到远程\n');
  console.log('请先推送您的分支:');
  console.log(`  git push -u origin ${currentBranch}\n`);
  console.log('然后再次运行 /ccpm:done');
  return;
}

console.log('✅ 所有预飞行检查通过！\n');
```

### 第三步：获取问题并验证完成情况

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
    command: "done"
  ```

**错误处理:**
```javascript
if (subagentResponse.error) {
  console.log(`❌ 错误: ${subagentResponse.error.message}\n`);
  subagentResponse.error.suggestions.forEach(s => console.log(`  - ${s}`));
  return;
}

const issue = subagentResponse.issue;
```

**解析检查清单并验证完成情况:**
```javascript
const description = issue.description || '';

// 查找检查清单部分（在标记之间或标题下）
const checklistMatch = description.match(
  /<!-- ccpm-checklist-start -->([\s\S]*?)<!-- ccpm-checklist-end -->/
) || description.match(/## ✅ 实施检查清单([\s\S]*?)(?=\n## |$)/);

if (checklistMatch) {
  const checklistContent = checklistMatch[1];
  const items = checklistContent.match(/- \[([ x])\] .+/g) || [];
  const total = items.length;
  const completed = items.filter(item => item.includes('[x]')).length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 100;

  if (progress < 100) {
    const incomplete = items.filter(item => item.includes('[ ]'));

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⛔ 无法完成: 检查清单不完整');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`进度: ${progress}% (${completed}/${total} 完成)\n`);
    console.log('❌ 剩余项目:');
    incomplete.forEach(item => console.log(`  ${item}`));
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 需要的操作');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('1. 完成剩余的检查清单项目');
    console.log(`2. 更新检查清单: /ccpm:utils:update-checklist ${issueId}`);
    console.log(`3. 然后运行: /ccpm:done ${issueId}\n`);
    return;
  }

  console.log(`✅ 检查清单完成: ${progress}% (${completed}/${total} 项)\n`);
}

// 检查是否有阻塞标签
const isBlocked = (issue.labels || []).some(l =>
  l.name.toLowerCase() === 'blocked'
);

if (isBlocked) {
  console.log('⚠️  任务有 "blocked" 标签\n');
  console.log('在完成之前解决阻塞问题');
  return;
}
```

### 第四步：创建 GitHub 拉取请求

```javascript
// 生成 PR 标题和描述
const prTitle = issue.title;
const prBody = `## 摘要

关闭: ${issue.identifier}

${issue.description || ''}

## 检查清单

${checklistContent || '- [x] 实施完成'}

---

Linear: ${issue.url}
`;

console.log('📝 正在创建 GitHub 拉取请求...\n');

// 使用 gh CLI 创建 PR（委托给智能代理选择器）
Task: `
创建一个 GitHub 拉取请求，详细信息如下：

标题: ${prTitle}
正文:
${prBody}

使用: gh pr create --title "${prTitle}" --body-file <(echo "${prBody}")

创建 PR 后:
1. 从输出中提取 PR URL
2. 返回 PR URL
`

console.log('✅ 拉取请求已创建\n');
```

### 第五步：提示外部系统更新

使用 AskUserQuestion 确认 Jira/Slack：

```javascript
const answers = await AskUserQuestion({
  questions: [
    {
      question: "您想将 Jira 状态更新为完成吗？",
      header: "同步 Jira",
      multiSelect: false,
      options: [
        {label: "是的，更新 Jira", description: "将 Jira 票据标记为完成"},
        {label: "不，跳过", description: "我会手动更新"}
      ]
    },
    {
      question: "您想在 Slack 中通知团队吗？",
      header: "通知团队",
      multiSelect: false,
      options: [
        {label: "是的，发送通知", description: "发布完成消息"},
        {label: "不，跳过", description: "不需要通知"}
      ]
    }
  ]
});

const updateJira = answers['同步 Jira'] === '是的，更新 Jira';
const notifySlack = answers['通知团队'] === '是的，发送通知';
```

**如果请求更新 Jira:**
```javascript
if (updateJira) {
  console.log('\n🚨 需要确认\n');
  console.log(`我将把 Jira 票据更新为状态 "完成"，并附上评论:\n`);
  console.log('---');
  console.log(`在 Linear 中完成: ${issueId}`);
  console.log(`PR: ${prUrl}`);
  console.log('---\n');
  console.log('继续吗？（输入 "yes" 以确认）');

  // 等待确认（由 external-system-safety skill 处理）
  // 然后委托给智能代理选择器进行 Jira 更新
  Task: `将 Jira 票据更新为完成状态，并添加带 PR 链接的完成评论`;
}
```

**如果请求 Slack 通知:**
```javascript
if (notifySlack) {
  console.log('\n🚨 需要确认\n');
  console.log('我将在 Slack 中发布:\n');
  console.log('---');
  console.log(`✅ ${issue.title} 已完成！`);
  console.log(`Linear: ${issue.url}`);
  console.log(`PR: ${prUrl}`);
  console.log('---\n');
  console.log('继续吗？（输入 "yes" 以确认）');

  // 等待确认（由 external-system-safety skill 处理）
  // 然后委托给智能代理选择器进行 Slack 通知
  Task: `在 Slack 中发布完成消息，附带 PR 和 Linear 链接`;
}
```

### 第六步：更新 Linear 状态（自动）

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
    labels: ["done"]
  context:
    cache: true
    command: "done"
    purpose: "标记任务为完成"
  ```

**使用 Task 工具添加完成评论：**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: create_comment
  params:
    issueId: "{步骤 1 中的问题 ID}"
    body: |
      ## 🎉 任务已完成并最终确定

      **完成时间:** {当前时间戳}

      ### 已采取的行动:
      ✅ 拉取请求已创建: {步骤 4 中的 PR URL}
      {如果更新了 Jira: ✅ Jira 状态更新为完成，否则: ⏭️ Jira 更新被跳过}
      {如果通知了 Slack: ✅ 团队已在 Slack 中通知，否则: ⏭️ Slack 通知被跳过}

      ### 最终状态:
      - Linear: 完成 ✅
      - 工作流标签已清理
      - 任务已标记为完成

      ---

      **此任务现已关闭。** 🎊
  context:
    command: "done"
  ```

**显示:**
```javascript
console.log('✅ Linear 问题已更新为完成\n');
```

### 第七步：显示最终摘要

```javascript
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🎉 任务已最终确定: ${issueId}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('✅ Linear: 更新为完成');
console.log(`✅ 拉取请求: ${prUrl}`);
console.log(`${updateJira ? '✅' : '⏭️ '} Jira: ${updateJira ? '已更新' : '已跳过'}`);
console.log(`${notifySlack ? '✅' : '⏭️ '} Slack: ${notifySlack ? '已通知' : '已跳过'}`);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 接下来做什么？');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('可用操作:');
console.log('  1. /ccpm:plan "title" - 创建新任务');
console.log('  2. /ccpm:utils:report <project> - 查看项目进度');
console.log('  3. /ccpm:utils:search <project> "query" - 查找要处理的任务');
console.log('\n🎊 干得好！任务完成。');
```

## 错误处理

### 无效的问题 ID 格式
```
❌ 无效的问题 ID 格式: proj123
预期格式: PROJ-123（大写字母，连字符，数字）
```

### Git 分支检测失败
```
❌ 无法从 git 分支检测到问题 ID

当前分支: main

用法: /ccpm:done [ISSUE-ID]
示例: /ccpm:done PSN-29
```

### 未提交的更改
```
⚠️  您有未提交的更改

M  src/api/auth.ts
?? src/tests/new-test.ts

请先提交您的更改:
  /ccpm:commit

然后再次运行 /ccpm:done
```

### 在主分支上
```
❌ 错误: 您在主分支上

请先切换到功能分支:
  git checkout -b your-name/PSN-29-feature-name
```

### 分支未推送
```
⚠️  分支未推送到远程

请先推送您的分支:
  git push -u origin feature/PSN-29-add-auth

然后再次运行 /ccpm:done
```

### 检查清单不完整
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔ 无法完成: 检查清单不完整
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

进度: 80% (4/5 完成)

❌ 剩余项目:
  - [ ] 为密码重置编写测试
```

### 任务被阻塞
```
⚠️  任务有 "blocked" 标签

在完成之前解决阻塞问题
```

## 示例

### 示例 1: 自动检测完成

```bash
# 当前分支: feature/PSN-29-add-auth
/ccpm:done

# 输出:
# 📌 从分支检测到问题: PSN-29
#
# ✅ 所有预飞行检查通过！
#
# ✅ 检查清单完成: 100% (5/5 项)
#
# 📝 正在创建 GitHub 拉取请求...
# ✅ 拉取请求已创建
#
# [AskUserQuestion for Jira/Slack]
#
# ✅ Linear 问题已更新为完成
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎉 任务已最终确定: PSN-29
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# ✅ Linear: 更新为完成
# ✅ 拉取请求: https://github.com/...
# ⏭️  Jira: 已跳过
# ⏭️  Slack: 已跳过
```

### 示例 2: 显式问题 ID 完成

```bash
/ccpm:done PSN-29

# 与示例 1 相同的流程
```

### 示例 3: 未提交更改完成（错误）

```bash
/ccpm:done PSN-29

# 输出:
# ⚠️  您有未提交的更改
#
# M  src/api/auth.ts
# ?? src/tests/new-test.ts
#
# 请先提交您的更改:
#   /ccpm:commit
#
# 然后再次运行 /ccpm:done
```

## Token 预算细分

| 部分 | Tokens | 备注 |
|---------|--------|-------|
| Frontmatter & description | 80 | 最小元数据 |
| 第一步: 参数解析 | 150 | Git 检测 + 验证 |
| 第二步: 预飞行检查 | 300 | 分支/提交/推送检查 |
| 第三步: 获取 & 验证 | 350 | Linear 子代理 + 检查清单解析 |
| 第四步: 创建 PR | 250 | 智能代理委托 |
| 第五步: 外部确认 | 200 | AskUserQuestion + 安全 |
| 第六步: 更新 Linear | 250 | 批量更新 + 评论 |
| 第七步: 最终摘要 | 150 | 显示结果 |
| 错误处理 | 220 | 6 个错误场景（简洁） |
| 示例 | 150 | 3 个基本示例 |
| **总计** | **~2,100** | **相比 ~6,000 基线（减少 65%）** |

## 关键优化

1. ✅ **无路由开销** - 直接实现（无需调用 complete:finalize）
2. ✅ **Linear 子代理** - 所有 Linear 操作均使用会话级缓存
3. ✅ **智能代理委托** - PR 创建和外部同步使用智能代理选择器
4. ✅ **预飞行检查** - 在处理之前防止常见错误
5. ✅ **批量操作** - 状态 + 标签的单次更新
6. ✅ **安全确认** - 内置于 Jira/Slack 的工作流中
7. ✅ **简洁示例** - 仅 3 个基本示例

## 与其他命令的集成

- **在 /ccpm:verify 之后** → 使用 /ccpm:done 完成
- **自动检测** → 与 /ccpm:work 基于分支的工作流配合使用
- **Git 集成** → 遵循 /ccpm:commit 以保持干净的提交
- **安全规则** → 强制外部系统确认

## 注意事项

- **Git 分支检测**: 从分支名称中提取问题 ID，如 `feature/PSN-29-add-auth`
- **预飞行检查**: 在最终确定之前验证所有先决条件
- **智能代理选择**: 自动选择 PR 和外部同步的最佳代理
- **安全第一**: Jira/Slack 更新需要明确确认
- **Linear 自动**: 内部跟踪更新自动发生
- **缓存**: Linear 子代理提供 85-95% 的缓存命中率，以加快操作速度