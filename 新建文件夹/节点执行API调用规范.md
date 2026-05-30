# 节点执行API调用规范

> **本规范只定义画布层面的节点接口调用方式**，不涉及具体厂家API（如RunningHub、Fish.audio等）。
> 各厂家API调用方式见 `docs/api/` 下的独立文档。

---

## 一、统一读上游：getUpstreamData

**文件：** `hooks/getUpstreamData.ts`

所有节点**只能通过这个函数**读取上游节点的输出，不得直接访问其他节点的内部数据。

```typescript
function getUpstreamData(
  nodeId: string,
  edges: Edge[],
  nodes: Node[]
): {
  text: string[]
  image: string[]
  video: string[]
  audio: string[]
  all: any[]       // 上游原始数据
}
```

**使用示例：**
```typescript
const { text, image, video, audio } = getUpstreamData(id, edges, nodes);
// text[0] → 第一个上游文本节点的输出
// image[0] → 第一个上游图片节点的输出
```

**规则：**
- 只读直连上游（连线连过来的节点），不跨级
- 按节点类型自动归类（text/image/video/audio）
- 如果上游节点尚未执行完成 → 返回空数组

---

## 二、统一执行入口：executeNode

**文件：** `hooks/executeNode.ts`

所有节点的「执行」逻辑走同一个入口，由画布调度器统一调用：

```typescript
async function executeNode(params: {
  nodeId: string
  nodeType: string        // LLM, ImageService, VideoFusion, TTS, Loop等
  upstreamData: {
    text: string[]
    image: string[]
    video: string[]
    audio: string[]
    all: any[]
  }
  modelConfig?: {
    provider: string       // runninghub | openai | fishaudio | local
    modelId?: string
    workflowId?: string
    apiKey?: string
  }
  skill?: string          // 当前节点加载的skill（可选）
  abortSignal?: AbortSignal
}): Promise<NodeResult>

type NodeResult = {
  success: boolean
  data?: any              // 节点输出数据（类型因节点而异）
  error?: string
  mediaType?: 'text' | 'image' | 'video' | 'audio'
  durationMs?: number
}
```

---

## 三、节点注册规范

每个节点在注册时声明自己的信息：

```typescript
type NodeRegistration = {
  type: string                    // 唯一类型名：LLMStoryboardNode
  label: string                   // 显示名：剧本节点
  category: string                // 分类：文案 | 生成 | 工具
  inputs: NodePort[]              // 输入端口
  outputs: NodePort[]             // 输出端口
  defaultSkill?: string           // 默认skill
  component: React.ComponentType   // 渲染组件
  executeHook: ExecuteFunction    // 执行逻辑
}
```

**输入输出端口定义：**
```typescript
type NodePort = {
  name: string                    // text/image/video/audio/any
  label: string                   // 文本/图片/视频/音频/任意
  multiple?: boolean              // 是否接受多个上游
  required?: boolean              // 是否必填
}
```

---

## 四、节点输出格式统一

所有节点的输出数据必须符合以下格式：

```typescript
// 文本类节点输出
{
  type: 'text',
  content: string,
  skill?: string,        // 使用的skill名称
  metadata?: Record<string, any>
}

// 图片类节点输出
{
  type: 'image',
  url: string,           // 图片URL或base64
  prompt?: string,       // 生成用的提示词
  width?: number,
  height?: number,
  metadata?: Record<string, any>
}

// 视频类节点输出
{
  type: 'video',
  url: string,
  duration?: number,
  resolution?: string,
  metadata?: Record<string, any>
}

// 音频类节点输出
{
  type: 'audio',
  url: string,
  duration?: number,
  format?: string,
  metadata?: Record<string, any>
}
```

---

## 五、错误处理规范

所有节点执行过程中的错误必须统一处理：

```typescript
// 节点内部出错 → 返回标准错误格式
{
  success: false,
  error: {
    code: string,           // NODE_EXEC_ERROR | API_ERROR | TIMEOUT | INVALID_INPUT
    message: string,        // 人类可读的错误信息
    nodeId?: string,
    nodeType?: string,
    detail?: any            // 详细错误信息（调试用）
  }
}

// 重试机制
// - 网络错误（超时/断连）：自动重试3次，间隔递增（1s → 3s → 5s）
// - 业务错误（参数不对）：不重试，直接报错
// - 所有重试记录到节点状态
```

---

## 六、节点状态管理

节点在执行过程中有以下状态：

| 状态 | 含义 | 触发 |
|------|------|------|
| `idle` | 等待执行 | 初始状态 |
| `running` | 正在执行 | 收到执行信号 |
| `success` | 执行成功 | executeNode返回success |
| `error` | 执行失败 | executeNode返回error |
| `retrying` | 重试中 | 自动重试第2/3次 |

状态流转：
```
idle → running → success
                → error
                → retrying → running → success/error
```

---

## 七、厂家API调用（独立文档）

**本规范不包含各厂家API的调用细节。** 每家调用方式不一样：

| 厂家 | 调用方式 | 文档 |
|------|---------|------|
| RunningHub | REST API + workflowId | `docs/api/runninghub.md` |
| Fish.audio | REST API + API Key | `docs/api/fishaudio.md` |
| OpenAI兼容 | HTTP POST + API Key | `docs/api/openai-compatible.md` |
| 千问(通义) | DashScope SDK | `docs/api/qwen.md` |
| 本地ComfyUI | WebSocket | `docs/api/local-comfyui.md` |

各厂家文档自行创建，**格式统一**：

```markdown
# {厂家名} API调用方式

## 鉴权方式
## 请求地址
## 请求格式
## 响应格式
## 错误处理
## 示例代码
```

---

## 八、调用流程图

```
用户操作（点击执行/自动执行）
       │
       ▼
   画布调度器（executeNode）
       │
       ├── getUpstreamData → 读上游数据
       │
       ▼
   厂家API适配层（根据provider分发）
       │
       ├── runninghub → RunningHub HTTP Client
       ├── fishaudio → Fish.audio HTTP Client  
       ├── openai → OpenAI兼容 Client
       └── local → 本地进程/WebSocket
       │
       ▼
   格式转换（厂家返回 → 节点输出格式）
       │
       ▼
   返回 NodeResult → 更新节点状态 → 通知下游
```
