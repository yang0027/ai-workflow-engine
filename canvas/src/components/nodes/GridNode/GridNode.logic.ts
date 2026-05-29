/**
 * GridNode.logic.ts
 * 仅负责：业务逻辑 hook（数据处理、文件上传、Canvas 合成、状态管理）
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useReactFlow, useStore, useNodes } from '@xyflow/react';
import { UploadService } from '../../../services/upload.service';
import {
  GridType, AspectRatio, ASPECT_RATIOS,
  COLLAPSED_W, COLLAPSED_H,
  calcCanvasW, calcCanvasH, calcNodeW, calcNodeH,
  getGridDims,
} from './GridNode.config';

export function useGridNodeLogic(id: string, data: any) {
  const { setNodes, deleteElements } = useReactFlow();
  const fileInputRef               = useRef<HTMLInputElement>(null);
  const [activeSlot, setActiveSlot]     = useState<number | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [outputImage, setOutputImage]   = useState<string>(data.outputs?.output || '');

  const isMultiSelected = useStore(s => s.nodes.filter(n => n.selected).length > 1);
  const edges = useStore(s => s.edges);
  const nodes = useNodes();

  // ─── 从 data.inputs 读取配置 ───────────────────────────────────────────────
  const gridType:     GridType    = data.inputs?.gridType    || '3x3';
  const aspect:       AspectRatio = data.inputs?.aspect      || '1:1';
  const gap:          number      = data.inputs?.gap         ?? 4;
  const bgColor:      string      = data.inputs?.bgColor     || '#0f172a';
  const borderRadius: number      = data.inputs?.borderRadius ?? 6;
  const outputSize:   number      = data.inputs?.outputSize  || 2048;
  const localImages:  Record<number, string> = data.inputs?.localImages || {};
  const customCols:   number      = data.inputs?.customCols  || 3;
  const customRows:   number      = data.inputs?.customRows  || 3;
  const collapsed:    boolean     = data.inputs?.collapsed   ?? false;

  // ─── 派生尺寸 ─────────────────────────────────────────────────────────────
  const { cols, rows } = getGridDims(gridType, customCols, customRows);
  const totalSlots = cols * rows;
  const canvasW = calcCanvasW(cols);
  const canvasH = calcCanvasH(rows);
  const nodeW   = collapsed ? COLLAPSED_W : calcNodeW(cols);
  const nodeH   = collapsed ? COLLAPSED_H : calcNodeH(rows);

  // ─── 同步 output ──────────────────────────────────────────────────────────
  useEffect(() => {
    setOutputImage(data.outputs?.output || '');
  }, [data.outputs?.output]);

  // ─── 节点尺寸同步到 ReactFlow store ──────────────────────────────────────
  useEffect(() => {
    setNodes(nds => nds.map(n => n.id !== id ? n : {
      ...n,
      width:  nodeW,
      height: nodeH,
      style:  { ...((n as any).style || {}), width: nodeW, height: nodeH },
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeW, nodeH, id]);

  // ─── 解析上游连线图片 ─────────────────────────────────────────────────────
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

  // ─── 通用字段修改 ─────────────────────────────────────────────────────────
  const handleInputChange = useCallback((field: string, val: any) => {
    setNodes(nds => nds.map(n => n.id !== id ? n : {
      ...n,
      data: { ...n.data, inputs: { ...(n.data as any)?.inputs, [field]: val } },
    }));
  }, [id, setNodes]);

  // ─── 槽位点击 → 触发文件选择 ─────────────────────────────────────────────
  const handleSlotClick = useCallback((slotIdx: number) => {
    setActiveSlot(slotIdx);
    setTimeout(() => fileInputRef.current?.click(), 50);
  }, []);

  // ─── 文件上传 → base64 → 上传 MinIO → 写入 localImages，折叠态自动展开 ────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeSlot === null) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      const base64 = reader.result;
      
      try {
        // 与 UploadNode 逻辑完全一致，直接上传至 MinIO，获取高性能、无延迟的 MinIO URL / 物理灾备 Blob URL
        const finalUrl = await UploadService.uploadBase64(base64, file.name, 'image');
        
        const newImages = { ...localImages, [activeSlot]: finalUrl };
        setNodes(nds => nds.map(n => {
          if (n.id !== id) return n;
          const wasCollapsed = (n.data as any)?.inputs?.collapsed ?? false;
          const eW = calcNodeW(cols);
          const eH = calcNodeH(rows);
          return {
            ...n,
            width:  wasCollapsed ? eW : n.width,
            height: wasCollapsed ? eH : n.height,
            style:  wasCollapsed
              ? { ...((n as any).style || {}), width: eW, height: eH }
              : (n as any).style,
            data: {
              ...n.data,
              inputs: { ...(n.data as any)?.inputs, localImages: newImages, collapsed: false },
            },
          };
        }));
      } catch (err: any) {
        console.error('[GridNode] 槽位上传图片失败:', err);
        alert('槽位上传图片失败！');
      }
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
    setNodes(nds => nds.map(n => n.id !== id ? n : {
      ...n,
      data: { ...n.data, outputs: {} },
    }));
  }, [id, handleInputChange, setNodes]);

  // ─── 折叠/展开（同步节点尺寸） ─────────────────────────────────────────
  const handleToggleCollapse = useCallback(() => {
    const next = !collapsed;
    const nW = next ? COLLAPSED_W : calcNodeW(cols);
    const nH = next ? COLLAPSED_H : calcNodeH(rows);
    setNodes(nds => nds.map(n => n.id !== id ? n : {
      ...n,
      width:  nW,
      height: nH,
      style:  { ...((n as any).style || {}), width: nW, height: nH },
      data: {
        ...n.data,
        inputs: { ...(n.data as any)?.inputs, collapsed: next },
      },
    }));
  }, [collapsed, cols, rows, id, setNodes]);

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] });
  }, [id, deleteElements]);

  const handleDownloadOutput = useCallback(() => {
    if (!outputImage) return;
    const a = document.createElement('a');
    a.href = outputImage;
    a.download = `grid-composed-${id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [id, outputImage]);

  // ─── 高清像素拼接合成 ─────────────────────────────────────────────────────
  const handleCompose = useCallback(async () => {
    setSynthesizing(true);
    try {
      const ar  = ASPECT_RATIOS.find(a => a.id === aspect) ?? { w: 1, h: 1 };
      const outW = outputSize;
      const outH = Math.round(outputSize * ar.h / ar.w);
      const canvas = document.createElement('canvas');
      canvas.width  = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context 初始化失败');

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, outW, outH);

      const sp = gap * (outW / 512);
      const sW = (outW - sp * (cols + 1)) / cols;
      const sH = (outH - sp * (rows + 1)) / rows;

      await Promise.all(
        Array.from({ length: totalSlots }).map(async (_, idx) => {
          const src = slotImages[idx];
          if (!src) return;
          return new Promise<void>(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const cx = idx % cols;
              const ry = Math.floor(idx / cols);
              const x  = sp + cx * (sW + sp);
              const y  = sp + ry * (sH + sp);
              ctx.save();
              if (borderRadius > 0) {
                const r = borderRadius * (outW / 512);
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.arcTo(x + sW, y, x + sW, y + sH, r);
                ctx.arcTo(x + sW, y + sH, x, y + sH, r);
                ctx.arcTo(x, y + sH, x, y, r);
                ctx.arcTo(x, y, x + sW, y, r);
                ctx.closePath();
                ctx.clip();
              }
              const iR = img.width / img.height;
              const sR = sW / sH;
              let sw = img.width, sh = img.height, sx = 0, sy = 0;
              if (iR > sR) { sw = img.height * sR; sx = (img.width  - sw) / 2; }
              else         { sh = img.width  / sR; sy = (img.height - sh) / 2; }
              ctx.drawImage(img, sx, sy, sw, sh, x, y, sW, sH);
              ctx.restore();
              resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
          });
        })
      );

      const composed = canvas.toDataURL('image/jpeg', 0.92);
      const finalUrl = await UploadService.uploadBase64(
        composed,
        `grid-${id}-${Date.now()}.jpg`,
        'image',
      );
      setOutputImage(finalUrl);
      setNodes(nds => nds.map(n => n.id !== id ? n : {
        ...n,
        data: { ...n.data, outputs: { output: finalUrl } },
      }));
      window.dispatchEvent(new CustomEvent('add-success-log', {
        detail: {
          nodeId: id,
          nodeName: '⊞ 宫格合成',
          model: `${gridType}·${aspect}`,
          errorMsg: `✅ ${totalSlots} 格合成成功，已存盘 MinIO`,
        },
      }));
    } catch (e: any) {
      console.error('[GridNode] compose error:', e);
      window.dispatchEvent(new CustomEvent('add-failure-log', {
        detail: {
          nodeId: id,
          nodeName: '⊞ 宫格合成',
          model: gridType,
          errorMsg: e.message || '合成失败',
        },
      }));
    } finally {
      setSynthesizing(false);
    }
  }, [
    aspect, bgColor, borderRadius, cols, rows,
    gap, gridType, id, outputSize, slotImages, totalSlots, setNodes,
  ]);

  return {
    // 配置字段
    gridType, aspect, gap, bgColor, borderRadius, outputSize,
    localImages, customCols, customRows, collapsed,
    // 尺寸
    cols, rows, totalSlots, canvasW, canvasH, nodeW, nodeH,
    // 状态
    synthesizing, outputImage, isMultiSelected, slotImages,
    fileInputRef,
    // 操作
    handleInputChange,
    handleSlotClick, handleFileChange,
    handleClearSlot, handleClearAll,
    handleDelete, handleToggleCollapse,
    handleDownloadOutput, handleCompose,
  };
}
