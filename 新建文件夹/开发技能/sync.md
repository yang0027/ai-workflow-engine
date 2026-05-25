---
description: 智能同步命令 - 将进度保存到 Linear（自动检测任务）
allowed-tools: [Bash, Task, AskUserQuestion]
argument-hint: "[issue-id] [summary]"
---

# /ccpm:sync - 智能进度同步

**Token 预算:** ~2,100 tokens (对比 ~6,000 基线) | **减少 65%**

自动检测 git 分支中的问题，并通过智能检查表更新将进度同步到 Linear。

## 用法

```bash
# 从 git 分支自动检测问题
/ccpm:sync

# 显式问题 ID
/ccpm:sync PSN-29

# 带自定义摘要
/ccpm:sync PSN-29 "完成身份验证实现"

# 自动检测并带摘要
/ccpm:sync "完成 UI 组件"
```

## 实现

### 第 1 步：解析参数并检测问题

```javascript
const args = process.argv.slice(2);
let issueId = args[0];
let summary = args[1];

// 问题 ID 验证模式
const ISSUE_ID_PATTERN = /^[A-Z]+-\d+$/;

// 如果第一个参数看起来像摘要（不是问题 ID），则视为摘要
if (args[0] && !ISSUE_ID_PATTERN.test(args[0])) {
  summary = args[0];
  issueId = null;
}

// 如果没有问题 ID，则从 git 分支自动检测
if (!issueId) {
  console.log("🔍 从 git 分支自动检测问题...");

  const branch = await Bash('git rev-parse --abbrev-ref HEAD');
  const match = branch.match(/([A-Z]+-\d+)/);

  if (!match) {
    return error(`
❌ 无法从分支名称检测问题 ID

当前分支: ${branch}

用法: /ccpm:sync [ISSUE-ID] [summary]

示例:
  /ccpm:sync PSN-29
  /ccpm:sync PSN-29 "完成功能 X"
  /ccpm:sync "在身份验证上取得进展"
    `);
  }

  issueId = match[1];
  console.log(`✅ 检测到问题: ${issueId}\n`);
}

// 验证问题 ID 格式
if (!ISSUE_ID_PATTERN.test(issueId)) {
  return error(`无效的问题 ID: ${issueId}. 预期格式: PROJ-123`);
}
```

### 第 2 步：检测 Git 更改

使用 Bash 并行运行：

```bash
# 一次性获取所有 git 信息
git status --porcelain && echo "---" && \
git diff --stat HEAD && echo "---" && \
git diff --cached --stat && echo "---" && \
git rev-parse --abbrev-ref HEAD
```

解析输出以提取：
- 更改的文件 (M, A, D, R, ??)
- 每个文件的插入/删除
- 已暂存与未暂存的更改
- 当前分支名称

```javascript
const changes = {
  modified: [],
  added: [],
  deleted: [],
  renamed: [],
  insertions: 0,
  deletions: 0
};

// 解析 git status 输出
// M  = modified, A = added, D = deleted, R = renamed, ?? = untracked
lines.forEach(line => {
  const [status, file] = line.trim().split(/\s+/);
  if (status === 'M') changes.modified.push(file);
  else if (status === 'A' || status === '??') changes.added.push(file);
  else if (status === 'D') changes.deleted.push(file);
  else if (status === 'R') changes.renamed.push(file);
});
```

### 第 3 步：通过 Linear 子代理获取问题

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
    command: "sync"
  ```

存储响应内容，包括：
- issue.id, issue.identifier, issue.title
- issue.description（带检查表）
- issue.state, issue.labels
- issue.comments（用于最后的同步时间戳）

### 第 4 步：自动生成摘要（如果未提供）

如果未提供摘要，则从 git 更改生成：

```javascript
if (!summary && changes.modified.length + changes.added.length > 0) {
  const parts = [];

  if (changes.modified.length > 0) {
    parts.push(`更新了 ${changes.modified.length} 个文件`);
  }
  if (changes.added.length > 0) {
    parts.push(`添加了 ${changes.added.length} 个新文件`);
  }
  if (changes.deleted.length > 0) {
    parts.push(`删除了 ${changes.deleted.length} 个文件`);
  }

  summary = parts.join(', ') || '进行中';
}
```

### 第 5 步：智能检查表分析（AI 驱动）

从问题描述中提取未选中的项目：

```javascript
const checklistItems = issue.description.match(/- \[ \] (.+)/g) || [];
const uncheckedItems = checklistItems.map((item, idx) => ({
  index: idx,
  text: item.replace('- [ ] ', ''),
  score: 0
}));
```

**根据 git 更改对每个项目进行评分：**

```javascript
uncheckedItems.forEach(item => {
  const keywords = extractKeywords(item.text);

  // 文件路径匹配（30 分）
  changes.modified.concat(changes.added).forEach(file => {
    if (keywords.some(kw => file.toLowerCase().includes(kw))) {
      item.score += 30;
    }
  });

  // 文件名精确匹配（40 分）
  if (changes.modified.some(f => matchesPattern(f, item.text))) {
    item.score += 40;
  }

  // 大更改（10-20 分）
  const totalLines = changes.insertions + changes.deletions;
  if (totalLines > 50) item.score += 10;
  if (totalLines > 100) item.score += 20;
});

