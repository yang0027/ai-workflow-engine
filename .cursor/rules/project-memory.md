# AI Workflow Engine - 项目记忆

> 本文件记录项目的关键信息，避免每次对话都要重新探索代码库。
> 更新：每次重大改动后同步更新此文档。

---

## 1. 项目架构

```
用户浏览器 (React Flow 无限画布)
       │
       ▼
┌─────────────────────────────────────────┐
│  CANVAS (前端)        端口: 5173        │
│  React + TypeScript + Vite              │
└────────────────┬────────────────────────┘
                 │ HTTP API
                 ▼
┌─────────────────────────────────────────┐
│  GATEWAY (API 网关)   端口: 3000        │
│  Fastify + CORS + WebSocket             │
│  - 工作流拓扑编排                          │
│  - 请求代理转发到 Engine                   │
└────────────────┬────────────────────────┘
                 │ HTTP API
                 ▼
┌─────────────────────────────────────────┐
│  ENGINE (核心服务)   端口: 4000          │
│  Fastify + TypeScript                    │
│  - 自定义工作流执行 (ComfyUI/RunningHub) │
│  - TTS/Video/Image/LLM 服务              │
└────────────────┬────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
 本地 ComfyUI  RunningHub    API厂商
 localhost:8188  云端API      (MiniMax/火山/阿里等)
```

---

## 2. 支持的生成能力

### 图片生成

| 提供商 | 类型 | source 值 | 适配器 |
|--------|------|-----------|--------|
| 本地 ComfyUI | 本地 | `local_comfyui` | `ComfyUIAdapter.ts` |
| RunningHub | 云端 | `runninghub` | `RunningHubAdapter.ts` |
| MiniMax | API | `minimax` | `OpenAIAdapter.ts` |
| 火山引擎 | API | `volcengine` | `OpenAIAdapter.ts` |
| 阿里云 | API | `ali` | `OpenAIAdapter.ts` |

### 视频生成

| 提供商 | 类型 | source 值 | 适配器 |
|--------|------|-----------|--------|
| 本地 ComfyUI | 本地 | `local_comfyui` | `ComfyUIAdapter.ts` |
| RunningHub | 云端 | `runninghub` | `RunningHubAdapter.ts` |
| Vidu | API | `vidu` | `OpenAIAdapter.ts` |

### 音频/TTS

| 提供商 | 类型 | source 值 | 适配器 |
|--------|------|-----------|--------|
| 本地 ComfyUI | 本地 | `local_comfyui` | `ComfyUIAdapter.ts` |
| RunningHub | 云端 | `runninghub` | `RunningHubAdapter.ts` |
| MiniMax | API | `minimax` | `TTSService.ts` |
| Fish Audio | API | `fish` | `TTSService.ts` |

---

## 3. 关键文件路径

### Canvas (前端)
```
canvas/src/
├── App.tsx                          # 主应用
├── services/
│   └── runninghub.service.ts        # 执行服务（核心！）
├── components/
│   ├── SettingsModal.tsx            # 设置面板
│   └── nodes/
│       ├── CustomWorkflowNode.tsx   # 自定义工作流节点
│       ├── image-sub-components/
│       │   ├── ConfigPanel.tsx      # 图像节点配置
│       │   └── useImageNodeLogic.ts # 图像节点逻辑 ⚠️
│       ├── VideoFusionNode.tsx       # 视频节点 ⚠️
│       └── tts-sub-components/       # TTS 节点
```

### Gateway (API 网关)
```
gateway/src/
└── app.ts                           # 主入口 (端口 3000)
                                        - bodyLimit: 100MB
                                        - fetchWithTimeout: 5min
```

### Engine (核心服务)
```
engine/src/
├── app.ts                           # 主入口 (端口 4000)
│                                       - bodyLimit: 100MB
├── services/
│   ├── adapters/
│   │   ├── impl/
│   │   │   ├── ComfyUIAdapter.ts    # 本地 ComfyUI 执行器
│   │   │   ├── RunningHubAdapter.ts  # 云端 RunningHub 执行器
│   │   │   └── OpenAIAdapter.ts     # OpenAI 兼容接口
│   │   ├── types.ts                 # 类型定义
│   │   └── Registry.ts              # 适配器注册中心
│   ├── settings/
│   │   └── SettingsService.ts       # 配置管理
│   ├── tts/
│   │   └── TTSService.ts           # 语音服务
│   └── video/
│       └── VideoService.ts         # 视频服务
├── lib/
│   └── RunningHubClient.ts          # RunningHub API 客户端
└── data/
    ├── settings.json                # 全局配置
    └── workflow-templates.json      # 工作流模板
```

---

## 4. 执行链路（关键！）

### 本地 ComfyUI 执行流程

```
Canvas → Gateway (/api/v1/custom-workflow/execute)
       → Engine (/api/v1/engine/custom-workflow/execute)
       → ComfyUIAdapter.executeCustomWorkflow()
       → POST localhost:8188/prompt
       → 轮询 /history/{prompt_id}
       → 下载输出图片
```

### 云端 RunningHub 执行流程

```
Canvas → Gateway (/api/v1/custom-workflow/execute)
       → Engine (/api/v1/engine/custom-workflow/execute)
       → RunningHubAdapter.executeCustomWorkflow()
       → RunningHub API
       → 轮询任务状态
       → 下载输出
```

### source 参数决定路由

```typescript
// Engine app.ts 中的路由逻辑
if (payload.source === 'local_comfyui') {
  outputUrl = await comfyUIAdapter.executeCustomWorkflow(payload);
} else {
  outputUrl = await runningHubAdapter.executeCustomWorkflow(payload);
}
```

