# AI Workflow Engine 开发流程

本文档记录 `ai-workflow-engine` 无限画布项目的推荐开发流程。它对应本地 Codex Skill `ai-workflow-engine-dev`，但作为项目文档长期保存在仓库中，方便后续维护和协作。

## 1. 项目目录

- `canvas/`：React + TypeScript + Vite + React Flow 前端画布。
- `gateway/`：Fastify API 网关，默认端口 `3000`。
- `engine/`：Fastify 能力服务，默认端口 `4000`。
- `docs/infinite-canvas-upgrade-plan.md`：无限画布升级方案。
- `E:\无限画布参考`：参考项目。
- `新建文件夹\本地comfyui工作流参考`：本地 ComfyUI 工作流参考。
- `新建文件夹\runninghub工作流参考`：RunningHub ComfyUI 工作流参考。
- `新建文件夹\开发技能`：外部开发流程命令参考。
- `F:\克劳德\runninghub`：RunningHub API 文档参考。

## 2. 开发原则

- 不重写整个项目。
- 保留 `canvas / gateway / engine` 三层结构。
- 每次改造尽量做小的垂直切片。
- 动手前先读相关源码，不凭记忆改。
- 新功能优先沉淀为共享数据模型，不在单个节点里写死逻辑。
- 参考项目负责提供手感，本项目负责保留更清晰的工程架构。
- 不做无关大清理，除非它直接服务当前功能。

## 3. 标准流程

### 3.1 定位

开始任务前先判断影响层级：

- 画布交互：看 `canvas/src/App.tsx` 和相关节点组件。
- 节点 UI：看 `canvas/src/components/nodes/`。
- 设置中心：看 `canvas/src/components/SettingsModal.tsx`。
- RunningHub/ComfyUI：看 `canvas/src/services/runninghub.service.ts`、`engine/src/services/adapters/`。
- 执行链路：看 `gateway/src/app.ts`、`engine/src/app.ts`。
- 产品方案：看 `docs/infinite-canvas-upgrade-plan.md`。

### 3.2 规划

每次任务先拆成最小可交付切片：

- UI 控件。
- 前端 service/hook。
- Gateway 路由。
- Engine service。
- Adapter 执行。
- 验证与文档同步。

涉及模板、资产、节点执行时，先确认数据协议，再写 UI。

### 3.3 实现

实现时遵守：

- 尽量沿用现有代码风格。
- 不继续扩大 `App.tsx` 的职责。
- 新系统优先往 hooks/services/types 中收敛。
- 节点组件尽量只负责展示和局部交互。
- 后端业务逻辑尽量放到 services，不长期堆在 `app.ts`。

### 3.4 验证

按影响范围运行检查：

```powershell
cd E:\开发\ai-workflow-engine\canvas
npm run build
```

```powershell
cd E:\开发\ai-workflow-engine\engine
npm run build
```

```powershell
cd E:\开发\ai-workflow-engine\gateway
npm run build
```

需要浏览器验证时：

```powershell
cd E:\开发\ai-workflow-engine\canvas
npm run dev
```

再启动 `engine` 和 `gateway` 对应服务进行联调。

### 3.5 同步

每个较大改造完成后，同步：

- 本文档是否需要更新。
- `docs/infinite-canvas-upgrade-plan.md` 是否需要更新。
- 记录已完成内容、验证结果、剩余风险。

## 4. 当前代码状态判断

当前项目不是坏代码，但仍处于快速原型后期：

- 架构方向正确。
- 功能已经开始分层。
- 前端 `App.tsx` 偏大。
- 节点组件承担了较多 UI、状态、接口调用和模板逻辑。
- `engine/src/app.ts` 中业务逻辑还较多。
- RunningHub、本地 ComfyUI、普通 API 需要统一到模板和 Provider 模型。

推荐策略是边实现边收敛，而不是先做大规模重构。

## 5. 优先级

默认改造顺序：

1. 统一工作流模板系统：本地 ComfyUI + RunningHub。
2. 图片、视频、音频节点接入 AIX 模板菜单。
3. 建立资产元数据和生成前后对比。
4. LLM 列表输出与循环节点执行上下文。
5. 图片卡片编辑、上传节点增强、分组能力。
6. 多画布管理、历史、日志、服务端持久化。

## 5.1 已完成的基础切片

### 2026-05-24：统一工作流模板后端与前端 service

已新增：

- `engine/src/services/workflow-templates/types.ts`
- `engine/src/services/workflow-templates/WorkflowTemplateParser.ts`
- `engine/src/services/workflow-templates/WorkflowTemplateService.ts`
- `canvas/src/services/workflow-template.service.ts`

已接入 Engine API：

- `GET /api/v1/engine/workflow-templates`
- `GET /api/v1/engine/workflow-templates/:id`
- `POST /api/v1/engine/workflow-templates/parse`
- `POST /api/v1/engine/workflow-templates`
- `PUT /api/v1/engine/workflow-templates/:id`
- `DELETE /api/v1/engine/workflow-templates/:id`

已接入 Gateway API：

- `GET /api/v1/workflow-templates`
- `GET /api/v1/workflow-templates/:id`
- `POST /api/v1/workflow-templates/parse`
- `POST /api/v1/workflow-templates`
- `PUT /api/v1/workflow-templates/:id`
- `DELETE /api/v1/workflow-templates/:id`

能力：

- 支持 ComfyUI API JSON 解析。
- 初步支持 ComfyUI workflow JSON 的 widgets 参数提取。
- 支持本地 ComfyUI 与 RunningHub 共用同一套模板模型。
- 参数可标记 `exposed`，后续 AIX 面板只显示暴露参数。
- 模板持久化到 `engine/data/workflow-templates.json`。

验证：

- `canvas`、`engine`、`gateway` 均已通过 `npm run build`。
- 使用 `新建文件夹\本地comfyui工作流参考\Z-Image-Enhance.json` 同结构文件做过解析抽样验证。

## 6. 工作流模板规则

本地 ComfyUI 与 RunningHub ComfyUI 使用同一套模板编辑器。

共同能力：

- 上传或粘贴 JSON。
- 自动解析节点字段。
- 手动勾选要暴露的参数。
- 修改显示名、类型、默认值。
- 保存为图片、视频、音频或通用工作流模板。
- 在节点 AIX 面板中显示 `exposed: true` 的参数。

执行差异：

- 本地 ComfyUI：修改 `workflowJson[nodeId].inputs[fieldName]` 后提交本地 ComfyUI。
- RunningHub：把参数转换成 `nodeInfoList` 后提交 RunningHub。

RunningHub 参数格式：

```ts
{
  nodeId: string;
  fieldName: string;
  fieldValue: any;
}
```

## 7. 推荐共享类型

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
}
```

```ts
interface WorkflowParam {
  id: string;
  nodeId: string;
  classType: string;
  fieldName: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'image' | 'audio' | 'video';
  defaultValue: any;
  exposed: boolean;
  options?: string[];
}
```

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
