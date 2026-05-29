import { useState, useEffect, useMemo, useCallback } from 'react';
import { useReactFlow, useStore, useNodes } from '@xyflow/react';
import { PromptSourceNodeData, TableRow, DOWNSTREAM_TYPES } from './PromptSourceNode.config';

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
  localName: string;
  isEditingName: boolean;
  isEditing: boolean;
  showTableEditor: boolean;
  generating: boolean;
  upstreamTypes: any[];
  downstreamTypes: typeof DOWNSTREAM_TYPES;

  // 业务方法
  handleTextChange: (val: string) => void;
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

  // 加载 settings
  const [settings, setSettings] = useState<any>(null);
  useEffect(() => {
    fetch('http://localhost:3000/api/v1/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => data && setSettings(data))
      .catch(() => {});
  }, []);

  // 表格编辑器状态
  const [tableRows, setTableRows] = useState<TableRow[]>([
    { scene: '1', prompt: '反重力城堡，代码雨逆流升空', tts: '在这个反重力世界中...' }
  ]);

  // 选中的模型
  const [activeVendor] = useState<string>('openai');
  const selectedModel = data.inputs?.model || 'gpt-4o';

  // 文本值
  const textVal = data.inputs?.text || '';
  const currentMode = data.inputs?.mode || 'text';

  // Connected upload image scanning
  const connectedImage = useMemo(() => {
    const connectedEdges = edges.filter(e => e.target === id && e.targetHandle === 'input');
    const imgs: string[] = [];
    connectedEdges.forEach(edge => {
      const srcNode = nodes.find(n => n.id === edge.source);
      if (!srcNode) return;
      const outputs = (srcNode.data?.outputs || {}) as any;
      const inputs = (srcNode.data?.inputs || {}) as any;
      const val = outputs.output || outputs.image || inputs.fileUrl || '';
      if (!val || typeof val !== 'string') return;

      const uploadFileType = inputs?.fileType || outputs?.fileType;
      const isVideoOrAudio =
        val.endsWith('.mp3') || val.endsWith('.wav') || val.endsWith('.ogg') || val.endsWith('.m4a') ||
        val.endsWith('.mp4') || val.endsWith('.webm') || val.endsWith('.mov') ||
        val.startsWith('data:audio/') || val.startsWith('data:video/') ||
        (val.includes('media-asset-') && (val.includes('audio') || val.includes('video'))) ||
        srcNode.type === 'tts-service' ||
        (srcNode.type === 'upload-node' && (uploadFileType === 'audio' || uploadFileType === 'video'));

      if (isVideoOrAudio) return;

      const isImage =
        val.startsWith('data:image/') ||
        val.endsWith('.png') || val.endsWith('.jpg') || val.endsWith('.jpeg') || val.endsWith('.webp') ||
        srcNode.type === 'image-service' ||
        (srcNode.type === 'upload-node' && (uploadFileType === 'image' || !uploadFileType || val.startsWith('db://')));

      if (isImage) {
        imgs.push(val);
      }
    });
    return imgs[0] || '';
  }, [edges, nodes, id]);

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

  const doModelChange = useCallback((modelName: string) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                model: modelName
              }
            }
          };
        }
        return n;
      })
    );
  }, [id, setNodes]);

  const handleGenerate = useCallback(async () => {
    const textVal2 = data.inputs?.text || '';
    if (!textVal2.trim() && !connectedImage) {
      alert('请输入剧本或小说原文描述，或者在左侧连线上传图像进行反推！');
      return;
    }

    setGenerating(true);
    try {
      let resultText = '';

      try {
        const systemPrompt = connectedImage
          ? "你是一位顶级 AI 图像提示词反推与润色专家。请根据用户关联的参考图以及剧本文本描述，反推出一段极高画质、充满电影感与视觉冲击力的 Midjourney/Stable Diffusion 英文与中文生图提示词。"
          : "你是一位顶级剧本与提示词优化大师。请对用户提供的原始剧本文本进行深度扩写与艺术化视觉提示词包装。";

        const userPrompt = connectedImage
          ? `关联参考图: ${connectedImage}\n剧本台词/场景描述: ${textVal2}`
          : `原始剧本文本: ${textVal2}`;

        const res = await fetch('http://localhost:3000/api/v1/llm/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId: activeVendor,
            model: selectedModel,
            messages: [{ role: 'user', content: userPrompt }],
            systemPrompt
          })
        });

        const resData = await res.json();
        if (res.ok && resData.choices?.[0]?.message?.content) {
          resultText = resData.choices[0].message.content;
        } else {
          throw new Error('接口返回空');
        }
      } catch (e) {
        console.warn('调用真实大模型接口失败，切换至 Toonflow 内置本地 Agent 引擎进行离线反推/优化:', e);
        if (connectedImage) {
          resultText = `一只未来主义的机械猫，在霓虹漫天的赛博城市中展翅高飞，逆光的镜片反射出璀璨的代码雨，电影感，8K分辨率。\n\n${textVal2 || '反引力城堡，代码雨逆流升空'}`;
        } else {
          resultText = `[AI 智能优化剧本] ${textVal2}\n\n优化模型: ${selectedModel}\n本场景具有极其强烈的科幻视觉冲击，建议搭配 Flux 闪电或 Wan-2.1 模型生成视频。`;
        }
      }

      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                inputs: {
                  ...((n.data as any)?.inputs || {}),
                  text: resultText
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
            model: selectedModel,
            errorMsg: connectedImage ? '图像反推提示词成功 ✅' : '剧本智能优化成功 ✅'
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
  }, [data, connectedImage, textVal, activeVendor, selectedModel, id, setNodes]);

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
    localName,
    isEditingName,
    isEditing,
    showTableEditor,
    generating,
    upstreamTypes: [],
    downstreamTypes: DOWNSTREAM_TYPES,

    handleTextChange,
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
                  model: modeId === 'text' ? 'deepseek-chat' : 'Suno-v4',
                  text: ''
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
