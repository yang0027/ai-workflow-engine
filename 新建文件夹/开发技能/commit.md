---
description: 智能 git 提交，集成 Linear 和传统提交格式
allowed-tools: [Bash, LinearMCP]
argument-hint: "[issue-id] [message]"
---

# 智能提交命令

您正在执行 **智能 git 提交命令**，该命令与 Linear 集成并遵循传统提交格式。

## 🚨 重要：安全规则

**请先阅读**: ``$CCPM_COMMANDS_DIR/SAFETY_RULES.md``

此命令执行 **git 操作**，这些操作是本地且安全的。不会对外部 PM 系统进行写入。

## 传统提交格式

此命令遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**类型**：
- `feat`: 新功能
- `fix`: 修复错误
- `docs`: 文档更改
- `style`: 代码风格更改（格式化等）
- `refactor`: 代码重构
- `test`: 添加或更新测试
- `chore`: 维护任务

## 实现

### 第一步：确定问题 ID

```javascript
const args = process.argv.slice(2)
let issueId = args[0]
let userMessage = args[1]

const ISSUE_ID_PATTERN = /^[A-Z]+-\d+$/

// 如果第一个参数看起来不像问题 ID，可能是消息
if (args[0] && !ISSUE_ID_PATTERN.test(args[0])) {
  userMessage = args[0]
  issueId = null
}

// 尝试从 git 分支中检测问题 ID
if (!issueId) {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8'
    }).trim()

    const branchMatch = branch.match(/([A-Z]+-\d+)/)
    if (branchMatch) {
      issueId = branchMatch[1]
      console.log(`🔍 从分支检测到问题: ${issueId}`)
    }
  } catch (error) {
    // 不在 git 仓库中或分支检测失败
    console.log("ℹ️  无法从分支检测到问题")
  }
}
```

### 第二步：检查未提交的更改

```bash
# 获取状态
git status --porcelain

# 检查是否有更改需要提交
if [ -z "$(git status --porcelain)" ]; then
  echo "✅ 没有更改需要提交（工作树干净）"
  exit 0
fi
```

### 第三步：显示更改摘要

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 智能提交命令
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${issueId ? `📋 问题: ${issueId}` : ''}

📊 要提交的更改：
────────────────────

${changedFiles.map((file, i) => `  ${i+1}. ${file.status} ${file.path}`).join('\n')}

📈 总计: ${changedFiles.length} 个文件已更改

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 第四步：获取问题上下文（如果问题 ID 可用）

如果问题 ID 可用，从 Linear 获取上下文：

```javascript
let issueTitle = null
let issueType = null

if (issueId) {
  try {
    const issue = await linear_get_issue(issueId)
    issueTitle = issue.title
    issueType = detectIssueType(issue)

    console.log(`📋 问题: ${issueId} - ${issueTitle}`)
    console.log("")
  } catch (error) {
    console.log(`⚠️  无法从 Linear 获取问题 ${issueId}`)
    console.log("   将在没有问题上下文的情况下继续")
  }
}
```

### 第五步：分析更改并确定提交类型

```javascript
function analyzeChanges(changedFiles) {
  const analysis = {
    hasTests: false,
    hasSource: false,
    hasDocs: false,
    hasConfig: false,
    newFiles: 0,
    modifiedFiles: 0
  }

  changedFiles.forEach(file => {
    if (file.status === 'A' || file.status === '??') {
      analysis.newFiles++
    } else if (file.status === 'M') {
      analysis.modifiedFiles++
    }

    if (file.path.includes('test') || file.path.includes('spec')) {
      analysis.hasTests = true
    } else if (file.path.includes('src/') || file.path.includes('lib/')) {
      analysis.hasSource = true
    } else if (file.path.match(/\.(md|txt)$/)) {
      analysis.hasDocs = true
    } else if (file.path.match(/\.(config|json|yaml|yml)$/)) {
      analysis.hasConfig = true
    }
  })

  return analysis
}

function suggestCommitType(analysis, issueType) {
  // 确定类型的优先顺序
  if (issueType === 'bug') return 'fix'
  if (issueType === 'feature') return 'feat'

  // 从更改中推断
  if (analysis.hasSource && analysis.newFiles > 0) return 'feat'
  if (analysis.hasSource && analysis.modifiedFiles > 0) {
    // 可能是 feat、fix 或 refactor - 让用户选择
    return 'feat' // 默认选择 feat
  }
  if (analysis.hasTests && !analysis.hasSource) return 'test'
  if (analysis.hasDocs && !analysis.hasSource) return 'docs'
  if (analysis.hasConfig) return 'chore'

  return 'feat' // 默认
}
```

### 第六步：生成或收集提交消息

```javascript
let commitType, commitScope, commitDescription

if (userMessage) {
  // 用户提供了消息，解析或直接使用
  const conventionalMatch = userMessage.match(/^(\w+)(\([\w-]+\))?: (.+)$/)

  if (conventionalMatch) {
    // 已经是传统格式
    commitType = conventionalMatch[1]
    commitScope = conventionalMatch[2]?.slice(1, -1) // 去掉括号
    commitDescription = conventionalMatch[3]
  } else {
    // 普通消息，添加传统格式
    commitType = suggestCommitType(analysis, issueType)
    commitScope = issueId ? issueId : null
    commitDescription = userMessage
  }
} else {
  // 从上下文自动生成
  commitType = suggestCommitType(analysis, issueType)
  commitScope = issueId ? issueId : null

  // 生成描述
  if (issueTitle) {
    commitDescription = issueTitle
  } else {
    // 从文件更改生成
    commitDescription = generateDescriptionFromChanges(analysis, changedFiles)
  }
}
```

