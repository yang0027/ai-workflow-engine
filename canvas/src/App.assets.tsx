import React, { useState, useCallback, useRef, useMemo } from 'react';

export interface AssetItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video' | 'audio';
  nodeName: string;
  createdAt?: number;
}

export interface HistoryItem {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio';
  nodeName: string;
  timestamp: number;
}

// ============ VirtualGrid - 虚拟网格组件 ============
interface VirtualGridProps<T> {
  items: T[];
  columnCount: number;
  rowHeight: number;
  gap: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  containerHeight: number;
  overscan?: number;
}

function VirtualGrid<T>({ items, columnCount, rowHeight, gap, renderItem, containerHeight, overscan = 3 }: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalRows = Math.ceil(items.length / columnCount);
  const totalHeight = totalRows * (rowHeight + gap) - gap;

  const startRow = Math.max(0, Math.floor(scrollTop / (rowHeight + gap)) - overscan);
  const endRow = Math.min(totalRows - 1, Math.ceil((scrollTop + containerHeight) / (rowHeight + gap)) + overscan);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div ref={containerRef} onScroll={handleScroll} style={{ height: containerHeight, overflow: 'auto', position: 'relative' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {Array.from({ length: endRow - startRow + 1 }).map((_, rowOffset) => {
          const row = startRow + rowOffset;
          return Array.from({ length: columnCount }).map((_, col) => {
            const index = row * columnCount + col;
            if (index >= items.length) return null;
            const style: React.CSSProperties = {
              position: 'absolute',
              top: row * (rowHeight + gap),
              left: `calc(${(col * 100) / columnCount}% + ${col > 0 ? gap / 2 : 0}px)`,
              width: `calc(${100 / columnCount}% - ${gap}px)`,
              height: rowHeight
            };
            return (
              <div key={index} style={style}>
                {renderItem(items[index], index, style)}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}

// ============ Checkbox - 复选框组件 ============
function Checkbox({ checked, onChange, indeterminate = false }: { checked: boolean; onChange: () => void; indeterminate?: boolean }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: '16px',
        height: '16px',
        borderRadius: '4px',
        border: `2px solid ${checked ? '#a855f7' : 'rgba(255,255,255,0.3)'}`,
        background: checked ? '#a855f7' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      {checked && <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
      {indeterminate && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>−</span>}
    </div>
  );
}

// ============ SelectionToolbar - 选择工具栏 ============
function SelectionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onInverse,
  onDelete,
  onCancel
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onInverse: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const isAllSelected = selectedCount === totalCount;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 14px',
      background: 'rgba(168, 85, 247, 0.1)',
      borderRadius: '10px',
      border: '1px solid rgba(168, 85, 247, 0.2)',
    }}>
      <span style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>
        已选择 {selectedCount}/{totalCount}
      </span>
      <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
        <button onClick={onSelectAll} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: isAllSelected ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', color: isAllSelected ? '#a855f7' : 'rgba(255,255,255,0.7)', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}>
          {isAllSelected ? '取消全选' : '全选'}
        </button>
        <button onClick={onInverse} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}>
          反选
        </button>
      </div>
      {selectedCount > 0 && (
        <>
          <button onClick={onDelete} style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: 'rgba(239, 68, 68, 0.8)', color: '#fff', fontSize: '10px', cursor: 'pointer', fontWeight: 700 }}>
            删除 ({selectedCount})
          </button>
          <button onClick={onCancel} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: '10px', cursor: 'pointer' }}>
            取消
          </button>
        </>
      )}
    </div>
  );
}

// ============ AssetPanelProps ============
export interface AssetPanelProps {
  uploadedAssets: AssetItem[];
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onInject: (asset: AssetItem) => void;
  onFullScreen: (url: string, type: 'image' | 'video' | 'audio') => void;
}

