import { useState, useEffect, useRef, useMemo } from 'react';
import { RunningHubService } from '../../../services/runninghub.service';

// 定义 TTS 默认服务商与模型列表
export const DEFAULT_PROVIDER_TTS_MODELS: Record<string, string[]> = {
  minimax: ['speech-01-turbo', 'speech-01'],
  openai: ['tts-1', 'tts-1-hd'],
  volcengine: ['volc-tts-premium', 'volc-tts-standard'],
  suno: ['suno-v3', 'suno-v4']
};

interface UseTTSNodeLogicProps {
  id: string;
  data: any;
  setNodes: any;
  setEdges: any;
  connectedPrompt: string;
  connectedRefAudio: string;
  isRefAudioConnected: boolean;
  isTextConnected: boolean;
}

export function useTTSNodeLogic({
  id,
  data,
  setNodes,
  setEdges,
  connectedPrompt,
  connectedRefAudio,
  isRefAudioConnected,
  isTextConnected
}: UseTTSNodeLogicProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);

  // 1. 提取基础输入参数
  const mode = data.inputs?.mode || 'direct';
  const providerId = data.inputs?.providerId || 'minimax';
  const characterName = data.inputs?.characterName || '剧本男主';
  const refAudio = data.inputs?.refAudio || '';
  const currentRefAudio = isRefAudioConnected ? connectedRefAudio : refAudio;
  const workflowIdOrJson = data.inputs?.workflowIdOrJson || '';

  // 2. 状态管理
  const [activeTab, setActiveTab] = useState<'standard' | 'aix'>(data.inputs?.activeTab || 'standard');
  const [runningHubTemplateId, setRunningHubTemplateId] = useState<string>(data.inputs?.runningHubTemplateId || 'rh_wf_voice_consistency');
  const [ttsModels, setTtsModels] = useState<string[]>(['fish-speech-1.4', 'minimax-tts-clone', 'volc-tts-premium']);
  const [cloning, setCloning] = useState(false);
  const [clonedAudio, setClonedAudio] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '音频');
  const [isPlaying, setIsPlaying] = useState(false);

  // 3. 同步本地名称
  useEffect(() => {
    if (data.label) {
      setLocalName(data.label);
    }
  }, [data.label]);

  // 4. 获取 RunningHub 模板列表
  const [workflows, setWorkflows] = useState<any[]>(() => 
    RunningHubService.getWorkflows().filter(w => !w.capability || w.capability === 'audio')
  );
  useEffect(() => {
    const handleUpdate = () => {
      setWorkflows(RunningHubService.getWorkflows().filter(w => !w.capability || w.capability === 'audio'));
    };
    window.addEventListener('runninghub_workflows_updated', handleUpdate);
    return () => window.removeEventListener('runninghub_workflows_updated', handleUpdate);
  }, []);
  const currentTemplate = useMemo(() => {
    if (data.inputs?.customTemplate) {
      return data.inputs.customTemplate;
    }
    return workflows.find(w => w.id === runningHubTemplateId) || workflows[0];
  }, [workflows, runningHubTemplateId, data.inputs?.customTemplate]);

  const unifiedParams = useMemo(() => {
    if (!currentTemplate) return [];
    if (currentTemplate.paramsSchema) {
      // 本地ComfyUI/RunningHub自定义模板参数定义
      return currentTemplate.paramsSchema.map((p: any) => ({
        nodeId: p.nodeId,
        fieldName: p.fieldName,
        fieldType: p.type === 'number' ? 'number' : 'string',
        fieldValue: p.defaultValue,
        description: p.label || p.fieldName,
        exposed: p.exposed,
        portId: p.id,
        type: p.type
      }));
    } else if (currentTemplate.nodeInfoList) {
      // 官方云端预设模板参数定义
      return currentTemplate.nodeInfoList.map((info: any) => ({
        nodeId: info.nodeId,
        fieldName: info.fieldName,
        fieldType: info.fieldType,
        fieldValue: info.fieldValue,
        description: info.description,
        exposed: true,
        portId: `${info.nodeId}_${info.fieldName}`,
        type: 'text'
      }));
    }
    return [];
  }, [currentTemplate]);

  // 5. 扫描本地 10588 物理资产端口并自动装载
  useEffect(() => {
    const fetchPhysicalAudioLock = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const projectId = searchParams.get('projectId') || 'default_project';
        const res = await fetch(`http://localhost:10588/api/cornerScape/getAllAssets?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const audioAsset = data.find((asset: any) => 
              asset.type === 'audio' || 
              (asset.filePath && (asset.filePath.toLowerCase().endsWith('.mp3') || asset.filePath.toLowerCase().endsWith('.wav')))
            );
            if (audioAsset && audioAsset.filePath) {
              const lockedUrl = `http://localhost:10588/api/assets/download?path=${encodeURIComponent(audioAsset.filePath)}`;
              updateNodeData({ refAudio: lockedUrl });
            }
          }
        }
      } catch (e) {
        console.warn('[TTS] 本地 10588 端口 API 扫描跳过或未运行:', e);
      }
    };
    fetchPhysicalAudioLock();
  }, []);

  // 6. 加载全局配置大模型列表
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/v1/settings');
        if (res.ok) {
          const settingsData = await res.json();
          setSettings(settingsData);
          if (settingsData.model_cache?.tts) {
            setTtsModels(settingsData.model_cache.tts);
          }
        }
      } catch (e) {
        console.error('加载 TTSServiceNode 外部依赖失败:', e);
      }
    };
    loadSettings();
  }, []);

  // 7. 大语言音频服务商可选模型联动列表
  const currentProviderModels = useMemo(() => {
    const defaultModels = DEFAULT_PROVIDER_TTS_MODELS[providerId] || [];
    if (!settings || !settings.providers || !settings.providers[providerId]) {
      return defaultModels;
    }
    const provider = settings.providers[providerId];
    if (!provider.models || !Array.isArray(provider.models)) {
      return defaultModels;
    }
    const ttsKeywords = ['tts', 'speech', 'voice', 'clone', 'fish', 'sound', 'talk', 'suno', 'music'];
    const filtered = provider.models.filter((m: string) => {
      const lowerM = m.toLowerCase();
      return ttsKeywords.some(kw => lowerM.includes(kw));
    });
    return filtered.length > 0 ? filtered : defaultModels;
  }, [settings, providerId]);

  const model = data.inputs?.model || currentProviderModels[0] || 'fish-speech-1.4';

  // 8. 自动校准当前选中的模型
  useEffect(() => {
    if (currentProviderModels.length > 0) {
      if (!currentProviderModels.includes(model)) {
        handleInputChange('model', currentProviderModels[0]);
      }
    }
  }, [providerId, currentProviderModels, model]);

  // 9. 更新节点 Data 的底层函数
  const updateNodeData = (updates: any) => {
    setNodes((nodes: any[]) =>
      nodes.map((n) => {
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
  };

  const handleInputChange = (field: string, val: any) => {
    updateNodeData({ [field]: val });
  };

  // 10. 保存修改后的节点名称
  const handleSaveName = () => {
    setIsEditingName(false);
    if (localName.trim()) {
      setNodes((nds: any[]) =>
        nds.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                label: localName.trim(),
              },
            };
          }
          return n;
        })
      );
    }
  };

  // 11. 打开全局大型资产/模板选择弹窗
  const handleOpenAssetsModal = (type: 'image' | 'video' | 'audio' = 'audio') => {
    window.dispatchEvent(
      new CustomEvent('open-large-modal', {
        detail: { tab: 'assets', nodeTarget: id, type }
      })
    );
  };

  const handleTabChange = (tab: 'standard' | 'aix') => {
    setActiveTab(tab);
    handleInputChange('activeTab', tab);
  };

  const handleTemplateChange = (templateId: string) => {
    setRunningHubTemplateId(templateId);
    handleInputChange('runningHubTemplateId', templateId);
  };

  const handleDelete = () => {
    setNodes((nds: any[]) => nds.filter((n) => n.id !== id));
    setEdges((eds: any[]) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  // 12. 文件上传与拖拽机制
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readAudioAsBase64(file);
  };

  const readAudioAsBase64 = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleInputChange('refAudio', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      readAudioAsBase64(file);
    }
  };

  // 13. 音频下载与试听播放机制
  const handleDownloadAudio = () => {
    const audUrl = clonedAudio || data.outputs?.audio;
    if (!audUrl) {
      alert('暂无可下载的音频结果！');
      return;
    }
    if (typeof (window as any).downloadFileDirectly === 'function') {
      (window as any).downloadFileDirectly(audUrl, `toonflow-audio-${id}.mp3`);
    } else {
      const a = document.createElement('a');
      a.href = audUrl;
      a.download = `toonflow-audio-${id}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleTogglePlay = () => {
    const audUrl = clonedAudio || data.outputs?.audio;
    if (!audUrl) return;
    if (isPlaying) {
      audioPreviewRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioPreviewRef.current?.play();
      setIsPlaying(true);
    }
  };

  // 14. 核心：发起声色克隆/工作流合成任务
  const handleVoiceClone = async () => {
    const finalText = isTextConnected ? connectedPrompt : (data.inputs?.text || '');
    setCloning(true);
    setClonedAudio('');

    try {
      if (activeTab === 'aix') {
        if (!currentTemplate) {
          alert('请选择有效的 RunningHub 云端工作流模板！');
          setCloning(false);
          return;
        }

        // 构建 aix 运行所需的 inputs 参数映射
        const aixInputs: Record<string, any> = {};
        let textParamIndex = 0;
        let audioParamIndex = 0;

        unifiedParams.forEach((p: any) => {
          const fieldLower = p.fieldName.toLowerCase();
          const displayLower = (p.description || '').toLowerCase();
          const inputKey = p.portId;

          const isText = fieldLower === 'text' || fieldLower === 'prompt' || fieldLower === 'instruction' || fieldLower === 'description' || displayLower.includes('提示词') || displayLower.includes('文本') || displayLower.includes('指令');
          const isAudio = p.type === 'audio' || fieldLower === 'audio' || fieldLower === 'refaudio' || fieldLower === 'ref_audio' || displayLower.includes('音频') || displayLower.includes('声音') || displayLower.includes('配音');

          if (isText) {
            if (textParamIndex === 0) {
              aixInputs[inputKey] = finalText;
            } else {
              aixInputs[inputKey] = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;
            }
            textParamIndex++;
          } else if (isAudio) {
            if (audioParamIndex === 0) {
              aixInputs[inputKey] = currentRefAudio;
            } else {
              aixInputs[inputKey] = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;
            }
            audioParamIndex++;
          } else {
            aixInputs[inputKey] = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;
          }
        });

        // Kahn 拓扑数据流 mappings
        const dynamicMappings = unifiedParams.map((p: any) => {
          const fieldLower = p.fieldName.toLowerCase();
          const displayLower = (p.description || '').toLowerCase();
          const inputKey = p.portId;

          const isText = fieldLower === 'text' || fieldLower === 'prompt' || fieldLower === 'instruction' || fieldLower === 'description' || displayLower.includes('提示词') || displayLower.includes('文本') || displayLower.includes('指令');
          const isAudio = p.type === 'audio' || fieldLower === 'audio' || fieldLower === 'refaudio' || fieldLower === 'ref_audio' || displayLower.includes('音频') || displayLower.includes('声音') || displayLower.includes('配音');

          let val = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;
          if (isText) {
            val = finalText;
          } else if (isAudio) {
            val = currentRefAudio;
          }

          return {
            portId: p.fieldName,
            nodeId: p.nodeId,
            fieldName: p.fieldName,
            displayName: p.description || p.fieldName,
            value: val
          };
        });

        // 提交云端工作流
        const outputUrl = await RunningHubService.executeCustomWorkflow(
          'runninghub',
          currentTemplate.appId,
          aixInputs,
          dynamicMappings
        );

        if (outputUrl) {
          const finalUrl = outputUrl.startsWith('http') ? outputUrl : `http://localhost:4000${outputUrl}`;
          setClonedAudio(finalUrl);

          setNodes((nodes: any[]) =>
            nodes.map((n) => {
              if (n.id === id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    outputs: {
                      ...((n.data as any)?.outputs || {}),
                      audio: finalUrl,
                      output: finalUrl,
                      errorMsg: ''
                    }
                  }
                };
              }
              return n;
            })
          );

          window.dispatchEvent(
            new CustomEvent('add-success-log', {
              detail: {
                nodeId: id,
                nodeName: data.label || data.title || 'TTS 语音克隆',
                model: currentTemplate.name,
                errorMsg: '云端 RunningHub 任务执行成功 ✅',
                outputUrl: finalUrl,
                type: 'audio'
              }
            })
          );
        } else {
          throw new Error('云端任务已完成，但未返回有效的音频成果 URL。');
        }

      } else {
        // Standard 直连克隆模式
        if (!finalText.trim()) {
          alert('请输入或连线提供配音台词文本！');
          setCloning(false);
          return;
        }

        if (providerId !== 'suno' && !currentRefAudio) {
          alert('请上传或拖入一段 10 秒以上的声音克隆参考音频！');
          setCloning(false);
          return;
        }

        const res = await fetch('http://localhost:3000/api/v1/workflow/tts/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: currentRefAudio,
            characterName: characterName,
            text: finalText,
            providerId: providerId,
            model: model,
            mode: mode,
            workflowIdOrJson: workflowIdOrJson
          })
        });

        const resData = await res.json();
        if (resData.success && resData.audioUrl) {
          const audio = resData.audioUrl.startsWith('http') 
            ? resData.audioUrl 
            : `http://localhost:4000${resData.audioUrl}`;
          
          setClonedAudio(audio);

          setNodes((nodes: any[]) =>
            nodes.map((n) => {
              if (n.id === id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    outputs: {
                      ...((n.data as any)?.outputs || {}),
                      audio: audio,
                      output: audio,
                      errorMsg: ''
                    }
                  }
                };
              }
              return n;
            })
          );

          window.dispatchEvent(
            new CustomEvent('add-success-log', {
              detail: {
                nodeId: id,
                nodeName: data.label || data.title || 'TTS 语音克隆',
                model: model,
                errorMsg: `音频配音生成成功 ✅ 服务商: ${providerId}`,
                outputUrl: audio,
                type: 'audio'
              }
            })
          );
        } else {
          const errorReason = resData.error || '未生成音频链接';
          throw new Error(errorReason);
        }
      }
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.message || '音频生成失败';
      setClonedAudio('');
      setNodes((nodes: any[]) =>
        nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                outputs: {
                  ...((n.data as any)?.outputs || {}),
                  audio: '',
                  output: '',
                  errorMsg: errorMsg
                }
              }
            };
          }
          return n;
        })
      );
      
      window.dispatchEvent(
        new CustomEvent('add-failure-log', {
          detail: {
            nodeId: id,
            nodeName: data.title || 'TTS 语音克隆',
            model: activeTab === 'aix' ? (currentTemplate?.name || 'aix') : model,
            errorMsg: errorMsg
          }
        })
      );
    } finally {
      setCloning(false);
    }
  };

  // 15. 连线派生器
  const handleSpawnPromptSource = () => {
    if ((window as any).spawnLinkedNode) {
      (window as any).spawnLinkedNode(id, 'prompt-source', 'left');
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  };

  const handleSpawnAudioUpload = () => {
    if ((window as any).spawnLinkedNode) {
      (window as any).spawnLinkedNode(id, 'upload-node', 'left', { fileType: 'audio' });
      window.dispatchEvent(
        new CustomEvent('open-large-modal', {
          detail: { tab: 'assets', nodeTarget: id, type: 'audio' }
        })
      );
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  };

  return {
    // 基础输入及配置状态
    mode,
    providerId,
    characterName,
    refAudio,
    currentRefAudio,
    workflowIdOrJson,
    activeTab,
    runningHubTemplateId,
    ttsModels,
    cloning,
    clonedAudio,
    settings,
    isEditingName,
    localName,
    isPlaying,
    currentTemplate,
    unifiedParams,
    currentProviderModels,
    model,

    // 交互引用
    fileInputRef,
    audioPreviewRef,

    // 触发函数
    setLocalName,
    setIsEditingName,
    setIsPlaying,
    handleSaveName,
    handleTabChange,
    handleInputChange,
    handleTemplateChange,
    handleDelete,
    handleFileChange,
    handleDragOver,
    handleDrop,
    handleDownloadAudio,
    handleTogglePlay,
    handleVoiceClone,
    handleSpawnPromptSource,
    handleSpawnAudioUpload,
    handleOpenAssetsModal
  };
}