### 第七步：显示建议的提交消息

```markdown
💬 建议的提交消息：
───────────────────────────

${commitType}${commitScope ? `(${commitScope})` : ''}: ${commitDescription}

${issueId ? `
相关问题: ${issueId}
${issueTitle ? `问题: ${issueTitle}` : ''}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 第八步：确认并提交

使用 **AskUserQuestion** 进行确认：

```javascript
{
  questions: [{
    question: "是否继续提交此内容？",
    header: "确认",
    multiSelect: false,
    options: [
      {
        label: "是，提交",
        description: "使用此消息创建提交"
      },
      {
        label: "编辑消息",
        description: "让我修改提交消息"
      },
      {
        label: "取消",
        description: "不提交，返回"
      }
    ]
  }]
}
```

**如果选择 "是，提交"**：

```bash
# 暂存所有更改
git add .

# 使用传统格式创建提交
git commit -m "${commitType}${commitScope ? `(${commitScope})` : ''}: ${commitDescription}" \
  ${issueId ? `-m "相关问题: ${issueId}"` : ''} \
  ${issueTitle ? `-m "${issueTitle}"` : ''}

echo "✅ 提交成功创建！"
echo ""
echo "提交: $(git log -1 --oneline)"
echo ""
echo "下一步："
echo "  /ccpm:sync        # 同步进度到 Linear"
echo "  /ccpm:work        # 继续工作"
echo "  git push          # 推送到远程"
```

**如果选择 "编辑消息"**：

```markdown
请提供您的提交消息（建议使用传统格式）：

格式: <type>(<scope>): <description>
示例：
  - feat(auth): 添加 JWT 令牌验证
  - fix(PSN-27): 解决登录按钮点击处理程序
  - docs: 更新 API 文档

您的消息：
> [用户输入]
```

然后重复确认。

## 辅助函数

### 检测问题类型

```javascript
function detectIssueType(issue) {
  const title = issue.title.toLowerCase()
  const labels = issue.labels || []

  // 首先检查标签
  if (labels.includes('bug') || labels.includes('fix')) return 'bug'
  if (labels.includes('feature') || labels.includes('enhancement')) return 'feature'

  // 检查标题关键词
  if (title.includes('fix') || title.includes('bug')) return 'bug'
  if (title.includes('add') || title.includes('implement')) return 'feature'

  return 'feature' // 默认
}
```

### 从更改生成描述

```javascript
function generateDescriptionFromChanges(analysis, changedFiles) {
  if (analysis.newFiles > 0 && analysis.hasSource) {
    const mainFile = changedFiles.find(f => f.status === 'A' && f.path.includes('src/'))
    if (mainFile) {
      const fileName = mainFile.path.split('/').pop().replace(/\.(ts|js|tsx|jsx)$/, '')
      return `添加 ${fileName} 模块`
    }
    return `添加新功能组件`
  }

  if (analysis.modifiedFiles > 0 && analysis.hasSource) {
    return `更新实现`
  }

  if (analysis.hasTests) {
    return `添加测试`
  }

  if (analysis.hasDocs) {
    return `更新文档`
  }

  return `更新文件`
}
```

## 示例

### 示例 1：自动检测提交

```bash
git checkout -b duongdev/PSN-27-add-auth
# ... 进行更改 ...
/ccpm:commit
```

**检测**: 从分支中获取 PSN-27，获取 Linear 中的问题标题  
**生成**: `feat(PSN-27): 添加用户认证`  
**结果**: 创建带有 Linear 链接的传统提交

### 示例 2：使用自定义消息提交

```bash
/ccpm:commit PSN-27 "完成 JWT 令牌验证"
```

**结果**: `feat(PSN-27): 完成 JWT 令牌验证`

### 示例 3：使用完整传统格式提交

```bash
/ccpm:commit "fix(auth): 解决登录按钮处理程序"
```

**结果**: 按原样使用提供的传统格式

### 示例 4：没有问题 ID 的提交

```bash
/ccpm:commit "更新文档"
```

**结果**: `docs: 更新文档`

## 优势

✅ **传统提交**: 自动格式遵循最佳实践  
✅ **Linear 集成**: 自动将提交链接到问题  
✅ **智能检测**: 从更改自动检测提交类型  
✅ **自动生成**: 从上下文创建有意义的消息  
✅ **Git 集成**: 内置于工作流程中（无需上下文切换）  
✅ **更改摘要**: 在确认之前显示要提交的内容  

## 迁移提示

这是一个新的命令，将 git 提交集成到 CCPM 工作流程中：
- 替代手动 `git add . && git commit -m "message"`
- 自动遵循传统提交格式
- 将提交链接到 Linear 问题
- 是自然工作流程的一部分（计划 → 工作 → 提交 → 同步 → 验证 → 完成）