// 按信心分类
const highConfidence = uncheckedItems.filter(i => i.score >= 50);
const mediumConfidence = uncheckedItems.filter(i => i.score >= 30 && i.score < 50);
```

### 第 6 步：交互式检查表更新

使用 AskUserQuestion 确认建议的项目：

```javascript
AskUserQuestion({
  questions: [
    {
      question: "您完成了哪些检查表项目？（AI 建议已预选）",
      header: "已完成",
      multiSelect: true,
      options: uncheckedItems.map(item => ({
        label: `${item.index}: ${item.text}`,
        description: item.score >= 50
          ? "🤖 建议 - 高信心"
          : item.score >= 30
          ? "💡 可能匹配"
          : "标记为完成"
      }))
    }
  ]
});
```

### 第 7 步：构建进度报告

```markdown
## 🔄 进度同步

**时间戳**: ${new Date().toISOString()}
**分支**: ${branchName}

### 📝 摘要
${summary}

### 📊 代码更改
**更改的文件**: ${totalFiles} (+${changes.insertions}, -${changes.deletions})

**已修改**:
${changes.modified.slice(0, 5).map(f => `- ${f}`).join('\n')}
${changes.modified.length > 5 ? `\n... 以及 ${changes.modified.length - 5} 个更多` : ''}

**新文件**:
${changes.added.slice(0, 3).map(f => `- ${f}`).join('\n')}

### 📋 检查表已更新
${completedItems.length > 0 ? `
**本次会话已完成**:
${completedItems.map(i => `- ✅ ${i.text}`).join('\n')}
` : '没有检查表更新'}

---
*通过 /ccpm:sync 同步*
```

### 第 8 步：更新 Linear 问题

**A) 更新描述中的检查表：**

**使用 Task 工具更新检查表：**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: update_checklist_items
  params:
    issue_id: "{步骤 1 中的问题 ID}"
    indices: [{已完成项目索引列表，来自步骤 6}]
    mark_complete: true
    add_comment: false  # 我们将单独添加完整的进度报告
    update_timestamp: true
  context:
    command: "sync"
    purpose: "根据 git 更改标记已完成的检查表项目"
  ```

**注意**: 此操作使用共享检查表助手（`_shared-checklist-helpers.md`）进行一致的解析和更新。它将：
- 使用标记注释或标题检测解析检查表
- 更新指定的索引（标记为完成）
- 重新计算进度百分比
- 使用时间戳更新进度行
- 返回带有前后进度的结构化结果

**B) 添加进度评论：**

**使用 Task 工具添加进度评论：**

调用 `ccpm:linear-operations` 子代理：
- **工具**: Task
- **子代理**: ccpm:linear-operations
- **提示**:
  ```
  operation: create_comment
  params:
    issueId: "{步骤 1 中的问题 ID}"
    body: |
      {步骤 7 中的进度报告}
  context:
    command: "sync"
  ```

### 第 9 步：显示确认和后续操作

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 进度已同步到 Linear!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 问题: ${issueId} - ${issue.title}
🔗 ${issue.url}

📝 已同步:
  ✅ ${totalFiles} 个文件已更改
  ✅ ${completedItems.length} 个检查表项目已更新
  💬 添加了进度评论

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 后续操作
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ⭐ 继续工作
2. 📝 提交更改       /ccpm:commit
3. ✅ 运行验证     /ccpm:verify
4. 🔍 查看状态          /ccpm:utils:status ${issueId}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 快速同步模式（手动摘要）

