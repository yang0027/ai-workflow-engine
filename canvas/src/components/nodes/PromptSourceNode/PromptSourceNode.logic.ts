import { useState, useEffect, useMemo, useCallback } from 'react';
import { useReactFlow, useStore, useNodes } from '@xyflow/react';
import { PromptSourceNodeData, TableRow, DOWNSTREAM_TYPES } from './PromptSourceNode.config';
import { executeNode } from '../../../hooks/executeNode';
import { getUpstreamData } from '../../../hooks/getUpstreamData';
import type { UpstreamData } from '../../../hooks/getUpstreamData';

export interface UsePromptSourceNodeLogicProps {
  id: string;
  data: PromptSourceNodeData;
  selected?: boolean;
}

export interface UsePromptSourceNodeLogicReturn {
  // 状态
  settings: any;
  tableRows: TableRow[];
  selectedModel: string;
  textVal: string;
  currentMode: string;
  connectedImage: string;
  connectedImageRef: { url: string; nodeId: string } | null;
  connectedVideo: string;
  connectedVideoRef: { url: string; nodeId: string } | null;
  localName: string;
  isEditingName: boolean;
  isEditing: boolean;
  showTableEditor: boolean;
  generating: boolean;
  upstreamTypes: any[];
  downstreamTypes: typeof DOWNSTREAM_TYPES;

  // 业务方法
  handleTextChange: (val: string) => void;
  doProviderChange: (providerId: string, modelName?: string) => void;
  doModelChange: (modelName: string) => void;
  handleGenerate: () => Promise<void>;
  handleSpawnImageService: () => void;
  handleSpawnUploadNode: () => void;
  handleDelete: () => void;
  handleSaveName: () => void;
  setIsEditingName: (v: boolean) => void;
  setLocalName: (v: string) => void;
  setIsEditing: (v: boolean) => void;
  setShowTableEditor: (v: boolean) => void;
  handleUpdateTableCell: (index: number, key: 'scene' | 'prompt' | 'tts', val: string) => void;
  handleAddTableRow: () => void;
  handleRemoveTableRow: (index: number) => void;
  syncTableToText: (rows: TableRow[]) => void;
  resolveMediaUrl: (url: string) => string;
  handleModeChange: (modeId: string) => void;
}

