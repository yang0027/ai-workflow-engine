# 代码组织规范

## 核心原则

> **分块分功能写代码，禁止堆代码到同一文件，防止代码沉余和难以维护**

---

## 1. 新功能开发

### ✅ 正确做法

```
services/xxx/
├── XxxService.ts          # 服务类（业务逻辑）
├── types.ts               # 类型定义

components/
├── XxxModal.tsx          # 独立弹窗/面板
├── XxxPanel.tsx          # 独立面板
├── XxxItem.tsx           # 列表项组件
└── XxxList.tsx          # 列表容器

hooks/
└── useXxx.ts            # 自定义 Hook
```

### ❌ 禁止做法

- 在 `App.tsx` 堆入超过 500 行代码
- 在现有文件中直接添加不相关功能
- 内联超过 20 行样式

---

## 2. 代码块注释规范

```typescript
// ============ [功能模块名称] ============
// [功能描述]
// [参数说明]

const myFunction = () => { ... };

// ============ [子功能名称] ============
const subFunction = () => { ... };
```

### 注释时机

| 情况 | 必须注释 |
|-----|---------|
| 复杂业务逻辑 | ✅ |
| API 调用 | ✅ (说明接口和参数) |
| 状态变更 | ✅ (说明原因) |
| 循环迭代 | ✅ (说明目的) |
| 简单赋值 | ❌ |

---

## 3. 文件拆分阈值

| 文件类型 | 建议行数 | 触发拆分 |
|---------|---------|---------|
| 页面组件 | <500 | >500 拆分 |
| 弹窗组件 | <300 | >300 拆分 |
| Hook | <200 | >200 拆分 |
| 服务类 | <400 | >400 拆分 |

---

## 4. 防沉余检查清单

每次提交代码前自检：

- [ ] 新代码是否超过 500 行？
- [ ] 是否有内联样式超过 20 行？
- [ ] 是否有重复代码块？
- [ ] 是否有无注释的复杂逻辑？
- [ ] 状态是否过多 (>20个)？
- [ ] 是否创建了新文件而非堆到现有文件？

---

## 5. 修改现有代码流程

1. **先读源码** - 理解结构再动手
2. **识别功能边界** - 确定要改哪部分
3. **拆分到独立文件** - 如果功能独立
4. **在原位置 import** - 保持引用关系
5. **添加中文注释** - 说明改动原因

---

## 6. 组件设计原则

### 单一职责

```tsx
// ✅ 好：职责单一
function UserAvatar({ userId }) { ... }
function UserName({ userId }) { ... }
function UserCard({ userId }) { ... }

// ❌ 差：职责过多
function UserProfile({ userId, onEdit, onDelete, onFollow }) { ... }
```

### 可复用性

```tsx
// ✅ 好：抽象可复用
function CanvasItem({ canvas, onSelect, onRename, onDelete }) { ... }

// ❌ 差：硬编码逻辑
<div onClick={() => handleCanvasSelect(canvas.id)}> ... </div>
```

---

## 7. 违规示例

### 示例 1：堆代码到 App.tsx

```tsx
// ❌ 禁止
function App() {
  const [state1, setState1] = useState();
  const [state2, setState2] = useState();
  // ... 50 个状态
  // ... 2000 行代码
}

// ✅ 正确
// 1. 创建 useCanvasManager.ts
// 2. 创建 CanvasManagerModal.tsx
// 3. 在 App.tsx 导入使用
```

### 示例 2：无注释的复杂逻辑

```tsx
// ❌ 禁止
const result = data.filter(x => x.a === y).map(x => x.b).reduce((a, b) => a + b);

// ✅ 正确
// 计算符合条件的项目总数
const totalScore = data
  .filter(item => item.isActive)      // 筛选激活项
  .map(item => item.score)             // 提取分数
  .reduce((sum, score) => sum + score, 0);  // 求和
```

---

## 8. 工具函数规范

```typescript
// utils/date.ts
// 日期格式化工具

export function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN');
}
```

| 规范 | 说明 |
|-----|------|
| 文件名 | `utils/xxx.ts` |
| 注释 | 文件顶部说明用途 |
| 导出 | 命名的 export |
| 测试 | 考虑添加单元测试 |

---

## 9. 错误处理规范

```typescript
// ✅ 好：明确的错误处理
try {
  const data = await fetchCanvas(id);
  return data;
} catch (err) {
  console.error('[CanvasService] Failed to fetch:', err);
  return null;
}

// ❌ 差：吞掉错误
try {
  return await fetch(id);
} catch {}
```

---

## 10. 性能注意事项

- 避免不必要的重新渲染
- 大列表使用虚拟滚动
- 合理使用 `useMemo` / `useCallback`
- 避免在渲染中创建新对象
