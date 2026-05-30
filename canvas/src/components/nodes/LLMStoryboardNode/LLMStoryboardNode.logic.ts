// LLMStoryboardNode.logic.ts

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useModelSelector } from '../../../hooks/useModelSelector';
import { getUpstreamData } from '../../../hooks/getUpstreamData';
import { Skill } from './LLMStoryboardNode.config';

interface UseLLMStoryboardLogicProps {
  id: string;
  data: any;
  setNodes: any;
  deleteElements: any;
  edges: any[];
  nodes: any[];
}

export function useLLMStoryboardLogic({
  id,
  data,
  setNodes,
  deleteElements,
  edges,
  nodes
}: UseLLMStoryboardLogicProps) {
  // 1. 连线与智能流入自愈解析器（使用统一 getUpstreamData 钩子重构）
  const upstreamData = useMemo(() => getUpstreamData(id, edges, nodes), [id, edges, nodes]);
  const connectedPrompt = upstreamData.text;
  const isPromptConnected = connectedPrompt.length > 0;

  // 状态
  const [chatModels, setChatModels] = useState<string[]>(['MiniMax-M2.7', 'MiniMax-M2.5', 'qwen-plus', 'deepseek-chat']);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState('');
  const [settings, setSettings] = useState<any>(null);

  // 初始化获取全局配置与技能库
  useEffect(() => {
    const loadSettingsAndSkills = async () => {
      try {
        const settingsRes = await fetch('/api/v1/settings');
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings(settingsData);
          if (settingsData.model_cache?.chat) {
            setChatModels(settingsData.model_cache.chat);
          }
        }

        const skillsRes = await fetch('/api/v1/skills');
        if (skillsRes.ok) {
          const skillsData = await skillsRes.json();
          setSkills(skillsData);
        }
      } catch (e) {
        console.error('加载 LLMStoryboardNode 外部依赖失败:', e);
      }
    };
    loadSettingsAndSkills();
  }, []);

  const providerId = data.inputs?.providerId || 'ali';
  const model = data.inputs?.model || '';

  // 使用统一的模型选择钩子
  const { providers: activeProviders, models: currentProviderModels, setModel: handleModelChange } = useModelSelector({
    capability: 'chat',
    settings,
    currentProviderId: providerId,
    currentModel: model,
    onProviderChange: (newProviderId) => {
      setNodes((nodes: any[]) => nodes.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, inputs: { ...n.data.inputs, providerId: newProviderId } } };
        }
        return n;
      }));
    },
    onModelChange: (newModel) => {
      setNodes((nodes: any[]) => nodes.map((n) => {
        if (n.id === id) {
          const newProviderId = currentProviderModels.includes(newModel)
            ? providerId
            : (settings?.model_cache?.chat?.length > 0
                ? Object.entries(settings.providers || {}).find(([pid, p]: [string, any]) =>
                    p.enabled && settings.model_cache.chat.includes(newModel)
                  )?.[0]
                : null) || providerId;
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...n.data.inputs,
                model: newModel,
                providerId: newProviderId !== providerId ? newProviderId : n.data.inputs?.providerId
              }
            }
          };
        }
        return n;
      }));
    }
  });

  // 当服务商或可选模型列表变化时，自动校验并重置当前选中的模型
  useEffect(() => {
    if (currentProviderModels.length > 0 && model && !currentProviderModels.includes(model)) {
      handleModelChange(currentProviderModels[0]);
    }
  }, [providerId, currentProviderModels, model, handleModelChange]);

  // 更新节点数据
  const updateNodeData = useCallback((updates: any) => {
    setNodes((nodes: any[]) =>
      nodes.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...(n.data?.inputs || {}),
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
    updateNodeData({ [field]: val });
  }, [updateNodeData]);

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] });
  }, [id, deleteElements]);

  // 手动在卡片内触发分镜专家解析
  const handleManualParse = async () => {
    const finalPrompt = isPromptConnected ? connectedPrompt : (data.inputs?.prompt || '');
    if (!finalPrompt.trim()) {
      alert('请输入或连线提供需要解析的剧本故事！');
      return;
    }

    setParsing(true);
    setParseResult('🧠 正在调遣 AI 剧本分镜专家进行场景分镜拆解...');

    try {
      const selectedSkill = skills.find(s => s.id === (data.inputs?.skillId || 'storyboard-expert'));
      const systemPrompt = selectedSkill ? selectedSkill.systemPrompt : '你是一位分镜专家，请将剧本拆解为镜头描述。';

      const res = await fetch('/api/v1/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: providerId,
          model: model || 'MiniMax-M2.1',
          messages: [{ role: 'user', content: finalPrompt }],
          systemPrompt
        })
      });

      const resData = await res.json();
      if (res.ok && resData.choices?.[0]?.message?.content) {
        const content = resData.choices[0].message.content;
        setParseResult(content);
        // 保存输出结果供下游节点连线读取，双写 storyboard 与 output
        setNodes((nodes: any[]) =>
          nodes.map((n) => {
            if (n.id === id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  outputs: {
                    ...(n.data?.outputs || {}),
                    storyboard: content,
                    output: content
                  }
                }
              };
            }
            return n;
          })
        );

        // 分发全局日记成功记录事件
        const displayModel = model || data.inputs?.model || 'MiniMax-M2.1';
        window.dispatchEvent(
          new CustomEvent('add-success-log', {
            detail: {
              nodeId: id,
              nodeName: data.title || '剧本分镜专家',
              model: displayModel,
              errorMsg: `剧本分镜解析成功 ✅ 已生成分镜内容`
            }
          })
        );
      } else {
        const errorReason = resData.error || resData.message || '接口返回了无效的大模型数据';
        setParseResult(`解析失败：${errorReason}`);
        const displayModel = model || data.inputs?.model || 'MiniMax-M2.1';

        // 分发全局日记失败记录事件
        window.dispatchEvent(
          new CustomEvent('add-failure-log', {
            detail: {
              nodeId: id,
              nodeName: data.title || '剧本分镜专家',
              model: displayModel,
              errorMsg: `分镜解析失败: ${errorReason}`
            }
          })
        );
      }
    } catch (e: any) {
      setParseResult(`解析出错：${e.message}`);
      const displayModel = model || data.inputs?.model || 'MiniMax-M2.1';
      window.dispatchEvent(
        new CustomEvent('add-failure-log', {
          detail: {
            nodeId: id,
            nodeName: data.title || '剧本分镜专家',
            model: displayModel,
            errorMsg: `分镜解析出错: ${e.message}`
          }
        })
      );
    } finally {
      setParsing(false);
    }
  };

  const currentPrompt = isPromptConnected ? connectedPrompt : (data.inputs?.prompt || '');
  const skillId = data.inputs?.skillId || 'storyboard-expert';
  const temp = data.inputs?.temperature ?? 0.7;

  const isLoopMode = !!data.inputs?.isLoopMode;
  const loopPromptsText = data.inputs?.loopPromptsText || '';
  const currentIndex = data.inputs?.currentIndex || 0;
  const autoStep = !!data.inputs?.autoStep;

  const lines = useMemo(() => {
    return loopPromptsText.split('\n').map((l: string) => l.trim()).filter(Boolean);
  }, [loopPromptsText]);

  const activeLoopPrompt = useMemo(() => {
    if (lines.length === 0) return '';
    const safeIdx = Math.max(0, Math.min(currentIndex, lines.length - 1));
    return lines[safeIdx] || '';
  }, [lines, currentIndex]);

  // 物理自刷新同步 outputs
  useEffect(() => {
    const finalVal = isLoopMode ? activeLoopPrompt : (data.outputs?.storyboard || parseResult || '');
    if (finalVal && (data.outputs?.output !== finalVal || data.outputs?.storyboard !== finalVal)) {
      setNodes((nds: any[]) =>
        nds.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                outputs: {
                  ...(n.data?.outputs || {}),
                  storyboard: finalVal,
                  output: finalVal
                }
              }
            };
          }
          return n;
        })
      );
    }
  }, [isLoopMode, activeLoopPrompt, parseResult, id, setNodes]);

  return {
    connectedPrompt,
    isPromptConnected,
    chatModels,
    skills,
    parsing,
    parseResult,
    settings,
    providerId,
    model,
    activeProviders,
    currentProviderModels,
    handleInputChange,
    handleDelete,
    handleManualParse,
    currentPrompt,
    skillId,
    temp,
    isLoopMode,
    loopPromptsText,
    currentIndex,
    autoStep,
    lines,
    activeLoopPrompt
  };
}