---

## 5. 模板与 source 的关系

模板数据中 `source` 字段决定使用哪个后端：

```typescript
interface WorkflowTemplate {
  id: string;
  name: string;
  source: 'local_comfyui' | 'runninghub';  // ⚠️ 关键字段
  workflowRef?: string;    // RunningHub 工作流 ID
  rawWorkflowJson?: object; // ComfyUI JSON
  capability: 'image' | 'video' | 'audio';
}
```

**重要**：
- `source === 'local_comfyui'` → 使用本地 ComfyUI，需要 `rawWorkflowJson`
- `source === 'runninghub'` → 使用云端 RunningHub，需要 `workflowRef` 或 `appId`

---

## 6. 配置存储

### 全局设置 (settings.json)
```json
{
  "comfyui_instances": ["127.0.0.1:8188"],
  "comfyui_input_dir": "E:\\comfyui8.0\\...",
  "providers": {
    "runninghub": { "enabled": true, "apiKey": "..." },
    "minimax": { "enabled": true, "apiKey": "..." },
    "volcengine": { "enabled": true, "apiKey": "..." }
  }
}
```

### 路径常量
- ComfyUI Input: `E:\comfyui8.0\ComfyUI_Mie_2026_V8.0_Base\ComfyUI\input`
- Engine Outputs: `engine/data/outputs`
- 静态资源服务: `http://localhost:19000/workflows/`

---

## 7. 媒体存储方案

### 前端存储
- **IndexedDB**: 存储媒体 base64 数据，key 格式 `media-asset-*`
- **引用协议**: `db://media-asset-*`
- **显示**: 从 IndexedDB 读取，创建 Object URL

### ⚠️ 注意事项
- **不要用 localStorage 存储 base64**（会触发 QuotaExceededError）
- 每次刷新页面需要重新解析 `db://` 引用

---

## 8. 开发注意事项

### 修改代码时
1. 先读源码，不要凭记忆改
2. 注意 `source` 参数的传递链路
3. 测试时检查是哪个后端在执行
4. 大图片 base64 可能超过默认请求体限制（Gateway/Engine 已设为 100MB）

### 调试命令
```bash
# 检查端口
netstat -ano | findstr ":3000 :4000 :8188"

# 重启 Gateway
cd gateway && npm run dev

# 重启 Engine
cd engine && npm run dev
```

### 常见错误
| 错误 | 原因 | 解决方案 |
|------|------|----------|
| ERR_CONNECTION_ABORTED | Gateway/Engine 超时挂起 | 重启服务，或检查 fetchWithTimeout |
| Payload Too Large | 请求体超限 | 检查 Gateway/Engine bodyLimit |
| 执行到 RunningHub | source 参数错误 | 检查模板的 source 字段 |
| ComfyUI 连接失败 | 实例离线 | 检查 COMFYUI_INSTANCES 配置 |

---

## 9. 项目根目录

```
E:\开发\ai-workflow-engine\
```

### 参考目录
- `E:\无限画布参考\` - 参考项目
- `E:\新建文件夹\本地comfyui工作流参考\` - 本地 ComfyUI 工作流
- `E:\新建文件夹\runninghub工作流参考\` - RunningHub 工作流

---

## 10. 开发原则

1. **不重写整个项目** - 做小的垂直切片
2. **保留三层架构** - Canvas / Gateway / Engine
3. **先读源码再动手** - 不要凭记忆改
4. **边实现边收敛** - 不做大规模重构
5. **模板必须明确 source** - 决定使用哪个后端

---

## 11. 代码规范

### 核心原则

> **分块分功能写代码，禁止堆代码到同一文件**

### 11.1 新功能开发规范

```
✅ 正确做法：
├── services/xxx/
│   ├── XxxService.ts          # 服务类（业务逻辑）
│   └── types.ts              # 类型定义
├── components/
│   ├── XxxModal.tsx         # 独立弹窗/面板
│   ├── XxxPanel.tsx         # 独立面板
│   └── XxxItem.tsx          # 列表项组件
└── hooks/
    └── useXxx.ts            # 自定义 Hook

❌ 错误做法：
└── App.tsx (堆入 8000+ 行代码)
```

### 11.2 修改现有代码规范

```
步骤：
1. 先读源码理解结构
2. 拆分独立功能到单独文件
3. 在原位置 import 引用
4. 给代码块加中文注释说明功能
```

### 11.3 注释规范

```typescript
// ============ 功能模块说明 ============
// [功能描述]
// [参数说明]
// [返回值说明]

// 业务逻辑块之间用空行分隔
const doSomething = () => { ... };

// ============ 子功能说明 ============
const doSubThing = () => { ... };
```

### 11.4 文件组织

| 类型 | 存放位置 | 说明 |
|-----|---------|-----|
| 页面组件 | `components/` | 超过 200 行考虑拆分 |
| 弹窗组件 | `components/XxxModal.tsx` | 独立文件 |
| 工具函数 | `utils/` | 纯函数，无副作用 |
| 自定义 Hook | `hooks/useXxx.ts` | 状态逻辑复用 |
| 服务类 | `services/xxx/XxxService.ts` | API 调用/业务逻辑 |
| 类型定义 | `types/` 或 `xxx/types.ts` | 接口/类型 |

### 11.5 防沉余检查清单

在提交代码前自检：
- [ ] 新代码是否超过 500 行？考虑拆分
- [ ] 是否有内联样式超过 20 行？提取为样式对象
- [ ] 是否有重复代码块？提取为函数/组件
- [ ] 是否有无注释的复杂逻辑？添加中文说明
- [ ] 状态是否过多 (>20个)？考虑用 useReducer 或拆分组件
