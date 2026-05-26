import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  ReactFlowProvider,
  useStore,
  type EdgeProps,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// 引入全局配置弹窗与自定义工作流画布节点与 5 大 Agent 节点
import SettingsModal from './components/SettingsModal';
import CustomWorkflowNode from './components/nodes/CustomWorkflowNode';
import { WorkflowTemplateService, WorkflowTemplate } from './services/workflow-template.service';
import PromptSourceNode from './components/nodes/PromptSourceNode';
import LLMStoryboardNode from './components/nodes/LLMStoryboardNode';
import ImageServiceNode from './components/nodes/ImageServiceNode';
import TTSServiceNode from './components/nodes/TTSServiceNode';
import VideoFusionNode from './components/nodes/VideoFusionNode';
import PurpleGroupNode from './components/nodes/PurpleGroupNode';
import UploadNode from './components/nodes/UploadNode';
import GridSplitterNode from './components/nodes/GridSplitterNode';
import { PRESET_WORKFLOWS } from './presets/workflows';
import LoopNode from './components/nodes/LoopNode';
import ImageEditorModal from './components/ImageEditorModal';
import { RunningHubService } from './services/runninghub.service';
import { ResolvedMedia } from './components/ResolvedMedia';


// 自定义带删除按钮的 Edge 组件
function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            onClick={onEdgeClick}
            style={{
              width: '18px',
              height: '18px',
              background: 'rgba(239, 68, 68, 0.95)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
              fontSize: '11px',
              fontWeight: 'bold',
              lineHeight: 1,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            title="断开连线"
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.transform = 'scale(1.2)';
              btn.style.background = '#dc2626';
              btn.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.8)';
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.transform = 'scale(1)';
              btn.style.background = 'rgba(239, 68, 68, 0.95)';
              btn.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.4)';
            }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = {
  button: ButtonEdge,
};

// ==================== 极简 IndexedDB 离线多媒体物理托管引擎 ====================
const DB_NAME = 'ToonflowDB';
const STORE_NAME = 'mediaAssets';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveMediaToDB(id: string, base64Data: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, data: base64Data });
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[IndexedDB] save failed:', e);
  }
}

async function getMediaFromDB(id: string): Promise<string | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    console.error('[IndexedDB] get failed:', e);
    return null;
  }
}

// 挂载到全局
(window as any).saveMediaToDB = saveMediaToDB;
(window as any).getMediaFromDB = getMediaFromDB;
// ===========================================================================

const nodeTypes = {
  'custom-workflow': ImageServiceNode,
  'prompt-source': PromptSourceNode,
  'llm-service': LLMStoryboardNode,
  'image-service': ImageServiceNode,
  'tts-service': TTSServiceNode,
  'video-fusion': VideoFusionNode,
  'purple-group': PurpleGroupNode,
  'upload-node': UploadNode,
  'grid-splitter': GridSplitterNode,
  'loop-node': LoopNode,
};

const TOPOLOGY_RECOMMENDATIONS: Record<string, { upstream: Array<{ type: string, label: string }>, downstream: Array<{ type: string, label: string }> }> = {
  'prompt-source': {
    upstream: [],
    downstream: [
      { type: 'llm-service', label: '🧠 剧本分镜专家' },
      { type: 'image-service', label: '🎨 智能生图 Agent' }
    ]
  },
  'upload-node': {
    upstream: [],
    downstream: [
      { type: 'image-service', label: '🎨 智能生图 Agent' },
      { type: 'tts-service', label: '🗣️ 声音克隆 Agent' },
      { type: 'video-fusion', label: '📹 视频合成 Fusion' }
    ]
  },
  'llm-service': {
    upstream: [
      { type: 'prompt-source', label: '📖 故事剧本源' }
    ],
    downstream: [
      { type: 'image-service', label: '🎨 智能生图 Agent' },
      { type: 'tts-service', label: '🗣️ 声音克隆 Agent' }
    ]
  },
  'image-service': {
    upstream: [
      { type: 'prompt-source', label: '📖 故事剧本源' },
      { type: 'llm-service', label: '🧠 剧本分镜专家' },
      { type: 'upload-node', label: '📦 本地上传组件' }
    ],
    downstream: [
      { type: 'video-fusion', label: '📹 视频合成 Fusion' },
      { type: 'loop-node', label: '🔄 批量循环迭代' }
    ]
  },
  'tts-service': {
    upstream: [
      { type: 'prompt-source', label: '📖 故事剧本源' },
      { type: 'llm-service', label: '🧠 剧本分镜专家' }
    ],
    downstream: [
      { type: 'video-fusion', label: '📹 视频合成 Fusion' }
    ]
  },
  'video-fusion': {
    upstream: [
      { type: 'image-service', label: '🎨 智能生图 Agent' },
      { type: 'tts-service', label: '🗣️ 声音克隆 Agent' },
      { type: 'upload-node', label: '📦 本地上传组件' }
    ],
    downstream: [
      { type: 'grid-splitter', label: '⊞ 智能切片' }
    ]
  },
  'grid-splitter': {
    upstream: [
      { type: 'video-fusion', label: '📹 视频合成 Fusion' }
    ],
    downstream: []
  },
  'loop-node': {
    upstream: [
      { type: 'image-service', label: '🎨 智能生图 Agent' }
    ],
    downstream: [
      { type: 'image-service', label: '🎨 智能生图 Agent' },
      { type: 'video-fusion', label: '📹 视频合成 Fusion' }
    ]
  }
};

// 初始测试节点 (包含高保真 5 大 Toonflow Agent 节点)
const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

// 可选参数定义结构
interface ParsableParameter {
  nodeId: string;
  classType: string;
  fieldName: string;
  defaultValue: any;
  displayName: string;
}

interface InputMapping {
  portId: string;
  nodeId: string;
  fieldName: string;
  displayName: string;
}

