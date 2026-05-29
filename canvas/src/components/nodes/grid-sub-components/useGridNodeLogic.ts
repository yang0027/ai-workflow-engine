import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useReactFlow, useStore, useNodes } from '@xyflow/react';
import { UploadService } from '../../../services/upload.service';

// ─── 固定尺寸常量 ────────────────────────────────────────────────────────────
export const SLOT_W      = 180;   // 每个槽位宽度（px）
export const SLOT_H      = 200;   // 每个槽位高度（px）
export const CELL_GAP    = 4;     // 槽位之间间距
export const CARD_PAD_H  = 24;    // 卡片左右 padding 合计
export const CARD_PAD_T  = 10;    // 卡片顶部 padding
export const CARD_PAD_B  = 12;    // 卡片底部 padding
export const TOOLBAR_H   = 44;    // 工具栏高度
export const LABEL_H     = 22;    // "分镜格子" 标签高度
export const SECTION_GAP = 8;     // 各区块间间距

// ─── 类型定义 ──────────────────────────────────────────────────────────────
export type AspectRatio = '16:9' | '9:16' | '3:4' | '4:3' | '1:1';
export type GridType    = '2x2' | '3x3' | '4x4' | '5x5' | 'custom';

export interface AspectOption { id: AspectRatio; w: number; h: number; }
export interface GridOption   { id: GridType; label: string; cols: number; rows: number; }

export const ASPECT_RATIOS: AspectOption[] = [
  { id: '16:9', w: 16, h: 9  },
  { id: '9:16', w: 9,  h: 16 },
  { id: '3:4',  w: 3,  h: 4  },
  { id: '4:3',  w: 4,  h: 3  },
  { id: '1:1',  w: 1,  h: 1  },
];

export const GRID_TYPES: GridOption[] = [
  { id: '2x2',    label: '2×2',    cols: 2, rows: 2 },
  { id: '3x3',    label: '3×3',    cols: 3, rows: 3 },
  { id: '4x4',    label: '4×4',    cols: 4, rows: 4 },
  { id: '5x5',    label: '5×5',    cols: 5, rows: 5 },
  { id: 'custom', label: '自定义', cols: 0, rows: 0 },
];

// ─── 节点展开/折叠尺寸计算 ───────────────────────────────────────────────────
export function getNodeDimensions(cols: number, rows: number, collapsed: boolean) {
  if (collapsed) {
    // 折叠态：固定 180×200（单格尺寸）
    return { nodeW: SLOT_W, nodeH: SLOT_H };
  }
  // 展开态：精确计算以放下所有格子
  const canvasW = cols * SLOT_W + (cols - 1) * CELL_GAP;
  const canvasH = rows * SLOT_H + (rows - 1) * CELL_GAP;
  const nodeW   = canvasW + CARD_PAD_H;
  const nodeH   = CARD_PAD_T
                + TOOLBAR_H
                + SECTION_GAP
                + LABEL_H
                + SECTION_GAP
                + canvasH
                + CARD_PAD_B;
  return { nodeW, nodeH };
}

// ─── 辅助 ─────────────────────────────────────────────────────────────────
function getAspectVals(aspect: AspectRatio): AspectOption {
  return ASPECT_RATIOS.find(a => a.id === aspect) ?? { id: '16:9', w: 16, h: 9 };
}

function getGridDims(gridType: GridType, customCols: number, customRows: number) {
  if (gridType === 'custom') {
    return { cols: Math.max(1, Math.min(8, customCols)), rows: Math.max(1, Math.min(8, customRows)) };
  }
  const found = GRID_TYPES.find(g => g.id === gridType);
  return { cols: found?.cols ?? 3, rows: found?.rows ?? 3 };
}

