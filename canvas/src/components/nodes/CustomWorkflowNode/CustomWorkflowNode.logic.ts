import { useMemo } from 'react';
import { useReactFlow, useStore, useNodes } from '@xyflow/react';
import { CustomNodeData, InputMapping } from './CustomWorkflowNode.config';
import { RunningHubService } from '../../../services/runninghub.service';

interface UseLogicProps {
  id: string;
  data: CustomNodeData;
  source: 'local_comfyui' | 'runninghub';
  mappings: InputMapping[];
  outputUrl: string;
  isRunning: boolean;
}

export function useCustomWorkflowNodeLogic({
  id,
  data,
  source,
  mappings,
  outputUrl,
  isRunning
}: UseLogicProps) {
  const { setNodes, deleteElements } = useReactFlow();
  const edges = useStore((state) => state.edges);
  const nodes = useNodes();

  // === 1. 连线连接检测 ===
  const isPortConnected = (portId: string) => {
    return edges.some(e => e.target === id && e.targetHandle === portId);
  };

  // === 2. 智能提取流入的数据 (同步，UI 渲染专用) ===
  const getConnectedValSync = (portId: string): string => {
    const edge = edges.find(e => e.target === id && e.targetHandle === portId);
    if (!edge) return '';
    const srcNode = nodes.find(n => n.id === edge.source);
    const srcData = srcNode?.data as any;
    const sourceHandle = edge.sourceHandle || '';
    
    return srcData?.outputs?.[sourceHandle] 
      || srcData?.outputs?.output  // UploadNode 通用输出
      || srcData?.outputs?.image   // ImageServiceNode 图片
      || srcData?.inputs?.fileUrl  // UploadNode 核心输入兜底自愈
      || srcData?.outputs?.audio   // TTS 音频
      || srcData?.outputs?.video   // VideoFusion 视频
      || srcData?.outputs?.storyboard // LLM 剧本
      || srcData?.inputs?.text    // PromptSource 文本
      || '';
  };

  // === 3. 智能提取流入的数据 (异步，执行灌参专用，支持自动解析 db:// 协议) ===
  const getConnectedVal = async (portId: string): Promise<string> => {
    const rawVal = getConnectedValSync(portId);
    if (!rawVal) return '';

    // 如果是 IndexedDB 本地缓存路径，在流向后端执行前自动解包为 Base64
    if (typeof rawVal === 'string' && rawVal.startsWith('db://')) {
      const mediaId = rawVal.replace('db://', '');
      const getMedia = (window as any).getMediaFromDB;
      if (typeof getMedia === 'function') {
        try {
          const base64 = await getMedia(mediaId);
          if (base64) {
            console.log(`[CustomWorkflowNode.logic] 💾 自动解析 IndexedDB 媒体引用: ${mediaId} -> Base64`);
            return base64;
          }
        } catch (e) {
          console.warn('[CustomWorkflowNode.logic] ⚠️ IndexedDB 读取失败:', e);
        }
      }
    }
    return rawVal;
  };

  // === 4. 更新节点输入参数 ===
  const handleParamChange = (portId: string, val: any) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                [portId]: val
              }
            }
          };
        }
        return n;
      })
    );
  };

  // === 5. 删除当前节点 ===
  const handleDelete = () => {
    deleteElements({ nodes: [{ id }] });
  };

  // === 6. 将媒体上传到 ComfyUI 实例 ===
  const uploadMediaToComfyUI = async (imageValue: string, defaultFilename: string = 'image.png'): Promise<string> => {
    if (!imageValue) return imageValue;
    
    // 如果已经是 ComfyUI 文件名或 http URL，直接返回
    if (!imageValue.startsWith('db://') && !imageValue.startsWith('data:')) {
      return imageValue;
    }

    let dataUrl = imageValue;

    // 如果是 db:// 路径，从 IndexedDB 读取真实 base64
    if (imageValue.startsWith('db://')) {
      const mediaId = imageValue.replace('db://', '');
      const getMedia = (window as any).getMediaFromDB;
      if (typeof getMedia === 'function') {
        try {
          dataUrl = await getMedia(mediaId) || '';
        } catch (e) {
          console.warn('[CustomWorkflowNode.logic] IndexedDB 读取失败:', e);
        }
      }
    }

    if (!dataUrl) return imageValue;

    // 上传到 ComfyUI 存储，以供本地 ComfyUI 进行媒体加载
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Determine file extension and mime type
      let mimeType = blob.type;
      let filename = defaultFilename;
      if (!mimeType) {
        if (defaultFilename.endsWith('.mp3')) mimeType = 'audio/mp3';
        else if (defaultFilename.endsWith('.mp4')) mimeType = 'video/mp4';
        else mimeType = 'image/png';
      } else {
        const ext = mimeType.split('/')[1] || 'png';
        filename = `uploaded_media_${Date.now()}.${ext}`;
      }
      
      const file = new File([blob], filename, { type: mimeType });

      const formData = new FormData();
      formData.append('image', file); // ComfyUI expects key 'image' for uploads

      const uploadRes = await fetch('/api/v1/comfyui/upload', {
        method: 'POST',
        body: formData
      });

      if (uploadRes.ok) {
        const result = await uploadRes.json();
        if (result.files && result.files[0]?.name) {
          console.log('[CustomWorkflowNode.logic] ✅ 媒体已同步到 ComfyUI:', result.files[0].name);
          return result.files[0].name;
        }
      }
    } catch (err) {
      console.warn('[CustomWorkflowNode.logic] ⚠️ 同步媒体到 ComfyUI 失败:', err);
    }

    return imageValue;
  };

  // === 7. 执行节点任务 ===
  const handleExecuteSingleNode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) return;

    // 设置节点正在运行状态
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              isRunning: true,
              outputs: { ...((n.data as any)?.outputs || {}), errorMsg: undefined }
            }
          };
        }
        return n;
      })
    );

    try {
      const inputsVal: Record<string, any> = {};
      
      // 遍历所有映射端口并灌参
      for (const map of mappings) {
        const connected = isPortConnected(map.portId);
        // 如果连线，则调用异步 getConnectedVal 自动解析 db://
        let value = connected ? await getConnectedVal(map.portId) : (data.inputs?.[map.portId] || '');
        
        // 检查是否是图片、视频或音频类型的字段
        const fieldNameLower = (map.fieldName || '').toLowerCase();
        const displayNameLower = (map.displayName || '').toLowerCase();
        const isImageField = fieldNameLower.includes('image') || fieldNameLower.includes('img') || fieldNameLower.includes('pic') || displayNameLower.includes('图片') || displayNameLower.includes('图像') || displayNameLower.includes('图');
        const isVideoField = fieldNameLower.includes('video') || fieldNameLower.includes('vid') || displayNameLower.includes('视频');
        const isAudioField = fieldNameLower.includes('audio') || fieldNameLower.includes('voice') || fieldNameLower.includes('sound') || displayNameLower.includes('音频') || displayNameLower.includes('声音') || displayNameLower.includes('音色') || displayNameLower.includes('语音');
        
        // 如果是媒体字段且是 Base64 / db://，需要进一步将其同步到 ComfyUI
        if ((isImageField || isVideoField || isAudioField) && value && (value.startsWith('db://') || value.startsWith('data:'))) {
          const defaultName = isVideoField ? 'video.mp4' : (isAudioField ? 'audio.mp3' : 'image.png');
          value = await uploadMediaToComfyUI(value, defaultName);
        }
        
        inputsVal[map.portId] = value;
      }

      const targetWorkflowOrJson = source === 'local_comfyui'
        ? (data.inputs?.jsonContent || data.workflowIdOrJson || '')
        : (data.workflowIdOrJson || '');

      if (!targetWorkflowOrJson) {
        throw new Error(source === 'local_comfyui' ? '未检测到 ComfyUI JSON 拓扑配置，请先上传或粘贴配置。' : '未检测到 RunningHub 工作流 ID，请先进行配置。');
      }

      // 异步执行云端 RunningHub 或本地 ComfyUI 工作流
      const resOutputUrl = await RunningHubService.executeCustomWorkflow(
        source,
        targetWorkflowOrJson,
        inputsVal,
        mappings
      );

      // 判定媒体类型
      const detectedType = resOutputUrl.toLowerCase().includes('.mp4') ? 'video' : (resOutputUrl.toLowerCase().includes('.mp3') || resOutputUrl.toLowerCase().includes('.wav') ? 'audio' : 'image');

      // 更新节点输出数据
      setNodes((nds) => {
        return nds.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                isRunning: false,
                outputUrl: resOutputUrl,
                outputs: { 
                  ...((n.data as any)?.outputs || {}), 
                  output: resOutputUrl,
                  image: detectedType === 'image' ? resOutputUrl : ((n.data as any)?.outputs?.image || ''),
                  video: detectedType === 'video' ? resOutputUrl : ((n.data as any)?.outputs?.video || ''),
                  audio: detectedType === 'audio' ? resOutputUrl : ((n.data as any)?.outputs?.audio || ''),
                  errorMsg: undefined 
                }
              }
            };
          }
          return n;
        });
      });

      // 广播全局日志成功事件
      const nodeTypeLabel = source === 'local_comfyui' ? 'ComfyUI' : 'RunningHub';
      window.dispatchEvent(new CustomEvent('add-success-log', {
        detail: {
          nodeId: id,
          nodeName: data.label || '自定义工作流',
          model: nodeTypeLabel,
          errorMsg: '任务执行成功 ✅',
          outputUrl: resOutputUrl,
          type: detectedType
        }
      }));

      // 存入画廊历史
      try {
        const savedHistory = localStorage.getItem('toonflow_history_assets_v2');
        const historyList = savedHistory ? JSON.parse(savedHistory) : [];
        historyList.unshift({
          id: `custom-out-${Date.now()}`,
          type: detectedType,
          url: resOutputUrl,
          nodeName: `⚙️ [${data.label || '自定义工作流'}] 生成成果`
        });
        localStorage.setItem('toonflow_history_assets_v2', JSON.stringify(historyList.slice(0, 100)));
      } catch (err: any) {}

    } catch (err: any) {
      console.error(err);
      // 设置节点出错状态
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                isRunning: false,
                outputs: { ...((n.data as any)?.outputs || {}), errorMsg: err.message }
              }
            };
          }
          return n;
        })
      );
    }
  };

  // === 7.5 时序自愈机制：根据上游节点数据计算一个 Key 以在数据变动时强制下游 UI 重新渲染 ===
  const nodesDataKey = useMemo(() => {
    return nodes.map(n => {
      const data = (n.data || {}) as any;
      const outputVal = data.outputs?.image || data.outputs?.output || '';
      const inputVal = data.inputs?.fileUrl || '';
      const labelVal = data.label || data.title || '';
      return `${n.id}_${outputVal}_${inputVal}_${labelVal}`;
    }).join('|');
  }, [nodes]);

  // === 8. 参数分块分类 ===
  const { textParams, imageParams, videoParams, audioParams, customParams } = useMemo(() => {
    const text: InputMapping[] = [];
    const image: InputMapping[] = [];
    const video: InputMapping[] = [];
    const audio: InputMapping[] = [];
    const custom: InputMapping[] = [];

    mappings.forEach(map => {
      const fieldLower = (map.fieldName || '').toLowerCase();
      const displayLower = (map.displayName || '').toLowerCase();

      const isText = fieldLower.includes('prompt') || fieldLower.includes('text') || fieldLower.includes('instruction') || displayLower.includes('提示词') || displayLower.includes('指令') || displayLower.includes('文本');
      const isImage = fieldLower.includes('image') || fieldLower.includes('pic') || displayLower.includes('图片') || displayLower.includes('图像') || displayLower.includes('图');
      const isVideo = fieldLower.includes('video') || fieldLower.includes('vid') || displayLower.includes('视频');
      const isAudio = fieldLower.includes('audio') || fieldLower.includes('voice') || fieldLower.includes('sound') || displayLower.includes('音频') || displayLower.includes('声音') || displayLower.includes('音色') || displayLower.includes('语音');

      if (isText) {
        text.push(map);
      } else if (isImage) {
        image.push(map);
      } else if (isVideo) {
        video.push(map);
      } else if (isAudio) {
        audio.push(map);
      } else {
        custom.push(map);
      }
    });

    return { textParams: text, imageParams: image, videoParams: video, audioParams: audio, customParams: custom };
  }, [mappings, nodesDataKey]);

  // === 9. 判定媒体类型 ===
  const detectMediaType = (url: string) => {
    if (!url) return 'none';
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.mp4')) return 'video';
    if (cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav')) return 'audio';
    return 'image';
  };

  const mediaType = outputUrl ? detectMediaType(outputUrl) : 'none';
  const isImage = mediaType === 'image';
  const isVideo = mediaType === 'video';
  const isAudio = mediaType === 'audio';

  return {
    isPortConnected,
    getConnectedValSync,
    getConnectedVal,
    handleParamChange,
    handleDelete,
    handleExecuteSingleNode,
    textParams,
    imageParams,
    videoParams,
    audioParams,
    customParams,
    mediaType,
    isImage,
    isVideo,
    isAudio
  };
}