function WorkflowCanvas() {
  const { screenToFlowPosition, zoomTo, setCenter } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const [showMiniMap, setShowMiniMap] = useState(false);
  
  // 从 localStorage 恢复节点与连线数据以防刷新丢失
  const initialNodesLoaded: any[] = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('toonflow_nodes');
      return saved ? JSON.parse(saved) : initialNodes;
    } catch (e) {
      console.error("Failed to load nodes from localStorage:", e);
      return initialNodes;
    }
  }, []);

  const initialEdgesLoaded: any[] = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('toonflow_edges');
      return saved ? JSON.parse(saved) : initialEdges;
    } catch (e) {
      console.error("Failed to load edges from localStorage:", e);
      return initialEdges;
    }
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodesLoaded);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdgesLoaded);
  const [deletedElementsStack, setDeletedElementsStack] = useState<Array<{ nodes: Node[], edges: Edge[] }>>([]);

  // 1. 组数据聚变合并方法：将 group 内所有子节点的数据打入连接到 group 的下游节点 inputs 中
  const injectGroupCompositeData = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    return currentNodes.map(node => {
      // 仅对需要 inputs 图像/提示词参数的 Agent 节点进行聚变注入
      if (!['image-service', 'video-fusion', 'tts-service', 'llm-service', 'custom-workflow'].includes(node.type || '')) {
        return node;
      }

      // 寻找到达此 target 节点的所有上游 Edge
      const incomingEdges = currentEdges.filter(e => e.target === node.id);
      let updatedInputs = { ...(node.data?.inputs || {}) } as any;

      incomingEdges.forEach(edge => {
        const srcNode = currentNodes.find(n => n.id === edge.source);
        if (srcNode && srcNode.type === 'purple-group') {
          console.log(`[Group Pipeline] Detected group pipeline input from group: ${srcNode.id} to node: ${node.id}`);
          
          // 扫描该组内的所有子节点
          const children = currentNodes.filter(n => n.parentId === srcNode.id);
          
          const groupPrompts: string[] = [];
          const groupImages: string[] = [];
          const groupAudios: string[] = [];
          let modelVal = '';
          
          children.forEach(child => {
            const inputs = (child.data?.inputs || {}) as any;
            const outputs = (child.data?.outputs || {}) as any;

            // A. 提取文本提示词
            const textVal = outputs.output || outputs.storyboard || outputs.prompt || outputs.text || inputs.prompt || inputs.text || '';
            if (textVal && child.type !== 'upload-node') {
              groupPrompts.push(textVal);
            }

            // B. 提取图像/多媒体
            const mediaUrl = outputs.output || outputs.image || outputs.outputUrl || inputs.fileUrl || '';
            if (mediaUrl) {
              const isImg = (child.type === 'upload-node' && (inputs.fileType === 'image' || !inputs.fileType)) || child.type === 'image-service';
              const isAud = (child.type === 'upload-node' && inputs.fileType === 'audio') || child.type === 'tts-service';
              if (isImg) {
                groupImages.push(mediaUrl);
              } else if (isAud) {
                groupAudios.push(mediaUrl);
              }
            }

            // C. 提取模型配置
            if (inputs.model) {
              modelVal = inputs.model;
            }
          });

          // 打包灌入下游
          if (groupPrompts.length > 0) {
            updatedInputs.prompt = groupPrompts.join('\n');
          }
          if (groupImages.length > 0) {
            updatedInputs.imageRef = groupImages[0];
            updatedInputs.faceRef = groupImages[1] || groupImages[0];
            updatedInputs.fileUrl = groupImages[0];
          }
          if (groupAudios.length > 0) {
            updatedInputs.audioUrl = groupAudios[0];
            updatedInputs.fileUrl = groupAudios[0];
          }
          if (modelVal) {
            updatedInputs.model = modelVal;
          }
        }
      });

      return {
        ...node,
        data: {
          ...node.data,
          inputs: updatedInputs
        }
      };
    });
  }, []);

  // 2. 联动平移与边界绑定 Drag Stop 处理函数
  const onNodeDragStop = useCallback((event: React.MouseEvent, dragNode: Node) => {
    if (dragNode.type === 'purple-group') return;

    const dragX = dragNode.position.x;
    const dragY = dragNode.position.y;

    let globalX = dragX;
    let globalY = dragY;
    
    let currentParent: Node | undefined = undefined;
    if (dragNode.parentId) {
      currentParent = nodes.find(n => n.id === dragNode.parentId);
      if (currentParent) {
        globalX = currentParent.position.x + dragX;
        globalY = currentParent.position.y + dragY;
      }
    }

    // 寻找包含这个拖拽节点中心的 purple-group
    let foundGroup: Node | undefined = undefined;
    for (const node of nodes) {
      if (node.type === 'purple-group') {
        const gx = node.position.x;
        const gy = node.position.y;
        const gw = Number(node.style?.width || node.width || 600);
        const gh = Number(node.style?.height || node.height || 400);

        const nodeW = Number(dragNode.style?.width || dragNode.width || 300);
        const nodeH = Number(dragNode.style?.height || dragNode.height || 260);
        const cx = globalX + nodeW / 2;
        const cy = globalY + nodeH / 2;

        if (cx >= gx && cx <= gx + gw && cy >= gy && cy <= gy + gh) {
          foundGroup = node;
          break;
        }
      }
    }

    if (foundGroup) {
      if (dragNode.parentId !== foundGroup.id) {
        const relX = globalX - foundGroup.position.x;
        const relY = globalY - foundGroup.position.y;

        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === dragNode.id) {
              return {
                ...n,
                parentId: foundGroup!.id,
                extent: 'parent' as const,
                position: { x: relX, y: relY }
              };
            }
            return n;
          })
        );
      }
    } else {
      if (dragNode.parentId) {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === dragNode.id) {
              return {
                ...n,
                parentId: undefined,
                extent: undefined,
                position: { x: globalX, y: globalY }
              };
            }
            return n;
          })
        );
      }
    }
  }, [nodes, setNodes]);

  // 3. 全节点一键智能派生与自动连线核心求值算法 (Derive Pipeline)
  const handleDeriveNode = useCallback((sourceId: string, targetType: string, direction: 'upstream' | 'downstream') => {
    const srcNode = nodes.find(n => n.id === sourceId);
    if (!srcNode) return;

    const posX = srcNode.position.x;
    const posY = srcNode.position.y;
    const parentId = srcNode.parentId;

    const offsetX = direction === 'downstream' ? 380 : -380;
    const position = { x: posX + offsetX, y: posY + 20 };
    const safePos = findNonOverlappingPosition(nodes, position.x, position.y);

    const newId = `${targetType}-${Date.now()}`;
    
    let label = '🎨 新派生节点';
    let dataInputs: any = {};
    let dataOutputs: any = {};

    if (targetType === 'prompt-source') {
      label = '📖 故事剧本源';
      dataInputs = { text: '派生的剧本内容...' };
      dataOutputs = { output: '', text: '' };
    } else if (targetType === 'upload-node') {
      label = '📦 本地上传';
      dataInputs = { fileType: 'image', fileUrl: '' };
      dataOutputs = { output: '', fileType: 'image' };
    } else if (targetType === 'llm-service') {
      label = '🧠 剧本分镜专家';
      dataInputs = { providerId: 'minimax', model: 'MiniMax-M2.7', prompt: '', skillId: 'storyboard-expert', temperature: 0.7 };
      dataOutputs = { storyboard: '', output: '' };
    } else if (targetType === 'image-service') {
      label = '🎨 智能生图 Agent';
      dataInputs = { providerId: 'volcengine', model: 'flux-schnell', prompt: '', faceRef: '', imageRef: '' };
      dataOutputs = { image: '', output: '' };
    } else if (targetType === 'tts-service') {
      label = '🗣️ 声音克隆 Agent';
      dataInputs = { providerId: 'volcengine', model: 'fish-speech-1.4', text: '', voiceId: 'gentle-male' };
      dataOutputs = { audio: '', output: '' };
    } else if (targetType === 'video-fusion') {
      label = '📹 视频合成 Fusion';
      dataInputs = { providerId: 'volcengine', model: 'vidu-high-speed', prompt: '', imageRef: '', audioUrl: '' };
      dataOutputs = { video: '', output: '' };
    } else if (targetType === 'grid-splitter') {
      label = '⊞ 智能切片';
      dataInputs = { cols: 2, rows: 2, gap: 0 };
      dataOutputs = { output: '' };
    } else if (targetType === 'loop-node') {
      label = '🔄 循环迭代';
      dataInputs = { totalRuns: 3, currentRun: 0 };
      dataOutputs = { output: '' };
    }

    const newNode: any = {
      id: newId,
      type: targetType,
      position: safePos,
      parentId,
      extent: parentId ? 'parent' as const : undefined,
      data: {
        label,
        inputs: dataInputs,
        outputs: dataOutputs,
        isNew: true
      }
    };

    let sourceHandle = 'output';
    let targetHandle = 'input';

    if (direction === 'downstream') {
      if (srcNode.type === 'image-service') sourceHandle = 'image';
      else if (srcNode.type === 'video-fusion') sourceHandle = 'video';
      else if (srcNode.type === 'tts-service') sourceHandle = 'audio';
      else if (srcNode.type === 'llm-service') sourceHandle = 'output';
      else if (srcNode.type === 'upload-node') sourceHandle = 'output';
      else if (srcNode.type === 'prompt-source') sourceHandle = 'output';

      if (targetType === 'image-service') {
        targetHandle = 'input';
      }
      else if (targetType === 'video-fusion') {
        targetHandle = 'input';
      }
      else {
        targetHandle = 'input';
      }

      const newEdge = {
        id: `e-${sourceId}-${newId}`,
        source: sourceId,
        sourceHandle,
        target: newId,
        targetHandle,
        type: 'button',
        animated: true,
        style: { stroke: 'rgba(168, 85, 247, 0.85)', strokeWidth: 2 }
      };

      setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), newNode]);
      setEdges((eds) => [...eds, newEdge]);
    } 
    else {
      if (targetType === 'image-service') sourceHandle = 'image';
      else if (targetType === 'video-fusion') sourceHandle = 'video';
      else if (targetType === 'tts-service') sourceHandle = 'audio';
      else if (targetType === 'llm-service') sourceHandle = 'output';
      else if (targetType === 'upload-node') sourceHandle = 'output';
      else if (targetType === 'prompt-source') sourceHandle = 'output';

      if (srcNode.type === 'image-service') {
        targetHandle = 'input';
      }
      else if (srcNode.type === 'video-fusion') {
        targetHandle = 'input';
      }
      else {
        targetHandle = 'input';
      }

      const newEdge = {
        id: `e-${newId}-${sourceId}`,
        source: newId,
        sourceHandle,
        target: sourceId,
        targetHandle,
        type: 'button',
        animated: true,
        style: { stroke: 'rgba(168, 85, 247, 0.85)', strokeWidth: 2 }
      };

      setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), newNode]);
      setEdges((eds) => [...eds, newEdge]);
    }

    setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === newId) {
            return {
              ...n,
              data: {
                ...n.data,
                isNew: false
              }
            };
          }
          return n;
        })
      );
    }, 2000);

    setTimeout(() => {
      setCenter(safePos.x + 150, safePos.y + 130, { zoom: 0.85, duration: 600 });
    }, 100);
  }, [nodes, setNodes, setEdges, setCenter]);

  useEffect(() => {
    (window as any).handleDeriveNode = handleDeriveNode;
  }, [handleDeriveNode]);

  // 监听 nodes 和 edges 变化并持久化
  React.useEffect(() => {
    localStorage.setItem('toonflow_nodes', JSON.stringify(nodes));
  }, [nodes]);

  React.useEffect(() => {
    localStorage.setItem('toonflow_edges', JSON.stringify(edges));
  }, [edges]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<'comfy' | 'providers' | 'runninghub_api' | 'workflow' | 'cache' | 'templates'>('comfy');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // 抽屉内部状态
  const [drawerLabel, setDrawerLabel] = useState('');
  const [drawerSource, setDrawerSource] = useState<'local_comfyui' | 'runninghub'>('local_comfyui');
  const [drawerComfyJson, setDrawerComfyJson] = useState('');
  const [drawerRunningHubId, setDrawerRunningHubId] = useState('');
  const [parsedParams, setParsedParams] = useState<ParsableParameter[]>([]);
  const [selectedParams, setSelectedParams] = useState<Record<string, boolean>>({});
  const [paramAliases, setParamAliases] = useState<Record<string, string>>({});
  const [parsing, setParsing] = useState(false);

  // 联调状态管理
  const [isRunning, setIsRunning] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [activeStep, setActiveStep] = useState<string | null>(null);

  // Toonflow 三大 Tab 新增状态
  const [activeSidebarTab, setActiveSidebarTab] = useState<'nodes' | 'script' | 'scene' | 'assets'>('nodes');
  const [scriptText, setScriptText] = useState('在一个被反重力充斥的数字魔法世界中，有一只代表重力反转的代码飞翼，飞过磨砂玻璃搭建的城堡，城堡外下着代码雨。少女张开晶翅冲向云端。');
  const [parsedScenes, setParsedScenes] = useState<Array<{ scene: number; prompt: string; tts: string }>>([]);
  const [isParsingScript, setIsParsingScript] = useState(false);

  // AixCanvas 二开专属状态
  const [activeFloatingPopup, setActiveFloatingPopup] = useState<'add' | 'templates' | 'script' | 'scene' | 'assets' | 'history' | 'logs' | null>(null);
  const [modalNodeTarget, setModalNodeTarget] = useState<string | null>(null);
  const [modalMediaType, setModalMediaType] = useState<'image' | 'video' | 'audio' | null>(null);

  // 高精图像编辑器模态框状态
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [imageEditorTarget, setImageEditorTarget] = useState<{ nodeId: string; imageUrl: string } | null>(null);
  const [imageEditorActiveTab, setImageEditorActiveTab] = useState<'crop' | 'mask' | 'brush' | 'grid'>('crop');

  useEffect(() => {
    const handleOpenEditor = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.imageUrl) {
        setImageEditorTarget({
          nodeId: customEvent.detail.nodeId,
          imageUrl: customEvent.detail.imageUrl
        });
        if (customEvent.detail.activeTab) {
          setImageEditorActiveTab(customEvent.detail.activeTab);
        } else {
          setImageEditorActiveTab('crop');
        }
        setImageEditorOpen(true);
      }
    };
    window.addEventListener('toonflow-open-image-editor', handleOpenEditor);
    return () => {
      window.removeEventListener('toonflow-open-image-editor', handleOpenEditor);
    };
  }, []);

  const handleSaveImageEdit = async (result: {
    mode: 'crop' | 'mask' | 'brush' | 'grid';
    dataUrl: string;
    maskDataUrl?: string;
    gridImages?: string[];
  }) => {
    setImageEditorOpen(false);
    if (!imageEditorTarget) return;

    const { nodeId, imageUrl } = imageEditorTarget;
    const targetNode = nodes.find(n => n.id === nodeId);
    if (!targetNode) return;

    const posX = targetNode.position?.x || 0;
    const posY = targetNode.position?.y || 0;

    if (result.mode === 'crop' || result.mode === 'brush') {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            const saveMedia = (window as any).saveMediaToDB;
            let finalUrl = result.dataUrl;

            if (typeof saveMedia === 'function') {
              const mediaId = `media-asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              saveMedia(mediaId, result.dataUrl);
              finalUrl = `db://${mediaId}`;
            }

            const isUpload = n.type === 'upload-node';
            return {
              ...n,
              data: {
                ...n.data,
                inputs: {
                  ...(n.data?.inputs as any),
                  fileUrl: isUpload ? finalUrl : (n.data?.inputs as any)?.fileUrl,
                  prompt: !isUpload ? (n.data?.inputs as any)?.prompt : undefined,
                },
                outputs: {
                  ...(n.data?.outputs as any),
                  output: isUpload ? finalUrl : undefined,
                  image: !isUpload ? finalUrl : undefined
                }
              }
            };
          }
          return n;
        })
      );
    }
    else if (result.mode === 'mask') {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            const saveMedia = (window as any).saveMediaToDB;
            let finalUrl = result.dataUrl;
            if (typeof saveMedia === 'function') {
              const mediaId = `media-asset-prev-${Date.now()}`;
              saveMedia(mediaId, result.dataUrl);
              finalUrl = `db://${mediaId}`;
            }
            return {
              ...n,
              data: {
                ...n.data,
                outputs: {
                  ...(n.data?.outputs as any),
                  image: n.type !== 'upload-node' ? finalUrl : undefined,
                  output: n.type === 'upload-node' ? finalUrl : undefined,
                  mask: result.maskDataUrl
                }
              }
            };
          }
          return n;
        })
      );

      if (result.maskDataUrl) {
        const saveMedia = (window as any).saveMediaToDB;
        let maskUrl = result.maskDataUrl;
        if (typeof saveMedia === 'function') {
          const mediaId = `media-asset-mask-${Date.now()}`;
          await saveMedia(mediaId, result.maskDataUrl);
          maskUrl = `db://${mediaId}`;
        }

        const childId = `upload-node-${Date.now()}`;
        const childNode = {
          id: childId,
          type: 'upload-node',
          position: { x: posX + 220, y: posY + 80 },
          data: {
            label: `🖌️ 遮罩资产`,
            inputs: {
              fileType: 'image',
              fileUrl: maskUrl,
              fileName: 'toonflow-inpaint-mask.png'
            },
            outputs: {
              output: maskUrl,
              fileType: 'image'
            }
          }
        };

        const newEdge = {
          id: `e-${nodeId}-${childId}`,
          source: nodeId,
          sourceHandle: targetNode.type === 'upload-node' ? 'output' : 'image',
          target: childId,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'rgba(244, 63, 94, 0.85)', strokeWidth: 2 }
        };

        setNodes((nds) => [...nds, childNode as any]);
        setEdges((eds) => [...eds, newEdge as any]);
      }
    }
    else if (result.mode === 'grid' && result.gridImages && result.gridImages.length > 0) {
      const saveMedia = (window as any).saveMediaToDB;
      const newNodes: any[] = [];
      const newEdges: any[] = [];

      for (let i = 0; i < result.gridImages.length; i++) {
        const imgBase64 = result.gridImages[i];
        let fileUrl = imgBase64;
        if (typeof saveMedia === 'function') {
          const mediaId = `media-asset-grid-${Date.now()}-${i}`;
          await saveMedia(mediaId, imgBase64);
          fileUrl = `db://${mediaId}`;
        }

        const row = Math.floor(i / 3);
        const col = i % 3;
        const childId = `upload-node-grid-${Date.now()}-${i}`;
        
        const childNode = {
          id: childId,
          type: 'upload-node',
          position: { x: posX + 330 + col * 200, y: posY + row * 160 },
          data: {
            label: `🧩 切片 ${i + 1}`,
            inputs: {
              fileType: 'image',
              fileUrl: fileUrl,
              fileName: `grid-slice-${i + 1}.png`
            },
            outputs: {
              output: fileUrl,
              fileType: 'image'
            }
          }
        };

        const newEdge = {
          id: `e-${nodeId}-${childId}`,
          source: nodeId,
          sourceHandle: targetNode.type === 'upload-node' ? 'output' : 'image',
          target: childId,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'rgba(168, 85, 247, 0.85)', strokeWidth: 1.5 }
        };

        newNodes.push(childNode);
        newEdges.push(newEdge);
      }

      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
    }

    setImageEditorTarget(null);
  };

  // 大 Modal 专属局部状态与音频试听引擎二开
  const [templateLargeTab, setTemplateLargeTab] = useState<'image' | 'video' | 'audio' | 'local_comfyui' | 'runninghub'>('image');
  const [savedTemplates, setSavedTemplates] = useState<WorkflowTemplate[]>([]);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const [activeWorkflowIds, setActiveWorkflowIds] = useState<string[]>(() => 
    RunningHubService.getWorkflows().map(w => w.id)
  );

  useEffect(() => {
    const handleUpdate = () => {
      setActiveWorkflowIds(RunningHubService.getWorkflows().map(w => w.id));
    };
    window.addEventListener('runninghub_workflows_updated', handleUpdate);
    return () => window.removeEventListener('runninghub_workflows_updated', handleUpdate);
  }, []);

  const handleChangeCardCover = (tmpl: WorkflowTemplate) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          if (evt.target?.result) {
            const base64 = evt.target.result as string;
            try {
              const updated = await WorkflowTemplateService.saveTemplate({
                ...tmpl,
                previewImage: base64,
              });
              setSavedTemplates((prev) =>
                prev.map((t) => (t.id === tmpl.id ? updated : t))
              );
            } catch (err: any) {
              alert(`⚠️ 更新封面失败: ${err.message || err}`);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    };
    inp.click();
  };
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [assetLargeTab, setAssetLargeTab] = useState<'mine' | 'library' | 'virtual' | 'other'>('mine');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const voiceAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const closeLargeModal = () => {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current = null;
    }
    setPlayingVoiceId(null);
    setActiveFloatingPopup(null);
    setModalNodeTarget(null);
    setModalMediaType(null);
  };

  const handleToggleVoicePlay = (voiceId: string, audioUrl: string) => {
    if (playingVoiceId === voiceId) {
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
      }
      setPlayingVoiceId(null);
    } else {
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
      }
      const aud = new Audio(audioUrl);
      voiceAudioRef.current = aud;
      aud.play().catch(e => console.log('Audio playback error:', e));
      setPlayingVoiceId(voiceId);
      aud.onended = () => {
        setPlayingVoiceId(null);
      };
    }
  };
  const [templateSubTab, setTemplateSubTab] = useState<'community' | 'mine'>('community');
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // ==================== 日记（错误日志）状态二开 ====================
  interface FailureLog {
    id: string;
    timestamp: string;
    nodeId: string;
    nodeName: string;
    model: string;
    errorMsg: string;
    status?: 'success' | 'failure';
  }
  const [failureLogs, setFailureLogs] = useState<FailureLog[]>([]);

  useEffect(() => {
    const handleAddFailureLog = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setFailureLogs(prev => [
          {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toLocaleTimeString(),
            nodeId: detail.nodeId || 'unknown',
            nodeName: detail.nodeName || '未知节点',
            model: detail.model || '未知模型',
            errorMsg: detail.errorMsg || '未知错误',
            status: 'failure'
          },
          ...prev
        ]);
      }
    };
    const handleAddSuccessLog = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setFailureLogs(prev => [
          {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toLocaleTimeString(),
            nodeId: detail.nodeId || 'unknown',
            nodeName: detail.nodeName || '未知节点',
            model: detail.model || '未知模型',
            errorMsg: detail.errorMsg || '运行成功',
            status: 'success'
          },
          ...prev
        ]);

        // 物理追加到真实的物理成果历史中！
        const rawUrl = detail.outputUrl || detail.imageUrl || detail.videoUrl || detail.audioUrl;
        if (rawUrl) {
          let detectedType: 'image' | 'video' | 'audio' = detail.type || 'image';
          const cleanUrl = rawUrl.split('?')[0].toLowerCase();
          if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mov')) {
            detectedType = 'video';
          } else if (cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.ogg')) {
            detectedType = 'audio';
          }
          
          setHistoryAssets(prev => [
            {
              id: `real-hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: detectedType,
              url: rawUrl,
              nodeName: `${detail.nodeName || 'AI生成'} - ${detail.model || '成果'}`,
            },
            ...prev
          ]);
        }
      }
    };
    window.addEventListener('add-failure-log', handleAddFailureLog);
    window.addEventListener('add-success-log', handleAddSuccessLog);
    return () => {
      window.removeEventListener('add-failure-log', handleAddFailureLog);
      window.removeEventListener('add-success-log', handleAddSuccessLog);
    };
  }, []);

  const [uploadedAssets, setUploadedAssets] = useState<Array<{ id: string; type: 'image' | 'audio' | 'video'; url: string; nodeName: string }>>(() => {
    try {
      const saved = localStorage.getItem('toonflow_uploaded_assets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load uploadedAssets from localStorage:", e);
      return [];
    }
  });

  React.useEffect(() => {
    localStorage.setItem('toonflow_uploaded_assets', JSON.stringify(uploadedAssets));
  }, [uploadedAssets]);

  React.useEffect(() => {
    if (activeFloatingPopup === 'templates') {
      const fetchTemplates = async () => {
        setTemplatesLoading(true);
        try {
          const list = await WorkflowTemplateService.listTemplates();
          setSavedTemplates(list);
        } catch (e) {
          console.error("Failed to load templates:", e);
        } finally {
          setTemplatesLoading(false);
        }
      };
      fetchTemplates();
    }
  }, [activeFloatingPopup]);

  // ============ 物理真实的 AI 成果历史持久化池 (解决只显示最后一张的 Bug) ============
  const [historyAssets, setHistoryAssets] = useState<Array<{ id: string; type: 'image' | 'video' | 'audio'; url: string; nodeName: string }>>(() => {
    try {
      const saved = localStorage.getItem('toonflow_history_assets_v2');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load historyAssets from localStorage:", e);
      return [];
    }
  });

  React.useEffect(() => {
    localStorage.setItem('toonflow_history_assets_v2', JSON.stringify(historyAssets));
  }, [historyAssets]);

  // 预设素材库（用户上传的）
  const [libraryAssets, setLibraryAssets] = useState<Array<{ id: string; type: 'image' | 'audio' | 'video'; url: string; name: string }>>(() => {
    try {
      const saved = localStorage.getItem('toonflow_library_assets');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  React.useEffect(() => {
    localStorage.setItem('toonflow_library_assets', JSON.stringify(libraryAssets));
  }, [libraryAssets]);

  // 虚拟人库
  const [virtualAssets, setVirtualAssets] = useState<Array<{ id: string; type: 'image' | 'audio' | 'video'; url: string; name: string; avatar?: string }>>(() => {
    try {
      const saved = localStorage.getItem('toonflow_virtual_assets');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  React.useEffect(() => {
    localStorage.setItem('toonflow_virtual_assets', JSON.stringify(virtualAssets));
  }, [virtualAssets]);

  // LORA 其他预设
  const [loraAssets, setLoraAssets] = useState<Array<{ id: string; type: 'image' | 'audio' | 'video'; url: string; name: string }>>(() => {
    try {
      const saved = localStorage.getItem('toonflow_lora_assets');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  React.useEffect(() => {
    localStorage.setItem('toonflow_lora_assets', JSON.stringify(loraAssets));
  }, [loraAssets]);

  // 新增二开交互状态
  const [paneContextMenuPos, setPaneContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [copiedNode, setCopiedNode] = useState<any>(null);

  // 保存资产弹窗状态
  const [isSaveAssetOpen, setIsSaveAssetOpen] = useState(false);
  const [assetToSave, setAssetToSave] = useState<{ nodeId: string; url: string; nodeName: string } | null>(null);
  const [saveAssetName, setSaveAssetName] = useState('');
  const [saveAssetDesc, setSaveAssetDesc] = useState('');
  const [saveAssetTag, setSaveAssetTag] = useState('人物');

  // 资产中心与历史细分状态
  const [assetSubTab, setAssetSubTab] = useState<'public' | 'mine'>('mine');
  const [assetTagFilter, setAssetTagFilter] = useState<string>('全部');
  const [historySubTab, setHistorySubTab] = useState<'image' | 'video' | 'audio'>('image');
  interface FullScreenMediaData {
    url: string;
    type: 'image' | 'video' | 'audio';
    nodeId?: string;
  }
  const [fullScreenMedia, setFullScreenMedia] = useState<FullScreenMediaData | null>(null);
  const [lightboxPrompt, setLightboxPrompt] = useState('');
  const lastOpenedNodeId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (fullScreenMedia?.nodeId) {
      if (lastOpenedNodeId.current !== fullScreenMedia.nodeId) {
        const targetNode = nodes.find(n => n.id === fullScreenMedia.nodeId);
        setLightboxPrompt(targetNode?.data?.inputs?.prompt || '');
        lastOpenedNodeId.current = fullScreenMedia.nodeId;
      }
    } else {
      lastOpenedNodeId.current = null;
    }
  }, [fullScreenMedia, nodes]);

  // 对比灯箱 Slider 状态与手势逻辑
  const [lightboxCompareMode, setLightboxCompareMode] = useState<'slider' | 'side-by-side' | 'single'>('slider');
  const [lightboxSliderPos, setLightboxSliderPos] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const sliderContainerRef = React.useRef<HTMLDivElement>(null);

  const handleSliderPointerDown = (e: React.PointerEvent) => {
    setIsDraggingSlider(true);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('Pointer Capture not supported or failed:', err);
    }
  };

  const handleSliderPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSlider || !sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setLightboxSliderPos(pct);
  };

  const handleSliderPointerUp = (e: React.PointerEvent) => {
    setIsDraggingSlider(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }
  };

  // 提示词精调并在 WS 中免退灯箱的原地重新生成物理流转逻辑
  const lightboxReRun = async () => {
    if (!fullScreenMedia || !fullScreenMedia.nodeId) return;
    const { nodeId } = fullScreenMedia;
    
    // 同步新 prompt，将成果 outputs 置空，将 isRunning 标为 true 唤醒灯箱内流光加载层
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...(n.data?.inputs as any),
                prompt: lightboxPrompt
              },
              outputs: {}, // 物理置空
              outputUrl: '',
              isRunning: true
            }
          };
        }
        return n;
      })
    );

    // 触发网关拓扑异步流转
    setTimeout(() => {
      handleRunWorkflow();
    }, 80);
  };


  // 帮助问号状态
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 智能计算节点非重叠安全位置 (防重合排布算法)
  const findNonOverlappingPosition = useCallback((nodesList: any[], initX: number, initY: number) => {
    let finalX = initX;
    let finalY = initY;
    let overlapping = true;
    let attempts = 0;
    while (overlapping && attempts < 100) {
      overlapping = nodesList.some(
        (n) => Math.abs(n.position.x - finalX) < 120 && Math.abs(n.position.y - finalY) < 120
      );
      if (overlapping) {
        finalX += 220; // 横向平移
        finalY += 40;  // 纵向错开
      }
      attempts++;
    }
    return { x: finalX, y: finalY };
  }, []);

  const spawnLinkedNode = useCallback((sourceNodeId: string, type: string, direction: 'left' | 'right' = 'right', customInputs?: any) => {
    const childId = `${type}-${Date.now()}`;
    
    setNodes((nds) => {
      const sourceNode = nds.find((n) => n.id === sourceNodeId);
      if (!sourceNode) return nds;

      const posX = sourceNode.position.x;
      const posY = sourceNode.position.y;
      
      let childX = posX;
      let childY = posY + 200;
      if (direction === 'right') {
        childX = posX + 240;
        childY = posY + (customInputs?.yOffset !== undefined ? customInputs.yOffset : 20);
      } else if (direction === 'left') {
        childX = posX - 240;
        childY = posY + (customInputs?.yOffset !== undefined ? customInputs.yOffset : 20);
      }

      // 进行防重叠坐标计算
      let safePos = findNonOverlappingPosition(nds, childX, childY);
      if (customInputs && customInputs.position) {
        safePos = customInputs.position;
      }

      let label = '';
      let inputs: any = {};
      let outputs: any = {};

      if (type === 'image-service') {
        label = '🎨 智能生图 Agent';
        inputs = {
          prompt: '参考上游提示词...',
          providerId: 'volcengine',
          model: 'flux-schnell',
          size: '1024x1024',
        };
      } else if (type === 'prompt-source') {
        label = '文本';
        inputs = {
          text: '文生图反向派生的文本Prompt...'
        };
      } else if (type === 'video-fusion') {
        label = '视频生成';
        inputs = {
          prompt: '',
          mode: 'i2v'
        };
      } else if (type === 'upload-node') {
        label = customInputs?.fileType === 'audio' ? '🎵 声音资产输入' : '🖼️ 图像资产输入';
        inputs = {
          fileType: customInputs?.fileType || 'image',
          fileUrl: '',
          fileName: ''
        };
      }

      if (customInputs) {
        inputs = { ...inputs, ...customInputs };
      }

      const childNode = {
        id: childId,
        type,
        position: safePos,
        data: {
          label,
          progress: 0,
          inputs,
          outputs,
          isNew: true // 激活发光闪烁
        },
      };

      const newEdge = {
        id: `e-${direction === 'right' ? sourceNodeId : childId}-${direction === 'right' ? childId : sourceNodeId}`,
        source: direction === 'right' ? sourceNodeId : childId,
        sourceHandle: 'output',
        target: direction === 'right' ? childId : sourceNodeId,
        targetHandle: 'input',
        type: 'button',
        animated: true,
        style: { stroke: 'rgba(168, 85, 247, 0.85)', strokeWidth: 2 },
      };

      setEdges((eds) => [...eds, newEdge]);
      
      // 平滑居中聚焦到新生成的节点
      setTimeout(() => {
        setCenter(safePos.x, safePos.y, { zoom: 0.95, duration: 600 });
      }, 50);

      return [...nds.map(n => ({ ...n, selected: false })), { ...childNode, selected: true }];
    });

    // 3 秒后清空闪烁发光效果
    setTimeout(() => {
      setNodes((nds) => nds.map(n => n.id === childId ? {
        ...n,
        data: {
          ...n.data,
          isNew: false
        }
      } : n));
    }, 3000);
  }, [setNodes, setEdges, findNonOverlappingPosition, setCenter]);

  const addUploadedAsset = useCallback(async (type: 'image' | 'audio' | 'video', url: string, name: string) => {
    let finalUrl = url;
    if (url && !url.startsWith('db://') && url.startsWith('data:')) {
      const mediaId = `media-asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const saveMedia = (window as any).saveMediaToDB;
      if (typeof saveMedia === 'function') {
        await saveMedia(mediaId, url);
        finalUrl = `db://${mediaId}`;
      }
    }
    const newAsset = {
      id: `uploaded-${Date.now()}`,
      type,
      url: finalUrl,
      nodeName: name,
      tag: '全部'
    };
    setUploadedAssets(prev => [newAsset, ...prev]);
  }, [setUploadedAssets]);

  // 物理级强力跨域安全直接下载助手，绝对防范跳走覆盖画布页面的问题！
  const downloadFileDirectly = async (url: string, filename: string) => {
    if (!url) return;
    try {
      let finalUrl = url;
      if (url.startsWith('db://')) {
        const mediaId = url.replace('db://', '');
        const getMedia = (window as any).getMediaFromDB;
        if (typeof getMedia === 'function') {
          const base64 = await getMedia(mediaId);
          if (base64) finalUrl = base64;
        }
      }

      // 1. 如果是 Base64 格式，直接在前端转化 Blob 下载
      if (finalUrl.startsWith('data:')) {
        const response = await fetch(finalUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        return;
      }

      // 2. 如果是正常的 http/https 资源（包含跨域与同源），为了 100% 物理避开 CORS 并防范窗口弹出与跳页劫持，
      // 我们直接采用网关中转代理物理下载通道，由 Node 后端返回 attachment 头部强制静默下载！
      if (finalUrl.startsWith('http')) {
        const proxyUrl = `http://localhost:3000/api/v1/download/proxy?url=${encodeURIComponent(finalUrl)}&filename=${encodeURIComponent(filename)}`;
        const a = document.createElement('a');
        a.href = proxyUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // 3. 兜底普通下载
      const response = await fetch(finalUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Direct download failed, falling back to new window:', error);
      window.open(url, '_blank'); // 兜底保护
    }
  };

  useEffect(() => {
    (window as any).spawnLinkedNode = spawnLinkedNode;
    (window as any).addUploadedAsset = addUploadedAsset;
    (window as any).downloadFileDirectly = downloadFileDirectly;
    (window as any).setFullScreenMedia = setFullScreenMedia;

    const handleOpenLargeModal = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { tab, nodeTarget, type } = customEvent.detail || {};
      
      let targetTab: any = tab;
      if (tab === 'workflows') {
        targetTab = 'templates';
      }
      
      setActiveFloatingPopup(targetTab);
      setModalNodeTarget(nodeTarget || null);
      setModalMediaType(type || null);
      
      if (tab === 'assets' && type) {
        if (type === 'audio') {
          setAssetLargeTab('virtual'); // 智能派生克隆声线
        } else {
          setAssetLargeTab('mine'); // 资产库选入直接显示“我的资产”TAB界面
        }
      }
      if (targetTab === 'templates' && type) {
        if (type === 'video' || type === 'image' || type === 'audio' || type === 'custom') {
          setTemplateLargeTab(type as any);
        }
      }
    };

    window.addEventListener('open-large-modal', handleOpenLargeModal);

    return () => {
      delete (window as any).spawnLinkedNode;
      delete (window as any).addUploadedAsset;
      window.removeEventListener('open-large-modal', handleOpenLargeModal);
    };
  }, [spawnLinkedNode, addUploadedAsset]);

  const handleResourceUpload = (file: File) => {
    console.log("handleResourceUpload triggered for file:", file.name, file.type);
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const fileType = file.type.startsWith('image/') 
          ? 'image' 
          : file.type.startsWith('audio/') 
            ? 'audio' 
            : file.type.startsWith('video/') 
              ? 'video' 
              : 'image';
        
        const mediaId = `media-asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const saveMedia = (window as any).saveMediaToDB;
        let finalUrl = reader.result;
        if (typeof saveMedia === 'function') {
          await saveMedia(mediaId, reader.result);
          finalUrl = `db://${mediaId}`;
        }

        const newAsset = {
          id: `uploaded-${Date.now()}`,
          type: fileType as any,
          url: finalUrl,
          nodeName: `📦 本地上传: ${file.name}`,
          tag: '全部'
        };
        
        // 根据当前 tab 保存到对应的库
        switch (assetLargeTab) {
          case 'mine':
            setUploadedAssets(prev => [newAsset, ...prev]);
            // 只有「我的资产」上传后自动创建节点
            createUploadNode(file.name, fileType, finalUrl);
            break;
          case 'library':
            setLibraryAssets(prev => [...prev, { id: `lib-${Date.now()}`, type: fileType, url: finalUrl, name: file.name }]);
            break;
          case 'virtual':
            setVirtualAssets(prev => [...prev, { id: `virt-${Date.now()}`, type: fileType, url: finalUrl, name: file.name }]);
            break;
          case 'other':
            setLoraAssets(prev => [...prev, { id: `lora-${Date.now()}`, type: fileType, url: finalUrl, name: file.name }]);
            break;
        }
      }
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
    };
    reader.readAsDataURL(file);
  };

  // 创建 upload 节点的辅助函数（仅「我的资产」使用）
  const createUploadNode = (fileName: string, fileType: string, fileUrl: string) => {
    const id = `upload-node-${Date.now()}`;
    let viewportCenter = { x: 300, y: 300 };
    try {
      if (typeof screenToFlowPosition === 'function') {
        viewportCenter = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      }
    } catch {}

    const safePos = findNonOverlappingPosition(nodes, viewportCenter.x, viewportCenter.y);
    const newNode = {
      id,
      type: 'upload-node',
      position: safePos,
      width: 300,
      height: 260,
      data: {
        label: `📦 上传资源: ${fileName}`,
        progress: 100,
        inputs: { fileType, fileUrl, fileName },
        outputs: { output: fileUrl, fileType },
        isNew: true
      }
    };

    setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);

    setTimeout(() => {
      setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, isNew: false } } : n));
    }, 3000);
  };

  // pane and node right-click events
  const onPaneContextMenu = useCallback(
    (event: any) => {
      event.preventDefault();
      setNodeContextMenu(null);
      setPaneContextMenuPos({ x: event.clientX, y: event.clientY });
    },
    []
  );

  const onNodeContextMenu = useCallback(
    (event: any, node: Node) => {
      event.preventDefault();
      setPaneContextMenuPos(null);
      setNodeContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
    },
    []
  );

  const onPaneDoubleClick = useCallback(
    (event: any) => {
      // 仅在双击画布空白处时触发 (不影响节点、侧边栏或弹出层的正常交互)
      const target = event.target as HTMLElement;
      const isPane = target.classList.contains('react-flow__pane') || 
                     target.closest('.react-flow__pane') !== null;
      const isNode = target.closest('.react-flow__node') !== null;
      const isSidebar = target.closest('aside') !== null;
      const isHeader = target.closest('header') !== null;
      const isModal = target.closest('.glass-panel') !== null;

      if (!isPane || isNode || isSidebar || isHeader || isModal) {
        return;
      }

      event.preventDefault();
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const safePos = findNonOverlappingPosition(nodes, flowPos.x, flowPos.y);
      const id = `prompt-source-${Date.now()}`;
      const newNode = {
        id,
        type: 'prompt-source',
        position: safePos,
        width: 280,
        height: 160,
        data: {
          label: '📖 故事剧本源',
          inputs: {
            text: '双击空白处热新增的镜头剧本...'
          },
          outputs: {},
          isNew: true
        }
      };
      setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);
      
      setTimeout(() => {
        setNodes((nds) => nds.map(n => n.id === id ? {
          ...n,
          data: {
            ...n.data,
            isNew: false
          }
        } : n));
      }, 3000);

      alert('🎉 已通过双击在当前指针落点热新增 [📖 故事剧本源] 节点！');
    },
    [screenToFlowPosition, setNodes, nodes, findNonOverlappingPosition]
  );

  const handleNodeContextMenuAction = (actionId: string, nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    switch (actionId) {
      case 'create_asset': {
        const nodeData = node.data as any;
        const mediaUrl = nodeData?.outputs?.image || nodeData?.outputs?.audio || nodeData?.outputs?.video || nodeData?.outputUrl || '';
        setAssetToSave({
          nodeId: node.id,
          url: mediaUrl,
          nodeName: nodeData.label || '新提取资产'
        });
        const now = new Date();
        const formattedDate = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        setSaveAssetName(`🎨 ${node.data.label || '资产'} 成果 - ${formattedDate}`);
        setSaveAssetDesc(`来自节点 [${node.data.label || '工作流'}] 的高精物理生成成果。`);
        setSaveAssetTag('人物');
        setIsSaveAssetOpen(true);
        break;
      }
      case 'copy': {
        setCopiedNode(node);
        alert('📋 节点已成功复制到剪贴板，您可以在画布任意空白处右键进行粘贴，或使用 Ctrl+V 快捷键！');
        break;
      }
      case 'duplicate': {
        const id = `${node.type}-${Date.now()}`;
        const safePos = findNonOverlappingPosition(nodes, node.position.x + 80, node.position.y + 80);
        const clonedNode = {
          ...node,
          id,
          selected: true,
          position: safePos,
          data: {
            ...node.data,
            outputs: {},
            isNew: true
          }
        };
        setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(clonedNode));
        
        setTimeout(() => {
          setNodes((nds) => nds.map(n => n.id === id ? {
            ...n,
            data: {
              ...n.data,
              isNew: false
            }
          } : n));
        }, 3000);

        alert('👥 已成功克隆节点副本并自动向右下方进行防重叠错开！');
        break;
      }
      case 'download': {
        const nodeData = node.data as any;
        const mediaUrl = nodeData?.outputs?.image || nodeData?.outputs?.audio || nodeData?.outputs?.video || nodeData?.outputUrl;
        if (mediaUrl) {
          downloadFileDirectly(mediaUrl, `toonflow-media-${node.id}`);
        } else {
          alert('💡 该节点暂无可下载的生成成果媒体！');
        }
        break;
      }
      case 'delete': {
        setNodes(nds => nds.filter(n => n.id !== nodeId));
        break;
      }
      default:
        break;
    }
  };

  const handleConfirmSaveAsset = () => {
    if (!saveAssetName.trim()) {
      alert('请输入资产名称！');
      return;
    }
    const newAsset = {
      id: `saved-${Date.now()}`,
      name: saveAssetName.trim(),
      desc: saveAssetDesc.trim(),
      tag: saveAssetTag,
      url: assetToSave?.url || '',
      nodeName: assetToSave?.nodeName || '我的资产',
      type: assetToSave?.url?.includes('.mp4') ? 'video' : (assetToSave?.url?.includes('.mp3') || assetToSave?.url?.includes('.wav') ? 'audio' : 'image')
    };
    const saved = localStorage.getItem('my_saved_assets');
    const list = saved ? JSON.parse(saved) : [];
    list.unshift(newAsset);
    localStorage.setItem('my_saved_assets', JSON.stringify(list));
    setIsSaveAssetOpen(false);
    alert(`🎉 恭喜！资产 [${saveAssetName}] 已成功保存到“我的资产”中，随时可以在左侧“📦 资产”面板进行筛选与一键灌装！`);
  };

  const getFilteredAssets = () => {
    const publicPresets = [
      {
        id: 'preset-voice-1',
        type: 'audio' as const,
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        nodeName: '🎙️ 预置磁性男声 (TTS)',
        tag: '音频',
        desc: '大师级电影旁白磁性男声音色'
      },
      {
        id: 'preset-voice-2',
        type: 'audio' as const,
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        nodeName: '🎙️ 预置甜美女声 (TTS)',
        tag: '音频',
        desc: '温暖治愈系甜美配音女声音色'
      },
      {
        id: 'preset-image-1',
        type: 'image' as const,
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
        nodeName: '🖼️ 预置赛博城堡背景',
        tag: '场景',
        desc: '流光溢彩的赛博朋克大场景渲染图'
      },
      {
        id: 'preset-image-2',
        type: 'image' as const,
        url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f',
        nodeName: '🖼️ 预置机甲少女原画',
        tag: '人物',
        desc: 'AixCanvas 机甲少女经典一致性主角肖像图'
      }
    ];

    if (assetSubTab === 'public') {
      return publicPresets.filter(asset => {
        if (assetTagFilter === '全部') return true;
        return asset.tag === assetTagFilter;
      });
    }

    const mineAssets: any[] = [];

    const saved = localStorage.getItem('my_saved_assets');
    const localSaved = saved ? JSON.parse(saved) : [];
    mineAssets.push(...localSaved);

    uploadedAssets.forEach(ua => {
      let tag = '其他';
      if (ua.type === 'audio') tag = '音频';
      if (ua.type === 'video') tag = '视频';
      if (ua.type === 'image') tag = '人物';
      mineAssets.push({
        id: ua.id,
        type: ua.type,
        url: ua.url,
        nodeName: ua.nodeName,
        tag: tag
      });
    });

    nodes.forEach(node => {
      const nodeData = node.data as any;
      if (nodeData?.outputs?.image) {
        mineAssets.push({
          id: `${node.id}-img`,
          type: 'image',
          url: nodeData.outputs.image,
          nodeName: `🖼️ [${nodeData.label || '生图'}] 节点成果`,
          tag: '其他'
        });
      }
      if (nodeData?.outputs?.audio) {
        mineAssets.push({
          id: `${node.id}-aud`,
          type: 'audio',
          url: nodeData.outputs.audio,
          nodeName: `🎵 [${nodeData.label || '音频'}] 节点成果`,
          tag: '音频'
        });
      }
      if (nodeData?.outputs?.video) {
        mineAssets.push({
          id: `${node.id}-vid`,
          type: 'video',
          url: nodeData.outputs.video,
          nodeName: `📹 [${nodeData.label || '视频'}] 节点成果`,
          tag: '视频'
        });
      }
      if (nodeData?.outputUrl) {
        const cleanUrl = nodeData.outputUrl.split('?')[0].toLowerCase();
        const type = cleanUrl.endsWith('.mp4') ? 'video' : (cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') ? 'audio' : 'image');
        let tag = '其他';
        if (type === 'video') tag = '视频';
        if (type === 'audio') tag = '音频';
        mineAssets.push({
          id: `${node.id}-out`,
          type: type,
          url: nodeData.outputUrl,
          nodeName: `📦 [${nodeData.label || '工作流'}] 生成成果`,
          tag: tag
        });
      }
    });

    const uniqueMine: any[] = [];
    const visitedIds = new Set<string>();
    mineAssets.forEach(asset => {
      const key = asset.id || asset.url;
      if (key && !visitedIds.has(key)) {
        visitedIds.add(key);
        uniqueMine.push(asset);
      }
    });

    return uniqueMine.filter(asset => {
      if (assetTagFilter === '全部') return true;
      return asset.tag === assetTagFilter;
    });
  };

  const getHistoryItems = () => {
    const items: Array<{ id: string; type: 'image' | 'video' | 'audio'; url: string; name: string; source: string }> = [];

    const presets = [
      {
        id: 'h-preset-1',
        type: 'image' as const,
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
        name: '🖼️ 赛博城堡原画',
        source: 'PRESET'
      },
      {
        id: 'h-preset-2',
        type: 'image' as const,
        url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f',
        name: '🖼️ 机甲少女角色图',
        source: 'PRESET'
      },
      {
        id: 'h-preset-3',
        type: 'audio' as const,
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        name: '🎙️ 磁性男声克隆',
        source: 'PRESET'
      },
      {
        id: 'h-preset-4',
        type: 'audio' as const,
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        name: '🎙️ 甜美女声旁白',
        source: 'PRESET'
      }
    ];

    presets.forEach(p => {
      if (p.type === historySubTab) items.push(p);
    });

    uploadedAssets.forEach(ua => {
      if (ua.type === historySubTab) {
        items.push({
          id: ua.id,
          type: ua.type,
          url: ua.url,
          name: ua.nodeName,
          source: 'LOCAL'
        });
      }
    });

    nodes.forEach(node => {
      const nodeData = node.data as any;
      if (historySubTab === 'image' && nodeData?.outputs?.image) {
        items.push({
          id: `${node.id}-h-img`,
          type: 'image',
          url: nodeData.outputs.image,
          name: `生图: ${nodeData.label || node.id}`,
          source: 'GEN'
        });
      }
      if (historySubTab === 'audio' && nodeData?.outputs?.audio) {
        items.push({
          id: `${node.id}-h-aud`,
          type: 'audio',
          url: nodeData.outputs.audio,
          name: `配音: ${nodeData.label || node.id}`,
          source: 'GEN'
        });
      }
      if (historySubTab === 'video' && nodeData?.outputs?.video) {
        items.push({
          id: `${node.id}-h-vid`,
          type: 'video',
          url: nodeData.outputs.video,
          name: `合成: ${nodeData.label || node.id}`,
          source: 'GEN'
        });
      }
      if (nodeData?.outputUrl) {
        const cleanUrl = nodeData.outputUrl.split('?')[0].toLowerCase();
        const type = cleanUrl.endsWith('.mp4') ? 'video' : (cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') ? 'audio' : 'image');
        if (type === historySubTab) {
          items.push({
            id: `${node.id}-h-out`,
            type: type,
            url: nodeData.outputUrl,
            name: `成果: ${nodeData.label || node.id}`,
            source: 'RUN'
          });
        }
      }
    });

    // 拼入物理真实的生成成果历史，确保每一次生成的图片/音视频都能独立展出
    historyAssets.forEach(ha => {
      if (ha.type === historySubTab) {
        items.push({
          id: ha.id,
          type: ha.type,
          url: ha.url,
          name: ha.nodeName,
          source: 'REAL_HIST'
        });
      }
    });

    const uniqueItems: typeof items = [];
    const visited = new Set<string>();
    items.forEach(it => {
      if (!visited.has(it.url)) {
        visited.add(it.url);
        uniqueItems.push(it);
      }
    });

    return uniqueItems;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        setDeletedElementsStack((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          setNodes((nds) => {
            const existingIds = new Set(nds.map((n) => n.id));
            const restoredNodes = last.nodes.filter((n) => !existingIds.has(n.id)).map((n) => ({ ...n, selected: true }));
            return nds.map((n) => ({ ...n, selected: false })).concat(restoredNodes);
          });
          setEdges((eds) => {
            const existingIds = new Set(eds.map((eg) => eg.id));
            const restoredEdges = last.edges.filter((eg) => !existingIds.has(eg.id));
            return eds.concat(restoredEdges);
          });
          return prev.slice(0, -1);
        });
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setNodes((nds) => {
          const selectedNodes = nds.filter((n) => n.selected);
          const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
          if (selectedNodeIds.size > 0) {
            setEdges((eds) => {
              const deletedEdges = eds.filter((edge) => edge.selected || selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target));
              setDeletedElementsStack(prev => [...prev, { nodes: selectedNodes, edges: deletedEdges }]);
              return eds.filter((edge) => !edge.selected && !selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target));
            });
          } else {
            setEdges((eds) => {
              const deletedEdges = eds.filter((edge) => edge.selected);
              if (deletedEdges.length > 0) {
                setDeletedElementsStack(prev => [...prev, { nodes: [], edges: deletedEdges }]);
              }
              return eds.filter((edge) => !edge.selected);
            });
          }
          return nds.filter((n) => !n.selected);
        });
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selected = nodes.find(n => n.selected);
        if (selected) {
          setCopiedNode(selected);
          console.log('📋 Copied node:', selected.id);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (copiedNode) {
          e.preventDefault();
          const id = `${copiedNode.type}-${Date.now()}`;
          const safePos = findNonOverlappingPosition(nodes, copiedNode.position.x + 80, copiedNode.position.y + 80);
          const pastedNode = {
            ...copiedNode,
            id,
            selected: true,
            position: safePos,
            data: {
              ...copiedNode.data,
              outputs: {},
              isNew: true
            }
          };
          setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(pastedNode));
          
          setTimeout(() => {
            setNodes((nds) => nds.map(n => n.id === id ? {
              ...n,
              data: {
                ...n.data,
                isNew: false
              }
            } : n));
          }, 3000);

          alert('📋 已通过快捷键成功粘贴节点！');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, copiedNode, setNodes, setEdges, deletedElementsStack]);

  const handleSelectRunningHubWorkflow = (wfId: string, label: string) => {
    const selected = nodes.find(n => n.selected);
    const customMappings = wfId === '2034899011521482754' ? [
      { portId: 'port_prompt', nodeId: '33', fieldName: 'text', displayName: '📖 提示词 Prompt' }
    ] : [
      { portId: 'port_cfg', nodeId: '10', fieldName: 'cfg', displayName: '🎛️ 缪斯 CFG 微调' },
      { portId: 'port_denoise', nodeId: '10', fieldName: 'denoise', displayName: '⚡ 降噪系数 Denoise' },
      { portId: 'port_prompt', nodeId: '6', fieldName: 'text', displayName: '📖 提示词 Prompt' }
    ];

    if (selected) {
      setNodes(nds => nds.map(n => {
        if (n.id === selected.id) {
          if (n.type === 'image-service' || n.type === 'video-fusion') {
            return {
              ...n,
              data: {
                ...n.data,
                inputs: {
                  ...((n.data as any)?.inputs || {}),
                  activeTab: 'aix',
                  runningHubTemplateId: wfId,
                  runningHubWorkflowName: label
                }
              }
            };
          }
          return {
            ...n,
            type: 'custom-workflow',
            data: {
              ...n.data,
              label: label,
              source: 'runninghub',
              runningHubId: wfId,
              workflowIdOrJson: wfId,
              mappings: customMappings
            }
          };
        }
        return n;
      }));
      alert(`🎉 已为选中节点加载 AIX 独家云端工作流：${label}！`);
    } else {
      const id = `custom-${Date.now()}`;
      const newNode = {
        id,
        type: 'custom-workflow',
        position: { x: 400, y: 200 },
        width: 320,
        height: 240,
        data: {
          label: label,
          source: 'runninghub' as const,
          runningHubId: wfId,
          workflowIdOrJson: wfId,
          mappings: customMappings,
          onEdit: handleEditNode
        }
      };
      setNodes((nds) => [...nds, newNode]);
      alert(`🎉 已将 AIX 独家云端工作流节点添加到画布：${label}！`);
    }
    setIsModelPickerOpen(false);
    setHoveredCategory(null);
  };

  const handleSelectStandardModel = (modelName: string) => {
    const selected = nodes.find(n => n.selected);
    if (selected) {
      setNodes(nds => nds.map(n => {
        if (n.id === selected.id) {
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
      }));
      alert(`🎉 已将选中节点的模型切换为: ${modelName}`);
    } else {
      alert(`💡 提示：请先在画布中点击选中任意 Agent 节点，再为其指定 [${modelName}] 物理模型！`);
    }
    setIsModelPickerOpen(false);
    setHoveredCategory(null);
  };

  const handleUpdateNodeInputs = (nodeId: string, updates: any) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
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
    }));
  };

  const handleInjectCommunityTemplate = (templateType: 'auto-storyboard' | 'face-consistency' | 'video-fusion-group' | 'vr-360-pano' | 'seedance-full' | 'amazon-a-plus' | 'brand-ip-design' | 'movie-lighting' | 'art-style-transfer' | 'rh-test-generate') => {
    console.log("[Template] Injecting template:", templateType);
    const groupId = `group-${Date.now()}`;
    const node1Id = `node1-${Date.now()}`;
    const node2Id = `node2-${Date.now()}`;
    const node3Id = `node3-${Date.now()}`;

    let newNodes: Node[] = [];
    let newEdges: Edge[] = [];

    if (templateType === 'rh-test-generate') {
      newNodes = [
        {
          id: groupId,
          type: 'purple-group',
          position: { x: 150, y: 100 },
          style: { width: 780, height: 380 },
          data: { label: '⚡ RunningHub 极简文生图测试组' }
        },
        {
          id: node1Id,
          type: 'prompt-source',
          position: { x: 40, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              text: 'a futuristic cybernetic cat sitting on a neon skyscraper, 8k resolution, cinematic lighting'
            }
          }
        },
        {
          id: node2Id,
          type: 'custom-workflow',
          position: { x: 420, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            label: '🔮 RunningHub 极简生图测试 (2034899011521482754)',
            source: 'runninghub' as const,
            runningHubId: '2034899011521482754',
            workflowIdOrJson: '2034899011521482754',
            mappings: [
              { portId: 'port_prompt', nodeId: '33', fieldName: 'text', displayName: '📖 输入提示词 (Prompt)' }
            ],
            inputs: {}
          }
        }
      ];

      newEdges = [
        {
          id: `e-template-1-${Date.now()}`,
          source: node1Id,
          sourceHandle: 'output',
          target: node2Id,
          targetHandle: 'port_prompt',
          type: 'button',
          animated: true,
          style: { stroke: '#10b981', strokeWidth: 2 }
        }
      ];
    } else if (templateType === 'auto-storyboard') {
      newNodes = [
        {
          id: groupId,
          type: 'purple-group',
          position: { x: 150, y: 100 },
          style: { width: 1160, height: 380 },
          data: { label: '🎬 全自动剧本分镜组 (RunningHub)' }
        },
        {
          id: node1Id,
          type: 'prompt-source',
          position: { x: 40, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              text: '在一个被反重力充斥的魔法世界中，下着逆流升空的霓虹代码雨。少女张开晶体双翅翱翔。'
            }
          }
        },
        {
          id: node2Id,
          type: 'llm-service',
          position: { x: 420, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'minimax',
              model: 'minimax-m2.7-chat',
              skillId: 'storyboard-expert',
              temperature: 0.7
            }
          }
        },
        {
          id: node3Id,
          type: 'image-service',
          position: { x: 800, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'minimax',
              model: 'flux-schnell',
              size: '1024x1024',
              cfg: 7.5,
              steps: 25
            }
          }
        }
      ];

      newEdges = [
        {
          id: `e-template-1-${Date.now()}`,
          source: node1Id,
          sourceHandle: 'output',
          target: node2Id,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-primary))', strokeWidth: 2 }
        },
        {
          id: `e-template-2-${Date.now()}`,
          source: node2Id,
          sourceHandle: 'output',
          target: node3Id,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-secondary))', strokeWidth: 2 }
        }
      ];
    } else if (templateType === 'face-consistency') {
      newNodes = [
        {
          id: groupId,
          type: 'purple-group',
          position: { x: 150, y: 100 },
          style: { width: 1160, height: 380 },
          data: { label: '🎭 AIX 独家面部一致性洗图组' }
        },
        {
          id: node1Id,
          type: 'prompt-source',
          position: { x: 40, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              text: '一个赛博机甲少女的原画参考'
            }
          }
        },
        {
          id: node2Id,
          type: 'image-service',
          position: { x: 420, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'minimax',
              model: 'flux-schnell',
              size: '1024x1024',
              cfg: 7.5,
              steps: 25
            }
          }
        },
        {
          id: node3Id,
          type: 'custom-workflow',
          position: { x: 800, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            label: '🎭 RunningHub 面部一致性洗图',
            source: 'runninghub' as const,
            runningHubId: 'rh_wf_face_consistency',
            workflowIdOrJson: 'rh_wf_face_consistency',
            mappings: [
              { portId: 'port_cfg', nodeId: '10', fieldName: 'cfg', displayName: '🎛️ 缪斯 CFG 微调' },
              { portId: 'port_denoise', nodeId: '10', fieldName: 'denoise', displayName: '⚡ 降噪系数 Denoise' },
              { portId: 'port_prompt', nodeId: '6', fieldName: 'text', displayName: '📖 提示词 Prompt' }
            ],
            inputs: {}
          }
        }
      ];

      newEdges = [
        {
          id: `e-template-1-${Date.now()}`,
          source: node1Id,
          sourceHandle: 'output',
          target: node2Id,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-primary))', strokeWidth: 2 }
        },
        {
          id: `e-template-2-${Date.now()}`,
          source: node2Id,
          sourceHandle: 'output',
          target: node3Id,
          targetHandle: 'port_prompt',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-secondary))', strokeWidth: 2 }
        }
      ];
    } else if (templateType === 'video-fusion-group') {
      newNodes = [
        {
          id: groupId,
          type: 'purple-group',
          position: { x: 100, y: 60 },
          style: { width: 1200, height: 460 },
          data: { label: '📹 高保真音视频融合大组' }
        },
        {
          id: node1Id,
          type: 'image-service',
          position: { x: 40, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'minimax',
              model: 'flux-schnell',
              size: '1024x1024',
              cfg: 7.5,
              steps: 25
            }
          }
        },
        {
          id: node2Id,
          type: 'tts-service',
          position: { x: 420, y: 160 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'minimax',
              model: 'fish-speech-1.4',
              characterName: '剧本男声'
            }
          }
        },
        {
          id: node3Id,
          type: 'video-fusion',
          position: { x: 820, y: 100 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'vidu',
              model: 'vidu-high-speed',
              width: 1024,
              height: 1024,
              duration: 5
            }
          }
        }
      ];

      newEdges = [
        {
          id: `e-template-1-${Date.now()}`,
          source: node1Id,
          sourceHandle: 'output',
          target: node3Id,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-secondary))', strokeWidth: 2 }
        },
        {
          id: `e-template-2-${Date.now()}`,
          source: node2Id,
          sourceHandle: 'output',
          target: node3Id,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: '#0ea5e9', strokeWidth: 2 }
        }
      ];
    } else if (templateType === 'vr-360-pano') {
      newNodes = [
        {
          id: groupId,
          type: 'purple-group',
          position: { x: 150, y: 100 },
          style: { width: 780, height: 380 },
          data: { label: '🎬 VR360° 全景4K (SDXL)' }
        },
        {
          id: node1Id,
          type: 'prompt-source',
          position: { x: 40, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              text: 'vr360 panorama, futuristic glass terminal interior, flying drones, highly detailed, photorealistic'
            }
          }
        },
        {
          id: node2Id,
          type: 'image-service',
          position: { x: 420, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'minimax',
              model: 'flux-schnell',
              size: '1024x1024',
              cfg: 7.5,
              steps: 25
            }
          }
        }
      ];
      newEdges = [
        {
          id: `e-template-1-${Date.now()}`,
          source: node1Id,
          sourceHandle: 'output',
          target: node2Id,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-primary))', strokeWidth: 2 }
        }
      ];
    } else if (templateType === 'seedance-full') {
      newNodes = [
        {
          id: groupId,
          type: 'purple-group',
          position: { x: 150, y: 100 },
          style: { width: 780, height: 380 },
          data: { label: '🎨 Seedance2.0 满血生图组' }
        },
        {
          id: node1Id,
          type: 'prompt-source',
          position: { x: 40, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              text: 'anime girl with cybernetic wings, looking down from a mechanical sky-tower, seedance style, masterpiece'
            }
          }
        },
        {
          id: node2Id,
          type: 'image-service',
          position: { x: 420, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'minimax',
              model: 'flux-schnell',
              size: '1024x1024',
              cfg: 7.5,
              steps: 25
            }
          }
        }
      ];
      newEdges = [
        {
          id: `e-template-1-${Date.now()}`,
          source: node1Id,
          sourceHandle: 'output',
          target: node2Id,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-primary))', strokeWidth: 2 }
        }
      ];
    } else if (templateType === 'amazon-a-plus') {
      newNodes = [
        {
          id: groupId,
          type: 'purple-group',
          position: { x: 150, y: 100 },
          style: { width: 780, height: 380 },
          data: { label: '🛍️ 亚马逊品牌A+详情页生图组' }
        },
        {
          id: node1Id,
          type: 'prompt-source',
          position: { x: 40, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              text: 'a luxury premium crystal perfume bottle on a dynamic black glass pedestal, studio lighting, water splashes, high-end commercial photo'
            }
          }
        },
        {
          id: node2Id,
          type: 'image-service',
          position: { x: 420, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'minimax',
              model: 'flux-schnell',
              size: '1024x1024',
              cfg: 7.5,
              steps: 25
            }
          }
        }
      ];
      newEdges = [
        {
          id: `e-template-1-${Date.now()}`,
          source: node1Id,
          sourceHandle: 'output',
          target: node2Id,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-primary))', strokeWidth: 2 }
        }
      ];
    } else if (templateType === 'brand-ip-design') {
      newNodes = [
        {
          id: groupId,
          type: 'purple-group',
          position: { x: 150, y: 100 },
          style: { width: 780, height: 380 },
          data: { label: '🧸 品牌IP公仔创建组' }
        },
        {
          id: node1Id,
          type: 'prompt-source',
          position: { x: 40, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              text: 'a cute futuristic neon-colored vinyl toy astronaut mascot, 3d render, clay material, studio background, popmart style'
            }
          }
        },
        {
          id: node2Id,
          type: 'image-service',
          position: { x: 420, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'minimax',
              model: 'flux-schnell',
              size: '1024x1024',
              cfg: 7.5,
              steps: 25
            }
          }
        }
      ];
      newEdges = [
        {
          id: `e-template-1-${Date.now()}`,
          source: node1Id,
          sourceHandle: 'output',
          target: node2Id,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-primary))', strokeWidth: 2 }
        }
      ];
    } else if (templateType === 'movie-lighting') {
      newNodes = [
        {
          id: groupId,
          type: 'purple-group',
          position: { x: 150, y: 100 },
          style: { width: 780, height: 380 },
          data: { label: '🎬 影视黄金参数生图组' }
        },
        {
          id: node1Id,
          type: 'prompt-source',
          position: { x: 40, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              text: 'cinematic close up shot of a cybernetic rebel leader, neon street reflections, dramatic rain, shot on 35mm lens, depth of field'
            }
          }
        },
        {
          id: node2Id,
          type: 'image-service',
          position: { x: 420, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'minimax',
              model: 'flux-schnell',
              size: '1024x1024',
              cfg: 7.5,
              steps: 25
            }
          }
        }
      ];
      newEdges = [
        {
          id: `e-template-1-${Date.now()}`,
          source: node1Id,
          sourceHandle: 'output',
          target: node2Id,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-primary))', strokeWidth: 2 }
        }
      ];
    } else if (templateType === 'art-style-transfer') {
      newNodes = [
        {
          id: groupId,
          type: 'purple-group',
          position: { x: 150, y: 100 },
          style: { width: 1160, height: 380 },
          data: { label: '🎨 RunningHub 艺术流派跨界重绘组' }
        },
        {
          id: node1Id,
          type: 'prompt-source',
          position: { x: 40, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              text: '一幅中国古典水墨风格的山水人物画'
            }
          }
        },
        {
          id: node2Id,
          type: 'image-service',
          position: { x: 420, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            inputs: {
              providerId: 'minimax',
              model: 'flux-schnell',
              size: '1024x1024',
              cfg: 7.5,
              steps: 25
            }
          }
        },
        {
          id: node3Id,
          type: 'custom-workflow',
          position: { x: 800, y: 80 },
          parentId: groupId,
          extent: 'parent' as const,
          data: {
            label: '🎨 RunningHub 艺术流派跨界重绘',
            source: 'runninghub' as const,
            runningHubId: 'rh_wf_style_transfer',
            workflowIdOrJson: 'rh_wf_style_transfer',
            mappings: [
              { portId: 'port_style', nodeId: '12', fieldName: 'style', displayName: '🎭 艺术风格 Style' },
              { portId: 'port_image', nodeId: '8', fieldName: 'image', displayName: '🖼️ 原始输入图像 Image' },
              { portId: 'port_prompt', nodeId: '6', fieldName: 'text', displayName: '📖 重绘提示词 Prompt' }
            ],
            inputs: {}
          }
        }
      ];
      newEdges = [
        {
          id: `e-template-1-${Date.now()}`,
          source: node1Id,
          sourceHandle: 'output',
          target: node2Id,
          targetHandle: 'input',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-primary))', strokeWidth: 2 }
        },
        {
          id: `e-template-2-${Date.now()}`,
          source: node2Id,
          sourceHandle: 'output',
          target: node3Id,
          targetHandle: 'port_image',
          type: 'button',
          animated: true,
          style: { stroke: 'hsl(var(--accent-secondary))', strokeWidth: 2 }
        }
      ];
    }

    // 智能工作流模板父级组节点防重叠定位优化，紧挨左侧工具栏安全出生
    const groupNodeIndex = newNodes.findIndex(n => n.id === groupId);
    if (groupNodeIndex !== -1) {
      const position = screenToFlowPosition({ x: 380, y: 220 });
      const safePos = findNonOverlappingPosition(nodes, position.x, position.y);
      newNodes[groupNodeIndex].position = safePos;
    }

    setNodes(nds => [...nds, ...newNodes]);
    setEdges(eds => [...eds, ...newEdges]);
    alert(`🎉 智能工作流模板一键拼装成功！`);
    setActiveFloatingPopup(null);
  };

  // 智能添加 Agent 节点
  const handleAddAgentNode = (type: 'prompt-source' | 'llm-service' | 'image-service' | 'tts-service' | 'video-fusion' | 'upload-node' | 'grid-splitter' | 'loop-node', initialData: any = {}) => {
    const id = `${type}-${Date.now()}`;
    const offset = Math.random() * 80;
    let x = 300 + offset;
    let y = 150 + offset;
    if (type === 'prompt-source') { x = 60; y = 200; }
    else if (type === 'llm-service') { x = 400; y = 180; }
    else if (type === 'image-service') { x = 800; y = 50; }
    else if (type === 'tts-service') { x = 800; y = 480; }
    else if (type === 'video-fusion') { x = 1200; y = 220; }
    else if (type === 'upload-node') { x = 600; y = 300; }
    else if (type === 'grid-splitter') { x = 1000; y = 300; }
    else if (type === 'loop-node') { x = 600; y = 150; }

    const labelMap = {
      'prompt-source': '📖 故事剧本源',
      'llm-service': '🧠 剧本专家',
      'image-service': '🎨 智能生图',
      'tts-service': '🗣️ 声音克隆',
      'video-fusion': '📹 视频生成',
      'upload-node': '📦 本地上传',
      'grid-splitter': '✂️ 宫格切分工具',
      'loop-node': '🔄 批量循环迭代'
    };

    let position;
    if (paneContextMenuPos) {
      position = screenToFlowPosition({ x: paneContextMenuPos.x, y: paneContextMenuPos.y });
    } else {
      position = screenToFlowPosition({ x: 380, y: 220 });
    }

    // 运行防重叠定位计算
    const safePos = findNonOverlappingPosition(nodes, position.x, position.y);

    const sizeMap = {
      'prompt-source': { width: 320, height: 280 },
      'llm-service': { width: 320, height: 320 },
      'image-service': { width: 320, height: 480 },
      'tts-service': { width: 320, height: 360 },
      'video-fusion': { width: 320, height: 480 },
      'upload-node': { width: 300, height: 260 },
      'grid-splitter': { width: 300, height: 260 },
      'loop-node': { width: 180, height: 180 }
    };
    const size = sizeMap[type] || { width: 320, height: 240 };

    const newNode = {
      id,
      type,
      position: safePos,
      width: size.width,
      height: size.height,
      data: {
        label: labelMap[type],
        inputs: {
          ...initialData
        },
        outputs: {},
        isNew: true // 开启发光闪烁
      }
    };
    setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);

    setTimeout(() => {
      setNodes((nds) => nds.map(n => n.id === id ? {
        ...n,
        data: {
          ...n.data,
          isNew: false
        }
      } : n));
    }, 3000);
  };

  // 智能分镜拆解 API 请求
  const handleParseScript = async () => {
    if (!scriptText.trim()) {
      alert('请先输入剧本小说内容！');
      return;
    }
    setIsParsingScript(true);
    try {
      const res = await fetch('http://localhost:3000/api/v1/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: 'minimax',
          model: 'minimax-m2.7-chat',
          messages: [{ role: 'user', content: scriptText }],
          systemPrompt: `你是一个专业的短剧分镜导演。请将用户给出的剧本/小说，拆解成3个画面的分镜描述，必须包含：1. 画面提示词(英文) 2. 旁白配音台词(中文)。请以严格的 JSON 数组格式返回，不要有任何 Markdown 包裹或其它文字，如：[{"scene": 1, "prompt": "english prompt", "tts": "中文台词"}]`
        })
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        let content = data.choices[0].message.content.trim();
        if (content.startsWith('```json')) {
          content = content.substring(7);
        } else if (content.startsWith('```')) {
          content = content.substring(3);
        }
        if (content.endsWith('```')) {
          content = content.substring(0, content.length - 3);
        }
        const scenes = JSON.parse(content.trim());
        setParsedScenes(scenes);
      } else {
        throw new Error('未返回有效数据');
      }
    } catch (err: any) {
      console.warn('API分镜解析失败，触发自愈，返回精美 Mock 分镜:', err);
      setParsedScenes([
        { scene: 1, prompt: "Hyper-realistic photo, cybernetic flying wing with glowing neon tracks soaring over a castle of frosted glass, code rain pouring upwards, cyber punk, 8k", tts: "在这个反重力的赛博城市中，逆流的代码雨正诉说着古老的传说。" },
        { scene: 2, prompt: "Hyper-realistic photo, close up of a teenage cyber girl with crystal wings looking up to the code rain, neon lights reflecting on her face, 8k", tts: "少女展开晶体双翼冲上苍穹，眼中倒映着漫天霓虹的流光。" },
        { scene: 3, prompt: "Hyper-realistic photo, spectacular view of neon castle with coding tracks leading to the sky, masterpiece, cinematic lighting, 8k", tts: "磨砂城堡在反引力力场中缓缓悬浮，科技的纪元已然开启。" }
      ]);
    } finally {
      setIsParsingScript(false);
    }
  };

  // 资产自动动态扫描
  const scanAssets = () => {
    const assets: Array<{ id: string; type: 'image' | 'audio' | 'video'; url: string; nodeName: string }> = [];
    assets.push(...uploadedAssets);
    // 注入预置的极品音视频资产，确保开箱即用
    assets.push({
      id: 'preset-voice-1',
      type: 'audio',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      nodeName: '🎙️ 预置磁性男声 (TTS)'
    });
    assets.push({
      id: 'preset-voice-2',
      type: 'audio',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      nodeName: '🎙️ 预置甜美女声 (TTS)'
    });
    assets.push({
      id: 'preset-image-1',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
      nodeName: '🖼️ 预置赛博城堡背景'
    });
    assets.push({
      id: 'preset-image-2',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f',
      nodeName: '🖼️ 预置机甲少女原画'
    });

    // 动态提取画布中所有节点的运行成果！
    nodes.forEach(node => {
      const nodeData = node.data as any;
      if (nodeData?.outputs?.image) {
        assets.push({
          id: `${node.id}-img`,
          type: 'image',
          url: nodeData.outputs.image,
          nodeName: `🖼️ [${nodeData.label || '生图'}] 节点成果`
        });
      }
      if (nodeData?.outputs?.audio) {
        assets.push({
          id: `${node.id}-aud`,
          type: 'audio',
          url: nodeData.outputs.audio,
          nodeName: `🎵 [${nodeData.label || '音频'}] 节点成果`
        });
      }
      if (nodeData?.outputs?.video) {
        assets.push({
          id: `${node.id}-vid`,
          type: 'video',
          url: nodeData.outputs.video,
          nodeName: `📹 [${nodeData.label || '视频'}] 节点成果`
        });
      }
      if (nodeData?.outputUrl) {
        const cleanUrl = nodeData.outputUrl.split('?')[0].toLowerCase();
        const type = cleanUrl.endsWith('.mp4') ? 'video' : (cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') ? 'audio' : 'image');
        assets.push({
          id: `${node.id}-out`,
          type: type as any,
          url: nodeData.outputUrl,
          nodeName: `📦 [${nodeData.label || '工作流'}] 生成成果`
        });
      }
    });
    return assets;
  };

  // 资产一键灌装注入
  const handleInjectAsset = (url: string, type?: 'image' | 'audio' | 'video', name?: string) => {
    const targetNodeId = modalNodeTarget || nodes.find(n => n.selected)?.id;
    const selectedNode = nodes.find(n => n.id === targetNodeId);
    const cleanUrl = url.split('?')[0].toLowerCase();
    const resolvedType = type || (cleanUrl.endsWith('.mp4') ? 'video' : (cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') ? 'audio' : 'image'));
    const resolvedName = name || (resolvedType === 'video' ? '🎬 注入视频' : (resolvedType === 'audio' ? '🎙️ 注入音频' : '🖼️ 注入参考图'));

    if (selectedNode) {
      setNodes(nds => nds.map(n => {
        if (n.id === selectedNode.id) {
          const updates: any = {};
          if (n.type === 'image-service') {
            updates.faceRef = url;
            const prevRefImages = n.data.inputs?.refImages || (n.data.inputs?.faceRef ? [n.data.inputs.faceRef] : []);
            updates.refImages = [...prevRefImages, url];
          } else if (n.type === 'tts-service') {
            updates.refAudio = url;
          } else if (n.type === 'video-fusion') {
            if (resolvedType === 'image') {
              updates.refImage = url;
              updates.image = url;
            } else if (resolvedType === 'audio') {
              updates.refAudio = url;
              updates.audio = url;
            } else if (resolvedType === 'video') {
              updates.refVideo = url;
            }
          } else if (n.type === 'upload-node') {
            updates.fileUrl = url;
            updates.fileName = resolvedName;
            updates.fileType = resolvedType;
          } else if (n.type === 'custom-workflow') {
            const mappings = n.data.mappings || [];
            const imageMapping = mappings.find((m: any) => m.fieldName === 'image' || m.fieldName === 'faceRef' || m.fieldName === 'img');
            const audioMapping = mappings.find((m: any) => m.fieldName === 'audio' || m.fieldName === 'refAudio');
            if (resolvedType === 'image' && imageMapping) {
              updates[`${imageMapping.nodeId}_${imageMapping.fieldName}`] = url;
            } else if (resolvedType === 'audio' && audioMapping) {
              updates[`${audioMapping.nodeId}_${audioMapping.fieldName}`] = url;
            }
          }
          const outputsUpdate: any = {};
          if (n.type === 'upload-node') {
            outputsUpdate.output = url;
            outputsUpdate.fileType = resolvedType;
          }
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                ...updates
              },
              outputs: {
                ...((n.data as any)?.outputs || {}),
                ...outputsUpdate
              }
            }
          };
        }
        return n;
      }));

      if (selectedNode.type !== 'upload-node') {
        spawnLinkedNode(selectedNode.id, 'upload-node', 'left', {
          fileType: resolvedType,
          fileUrl: url,
          fileName: resolvedName.replace(/[🖼️🎙️🎬📦]/g, '').trim()
        });
      }
      
      alert(`🎉 成功将参考资产注入到 [${selectedNode.data.label || selectedNode.id}]，并自动在其左侧派生了直连 [📦 上传资源] 节点！`);
      closeLargeModal();
    } else {
      const id = `upload-node-${Date.now()}`;
      let viewportCenter = { x: 300, y: 300 };
      try {
        if (typeof screenToFlowPosition === 'function') {
          viewportCenter = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }
      } catch (err) {}
      const safePos = findNonOverlappingPosition(nodes, viewportCenter.x, viewportCenter.y);
      const newNode = {
        id,
        type: 'upload-node',
        position: safePos,
        width: 300,
        height: 260,
        data: {
          label: resolvedName,
          progress: 100,
          inputs: {
            fileType: resolvedType,
            fileUrl: url,
            fileName: resolvedName.replace(/[🖼️🎙️🎬📦]/g, '').trim()
          },
          outputs: {
            output: url,
            fileType: resolvedType
          },
          isNew: true
        }
      };
      setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);
      
      setTimeout(() => {
        setCenter(safePos.x, safePos.y, { zoom: 0.95, duration: 600 });
      }, 50);

      setTimeout(() => {
        setNodes((nds) => nds.map(n => n.id === id ? {
          ...n,
          data: {
            ...n.data,
            isNew: false
          }
        } : n));
      }, 3000);

      closeLargeModal();
      alert(`🎉 暂未选中节点，已在画布中央生成了独立的 [${resolvedName}] 资源节点！`);
    }
  };

  const handleApplyStyle = (styleName: string, suffix: string) => {
    const selectedNode = nodes.find(n => n.selected);
    if (selectedNode && (selectedNode.type === 'image-service' || selectedNode.type === 'prompt-source')) {
      setNodes(nds => nds.map(n => {
        if (n.id === selectedNode.id) {
          const targetField = n.type === 'image-service' ? 'prompt' : 'text';
          const currentText = (n.data as any).inputs?.[targetField] || '';
          const updatedText = currentText.includes(suffix) ? currentText : `${currentText}${suffix}`;
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                [targetField]: updatedText
              }
            }
          };
        }
        return n;
      }));
      alert(`🎉 已为选中节点注入 [${styleName}] 美术风格后缀！`);
    } else {
      alert('💡 请先在右侧画布中【鼠标点击选中】一个故事剧本源节点或智能生图节点，再应用风格预设！');
    }
  };

  // ==================== ⚡ 极致丝滑：拉线松开空白处智能派生逻辑 ====================
  const [connectionStart, setConnectionStart] = useState<{
    nodeId: string;
    handleId: string | null;
    handleType: 'source' | 'target';
  } | null>(null);
  const [showConnectMenu, setShowConnectMenu] = useState(false);
  const [connectMenuPos, setConnectMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [connectFlowPos, setConnectFlowPos] = useState<{ x: number; y: number } | null>(null);
  const [showAllOptions, setShowAllOptions] = useState(false);

  const recommendList = useMemo(() => {
    if (!connectionStart) return [];
    const srcNode = nodes.find(n => n.id === connectionStart.nodeId);
    if (!srcNode) return [];
    const recs = TOPOLOGY_RECOMMENDATIONS[srcNode.type || ''] || { upstream: [], downstream: [] };
    return connectionStart.handleType === 'source' ? recs.downstream : recs.upstream;
  }, [connectionStart, nodes]);

  const handleCreateAndConnectNode = useCallback((targetType: string) => {
    if (!connectionStart || !connectFlowPos) return;

    const sourceId = connectionStart.nodeId;
    const srcNode = nodes.find(n => n.id === sourceId);
    if (!srcNode) return;

    const parentId = srcNode.parentId;
    const newId = `${targetType}-${Date.now()}`;
    
    let label = '🎨 新派生节点';
    let dataInputs: any = {};
    let dataOutputs: any = {};

    if (targetType === 'prompt-source') {
      label = '📖 故事剧本源';
      dataInputs = { text: '派生的剧本内容...' };
      dataOutputs = { output: '', text: '' };
    } else if (targetType === 'upload-node') {
      label = '📦 本地上传';
      dataInputs = { fileType: 'image', fileUrl: '' };
      dataOutputs = { output: '', fileType: 'image' };
    } else if (targetType === 'llm-service') {
      label = '🧠 剧本分镜专家';
      dataInputs = { providerId: 'minimax', model: 'MiniMax-M2.7', prompt: '', skillId: 'storyboard-expert', temperature: 0.7 };
      dataOutputs = { storyboard: '', output: '' };
    } else if (targetType === 'image-service') {
      label = '🎨 智能生图 Agent';
      dataInputs = { providerId: 'volcengine', model: 'flux-schnell', prompt: '', faceRef: '', imageRef: '' };
      dataOutputs = { image: '', output: '' };
    } else if (targetType === 'tts-service') {
      label = '🗣️ 声音克隆 Agent';
      dataInputs = { providerId: 'volcengine', model: 'fish-speech-1.4', text: '', voiceId: 'gentle-male' };
      dataOutputs = { audio: '', output: '' };
    } else if (targetType === 'video-fusion') {
      label = '📹 视频合成 Fusion';
      dataInputs = { providerId: 'volcengine', model: 'vidu-high-speed', prompt: '', imageRef: '', audioUrl: '' };
      dataOutputs = { video: '', output: '' };
    } else if (targetType === 'grid-splitter') {
      label = '⊞ 智能切片';
      dataInputs = { cols: 2, rows: 2, gap: 0 };
      dataOutputs = { output: '' };
    } else if (targetType === 'loop-node') {
      label = '🔄 循环迭代';
      dataInputs = { totalRuns: 3, currentRun: 0 };
      dataOutputs = { output: '' };
    }

    const newNode: any = {
      id: newId,
      type: targetType,
      position: connectFlowPos,
      parentId,
      extent: parentId ? 'parent' as const : undefined,
      data: {
        label,
        inputs: dataInputs,
        outputs: dataOutputs,
        isNew: true
      }
    };

    // 智能连线匹配算法
    let sourceHandle = 'output';
    let targetHandle = 'input';

    const isSourceStart = connectionStart.handleType === 'source';

    if (isSourceStart) {
      // 从源节点的输出端向外连
      sourceHandle = connectionStart.handleId || 'output';
      
      // 智能匹配新节点的输入端
      if (targetType === 'image-service') {
        targetHandle = 'input';
      } else if (targetType === 'video-fusion') {
        targetHandle = 'input';
      } else {
        targetHandle = 'input';
      }

      const newEdge = {
        id: `e-${sourceId}-${newId}`,
        source: sourceId,
        sourceHandle,
        target: newId,
        targetHandle,
        type: 'button',
        animated: true,
        style: { stroke: 'rgba(168, 85, 247, 0.85)', strokeWidth: 2 }
      };

      setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), newNode]);
      setEdges((eds) => [...eds, newEdge]);
    } else {
      // 从新节点的输出端连入源节点的输入端
      targetHandle = connectionStart.handleId || 'input';

      // 智能匹配新节点的输出端
      if (targetType === 'image-service') sourceHandle = 'image';
      else if (targetType === 'video-fusion') sourceHandle = 'video';
      else if (targetType === 'tts-service') sourceHandle = 'audio';
      else if (targetType === 'llm-service') sourceHandle = 'output';
      else if (targetType === 'upload-node') sourceHandle = 'output';
      else if (targetType === 'prompt-source') sourceHandle = 'output';
      else sourceHandle = 'output';

      const newEdge = {
        id: `e-${newId}-${sourceId}`,
        source: newId,
        sourceHandle,
        target: sourceId,
        targetHandle,
        type: 'button',
        animated: true,
        style: { stroke: 'rgba(168, 85, 247, 0.85)', strokeWidth: 2 }
      };

      setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), newNode]);
      setEdges((eds) => [...eds, newEdge]);
    }

    setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === newId) {
            return {
              ...n,
              data: {
                ...n.data,
                isNew: false
              }
            };
          }
          return n;
        })
      );
    }, 2000);

    // 重置状态
    setConnectionStart(null);
    setShowConnectMenu(false);
  }, [connectionStart, connectFlowPos, nodes, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: 'button' }, eds));
      setConnectionStart(null); // 连线成功，清空，防止弹出菜单
    },
    [setEdges]
  );

  // 监听并绑定自定义节点的 onEdit 回调
  const handleEditNode = useCallback((id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    setEditingNodeId(id);
    
    const data = (node.data || {}) as any;
    setDrawerLabel(data.label || '自定义工作流');
    const activeSource = data.source || 'local_comfyui';
    setDrawerSource(activeSource);
    
    // 隔离加载，智能向下兼容旧数据
    const comfyVal = data.comfyJson || (activeSource === 'local_comfyui' ? data.workflowIdOrJson : '') || '';
    const rhVal = data.runningHubId || (activeSource === 'runninghub' ? data.workflowIdOrJson : '') || '';
    
    setDrawerComfyJson(comfyVal);
    setDrawerRunningHubId(rhVal);
    
    // 初始化解析和端口映射
    const existingMappings = data.mappings || [];
    const initialSelected: Record<string, boolean> = {};
    const initialAliases: Record<string, string> = {};

    existingMappings.forEach((map: InputMapping) => {
      const paramKey = `${map.nodeId}_${map.fieldName}`;
      initialSelected[paramKey] = true;
      initialAliases[paramKey] = map.displayName;
    });

    setSelectedParams(initialSelected);
    setParamAliases(initialAliases);
    setParsedParams([]); // 等待重新测试或保留已解析
  }, [nodes]);

  // 关闭属性编辑抽屉
  const handleCloseDrawer = () => {
    setEditingNodeId(null);
  };

  // 保存属性配置到对应的画布节点
  const handleSaveDrawer = () => {
    if (!editingNodeId) return;

    // 组装 mappings
    const mappings: InputMapping[] = [];
    
    // 根据已勾选的可解析字段组装映射关系
    parsedParams.forEach(param => {
      const paramKey = `${param.nodeId}_${param.fieldName}`;
      if (selectedParams[paramKey]) {
        mappings.push({
          portId: `port_${paramKey}`,
          nodeId: param.nodeId,
          fieldName: param.fieldName,
          displayName: paramAliases[paramKey] || param.displayName
        });
      }
    });

    // 如果还没有重新解析但存在历史 mappings，我们需要保留那些历史 mappings
    if (parsedParams.length === 0) {
      const currentNode = nodes.find(n => n.id === editingNodeId);
      if (currentNode && currentNode.data.mappings) {
        // 直接继承以前的 mappings
        mappings.push(...(currentNode.data.mappings as InputMapping[]));
      }
    }

    const activeWorkflow = drawerSource === 'local_comfyui' ? drawerComfyJson : drawerRunningHubId;

    setNodes(nds => nds.map(node => {
      if (node.id === editingNodeId) {
        return {
          ...node,
          data: {
            ...node.data,
            label: drawerLabel,
            source: drawerSource,
            comfyJson: drawerComfyJson,
            runningHubId: drawerRunningHubId,
            workflowIdOrJson: activeWorkflow, // 向下兼容旧的执行器字段
            mappings: mappings
          }
        };
      }
      return node;
    }));

    setEditingNodeId(null);
  };

  // 一键智能解析工作流参数
  const handleParseWorkflow = async () => {
    const activeWorkflow = drawerSource === 'local_comfyui' ? drawerComfyJson : drawerRunningHubId;
    if (!activeWorkflow.trim()) {
      alert('请先粘贴工作流 JSON 或输入 RunningHub 工作流 ID');
      return;
    }

    setParsing(true);
    try {
      const res = await fetch('http://localhost:3000/api/v1/custom-workflow/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: drawerSource,
          workflowIdOrJson: activeWorkflow
        })
      });
      const data = await res.json();
      if (data.success && data.parameters) {
        setParsedParams(data.parameters);
        
        // 自动将解析出的参数默认高亮勾选，并初始化别名映射
        const initialSelected: Record<string, boolean> = {};
        const initialAliases: Record<string, string> = {};
        data.parameters.forEach((param: ParsableParameter) => {
          const key = `${param.nodeId}_${param.fieldName}`;
          initialSelected[key] = true;
          initialAliases[key] = param.displayName;
        });
        setSelectedParams(initialSelected);
        setParamAliases(initialAliases);
      } else {
        alert(data.error || '解析失败，未返回有效参数');
      }
    } catch (err: any) {
      console.error(err);
      alert(`智能解析失败: ${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  // 2. 联调运行：WebSocket 会话并触发真实本地多实例 ComfyUI / 远端 RunningHub 的物理执行灌参
  // 2. 联调运行：拓扑安全校验并通过 WebSocket 管道实时驱动多微服务流转
  const handleRunWorkflow = async () => {
    setIsRunning(true);
    setProgressPct(2);
    setProgressMsg('🔌 正在与 API 网关建立 WebSocket 安全信道...');
    setActiveStep('llm_running');

    // 建立唯一的 session ID
    const sessionId = `session-${Date.now()}`;
    const socket = new WebSocket(`ws://localhost:3000/ws/workflow/${sessionId}`);

    socket.onopen = async () => {
      console.log(`[WS] Connected to Gateway session: ${sessionId}`);
      setProgressPct(5);
      setProgressMsg('🔍 正在向网关提交工作流拓扑结构，执行 DAG 循环安全校验与 Kahn 排序...');

      try {
        // 提交整个 React Flow 画布的节点和连线给网关执行拓扑检验与异步流转
        const injectedNodes = injectGroupCompositeData(nodes, edges);
        const res = await fetch('http://localhost:3000/api/v1/workflow/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId: sessionId,
            nodes: injectedNodes,
            edges: edges
          })
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || '网关拒绝执行该拓扑图');
        }
        
        console.log('[Gateway] Workflow task successfully submitted to scheduler.', data);
      } catch (err: any) {
        console.error(err);
        setProgressMsg(`❌ 执行中断: ${err.message}`);
        setIsRunning(false);
        socket.close();
        alert(`工作流拓扑校验失败: ${err.message}`);
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS Msg]', data);

        if (data.event === 'progress') {
          setProgressPct(data.progress);
          setProgressMsg(data.msg);
          setActiveStep(data.status);
        } else if (data.event === 'node_start') {
          // 激活节点：外边框闪烁高亮变色
          setNodes(nds => nds.map(n => n.id === data.nodeId ? {
            ...n,
            data: {
              ...n.data,
              isRunning: true
            }
          } : n));
        } else if (data.event === 'node_success') {
          // 成功完成节点：关闭闪烁高亮，并将生成的成果回填到节点的 outputs 中，并且顺推 LLM 循环提取游标
          setNodes(nds => nds.map(n => {
            if (n.id === data.nodeId) {
              const isLlm = n.type === 'llm-service';
              const isLoopMode = !!n.data?.inputs?.isLoopMode;
              const autoStep = !!n.data?.inputs?.autoStep;
              const loopPromptsText = n.data?.inputs?.loopPromptsText || '';
              const lines = loopPromptsText.split('\n').map((l: string) => l.trim()).filter(Boolean);
              
              let nextIdx = n.data?.inputs?.currentIndex || 0;
              if (isLlm && isLoopMode && autoStep && lines.length > 0) {
                nextIdx = (nextIdx + 1) % lines.length;
              }

              return {
                ...n,
                data: {
                  ...n.data,
                  isRunning: false,
                  inputs: {
                    ...(n.data?.inputs as any),
                    currentIndex: nextIdx
                  },
                  outputs: data.outputs,
                  outputUrl: data.outputs.image || data.outputs.video || data.outputs.audio || data.outputs.outputUrl || ''
                }
              };
            }
            return n;
          }));
        } else if (data.event === 'node_error') {
          // 节点异常：关闭该节点的闪烁并写入 outputs.errorMsg
          setNodes(nds => nds.map(n => n.id === data.nodeId ? {
            ...n,
            data: {
              ...n.data,
              isRunning: false,
              outputs: {
                ...((n.data as any)?.outputs || {}),
                errorMsg: data.message
              }
            }
          } : n));
          
          // 提取节点信息生成全局日志
          const failedNode = nodes.find(n => n.id === data.nodeId);
          const nodeName = (failedNode?.data as any)?.label || (failedNode?.data as any)?.title || '未知节点';
          const modelName = (failedNode?.data as any)?.model || (failedNode?.data as any)?.selectedModel || '未知模型';
          
          setFailureLogs(prev => [
            {
              id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toLocaleTimeString(),
              nodeId: data.nodeId,
              nodeName: nodeName,
              model: modelName,
              errorMsg: data.message
            },
            ...prev
          ]);
          console.error(`节点 [${data.nodeId}] 执行报错:`, data.message);
        } else if (data.event === 'success') {
          // 整体全链路流转完美收官！
          setIsRunning(false);
          socket.close();
          alert('🎉 恭喜！画布工作流全链路拓扑物理流转已圆满成功！成果已渲染在画布节点中。');
        } else if (data.event === 'error') {
          // 整体报错
          setIsRunning(false);
          socket.close();
          alert(`⚠️ 画布流转发生阻断错误: ${data.message}`);
        }
      } catch (e) {
        console.error(e);
      }
    };

    socket.onerror = (err) => {
      console.error('[WS Error]', err);
      setIsRunning(false);
      setProgressMsg('❌ 与网关的连接发生故障断开');
    };

    socket.onclose = () => {
      console.log('[WS] Connection closed.');
      setIsRunning(false);
    };
  };

  const handleInjectPrompt = (promptText: string) => {
    const selected = nodes.find(n => n.selected && (n.type === 'prompt-source' || n.type === 'image-service'));
    if (selected) {
      setNodes(nds => nds.map(n => {
        if (n.id === selected.id) {
          const field = n.type === 'image-service' ? 'prompt' : 'text';
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                [field]: promptText
              }
            }
          };
        }
        return n;
      }));
      alert(`🎨 已成功将分镜提示词物理灌装到选中节点: [${selected.data.label || selected.id}]`);
    } else {
      const target = nodes.find(n => n.type === 'prompt-source' || n.type === 'image-service');
      if (target) {
        setNodes(nds => nds.map(n => {
          if (n.id === target.id) {
            const field = n.type === 'image-service' ? 'prompt' : 'text';
            return {
              ...n,
              selected: true,
              data: {
                ...n.data,
                inputs: {
                  ...((n.data as any)?.inputs || {}),
                  [field]: promptText
                }
              }
            };
          }
          return { ...n, selected: false };
        }));
        alert(`🔮 [AixCanvas 智能寻路] 未选中兼容节点，已自动为您寻路到画布首个生图/剧本源节点 [${target.data.label || target.id}] 并完成分镜提示词高亮灌装！`);
      } else {
        alert('❌ 画布中没有找到任何兼容的故事剧本源或生图节点，请先添加节点！');
      }
    }
  };

  const handleInjectTTS = (ttsText: string) => {
    const selected = nodes.find(n => n.selected && n.type === 'tts-service');
    if (selected) {
      setNodes(nds => nds.map(n => {
        if (n.id === selected.id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                text: ttsText
              }
            }
          };
        }
        return n;
      }));
      alert(`🗣️ 已成功将配音旁白物理灌装到选中声音克隆节点: [${selected.data.label || selected.id}]`);
    } else {
      const target = nodes.find(n => n.type === 'tts-service');
      if (target) {
        setNodes(nds => nds.map(n => {
          if (n.id === target.id) {
            return {
              ...n,
              selected: true,
              data: {
                ...n.data,
                inputs: {
                  ...((n.data as any)?.inputs || {}),
                  text: ttsText
                }
              }
            };
          }
          return { ...n, selected: false };
        }));
        alert(`🔮 [AixCanvas 智能寻路] 未选中声音节点，已自动为您寻路到画布首个声音克隆节点 [${target.data.label || target.id}] 并完成旁白台词高亮灌装！`);
      } else {
        alert('❌ 画布中没有找到任何兼容的声音克隆节点，请先添加节点！');
      }
    }
  };

  const handleAddCustomNode = () => {
    const id = `custom-${Date.now()}`;
    const position = screenToFlowPosition({ x: 380, y: 220 });
    const safePos = findNonOverlappingPosition(nodes, position.x, position.y);
    const newNode = {
      id,
      type: 'custom-workflow',
      position: safePos,
      width: 320,
      height: 240,
      data: {
        label: '🔮 自定义工作流节点',
        source: 'local_comfyui' as const,
        comfyJson: '',
        runningHubId: '',
        workflowIdOrJson: '',
        mappings: [],
        inputs: {},
        onEdit: handleEditNode,
        isNew: true
      }
    };
    setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);

    setTimeout(() => {
      setNodes((nds) => nds.map(n => n.id === id ? {
        ...n,
        data: {
          ...n.data,
          isNew: false
        }
      } : n));
    }, 3000);

    alert('🎉 已将自定义工作流节点添加到画布！点击该节点顶部的微调魔杖，即可打开属性抽屉配置 ComfyUI JSON 或 RunningHub ID 露出自定义端口。');
  };

  const handleExportN8N = () => {
    alert('🔌 导出 n8n 功能暂未实现，正在研发中...');
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: '#070a13', 
      position: 'relative', 
      overflow: 'hidden',
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      {/* 顶部控制面板 - 极致悬浮磨砂玻璃风 */}
      <header className="glass-panel" style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        right: '16px',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 50,
        borderRadius: '16px',
        background: 'rgba(11, 15, 25, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 8px hsl(var(--accent-primary)))' }}>🌌</span>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px', background: 'linear-gradient(135deg, #ffffff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AixCanvas Studio
            </h1>
            <p style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', opacity: 0.8 }}>
              致敬极致 AI 悬浮美学与单分镜精细化生成调度器
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="glass-card" 
            onClick={() => setIsSettingsOpen(true)}
            style={{ 
              padding: '6px 14px', 
              fontSize: '12px', 
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.03)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            ⚙️ 全局设置
          </button>
          <button 
            className="glass-card" 
            onClick={handleExportN8N}
            style={{ 
              padding: '6px 14px', 
              fontSize: '12px', 
              borderRadius: '8px',
              border: '1px solid hsl(var(--accent-primary) / 0.4)',
              background: 'hsl(var(--accent-primary) / 0.08)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'hsl(var(--accent-primary) / 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'hsl(var(--accent-primary) / 0.08)'}
          >
            🔌 导出 n8n
          </button>

        </div>
      </header>

      {/* 主画布区域 */}
      <main 
        onClick={() => {
          setIsModelPickerOpen(false);
          setHoveredCategory(null);
        }}
        onDoubleClick={onPaneDoubleClick}
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          zIndex: 10 
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onConnectStart={(event, params) => {
            if (params.nodeId) {
              setConnectionStart({
                nodeId: params.nodeId,
                handleId: params.handleId,
                handleType: params.handleType || 'source'
              });
            }
          }}
          onConnectEnd={(event) => {
            if (!connectionStart) return;
            let clientX = (event as any).clientX;
            let clientY = (event as any).clientY;
            if (clientX === undefined) {
              const touch = (event as any).changedTouches?.[0] || (event as any).touches?.[0];
              if (touch) {
                clientX = touch.clientX;
                clientY = touch.clientY;
              }
            }
            setTimeout(() => {
              if (clientX !== undefined && clientY !== undefined) {
                const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
                setConnectMenuPos({ x: clientX, y: clientY });
                setConnectFlowPos(flowPos);
                setShowConnectMenu(true);
                setShowAllOptions(false); // 重置为智能推荐
              }
            }, 30);
          }}
          edgeTypes={edgeTypes}
          nodeTypes={nodeTypes}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={() => {
            setActiveFloatingPopup(null);
            setIsModelPickerOpen(false);
            setHoveredCategory(null);
            setNodeContextMenu(null);
            setPaneContextMenuPos(null);
            setShowConnectMenu(false);
          }}
          fitView
          fitViewOptions={{ maxZoom: 0.95, minZoom: 0.8 }}
        >
          <Background color="rgba(255,255,255,0.04)" variant={BackgroundVariant.Lines} gap={24} />
          <MiniMap 
            style={{ 
              background: 'rgba(11, 15, 25, 0.85)', 
              border: '1px solid rgba(255,255,255,0.08)', 
              borderRadius: '16px',
              margin: 0,
              padding: '4px',
              width: '160px',
              height: '110px',
              position: 'absolute',
              left: '85px',
              bottom: '72px',
              opacity: showMiniMap ? 1 : 0,
              visibility: showMiniMap ? 'visible' : 'hidden',
              pointerEvents: showMiniMap ? 'all' : 'none',
              zIndex: 35,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)',
            }}
            nodeColor={() => '#a855f7'}
            nodeStrokeColor="#ffffff"
            nodeStrokeWidth={2.5}
            maskColor="rgba(0, 0, 0, 0.6)"
            position="bottom-left"
          />
        </ReactFlow>
      </main>

      {/* 高精智能图像工作坊 */}
      {imageEditorOpen && imageEditorTarget && (
        <ImageEditorModal
          isOpen={imageEditorOpen}
          imageUrl={imageEditorTarget.imageUrl}
          onClose={() => {
            setImageEditorOpen(false);
            setImageEditorTarget(null);
          }}
          onSave={handleSaveImageEdit}
          initialTab={imageEditorActiveTab}
        />
      )}

      {/* 缩放与小地图联动胶囊舱 */}
      <div 
        className="glass-panel nodrag"
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          height: '48px',
          borderRadius: '24px',
          background: 'rgba(11, 15, 25, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '12px',
          zIndex: 40
        }}
      >
        {/* 小地图图标切换按钮 */}
        {/* 小地图图标切换按钮 */}
        <button
          onClick={() => setShowMiniMap(!showMiniMap)}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: showMiniMap ? 'hsl(var(--accent-primary) / 0.15)' : 'rgba(255,255,255,0.03)',
            color: showMiniMap ? '#ffffff' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            border: showMiniMap ? '1px solid hsl(var(--accent-primary) / 0.4)' : '1px solid transparent',
            flexShrink: 0
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title="切换小地图"
        >
          <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="16" width="16">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
            <line x1="9" y1="3" x2="9" y2="18"></line>
            <line x1="15" y1="6" x2="15" y2="21"></line>
          </svg>
        </button>

        {/* 撤销删除按钮 */}
        <button
          onClick={() => {
            setDeletedElementsStack((prev) => {
              if (prev.length === 0) return prev;
              const last = prev[prev.length - 1];
              setNodes((nds) => {
                const existingIds = new Set(nds.map((n) => n.id));
                const restoredNodes = last.nodes.filter((n) => !existingIds.has(n.id)).map((n) => ({ ...n, selected: true }));
                return nds.map((n) => ({ ...n, selected: false })).concat(restoredNodes);
              });
              setEdges((eds) => {
                const existingIds = new Set(eds.map((eg) => eg.id));
                const restoredEdges = last.edges.filter((eg) => !existingIds.has(eg.id));
                return eds.concat(restoredEdges);
              });
              return prev.slice(0, -1);
            });
            alert('↩️ 已成功撤销并恢复上次删除的节点与连线！');
          }}
          disabled={deletedElementsStack.length === 0}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            color: deletedElementsStack.length > 0 ? '#ffffff' : 'rgba(255,255,255,0.25)',
            cursor: deletedElementsStack.length > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            border: '1px solid transparent',
            flexShrink: 0
          }}
          onMouseEnter={(e) => { if (deletedElementsStack.length > 0) e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          title="撤销删除 (Ctrl+Z)"
        >
          ↩️
        </button>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* 减号按钮 */}
        <button
          onClick={() => zoomTo(Math.max(0.1, zoom - 0.1))}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: 'none',
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            fontSize: '14px',
            fontWeight: 'bold',
            flexShrink: 0
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          title="缩小"
        >
          －
        </button>

        {/* 滑动条 */}
        <input 
          type="range"
          min="0.1"
          max="2"
          step="0.05"
          value={zoom || 1}
          onChange={(e) => zoomTo(parseFloat(e.target.value))}
          style={{
            width: '80px',
            accentColor: 'hsl(var(--accent-primary))',
            cursor: 'pointer',
            height: '4px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '2px',
            border: 'none',
            outline: 'none',
            flexShrink: 0
          }}
        />

        {/* 加号按钮 */}
        <button
          onClick={() => zoomTo(Math.min(2, zoom + 0.1))}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: 'none',
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            fontSize: '14px',
            fontWeight: 'bold',
            flexShrink: 0
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          title="放大"
        >
          ＋
        </button>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Zoom 百分比 */}
        <span
          onDoubleClick={() => zoomTo(1)}
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.8)',
            width: '38px',
            textAlign: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            flexShrink: 0
          }}
          title="双击重置为 100%"
        >
          {Math.round((zoom || 1) * 100)}%
        </span>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* 帮助与快捷键指南按钮 */}
        <button
          onClick={() => setIsHelpOpen(true)}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            flexShrink: 0,
            boxShadow: '0 0 6px rgba(255, 255, 255, 0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            e.currentTarget.style.boxShadow = '0 0 6px rgba(255, 255, 255, 0.05)';
          }}
          title="画布使用教程 & 快捷键指南"
        >
          <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="13" width="13">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </button>
      </div>

      {/* 左侧垂直窄悬浮导航栏 (AixStyle Sidebar) */}
      <aside 
        className="glass-panel" 
        style={{
          position: 'absolute',
          top: '96px',
          left: '16px',
          bottom: '80px',
          width: '78px',
          zIndex: 40,
          borderRadius: '24px',
          background: 'rgba(11, 15, 25, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 0',
          gap: '16px'
        }}
      >
        {/* 加号发光大按钮 */}
        <button
          onClick={() => setActiveFloatingPopup(activeFloatingPopup === 'add' ? null : 'add')}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            border: 'none',
            background: 'linear-gradient(135deg, hsl(var(--accent-primary)), hsl(var(--accent-secondary)))',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px hsl(var(--accent-primary) / 0.4)',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            gap: '2px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 6px 20px hsl(var(--accent-primary) / 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 15px hsl(var(--accent-primary) / 0.4)';
          }}
          title="添加节点"
        >
          <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="20" width="20">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.9 }}>添加</span>
        </button>

        {[
          { 
            id: 'templates', 
            label: '工作流', 
            icon: (
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="20" width="20">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            )
          },
          { 
            id: 'assets', 
            label: '资产', 
            icon: (
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="20" width="20">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            )
          },
          { 
            id: 'history', 
            label: '历史', 
            icon: (
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="20" width="20">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            )
          },
          { 
            id: 'logs', 
            label: '日记', 
            icon: (
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="20" width="20">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            )
          }
        ].map((tab) => {
          const active = activeFloatingPopup === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFloatingPopup(active ? null : (tab.id as any))}
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '16px',
                border: active ? '1px solid hsl(var(--accent-primary) / 0.4)' : '1px solid rgba(255,255,255,0.03)',
                background: active ? 'hsl(var(--accent-primary) / 0.15)' : 'rgba(255,255,255,0.02)',
                color: active ? '#ffffff' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                gap: '4px',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = active ? 'hsl(var(--accent-primary) / 0.2)' : 'rgba(255,255,255,0.07)';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = active ? 'hsl(var(--accent-primary) / 0.15)' : 'rgba(255,255,255,0.02)';
                e.currentTarget.style.color = active ? '#ffffff' : 'rgba(255,255,255,0.5)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              title={tab.label}
            >
              {tab.icon}
              <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.05em' }}>{tab.label}</span>
            </button>
          );
        })}
      </aside>

      {/* 悬浮二级抽屉面板 (Smart Popup Panel) */}
      {activeFloatingPopup && ['add', 'logs'].includes(activeFloatingPopup) && (
        <aside 
          className="glass-panel" 
          style={{
            position: 'absolute',
            top: '96px',
            left: '96px',
            bottom: '16px',
            width: '340px',
            zIndex: 40,
            borderRadius: '24px',
            background: 'rgba(11, 15, 25, 0.88)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            animation: 'slideInPopup 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
              {activeFloatingPopup === 'add' && '➕ 添加节点'}
              {activeFloatingPopup === 'logs' && '📋 运行日记'}
            </h3>
            <button 
              onClick={() => setActiveFloatingPopup(null)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px'
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* 1. Add Tab */}
            {activeFloatingPopup === 'add' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* 大字体节点分类卡片 */}
                {[
                  { type: 'prompt-source', emoji: '📝', label: '文本', desc: '剧本故事原始文字输入源，连接 LLM 分镜专家节点', color: '#a855f7', grad: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.03))' },
                  { type: 'image-service', emoji: '🎨', label: '图像', desc: 'Flux / SD / MiniMax 文生图，支持角色面部参考', color: '#10b981', grad: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.03))' },
                  { type: 'video-fusion', emoji: '🎥', label: '视频生成', desc: 'Vidu / Wan / FramePack 视频合成，支持音视频融合', color: '#f59e0b', grad: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.03))' },
                  { type: 'tts-service',  emoji: '🔊', label: '音频', desc: '声音克隆与旁白配音，极速锁定人物音色', color: '#0ea5e9', grad: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(14,165,233,0.03))' },
                  { type: 'llm-service',   emoji: '🎬', label: '剧本', desc: '大模型分镜专家：将剧本智能拆解为镜头 Prompt', color: '#ec4899', grad: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(236,72,153,0.03))' },
                  { type: 'loop-node',     emoji: '🔄', label: '循环迭代', desc: '批量循环发生器：将文本/分镜列表并发或顺序循环分发，驱动批量生图/视频/音频', color: '#f43f5e', grad: 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(244,63,94,0.03))' },
                  { type: 'upload-node',   emoji: '📦', label: '本地上传', desc: '本地多媒体资源上传节点，供画布各处调用', color: '#a855f7', grad: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.03))' },
                  { type: 'grid-splitter', emoji: '✂️', label: '宫格切分', desc: '智能九宫格切分工具：智能拆分生成图像与预置素材', color: '#a855f7', grad: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.03))' }
                ].map((item) => (
                  <div
                    key={item.type}
                    onClick={() => {
                      if (item.type === 'upload-node') {
                        fileInputRef.current?.click();
                      } else {
                        handleAddAgentNode(item.type as any);
                      }
                      setActiveFloatingPopup(null);
                    }}
                    className="glass-card"
                    style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      border: `1px solid ${item.color}30`,
                      background: item.grad,
                      transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = item.color;
                      e.currentTarget.style.transform = 'translateX(4px)';
                      e.currentTarget.style.boxShadow = `0 4px 20px ${item.color}25`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${item.color}30`;
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: '28px', flexShrink: 0 }}>{item.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '16px', color: '#fff', letterSpacing: '0.3px' }}>{item.label}</div>
                      <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)', marginTop: '3px', lineHeight: '1.4' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeFloatingPopup === 'logs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em' }}>
                    📋 运行日记流水记录
                  </div>
                  {failureLogs.length > 0 && (
                    <button
                      onClick={() => setFailureLogs([])}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '9px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; }}
                    >
                      🗑️ 清空
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: '440px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}
                >
                  {failureLogs.length === 0 ? (
                    <div
                      style={{
                        padding: '48px 0',
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.25)',
                        fontSize: '11px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span style={{ fontSize: '28px' }}>🛡️</span>
                      <span>暂无任何运行日记，工作流运转健康</span>
                    </div>
                  ) : (
                    failureLogs.map((log) => {
                      const isSuccess = log.status === 'success';
                      const accentColor   = isSuccess ? '#10b981' : '#ef4444';
                      const accentColorBg = isSuccess ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.05)';
                      const accentBorder  = isSuccess ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.15)';
                      const gradient      = isSuccess
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(10,20,10,0.4) 100%)'
                        : 'linear-gradient(135deg, rgba(239,68,68,0.05) 0%, rgba(20,10,10,0.4) 100%)';
                      const codeColor     = isSuccess ? '#6ee7b7' : '#ffb3b3';
                      return (
                        <div
                          key={log.id}
                          style={{
                            padding: '12px',
                            borderRadius: '10px',
                            border: `1px solid ${accentBorder}`,
                            background: gradient,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            position: 'relative',
                            transition: 'transform 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: accentColor, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {isSuccess ? '🟢 运行成功' : '⚠️ 运行异常'} · {log.nodeName}
                            </span>
                            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>{log.timestamp}</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '9px', color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '6px' }}>
                            <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>节点 ID:</span> <code style={{ fontFamily: 'monospace', color: codeColor }}>{log.nodeId}</code></div>
                            <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>模型:</span> <span style={{ color: codeColor }}>{log.model}</span></div>
                          </div>

                          <div style={{
                            fontSize: '10px',
                            color: isSuccess ? '#6ee7b7' : '#fca5a5',
                            lineHeight: '1.4',
                            background: accentColorBg,
                            border: `1px solid ${accentBorder}`,
                            padding: '8px',
                            borderRadius: '6px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all'
                          }}>
                            {log.errorMsg}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`[${log.timestamp}] ${isSuccess ? 'SUCCESS' : 'ERROR'}: Node: ${log.nodeName} (${log.nodeId}), Model: ${log.model}\n${log.errorMsg}`);
                                alert('📋 日记条目已复制到剪贴板！');
                              }}
                              style={{
                                padding: '3px 8px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '4px',
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                            >
                              📄 复制
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* 🔮 Toonflow Center Core Premium Large Modal (85vw * 80vh) */}
      {activeFloatingPopup && ['templates', 'assets', 'history'].includes(activeFloatingPopup) && (() => {
        
        // 1. 添加工作流节点到画布或装载到现有节点
        const spawnCustomWorkflowTemplateNode = (template: WorkflowTemplate) => {
          const capability = template.capability || 'image';
          const isRH = template.source === 'runninghub';
          const labelPrefix = isRH ? '[RH] ' : '[CF] ';

          const defaultInputs: Record<string, any> = {
            prompt: '',
            activeTab: 'aix',
            runningHubTemplateId: template.source === 'runninghub' ? (template.workflowRef || '') : '',
            runningHubWorkflowName: template.name,
            customTemplate: template,
            aspectRatio: '1:1',
            steps: 20,
            cfg: 7,
            refImages: []
          };

          // 初始化默认暴露值
          (template.paramsSchema || []).forEach(p => {
            if (p.exposed && p.defaultValue !== undefined) {
              defaultInputs[`${p.nodeId}_${p.fieldName}`] = p.defaultValue;
            }
          });

          if (modalNodeTarget) {
            // 装载到现有节点内部
            setNodes(nds => nds.map(n => {
              if (n.id === modalNodeTarget) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    label: `${labelPrefix}${template.name}`,
                    inputs: {
                      ...((n.data as any)?.inputs || {}),
                      ...defaultInputs
                    }
                  }
                };
              }
              return n;
            }));
            closeLargeModal();
            alert(`🎉 成功将自定义工作流【${template.name}】装载到当前节点！`);
            return;
          }

          // 根据能力特征映射为原生生图、视频或声音节点
          const type = capability === 'video' ? 'video-fusion' : (capability === 'audio' ? 'tts-service' : 'image-service');
          const id = `${type}-${Date.now()}`;
          
          let viewportCenter = { x: 300, y: 300 };
          try {
            if (typeof screenToFlowPosition === 'function') {
              viewportCenter = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
            }
          } catch (err) {}
          const safePos = findNonOverlappingPosition(nodes, viewportCenter.x, viewportCenter.y);

          const newNode = {
            id,
            type,
            position: safePos,
            width: 180,
            height: 180,
            data: {
              label: `${labelPrefix}${template.name}`,
              progress: 0,
              inputs: defaultInputs,
              outputs: {}
            }
          };

          setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);
          
          setTimeout(() => {
            setCenter(safePos.x, safePos.y, { zoom: 0.95, duration: 600 });
          }, 50);

          closeLargeModal();
          alert(`🎉 成功将自定义工作流【${template.name}】添加到画布！`);
        };

  const spawnWorkflowNode = (wfId: string, wfName: string, type: 'image' | 'video') => {
          if (modalNodeTarget) {
            // 添加到现有节点内部
            setNodes(nds => nds.map(n => {
              if (n.id === modalNodeTarget) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    inputs: {
                      ...((n.data as any)?.inputs || {}),
                      activeTab: 'aix',
                      runningHubTemplateId: wfId,
                      runningHubWorkflowName: wfName
                    }
                  }
                };
              }
              return n;
            }));
            closeLargeModal();
            alert(`🎉 成功将云端工作流【${wfName}】添加到当前节点！`);
            return;
          }

          const id = `${type}-service-${Date.now()}`;
          let viewportCenter = { x: 300, y: 300 };
          try {
            if (typeof screenToFlowPosition === 'function') {
              viewportCenter = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
            }
          } catch (err) {}
          const safePos = findNonOverlappingPosition(nodes, viewportCenter.x, viewportCenter.y);
          
          const newNode = {
            id,
            type: type === 'image' ? 'image-service' : 'video-fusion',
            position: safePos,
            width: 300,
            height: 380,
            data: {
              label: `🎬 [工作流] ${wfName}`,
              progress: 0,
              inputs: {
                prompt: `已添加: ${wfName}`,
                model: type === 'image' ? 'flux-schnell' : 'wan-2.1',
                workflowPreset: wfId, 
              },
              outputs: {}
            }
          };
          setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);
          
          setTimeout(() => {
            setCenter(safePos.x, safePos.y, { zoom: 0.95, duration: 600 });
          }, 50);

          closeLargeModal();
          alert(`🎉 成功将【${wfName}】工作流节点添加到画布！可选中该节点在高级设置中直接运转。`);
        };

        // 2. 自定义 ComfyUI JSON 工作流派生核心联动
        const handleCustomWorkflowJsonUpload = (content: string, filename: string) => {
          try {
            JSON.parse(content); 
            const id = `custom-workflow-${Date.now()}`;
            let viewportCenter = { x: 300, y: 300 };
            try {
              if (typeof screenToFlowPosition === 'function') {
                viewportCenter = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
              }
            } catch (err) {}
            const safePos = findNonOverlappingPosition(nodes, viewportCenter.x, viewportCenter.y);
            
            const newNode = {
              id,
              type: 'custom-workflow',
              position: safePos,
              width: 320,
              height: 280,
              data: {
                label: `⚙️ 自定义: ${filename.replace('.json', '')}`,
                progress: 0,
                inputs: {
                  jsonContent: content,
                },
                outputs: {}
              }
            };
            setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);
            
            setTimeout(() => {
              setCenter(safePos.x, safePos.y, { zoom: 0.95, duration: 600 });
            }, 50);

            closeLargeModal();
            alert(`🎉 恭喜！ComfyUI 工作流 [${filename}] 解析成功！已在画布中派生了自定义工作流节点！`);
          } catch (e) {
            alert('⚠️ 解析失败！请输入合法的 ComfyUI JSON 工作流文件。');
          }
        };

        // 3. 预设素材库一键添加到画布与防重叠派生 Upload 节点
        const handleInjectLibraryAsset = (url: string, name: string) => {
          // 智能提取资产的多媒体类型
          let fileType: 'image' | 'video' | 'audio' = 'image';
          const lowerUrl = url.toLowerCase();
          const lowerName = name.toLowerCase();
          if (lowerUrl.endsWith('.mp3') || lowerUrl.endsWith('.wav') || lowerName.includes('🎙️') || lowerName.includes('音频') || lowerName.includes('mp3') || lowerName.includes('wav')) {
            fileType = 'audio';
          } else if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm') || lowerName.includes('🎬') || lowerName.includes('视频') || lowerName.includes('mp4') || lowerName.includes('webm')) {
            fileType = 'video';
          }

          if (modalNodeTarget) {
            setNodes(nds => nds.map(n => {
              if (n.id === modalNodeTarget) {
                const updates: any = {};
                if (n.type === 'image-service') {
                  const prevRefImages = n.data.inputs?.refImages || (n.data.inputs?.faceRef ? [n.data.inputs.faceRef] : []);
                  updates.refImages = [...prevRefImages, url];
                  updates.faceRef = url;
                } else if (n.type === 'video-fusion') {
                  updates.refImage = url;
                  updates.image = url;
                } else if (n.type === 'tts-service') {
                  updates.refAudio = url;
                }
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
            }));
            
            spawnLinkedNode(modalNodeTarget, 'upload-node', 'left', {
              fileType,
              fileUrl: url,
              fileName: name.replace(/[🖼️🎙️🎬📦]/g, '').trim()
            });

            closeLargeModal();
            const typeLabel = fileType === 'video' ? '🎬 视频' : (fileType === 'audio' ? '🎵 音频' : '🖼️ 图像');
            alert(`🎉 成功将素材【${name}】添加到当前节点，并在其左侧派生了直连 [${typeLabel} 资产输入] 节点！`);
            return;
          }

          const id = `upload-node-${Date.now()}`;
          let viewportCenter = { x: 300, y: 300 };
          try {
            if (typeof screenToFlowPosition === 'function') {
              viewportCenter = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
            }
          } catch (err) {}
          const safePos = findNonOverlappingPosition(nodes, viewportCenter.x, viewportCenter.y);
          const typeLabel = fileType === 'video' ? '🎬 视频' : (fileType === 'audio' ? '🎵 音频' : '🖼️ 图像');
          const ext = fileType === 'video' ? 'mp4' : (fileType === 'audio' ? 'mp3' : 'jpg');
          const cleanName = name.replace(/[🖼️🎙️🎬📦]/g, '').trim();

          const newNode = {
            id,
            type: 'upload-node',
            position: safePos,
            width: 300,
            height: 260,
            data: {
              label: `${typeLabel} 资产输入`,
              progress: 100,
              inputs: {
                fileType,
                fileUrl: url,
                fileName: `${cleanName}.${ext}`
              },
              outputs: {
                output: url,
                fileType
              }
            }
          };
          setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);
          
          setTimeout(() => {
            setCenter(safePos.x, safePos.y, { zoom: 0.95, duration: 600 });
          }, 50);

          closeLargeModal();
          alert(`🎉 成功将预设素材 [${name}] 添加到画布！`);
        };

        // 4. 一键克隆声线派生 TTS 音频配音节点
        const handleCloneVirtualVoice = (voiceName: string, voiceUrl: string) => {
          const id = `tts-service-${Date.now()}`;
          let viewportCenter = { x: 300, y: 300 };
          try {
            if (typeof screenToFlowPosition === 'function') {
              viewportCenter = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
            }
          } catch (err) {}
          const safePos = findNonOverlappingPosition(nodes, viewportCenter.x, viewportCenter.y);
          const newNode = {
            id,
            type: 'tts-service',
            position: safePos,
            width: 280,
            height: 220,
            data: {
              label: `🎙️ 声音克隆: ${voiceName}`,
              progress: 100,
              inputs: {
                text: '智能声音克隆配音中...',
                voicePreset: voiceName,
                voiceUrl: voiceUrl
              },
              outputs: {
                audio: voiceUrl,
                output: voiceUrl
              }
            }
          };
          setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);
          
          setTimeout(() => {
            setCenter(safePos.x, safePos.y, { zoom: 0.95, duration: 600 });
          }, 50);

          closeLargeModal();
          alert(`🎉 【${voiceName}】声线已一键物理克隆！并在画布中央生成了智能配音节点！`);
        };

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(5, 7, 12, 0.65)',
              backdropFilter: 'blur(12px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fadeInLargeModal 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={closeLargeModal}
          >
            <style>{`
              @keyframes fadeInLargeModal {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes fadeInOverlay {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes scaleUpLargeModal {
                from { transform: scale(0.96); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
              .large-modal-container {
                animation: scaleUpLargeModal 0.3s cubic-bezier(0.16, 1, 0.3, 1);
              }
              .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
                height: 6px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.08);
                border-radius: 3px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.15);
              }
            `}</style>

            <div
              className="large-modal-container"
              style={{
                width: '85vw',
                height: '80vh',
                background: 'rgba(11, 15, 26, 0.96)',
                backdropFilter: 'blur(32px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '28px',
                display: 'flex',
                overflow: 'hidden',
                boxShadow: '0 25px 70px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(255,255,255,0.05)',
                zIndex: 10000,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 1. Left Navigation Sidebar (Width: 240px) */}
              <div
                style={{
                  width: '240px',
                  background: 'rgba(0, 0, 0, 0.22)',
                  borderRight: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  padding: '24px 16px',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                  {/* Brand Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '8px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 12px rgba(168, 85, 247, 0.5)',
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>🔮</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: '#fff', letterSpacing: '0.5px' }}>Toonflow Core</div>
                      <div style={{ fontSize: '9px', color: 'rgba(168, 85, 247, 0.95)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginTop: '1px' }}>
                        Premium Suite
                      </div>
                    </div>
                  </div>

                  {/* Primary Tabs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { id: 'templates', label: '🔮 工作流中心', desc: '图像与视频多镜头引擎' },
                      { id: 'assets', label: '📦 资产管理器', desc: '预设素材与声音克隆' },
                      { id: 'history', label: '🕐 成果历史记录', desc: 'AI 成果轨迹' },
                    ].map((tab) => {
                      const active = activeFloatingPopup === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveFloatingPopup(tab.id as any)}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: 'none',
                            background: active
                              ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(236, 72, 153, 0.15) 100%)'
                              : 'transparent',
                            color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                            borderLeft: active ? '3px solid #a855f7' : '3px solid transparent',
                            paddingLeft: active ? '11px' : '14px',
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                              e.currentTarget.style.color = '#fff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.55)';
                            }
                          }}
                        >
                          <span style={{ fontSize: '13px', fontWeight: 700 }}>{tab.label}</span>
                          <span style={{ fontSize: '9px', opacity: 0.6, fontWeight: 500 }}>{tab.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sidebar Footer */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '9px',
                      color: 'rgba(255,255,255,0.4)',
                      lineHeight: '1.4',
                    }}
                  >
                    🟢 联调运行引擎已就绪<br />
                    ⚡ COMFIER CORE v3.5<br />
                    🚀 视口装载正常
                  </div>
                  <button
                    onClick={closeLargeModal}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#ef4444',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                  >
                    🚪 关闭控制台大窗
                  </button>
                </div>
              </div>

              
              {/* 2. Right Main Working Space (Flex: 1) */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  overflow: 'hidden',
                  background: 'rgba(10, 12, 18, 0.3)',
                }}
              >
                {/* Header Title Row */}
                <div
                  style={{
                    padding: '24px 30px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {activeFloatingPopup === 'templates' && '🔮 Toonflow 工作流中心'}
                      {activeFloatingPopup === 'assets' && '📦 Toonflow 豪华资产中心'}
                      {activeFloatingPopup === 'history' && '🕐 Toonflow 成果历史轨迹'}
                    </h2>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>
                      {activeFloatingPopup === 'templates' && '加载图像与视频工作流模板卡片为节点服务，或拖入 ComfyUI JSON 智能派生节点。'}
                      {activeFloatingPopup === 'assets' && '筛选与管理高精预置参考图、Unsplash 素材大图、克隆虚拟人旁白色线。'}
                      {activeFloatingPopup === 'history' && '追溯与复用您以往所生成的图像、视频以及音频历史记录成果。'}
                    </p>
                  </div>
                  <button
                    onClick={closeLargeModal}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.6)',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Sub-tabs Selection Segment */}
                <div style={{ padding: '16px 30px 0 30px' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      background: 'rgba(0,0,0,0.3)',
                      padding: '3px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {activeFloatingPopup === 'templates' &&
                      [
                        { id: 'image', label: '🎨 图像工作流' },
                        { id: 'video', label: '📹 视频工作流' },
                        { id: 'audio', label: '🗣️ 音频工作流' },
                        { id: 'local_comfyui', label: '💻 本地 ComfyUI' },
                        { id: 'runninghub', label: '⚡ RunningHub工作流' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTemplateLargeTab(t.id as any)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: templateLargeTab === t.id ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            color: templateLargeTab === t.id ? '#ffffff' : 'rgba(255,255,255,0.4)',
                            fontSize: '12px',
                            fontWeight: templateLargeTab === t.id ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}

                    {activeFloatingPopup === 'assets' &&
                      [
                        { id: 'mine', label: '📦 我的资产' },
                        { id: 'library', label: '🖼️ 预设素材库 (8张场景大图)' },
                        { id: 'virtual', label: '🎙️ 虚拟人库 (形象与试听克隆)' },
                        { id: 'other', label: ' LORA 其他预设' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setAssetLargeTab(t.id as any)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: assetLargeTab === t.id ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            color: assetLargeTab === t.id ? '#ffffff' : 'rgba(255,255,255,0.4)',
                            fontSize: '12px',
                            fontWeight: assetLargeTab === t.id ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}

                    {activeFloatingPopup === 'history' &&
                      [
                        { id: 'image', label: '🖼️ AI 生图历史' },
                        { id: 'video', label: '📹 视频合成历史' },
                        { id: 'audio', label: '🎵 音频旁白历史' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setHistorySubTab(t.id as any)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: historySubTab === t.id ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            color: historySubTab === t.id ? '#ffffff' : 'rgba(255,255,255,0.4)',
                            fontSize: '12px',
                            fontWeight: historySubTab === t.id ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                  </div>
                </div>
                
                {/* Main Content Area Container */}
                <div
                  className="custom-scrollbar"
                  style={{
                    flex: 1,
                    padding: '24px 30px 40px 30px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                  }}
                >
                  {/* 1. Templates Main Tab */}
                  
                  {activeFloatingPopup === 'templates' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto', paddingRight: '6px' }} className="custom-scrollbar">
                      
                      {/* Image Workflow Templates Tab */}
                      {templateLargeTab === 'image' && (
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          {/* 引导跳转卡片 (前往 AI应用（工作流）) */}
                          <div
                            onClick={() => {
                              setSettingsActiveTab('workflow');
                              setIsSettingsOpen(true);
                            }}
                            style={{
                              padding: '16px 24px',
                              border: '1px solid rgba(168, 85, 247, 0.25)',
                              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.03) 100%)',
                              borderRadius: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              gap: '16px',
                              boxShadow: '0 8px 32px rgba(168, 85, 247, 0.05)',
                              transition: 'all 0.3s ease',
                              marginBottom: '20px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                              e.currentTarget.style.boxShadow = '0 12px 40px rgba(168, 85, 247, 0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.25)';
                              e.currentTarget.style.boxShadow = '0 8px 32px rgba(168, 85, 247, 0.05)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                              <span style={{ fontSize: '28px', filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))' }}>🔮</span>
                              <div style={{ textAlign: 'left' }}>
                                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#fff', margin: 0 }}>
                                  前往「AI应用（工作流）」配置中心
                                </h3>
                                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', margin: 0, lineHeight: '1.4' }}>
                                  在此输入 RunningHub 的 App ID，智能拉取云端工作流的物理字段，支持别名修改与参数勾选，保存后立即在此调用！
                                </p>
                              </div>
                            </div>
                            <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: 'bold', whiteSpace: 'nowrap' }}>立即前往 →</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                          {PRESET_WORKFLOWS
                            .filter(w => w.capability === 'image' && w.source === 'runninghub')
                            .map(w => ({
                              id: w.id,
                              title: w.name,
                              desc: w.description,
                              cover: w.cover || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
                              tag: w.tag || '✨ 推荐',
                              color: w.color || '#a855f7',
                              boundId: w.id
                            }))
                            .filter(t => !t.boundId || activeWorkflowIds.includes(t.boundId))
                            .map((tmpl) => (
                            <div
                              key={tmpl.id}
                              style={{
                                borderRadius: '14px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(0,0,0,0.2)',
                                padding: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                transition: 'all 0.25s',
                              }}
                            >
                              <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: '10px' }}>
                                <img src={tmpl.cover} alt={tmpl.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '6px',
                                    left: '6px',
                                    background: tmpl.color,
                                    color: '#fff',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {tmpl.tag}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'space-between' }}>
                                <div>
                                  <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={tmpl.title}>{tmpl.title}</h4>
                                  <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '25px' }}>{tmpl.desc}</p>
                                </div>
                                <button
                                  onClick={() => spawnWorkflowNode(tmpl.id, tmpl.title, 'image')}
                                  style={{
                                    marginTop: '6px',
                                    padding: '6px',
                                    borderRadius: '6px',
                                    background: 'rgba(168, 85, 247, 0.2)',
                                    border: '1px solid rgba(168, 85, 247, 0.4)',
                                    color: '#fff',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.45)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)')}
                                >
                                  ➕ 添加到画布
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* 动态追加用户自定义的本地 ComfyUI / RunningHub 图像模板 */}
                        {savedTemplates.filter(t => !t.capability || t.capability === 'image').length > 0 && (
                          <div style={{ marginTop: '30px' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'hsl(var(--accent-secondary))', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>🔌</span> 您的自定义/本地 ComfyUI 图像工作流 ({savedTemplates.filter(t => !t.capability || t.capability === 'image').length})
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                              {savedTemplates.filter(t => !t.capability || t.capability === 'image').map((tmpl) => (
                                <div
                                  key={tmpl.id}
                                  style={{
                                    borderRadius: '14px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    background: 'rgba(0,0,0,0.2)',
                                    padding: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                    transition: 'all 0.25s',
                                  }}
                                >
                                  <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: '10px', background: 'rgba(0,0,0,0.4)' }}>
                                    <img 
                                      src={tmpl.previewImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80'} 
                                      alt={tmpl.name} 
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                    <span
                                      style={{
                                        position: 'absolute',
                                        top: '6px',
                                        left: '6px',
                                        background: tmpl.source === 'local_comfyui' ? 'rgba(14, 165, 233, 0.85)' : 'rgba(168, 85, 247, 0.85)',
                                        color: '#fff',
                                        padding: '2px 6px',
                                        borderRadius: '6px',
                                        fontSize: '9px',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {tmpl.source === 'local_comfyui' ? '🔌 本地 Comfy' : '⚡ RunningHub'}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'space-between' }}>
                                    <div>
                                      <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={tmpl.name}>{tmpl.name}</h4>
                                      <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '25px' }}>
                                        {tmpl.description || '自定义解析的本地工作流模板...'}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => spawnCustomWorkflowTemplateNode(tmpl)}
                                      style={{
                                        marginTop: '6px',
                                        padding: '6px',
                                        borderRadius: '6px',
                                        background: 'rgba(14, 165, 233, 0.2)',
                                        border: '1px solid rgba(14, 165, 233, 0.4)',
                                        color: '#fff',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(14, 165, 233, 0.45)')}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(14, 165, 233, 0.2)')}
                                    >
                                      {modalNodeTarget ? '➕ 装载到当前节点' : '➕ 添加到画布'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                      {/* Video Workflow Templates Tab */}
                      {templateLargeTab === 'video' && (
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          {/* 引导跳转卡片 (前往 AI应用（工作流）) */}
                          <div
                            onClick={() => {
                              setSettingsActiveTab('workflow');
                              setIsSettingsOpen(true);
                            }}
                            style={{
                              padding: '16px 24px',
                              border: '1px solid rgba(168, 85, 247, 0.25)',
                              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.03) 100%)',
                              borderRadius: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              gap: '16px',
                              boxShadow: '0 8px 32px rgba(168, 85, 247, 0.05)',
                              transition: 'all 0.3s ease',
                              marginBottom: '20px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                              e.currentTarget.style.boxShadow = '0 12px 40px rgba(168, 85, 247, 0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.25)';
                              e.currentTarget.style.boxShadow = '0 8px 32px rgba(168, 85, 247, 0.05)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                              <span style={{ fontSize: '28px', filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))' }}>🔮</span>
                              <div style={{ textAlign: 'left' }}>
                                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#fff', margin: 0 }}>
                                  前往「AI应用（工作流）」配置中心
                                </h3>
                                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', margin: 0, lineHeight: '1.4' }}>
                                  在此输入 RunningHub 的 App ID，智能拉取云端工作流的物理字段，支持别名修改与参数勾选，保存后立即在此调用！
                                </p>
                              </div>
                            </div>
                            <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: 'bold', whiteSpace: 'nowrap' }}>立即前往 →</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                          {PRESET_WORKFLOWS
                            .filter(w => w.capability === 'video' && w.source === 'runninghub')
                            .map(w => ({
                              id: w.id,
                              title: w.name,
                              desc: w.description,
                              cover: w.cover || 'https://images.unsplash.com/photo-1536240478700-b869ad10e128?w=400&q=80',
                              tag: w.tag || '🎬 电商',
                              color: w.color || '#a855f7'
                            }))
                            .map((tmpl) => (
                            <div
                              key={tmpl.id}
                              style={{
                                borderRadius: '14px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(0,0,0,0.2)',
                                padding: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                transition: 'all 0.25s',
                              }}
                            >
                              <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: '10px' }}>
                                <img src={tmpl.cover} alt={tmpl.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '6px',
                                    left: '6px',
                                    background: tmpl.color,
                                    color: '#fff',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {tmpl.tag}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'space-between' }}>
                                <div>
                                  <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={tmpl.title}>{tmpl.title}</h4>
                                  <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '25px' }}>{tmpl.desc}</p>
                                </div>
                                <button
                                  onClick={() => spawnWorkflowNode(tmpl.id, tmpl.title, 'video')}
                                  style={{
                                    marginTop: '6px',
                                    padding: '6px',
                                    borderRadius: '6px',
                                    background: 'rgba(168, 85, 247, 0.2)',
                                    border: '1px solid rgba(168, 85, 247, 0.4)',
                                    color: '#fff',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.45)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)')}
                                >
                                  ➕ 添加到画布
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* 动态追加用户自定义的本地 ComfyUI / RunningHub 视频模板 */}
                        {savedTemplates.filter(t => t.capability === 'video').length > 0 && (
                          <div style={{ marginTop: '30px' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'hsl(var(--accent-secondary))', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>🔌</span> 您的自定义/本地 ComfyUI 视频工作流 ({savedTemplates.filter(t => t.capability === 'video').length})
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                              {savedTemplates.filter(t => t.capability === 'video').map((tmpl) => (
                                <div
                                  key={tmpl.id}
                                  style={{
                                    borderRadius: '14px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    background: 'rgba(0,0,0,0.2)',
                                    padding: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                    transition: 'all 0.25s',
                                  }}
                                >
                                  <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: '10px', background: 'rgba(0,0,0,0.4)' }}>
                                    <img 
                                      src={tmpl.previewImage || 'https://images.unsplash.com/photo-1536240478700-b869ad10e128?w=400&q=80'} 
                                      alt={tmpl.name} 
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                    <span
                                      style={{
                                        position: 'absolute',
                                        top: '6px',
                                        left: '6px',
                                        background: tmpl.source === 'local_comfyui' ? 'rgba(14, 165, 233, 0.85)' : 'rgba(168, 85, 247, 0.85)',
                                        color: '#fff',
                                        padding: '2px 6px',
                                        borderRadius: '6px',
                                        fontSize: '9px',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {tmpl.source === 'local_comfyui' ? '🔌 本地 Comfy' : '⚡ RunningHub'}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'space-between' }}>
                                    <div>
                                      <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={tmpl.name}>{tmpl.name}</h4>
                                      <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '25px' }}>
                                        {tmpl.description || '自定义视频合成工作流模板...'}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => spawnCustomWorkflowTemplateNode(tmpl)}
                                      style={{
                                        marginTop: '6px',
                                        padding: '6px',
                                        borderRadius: '6px',
                                        background: 'rgba(14, 165, 233, 0.2)',
                                        border: '1px solid rgba(14, 165, 233, 0.4)',
                                        color: '#fff',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(14, 165, 233, 0.45)')}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(14, 165, 233, 0.2)')}
                                    >
                                      {modalNodeTarget ? '➕ 装载到当前节点' : '➕ 添加到画布'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                      {/* Audio Workflow Templates Tab */}
                      {templateLargeTab === 'audio' && (
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          {/* 引导跳转卡片 (前往 AI应用（工作流）) */}
                          <div
                            onClick={() => {
                              setSettingsActiveTab('templates');
                              setIsSettingsOpen(true);
                            }}
                            style={{
                              padding: '16px 24px',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(236, 72, 153, 0.03) 100%)',
                              borderRadius: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              gap: '16px',
                              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.05)',
                              transition: 'all 0.3s ease',
                              marginBottom: '20px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)';
                              e.currentTarget.style.boxShadow = '0 12px 40px rgba(16, 185, 129, 0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.25)';
                              e.currentTarget.style.boxShadow = '0 8px 32px rgba(16, 185, 129, 0.05)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                              <span style={{ fontSize: '28px', filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))' }}>🗣️</span>
                              <div style={{ textAlign: 'left' }}>
                                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#fff', margin: 0 }}>
                                  前往「配置工作流参数」管理中心
                                </h3>
                                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', margin: 0, lineHeight: '1.4' }}>
                                  在此上传您的 ComfyUI JSON 或 RunningHub 资产，深度定制音频克隆暴露参数、别名及多图映射。
                                </p>
                              </div>
                            </div>
                            <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 'bold', whiteSpace: 'nowrap' }}>立即前往 →</span>
                          </div>

                          {/* 自定义 ComfyUI 音频工作流列表 */}
                          <div>
                            <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'hsl(var(--accent-secondary))', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>📋</span> 已保存的音频工作流 ({savedTemplates.filter(t => t.capability === 'audio').length})
                            </h4>
                            {templatesLoading ? (
                              <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>🔄 正在读取模板...</div>
                            ) : savedTemplates.filter(t => t.capability === 'audio').length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '11px', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                                📭 暂无已保存的声音克隆工作流，请在右上角「⚙️ 全局设置」➔「自定义工作流」中导入 ComfyUI JSON 进行解析保存。
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                                {savedTemplates.filter(t => t.capability === 'audio').map((tmpl) => (
                                  <div
                                    key={tmpl.id}
                                    style={{
                                      borderRadius: '14px',
                                      overflow: 'hidden',
                                      border: '1px solid rgba(255,255,255,0.06)',
                                      background: 'rgba(0,0,0,0.2)',
                                      padding: '10px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '8px',
                                      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                      transition: 'all 0.25s',
                                    }}
                                  >
                                    <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: '10px', background: 'rgba(0,0,0,0.4)' }}>
                                      <img src={tmpl.previewImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80'} alt={tmpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      <span
                                        style={{
                                          position: 'absolute',
                                          top: '6px',
                                          left: '6px',
                                          background: tmpl.source === 'local_comfyui' ? 'rgba(14, 165, 233, 0.85)' : 'rgba(168, 85, 247, 0.85)',
                                          color: '#fff',
                                          padding: '2px 6px',
                                          borderRadius: '6px',
                                          fontSize: '9px',
                                          fontWeight: 700,
                                        }}
                                      >
                                        {tmpl.source === 'local_comfyui' ? '🔌 本地 Comfy' : '⚡ RunningHub'}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'space-between' }}>
                                      <div>
                                        <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={tmpl.name}>{tmpl.name}</h4>
                                        <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '25px' }}>
                                          {tmpl.description || '自定义声音克隆工作流模板...'}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => spawnCustomWorkflowTemplateNode(tmpl)}
                                        style={{
                                          marginTop: '6px',
                                          padding: '6px',
                                          borderRadius: '6px',
                                          background: 'rgba(16, 185, 129, 0.2)',
                                          border: '1px solid rgba(16, 185, 129, 0.4)',
                                          color: '#fff',
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.45)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)')}
                                      >
                                        {modalNodeTarget ? '➕ 装载到当前节点' : '➕ 添加到画布'}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Local ComfyUI Workflows Tab */}
                      {templateLargeTab === 'local_comfyui' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                          <div
                            onClick={() => {
                              setSettingsActiveTab('templates');
                              setIsSettingsOpen(true);
                            }}
                            style={{
                              padding: '16px 24px',
                              border: '1px solid rgba(168, 85, 247, 0.25)',
                              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.03) 100%)',
                              borderRadius: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              gap: '16px',
                              boxShadow: '0 8px 32px rgba(168, 85, 247, 0.05)',
                              transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                              e.currentTarget.style.boxShadow = '0 12px 40px rgba(168, 85, 247, 0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.25)';
                              e.currentTarget.style.boxShadow = '0 8px 32px rgba(168, 85, 247, 0.05)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                              <span style={{ fontSize: '28px', filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))' }}>🔮</span>
                              <div style={{ textAlign: 'left' }}>
                                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#fff', margin: 0 }}>
                                  前往「配置工作流参数」管理中心
                                </h3>
                                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', margin: 0, lineHeight: '1.4' }}>
                                  在此上传您的 ComfyUI JSON 或 RunningHub 资产，深度定制暴露参数、别名及多图映射。
                                </p>
                              </div>
                            </div>
                            <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: 'bold', whiteSpace: 'nowrap' }}>立即前往 →</span>
                          </div>

                          {/* 已保存本地ComfyUI模板列表 */}
                          <div>
                            <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'hsl(var(--accent-secondary))', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>📋</span> 已保存的本地 ComfyUI ({savedTemplates.filter(t => t.source === 'local_comfyui').length})
                            </h4>
                            {templatesLoading ? (
                              <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>🔄 正在读取模板...</div>
                            ) : savedTemplates.filter(t => t.source === 'local_comfyui').length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '11px', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                                📭 暂无已保存的自定义工作流，请在右上角「⚙️ 全局设置」➔「自定义工作流」中进行解析保存。
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                                {savedTemplates.filter(t => t.source === 'local_comfyui').map((tmpl) => (
                                  <div
                                    key={tmpl.id}
                                    onMouseEnter={() => setHoveredCardId(tmpl.id)}
                                    onMouseLeave={() => setHoveredCardId(null)}
                                    style={{
                                      borderRadius: '14px',
                                      overflow: 'hidden',
                                      border: '1px solid rgba(255,255,255,0.06)',
                                      background: 'rgba(0,0,0,0.2)',
                                      padding: '10px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '8px',
                                      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                      transition: 'all 0.25s',
                                    }}
                                  >
                                    <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: '10px', background: 'rgba(0,0,0,0.4)' }}>
                                      <img src={tmpl.previewImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80'} alt={tmpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      <span
                                        style={{
                                          position: 'absolute',
                                          top: '6px',
                                          left: '6px',
                                          background: 'rgba(14, 165, 233, 0.85)',
                                          color: '#fff',
                                          padding: '2px 6px',
                                          borderRadius: '6px',
                                          fontSize: '9px',
                                          fontWeight: 700,
                                          zIndex: 5,
                                        }}
                                      >
                                        💻 ComfyUI
                                      </span>

                                      {/* 📷 更换封面 hover glassmorphic button */}
                                      {hoveredCardId === tmpl.id && (
                                        <div
                                          style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            background: 'rgba(11, 15, 26, 0.75)',
                                            backdropFilter: 'blur(4px)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10,
                                            cursor: 'pointer',
                                            animation: 'fadeInOverlay 0.2s ease',
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleChangeCardCover(tmpl);
                                          }}
                                        >
                                          <div
                                            style={{
                                              background: 'rgba(255, 255, 255, 0.15)',
                                              border: '1px solid rgba(255, 255, 255, 0.25)',
                                              borderRadius: '20px',
                                              color: '#fff',
                                              padding: '4px 10.5px',
                                              fontSize: '9.5px',
                                              fontWeight: 'bold',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              transition: 'all 0.2s',
                                            }}
                                          >
                                            📷 更换封面
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'space-between' }}>
                                      <div>
                                        <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={tmpl.name}>{tmpl.name}</h4>
                                        <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '25px' }}>{tmpl.description || '暂无描述信息...'}</p>
                                      </div>
                                      <button
                                        onClick={() => spawnCustomWorkflowTemplateNode(tmpl)}
                                        style={{
                                          marginTop: '6px',
                                          padding: '6px',
                                          borderRadius: '6px',
                                          background: 'rgba(168, 85, 247, 0.2)',
                                          border: '1px solid rgba(168, 85, 247, 0.4)',
                                          color: '#fff',
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.45)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)')}
                                      >
                                        ➕ 添加到画布
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* RunningHub Workflows Tab */}
                      {templateLargeTab === 'runninghub' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                          <div
                            onClick={() => {
                              setSettingsActiveTab('templates');
                              setIsSettingsOpen(true);
                            }}
                            style={{
                              padding: '16px 24px',
                              border: '1px solid rgba(168, 85, 247, 0.25)',
                              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.03) 100%)',
                              borderRadius: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              gap: '16px',
                              boxShadow: '0 8px 32px rgba(168, 85, 247, 0.05)',
                              transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                              e.currentTarget.style.boxShadow = '0 12px 40px rgba(168, 85, 247, 0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.25)';
                              e.currentTarget.style.boxShadow = '0 8px 32px rgba(168, 85, 247, 0.05)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                              <span style={{ fontSize: '28px', filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))' }}>🔮</span>
                              <div style={{ textAlign: 'left' }}>
                                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#fff', margin: 0 }}>
                                  前往「配置工作流参数」管理中心
                                </h3>
                                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', margin: 0, lineHeight: '1.4' }}>
                                  在此上传您的 ComfyUI JSON 或 RunningHub 资产，深度定制暴露参数、别名及多图映射。
                                </p>
                              </div>
                            </div>
                            <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: 'bold', whiteSpace: 'nowrap' }}>立即前往 →</span>
                          </div>

                          <div>
                            <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'hsl(var(--accent-secondary))', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>📋</span> 已保存的 RunningHub 工作流 ({savedTemplates.filter(t => t.source === 'runninghub').length})
                            </h4>
                            {templatesLoading ? (
                              <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>🔄 正在读取模板...</div>
                            ) : savedTemplates.filter(t => t.source === 'runninghub').length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '11px', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                                📭 暂无已保存的 RunningHub 自定义工作流，请在右上角「⚙️ 全局设置」➔「自定义工作流」中进行解析保存。
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                                {savedTemplates.filter(t => t.source === 'runninghub').map((tmpl) => (
                                  <div
                                    key={tmpl.id}
                                    onMouseEnter={() => setHoveredCardId(tmpl.id)}
                                    onMouseLeave={() => setHoveredCardId(null)}
                                    style={{
                                      borderRadius: '14px',
                                      overflow: 'hidden',
                                      border: '1px solid rgba(255,255,255,0.06)',
                                      background: 'rgba(0,0,0,0.2)',
                                      padding: '10px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '8px',
                                      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                      transition: 'all 0.25s',
                                    }}
                                  >
                                    <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: '10px', background: 'rgba(0,0,0,0.4)' }}>
                                      <img src={tmpl.previewImage || 'https://images.unsplash.com/photo-1536240478700-b869ad10e128?w=400&q=80'} alt={tmpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      <span
                                        style={{
                                          position: 'absolute',
                                          top: '6px',
                                          left: '6px',
                                          background: 'rgba(168, 85, 247, 0.85)',
                                          color: '#fff',
                                          padding: '2px 6px',
                                          borderRadius: '6px',
                                          fontSize: '9px',
                                          fontWeight: 700,
                                          zIndex: 5,
                                        }}
                                      >
                                        ⚡ RunningHub
                                      </span>

                                      {/* 📷 更换封面 hover glassmorphic button */}
                                      {hoveredCardId === tmpl.id && (
                                        <div
                                          style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            background: 'rgba(11, 15, 26, 0.75)',
                                            backdropFilter: 'blur(4px)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10,
                                            cursor: 'pointer',
                                            animation: 'fadeInOverlay 0.2s ease',
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleChangeCardCover(tmpl);
                                          }}
                                        >
                                          <div
                                            style={{
                                              background: 'rgba(255, 255, 255, 0.15)',
                                              border: '1px solid rgba(255, 255, 255, 0.25)',
                                              borderRadius: '20px',
                                              color: '#fff',
                                              padding: '4px 10.5px',
                                              fontSize: '9.5px',
                                              fontWeight: 'bold',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              transition: 'all 0.2s',
                                            }}
                                          >
                                            📷 更换封面
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'space-between' }}>
                                      <div>
                                        <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={tmpl.name}>{tmpl.name}</h4>
                                        <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '25px' }}>{tmpl.description || '暂无描述信息...'}</p>
                                      </div>
                                      <button
                                        onClick={() => spawnCustomWorkflowTemplateNode(tmpl)}
                                        style={{
                                          marginTop: '6px',
                                          padding: '6px',
                                          borderRadius: '6px',
                                          background: 'rgba(168, 85, 247, 0.2)',
                                          border: '1px solid rgba(168, 85, 247, 0.4)',
                                          color: '#fff',
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.45)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)')}
                                      >
                                        ➕ 添加到画布
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
{activeFloatingPopup === 'assets' && (
                    <>
                      {/* Common Upload Header for Assets tabs */}
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleResourceUpload(file);
                        }}
                        onClick={() => {
                          const inp = document.createElement('input');
                          inp.type = 'file';
                          inp.accept = 'image/*,video/*,audio/*';
                          inp.onchange = (e: any) => {
                            const file = e.target.files?.[0];
                            if (file) handleResourceUpload(file);
                          };
                          inp.click();
                        }}
                        style={{
                          padding: '16px',
                          border: '1px dashed rgba(168, 85, 247, 0.35)',
                          background: 'rgba(168, 85, 247, 0.02)',
                          borderRadius: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          marginBottom: '10px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#a855f7';
                          e.currentTarget.style.background = 'rgba(168, 85, 247, 0.06)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.35)';
                          e.currentTarget.style.background = 'rgba(168, 85, 247, 0.02)';
                        }}
                      >
                        <span style={{ fontSize: '24px' }}>📥</span>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>将本地图/音/视频资源拖拽或点击上传到大仓中</div>
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                            资源上传后会自动存储在 IndexedDB 本地大仓中，并在画布视口中央派生 Upload 节点。
                          </div>
                        </div>
                      </div>

                      {assetLargeTab === 'mine' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                          {uploadedAssets.length === 0 ? (
                            <div style={{ gridColumn: '1 / span 4', padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                              📭 暂无自定义上传或生成的资产，请拖拽文件到上方进行上传。
                            </div>
                          ) : (
                            uploadedAssets.map((asset) => (
                              <div
                                key={asset.id}
                                style={{
                                  borderRadius: '14px',
                                  overflow: 'hidden',
                                  border: '1px solid rgba(255,255,255,0.06)',
                                  background: 'rgba(0,0,0,0.2)',
                                  padding: '10px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                }}
                              >
                                <div
                                  onClick={() => setFullScreenMedia({ url: asset.url, type: asset.type })}
                                  style={{
                                    width: '100%',
                                    aspectRatio: '16 / 9',
                                    borderRadius: '10px',
                                    overflow: 'hidden',
                                    background: 'rgba(0,0,0,0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    cursor: 'zoom-in',
                                  }}
                                >
                                  {asset.type === 'image' && <ResolvedMedia url={asset.url} type="image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                  {asset.type === 'video' && <ResolvedMedia url={asset.url} type="video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
                                  {asset.type === 'audio' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                      <span style={{ fontSize: '32px' }}>🎵</span>
                                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>音色/配音旁白</span>
                                    </div>
                                  )}
                                  <span style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff' }}>🔍</span>
                                  
                                  {/* 物理删除资产按钮 */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('确认物理删除该资产吗？此操作将从资产库移出，无法撤销。')) {
                                        setUploadedAssets(prev => prev.filter(ua => ua.id !== asset.id));
                                      }
                                    }}
                                    style={{
                                      position: 'absolute',
                                      top: '6px',
                                      left: '6px',
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '50%',
                                      background: 'rgba(239, 68, 68, 0.85)',
                                      border: 'none',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '9px',
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      zIndex: 10,
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                    }}
                                    title="物理删除该资产"
                                  >
                                    ×
                                  </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={asset.nodeName}>
                                    {asset.nodeName}
                                  </span>
                                  <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>类型: {asset.type.toUpperCase()}</span>
                                </div>
                                <button
                                  onClick={() => handleInjectAsset(asset.url, asset.type, asset.nodeName)}
                                  style={{
                                    width: '100%',
                                    padding: '6px',
                                    background: 'rgba(168, 85, 247, 0.25)',
                                    border: '1px solid rgba(168, 85, 247, 0.4)',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.4)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)')}
                                >
                                  ➕ 添加到画布
                              </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {assetLargeTab === 'library' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                          {[
                            // 用户上传的图片（最新在前）
                            ...libraryAssets.map(a => ({ ...a, tag: '用户上传', isPreset: false })),
                            // 预设图片
                            { id: 'preset-1', name: '🖼️ 赛博飞空城堡', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe', tag: '场景', isPreset: true },
                            { id: 'preset-2', name: '🖼️ 蒸汽朋克少女', url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f', tag: '人物', isPreset: true },
                            { id: 'preset-3', name: '🖼️ 晶体魔法森林', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab', tag: '场景', isPreset: true },
                            { id: 'preset-4', name: '🖼️ 机械反重力城郭', url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119', tag: '场景', isPreset: true },
                            { id: 'preset-5', name: '🖼️ 极简化三维抽象', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853', tag: '风格', isPreset: true },
                            { id: 'preset-6', name: '🖼️ VR全景太空站', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa', tag: '全景', isPreset: true },
                            { id: 'preset-7', name: '🖼️ 古风山水殿堂', url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf', tag: '场景', isPreset: true },
                            { id: 'preset-8', name: '🖼️ 霓虹都市雨景', url: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5', tag: '场景', isPreset: true },
                          ].map((a: any) => {
                            const asset = { type: 'image', ...a } as any;
                            return (
                            <div
                              key={asset.id}
                              style={{
                                borderRadius: '14px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(0,0,0,0.2)',
                                padding: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                              }}
                            >
                              <div
                                onClick={() => setFullScreenMedia({ url: asset.url, type: asset.type || 'image' })}
                                style={{
                                  width: '100%',
                                  aspectRatio: '16 / 9',
                                  borderRadius: '10px',
                                  overflow: 'hidden',
                                  background: 'rgba(0,0,0,0.4)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  position: 'relative',
                                  cursor: 'zoom-in',
                                }}
                              >
                                {/* 支持图片、视频、音频 */}
                                {(asset.type === 'image' || !asset.type) && <ResolvedMedia url={asset.url} type="image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                {asset.type === 'video' && <ResolvedMedia url={asset.url} type="video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
                                {asset.type === 'audio' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ fontSize: '32px' }}>🎵</span>
                                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>音色/配音</span>
                                  </div>
                                )}
                                <span style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff' }}>🔍</span>
                                {/* 删除按钮 - 仅用户上传的显示 */}
                                {!asset.isPreset && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('确定删除此图片吗？')) {
                                        setLibraryAssets(prev => prev.filter(a => a.id !== asset.id));
                                      }
                                    }}
                                    style={{
                                      position: 'absolute',
                                      top: '6px',
                                      left: '6px',
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '50%',
                                      background: 'rgba(239, 68, 68, 0.85)',
                                      border: 'none',
                                      color: '#fff',
                                      fontSize: '10px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '110px' }} title={asset.name}>
                                  {asset.name}
                                </span>
                                <span style={{ fontSize: '8px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', padding: '1px 4px', borderRadius: '4px' }}>
                                  {asset.tag}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => handleInjectLibraryAsset(asset.url, asset.name)}
                                  style={{
                                    flex: 1,
                                    padding: '6px',
                                    background: 'rgba(168, 85, 247, 0.2)',
                                    border: '1px solid rgba(168, 85, 247, 0.4)',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.4)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)')}
                                >
                                  ➕ 添加到画布
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    downloadFileDirectly(asset.url, asset.name);
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                  }}
                                >
                                  ⬇️
                                </button>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      )}

                      {assetLargeTab === 'virtual' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                          {[
                            { id: 'xiaoying', name: '小樱 (暖甜配音)', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80', desc: '治愈、温暖系甜美声线。非常适合儿童画册配音、都市情感剧解说旁白。', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', color: 'rgba(236, 72, 153, 0.05)', border: 'rgba(236, 72, 153, 0.15)' },
                            { id: 'ailun', name: '艾伦 (极客男声)', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80', desc: '睿智、科技感与机械力融合的专业极客男声音色。适合科技解说、科幻电影概念片。', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', color: 'rgba(59, 130, 246, 0.05)', border: 'rgba(59, 130, 246, 0.15)' },
                            { id: 'leiya', name: '蕾雅 (御姐音色)', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&q=80', desc: '高冷优雅、气场全开的性感女声。常用于时尚奢侈品广告、影视大片中子解说。', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', color: 'rgba(139, 92, 246, 0.05)', border: 'rgba(139, 92, 246, 0.15)' },
                            { id: 'sam', name: '山姆 (深沉男播)', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80', desc: '浑厚低沉、大师级磁性电影播报男声。适合经典历史、动作电影史诗级解说旁白。', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', color: 'rgba(245, 158, 11, 0.05)', border: 'rgba(245, 158, 11, 0.15)' },
                          ].map((v) => (
                            <div
                              key={v.id}
                              style={{
                                borderRadius: '20px',
                                border: `1px solid ${v.border}`,
                                background: v.color,
                                padding: '20px',
                                display: 'flex',
                                gap: '16px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                              }}
                            >
                              <div style={{ width: '80px', height: '80px', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                                <img src={v.avatar} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'space-between' }}>
                                <div>
                                  <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>{v.name}</h4>
                                  <p style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.4', marginTop: '4px' }}>{v.desc}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                  <button
                                    onClick={() => handleToggleVoicePlay(v.id, v.audio)}
                                    style={{
                                      flex: 1,
                                      padding: '6px 12px',
                                      background: playingVoiceId === v.id ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.04)',
                                      border: playingVoiceId === v.id ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                                      borderRadius: '8px',
                                      color: playingVoiceId === v.id ? '#ef4444' : '#fff',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <span>{playingVoiceId === v.id ? '⏸ 暂停试听' : '🔊 试听音色'}</span>
                                  </button>
                                  <button
                                    onClick={() => handleCloneVirtualVoice(v.name, v.audio)}
                                    style={{
                                      flex: 1.2,
                                      padding: '6px 12px',
                                      background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                                      border: 'none',
                                      borderRadius: '8px',
                                      color: '#fff',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🎙️ 一键克隆声线
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {assetLargeTab === 'other' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                          {[
                            { name: '✨ 动漫二次元 LORA 预设', scale: '0.85', desc: '日系唯美画风强化，适用于动漫电影分镜。' },
                            { name: '✨ 水墨江南写意 LORA 权重', scale: '0.70', desc: '中国风泼墨意境渲染，适用于古风艺术短片。' },
                            { name: '✨ 3D 拟真次世代渲染 LORA', scale: '0.90', desc: '虚幻5级别写实大片光影，适用于商用广告。' },
                            { name: '✨ 赛博朋克深空霓虹 LORA', scale: '0.80', desc: '绚丽霓虹灯光轨迹增强，适用于科幻感合成。' },
                          ].map((lora, idx) => (
                            <div
                              key={idx}
                              style={{
                                borderRadius: '14px',
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(255,255,255,0.02)',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div>
                                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>{lora.name}</h4>
                                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '6px', lineHeight: '1.4' }}>{lora.desc}</p>
                              </div>
                              <div style={{ marginTop: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#a855f7', fontWeight: 700 }}>
                                  <span>推荐使用权重:</span>
                                  <span>{lora.scale}</span>
                                </div>
                                <button
                                  onClick={() => alert(`LORA 预设权重 [${lora.scale}] 已成功复制，可在高级菜单的扩展参数中粘贴引用！`)}
                                  style={{
                                    width: '100%',
                                    marginTop: '8px',
                                    padding: '5px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '6px',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: '9.5px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  📋 复制引用参数
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* 3. History Main Tab */}
                  {activeFloatingPopup === 'history' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                      {getHistoryItems().length === 0 ? (
                        <div style={{ gridColumn: '1 / span 4', padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                          📭 暂无此分类下的 AI 成果历史生成记录。
                        </div>
                      ) : (
                        getHistoryItems().map((item) => (
                          <div
                            key={item.id}
                            style={{
                              borderRadius: '14px',
                              overflow: 'hidden',
                              border: '1px solid rgba(255,255,255,0.06)',
                              background: 'rgba(0,0,0,0.2)',
                              padding: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                            }}
                          >
                            <div
                              onClick={() => setFullScreenMedia({ url: item.url, type: item.type })}
                              style={{
                                width: '100%',
                                aspectRatio: '16 / 9',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                background: 'rgba(0,0,0,0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                cursor: 'zoom-in',
                              }}
                            >
                              {item.type === 'image' && <ResolvedMedia url={item.url} type="image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                              {item.type === 'video' && <ResolvedMedia url={item.url} type="video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
                              {item.type === 'audio' && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontSize: '32px' }}>🎙️</span>
                                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>AI 旁白音频</span>
                                </div>
                              )}
                              <span style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff' }}>🔍</span>
                            </div>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#fff',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                              }}
                              title={item.name}
                            >
                              {item.name}
                            </span>
                            {item.type === 'audio' && (
                              <div style={{ width: '100%', padding: '2px 0' }}>
                                <ResolvedMedia url={item.url} type="audio" style={{ width: '100%', height: '24px' }} controls />
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => handleInjectAsset(item.url, item.type, item.name)}
                                style={{
                                  flex: 1,
                                  padding: '6px',
                                  background: 'rgba(168, 85, 247, 0.2)',
                                  border: '1px solid rgba(168, 85, 247, 0.3)',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.4)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)')}
                              >
                                ➕ 添加到画布
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  downloadFileDirectly(item.url, `toonflow-${item.type}-${item.id}`);
                                }}
                                style={{
                                  padding: '6px 10px',
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  textDecoration: 'none',
                                }}
                              >
                                ⬇️
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. 右侧高保真配置抽屉 (Properties Drawer) */}
      {editingNodeId && (
        <aside 
          className="glass-panel" 
          style={{
            position: 'absolute',
            top: '96px',
            right: '16px',
            bottom: '16px',
            width: '380px',
            zIndex: 40,
            borderRadius: '24px',
            background: 'rgba(11, 15, 25, 0.88)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideInDrawer 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
              🔮 自定义工作流属性配置
            </h3>
            <button 
              onClick={handleCloseDrawer}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px'
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 节点显示名称 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>节点显示名称:</label>
              <input
                type="text"
                className="nodrag"
                onMouseDown={(e) => e.stopPropagation()}
                value={drawerLabel}
                onChange={(e) => setDrawerLabel(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '12px',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* ComfyUI / RunningHub Segmented Tab */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>工作流数据源选择:</label>
              <div style={{ 
                display: 'flex', 
                background: 'rgba(0,0,0,0.4)', 
                padding: '3px', 
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <button
                  onClick={() => setDrawerSource('local_comfyui')}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '6px',
                    border: 'none',
                    background: drawerSource === 'local_comfyui' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                    color: drawerSource === 'local_comfyui' ? '#fff' : 'rgba(255,255,255,0.4)',
                    fontSize: '11px',
                    fontWeight: drawerSource === 'local_comfyui' ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  💻 ComfyUI (JSON)
                </button>
                <button
                  onClick={() => setDrawerSource('runninghub')}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '6px',
                    border: 'none',
                    background: drawerSource === 'runninghub' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                    color: drawerSource === 'runninghub' ? '#fff' : 'rgba(255,255,255,0.4)',
                    fontSize: '11px',
                    fontWeight: drawerSource === 'runninghub' ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  🚀 RunningHub (ID)
                </button>
              </div>
            </div>

            {/* 内容抽屉物理隔离 */}
            {drawerSource === 'local_comfyui' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeIn 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>ComfyUI API JSON 拓扑配置:</label>
                  <button
                    onClick={() => {
                      const inp = document.createElement('input');
                      inp.type = 'file';
                      inp.accept = '.json';
                      inp.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setDrawerComfyJson(ev.target?.result as string);
                            alert('🎉 成功载入 ComfyUI JSON 拓扑！');
                          };
                          reader.readAsText(file);
                        }
                      };
                      inp.click();
                    }}
                    style={{ fontSize: '9px', color: 'hsl(var(--accent-secondary))', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    📁 本地上传
                  </button>
                </div>
                <textarea
                  value={drawerComfyJson}
                  className="nodrag"
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => setDrawerComfyJson(e.target.value)}
                  placeholder="在此粘贴导出的 ComfyUI API 格式 JSON 拓扑代码..."
                  style={{
                    width: '100%',
                    height: '140px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '11px',
                    color: '#a855f7',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'monospace',
                    lineHeight: '1.4'
                  }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeIn 0.2s' }}>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>RunningHub 线上工作流 ID:</label>
                <input
                  type="text"
                  className="nodrag"
                  onMouseDown={(e) => e.stopPropagation()}
                  value={drawerRunningHubId}
                  onChange={(e) => setDrawerRunningHubId(e.target.value)}
                  placeholder="请输入 RunningHub 工作流 ID (例如: rh_wf_face_consistency)..."
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '11px',
                    color: '#ec4899',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            )}

            {/* 一键智能解析按钮 */}
            <button
              onClick={handleParseWorkflow}
              disabled={parsing}
              style={{
                width: '100%',
                padding: '10px',
                background: 'linear-gradient(135deg, hsl(var(--accent-primary)), hsl(var(--accent-secondary)))',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 10px hsl(var(--accent-primary) / 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {parsing ? '🔄 正在智能扫描参数结构...' : '🧠 一键智能解析工作流参数'}
            </button>

            {/* 可调参数列表端口映射 */}
            {parsedParams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>🎛️ 物理端口勾选与别名暴露映射:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                  {parsedParams.map((param) => {
                    const paramKey = `${param.nodeId}_${param.fieldName}`;
                    const isChecked = !!selectedParams[paramKey];
                    const alias = paramAliases[paramKey] || '';
                    return (
                      <div
                        key={paramKey}
                        className="glass-card"
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          border: isChecked ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(255,255,255,0.06)',
                          background: isChecked ? 'rgba(168, 85, 247, 0.03)' : 'rgba(0,0,0,0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              className="nodrag"
                              onMouseDown={(e) => e.stopPropagation()}
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedParams(prev => ({
                                  ...prev,
                                  [paramKey]: e.target.checked
                                }));
                              }}
                              style={{ width: '13px', height: '13px', accentColor: 'hsl(var(--accent-primary))', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>
                              {param.displayName}
                            </span>
                          </div>
                          <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                            ID: {param.nodeId}
                          </span>
                        </div>

                        {isChecked && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn 0.2s' }}>
                            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>端口别名:</span>
                            <input
                              type="text"
                              className="nodrag"
                              onMouseDown={(e) => e.stopPropagation()}
                              value={alias}
                              onChange={(e) => {
                                setParamAliases(prev => ({
                                  ...prev,
                                  [paramKey]: e.target.value
                                }));
                              }}
                              placeholder="自定义连线端点显示别名"
                              style={{
                                flex: 1,
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                color: '#fff',
                                fontSize: '10px',
                                outline: 'none'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.01)'
          }}>
            <button
              onClick={handleCloseDrawer}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.02)',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
            <button
              onClick={handleSaveDrawer}
              style={{
                padding: '6px 18px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                background: 'linear-gradient(135deg, hsl(var(--accent-primary)), hsl(var(--accent-secondary)))',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              💾 保存参数配置
            </button>
          </div>
        </aside>
      )}

      {/* 5. AixCanvas 浮动模型挑选弹出栏 (AixModelPicker) */}
      {isModelPickerOpen && (
        <div className="glass-panel active-glow" style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '540px',
          height: '320px',
          zIndex: 50,
          borderRadius: '20px',
          background: 'rgba(11, 15, 25, 0.9)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 15px 50px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s'
        }}>
          {/* 左侧大类导航 */}
          <div style={{
            width: '180px',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 8px',
            gap: '8px'
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, paddingLeft: '8px', marginBottom: '4px' }}>📊 模型分类栏</div>
            {[
              { id: 'rh', label: '🎭 Aix (RunningHub)', icon: '⚡', desc: '一镜一镜，各存各的' },
              { id: 'flux', label: '🎨 艺术生图 (Flux)', icon: '🌈', desc: '艺术效果，色彩万千' },
              { id: 'tts', label: '🗣️ 声音克隆 (TTS)', icon: '🎙️', desc: '磁性男声，甜美女声' },
              { id: 'video', label: '📹 视频合成 (Video)', icon: '🎥', desc: '音视频融合，直出大片' }
            ].map((cat) => {
              const active = hoveredCategory === cat.id;
              return (
                <div
                  key={cat.id}
                  onMouseEnter={() => setHoveredCategory(cat.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: active ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                    border: active ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700 }}>
                    <span>{cat.icon}</span> {cat.label}
                  </div>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginTop: '2px', paddingLeft: '20px' }}>{cat.desc}</div>
                </div>
              );
            })}
          </div>

          {/* 右侧详细模型列表 */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                {!hoveredCategory && '👉 请悬停左侧大类以展示模型列表'}
                {hoveredCategory === 'rh' && '🎭 RunningHub 云端封装工作流'}
                {hoveredCategory === 'flux' && '🎨 艺术生图 (Flux / SD) 模型'}
                {hoveredCategory === 'tts' && '🗣️ 声音克隆 (TTS) 模型'}
                {hoveredCategory === 'video' && '📹 视频合成 (Video) 模型'}
              </span>
              <button 
                onClick={() => { setIsModelPickerOpen(false); setHoveredCategory(null); }}
                style={{ background: 'rgba(255,255,255,0.04)', border: 'none', color: 'rgba(255,255,255,0.5)', borderRadius: '50%', cursor: 'pointer', width: '18px', height: '18px', fontSize: '9px' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* 1. RH Workflows */}
              {hoveredCategory === 'rh' && [
                { id: '2034899011521482754', name: '🎨 RunningHub 极简文生图 (Flux)', desc: '极速且纯粹的云端文生图工作流，支持画面尺寸的自适应微调。' },
                { id: 'rh_wf_face_consistency', name: '🎭 RunningHub 面部一致性洗图', desc: '智能提取 Flux 面部原画特征，并在云端进行高精面部重采样。' },
                { id: 'rh_wf_style_transfer', name: '🎨 RunningHub 艺术流派跨界重绘', desc: '一键将常规图片洗成赛博朋克、日系动漫或中国古典水墨风。' }
              ].map(wf => (
                <div
                  key={wf.id}
                  onClick={() => handleSelectRunningHubWorkflow(wf.id, wf.name)}
                  className="glass-card"
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'hsl(var(--accent-secondary))'; e.currentTarget.style.background = 'rgba(168, 85, 247, 0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>{wf.name}</div>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{wf.desc}</div>
                </div>
              ))}

              {/* 2. Flux Models */}
              {hoveredCategory === 'flux' && [
                { name: 'flux-schnell', desc: 'Flux 闪电超高速采样模型，适合极速原画概念预览。' },
                { name: 'flux-dev', desc: 'Flux 开发者高保真模型，色彩斑斓，细节无可挑剔。' },
                { name: 'sdxl-lightning', desc: 'SDXL 高保真闪电模型，完美呈现艺术流派光影效果。' }
              ].map(m => (
                <div
                  key={m.name}
                  onClick={() => handleSelectStandardModel(m.name)}
                  className="glass-card"
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'hsl(var(--accent-primary))'; e.currentTarget.style.background = 'rgba(168, 85, 247, 0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>{m.name}</div>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{m.desc}</div>
                </div>
              ))}

              {/* 3. TTS Models */}
              {hoveredCategory === 'tts' && [
                { name: 'fish-speech-1.4', desc: 'Fish Speech 全自动多语种声音克隆模型。' },
                { name: 'gpt-sovits', desc: 'GPT-SoVITS 精细声音情感语调物理锁定模型。' }
              ].map(m => (
                <div
                  key={m.name}
                  onClick={() => handleSelectStandardModel(m.name)}
                  className="glass-card"
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.background = 'rgba(14, 165, 233, 0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>{m.name}</div>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{m.desc}</div>
                </div>
              ))}

              {/* 4. Video Models */}
              {hoveredCategory === 'video' && [
                { name: 'vidu-high-speed', desc: 'Vidu 极速电影镜头流体物理视频生成模型。' },
                { name: 'kling-v2', desc: '快手可灵 v2 超写实多运镜无缝融合大模型。' }
              ].map(m => (
                <div
                  key={m.name}
                  onClick={() => handleSelectStandardModel(m.name)}
                  className="glass-card"
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.background = 'rgba(245, 158, 11, 0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>{m.name}</div>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 物理联调全链路运行进度渲染框 */}
      {isRunning && (
        <div 
          className="glass-panel active-glow" 
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            width: '360px',
            padding: '16px 20px',
            zIndex: 100,
            borderRadius: '16px',
            background: 'rgba(11, 15, 25, 0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.2s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>⚡ 画布多机联调运行中...</span>
            <span style={{ fontSize: '11px', color: 'hsl(var(--accent-secondary))', fontWeight: 800 }}>{progressPct}%</span>
          </div>

          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ 
              width: `${progressPct}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, hsl(var(--accent-primary)), hsl(var(--accent-secondary)))',
              boxShadow: '0 0 8px hsl(var(--accent-secondary))',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
          </div>

          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⏳</span> {progressMsg}
          </p>
        </div>
      )}

      {/* 全局设置弹窗组件挂载 */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsActiveTab}
      />

      {/* 节点右键菜单 (Node Context Menu Overlay) */}
      {nodeContextMenu && (
        <div 
          className="glass-panel nodrag"
          style={{
            position: 'absolute',
            top: nodeContextMenu.y,
            left: nodeContextMenu.x,
            zIndex: 10000,
            borderRadius: '12px',
            background: 'rgba(11, 15, 25, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(168, 85, 247, 0.25)',
            padding: '6px',
            width: '160px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Backdrop layer to close on clicking outside */}
          <div 
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: -1,
              background: 'transparent'
            }}
            onClick={() => setNodeContextMenu(null)}
          />

          {[
            { id: 'create_asset', label: '💼 创建资产' },
            { id: 'copy', label: '📋 复制节点' },
            { id: 'duplicate', label: '👥 创建副本' },
            { id: 'download', label: '⬇️ 下载成果' },
            { id: 'delete', label: '🗑️ 删除节点', danger: true }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                handleNodeContextMenuAction(item.id, nodeContextMenu.nodeId);
                setNodeContextMenu(null);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: item.danger ? '#ef4444' : '#fff',
                fontSize: '12px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = item.danger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(168, 85, 247, 0.15)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 空白处右键菜单 (Pane Context Menu Overlay) */}
      {paneContextMenuPos && (
        <div 
          className="glass-panel nodrag"
          style={{
            position: 'fixed',             // 用 fixed 不随画布滚动
            top: paneContextMenuPos.y,
            left: paneContextMenuPos.x,
            zIndex: 10000,
            borderRadius: '12px',
            background: 'rgba(11, 15, 25, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(168, 85, 247, 0.25)',
            padding: '6px',
            width: '160px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Backdrop layer to close on clicking outside */}
          <div 
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: -1,
              background: 'transparent'
            }}
            onClick={() => setPaneContextMenuPos(null)}
          />

          {[
            { type: 'upload-node', label: '📦 本地上传' },
            { type: 'prompt-source', label: '📖 文本素材' },
            { type: 'image-service', label: '🎨 智能生图' },
            { type: 'tts-service', label: '🗣️ 声音克隆' },
            { type: 'video-fusion', label: '📹 视频生成' },
            { type: 'loop-node', label: '🔄 循环迭代' },
            { type: 'grid-splitter', label: '⊞ 智能切片' },
            { type: 'llm-service', label: '🧠 剧本专家' }
          ].map((item) => (
            <button
              key={item.type}
              onClick={() => {
                let initialData = {};
                if (item.type === 'upload-node') {
                  initialData = { fileType: 'image', fileUrl: '', fileName: '' };
                }
                handleAddAgentNode(item.type as any, initialData);
                setPaneContextMenuPos(null);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 保存资产对话框 (Save Asset Modal) */}
      {isSaveAssetOpen && assetToSave && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(5, 7, 12, 0.85)',
            backdropFilter: 'blur(24px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '460px',
              background: 'rgba(11, 15, 25, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8), 0 0 30px rgba(168, 85, 247, 0.2)',
              borderRadius: '20px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎨</span> 保存当前生成为资产
            </h3>

            {/* 封面预览区 */}
            <div
              style={{
                width: '100%',
                height: '140px',
                borderRadius: '12px',
                background: '#000',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {assetToSave.url ? (
                assetToSave.url.includes('.mp4') ? (
                  <video 
                    src={assetToSave.url} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    autoPlay
                    loop
                    muted
                  />
                ) : assetToSave.url.includes('.mp3') || assetToSave.url.includes('.wav') ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '32px' }}>🎵</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>音频成果</span>
                  </div>
                ) : (
                  <img 
                    src={assetToSave.url} 
                    alt="Preview" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )
              ) : (
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>无预览封面媒体</span>
              )}
              <div 
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '8px',
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(4px)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                来自节点: {assetToSave.nodeName}
              </div>
            </div>

            {/* 表单项 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', fontWeight: 600 }}>资产名称 (限制 30 字)</label>
                <input 
                  type="text"
                  className="nodrag"
                  onMouseDown={(e) => e.stopPropagation()}
                  maxLength={30}
                  value={saveAssetName}
                  onChange={(e) => setSaveAssetName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                  placeholder="给您的资产起一个亮眼的名字..."
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', fontWeight: 600 }}>资产分类</label>
                <select
                  value={saveAssetTag}
                  onChange={(e) => setSaveAssetTag(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {['人物', '场景', '物品', '视频', '音频', '其他'].map(tag => (
                    <option key={tag} value={tag} style={{ background: '#11131a' }}>{tag}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', fontWeight: 600 }}>描述说明</label>
                <textarea
                  value={saveAssetDesc}
                  className="nodrag"
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => setSaveAssetDesc(e.target.value)}
                  style={{
                    width: '100%',
                    height: '60px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'var(--font-sans)',
                    lineHeight: '1.5'
                  }}
                  placeholder="可选描述资产的独特特点或工作流背景参数..."
                />
              </div>
            </div>

            {/* 按钮行 */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setIsSaveAssetOpen(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              >
                取消
              </button>
              <button
                onClick={handleConfirmSaveAsset}
                style={{
                  flex: 2,
                  padding: '10px',
                  background: 'linear-gradient(135deg, hsl(var(--accent-primary)) 0%, hsl(var(--accent-secondary)) 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.45)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.3)'}
              >
                💾 确认保存至资产库
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录/资产全屏高精 Lightbox 预览 */}
      {fullScreenMedia && (() => {
        // 1. 获取当前关联的节点和它的最新 outputs URL
        const activeNode = nodes.find(n => n.id === fullScreenMedia.nodeId);
        const activeUrl = activeNode ? (activeNode.data?.outputs?.image || activeNode.data?.outputs?.video || activeNode.data?.outputs?.audio || activeNode.data?.outputs?.output || activeNode.data?.outputUrl || fullScreenMedia.url) : fullScreenMedia.url;
        
        // 2. 智能追溯原图/参考图 (Before)
        let beforeUrl = '';
        if (activeNode) {
          const inputs = activeNode.data?.inputs as any;
          if (inputs?.faceRef && inputs.faceRef !== activeUrl) beforeUrl = inputs.faceRef;
          else if (inputs?.imageRef && inputs.imageRef !== activeUrl) beforeUrl = inputs.imageRef;
          else if (inputs?.fileUrl && inputs.fileUrl !== activeUrl && activeNode.type !== 'upload-node') beforeUrl = inputs.fileUrl;
          
          if (!beforeUrl) {
            const upstreamEdge = edges.find(e => e.target === fullScreenMedia.nodeId);
            const upstreamNode = upstreamEdge ? nodes.find(n => n.id === upstreamEdge.source) : null;
            if (upstreamNode) {
              const uOut = upstreamNode.data?.outputs as any;
              const uUrl = uOut?.image || uOut?.output || uOut?.video || upstreamNode.data?.outputUrl;
              if (uUrl && uUrl !== activeUrl) beforeUrl = uUrl;
            }
          }
        }
        
        // 3. 决定是否显示侧边栏以及左右对比状态
        const hasSidebar = !!activeNode && (activeNode.data?.inputs?.prompt !== undefined || activeNode.type !== 'upload-node');
        const canCompare = !!beforeUrl && fullScreenMedia.type === 'image';
        const isRunningNode = activeNode?.data?.isRunning || (isRunning && activeStep === activeNode?.id);
        
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(4, 6, 12, 0.94)',
              backdropFilter: 'blur(25px)',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'stretch',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={() => setFullScreenMedia(null)}
          >
            {/* 左侧主要展示与对比区域 */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                padding: '24px 40px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Banner with Close and Mode Selector */}
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  width: '100%', 
                  marginBottom: '16px',
                  zIndex: 20
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: '#fff', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                    🎨 Toonflow AixCanvas 4K Ultra Lightbox
                  </span>
                  
                  {/* 对比模式选择 Tab (仅在可对比时展示) */}
                  {canCompare && (
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {[
                        { id: 'slider', label: '⇄ 滑栏对比' },
                        { id: 'side-by-side', label: '👥 并排对比' },
                        { id: 'single', label: '🖼️ 单图模式' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setLightboxCompareMode(tab.id as any)}
                          style={{
                            background: lightboxCompareMode === tab.id ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            color: lightboxCompareMode === tab.id ? '#fff' : 'rgba(255,255,255,0.45)',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '4px 12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => setFullScreenMedia(null)}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >
                  ×
                </button>
              </div>

              {/* Media Preview Container */}
              <div
                style={{
                  flex: 1,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* 1. 流光运行加载层 */}
                {isRunningNode && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(9, 13, 22, 0.85)',
                      backdropFilter: 'blur(16px)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 30,
                      borderRadius: '16px',
                      animation: 'fadeIn 0.2s ease-out'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '320px' }}>
                      <span style={{ fontSize: '32px', animation: 'floatPill 3s infinite ease-in-out' }}>🎨</span>
                      <span style={{ fontSize: '13px', color: 'rgba(168, 85, 247, 1)', fontWeight: 700, textShadow: '0 0 10px rgba(168,85,247,0.3)' }}>
                        图像正重新精调渲染中... {progressPct}%
                      </span>
                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)', transition: 'width 0.2s' }} />
                      </div>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                        {progressMsg || '正在接收网关 ComfyUI 运算状态流...'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. 媒体呈现逻辑 */}
                {fullScreenMedia.type === 'video' ? (
                  <ResolvedMedia 
                    url={activeUrl} 
                    type="video"
                    controls
                    autoPlay
                    style={{
                      maxWidth: '100%',
                      maxHeight: '90%',
                      objectFit: 'contain',
                      borderRadius: '16px',
                      border: '1.5px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.12)'
                    }}
                  />
                ) : fullScreenMedia.type === 'audio' ? (
                  <div 
                    className="glass-panel"
                    style={{
                      padding: '40px',
                      borderRadius: '20px',
                      background: 'rgba(11, 15, 25, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '24px',
                      width: '420px'
                    }}
                  >
                    <span style={{ fontSize: '72px', animation: 'pulse 1.5s infinite alternate' }}>🎵</span>
                    <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>AixCanvas 音频资产播放器</div>
                    <ResolvedMedia 
                      url={activeUrl} 
                      type="audio"
                      controls 
                      autoPlay
                      style={{ width: '100%' }}
                    />
                  </div>
                ) : (
                  /* 图像渲染：支持 Slider 对比 / Side by side 对比 / Single 铺开 */
                  (() => {
                    if (canCompare && lightboxCompareMode === 'slider') {
                      return (
                        <div 
                          ref={sliderContainerRef}
                          onPointerMove={handleSliderPointerMove}
                          onPointerUp={handleSliderPointerUp}
                          onPointerLeave={handleSliderPointerUp}
                          style={{ 
                            position: 'relative', 
                            width: '100%', 
                            height: '90%', 
                            borderRadius: '16px',
                            border: '1.5px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
                            overflow: 'hidden'
                          }}
                        >
                          {/* 底层：After 生成成果图 */}
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                            <ResolvedMedia url={activeUrl} type="image" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          </div>

                          {/* 顶层：Before 输入原图，通过 clip-path 剪切 */}
                          <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(0 0, ${lightboxSliderPos}% 0, ${lightboxSliderPos}% 100%, 0 100%)`, zIndex: 5, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ResolvedMedia url={beforeUrl} type="image" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          </div>

                          {/* Before 标签 */}
                          <div style={{ position: 'absolute', left: '16px', top: '16px', background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '3px 8px', color: '#e9d5ff', fontSize: '10px', fontWeight: 'bold', zIndex: 12 }}>
                            📷 BEFORE (输入参考源)
                          </div>

                          {/* After 标签 */}
                          <div style={{ position: 'absolute', right: '16px', top: '16px', background: 'rgba(168, 85, 247, 0.35)', border: '1px solid rgba(168, 85, 247, 0.5)', borderRadius: '6px', padding: '3px 8px', color: '#fff', fontSize: '10px', fontWeight: 'bold', zIndex: 12 }}>
                            🎨 AFTER (生成成果图)
                          </div>

                          {/* 分割激光线 */}
                          <div 
                            style={{
                              position: 'absolute',
                              top: 0, bottom: 0,
                              left: `${lightboxSliderPos}%`,
                              width: '2px',
                              background: 'linear-gradient(180deg, #a855f7 0%, #ec4899 100%)',
                              boxShadow: '0 0 12px rgba(168, 85, 247, 0.95)',
                              transform: 'translateX(-50%)',
                              pointerEvents: 'none',
                              zIndex: 10
                            }}
                          />

                          {/* 双向箭头手柄 */}
                          <div 
                            onPointerDown={handleSliderPointerDown}
                            style={{
                              position: 'absolute',
                              top: '50%',
                              left: `${lightboxSliderPos}%`,
                              width: '36px', height: '36px',
                              borderRadius: '50%',
                              background: 'rgba(168, 85, 247, 0.95)',
                              border: '2.5px solid #fff',
                              boxShadow: '0 0 20px rgba(168, 85, 247, 0.8)',
                              transform: 'translate(-50%, -50%)',
                              cursor: 'ew-resize',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              zIndex: 11
                            }}
                          >
                            ⇄
                          </div>
                        </div>
                      );
                    } else if (canCompare && lightboxCompareMode === 'side-by-side') {
                      return (
                        <div style={{ display: 'flex', gap: '20px', width: '100%', height: '90%' }}>
                          <div style={{ flex: 1, position: 'relative', background: '#000', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ResolvedMedia url={beforeUrl} type="image" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            <div style={{ position: 'absolute', left: '12px', top: '12px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 6px', color: '#fff', fontSize: '9px' }}>📷 BEFORE (参考源)</div>
                          </div>
                          <div style={{ flex: 1, position: 'relative', background: '#000', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ResolvedMedia url={activeUrl} type="image" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            <div style={{ position: 'absolute', left: '12px', top: '12px', background: 'rgba(168, 85, 247, 0.3)', border: '1px solid rgba(168, 85, 247, 0.5)', borderRadius: '4px', padding: '2px 6px', color: '#fff', fontSize: '9px' }}>🎨 AFTER (生成图)</div>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <ResolvedMedia 
                          url={activeUrl} 
                          type="image"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '90%',
                            objectFit: 'contain',
                            borderRadius: '16px',
                            border: '1.5px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.12)'
                          }}
                        />
                      );
                    }
                  })()
                )}
              </div>

              {/* 底部快捷控制栏 */}
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: '12px', 
                  marginTop: '16px',
                  zIndex: 20 
                }}
              >
                <button 
                  onClick={() => {
                    downloadFileDirectly(activeUrl, `toonflow-media-${Date.now()}`);
                  }}
                  style={{
                    padding: '8px 24px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >
                  📥 下载此成果
                </button>
              </div>
            </div>

            {/* 右侧：生成元数据与精调侧边栏 */}
            {hasSidebar && (
              <div
                style={{
                  width: '350px',
                  background: 'rgba(10, 15, 26, 0.95)',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '24px',
                  gap: '20px',
                  boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
                  zIndex: 100
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '18px' }}>🎨</span>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '15px' }}>生成元数据审计</span>
                  </div>
                  <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                    NODE ID: {fullScreenMedia.nodeId}
                  </span>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.06)', margin: 0 }} />

                {/* 元数据卡片 Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>服务类型 (Type):</span>
                    <span style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold' }}>
                      {activeNode.type === 'image-service' ? '生图服务 Agent' : activeNode.type === 'video-fusion' ? '视频生成 Fusion' : '工作流服务'}
                    </span>
                  </div>

                  {activeNode.data?.inputs?.model && (
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>渲染模型 (Model):</span>
                      <span style={{ fontSize: '11px', color: '#a855f7', fontWeight: 'bold' }}>
                        {activeNode.data.inputs.model}
                      </span>
                    </div>
                  )}

                  {activeNode.data?.inputs?.providerId && (
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>算力供给 (Provider):</span>
                      <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 'bold' }}>
                        {activeNode.data.inputs.providerId === 'volcengine' ? '火山引擎 (Volc)' : activeNode.data.inputs.providerId}
                      </span>
                    </div>
                  )}
                </div>

                {/* 提示词精调 */}
                {activeNode.data?.inputs?.prompt !== undefined && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold' }}>
                        📝 原地提示词精调 (Prompt):
                      </span>
                      
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await navigator.clipboard.writeText(lightboxPrompt);
                            const btn = e.currentTarget;
                            btn.innerText = '✓ 已复制';
                            setTimeout(() => { btn.innerText = '📋 复制提示词'; }, 1000);
                          } catch (err) {
                            alert('物理复制失败！');
                          }
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: 'none',
                          color: 'rgba(255,255,255,0.5)',
                          fontSize: '9.5px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        📋 复制提示词
                      </button>
                    </div>

                    <textarea
                      value={lightboxPrompt}
                      onChange={(e) => setLightboxPrompt(e.target.value)}
                      placeholder="输入精调提示词，免退灯箱原地重新流转生成..."
                      style={{
                        width: '100%',
                        flex: 1,
                        minHeight: '120px',
                        background: 'rgba(0, 0, 0, 0.45)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        padding: '12px',
                        color: '#fff',
                        fontSize: '12px',
                        resize: 'none',
                        outline: 'none',
                        fontFamily: 'inherit',
                        lineHeight: '1.4'
                      }}
                    />
                  </div>
                )}

                {/* 底部原地精调生成运行按钮 */}
                <button
                  onClick={lightboxReRun}
                  disabled={isRunningNode}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: isRunningNode 
                      ? 'rgba(255,255,255,0.04)' 
                      : 'linear-gradient(135deg, rgba(168, 85, 247, 0.95) 0%, rgba(236, 72, 153, 0.8) 100%)',
                    border: 'none',
                    color: isRunningNode ? 'rgba(255,255,255,0.2)' : '#fff',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: isRunningNode ? 'not-allowed' : 'pointer',
                    boxShadow: isRunningNode ? 'none' : '0 4px 20px rgba(168, 85, 247, 0.4)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isRunningNode) {
                      e.currentTarget.style.boxShadow = '0 6px 24px rgba(168, 85, 247, 0.6)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRunningNode) {
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(168, 85, 247, 0.4)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {isRunningNode ? '🔄 正在精细生成中...' : '⚡ 重新精调生成 (Re-run)'}
                </button>
              </div>
            )}
          </div>
        );
      })()}



      {/* 帮助与快捷键指南弹窗 */}
      {isHelpOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(5, 7, 12, 0.8)',
            backdropFilter: 'blur(20px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setIsHelpOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '480px',
              background: 'rgba(11, 15, 25, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8), 0 0 30px rgba(168, 85, 247, 0.15)',
              borderRadius: '20px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💡</span> AixCanvas 交互快捷键与教程指南
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
              
              {/* 快捷键板块 */}
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(168, 85, 247, 1)', display: 'block', marginBottom: '8px' }}>⌨️ 键盘与鼠标快捷操作</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { keys: '鼠标双击画布空白处', action: '快速热新增 [📖 故事剧本源] 节点' },
                    { keys: '鼠标右键画布空白处', action: '弹出磨砂玻璃“添加节点”菜单' },
                    { keys: '鼠标右键点击节点', action: '呼出节点专属操作菜单 (复制/删除/下载等)' },
                    { keys: 'Ctrl + C', action: '复制当前鼠标悬浮或选中的节点' },
                    { keys: 'Ctrl + V', action: '在鼠标指针当前坐标粘贴已复制的节点' },
                    { keys: '选中节点 + Backspace / Del', action: '快速安全删除当前选中的节点' },
                    { keys: '鼠标滚轮 / 触控板双指', action: '对无限画布进行平滑无极缩放 (Zoom)' },
                    { keys: '鼠标按住空白处拖拽', action: '平移画布视角 (Pan)' }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', paddingBottom: '6px' }}>
                      <span style={{ color: '#fff', fontWeight: 600, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{item.keys}</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>{item.action}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 官方教程板块 */}
              <div style={{ marginTop: '4px', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.15)', borderRadius: '10px', padding: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🔗 官方开发者进阶教程
                </span>
                <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', margin: '6px 0 10px 0', lineHeight: '1.4' }}>
                  想要定制属于您自己的 RunningHub 专属 AI 工作流、打光模板或面部一致性服务？点击下方链接即可开启您的 ComfyUI / RunningHub 开发之旅。
                </p>
                <a 
                  href="https://runninghub.cn" 
                  target="_blank" 
                  rel="noreferrer"
                  style={{
                    display: 'inline-block',
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, hsl(var(--accent-primary)) 0%, hsl(var(--accent-secondary)) 100%)',
                    color: '#fff',
                    textAlign: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(168, 85, 247, 0.25)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 15px rgba(168, 85, 247, 0.4)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.25)'}
                >
                  🚀 访问 RunningHub 官方平台
                </a>
              </div>

            </div>

            <button
              onClick={() => setIsHelpOpen(false)}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* 🔮 极致丝滑：拉线松开空白处智能派生微型菜单 */}
      {showConnectMenu && connectMenuPos && (
        <div
          className="glass-panel"
          style={{
            position: 'fixed',
            top: connectMenuPos.y,
            left: connectMenuPos.x,
            transform: 'translate(-20px, -20px)',
            background: 'rgba(11, 15, 25, 0.95)',
            backdropFilter: 'blur(25px)',
            border: '1px solid rgba(168, 85, 247, 0.45)',
            borderRadius: '12px',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 25px rgba(168, 85, 247, 0.35)',
            zIndex: 999999,
            width: '180px',
            animation: 'fadeIn 0.15s ease-out'
          }}
          onMouseLeave={() => {
            // 当鼠标移开时，自动消失，体验更加流畅
            setShowConnectMenu(false);
          }}
        >
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'rgba(168, 85, 247, 1)',
            padding: '6px 10px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            letterSpacing: '0.5px'
          }}>
            {connectionStart?.handleType === 'source' ? '⚡ 智能派生下游:' : '🔌 接入智能上游:'}
          </div>
          {/* 首选智能推荐列表，如果推荐列表为空或者用户点击了“显示全部”，则列出所有 */}
          {((recommendList.length > 0 && !showAllOptions) ? recommendList : [
            { type: 'prompt-source', label: '📖 故事剧本源' },
            { type: 'llm-service', label: '🧠 剧本分镜专家' },
            { type: 'image-service', label: '🎨 智能生图 Agent' },
            { type: 'tts-service', label: '🗣️ 声音克隆 Agent' },
            { type: 'video-fusion', label: '📹 视频合成 Fusion' },
            { type: 'upload-node', label: '📦 本地上传组件' },
            { type: 'grid-splitter', label: '⊞ 智能切片' },
            { type: 'loop-node', label: '🔄 循环迭代' }
          ]).map((opt: any) => (
            <button
              key={opt.type}
              onClick={() => handleCreateAndConnectNode(opt.type)}
              style={{
                width: '100%',
                padding: '7px 10px',
                border: 'none',
                background: 'transparent',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '11px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '6px',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: 'inherit'
              }}
              className="connect-menu-item"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <span>{opt.label}</span>
              <span style={{ fontSize: '10px', opacity: 0.5 }}>→</span>
            </button>
          ))}

          {/* 如果当前是推荐视图且推荐数量大于0，提供“全部常用组件”的折叠按钮 */}
          {recommendList.length > 0 && !showAllOptions && (
            <button
              onClick={() => setShowAllOptions(true)}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: 'none',
                background: 'rgba(255,255,255,0.03)',
                color: 'rgba(168, 85, 247, 0.85)',
                fontSize: '10px',
                fontWeight: 600,
                textAlign: 'center',
                cursor: 'pointer',
                borderRadius: '6px',
                marginTop: '4px',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
                borderTop: '1px solid rgba(255,255,255,0.04)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
                e.currentTarget.style.color = 'rgba(168, 85, 247, 1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.color = 'rgba(168, 85, 247, 0.85)';
              }}
            >
              🔘 展开所有可用组件
            </button>
          )}
        </div>
      )}

      <input 
        type="file" 
        className="nodrag"
        onMouseDown={(e) => e.stopPropagation()}
        ref={fileInputRef} 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleResourceUpload(file);
        }} 
        style={{ display: 'none' }} 
      />

      <style>{`
        @keyframes slideInPopup {
          from { transform: translateX(-30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInDrawer {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .active-glow {
          border-color: hsl(var(--accent-secondary) / 0.8) !important;
          box-shadow: 0 0 25px hsl(var(--accent-secondary) / 0.3) !important;
          animation: pulse 1.5s infinite alternate;
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.02); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* 避免浏览器默认聚焦框 */
        .react-flow__node:focus,
        .react-flow__node.selected {
          outline: none !important;
        }
        
        /* 高保真点选节点奢华发光与呼吸交互效果 */
        .react-flow__node.selected .glass-panel,
        .react-flow__node.selected .glass-card,
        .react-flow__node.selected > div {
          border-color: rgba(168, 85, 247, 0.95) !important;
          box-shadow: 0 0 25px rgba(168, 85, 247, 0.55), 0 8px 32px rgba(0, 0, 0, 0.4) !important;
          transform: scale(1.01) !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          animation: selectedPulse 2s infinite alternate !important;
        }

        /* 专门适配 PurpleGroupNode 虚线框的点选效果 */
        .react-flow__node.selected > div[style*="dashed"] {
          border-color: rgba(168, 85, 247, 0.95) !important;
          box-shadow: inset 0 0 20px rgba(168, 85, 247, 0.15), 0 0 30px rgba(168, 85, 247, 0.4) !important;
          animation: selectedPulseGroup 2s infinite alternate !important;
          transform: none !important; /* 组容器保持原比例 */
        }

        @keyframes selectedPulse {
          0% {
            box-shadow: 0 0 15px rgba(168, 85, 247, 0.35), 0 8px 32px rgba(0, 0, 0, 0.4) !important;
          }
          100% {
            box-shadow: 0 0 30px rgba(168, 85, 247, 0.65), 0 8px 32px rgba(0, 0, 0, 0.4) !important;
          }
        }

        @keyframes selectedPulseGroup {
          0% {
            box-shadow: inset 0 0 15px rgba(168, 85, 247, 0.1), 0 0 20px rgba(168, 85, 247, 0.2) !important;
          }
          100% {
            box-shadow: inset 0 0 25px rgba(168, 85, 247, 0.25), 0 0 40px rgba(168, 85, 247, 0.5) !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas />
    </ReactFlowProvider>
  );
}