// ============ AssetPanel - 资产面板主组件 ============
export function AssetPanel({
  uploadedAssets,
  onUpload,
  onDelete,
  onDeleteMany,
  onInject,
  onFullScreen
}: AssetPanelProps) {
  const [activeTab, setActiveTab] = useState<'mine' | 'library' | 'virtual' | 'other'>('mine');
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 选中逻辑
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === uploadedAssets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(uploadedAssets.map(a => a.id)));
    }
  }, [uploadedAssets]);

  const inverseSelect = useCallback(() => {
    setSelectedIds(prev => {
      const allIds = new Set(uploadedAssets.map(a => a.id));
      const next = new Set<string>();
      allIds.forEach(id => { if (!prev.has(id)) next.add(id); });
      return next;
    });
  }, [uploadedAssets]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (confirm(`确认删除选中的 ${selectedIds.size} 个资产？`)) {
      onDeleteMany(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }, [selectedIds, onDeleteMany]);

  const handleUploadClick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,video/*,audio/*';
    inp.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) onUpload(file);
    };
    inp.click();
  };

  const renderAssetItem = useCallback((asset: AssetItem, index: number, style: React.CSSProperties) => {
    const isSelected = selectedIds.has(asset.id);
    return (
      <div
        key={asset.id}
        style={{
          borderRadius: '14px',
          overflow: 'hidden',
          border: `2px solid ${isSelected ? '#a855f7' : 'rgba(255,255,255,0.06)'}`,
          background: isSelected ? 'rgba(168, 85, 247, 0.1)' : 'rgba(0,0,0,0.2)',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          height: '100%',
          transition: 'all 0.15s',
          position: 'relative',
        }}
      >
        {/* 复选框 */}
        <div onClick={(e) => { e.stopPropagation(); toggleSelect(asset.id); }} style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10 }}>
          <Checkbox checked={isSelected} onChange={() => toggleSelect(asset.id)} />
        </div>
        {/* 预览区域 */}
        <div onClick={() => onFullScreen(asset.url, asset.type)} style={{ flex: 1, borderRadius: '10px', overflow: 'hidden', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'zoom-in', minHeight: 0 }}>
          {asset.type === 'image' && <img src={asset.thumbnailUrl || asset.url} alt={asset.nodeName} loading="lazy" onLoad={() => setImageLoaded(prev => ({ ...prev, [asset.id]: true }))} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imageLoaded[asset.id] ? 1 : 0, transition: 'opacity 0.2s' }} />}
          {asset.type === 'video' && <video src={asset.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline preload="metadata" />}
          {asset.type === 'audio' && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span style={{ fontSize: '32px' }}>🎵</span><span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>音色/配音</span></div>}
          {!imageLoaded[asset.id] && asset.type === 'image' && <div style={{ position: 'absolute', width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
          <span style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>🔍</span>
          <button onClick={(e) => { e.stopPropagation(); if (confirm('确认删除该资产？')) onDelete(asset.id); }} style={{ position: 'absolute', bottom: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.85)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' }} title="删除">×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={asset.nodeName}>{asset.nodeName}</span>
          <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>{asset.type.toUpperCase()}</span>
        </div>
        <button onClick={() => onInject(asset)} style={{ width: '100%', padding: '6px', background: 'rgba(168, 85, 247, 0.25)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '6px', color: '#fff', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>灌装到节点</button>
      </div>
    );
  }, [selectedIds, onFullScreen, onDelete, onInject, toggleSelect, imageLoaded]);

  const assetTabs = [
    { id: 'mine', label: '📦 我的资产' },
    { id: 'library', label: '🖼️ 预设素材库' },
    { id: 'virtual', label: '🎙️ 虚拟人库' },
    { id: 'other', label: '📚 LORA 其他预设' }
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      {/* 上传区域 */}
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) onUpload(file); }} onClick={handleUploadClick} style={{ padding: '14px', border: '1px dashed rgba(168, 85, 247, 0.35)', background: 'rgba(168, 85, 247, 0.02)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer' }}>
        <span style={{ fontSize: '22px' }}>📥</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#fff' }}>拖拽或点击上传图片/音视频</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>自动生成缩略图，列表加载更流畅</div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {assetTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: activeTab === tab.id ? 'rgba(168, 85, 247, 0.25)' : 'transparent', color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: activeTab === tab.id ? 700 : 500, cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 选择工具栏（仅我的资产 tab） */}
      {activeTab === 'mine' && uploadedAssets.length > 0 && (
        <SelectionToolbar
          selectedCount={selectedIds.size}
          totalCount={uploadedAssets.length}
          onSelectAll={selectAll}
          onInverse={inverseSelect}
          onDelete={handleDeleteSelected}
          onCancel={() => setSelectedIds(new Set())}
        />
      )}

      {/* 内容区域 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'mine' && (
          uploadedAssets.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>📭 暂无资产，请上传文件</div>
          ) : (
            <VirtualGrid items={uploadedAssets} columnCount={4} rowHeight={180} gap={14} containerHeight={350} renderItem={renderAssetItem} />
          )
        )}
        {activeTab === 'library' && <div style={{ padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>🖼️ 预设素材库开发中...</div>}
        {activeTab === 'virtual' && <div style={{ padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>🎙️ 虚拟人库开发中...</div>}
        {activeTab === 'other' && <div style={{ padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>📚 LORA 预设开发中...</div>}
      </div>
    </div>
  );
}

// ============ HistoryPanelProps ============
export interface HistoryPanelProps {
  historyAssets: HistoryItem[];
  onFullScreen: (url: string, type: 'image' | 'video' | 'audio') => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
}

// ============ HistoryPanel - 历史记录面板 ============
export function HistoryPanel({ historyAssets, onFullScreen, onDelete, onDeleteMany }: HistoryPanelProps) {
  const [subTab, setSubTab] = useState<'image' | 'video' | 'audio'>('image');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => historyAssets.filter(h => h.type === subTab), [historyAssets, subTab]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(h => h.id)));
    }
  }, [filtered]);

  const inverseSelect = useCallback(() => {
    setSelectedIds(prev => {
      const allIds = new Set(filtered.map(h => h.id));
      const next = new Set<string>();
      allIds.forEach(id => { if (!prev.has(id)) next.add(id); });
      return next;
    });
  }, [filtered]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (confirm(`确认删除选中的 ${selectedIds.size} 条历史记录？`)) {
      onDeleteMany(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }, [selectedIds, onDeleteMany]);

  const tabs = [
    { id: 'image', label: '🖼️ AI 生图历史' },
    { id: 'video', label: '📹 视频合成历史' },
    { id: 'audio', label: '🎵 音频旁白历史' }
  ] as const;

  const renderItem = useCallback((item: HistoryItem, index: number, style: React.CSSProperties) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <div key={item.id} style={{ borderRadius: '14px', overflow: 'hidden', border: `2px solid ${isSelected ? '#a855f7' : 'rgba(255,255,255,0.06)'}`, background: isSelected ? 'rgba(168, 85, 247, 0.1)' : 'rgba(0,0,0,0.2)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', transition: 'all 0.15s', position: 'relative' }}>
        <div onClick={() => setSelectedIds(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })} style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10 }}>
          <Checkbox checked={isSelected} onChange={() => toggleSelect(item.id)} />
        </div>
        <div onClick={() => onFullScreen(item.url, item.type)} style={{ flex: 1, borderRadius: '10px', overflow: 'hidden', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'zoom-in', minHeight: 0 }}>
          {item.type === 'image' && <img src={item.url} alt={item.nodeName} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          {item.type === 'video' && <video src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
          {item.type === 'audio' && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span style={{ fontSize: '32px' }}>🎙️</span><span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>AI 旁白</span></div>}
          <span style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>🔍</span>
          <button onClick={(e) => { e.stopPropagation(); if (confirm('确认删除该历史记录？')) onDelete(item.id); }} style={{ position: 'absolute', bottom: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.85)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' }} title="删除">×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.nodeName}</span>
          <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>{new Date(item.timestamp).toLocaleString('zh-CN')}</span>
        </div>
        <button onClick={() => { if (confirm('确认删除该历史记录？')) onDelete(item.id); }} style={{ width: '100%', padding: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>删除</button>
      </div>
    );
  }, [selectedIds, onFullScreen, onDelete, toggleSelect]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: subTab === tab.id ? 'rgba(168, 85, 247, 0.25)' : 'transparent', color: subTab === tab.id ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: subTab === tab.id ? 700 : 500, cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 选择工具栏 */}
      {filtered.length > 0 && (
        <SelectionToolbar
          selectedCount={selectedIds.size}
          totalCount={filtered.length}
          onSelectAll={selectAll}
          onInverse={inverseSelect}
          onDelete={handleDeleteSelected}
          onCancel={() => setSelectedIds(new Set())}
        />
      )}

      {/* 内容 */}
      <div style={{ flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>📭 暂无此分类下的历史记录</div>
        ) : (
          <VirtualGrid items={filtered} columnCount={4} rowHeight={180} gap={14} containerHeight={350} renderItem={renderItem} />
        )}
      </div>
    </div>
  );
}