export function usePromptSourceNodeLogic({
  id,
  data,
  selected,
}: UsePromptSourceNodeLogicProps): UsePromptSourceNodeLogicReturn {
  const { setNodes, setEdges } = useReactFlow();
  const edges = useStore((state) => state.edges);
  const nodes = useNodes();

  // settings 用于模型选择器（provider/model 列表）
  const [settings, setSettings] = useState<any>(null);
  useEffect(() => {
    fetch('/api/v1/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => data && setSettings(data))
      .catch(() => {});
  }, []);

  // 表格编辑器状态
  const [tableRows, setTableRows] = useState<TableRow[]>([
    { scene: '1', prompt: '反重力城堡，代码雨逆流升空', tts: '在这个反重力世界中...' }
  ]);

  // 选中的模型：providerId 和 model 都从 node data 读取
  const activeVendor = data.inputs?.providerId || 'ali';
  const selectedModel = data.inputs?.model || '';

  // 文本值
  const textVal = data.inputs?.text || '';
  const currentMode = data.inputs?.mode || 'text';

  // Connected upload image scanning — 返回 URL 和来源节点 ID
  const connectedImageRef = useMemo((): { url: string; nodeId: string } | null => {
    const connectedEdges = edges.filter(e => e.target === id && e.targetHandle === 'input');
    for (const edge of connectedEdges) {
      const srcNode = nodes.find(n => n.id === edge.source);
      if (!srcNode) continue;
      const outputs = (srcNode.data?.outputs || {}) as any;
      const inputs = (srcNode.data?.inputs || {}) as any;
      const val = outputs.output || outputs.image || inputs.fileUrl || '';
      if (!val || typeof val !== 'string') continue;

      const uploadFileType = inputs?.fileType || outputs?.fileType;
      const isVideoOrAudio =
        val.endsWith('.mp3') || val.endsWith('.wav') || val.endsWith('.ogg') || val.endsWith('.m4a') ||
        val.endsWith('.mp4') || val.endsWith('.webm') || val.endsWith('.mov') ||
        val.startsWith('data:audio/') || val.startsWith('data:video/') ||
        (val.includes('media-asset-') && (val.includes('audio') || val.includes('video'))) ||
        srcNode.type === 'tts-service' ||
        (srcNode.type === 'upload-node' && (uploadFileType === 'audio' || uploadFileType === 'video'));

      if (isVideoOrAudio) continue;

      const isImage =
        val.startsWith('data:image/') ||
        val.endsWith('.png') || val.endsWith('.jpg') || val.endsWith('.jpeg') || val.endsWith('.webp') ||
        srcNode.type === 'image-service' ||
        (srcNode.type === 'upload-node' && (uploadFileType === 'image' || !uploadFileType || val.startsWith('db://')));

      if (isImage) {
        return { url: val, nodeId: srcNode.id };
      }
    }
    return null;
  }, [edges, nodes, id]);

  // Connected upload video scanning — 返回 URL 和来源节点 ID
  const connectedVideoRef = useMemo((): { url: string; nodeId: string } | null => {
    const connectedEdges = edges.filter(e => e.target === id && e.targetHandle === 'input');
    for (const edge of connectedEdges) {
      const srcNode = nodes.find(n => n.id === edge.source);
      if (!srcNode) continue;
      const outputs = (srcNode.data?.outputs || {}) as any;
      const inputs = (srcNode.data?.inputs || {}) as any;
      const val = outputs.output || outputs.video || inputs.fileUrl || '';
      if (!val || typeof val !== 'string') continue;

      const uploadFileType = inputs?.fileType || outputs?.fileType;
      const isVideo =
        val.endsWith('.mp4') || val.endsWith('.webm') || val.endsWith('.mov') ||
        val.startsWith('data:video/') ||
        (val.includes('media-asset-') && val.includes('video')) ||
        (srcNode.type === 'upload-node' && uploadFileType === 'video');

      if (isVideo) {
        return { url: val, nodeId: srcNode.id };
      }
    }
    return null;
  }, [edges, nodes, id]);

  // 兼容旧代码的便捷访问器
  const connectedImage = connectedImageRef?.url || '';
  const connectedVideo = connectedVideoRef?.url || '';

  // 同步编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [showTableEditor, setShowTableEditor] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '文本');

  useEffect(() => {
    const textVal2 = data.inputs?.text || '';
    if (!selected) {
      if (!textVal2.trim()) {
        setIsEditing(false);
      }
      setShowTableEditor(false);
    } else {
      setIsEditing(true);
    }
  }, [selected, data.inputs?.text]);

  useEffect(() => {
    if (data.label) {
      setLocalName(data.label);
    }
  }, [data.label]);

  // 解析 media URL
  const resolveMediaUrl = useCallback((url: string) => {
    if (url.startsWith('db://')) {
      const mediaId = url.replace('db://', '');
      return localStorage.getItem(`resolved-${mediaId}`) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe';
    }
    return url;
  }, []);

  // db:// 媒体解析
  useEffect(() => {
    if (connectedImage && connectedImage.startsWith('db://')) {
      const mediaId = connectedImage.replace('db://', '');
      const getMedia = (window as any).getMediaFromDB;
      if (typeof getMedia === 'function') {
        getMedia(mediaId).then((resolvedData: string) => {
          if (resolvedData) {
            localStorage.setItem(`resolved-${mediaId}`, resolvedData);
            setNodes(nds => [...nds]);
          }
        });
      }
    }
  }, [connectedImage]);

  const handleTextChange = useCallback((val: string) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                text: val
              },
              outputs: {
                ...((n.data as any)?.outputs || {}),
                text: val,
                output: val
              }
            }
          };
        }
        return n;
      })
    );
  }, [id, setNodes]);

  const doProviderChange = useCallback((providerId: string, modelName?: string) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                providerId,
                ...(modelName !== undefined ? { model: modelName } : {})
              }
            }
          };
        }
        return n;
      })
    );
  }, [id, setNodes]);

  const doModelChange = useCallback((modelName: string) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === id) {
          const newProviderId = Object.entries(settings?.providers || {}).find(([, provider]: [string, any]) =>
            provider?.enabled && Array.isArray(provider?.models) && provider.models.includes(modelName)
          )?.[0] || (n.data as any)?.inputs?.providerId || activeVendor;

          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                providerId: newProviderId,
                model: modelName
              }
            }
          };
        }
        return n;
      })
    );
  }, [id, setNodes, settings, activeVendor]);

  const handleGenerate = useCallback(async () => {
    const textVal2 = data.inputs?.text || '';
    const upstream: UpstreamData = getUpstreamData(id, edges, nodes);
    const hasImage = !!upstream.image || upstream.images.length > 0;

    if (!textVal2.trim() && !hasImage) {
      alert('请输入剧本或小说原文描述，或者在左侧连线上传图像进行反推！');
      return;
    }

    setGenerating(true);

    try {
      // systemPrompt 根据是否有图或工作模式进行智能分流选择
      const systemPrompt = currentMode === 'lyrics'
        ? "你是一位顶级音乐作词人与 Suno 提示词结构专家。请根据用户提供的主题、情感或故事，创作结构完整且极具韵律感的中文歌词（包含 [Verse], [Chorus], [Bridge], [Outro] 等结构标记），并给出适合 Suno 生成该音乐的风格与情绪提示词。"
        : (hasImage
            ? "你是一位顶级 AI 图像提示词反推与润色专家。请根据用户提供的参考图反推出高质量的 Midjourney/Stable Diffusion 英文与中文生图提示词，要求画面富有电影感与视觉冲击力。"
            : "你是一位全能的 AI 画布助手与提示词精炼专家。请对用户提供的任意文本进行智能优化、提炼、或者将其润色为符合工作流语境的高质量提示词。");

      const nodeInputsWithSystem = {
        ...data.inputs,
        systemPrompt,
      };

      const result = await executeNode({
        nodeId: id,
        nodeType: 'prompt-source',
        mediaType: 'text',
        actionType: 'chat',
        upstreamData: upstream,
        modelConfig: {
          providerId: activeVendor,
          modelId: selectedModel,
        },
        nodeInputs: nodeInputsWithSystem,
      });

      if (!result.success) {
        const errMsg = result.error?.message || '剧本处理失败';
        window.dispatchEvent(
          new CustomEvent('add-failure-log', {
            detail: {
              nodeId: id,
              nodeName: data.label || '文本',
              model: selectedModel,
              errorMsg: errMsg,
            }
          })
        );
        setGenerating(false);
        return;
      }

      const resultText = result.data?.content || '';

      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                inputs: {
                  ...((n.data as any)?.inputs || {}),
                  text: resultText,
                  model: result.data?.model || selectedModel,
                },
                outputs: {
                  text: resultText,
                  output: resultText
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
            nodeName: data.label || '文本',
            model: result.data?.model || selectedModel,
            errorMsg: hasImage ? '图像反推提示词成功 ✅' : '剧本智能优化成功 ✅'
          }
        })
      );
    } catch (e: any) {
      window.dispatchEvent(
        new CustomEvent('add-failure-log', {
          detail: {
            nodeId: id,
            nodeName: data.label || '文本',
            model: selectedModel,
            errorMsg: e.message || '剧本处理失败'
          }
        })
      );
    } finally {
      setGenerating(false);
    }
  }, [data, activeVendor, selectedModel, id, setNodes, edges, nodes]);

  const handleSpawnImageService = useCallback(() => {
    if ((window as any).spawnLinkedNode) {
      (window as any).spawnLinkedNode(id, 'image-service', 'right');
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  }, [id]);

  const handleSpawnUploadNode = useCallback(() => {
    if ((window as any).spawnLinkedNode) {
      (window as any).spawnLinkedNode(id, 'upload-node', 'left', { fileType: 'image' });
      window.dispatchEvent(
        new CustomEvent('open-large-modal', {
          detail: { tab: 'assets', nodeTarget: id, type: 'image' }
        })
      );
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  }, [id]);

  const handleDelete = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [id, setNodes, setEdges]);

  const handleSaveName = useCallback(() => {
    setIsEditingName(false);
    if (localName.trim()) {
      setNodes((nds) =>
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
  }, [id, localName, setNodes]);

  const syncTableToText = useCallback((rows: TableRow[]) => {
    let md = `| 分镜 | 画面描述 | 旁白台词 |\n| --- | --- | --- |\n`;
    rows.forEach(r => {
      md += `| ${r.scene} | ${r.prompt} | ${r.tts} |\n`;
    });

    const promptList = rows.map(r => r.prompt).filter(Boolean).join('\n');

    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                text: md
              },
              outputs: {
                ...((n.data as any)?.outputs || {}),
                text: promptList,
                output: promptList
              }
            }
          };
        }
        return n;
      })
    );
  }, [id, setNodes]);

  const handleUpdateTableCell = useCallback((index: number, key: 'scene' | 'prompt' | 'tts', val: string) => {
    const nextRows = [...tableRows];
    nextRows[index][key] = val;
    setTableRows(nextRows);
    syncTableToText(nextRows);
  }, [tableRows, syncTableToText]);

  const handleAddTableRow = useCallback(() => {
    const nextRows = [...tableRows, { scene: String(tableRows.length + 1), prompt: '', tts: '' }];
    setTableRows(nextRows);
    syncTableToText(nextRows);
  }, [tableRows, syncTableToText]);

  const handleRemoveTableRow = useCallback((index: number) => {
    const nextRows = tableRows.filter((_, i) => i !== index);
    setTableRows(nextRows);
    syncTableToText(nextRows);
  }, [tableRows, syncTableToText]);

  return {
    settings,
    tableRows,
    selectedModel,
    textVal,
    currentMode,
    connectedImage,
    connectedImageRef,
    connectedVideo,
    connectedVideoRef,
    localName,
    isEditingName,
    isEditing,
    showTableEditor,
    generating,
    upstreamTypes: [],
    downstreamTypes: DOWNSTREAM_TYPES,

    handleTextChange,
    doProviderChange,
    doModelChange,
    handleGenerate,
    handleSpawnImageService,
    handleSpawnUploadNode,
    handleDelete,
    handleSaveName,
    setIsEditingName,
    setLocalName,
    setIsEditing,
    setShowTableEditor,
    handleUpdateTableCell,
    handleAddTableRow,
    handleRemoveTableRow,
    syncTableToText,
    resolveMediaUrl,
    handleModeChange: useCallback((modeId: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                inputs: {
                  ...((n.data as any)?.inputs || {}),
                  mode: modeId,
                }
              }
            };
          }
          return n;
        })
      );
    }, [id, setNodes]),
  };
}
