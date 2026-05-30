import { useState, useEffect, useMemo, useCallback } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import { getUpstreamData } from '../../../hooks/getUpstreamData';
import {
  LoopNodeProps,
  MIN_MANUAL_COUNT,
  MAX_MANUAL_COUNT,
  MIN_CONCURRENT_LIMIT,
  MAX_CONCURRENT_LIMIT,
} from './LoopNode.config';

interface UseLoopNodeLogicProps {
  id: string;
  data: LoopNodeProps['data'];
  edges: Edge[];
  nodes: Node[];
}

export function useLoopNodeLogic({ id, data, edges, nodes }: UseLoopNodeLogicProps) {
  const { setNodes, setEdges } = useReactFlow();

  // 1. 多选检测：只有单选时才显示菜单
  const isMultiSelected = useStore((state) => {
    return state.nodes.filter(n => n.selected).length > 1;
  });

  // 2. 扫描上游连线（改用统一的 getUpstreamData 钩子读取）
  const upstreamData = useMemo(() => getUpstreamData(id, edges, nodes), [id, edges, nodes]);
  
  const connectedInput = useMemo(() => {
    // 只要有任何 text 类型上游输入，我们就取其最完整合并后的文本
    return upstreamData.text || '';
  }, [upstreamData]);

  const hasUpstreamSource = connectedInput.length > 0;

  // 3. 基础参数与状态
  const loopSource = data.inputs?.loopSource || (hasUpstreamSource ? 'upstream' : 'manual');
  const manualCount = data.inputs?.manualCount || 3;
  const runMode = data.inputs?.runMode || 'concurrent';
  const maxConcurrent = data.inputs?.maxConcurrent || 3;

  // 双击重命名逻辑与状态对齐
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '批量循环迭代');

  useEffect(() => {
    setLocalName(data.label || '批量循环迭代');
  }, [data.label]);

  const handleSaveName = useCallback(() => {
    setIsEditingName(false);
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, label: localName } };
        }
        return n;
      })
    );
  }, [id, localName, setNodes]);

  const updateNodeInputs = useCallback((updates: any) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                ...updates
              }
            }
          };
        }
        return n;
      })
    );
  }, [id, setNodes]);

  const handleInputChange = useCallback((field: string, val: any) => {
    updateNodeInputs({ [field]: val });
  }, [updateNodeInputs]);

  // 微量步进器控制
  const decrementManual = useCallback(() => {
    const newVal = Math.max(MIN_MANUAL_COUNT, manualCount - 1);
    updateNodeInputs({ manualCount: newVal });
  }, [manualCount, updateNodeInputs]);

  const incrementManual = useCallback(() => {
    const newVal = Math.min(MAX_MANUAL_COUNT, manualCount + 1);
    updateNodeInputs({ manualCount: newVal });
  }, [manualCount, updateNodeInputs]);

  const decrementConcurrent = useCallback(() => {
    const newVal = Math.max(MIN_CONCURRENT_LIMIT, maxConcurrent - 1);
    updateNodeInputs({ maxConcurrent: newVal });
  }, [maxConcurrent, updateNodeInputs]);

  const incrementConcurrent = useCallback(() => {
    const newVal = Math.min(MAX_CONCURRENT_LIMIT, maxConcurrent + 1);
    updateNodeInputs({ maxConcurrent: newVal });
  }, [maxConcurrent, updateNodeInputs]);

  // 进度控制
  const currentIndex = data.outputs?.currentIndex || 0;
  const total = data.outputs?.total || 0;
  const progressPct = total > 0 ? Math.round((currentIndex / total) * 100) : 0;
  const isRunning = data.outputs?.currentIndex !== undefined && currentIndex < total && currentIndex > 0;

  // 根据数据源解析当前的循环项目数
  const parsedCount = useMemo(() => {
    if (loopSource === 'manual') {
      return manualCount;
    }
    if (!connectedInput) return 0;
    try {
      const parsed = JSON.parse(connectedInput.trim());
      if (Array.isArray(parsed)) return parsed.length;
    } catch (e) {
      return connectedInput.split('\n').filter((l: string) => l.trim()).length;
    }
    return 0;
  }, [loopSource, manualCount, connectedInput]);

  const handleDelete = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [id, setNodes, setEdges]);

  return {
    isMultiSelected,
    hasUpstreamSource,
    loopSource,
    manualCount,
    runMode,
    maxConcurrent,
    isEditingName,
    localName,
    currentIndex,
    total,
    progressPct,
    isRunning,
    parsedCount,
    setIsEditingName,
    setLocalName,
    handleSaveName,
    handleInputChange,
    decrementManual,
    incrementManual,
    decrementConcurrent,
    incrementConcurrent,
    handleDelete
  };
}