// ─── 主 Hook ──────────────────────────────────────────────────────────────
export function useGridNodeLogic(id: string, data: any) {
  const { setNodes, deleteElements } = useReactFlow();
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [activeSlot, setActiveSlot]       = useState<number | null>(null);
  const [synthesizing, setSynthesizing]   = useState(false);
  const [outputImage, setOutputImage]     = useState<string>(data.outputs?.output || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName]         = useState(data.label || '⊞ 宫格排版合成');

  const isMultiSelected = useStore(s => s.nodes.filter(n => n.selected).length > 1);
  const edges = useStore(s => s.edges);
  const nodes = useNodes();

  // ─── 从 data.inputs 读取配置 ─────────────────────────────────────────
  const gridType:    GridType    = data.inputs?.gridType    || '3x3';
  const aspect:      AspectRatio = data.inputs?.aspect      || '16:9';
  const gap:         number      = data.inputs?.gap         ?? 4;
  const bgColor:     string      = data.inputs?.bgColor     || '#0f172a';
  const borderRadius: number     = data.inputs?.borderRadius ?? 6;
  const outputSize:  number      = data.inputs?.outputSize  || 2048;
  const localImages: Record<number, string> = data.inputs?.localImages || {};
  const customCols:  number      = data.inputs?.customCols  || 3;
  const customRows:  number      = data.inputs?.customRows  || 3;
  const collapsed:   boolean     = data.inputs?.collapsed   ?? false;

  // ─── 派生 ─────────────────────────────────────────────────────────────
  const { cols, rows } = getGridDims(gridType, customCols, customRows);
  const totalSlots     = cols * rows;
  const { nodeW, nodeH } = getNodeDimensions(cols, rows, collapsed);
  // 画布区尺寸（展开态用）
  const canvasW = cols * SLOT_W + (cols - 1) * CELL_GAP;
  const canvasH = rows * SLOT_H + (rows - 1) * CELL_GAP;

  // ─── 同步 label / output ─────────────────────────────────────────────
  useEffect(() => { if (data.label) setLocalName(data.label); }, [data.label]);
  useEffect(() => { setOutputImage(data.outputs?.output || ''); }, [data.outputs?.output]);

  // ─── 节点尺寸自动同步到 ReactFlow store ──────────────────────────────
  useEffect(() => {
    setNodes(nds => nds.map(n => n.id !== id ? n : {
      ...n,
      width:  nodeW,
      height: nodeH,
      style:  { ...((n as any).style || {}), width: nodeW, height: nodeH },
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeW, nodeH, id]);

  // ─── 上游连线图片解析 ─────────────────────────────────────────────────
  const slotImages = useMemo<Record<number, string>>(() => {
    const images: Record<number, string> = { ...localImages };
    edges.filter(e => e.target === id).forEach(edge => {
      const h = edge.targetHandle;
      if (h?.startsWith('img-')) {
        const idx = parseInt(h.replace('img-', ''), 10);
        if (idx >= 0 && idx < totalSlots) {
          const srcNode = nodes.find(n => n.id === edge.source);
          if (srcNode) {
            const o = (srcNode.data?.outputs || {}) as any;
            const i = (srcNode.data?.inputs  || {}) as any;
            const val = o.output || o.image || i.image || '';
            if (val && typeof val === 'string') images[idx] = val;
          }
        }
      }
    });
    return images;
  }, [edges, nodes, id, localImages, totalSlots]);

  // ─── 通用字段修改器 ──────────────────────────────────────────────────
  const handleInputChange = useCallback((field: string, val: any) => {
    setNodes(nds => nds.map(n => n.id !== id ? n : {
      ...n,
      data: { ...n.data, inputs: { ...(n.data as any)?.inputs, [field]: val } },
    }));
  }, [id, setNodes]);

  const handleSaveName = useCallback(() => {
    setIsEditingName(false);
    if (localName.trim()) {
      setNodes(nds => nds.map(n => n.id !== id ? n : { ...n, data: { ...n.data, label: localName.trim() } }));
    }
  }, [id, localName, setNodes]);

  // ─── 槽位点击 / 文件上传 ─────────────────────────────────────────────
  const handleSlotClick = useCallback((slotIdx: number) => {
    setActiveSlot(slotIdx);
    setTimeout(() => fileInputRef.current?.click(), 50);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeSlot === null) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const newImages = { ...localImages, [activeSlot]: reader.result };
      // 上传图片时：更新 localImages，同时如果处于折叠态则自动展开
      setNodes(nds => nds.map(n => {
        if (n.id !== id) return n;
        const currentCollapsed = (n.data as any)?.inputs?.collapsed ?? false;
        const newInputs = {
          ...(n.data as any)?.inputs,
          localImages: newImages,
          collapsed: false,  // 自动展开
        };
        const { nodeW: eW, nodeH: eH } = getNodeDimensions(cols, rows, false);
        return {
          ...n,
          width:  currentCollapsed ? eW : n.width,
          height: currentCollapsed ? eH : n.height,
          style:  currentCollapsed ? { ...((n as any).style || {}), width: eW, height: eH } : (n as any).style,
          data: { ...n.data, inputs: newInputs },
        };
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [activeSlot, localImages, id, cols, rows, setNodes]);

  const handleClearSlot = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const updated = { ...localImages };
    delete updated[idx];
    handleInputChange('localImages', updated);
  }, [localImages, handleInputChange]);

  const handleClearAll = useCallback(() => {
    handleInputChange('localImages', {});
    setOutputImage('');
    setNodes(nds => nds.map(n => n.id !== id ? n : { ...n, data: { ...n.data, outputs: {} } }));
  }, [id, handleInputChange, setNodes]);

  // ─── 折叠/展开（同时更新节点尺寸）────────────────────────────────────
  const handleToggleCollapse = useCallback(() => {
    const newCollapsed = !collapsed;
    const { nodeW: newW, nodeH: newH } = getNodeDimensions(cols, rows, newCollapsed);
    setNodes(nds => nds.map(n => n.id !== id ? n : {
      ...n,
      width:  newW,
      height: newH,
      style:  { ...((n as any).style || {}), width: newW, height: newH },
      data: { ...n.data, inputs: { ...(n.data as any)?.inputs, collapsed: newCollapsed } },
    }));
  }, [collapsed, cols, rows, id, setNodes]);

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] });
  }, [id, deleteElements]);

  const handleDownloadOutput = useCallback(() => {
    if (!outputImage) return;
    const a = document.createElement('a');
    a.href = outputImage;
    a.download = `toonflow-grid-${id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [id, outputImage]);

  // ─── 高清像素拼接合成 ─────────────────────────────────────────────────
  const handleCompose = useCallback(async () => {
    setSynthesizing(true);
    try {
      const { w: rw, h: rh } = getAspectVals(aspect);
      const outW = outputSize;
      const outH = Math.round(outputSize * rh / rw);

      const canvas = document.createElement('canvas');
      canvas.width  = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 上下文初始化失败');

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, outW, outH);

      const spacing = gap * (outW / 512);
      const slotW   = (outW - spacing * (cols + 1)) / cols;
      const slotH   = (outH - spacing * (rows + 1)) / rows;

      await Promise.all(
        Array.from({ length: totalSlots }).map(async (_, idx) => {
          const src = slotImages[idx];
          if (!src) return;
          let resolved = src;
          if (src.startsWith('db://')) {
            const getMedia = (window as any).getMediaFromDB;
            if (typeof getMedia === 'function') {
              try { const b = await getMedia(src.replace('db://', '')); if (b) resolved = b; } catch {}
            }
          }
          return new Promise<void>(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const cIdx = idx % cols;
              const rIdx = Math.floor(idx / cols);
              const x = spacing + cIdx * (slotW + spacing);
              const y = spacing + rIdx * (slotH + spacing);
              ctx.save();
              if (borderRadius > 0) {
                const r = borderRadius * (outW / 512);
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.arcTo(x + slotW, y, x + slotW, y + slotH, r);
                ctx.arcTo(x + slotW, y + slotH, x, y + slotH, r);
                ctx.arcTo(x, y + slotH, x, y, r);
                ctx.arcTo(x, y, x + slotW, y, r);
                ctx.closePath();
                ctx.clip();
              }
              const iR = img.width / img.height, sR = slotW / slotH;
              let sW = img.width, sH = img.height, sx = 0, sy = 0;
              if (iR > sR) { sW = img.height * sR; sx = (img.width - sW) / 2; }
              else         { sH = img.width  / sR; sy = (img.height - sH) / 2; }
              ctx.drawImage(img, sx, sy, sW, sH, x, y, slotW, slotH);
              ctx.restore();
              resolve();
            };
            img.onerror = () => resolve();
            img.src = resolved;
          });
        })
      );

      const composed = canvas.toDataURL('image/jpeg', 0.92);
      const finalUrl = await UploadService.uploadBase64(composed, `toonflow-grid-${id}-${Date.now()}.jpg`, 'image');
      setOutputImage(finalUrl);
      setNodes(nds => nds.map(n => n.id !== id ? n : { ...n, data: { ...n.data, outputs: { output: finalUrl } } }));
      window.dispatchEvent(new CustomEvent('add-success-log', {
        detail: { nodeId: id, nodeName: localName, model: `宫格合成 [${gridType}·${aspect}]`, errorMsg: `✅ ${totalSlots} 格拼合成功，已存盘至 MinIO。` }
      }));
    } catch (e: any) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('add-failure-log', {
        detail: { nodeId: id, nodeName: localName, model: `宫格合成 [${gridType}]`, errorMsg: e.message || '合成失败' }
      }));
      alert(`❌ 合成失败: ${e.message}`);
    } finally {
      setSynthesizing(false);
    }
  }, [aspect, bgColor, borderRadius, cols, rows, gap, gridType, id, localName, outputSize, slotImages, totalSlots, setNodes]);

  return {
    gridType, aspect, gap, bgColor, borderRadius, outputSize,
    localImages, customCols, customRows, collapsed,
    cols, rows, totalSlots, canvasW, canvasH, nodeW, nodeH,
    synthesizing, outputImage, isEditingName, localName, slotImages, isMultiSelected,
    fileInputRef,
    handleInputChange, handleSaveName, handleSlotClick, handleFileChange,
    handleClearSlot, handleClearAll, handleDelete, handleToggleCollapse,
    handleDownloadOutput, handleCompose,
    setIsEditingName, setLocalName,
  };
}