如果用户提供摘要参数，则跳过交互模式：

1. 跳过检查表 AI 分析
2. 跳过 AskUserQuestion
3. 直接使用提供的摘要
4. 创建简单的进度评论
5. 不进行自动检查表更新

**示例：**
```bash
/ccpm:sync PSN-29 "完成身份验证实现，所有测试通过"
```

**输出：**
```
✅ 快速同步完成！
💬 评论已添加到 Linear
📊 摘要: "完成身份验证实现，所有测试通过"
```

## 错误处理

### 无效的问题 ID
```
❌ 无效的问题 ID 格式: proj123
预期格式: PROJ-123
```

### 没有 Git 更改
```
ℹ️  未检测到未提交的更改

您仍然可以使用手动摘要同步进度：
  /ccpm:sync PSN-29 "更新文档"
```

### 分支检测失败
```
❌ 无法从分支检测问题 ID

当前分支: main

用法: /ccpm:sync [ISSUE-ID]
示例: /ccpm:sync PSN-29
```

## 示例

### 示例 1: 自动检测更改

```bash
# 分支: feature/PSN-29-add-auth
/ccpm:sync

# 输出:
# 🔍 从 git 分支自动检测问题...
# ✅ 检测到问题: PSN-29
#
# 📊 检测到更改:
# 已修改: 3 个文件 (+127, -45)
#
# 🤖 AI 建议:
# ✅ 0: 实现 JWT 身份验证（高信心）
# ✅ 2: 添加登录表单（高信心）
#
# [交互式检查表更新...]
#
# ✅ 进度已同步到 Linear!
```

### 示例 2: 带摘要的快速同步

```bash
/ccpm:sync PSN-29 "完成身份验证模块重构"

# 输出:
# ✅ 快速同步完成！
# 💬 评论已添加到 Linear
```

### 示例 3: 摘要仅（自动检测问题）

```bash
# 分支: feature/PSN-29-add-auth
/ccpm:sync "完成 UI 组件，测试通过"

# 输出:
# ✅ 检测到问题: PSN-29
# ✅ 快速同步完成！
```

## Token 预算明细

| 部分 | Tokens | 备注 |
|---------|--------|-------|
| Frontmatter & description | 80 | 最小元数据 |
| 第 1 步: 参数解析 | 250 | Git 检测 + 验证 |
| 第 2 步: Git 更改 | 200 | 并行 bash 执行 |
| 第 3 步: 获取问题 | 150 | Linear 子代理（缓存） |
| 第 4 步: 自动摘要 | 100 | 简单生成逻辑 |
| 第 5 步: AI 检查表分析 | 300 | 评分算法 |
| 第 6 步: 交互式更新 | 200 | AskUserQuestion |
| 第 7 步: 构建报告 | 200 | Markdown 生成 |
| 第 8 步: 更新 Linear | 200 | 子代理批量操作 |
| 第 9 步: 确认 | 150 | 后续操作菜单 |
| 快速同步模式 | 100 | 手动摘要路径 |
| 错误处理 | 100 | 4 种场景 |
| 示例 | 270 | 3 个简洁示例 |
| **总计** | **~2,100** | **对比 ~6,000 基线（减少 65%）** |

## 关键优化

1. ✅ **Linear 子代理** - 所有 Linear 操作缓存（85-95% 命中率）
2. ✅ **并行 git 操作** - 单个 bash 调用获取所有 git 信息
3. ✅ **无路由开销** - 直接实现（无 /ccpm:implementation:sync 调用）
4. ✅ **智能默认** - 根据更改自动生成摘要
5. ✅ **快速同步模式** - 提供摘要时跳过交互
6. ✅ **批量更新** - 单个子代理调用更新描述 + 评论

## 与其他命令的集成

- **工作期间** → 使用 `/ccpm:sync` 保存进度
- **同步后** → 使用 `/ccpm:commit` 进行 git 提交
- **完成前** → 使用 `/ccpm:verify` 进行质量检查
- **恢复工作** → 使用 `/ccpm:work` 继续

## 注意事项

- **Git 检测**: 从分支名称提取问题 ID，例如 `feature/PSN-29-add-auth`
- **AI 建议**: 分析 git 更改以预选已完成的检查表项目
- **缓存**: Linear 子代理缓存问题数据以加快操作
- **灵活性**: 可以有参数或没有参数，适应上下文
