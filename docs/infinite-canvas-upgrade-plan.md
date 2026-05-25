# 无限画布功能补齐与统一工作流改造方案

## 1. 目标

当前项目 `ai-workflow-engine` 已经具备 React Flow 画布、Gateway、Engine、设置中心、RunningHub、自定义工作流、图片/视频/TTS/上传节点等基础能力。下一阶段目标不是重写，而是把参考项目 `E:\无限画布参考` 中成熟的交互体验和配置能力融合进现有三层架构。项目内参考资料统一放在 `新建文件夹\` 下，其中本地 ComfyUI 工作流参考位于 `新建文件夹\本地comfyui工作流参考`，RunningHub 工作流参考位于 `新建文件夹\runninghub工作流参考`。

核心目标：

- 统一管理 API 模型、本地 ComfyUI、RunningHub ComfyUI 工作流。
- 增强循环节点、LLM 节点、图片卡片节点、上传节点、分组节点。
- 支持本地 ComfyUI JSON 和 RunningHub ComfyUI JSON 的参数入口编辑。
- 建立图片生成前后对比、历史记录、再次运行、拖回画布的资产闭环。
- 保留现有项目工程化优势，不照搬参考项目的单体结构。

## 2. 当前项目基础

当前已有模块：

- `canvas/`：React + TypeScript + Vite + React Flow 前端画布。
- `gateway/`：Fastify API 网关，已有健康检查、工作流运行、设置代理、n8n 导出等接口。
- `engine/`：Fastify 能力服务，已有 TTS、视频、设置、Skills、ComfyUI Adapter、RunningHub Adapter。
- `canvas/src/components/nodes/`：已有图片、视频、TTS、上传、LLM、Prompt、CustomWorkflow、Group、GridSplitter 等节点。
- `engine/src/services/adapters/CustomWorkflowParser.ts`：已有 ComfyUI JSON 参数解析雏形。
- `engine/src/services/adapters/impl/ComfyUIAdapter.ts`：已有本地 ComfyUI 工作流执行能力。
- `engine/src/services/adapters/impl/RunningHubAdapter.ts`：已有 RunningHub 工作流执行能力。
- `canvas/src/components/SettingsModal.tsx`：已有 API、ComfyUI、RunningHub、工作流、模型缓存配置入口。

## 3. 与参考项目的关键差距

参考项目更完整的地方：

- 多画布管理、回收站、服务端持久化、日志、历史记录。
- 循环节点可以驱动批量生成。
- LLM 节点支持更强的提示词/分镜生成。
- 图片卡片节点双击即可裁剪、遮罩、画笔、宫格切分。
- 生成结果可以查看生成前/生成后对比。
- API、ModelScope、ComfyUI 设置体验更完整。
- 本地 ComfyUI 工作流可以上传 JSON、识别参数入口、配置后在节点中使用。

你的项目更多的地方：

- 多了一层 RunningHub 工作流能力。
- 架构更清晰，前端、网关、能力服务分层明确。
- 已经有统一 Adapter 的基础，可以把本地 ComfyUI 和 RunningHub 统一进模板系统。

## 4. 统一 Provider 与 Workflow Template

### 4.1 Provider 能力提供方

统一管理所有能力来源：

```ts
type ProviderType = 'api' | 'local_workflow' | 'cloud_workflow';
type Capability = 'chat' | 'image' | 'video' | 'audio' | 'workflow';

interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  enabled: boolean;
  capabilities: Capability[];
}
```

示例：

- `openai`：API 服务商，支持 chat/image/audio。
- `minimax`：API 服务商，支持 chat/image/video/audio。
- `modelscope`：API 服务商，支持 chat/image/video。
- `local_comfyui`：本地工作流服务，支持 image/video/audio/workflow。
- `runninghub`：云端工作流服务，支持 image/video/audio/workflow。

### 4.2 Workflow Template 工作流模板

本地 ComfyUI JSON 和 RunningHub ComfyUI JSON 最终都保存成统一模板：

```ts
interface WorkflowTemplate {
  id: string;
  name: string;
  source: 'local_comfyui' | 'runninghub';
  capability: 'image' | 'video' | 'audio' | 'workflow';
  workflowRef?: string;
  rawWorkflowJson?: Record<string, any>;
  paramsSchema: WorkflowParam[];
  inputMappings: WorkflowInputMapping[];
  outputMapping?: WorkflowOutputMapping;
  previewImage?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowParam {
  id: string;
  nodeId: string;
  classType: string;
  fieldName: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'image' | 'audio' | 'video';
  defaultValue: any;
  required?: boolean;
  options?: string[];
  hidden?: boolean;
}

interface WorkflowInputMapping {
  inputPort: 'prompt' | 'image' | 'audio' | 'video' | string;
  nodeId: string;
  fieldName: string;
  transform?: 'url' | 'base64' | 'file';
}

interface WorkflowOutputMapping {
  type: 'image' | 'video' | 'audio' | 'text';
  nodeId?: string;
  fieldName?: string;
}
```

节点层只关心 `WorkflowTemplate`，不关心这个模板来自本地 ComfyUI 还是 RunningHub。

## 5. 本地 ComfyUI 与 RunningHub ComfyUI JSON 统一

### 5.1 结构判断

本地 ComfyUI API JSON 常见结构：

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 123,
      "steps": 20,
      "positive": ["6", 0]
    }
  }
}
```

RunningHub 导出的 ComfyUI JSON 示例可参考 `新建文件夹\runninghub工作流参考\图生图.json`，结构：

```json
{
  "169": {
    "inputs": {
      "prompt": "改变图中人物的衣服颜色...",
      "target_size": 1536,
      "vl_resize_image1": ["171", 0]
    },
    "class_type": "TextEncodeQwenImageEditPlusAdvance_lrzjason",
    "_meta": {
      "title": "TextEncodeQwenImageEditPlusAdvance lrzjason"
    }
  },
  "171": {
    "inputs": {
      "image": "None"
    },
    "class_type": "LoadImage"
  }
}
```

结论：

- 两者主体一致：顶层节点 ID，节点内 `class_type`、`inputs`、可选 `_meta`。
- 连线方式一致：`["nodeId", outputIndex]`。
- 差异在执行端、资产上传、工作流引用、平台元数据，不在参数编辑器本身。

另外，RunningHub 文档中的 `image_qwen_image.json` 是 ComfyUI 原始编辑器格式，而不是 API JSON。它的顶层包含 `nodes`、`links`、`widgets_values` 等字段。这意味着模板导入必须支持两类 ComfyUI 输入：

- `API JSON`：顶层直接是节点 ID，适合直接执行和灌参。
- `Workflow JSON`：顶层是 ComfyUI 编辑器工程结构，适合展示和转换，需要从 `nodes[].widgets_values`、`inputs[].widget`、`links` 中还原可配置参数。

短期可以先完整支持 API JSON；中期增加 Workflow JSON 到 API JSON 的转换或参数识别。

### 5.2 RunningHub API 接入范围

`F:\克劳德\runninghub\官方api文档.md` 中列出了 RunningHub 的主要接口类别：

- 标准模型 API：图片生成、视频生成、任务结果查询。
- AI 应用：通过 `webappId`、`nodeInfoList` 发起任务。
- ComfyUI 工作流：简易运行、高级运行、获取工作流 JSON、取消任务。
- 快捷创作：通过 `quickCreateCode`、`nodeInfoList` 调用快捷创作。
- 任务查询与 webhook：查询状态、查询输出、webhook 事件重试。
- 资源上传：图片、音频、视频、压缩包、LoRA 上传。

项目内应把 RunningHub 分成三种执行模式：

```ts
type RunningHubRunMode =
  | 'standard_model'
  | 'ai_app'
  | 'comfy_workflow';
```

对无限画布而言，优先级最高的是：

- `comfy_workflow`：用于 AIX 工作流模板。
- `ai_app`：用于 RunningHub 上已经封装好的应用。
- `standard_model`：作为普通图片/视频 API 模型补充。

### 5.3 RunningHub 实际调用样例

`F:\克劳德\runninghub\auto_update_banner.py` 中有可直接参考的实际调用方式：

```py
POST https://www.runninghub.cn/task/openapi/create
{
  "apiKey": "...",
  "workflowId": "...",
  "nodeInfoList": [
    { "nodeId": "68", "fieldName": "prompt", "fieldValue": "..." },
    { "nodeId": "82", "fieldName": "width", "fieldValue": 750 },
    { "nodeId": "82", "fieldName": "height", "fieldValue": 422 }
  ]
}
```

任务创建后：

```py
POST https://www.runninghub.cn/task/openapi/status
{
  "apiKey": "...",
  "taskId": "..."
}
```

输出获取：

```py
POST https://www.runninghub.cn/task/openapi/outputs
{
  "apiKey": "...",
  "taskId": "..."
}
```

输出中常见字段：

```ts
{
  fileUrl: string;
}
```

因此 RunningHub Adapter 的统一执行流程应为：

1. 根据模板参数生成 `nodeInfoList`。
2. 如果输入是本地图片/音频/视频，先走 RunningHub 资源上传，拿到平台可识别 URL 或文件标识。
3. 调用 `/task/openapi/create` 创建任务。
4. 轮询 `/task/openapi/status`。
5. 成功后调用 `/task/openapi/outputs`。
6. 将 `fileUrl` 下载或代理成项目本地 `AssetRecord`。

### 5.4 新增归一化解析器

建议新增：

- `engine/src/services/adapters/WorkflowNormalizer.ts`
- `engine/src/services/adapters/WorkflowTemplateService.ts`

职责：

```ts
normalizeWorkflow(source, rawJson) -> normalizedWorkflow
extractParams(normalizedWorkflow) -> paramsSchema
inferInputMappings(normalizedWorkflow) -> inputMappings
inferOutputMapping(normalizedWorkflow) -> outputMapping
```

解析规则：

- `CLIPTextEncode.text`、`TextEncode*.prompt` 识别为提示词输入。
- `LoadImage.image` 识别为图片输入。
- `LoadAudio.audio` 识别为音频输入。
- `LoadVideo.video` 或类似节点识别为视频输入。
- `KSampler.seed`、`KSampler.steps`、`cfg`、`denoise` 识别为数值参数。
- `CheckpointLoaderSimple.ckpt_name`、`LoraLoader*.lora_name` 识别为可选模型/LoRA 参数。
- `SaveImage`、视频保存节点、音频保存节点识别为输出节点。

### 5.5 nodeInfoList 与模板参数映射

RunningHub 高级工作流的核心不是直接提交完整 JSON，而是通过 `nodeInfoList` 改写指定节点字段。因此统一模板中的 `paramsSchema` 可以直接转换为 RunningHub 的 `nodeInfoList`：

```ts
interface RunningHubNodeInfo {
  nodeId: string;
  fieldName: string;
  fieldValue: any;
}
```

转换规则：

```ts
paramsSchema + 用户填写值 -> nodeInfoList
```

例如：

```ts
[
  {
    id: 'prompt',
    nodeId: '169',
    fieldName: 'prompt',
    label: '编辑提示词',
    type: 'text',
    defaultValue: '改变图中人物的衣服颜色'
  },
  {
    id: 'input_image',
    nodeId: '171',
    fieldName: 'image',
    label: '输入图片',
    type: 'image',
    defaultValue: 'None'
  }
]
```

执行时转换为：

```ts
[
  { nodeId: '169', fieldName: 'prompt', fieldValue: '新的提示词' },
  { nodeId: '171', fieldName: 'image', fieldValue: '上传后的图片资源' }
]
```

本地 ComfyUI 则使用同一份参数映射直接修改 `workflowJson[nodeId].inputs[fieldName]`。

## 6. 设置中心改造

### 6.1 Tab 设计

设置中心建议拆成：

- `API 服务商`
  - OpenAI、MiniMax、ModelScope、火山、阿里、自定义 API。
  - 支持 baseUrl、apiKey、连接测试、拉模型。

- `本地 ComfyUI`
  - 多实例地址。
  - 连接测试。
  - 负载均衡策略。
  - 本地工作流 JSON 上传/粘贴/解析。

- `RunningHub`
  - baseUrl、apiKey。
  - 连接测试。
  - RunningHub App ID / Workflow ID 管理。
  - RunningHub ComfyUI JSON 上传/粘贴/解析。

- `工作流模板库`
  - 汇总本地 ComfyUI 和 RunningHub 模板。
  - 按 image/video/audio/workflow 分类。
  - 可编辑参数显示名、类型、默认值、是否暴露、输入映射、输出映射。

- `模型缓存`
  - chat/image/video/audio 模型缓存。

### 6.2 两个来源，一个编辑器

本地 ComfyUI 和 RunningHub 在 UI 上分 Tab，但参数编辑器共用：

- 粘贴或上传 JSON。
- 自动解析参数。
- 勾选要暴露的参数。
- 修改显示名。
- 修改类型：文本、数字、开关、下拉、图片、音频、视频。
- 设置默认值。
- 设置输入端口映射。
- 设置输出类型。
- 保存为模板。

区别：

- 本地 ComfyUI 保存 `rawWorkflowJson`，执行时提交到本地 `/prompt`。
- RunningHub 保存 `workflowRef` 或 `rawWorkflowJson`，执行时提交到 RunningHub API。

重点原则：

- 本地 ComfyUI 和 RunningHub ComfyUI 都不能写死参数入口。
- 两者都必须支持“解析 JSON 后由用户手动选择要暴露的参数”。
- 系统可以自动推荐常见参数，但最终以用户勾选和编辑的模板配置为准。
- 同一个 JSON 里可以暴露任意节点字段，例如 prompt、text、image、audio、video、seed、steps、width、height、cfg、denoise、LoRA、checkpoint 等。

示例：

```ts
[
  {
    id: 'edit_prompt',
    nodeId: '169',
    fieldName: 'prompt',
    label: '编辑提示词',
    type: 'text',
    exposed: true
  },
  {
    id: 'reference_image',
    nodeId: '171',
    fieldName: 'image',
    label: '参考图',
    type: 'image',
    exposed: true
  },
  {
    id: 'seed',
    nodeId: '170',
    fieldName: 'seed',
    label: '随机种子',
    type: 'number',
    exposed: false
  }
]
```

其中 `exposed: true` 的参数会显示在图片/视频/音频节点的 AIX 参数面板里；`exposed: false` 的参数保留在模板里，但默认不显示给画布节点用户。

## 7. 节点系统调整

### 7.1 文本节点

目标：

- 点击或双击进入编辑。
- 可作为提示词源连接图片、视频、LLM、工作流节点。
- 支持一键派生下游图片节点、视频节点、LLM 节点。

输出：

```ts
{
  type: 'text',
  text: string
}
```

### 7.2 LLM 节点

新增模式：

- `单条文本模式`：输出一段提示词或说明。
- `分镜模式`：输出分镜列表。
- `循环提示词模式`：输出数组，供循环节点逐条消费。

推荐输出结构：

```ts
{
  type: 'text_list',
  items: [
    { index: 1, title: '第1张卖点图', prompt: '...' },
    { index: 2, title: '第2张卖点图', prompt: '...' }
  ]
}
```

LLM 节点 UI 增加：

- 输出格式选择：普通文本 / 分镜列表 / 提示词列表 / JSON。
- 循环变量模板：例如 `运行第 {{index}} 张卖点图`。
- 数量设置。
- 是否自动连接循环节点。

### 7.3 循环节点

循环节点不只是重复按钮，而是批量上下文发生器。

输入：

- 文本列表。
- 图片列表。
- 手动数量 N。
- LLM 输出的分镜数组。

输出：

```ts
{
  type: 'loop_context',
  currentIndex: number,
  total: number,
  item: any,
  variables: {
    index: 1,
    indexText: '第一张',
    prompt: '...'
  }
}
```

执行方式：

- 顺序执行：保证分镜顺序。
- 并发执行：适合卖点图、批量图。
- 最大并发数可配置。
- 每次循环把变量注入下游节点参数。

### 7.4 图片节点 / 图片卡片节点

建议拆清边界：

- `图片卡片节点`：画布中的图片资产，可以双击编辑。
- `图片生成节点`：文生图、图生图、AIX 工作流生成。
- `上传节点`：外部图片/视频/音频入口。

图片卡片能力：

- 双击打开编辑器。
- 裁剪。
- 遮罩。
- 画笔。
- 宫格切分。
- 作为参考图连到图片/视频/工作流节点。
- 从生成结果拖回画布生成图片卡片。

### 7.5 上传节点

上传节点作为统一资源入口：

- 支持图片、视频、音频。
- 自动识别 MIME 类型。
- 图片可进入图片编辑工具。
- 视频可预览。
- 音频可试听。
- 输出标准资产对象。

输出：

```ts
{
  type: 'asset',
  assetType: 'image' | 'video' | 'audio',
  url: string,
  name: string,
  width?: number,
  height?: number,
  duration?: number
}
```

### 7.6 视频节点

参考图片节点设计：

- 普通 API 视频生成。
- 图生视频。
- 文生视频。
- AIX 工作流二级菜单。
- RunningHub 视频工作流模板。
- 本地 ComfyUI 视频工作流模板。

### 7.7 音频节点

能力：

- TTS。
- 音乐生成，例如 Suno 类模型。
- 声音克隆。
- AIX 音频工作流。

输入：

- 文本。
- 参考音频。
- 角色音色。

### 7.8 分组节点

分组不只是视觉容器。

需要支持：

- 组内节点一起移动。
- 组选中、复制、粘贴。
- 组作为输入源连接到生成节点。
- 图片组输出图片列表。
- 提示词组输出文本列表。
- 混合组输出结构化资产列表。

## 8. AIX 二级菜单

图片、视频、音频节点统一提供 AIX 二级菜单。

菜单来源：

- `WorkflowTemplate.capability === 当前节点类型`
- `source === local_comfyui`
- `source === runninghub`

示例：

- 图片节点 AIX：
  - 扩图。
  - 换装。
  - 人脸一致性。
  - 商品图美化。

- 视频节点 AIX：
  - 图生视频。
  - 口播视频。
  - 运镜视频。

- 音频节点 AIX：
  - 声音克隆。
  - 音乐生成。
  - 音频增强。

选择模板后，节点下方自动渲染 `paramsSchema` 对应的参数面板。

## 9. 执行协议与数据流

### 9.1 标准 Node Output

所有节点输出都转为统一格式：

```ts
interface NodeOutput {
  nodeId: string;
  runId: string;
  type: 'text' | 'text_list' | 'image' | 'image_list' | 'video' | 'audio' | 'asset' | 'loop_context';
  value: any;
  assets?: AssetRecord[];
  meta?: RunMeta;
}
```

### 9.2 标准 AssetRecord

```ts
interface AssetRecord {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  name?: string;
  width?: number;
  height?: number;
  duration?: number;
  sourceNodeId?: string;
  sourceRunId?: string;
}
```

### 9.3 标准 RunMeta

```ts
interface RunMeta {
  providerId: string;
  model?: string;
  workflowTemplateId?: string;
  prompt?: string;
  inputAssets?: AssetRecord[];
  outputAssets?: AssetRecord[];
  params?: Record<string, any>;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
}
```

## 10. 图片生成前后对比

每次生成图片时记录：

- 原图或参考图。
- 输出图。
- 提示词。
- 参数。
- 使用的模型或工作流。
- 运行节点。
- 运行 ID。

预览灯箱支持：

- 左右对比。
- 滑杆对比。
- 查看原图。
- 查看生成参数。
- 再次运行。
- 复制提示词。
- 拖回画布生成图片卡片。

这个功能应基于 `RunMeta.inputAssets` 和 `RunMeta.outputAssets`，不要只在 UI 中临时保存 before/after。

## 11. 画布管理与历史

建议后续从 `localStorage` 逐步升级为服务端持久化：

- `GET /api/v1/canvases`
- `POST /api/v1/canvases`
- `GET /api/v1/canvases/:id`
- `PUT /api/v1/canvases/:id`
- `DELETE /api/v1/canvases/:id`
- `POST /api/v1/canvases/:id/restore`

运行历史：

- `GET /api/v1/history`
- `DELETE /api/v1/history/:id`

日志：

- 每次工作流运行记录节点状态。
- 前端可查看当前画布日志。
- 长任务可通过 WebSocket 推送状态。

## 12. 后端改造点

### 12.1 Engine

新增或增强：

- `WorkflowTemplateService`
- `WorkflowNormalizer`
- `WorkflowRunService`
- `AssetService`
- `HistoryService`

接口建议：

- `GET /api/v1/engine/workflow-templates`
- `POST /api/v1/engine/workflow-templates`
- `PUT /api/v1/engine/workflow-templates/:id`
- `DELETE /api/v1/engine/workflow-templates/:id`
- `POST /api/v1/engine/workflow-templates/parse`
- `POST /api/v1/engine/workflow-templates/:id/run`

### 12.2 Gateway

新增代理：

- 模板管理代理。
- 资产上传/下载代理。
- 画布保存代理。
- 历史记录代理。
- 工作流运行状态 WebSocket。

### 12.3 Adapter

保留现有：

- `ComfyUIAdapter`
- `RunningHubAdapter`
- `OpenAIAdapter`

增强：

- 两个工作流 Adapter 都接收统一 `WorkflowTemplateRunPayload`。
- 本地 ComfyUI 负责 JSON 灌参、提交 `/prompt`、轮询 `/history`、下载输出。
- RunningHub 负责 app/workflow 调用、上传输入资产、轮询结果、下载输出。

## 13. 前端改造点

### 13.1 SettingsModal

重点改造：

- 本地 ComfyUI Tab 增加工作流 JSON 上传/解析。
- RunningHub Tab 增加 RunningHub JSON 上传/解析。
- 新增统一工作流模板编辑器。
- 模板按 image/video/audio 分类。

### 13.2 App.tsx

重点改造：

- 节点派生逻辑：从文本创建图片，从图片创建视频，从图片反向创建文本。
- 循环节点执行上下文。
- 统一节点输出缓存。
- 结果预览灯箱接入 before/after 对比。
- 从输出拖回画布创建图片卡片。

### 13.3 Nodes

重点改造：

- `LLMStoryboardNode`：增加循环提示词和列表输出。
- `ImageServiceNode`：接入 AIX 模板面板和 before/after 元数据。
- `VideoFusionNode`：改成更接近图片节点的配置体验。
- `TTSServiceNode`：扩展音频/音乐/AIX 模板。
- `UploadNode`：资源类型识别和图片编辑工具迁移。
- `GridSplitterNode`：可和图片卡片编辑器统一。
- `PurpleGroupNode`：增强组输入/组输出协议。

## 14. 推荐实施顺序

### 阶段 1：统一工作流模板系统

- 新增 `WorkflowTemplate` 数据结构。
- 本地 ComfyUI JSON 解析。
- RunningHub ComfyUI JSON 解析。
- 设置中心两个 Tab 分来源上传，但共用参数编辑器。
- 保存模板到 engine 数据目录。

这是基础层，先做它能避免后面图片、视频、音频节点重复写逻辑。

当前进展：

- ✅ 统一工作流模板系统已彻底物理打通。
- ✅ 已新增 Engine 工作流模板类型、解析器和持久化服务。
- ✅ 已新增 Gateway 模板 CRUD/parse 代理接口。
- ✅ 已新增前端 `WorkflowTemplateService`。
- ✅ 已在 SettingsModal 中完美接入“上传/粘贴 JSON -> 解析参数 -> 勾选暴露参数 -> 保存模板”的 UI 面板并编译通过。
- ✅ 批量循环迭代（Loop Node）与网关隔离并发/顺序调度引擎已物理打通并通过静态编译。

### 阶段 2：AIX 模板接入图片/视频/音频节点

- 图片节点展示 image 模板。
- 视频节点展示 video 模板。
- 音频节点展示 audio 模板。
- 选择模板后动态渲染参数。
- 执行时统一提交到 template run 接口。

### 阶段 3：资产与生成对比

- 统一 `AssetRecord`。
- 统一 `RunMeta`。
- 生成节点记录 input/output。
- 灯箱支持生成前后对比、复制提示词、再次运行。

### 阶段 4：LLM 与循环节点

- LLM 增加列表输出和分镜输出。
- 循环节点消费列表。
- 支持顺序/并发执行。
- 支持变量注入下游节点参数。

### 阶段 5：图片卡片、上传节点、分组

- 图片卡片双击编辑。
- 上传节点统一图片/视频/音频。
- 图片编辑工具迁移到图片卡片和上传图片。
- 分组节点支持组输入/组输出。

### 阶段 6：画布管理、历史、日志

- 服务端保存画布。
- 多画布列表。
- 回收站。
- 运行历史。
- WebSocket 状态推送。

## 15. 风险与注意事项

- 不要让节点直接写死 RunningHub 或 ComfyUI 逻辑，节点应只依赖模板协议。
- 不要把上传节点和图片卡片节点混成一个概念，上传是入口，图片卡片是画布资产。
- 不要只在前端保存 before/after，对比数据应进入 `RunMeta`。
- 不要让循环节点只做 UI 重复，循环必须成为执行上下文。
- RunningHub 有些工作流可能无法拉到完整 JSON，需要支持手动粘贴 JSON 或手动配置参数。
- ComfyUI 自定义节点字段差异很大，解析器必须允许用户手动修正参数类型和映射。

## 16. 最终效果

完成后，画布应具备以下体验：

- 用户在设置中心配置 API、本地 ComfyUI、RunningHub。
- 用户可分别上传本地 ComfyUI JSON 和 RunningHub ComfyUI JSON。
- 两类 JSON 都能解析参数，并保存成统一模板。
- 图片、视频、音频节点都能通过 AIX 二级菜单选择模板。
- LLM 节点能生成一组分镜或提示词。
- 循环节点能逐条或并发驱动下游生成。
- 图片结果能和生成前输入图做对比。
- 上传图片、生成图片都能变成可编辑图片卡片。
- 分组能作为批量输入参与工作流。
- 画布、历史、日志都能持久化。
