import React, { useState, useEffect, useRef } from 'react';

interface ImageEditorModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onSave: (result: {
    mode: 'crop' | 'mask' | 'brush' | 'grid';
    dataUrl: string;
    maskDataUrl?: string;
    gridImages?: string[];
  }) => void;
  initialTab?: 'crop' | 'mask' | 'brush' | 'grid';
}

export default function ImageEditorModal({ isOpen, imageUrl, onClose, onSave, initialTab }: ImageEditorModalProps) {
  const [activeTab, setActiveTab] = useState<'crop' | 'mask' | 'brush' | 'grid'>('crop');

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [loading, setLoading] = useState(true);

  // Canvas Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  // 图像加载状态
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // 1. 裁剪模式配置
  const [cropBox, setCropBox] = useState({ x: 20, y: 20, width: 200, height: 150 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [isResizingCrop, setIsResizingCrop] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });

  // 2. 遮罩 / 画笔模式配置
  const [brushSize, setBrushSize] = useState(30);
  const [brushColor, setBrushColor] = useState('#ff2d55'); // 画笔颜色
  const [brushType, setBrushType] = useState<'free' | 'rect' | 'circle'>('free');
  const [lines, setLines] = useState<any[]>([]); // 轨迹历史
  const [undoStack, setUndoStack] = useState<any[]>([]); // 撤销栈
  const isDrawingRef = useRef(false);
  const activeLineRef = useRef<any>(null);

  // 3. 宫格配置
  const [gridCols, setGridCols] = useState(2);
  const [gridRows, setGridRows] = useState(2);
  const [gridGap, setGridGap] = useState(0); // 默认 0 像素切割线宽度

  // 初始化并加载图片
  useEffect(() => {
    if (!isOpen || !imageUrl) return;
    setLoading(true);
    setLines([]);
    setUndoStack([]);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageEl(img);
      
      // 根据容器大小等比缩放 Canvas，限制最大宽高
      const maxW = Math.min(800, window.innerWidth - 120);
      const maxH = Math.min(500, window.innerHeight - 260);
      let w = img.width;
      let h = img.height;

      const ratio = w / h;
      if (w > maxW) {
        w = maxW;
        h = w / ratio;
      }
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }

      setCanvasSize({ width: w, height: h });
      setCropBox({
        x: Math.round(w * 0.15),
        y: Math.round(h * 0.15),
        width: Math.round(w * 0.7),
        height: Math.round(h * 0.7)
      });
      setLoading(false);
    };
    img.src = imageUrl.startsWith('db://') ? imageUrl : imageUrl; // 支持 Base64 或是 db 索引，这里由 resolvedMedia 接管
    // 降级：如果以 db:// 开头，拉取真实的 base64
    if (imageUrl.startsWith('db://')) {
      const mediaId = imageUrl.replace('db://', '');
      const getMedia = (window as any).getMediaFromDB;
      if (typeof getMedia === 'function') {
        getMedia(mediaId).then((b64: string) => {
          if (b64) img.src = b64;
        });
      }
    }
  }, [isOpen, imageUrl]);

  // 绘制底图以及裁剪虚线/阴影层
  useEffect(() => {
    if (!bgCanvasRef.current || !imageEl || loading) return;
    const canvas = bgCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布并绘制底层背景图片
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageEl, 0, 0, canvas.width, canvas.height);

    if (activeTab === 'crop') {
      // 1. 绘制半透明黑色阴影背景覆盖在裁剪框之外
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. 清空并镂空裁剪框内部以展示原图亮色
      ctx.clearRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
      ctx.drawImage(
        imageEl,
        (cropBox.x / canvas.width) * imageEl.width,
        (cropBox.y / canvas.height) * imageEl.height,
        (cropBox.width / canvas.width) * imageEl.width,
        (cropBox.height / canvas.height) * imageEl.height,
        cropBox.x,
        cropBox.y,
        cropBox.width,
        cropBox.height
      );

      // 3. 绘制高拟态发光白色裁剪边框和虚线十字定位线
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height);

      // 四角装饰手柄
      ctx.fillStyle = '#fff';
      const sz = 6;
      ctx.fillRect(cropBox.x - sz/2, cropBox.y - sz/2, sz, sz);
      ctx.fillRect(cropBox.x + cropBox.width - sz/2, cropBox.y - sz/2, sz, sz);
      ctx.fillRect(cropBox.x - sz/2, cropBox.y + cropBox.height - sz/2, sz, sz);
      ctx.fillRect(cropBox.x + cropBox.width - sz/2, cropBox.y + cropBox.height - sz/2, sz, sz);
    } else if (activeTab === 'grid') {
      if (gridGap === 0) {
        // 绘制切分单线预览
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);

        // 垂直线
        for (let i = 1; i < gridCols; i++) {
          const x = (canvas.width / gridCols) * i;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }

        // 水平线
        for (let i = 1; i < gridRows; i++) {
          const y = (canvas.height / gridRows) * i;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
        ctx.setLineDash([]); // 还原
      } else {
        // 绘制带宽度的发光半透切割激光线预览
        const scaleX = canvas.width / imageEl.width;
        const scaleY = canvas.height / imageEl.height;
        const canvasGapX = gridGap * scaleX;
        const canvasGapY = gridGap * scaleY;
        
        const canvasSubW = (canvas.width - (gridCols - 1) * canvasGapX) / gridCols;
        const canvasSubH = (canvas.height - (gridRows - 1) * canvasGapY) / gridRows;

        ctx.fillStyle = 'rgba(244, 63, 94, 0.25)'; // 切割线填充，极具科技感与视觉张力
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
        ctx.lineWidth = 1;

        // 垂直切割带
        for (let i = 1; i < gridCols; i++) {
          const xStart = i * canvasSubW + (i - 1) * canvasGapX;
          ctx.fillRect(xStart, 0, canvasGapX, canvas.height);
          
          ctx.beginPath();
          ctx.moveTo(xStart, 0);
          ctx.lineTo(xStart, canvas.height);
          ctx.moveTo(xStart + canvasGapX, 0);
          ctx.lineTo(xStart + canvasGapX, canvas.height);
          ctx.stroke();
        }

        // 水平切割带
        for (let i = 1; i < gridRows; i++) {
          const yStart = i * canvasSubH + (i - 1) * canvasGapY;
          ctx.fillRect(0, yStart, canvas.width, canvasGapY);
          
          ctx.beginPath();
          ctx.moveTo(0, yStart);
          ctx.lineTo(canvas.width, yStart);
          ctx.moveTo(0, yStart + canvasGapY);
          ctx.lineTo(canvas.width, yStart + canvasGapY);
          ctx.stroke();
        }
      }
    }
  }, [activeTab, imageEl, canvasSize, cropBox, gridCols, gridRows, gridGap, loading]);

  // 绘制涂抹/画笔层
  useEffect(() => {
    if (!drawCanvasRef.current || loading) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (activeTab === 'mask' || activeTab === 'brush') {
      // 渲染所有的笔划轨迹
      lines.forEach((line) => {
        ctx.strokeStyle = line.color;
        ctx.fillStyle = line.color;
        ctx.lineWidth = line.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (line.type === 'free') {
          if (line.points.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(line.points[0].x, line.points[0].y);
          for (let i = 1; i < line.points.length; i++) {
            ctx.lineTo(line.points[i].x, line.points[i].y);
          }
          ctx.stroke();
        } else if (line.type === 'rect') {
          ctx.beginPath();
          ctx.strokeRect(line.start.x, line.start.y, line.end.x - line.start.x, line.end.y - line.start.y);
        } else if (line.type === 'circle') {
          ctx.beginPath();
          const rx = Math.abs(line.end.x - line.start.x) / 2;
          const ry = Math.abs(line.end.y - line.start.y) / 2;
          const cx = Math.min(line.start.x, line.end.x) + rx;
          const cy = Math.min(line.start.y, line.end.y) + ry;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          ctx.stroke();
        }
      });
    }
  }, [activeTab, lines, loading]);

  // 鼠标交互控制 - 裁剪拖动/画笔涂抹
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (loading) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTab === 'crop') {
      // 检查是否点击在右下角 resize 手柄
      const resizeHandleSize = 16;
      const rx = cropBox.x + cropBox.width;
      const ry = cropBox.y + cropBox.height;

      if (Math.abs(x - rx) < resizeHandleSize && Math.abs(y - ry) < resizeHandleSize) {
        setIsResizingCrop(true);
      } else if (x > cropBox.x && x < cropBox.x + cropBox.width && y > cropBox.y && y < cropBox.y + cropBox.height) {
        setIsDraggingCrop(true);
        dragStartOffset.current = { x: x - cropBox.x, y: y - cropBox.y };
      }
    } else if (activeTab === 'mask' || activeTab === 'brush') {
      isDrawingRef.current = true;
      const color = activeTab === 'mask' ? 'rgba(255, 255, 255, 0.75)' : brushColor; // 遮罩固定高光半透白，画笔取调色盘色

      if (brushType === 'free') {
        activeLineRef.current = {
          type: 'free',
          color,
          size: brushSize,
          points: [{ x, y }]
        };
      } else {
        activeLineRef.current = {
          type: brushType,
          color,
          size: brushSize,
          start: { x, y },
          end: { x, y }
        };
      }
      setLines((prev) => [...prev, activeLineRef.current]);
      setUndoStack([]); // 清空重做栈
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (loading) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTab === 'crop') {
      if (isResizingCrop) {
        const newW = Math.max(40, Math.min(canvas.width - cropBox.x, x - cropBox.x));
        const newH = Math.max(40, Math.min(canvas.height - cropBox.y, y - cropBox.y));
        setCropBox((prev) => ({ ...prev, width: newW, height: newH }));
      } else if (isDraggingCrop) {
        const newX = Math.max(0, Math.min(canvas.width - cropBox.width, x - dragStartOffset.current.x));
        const newY = Math.max(0, Math.min(canvas.height - cropBox.height, y - dragStartOffset.current.y));
        setCropBox((prev) => ({ ...prev, x: newX, y: newY }));
      }
    } else if (activeTab === 'mask' || activeTab === 'brush') {
      if (!isDrawingRef.current || !activeLineRef.current) return;

      if (activeLineRef.current.type === 'free') {
        activeLineRef.current.points.push({ x, y });
        setLines((prev) => [...prev.slice(0, -1), { ...activeLineRef.current }]);
      } else {
        activeLineRef.current.end = { x, y };
        setLines((prev) => [...prev.slice(0, -1), { ...activeLineRef.current }]);
      }
    }
  };

  const handlePointerUp = () => {
    setIsDraggingCrop(false);
    setIsResizingCrop(false);
    isDrawingRef.current = false;
    activeLineRef.current = null;
  };

  // 历史撤销与清空
  const handleUndo = () => {
    if (lines.length === 0) return;
    const last = lines[lines.length - 1];
    setUndoStack((prev) => [...prev, last]);
    setLines((prev) => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setLines((prev) => [...prev, last]);
  };

  const handleClear = () => {
    setLines([]);
    setUndoStack([]);
  };

  // 保存与应用生成
  const handleApply = async () => {
    if (!imageEl) return;
    
    // 离屏合成与渲染 Canvas
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    if (activeTab === 'crop') {
      // 1. 裁剪模式：根据图片原图比例，等比截取
      const ratioX = imageEl.width / canvasSize.width;
      const ratioY = imageEl.height / canvasSize.height;

      offCanvas.width = cropBox.width * ratioX;
      offCanvas.height = cropBox.height * ratioY;

      offCtx.drawImage(
        imageEl,
        cropBox.x * ratioX,
        cropBox.y * ratioY,
        cropBox.width * ratioX,
        cropBox.height * ratioY,
        0,
        0,
        offCanvas.width,
        offCanvas.height
      );

      const croppedUrl = offCanvas.toDataURL('image/png');
      onSave({
        mode: 'crop',
        dataUrl: croppedUrl
      });
    } 
    else if (activeTab === 'mask') {
      // 2. 遮罩模式：同时输出“黑白 Inpaint 遮罩图”（1:1 对齐原图）与“无损合成展示图”
      // 遮罩图：背景全黑，涂鸦轨迹渲染为纯白
      const maskCanvas = document.createElement('canvas');
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) return;

      maskCanvas.width = imageEl.width;
      maskCanvas.height = imageEl.height;

      // 填充黑底
      maskCtx.fillStyle = '#000000';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

      const ratioX = imageEl.width / canvasSize.width;
      const ratioY = imageEl.height / canvasSize.height;

      // 绘制所有涂鸦（使用纯白色）
      lines.forEach((line) => {
        maskCtx.strokeStyle = '#ffffff';
        maskCtx.fillStyle = '#ffffff';
        maskCtx.lineWidth = line.size * ratioX;
        maskCtx.lineCap = 'round';
        maskCtx.lineJoin = 'round';

        if (line.type === 'free') {
          if (line.points.length < 2) return;
          maskCtx.beginPath();
          maskCtx.moveTo(line.points[0].x * ratioX, line.points[0].y * ratioY);
          for (let i = 1; i < line.points.length; i++) {
            maskCtx.lineTo(line.points[i].x * ratioX, line.points[i].y * ratioY);
          }
          maskCtx.stroke();
        } else if (line.type === 'rect') {
          maskCtx.beginPath();
          maskCtx.strokeRect(
            line.start.x * ratioX,
            line.start.y * ratioY,
            (line.end.x - line.start.x) * ratioX,
            (line.end.y - line.start.y) * ratioY
          );
        } else if (line.type === 'circle') {
          maskCtx.beginPath();
          const rx = Math.abs(line.end.x - line.start.x) / 2;
          const ry = Math.abs(line.end.y - line.start.y) / 2;
          const cx = Math.min(line.start.x, line.end.x) + rx;
          const cy = Math.min(line.start.y, line.end.y) + ry;
          maskCtx.ellipse(cx * ratioX, cy * ratioY, rx * ratioX, ry * ratioY, 0, 0, 2 * Math.PI);
          maskCtx.stroke();
        }
      });

      const maskUrl = maskCanvas.toDataURL('image/png');

      // 合成预览图供节点展示（原图叠加一层半透红以突出编辑区）
      offCanvas.width = imageEl.width;
      offCanvas.height = imageEl.height;
      offCtx.drawImage(imageEl, 0, 0, offCanvas.width, offCanvas.height);
      offCtx.globalAlpha = 0.45;
      offCtx.drawImage(maskCanvas, 0, 0, offCanvas.width, offCanvas.height); // 直接叠加

      const combinedUrl = offCanvas.toDataURL('image/png');

      onSave({
        mode: 'mask',
        dataUrl: combinedUrl,
        maskDataUrl: maskUrl
      });
    } 
    else if (activeTab === 'brush') {
      // 3. 画笔标注：将涂鸦矢量图无损盖在原图之上
      offCanvas.width = imageEl.width;
      offCanvas.height = imageEl.height;
      offCtx.drawImage(imageEl, 0, 0, offCanvas.width, offCanvas.height);

      const ratioX = imageEl.width / canvasSize.width;
      const ratioY = imageEl.height / canvasSize.height;

      lines.forEach((line) => {
        offCtx.strokeStyle = line.color;
        offCtx.fillStyle = line.color;
        offCtx.lineWidth = line.size * ratioX;
        offCtx.lineCap = 'round';
        offCtx.lineJoin = 'round';

        if (line.type === 'free') {
          if (line.points.length < 2) return;
          offCtx.beginPath();
          offCtx.moveTo(line.points[0].x * ratioX, line.points[0].y * ratioY);
          for (let i = 1; i < line.points.length; i++) {
            offCtx.lineTo(line.points[i].x * ratioX, line.points[i].y * ratioY);
          }
          offCtx.stroke();
        } else if (line.type === 'rect') {
          offCtx.beginPath();
          offCtx.strokeRect(
            line.start.x * ratioX,
            line.start.y * ratioY,
            (line.end.x - line.start.x) * ratioX,
            (line.end.y - line.start.y) * ratioY
          );
        } else if (line.type === 'circle') {
          offCtx.beginPath();
          const rx = Math.abs(line.end.x - line.start.x) / 2;
          const ry = Math.abs(line.end.y - line.start.y) / 2;
          const cx = Math.min(line.start.x, line.end.x) + rx;
          const cy = Math.min(line.start.y, line.end.y) + ry;
          offCtx.ellipse(cx * ratioX, cy * ratioY, rx * ratioX, ry * ratioY, 0, 0, 2 * Math.PI);
          offCtx.stroke();
        }
      });

      const annotatedUrl = offCanvas.toDataURL('image/png');
      onSave({
        mode: 'brush',
        dataUrl: annotatedUrl
      });
    } 
    else if (activeTab === 'grid') {
      // 4. 宫格物理切分：循环输出 M * N 图像 DataUrl 数组，扣除切割线宽度
      const subImages: string[] = [];
      const subW = (imageEl.width - (gridCols - 1) * gridGap) / gridCols;
      const subH = (imageEl.height - (gridRows - 1) * gridGap) / gridRows;

      if (subW <= 0 || subH <= 0) {
        alert('切割线宽度 (Gap) 过大，导致子图尺寸小于等于 0 像素！请调小切割线宽度。');
        return;
      }

      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          offCanvas.width = subW;
          offCanvas.height = subH;
          offCtx.clearRect(0, 0, subW, subH);
          
          const sx = c * (subW + gridGap);
          const sy = r * (subH + gridGap);

          offCtx.drawImage(
            imageEl,
            sx,
            sy,
            subW,
            subH,
            0,
            0,
            subW,
            subH
          );
          subImages.push(offCanvas.toDataURL('image/png'));
        }
      }

      onSave({
        mode: 'grid',
        dataUrl: imageUrl, // grid 不修改原图本身的 inputs
        gridImages: subImages
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: 'var(--font-sans)',
        userSelect: 'none'
      }}
    >
      <div
        style={{
          width: 'min(920px, 95vw)',
          background: 'rgba(17, 24, 39, 0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.65), 0 0 40px rgba(168, 85, 247, 0.12)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header 行 */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🎨</span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
              Toonflow 高精智能图像工作坊
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          >
            ×
          </button>
        </div>

        {/* Tab 导航横幅 */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(10, 15, 26, 0.9)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            padding: '4px 20px',
            gap: '12px'
          }}
        >
          {[
            { id: 'crop', label: '✂️ 自由裁剪', desc: '缩放选区裁剪画面' },
            { id: 'mask', label: '🖌️ 重绘遮罩', desc: '涂抹白区局部重绘 Inpaint' },
            { id: 'brush', label: '🎨 画笔批注', desc: '手绘备注与序号标记' },
            { id: 'grid', label: '🧩 宫格切分', desc: '矩阵等距分割图像' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: activeTab === tab.id ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid rgba(168, 85, 247, 0.85)' : '2px solid transparent',
                padding: '10px 14px',
                color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.45)',
                fontSize: '12.5px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '2px'
              }}
            >
              <span>{tab.label}</span>
              <span style={{ fontSize: '8.5px', opacity: 0.6, fontWeight: 'normal' }}>{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* 工作区 - 居中 Canvas 物理面板 */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            height: '480px',
            background: '#04060b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: '20px',
            overflow: 'hidden'
          }}
        >
          {loading ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span>🔄 正在智能载入高精图像纹理...</span>
            </div>
          ) : (
            <div
              style={{
                position: 'relative',
                width: `${canvasSize.width}px`,
                height: `${canvasSize.height}px`,
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
              }}
            >
              {/* 底图 Canvas (绘制背景及裁剪边框等) */}
              <canvas
                ref={bgCanvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '8px',
                  pointerEvents: activeTab === 'crop' || activeTab === 'grid' ? 'auto' : 'none',
                  zIndex: 2
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />

              {/* 涂鸦/轨迹绘制 Canvas */}
              <canvas
                ref={drawCanvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '8px',
                  pointerEvents: activeTab === 'mask' || activeTab === 'brush' ? 'auto' : 'none',
                  zIndex: 3
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            </div>
          )}
        </div>

        {/* 底部控制微调工具栏 */}
        <div
          style={{
            padding: '14px 20px',
            background: 'rgba(10, 15, 26, 0.95)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          {/* 左侧：根据 Tab 展示微调器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {(activeTab === 'mask' || activeTab === 'brush') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>笔刷粗细:</span>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    style={{ width: '100px', accentColor: 'rgba(168, 85, 247, 1)' }}
                  />
                  <span style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold' }}>{brushSize}px</span>
                </div>

                {activeTab === 'brush' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>画笔颜色:</span>
                      <input
                        type="color"
                        value={brushColor}
                        onChange={(e) => setBrushColor(e.target.value)}
                        style={{ width: '24px', height: '24px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', padding: '2px', borderRadius: '6px' }}>
                      {[
                        { id: 'free', label: '✍️ 自由画笔' },
                        { id: 'rect', label: '█ 矩形标注' },
                        { id: 'circle', label: '○ 圆形圈画' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setBrushType(t.id as any)}
                          style={{
                            background: brushType === t.id ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            color: brushType === t.id ? '#fff' : 'rgba(255,255,255,0.4)',
                            fontSize: '9.5px',
                            padding: '3px 8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* 撤销重做按钮 */}
                <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '10px' }}>
                  <button
                    onClick={handleUndo}
                    disabled={lines.length === 0}
                    style={{ background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '4px', color: lines.length === 0 ? 'rgba(255,255,255,0.2)' : '#fff', padding: '4px 10px', fontSize: '10px', cursor: lines.length === 0 ? 'not-allowed' : 'pointer' }}
                    title="撤销"
                  >
                    ↩ 撤销
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={undoStack.length === 0}
                    style={{ background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '4px', color: undoStack.length === 0 ? 'rgba(255,255,255,0.2)' : '#fff', padding: '4px 10px', fontSize: '10px', cursor: undoStack.length === 0 ? 'not-allowed' : 'pointer' }}
                    title="重做"
                  >
                    ↪ 重做
                  </button>
                  <button
                    onClick={handleClear}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '4px', color: '#ef4444', padding: '4px 10px', fontSize: '10px', cursor: 'pointer' }}
                    title="清空"
                  >
                    🗑 清空
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'grid' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* 宫格设置 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)' }}>行数 (Rows):</span>
                  <button onClick={() => setGridRows(Math.max(1, gridRows - 1))} style={{ width: '16px', height: '16px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>-</button>
                  <span style={{ color: '#ec4899', fontWeight: 'bold', fontSize: '11px', minWidth: '10px', textAlign: 'center' }}>{gridRows}</span>
                  <button onClick={() => setGridRows(Math.min(5, gridRows + 1))} style={{ width: '16px', height: '16px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>+</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)' }}>列数 (Cols):</span>
                  <button onClick={() => setGridCols(Math.max(1, gridCols - 1))} style={{ width: '16px', height: '16px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>-</button>
                  <span style={{ color: '#ec4899', fontWeight: 'bold', fontSize: '11px', minWidth: '10px', textAlign: 'center' }}>{gridCols}</span>
                  <button onClick={() => setGridCols(Math.min(5, gridCols + 1))} style={{ width: '16px', height: '16px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>+</button>
                </div>

                {/* 切割线宽度 (Gap) 调节 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)' }}>切割线宽:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={gridGap}
                    onChange={(e) => setGridGap(Number(e.target.value))}
                    style={{ width: '80px', accentColor: 'rgba(168, 85, 247, 1)', cursor: 'pointer' }}
                  />
                  <button onClick={() => setGridGap(Math.max(0, gridGap - 1))} style={{ width: '16px', height: '16px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>-</button>
                  <input
                    type="number"
                    value={gridGap}
                    min="0"
                    max="100"
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      setGridGap(val);
                    }}
                    style={{
                      width: '28px',
                      background: 'transparent',
                      border: 'none',
                      color: '#ec4899',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      textAlign: 'center',
                      outline: 'none',
                      appearance: 'none',
                      MozAppearance: 'textfield'
                    }}
                  />
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', marginRight: '2px' }}>px</span>
                  <button onClick={() => setGridGap(Math.min(100, gridGap + 1))} style={{ width: '16px', height: '16px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>+</button>
                </div>
              </div>
            )}

            {activeTab === 'crop' && (
              <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.35)' }}>
                💡 拖拽选框中心可移动，拖拽白色右下角手柄可随意调节裁剪规格。
              </span>
            )}
          </div>

          {/* 右侧：保存应用与取消按钮 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '11.5px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
            <button
              onClick={handleApply}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.95), rgba(168, 85, 247, 0.75))',
                border: 'none',
                color: '#fff',
                fontSize: '11.5px',
                fontWeight: 'bold',
                boxShadow: '0 0 15px rgba(168, 85, 247, 0.45)',
                cursor: 'pointer'
              }}
            >
              ⚡ 保存并应用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
