/**
 * 统一工作流选择钩子 (useWorkflowSelector)
 *
 * 职责：统一管理 RH/CF 工作流的加载、切换、合并逻辑
 *
 * 数据来源：
 *  - RunningHubService.getWorkflows()      → RH 预设 + 用户自定义工作流
 *  - WorkflowTemplateService.listTemplates() → 后端保存的 ComfyUI 本地模板
 *
 * 使用方式：
 *  - 生图/视频/TTS 节点的 AIX 模式：useWorkflowSelector('image'|'video'|'audio')
 *  - CustomWorkflowNode:                  useWorkflowSelector('workflow')
 *  - 工具栏快捷按钮:                      useWorkflowSelector(capability, source)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { RunningHubService } from '../services/runninghub.service';
import { WorkflowTemplateService } from '../services/workflow-template.service';
import { RunningHubWorkflow } from '../config/runninghub.config';

// ====================== 类型定义 ======================

export type WorkflowCapability = 'image' | 'video' | 'audio' | 'workflow';
export type WorkflowSource = 'local_comfyui' | 'runninghub';

export interface WorkflowItem {
  id: string;
  name: string;
  source: WorkflowSource;
  /** 'runninghub' 时为 appId，'local_comfyui' 时为 JSON 字符串 */
  workflowRef?: string;
  /** ComfyUI 工作流原始 JSON */
  rawWorkflowJson?: Record<string, any>;
  webLink?: string;
  /** 描述 */
  description?: string;
  /** 预览图 */
  previewImage?: string;
  /** 所属厂商（仅 RH 有） */
  appId?: string;
  /** 节点信息（仅 RH 预设有） */
  nodeInfoList?: any[];
  /** 参数定义 schema（仅 ComfyUI 模板有） */
  paramsSchema?: any[];
  inputMappings?: any[];
  outputMapping?: any;
  /** 能力标签 */
  capability: WorkflowCapability;
  createdAt?: string;
  updatedAt?: string;
}

export interface UseWorkflowSelectorProps {
  /** 工作流能力类型 */
  capability: WorkflowCapability;
  /** 仅返回指定 source 的工作流（不传则返回合并列表） */
  source?: WorkflowSource;
  /** 当前选中的工作流 ID */
  currentWorkflowId?: string;
  /** 切换回调 */
  onChange?: (wf: WorkflowItem | null) => void;
}

export interface UseWorkflowSelectorReturn {
  /** 合并后的完整工作流列表（已按 capability/source 过滤） */
  workflows: WorkflowItem[];
  /** 当前选中的工作流对象 */
  currentWorkflow: WorkflowItem | null;
  /** 按 source 分组的列表 */
  workflowsBySource: Record<WorkflowSource, WorkflowItem[]>;
  /** 加载中 */
  loading: boolean;
  /** 加载失败 */
  error: string | null;
  /** 切换工作流 */
  switchWorkflow: (wfId: string) => void;
  /** 刷新列表（重新拉取后端模板） */
  refresh: () => void;
}

// ====================== 工具函数 ======================

/** 判断工作流是否匹配给定 capability */
function matchesCapability(wf: WorkflowItem, cap: WorkflowCapability): boolean {
  if (cap === 'workflow') return true;
  return !wf.capability || wf.capability === cap || wf.capability === 'workflow';
}

// ====================== 钩子实现 ======================

export function useWorkflowSelector({
  capability,
  source,
  currentWorkflowId,
  onChange,
}: UseWorkflowSelectorProps): UseWorkflowSelectorReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 手动选中的工作流 ID（受控） */
  const [selectedId, setSelectedId] = useState<string | undefined>(currentWorkflowId);

  // 订阅 localStorage 变更事件，触发刷新
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('runninghub_workflows_updated', handler);
    return () => window.removeEventListener('runninghub_workflows_updated', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步外部 currentWorkflowId 变化
  useEffect(() => {
    if (currentWorkflowId !== undefined) {
      setSelectedId(currentWorkflowId);
    }
  }, [currentWorkflowId]);

  /** 加载合并后的工作流列表 */
  const loadWorkflows = useCallback(async (): Promise<WorkflowItem[]> => {
    // 1. 从 RunningHub 获取 RH 工作流
    const rhRaw = RunningHubService.getWorkflows();

    // 2. 从后端获取 ComfyUI 本地模板
    let cfTemplates: WorkflowItem[] = [];
    try {
      const templates = await WorkflowTemplateService.listTemplates();
      cfTemplates = templates.map((t: any) => ({
        id: t.id,
        name: t.name,
        source: 'local_comfyui' as WorkflowSource,
        workflowRef: t.workflowRef,
        rawWorkflowJson: t.rawWorkflowJson,
        webLink: t.webLink,
        description: t.description,
        previewImage: t.previewImage,
        paramsSchema: t.paramsSchema,
        inputMappings: t.inputMappings,
        outputMapping: t.outputMapping,
        capability: t.capability || 'workflow',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));
    } catch (e: any) {
      console.warn('[useWorkflowSelector] Failed to load CF templates:', e.message);
    }

    // 3. 合并去重（RH 以 id 为准，CF 拼接前缀避免冲突）
    const merged: WorkflowItem[] = [];

    // RH 工作流
    for (const w of rhRaw) {
      if (!matchesCapability(w as unknown as WorkflowItem, capability)) continue;
      merged.push({
        id: w.id,
        name: w.name,
        source: 'runninghub',
        workflowRef: w.appId || w.id,
        description: w.description,
        nodeInfoList: w.nodeInfoList,
        capability: (w.capability as WorkflowCapability) || 'workflow',
        appId: w.appId,
      });
    }

    // ComfyUI 模板（id 前缀区分）
    for (const t of cfTemplates) {
      if (!matchesCapability(t, capability)) continue;
      const prefixedId = `cf_${t.id}`;
      if (!merged.some(w => w.id === prefixedId)) {
        merged.push({ ...t, id: prefixedId });
      }
    }

    return merged;
  }, [capability]);

  // 初始加载 + 刷新
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await loadWorkflows();
      setWorkflows(list);
    } catch (e: any) {
      setError(e.message);
      console.error('[useWorkflowSelector] Failed to load workflows:', e);
    } finally {
      setLoading(false);
    }
  }, [loadWorkflows]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 当前选中的工作流
  const currentWorkflow = useMemo(() => {
    if (!selectedId) return workflows[0] || null;
    return workflows.find(w => w.id === selectedId) || workflows[0] || null;
  }, [workflows, selectedId]);

  // 按 source 分组
  const workflowsBySource = useMemo(() => ({
    runninghub: workflows.filter(w => w.source === 'runninghub'),
    local_comfyui: workflows.filter(w => w.source === 'local_comfyui'),
  }), [workflows]);

  // 切换工作流
  const switchWorkflow = useCallback((wfId: string) => {
    setSelectedId(wfId);
    const wf = workflows.find(w => w.id === wfId) || null;
    onChange?.(wf);
  }, [workflows, onChange]);

  return {
    workflows,
    currentWorkflow,
    workflowsBySource,
    loading,
    error,
    switchWorkflow,
    refresh,
  };
}
