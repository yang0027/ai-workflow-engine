import React, { useState, useEffect, useRef } from 'react';
import { PRESET_WORKFLOWS } from '../presets/workflows';
import { PresetWorkflow } from '../presets/workflows/preset-workflow.interface';
import { 
  WorkflowTemplate, 
  WorkflowTemplateService 
} from '../services/workflow-template.service';
import { ResolvedMedia } from './ResolvedMedia';

interface ToonflowCenterModalProps {
  isOpen: boolean;
  activeFloatingPopup: 'templates' | 'assets' | 'history' | null;
  onClose: () => void;
  modalNodeTarget: string | null;
  modalMediaType: string | null;
  
  // 模板数据与加载状态
  savedTemplates: WorkflowTemplate[];
  templatesLoading: boolean;
  onRefreshTemplates: () => void;
  
  // 画布操作回调
  onSpawnCustomWorkflow: (template: WorkflowTemplate) => void;
  onSpawnWorkflow: (wfId: string, wfName: string, type: 'image' | 'video') => void;
  onCustomJsonUpload: (content: string, filename: string) => void;
  
  // 资产相关 Props
  uploadedAssets: any[];
  onResourceUpload: (file: File, activeTab?: string) => void;
  onDeleteAsset: (id: string) => void;
  onInjectAsset: (url: string, type?: 'image' | 'audio' | 'video', name?: string) => void;
  onInjectLibraryAsset: (url: string, name: string) => void;
  onCloneVirtualVoice: (voiceName: string, voiceUrl: string) => void;
  
  // 预设与历史相关 Props
  libraryAssets: any[];
  onDeleteLibraryAsset: (id: string) => void;
  virtualAssets?: any[];
  onDeleteVirtualAsset?: (id: string) => void;
  loraAssets?: any[];
  onDeleteLoraAsset?: (id: string) => void;
  onInjectLibraryAssetDirectly: (url: string, name: string) => void;
  historyItems: any[];
  
  // 工具类方法
  downloadFileDirectly: (url: string, filename: string) => void;
  setFullScreenMedia: (media: { url: string; type: string } | null) => void;
}

export default function ToonflowCenterModal({
  isOpen,
  activeFloatingPopup,
  onClose,
  modalNodeTarget,
  modalMediaType,
  savedTemplates,
  templatesLoading,
  onRefreshTemplates,
  onSpawnCustomWorkflow,
  onSpawnWorkflow,
  onCustomJsonUpload,
  uploadedAssets,
  onResourceUpload,
  onDeleteAsset,
  onInjectAsset,
  onInjectLibraryAsset,
  onCloneVirtualVoice,
  libraryAssets,
  onDeleteLibraryAsset,
  onInjectLibraryAssetDirectly,
  virtualAssets = [],
  onDeleteVirtualAsset = () => {},
  loraAssets = [],
  onDeleteLoraAsset = () => {},
  historyItems,
  downloadFileDirectly,
  setFullScreenMedia,
}: ToonflowCenterModalProps) {
  
  // --- 1. 弹窗内聚状态 ---
  // 一级物理分类 Tab: 'local_comfyui' (本地 ComfyUI) | 'runninghub' (云端 RunningHub)
  const [templateLargeTab, setTemplateLargeTab] = useState<'local_comfyui' | 'runninghub'>('local_comfyui');
  // 资产大仓 Tab: 'mine' | 'library' | 'virtual' | 'other'
  const [assetLargeTab, setAssetLargeTab] = useState<'mine' | 'library' | 'virtual' | 'other'>('mine');
  // 历史生成 Tab: 'image' | 'video' | 'audio'
  const [historySubTab, setHistorySubTab] = useState<'image' | 'video' | 'audio'>('image');
  
  // 二级能力筛选小药丸: 'all' | 'image' | 'video' | 'audio'
  const [workflowCapabilityFilter, setWorkflowCapabilityFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  
  // 我的资产二级小药丸分类筛选 (人物、场景、物品、视频、音频、音效、其他)
  const [mineCategoryFilter, setMineCategoryFilter] = useState<string>('全部');
  // 预设素材二级小药丸分类筛选 (人物、场景、物品、视频、音频、音效、其他)
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState<string>('全部');
  
  // 选中资产状态（用于批量操作）
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  // 选中历史记录状态（用于批量操作）
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  // 选中预设素材库状态（用于批量操作）
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());
  // 选中虚拟人音色状态（用于批量操作）
  const [selectedVirtualIds, setSelectedVirtualIds] = useState<Set<string>>(new Set());
  // 选中LORA预设状态（用于批量操作）
  const [selectedOtherIds, setSelectedOtherIds] = useState<Set<string>>(new Set());
  // 选中工作流模板状态（用于批量操作）
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Set<string>>(new Set());
  
  // 切换分类时重置选中状态
  useEffect(() => {
    setSelectedAssetIds(new Set());
  }, [mineCategoryFilter]);
  
  useEffect(() => {
    setSelectedHistoryIds(new Set());
  }, [historySubTab]);

  // 切换资产大分类时重置选中状态
  useEffect(() => {
    setSelectedLibraryIds(new Set());
    setSelectedVirtualIds(new Set());
    setSelectedOtherIds(new Set());
  }, [assetLargeTab]);

  // 切换模板分类时重置选中状态
  useEffect(() => {
    setSelectedWorkflowIds(new Set());
  }, [templateLargeTab, workflowCapabilityFilter]);
  
  // 当资产列表变化时，自动清理已删除的选中 ID
  useEffect(() => {
    setSelectedAssetIds(prev => {
      const newSet = new Set<string>();
      prev.forEach(id => {
        if (uploadedAssets.some(a => a.id === id)) {
          newSet.add(id);
        }
      });
      return newSet;
    });
  }, [uploadedAssets]);

  // 当预设素材库列表变化时，自动清理已删除的选中 ID
  useEffect(() => {
    setSelectedLibraryIds(prev => {
      const newSet = new Set<string>();
      prev.forEach(id => {
        if (libraryAssets.some(a => a.id === id)) {
          newSet.add(id);
        }
      });
      return newSet;
    });
  }, [libraryAssets]);
  
  // 各种卡片 Hover 与试听状态
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // --- 2. 外部调起大弹窗时的自动自愈跳转对齐 ---
  useEffect(() => {
    if (isOpen && activeFloatingPopup === 'templates') {
      if (modalMediaType === 'image' || modalMediaType === 'video' || modalMediaType === 'audio') {
        setWorkflowCapabilityFilter(modalMediaType);
      } else {
        setWorkflowCapabilityFilter('all');
      }
      
      // 智能锚定一级物理来源
      if (modalNodeTarget) {
        // 如果是从 ComfyUI 节点调起的，默认选中 local_comfyui；如果是 RunningHub 节点则设为 runninghub
        const targetNodeEl = document.querySelector(`[data-id="${modalNodeTarget}"]`);
        const labelText = targetNodeEl?.textContent || '';
        if (labelText.includes('[RH]') || labelText.includes('RunningHub')) {
          setTemplateLargeTab('runninghub');
        } else {
          setTemplateLargeTab('local_comfyui');
        }
      } else {
        setTemplateLargeTab('local_comfyui');
      }
    }
    
    if (isOpen && activeFloatingPopup === 'assets') {
      if (modalMediaType === 'audio') {
        setAssetLargeTab('virtual'); // 试听克隆
      } else {
        setAssetLargeTab('mine'); // 资产灌装
      }
    }

    if (isOpen && activeFloatingPopup === 'history') {
      if (modalMediaType === 'video' || modalMediaType === 'image' || modalMediaType === 'audio') {
        setHistorySubTab(modalMediaType);
      } else {
        setHistorySubTab('image');
      }
    }
  }, [isOpen, activeFloatingPopup, modalMediaType, modalNodeTarget]);

  if (!isOpen || !activeFloatingPopup) return null;

  // --- 3. 音频试听控制逻辑 ---
  const handleToggleVoicePlay = (id: string, audioUrl: string) => {
    if (playingVoiceId === id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingVoiceId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const newAudio = new Audio(audioUrl);
      newAudio.onended = () => setPlayingVoiceId(null);
      newAudio.play().catch(e => console.error('试听播放失败:', e));
      audioPlayerRef.current = newAudio;
      setPlayingVoiceId(id);
    }
  };

  // Canvas 图像物理压损压缩算法 (防爆 LocalStorage 容量与提升渲染速度)
  const compressImageBase64 = (base64: string, maxWidth = 500, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64);
        }
      };
      img.onerror = () => resolve(base64);
    });
  };

  // --- 4. 更换卡片封面 (完美支持内置预设本地覆盖与自定义模板本地上传) ---
  const handleChangeCardCover = (item: { id: string; isPreset: boolean; rawPreset?: any; rawCustom?: any }) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        if (evt.target?.result) {
          const originalBase64 = evt.target.result as string;
          try {
            // 调用 Canvas 压缩，将几 MB 甚至十几 MB 的大原图无感压损到 20KB 以内
            const base64 = await compressImageBase64(originalBase64);
            if (item.isPreset) {
              const savedCovers = localStorage.getItem('toonflow_preset_covers');
              const covers = savedCovers ? JSON.parse(savedCovers) : {};
              covers[item.id] = base64;
              localStorage.setItem('toonflow_preset_covers', JSON.stringify(covers));
              alert('🎉 官方内置工作流封面已成功本地更换覆盖！');
              onRefreshTemplates();
            } else {
              await WorkflowTemplateService.saveTemplate({
                ...item.rawCustom,
                previewImage: base64
              });
              alert('🎉 自定义工作流封面已成功上传更新！');
              onRefreshTemplates();
            }
          } catch (err: any) {
            alert('❌ 更换封面失败: ' + err.message);
          }
        }
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  };

  // --- 5. 聚合与排序当前来源下的工作流 ---
  // A. 内置官方预设
  const currentPresets = PRESET_WORKFLOWS.filter(w => w.source === templateLargeTab);
  // B. 用户自定义
  const currentCustoms = savedTemplates.filter(t => t.source === templateLargeTab);

  // 根据能力类型获取当前板块中的所有卡片列表
  const getWorkflowsByCapability = (cap: 'image' | 'video' | 'audio') => {
    const matchedPresets = currentPresets.filter(w => w.capability === cap);
    const matchedCustoms = currentCustoms.filter(t => t.capability === cap);
    
    // 合并并标准化渲染格式
    const mergedList: Array<{
      id: string;
      title: string;
      desc: string;
      cover: string;
      tag: string;
      color: string;
      isPreset: boolean;
      rawPreset?: PresetWorkflow;
      rawCustom?: WorkflowTemplate;
    }> = [];

    // 先推入内置预设
    matchedPresets.forEach(w => {
      const savedCovers = localStorage.getItem('toonflow_preset_covers');
      const covers = savedCovers ? JSON.parse(savedCovers) : {};
      const finalCover = covers[w.id] || w.cover || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80?w=400&q=80';

      mergedList.push({
        id: w.id,
        title: w.name,
        desc: w.description,
        cover: finalCover,
        tag: w.tag || '✨ 官方内置',
        color: w.color || 'hsl(var(--accent-primary))',
        isPreset: true,
        rawPreset: w
      });
    });

    // 后推入自定义工作流
    matchedCustoms.forEach(t => {
      mergedList.push({
        id: t.id,
        title: t.name,
        desc: t.description || '暂无详细描述，导入 ComfyUI / RunningHub 自定义解析工作流...',
        cover: t.previewImage || 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400&q=80?w=400&q=80',
        tag: t.source === 'local_comfyui' ? '🔌 本地自定义' : '⚡ 云端应用',
        color: t.source === 'local_comfyui' ? 'rgba(14, 165, 233, 0.85)' : 'rgba(168, 85, 247, 0.85)',
        isPreset: false,
        rawCustom: t
      });
    });

    return mergedList;
  };

  // 渲染单个工作流分组板块
  const renderWorkflowGroup = (cap: 'image' | 'video' | 'audio', icon: string, title: string) => {
    const list = getWorkflowsByCapability(cap);
    if (list.length === 0) return null;

    return (
      <div style={{ marginTop: '10px', marginBottom: '24px' }}>
        {/* 批量操作栏 */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 12px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.15)', marginBottom: '14px' }}>
          <button
            onClick={() => {
              if (selectedWorkflowIds.size === list.length) {
                setSelectedWorkflowIds(new Set());
              } else {
                setSelectedWorkflowIds(new Set(list.map(item => item.id)));
              }
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: selectedWorkflowIds.size === list.length ? 'rgba(168, 85, 247, 0.4)' : 'rgba(168, 85, 247, 0.2)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {selectedWorkflowIds.size === list.length ? '☑️ 取消全选' : '☑️ 全选'}
          </button>
          <button
            onClick={() => {
              const all = new Set(list.map(item => item.id));
              const newSet = new Set<string>();
              all.forEach(id => { if (!selectedWorkflowIds.has(id)) newSet.add(id); });
              setSelectedWorkflowIds(newSet);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔄 反选
          </button>
          <button
            onClick={() => {
              if (selectedWorkflowIds.size === 0) return;
              if (confirm(`确定删除选中的 ${selectedWorkflowIds.size} 个工作流模板吗？`)) {
                // 删除自定义工作流（预设不可删除）
                selectedWorkflowIds.forEach(id => {
                  const item = list.find(i => i.id === id);
                  if (item && !item.isPreset && item.rawCustom) {
                    WorkflowTemplateService.deleteTemplate(id);
                  }
                });
                setSelectedWorkflowIds(new Set());
                onRefreshTemplates();
              }
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: selectedWorkflowIds.size > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.04)',
              color: selectedWorkflowIds.size > 0 ? '#fca5a5' : 'rgba(255,255,255,0.3)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: selectedWorkflowIds.size > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            🗑️ 批量删除 {selectedWorkflowIds.size > 0 && `(${selectedWorkflowIds.size})`}
          </button>
        </div>

        <h3 style={{
          fontSize: '14px',
          fontWeight: 800,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          marginBottom: '14px'
        }}>
          <span>{icon}</span> {title} ({list.length})
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {list.map(item => {
            const isSelected = selectedWorkflowIds.has(item.id);
            return (
            <div
              key={item.id}
              onClick={() => {
                const newSet = new Set(selectedWorkflowIds);
                if (newSet.has(item.id)) {
                  newSet.delete(item.id);
                } else {
                  newSet.add(item.id);
                }
                setSelectedWorkflowIds(newSet);
              }}
              onMouseEnter={() => setHoveredCardId(item.id)}
              onMouseLeave={() => setHoveredCardId(null)}
              style={{
                borderRadius: '14px',
                overflow: 'hidden',
                border: isSelected ? '2px solid rgba(168, 85, 247, 0.8)' : '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255, 255, 255, 0.01)',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: isSelected ? '0 0 20px rgba(168, 85, 247, 0.3)' : '0 8px 32px rgba(0,0,0,0.3)',
                transition: 'all 0.25s',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* 复选框 */}
              <div style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                background: isSelected ? 'rgba(168, 85, 247, 0.9)' : 'rgba(0,0,0,0.6)',
                border: `2px solid ${isSelected ? '#a855f7' : 'rgba(255,255,255,0.4)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#fff',
                zIndex: 10,
              }}>
                {isSelected && '✓'}
              </div>
              <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: '10px', background: 'rgba(0,0,0,0.4)' }}>
                <img src={item.cover} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                
                {/* 物理角标 */}
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    background: item.color,
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    fontSize: '9px',
                    fontWeight: 700,
                    zIndex: 5
                  }}
                >
                  {item.tag}
                </span>

                {/* 更换封面悬浮层 (仅限自定义工作流) */}
                {hoveredCardId === item.id && (
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
                      zIndex: 15,
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChangeCardCover(item);
                    }}
                  >
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: '20px',
                      color: '#fff',
                      padding: '4px 10.5px',
                      fontSize: '9.5px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      📷 更换封面
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '11.5px', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={item.title}>
                    {item.title}
                  </h4>
                  <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '25px' }}>
                    {item.desc}
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    if (item.isPreset) {
                      onSpawnWorkflow(item.id, item.title, cap === 'audio' ? 'image' : (cap as any));
                    } else if (item.rawCustom) {
                      onSpawnCustomWorkflow(item.rawCustom);
                    }
                  }}
                  style={{
                    marginTop: '6px',
                    padding: '6px',
                    borderRadius: '6px',
                    background: item.isPreset ? 'rgba(168, 85, 247, 0.2)' : 'rgba(14, 165, 233, 0.2)',
                    border: item.isPreset ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(14, 165, 233, 0.4)',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {modalNodeTarget ? '➕ 装载到当前节点' : '➕ 添加到画布'}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    );
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
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeInLargeModal {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUpLargeModal {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.25);
        }
      `}</style>

      {/* Main Console Box */}
      <div
        style={{
          width: '88vw',
          height: '85vh',
          background: 'rgba(15, 18, 28, 0.72)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255,255,255,0.1)',
          borderRadius: '24px',
          display: 'flex',
          overflow: 'hidden',
          animation: 'scaleUpLargeModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* 1. Left Control Panel Sidebar */}
        <div
          style={{
            width: '260px',
            borderRight: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(5, 7, 12, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px',
          }}
        >
          {/* Logo Brand Segment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px', filter: 'drop-shadow(0 0 12px rgba(168, 85, 247, 0.6))' }}>🔮</span>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '14px', fontWeight: 900, letterSpacing: '1px', background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  TOONFLOW
                </span>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', display: 'block', fontWeight: 700 }}>
                  WORKFLOW ENGINE
                </span>
              </div>
            </div>

            {/* Sidebar Large Tabs Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { id: 'templates', label: '🔮 工作流中心', desc: '内置/自定义 ComfyUI 与 RH' },
                { id: 'assets', label: '📦 豪华资产中心', desc: '上传与灌装生图/音视频资产' },
                { id: 'history', label: '🕐 成果历史轨迹', desc: '追溯以往生成的 AI 艺术成品' }
              ].map((tab) => {
                const active = activeFloatingPopup === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === 'templates') window.dispatchEvent(new CustomEvent('open-large-modal', { detail: { tab: 'workflows', nodeTarget: modalNodeTarget, type: modalMediaType } }));
                      if (tab.id === 'assets') window.dispatchEvent(new CustomEvent('open-large-modal', { detail: { tab: 'assets', nodeTarget: modalNodeTarget, type: modalMediaType } }));
                      if (tab.id === 'history') window.dispatchEvent(new CustomEvent('open-large-modal', { detail: { tab: 'history', nodeTarget: modalNodeTarget, type: modalMediaType } }));
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: 'none',
                      background: active ? 'rgba(168, 85, 247, 0.16)' : 'transparent',
                      borderLeft: active ? '4px solid #c084fc' : '4px solid transparent',
                      color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      textAlign: 'left',
                      gap: '3px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{tab.label}</span>
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
                textAlign: 'left'
              }}
            >
              🟢 联调运行引擎已就绪<br />
              ⚡ COMFIER CORE v3.5<br />
              🚀 视口装载正常
            </div>
            <button
              onClick={onClose}
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
            >
              🚪 关闭大窗
            </button>
          </div>
        </div>

        {/* 2. Right Main Working Space */}
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
            <div style={{ textAlign: 'left' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                {activeFloatingPopup === 'templates' && '🔮 Toonflow 工作流中心'}
                {activeFloatingPopup === 'assets' && '📦 Toonflow 豪华资产中心'}
                {activeFloatingPopup === 'history' && '🕐 Toonflow 成果历史轨迹'}
              </h2>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px', margin: 0 }}>
                {activeFloatingPopup === 'templates' && '按物理运行集群分流。装载预置或导入 ComfyUI API JSON，一键暴露参数灌装当前节点。'}
                {activeFloatingPopup === 'assets' && '筛选与管理高精预置参考图、Unsplash 素材大图、克隆虚拟人旁声音旁白。'}
                {activeFloatingPopup === 'history' && '追溯与复用您以往所生成的图像、视频以及音频历史记录成果。'}
              </p>
            </div>
            
            <button
              onClick={onClose}
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
            >
              ×
            </button>
          </div>

          {/* Sub-tabs / Filters Segment */}
          <div style={{ padding: '16px 30px 0 30px', display: 'flex', gap: '14px', alignItems: 'center', justifyContent: 'flex-start' }}>
            
            {/* 一级 Tab Selector */}
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
                  { id: 'local_comfyui', label: '💻 本地 ComfyUI 集群' },
                  { id: 'runninghub', label: '⚡ RunningHub 算力云' },
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
                  { id: 'library', label: '🖼️ 预设素材库' },
                  { id: 'virtual', label: '🎙️ 虚拟人配音克隆' },
                  { id: 'other', label: '🎨 LORA 其他预设' },
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

            {/* templates 大分类独有的: 二级能力筛选小药丸 */}
            {activeFloatingPopup === 'templates' && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '3px 8px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginRight: '4px' }}>能力过滤:</span>
                {[
                  { id: 'all', label: '🌟 全部' },
                  { id: 'image', label: '🎨 图像' },
                  { id: 'video', label: '📹 视频' },
                  { id: 'audio', label: '🗣️ 音频' }
                ].map(pill => (
                  <button
                    key={pill.id}
                    onClick={() => setWorkflowCapabilityFilter(pill.id as any)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      border: 'none',
                      cursor: 'pointer',
                      background: workflowCapabilityFilter === pill.id ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                      color: workflowCapabilityFilter === pill.id ? '#c084fc' : 'rgba(255,255,255,0.4)',
                      fontWeight: workflowCapabilityFilter === pill.id ? 'bold' : 'normal',
                      transition: 'all 0.2s'
                    }}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main Working Viewport Container */}
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
            
            {/* ---------------- 1. WORKFLOW TEMPLATES CORE VIEW ---------------- */}
            {activeFloatingPopup === 'templates' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                
                {/* 物理来源提示与跳转引导大卡片 */}
                <div
                  onClick={() => {
                    const event = new CustomEvent('open-settings', { detail: { tab: 'templates' } });
                    window.dispatchEvent(event);
                    onClose();
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
                    marginBottom: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                    <span style={{ fontSize: '28px', filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))' }}>🔮</span>
                    <div style={{ textAlign: 'left' }}>
                      <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#fff', margin: 0 }}>
                        前往「自定义工作流 (JSON 解析)」管理大仓
                      </h3>
                      <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', margin: 0, lineHeight: '1.4' }}>
                        {templateLargeTab === 'local_comfyui'
                          ? '在此解析或上传本地导出的 ComfyUI API 格式 JSON 拓扑结构，自动分析出输入暴露参数，保存后即在此列出！'
                          : '在此解析云端 RunningHub App ID，智能勾选多图/文字灌装暴露字段，自愈式绑定热加载！'
                        }
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: 'bold', whiteSpace: 'nowrap' }}>立即前往配置 →</span>
                </div>

                {templatesLoading ? (
                  <div style={{ textAlign: 'center', padding: '100px 0', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                    🔄 正在同步拉取本地自定义模板及云端工作流列表，请稍候...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    {/* 按二级小药丸条件，优雅陈列各服务板块 */}
                    {(workflowCapabilityFilter === 'all' || workflowCapabilityFilter === 'image') && 
                      renderWorkflowGroup('image', '🎨', '图像节点服务 (Image Workflows)')
                    }

                    {(workflowCapabilityFilter === 'all' || workflowCapabilityFilter === 'video') && 
                      renderWorkflowGroup('video', '📹', '视频融合服务 (Video Workflows)')
                    }

                    {(workflowCapabilityFilter === 'all' || workflowCapabilityFilter === 'audio') && 
                      renderWorkflowGroup('audio', '🗣️', '音轨克隆配音服务 (Audio Workflows)')
                    }

                    {/* 完全空白提示 */}
                    {getWorkflowsByCapability('image').length === 0 && 
                     getWorkflowsByCapability('video').length === 0 && 
                     getWorkflowsByCapability('audio').length === 0 && (
                      <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '16px' }}>
                        📭 暂无物理匹配的可用工作流。请拖入 ComfyUI JSON 或去右上角设置添加。
                      </div>
                     )}
                  </div>
                )}
              </div>
            )}

            {/* ---------------- 2. LUXURY ASSETS CORE VIEW ---------------- */}
            {activeFloatingPopup === 'assets' && (
              <>
                {/* 资源一键拖拽上传头部 */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) onResourceUpload(file, assetLargeTab);
                  }}
                  onClick={() => {
                    const inp = document.createElement('input');
                    inp.type = 'file';
                    inp.accept = 'image/*,video/*,audio/*';
                    inp.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) onResourceUpload(file, assetLargeTab);
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
                >
                  <span style={{ fontSize: '24px' }}>📥</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>
                      {assetLargeTab === 'mine' && '将本地高精生成成果拖拽或上传到“我的资产”池中'}
                      {assetLargeTab === 'library' && '将自定义高精图像素材拖拽或上传到“预设素材库”中'}
                      {assetLargeTab === 'virtual' && '将自定义声线音频拖拽或上传到“虚拟人克隆声线”中'}
                      {assetLargeTab === 'other' && '将自定义 LORA 封面与权重文件上传到“LORA 预设库”中'}
                    </div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                      支持秒开 IndexedDB 本地极速物理灌装缓存，新上传资源会自动置顶渲染优先展示！
                    </div>
                  </div>
                </div>

                {/* 2.1 我的资产 Tab */}
                {assetLargeTab === 'mine' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* 批量操作栏 */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 12px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
                      <button
                        onClick={() => {
                          if (selectedAssetIds.size === uploadedAssets.length) {
                            setSelectedAssetIds(new Set());
                          } else {
                            setSelectedAssetIds(new Set(uploadedAssets.map(a => a.id)));
                          }
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: selectedAssetIds.size === uploadedAssets.length ? 'rgba(168, 85, 247, 0.4)' : 'rgba(168, 85, 247, 0.2)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {selectedAssetIds.size === uploadedAssets.length ? '☑️ 取消全选' : '☑️ 全选'}
                      </button>
                      <button
                        onClick={() => {
                          const all = new Set(uploadedAssets.map(a => a.id));
                          const newSet = new Set<string>();
                          all.forEach(id => { if (!selectedAssetIds.has(id)) newSet.add(id); });
                          setSelectedAssetIds(newSet);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        🔄 反选
                      </button>
                      <button
                        onClick={() => {
                          if (selectedAssetIds.size === 0) return;
                          if (confirm(`确定删除选中的 ${selectedAssetIds.size} 个资产吗？`)) {
                            selectedAssetIds.forEach(id => onDeleteAsset(id));
                            setSelectedAssetIds(new Set());
                          }
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: selectedAssetIds.size > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.04)',
                          color: selectedAssetIds.size > 0 ? '#fca5a5' : 'rgba(255,255,255,0.3)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: selectedAssetIds.size > 0 ? 'pointer' : 'not-allowed',
                        }}
                      >
                        🗑️ 批量删除 {selectedAssetIds.size > 0 && `(${selectedAssetIds.size})`}
                      </button>
                    </div>
                    
                    {/* 分类药丸筛选栏 */}
                    <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginRight: '6px', fontWeight: 'bold' }}>资产分类:</span>
                      {['全部', '人物', '场景', '物品', '视频', '音频', '音效', '其他'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setMineCategoryFilter(cat)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '10.5px',
                            border: 'none',
                            cursor: 'pointer',
                            background: mineCategoryFilter === cat ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            color: mineCategoryFilter === cat ? '#c084fc' : 'rgba(255,255,255,0.45)',
                            fontWeight: mineCategoryFilter === cat ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                      {(() => {
                        const filtered = uploadedAssets.filter(asset => mineCategoryFilter === '全部' || asset.tag === mineCategoryFilter);
                        if (filtered.length === 0) {
                          return (
                            <div style={{ gridColumn: '1 / span 4', padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                              📭 该分类下暂无资产。
                            </div>
                          );
                        }
                        return filtered.map((asset) => {
                          const isSelected = selectedAssetIds.has(asset.id);
                          return (
                          <div
                            key={asset.id}
                            onClick={() => {
                              const newSet = new Set(selectedAssetIds);
                              if (newSet.has(asset.id)) {
                                newSet.delete(asset.id);
                              } else {
                                newSet.add(asset.id);
                              }
                              setSelectedAssetIds(newSet);
                            }}
                            style={{
                              borderRadius: '14px',
                              overflow: 'hidden',
                              border: isSelected ? '2px solid rgba(168, 85, 247, 0.8)' : '1px solid rgba(255,255,255,0.06)',
                              background: 'rgba(0,0,0,0.2)',
                              padding: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              boxShadow: isSelected ? '0 0 20px rgba(168, 85, 247, 0.3)' : 'none',
                              transition: 'all 0.2s',
                              cursor: 'pointer',
                              position: 'relative',
                            }}
                          >
                            {/* 复选框 */}
                            <div style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              background: isSelected ? 'rgba(168, 85, 247, 0.9)' : 'rgba(0,0,0,0.6)',
                              border: `2px solid ${isSelected ? '#a855f7' : 'rgba(255,255,255,0.4)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              color: '#fff',
                              zIndex: 10,
                            }}>
                              {isSelected && '✓'}
                            </div>
                            <div
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
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setFullScreenMedia({ url: asset.url, type: asset.type });
                              }}
                            >
                              {asset.type === 'image' && <ResolvedMedia url={asset.url} type="image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                              {asset.type === 'video' && <ResolvedMedia url={asset.url} type="video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay loop muted playsInline />}
                              {asset.type === 'audio' && (
                                <div 
                                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '0 8px' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span style={{ fontSize: '20px', marginBottom: '4px' }}>🎵</span>
                                  <ResolvedMedia url={asset.url} type="audio" style={{ width: '100%', height: '24px' }} controls />
                                </div>
                              )}
                              
                              <span style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff' }}>🔍</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={asset.name || asset.nodeName}>
                                {asset.name || asset.nodeName}
                              </span>
                              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>类型: {asset.type.toUpperCase()}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onInjectAsset(asset.url, asset.type, asset.nodeName);
                              }}
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
                            >
                              ➕ 装载到画布
                            </button>
                          </div>
                        );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {/* 2.2 预设素材库 */}
                {assetLargeTab === 'library' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* 批量操作栏 */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 12px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
                      <button
                        onClick={() => {
                          const filtered = libraryAssets.filter(a => libraryCategoryFilter === '全部' || a.tag === libraryCategoryFilter);
                          if (selectedLibraryIds.size === filtered.length) {
                            setSelectedLibraryIds(new Set());
                          } else {
                            setSelectedLibraryIds(new Set(filtered.map(a => a.id)));
                          }
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: selectedLibraryIds.size === libraryAssets.filter(a => libraryCategoryFilter === '全部' || a.tag === libraryCategoryFilter).length ? 'rgba(168, 85, 247, 0.4)' : 'rgba(168, 85, 247, 0.2)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {selectedLibraryIds.size === libraryAssets.filter(a => libraryCategoryFilter === '全部' || a.tag === libraryCategoryFilter).length ? '☑️ 取消全选' : '☑️ 全选'}
                      </button>
                      <button
                        onClick={() => {
                          const filtered = libraryAssets.filter(a => libraryCategoryFilter === '全部' || a.tag === libraryCategoryFilter);
                          const all = new Set(filtered.map(a => a.id));
                          const newSet = new Set<string>();
                          all.forEach(id => { if (!selectedLibraryIds.has(id)) newSet.add(id); });
                          setSelectedLibraryIds(newSet);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        🔄 反选
                      </button>
                      <button
                        onClick={() => {
                          if (selectedLibraryIds.size === 0) return;
                          if (confirm(`确定删除选中的 ${selectedLibraryIds.size} 个预设素材吗？`)) {
                            selectedLibraryIds.forEach(id => onDeleteLibraryAsset(id));
                            setSelectedLibraryIds(new Set());
                          }
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: selectedLibraryIds.size > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.04)',
                          color: selectedLibraryIds.size > 0 ? '#fca5a5' : 'rgba(255,255,255,0.3)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: selectedLibraryIds.size > 0 ? 'pointer' : 'not-allowed',
                        }}
                      >
                        🗑️ 批量删除 {selectedLibraryIds.size > 0 && `(${selectedLibraryIds.size})`}
                      </button>
                    </div>

                    {/* 分类药丸筛选栏 */}
                    <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginRight: '6px', fontWeight: 'bold' }}>素材分类:</span>
                      {['全部', '人物', '场景', '物品', '视频', '音频', '音效', '其他'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setLibraryCategoryFilter(cat)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '10.5px',
                            border: 'none',
                            cursor: 'pointer',
                            background: libraryCategoryFilter === cat ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            color: libraryCategoryFilter === cat ? '#c084fc' : 'rgba(255,255,255,0.45)',
                            fontWeight: libraryCategoryFilter === cat ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                      {(() => {
                        const filtered = libraryAssets.filter(a => libraryCategoryFilter === '全部' || a.tag === libraryCategoryFilter);
                        if (filtered.length === 0) {
                          return (
                            <div style={{ gridColumn: '1 / span 4', padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                              📭 该分类下暂无预设素材。
                            </div>
                          );
                        }
                        return filtered.map((asset) => {
                          const isSelected = selectedLibraryIds.has(asset.id);
                          return (
                          <div
                            key={asset.id}
                            onClick={() => {
                              const newSet = new Set(selectedLibraryIds);
                              if (newSet.has(asset.id)) {
                                newSet.delete(asset.id);
                              } else {
                                newSet.add(asset.id);
                              }
                              setSelectedLibraryIds(newSet);
                            }}
                            style={{
                              borderRadius: '14px',
                              overflow: 'hidden',
                              border: isSelected ? '2px solid rgba(168, 85, 247, 0.8)' : '1px solid rgba(255,255,255,0.06)',
                              background: 'rgba(0,0,0,0.2)',
                              padding: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              boxShadow: isSelected ? '0 0 20px rgba(168, 85, 247, 0.3)' : 'none',
                              transition: 'all 0.2s',
                              cursor: 'pointer',
                              position: 'relative',
                            }}
                          >
                            {/* 复选框 */}
                            <div style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              background: isSelected ? 'rgba(168, 85, 247, 0.9)' : 'rgba(0,0,0,0.6)',
                              border: `2px solid ${isSelected ? '#a855f7' : 'rgba(255,255,255,0.4)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              color: '#fff',
                              zIndex: 10,
                            }}>
                              {isSelected && '✓'}
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setFullScreenMedia({ url: asset.url, type: asset.type || 'image' });
                              }}
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
                              {(asset.type === 'image' || !asset.type) && <ResolvedMedia url={asset.url} type="image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                              {asset.type === 'video' && <ResolvedMedia url={asset.url} type="video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay loop muted playsInline />}
                              {asset.type === 'audio' && (
                                <div 
                                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '0 8px' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span style={{ fontSize: '20px', marginBottom: '4px' }}>🎵</span>
                                  <ResolvedMedia url={asset.url} type="audio" style={{ width: '100%', height: '24px' }} controls />
                                </div>
                              )}
                              
                              <span style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff' }}>🔍</span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '110px' }} title={asset.name}>
                                {asset.name}
                              </span>
                              <span style={{ fontSize: '8px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', padding: '1px 4px', borderRadius: '4px' }}>
                                {asset.tag || '其他'}
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => onInjectLibraryAsset(asset.url, asset.name)}
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
                                  cursor: 'pointer'
                                }}
                              >
                                ⬇️
                              </button>
                            </div>
                          </div>
                        );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {/* 2.3 虚拟人克隆试听 16:9 华丽网格大对齐 */}
                {assetLargeTab === 'virtual' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* 批量操作栏 */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 12px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
                      <button
                        onClick={() => {
                          const totalCount = virtualAssets.length + 4; // 用户自定义 + 4个官方预设
                          if (selectedVirtualIds.size === totalCount) {
                            setSelectedVirtualIds(new Set());
                          } else {
                            const allIds = [
                              ...virtualAssets.map(a => a.id),
                              'xiaoying', 'ailun', 'leiya', 'sam'
                            ];
                            setSelectedVirtualIds(new Set(allIds));
                          }
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: selectedVirtualIds.size === (virtualAssets.length + 4) ? 'rgba(168, 85, 247, 0.4)' : 'rgba(168, 85, 247, 0.2)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {selectedVirtualIds.size === (virtualAssets.length + 4) ? '☑️ 取消全选' : '☑️ 全选'}
                      </button>
                      <button
                        onClick={() => {
                          const allIds = new Set([
                            ...virtualAssets.map(a => a.id),
                            'xiaoying', 'ailun', 'leiya', 'sam'
                          ]);
                          const newSet = new Set<string>();
                          allIds.forEach(id => { if (!selectedVirtualIds.has(id)) newSet.add(id); });
                          setSelectedVirtualIds(newSet);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        🔄 反选
                      </button>
                      <button
                        onClick={() => {
                          if (selectedVirtualIds.size === 0) return;
                          if (confirm(`确定删除选中的 ${selectedVirtualIds.size} 个虚拟人音色吗？`)) {
                            // 只删除用户自定义音色（非预设）
                            selectedVirtualIds.forEach(id => {
                              if (virtualAssets.some(a => a.id === id)) {
                                onDeleteVirtualAsset(id);
                              }
                            });
                            setSelectedVirtualIds(new Set());
                          }
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: selectedVirtualIds.size > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.04)',
                          color: selectedVirtualIds.size > 0 ? '#fca5a5' : 'rgba(255,255,255,0.3)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: selectedVirtualIds.size > 0 ? 'pointer' : 'not-allowed',
                        }}
                      >
                        🗑️ 批量删除 {selectedVirtualIds.size > 0 && `(${selectedVirtualIds.size})`}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                      {[
                        ...virtualAssets.map(a => ({
                          id: a.id,
                          name: a.name.replace(/[🖼️🎙️🎬📦]/g, '').trim(),
                          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80',
                          desc: '用户自定义高精克隆音色旁白物理成果文件。',
                          audio: a.url,
                          tag: '🎙️ 自定义音色',
                          color: 'rgba(168, 85, 247, 0.85)',
                          isPreset: false
                        })),
                        { id: 'xiaoying', name: '小樱 (暖甜配音)', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80', desc: '治愈、温暖系甜美声线。适合儿童画册配音、都市情感剧旁白。', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', tag: '✨ 官方声音', color: 'rgba(236, 72, 153, 0.85)', isPreset: true },
                        { id: 'ailun', name: '艾伦 (极客男声)', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', desc: '科技感与机械力融合的专业极客男声音色。适合科技、科幻电影片。', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', tag: '✨ 官方声音', color: 'rgba(59, 130, 246, 0.85)', isPreset: true },
                        { id: 'leiya', name: '蕾雅 (御姐音色)', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', desc: '高冷优雅、气场全开的性感女声。常用于时尚奢侈品广告解说。', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', tag: '✨ 官方声音', color: 'rgba(139, 92, 246, 0.85)', isPreset: true },
                        { id: 'sam', name: '山姆 (深沉男播)', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', desc: '浑厚低沉、大师级播报男声。适合经典历史、动作电影史旁白。', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', tag: '✨ 官方声音', color: 'rgba(245, 158, 11, 0.85)', isPreset: true },
                      ].map((v) => {
                        const isSelected = selectedVirtualIds.has(v.id);
                        return (
                      <div
                        key={v.id}
                        onClick={() => {
                          const newSet = new Set(selectedVirtualIds);
                          if (newSet.has(v.id)) {
                            newSet.delete(v.id);
                          } else {
                            newSet.add(v.id);
                          }
                          setSelectedVirtualIds(newSet);
                        }}
                        style={{
                          borderRadius: '14px',
                          overflow: 'hidden',
                          border: isSelected ? '2px solid rgba(168, 85, 247, 0.8)' : '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255, 255, 255, 0.01)',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          boxShadow: isSelected ? '0 0 20px rgba(168, 85, 247, 0.3)' : '0 8px 32px rgba(0,0,0,0.3)',
                          transition: 'all 0.25s',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        {/* 复选框 */}
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          background: isSelected ? 'rgba(168, 85, 247, 0.9)' : 'rgba(0,0,0,0.6)',
                          border: `2px solid ${isSelected ? '#a855f7' : 'rgba(255,255,255,0.4)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: '#fff',
                          zIndex: 10,
                        }}>
                          {isSelected && '✓'}
                        </div>
                        <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: '10px', background: 'rgba(0,0,0,0.4)' }}>
                          <img src={v.avatar} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span
                            style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              background: v.color,
                              color: '#fff',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              fontSize: '9px',
                              fontWeight: 700,
                              zIndex: 5
                            }}
                          >
                            {v.tag}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'space-between' }}>
                          <div style={{ textAlign: 'left' }}>
                            <h4 style={{ fontSize: '11.5px', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={v.name}>
                              {v.name}
                            </h4>
                            <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '25px' }}>
                              {v.desc}
                            </p>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <button
                              onClick={() => handleToggleVoicePlay(v.id, v.audio)}
                              style={{
                                flex: 1,
                                padding: '6px',
                                borderRadius: '6px',
                                background: playingVoiceId === v.id ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                border: playingVoiceId === v.id ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                color: playingVoiceId === v.id ? '#ef4444' : '#fff',
                                fontSize: '10px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              {playingVoiceId === v.id ? '⏸ 暂停' : '🔊 试听'}
                            </button>
                            <button
                              onClick={() => onCloneVirtualVoice(v.name, v.audio)}
                              style={{
                                flex: 1.5,
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
                            >
                              🎙️ 克隆声线
                            </button>
                          </div>
                        </div>
                      </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2.4 其他 LORA 预设 */}
                {assetLargeTab === 'other' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* 批量操作栏 */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 12px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
                      <button
                        onClick={() => {
                          const loraCount = 4; // 固定4个LORA预设
                          if (selectedOtherIds.size === loraCount) {
                            setSelectedOtherIds(new Set());
                          } else {
                            setSelectedOtherIds(new Set(['0', '1', '2', '3']));
                          }
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: selectedOtherIds.size === 4 ? 'rgba(168, 85, 247, 0.4)' : 'rgba(168, 85, 247, 0.2)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {selectedOtherIds.size === 4 ? '☑️ 取消全选' : '☑️ 全选'}
                      </button>
                      <button
                        onClick={() => {
                          const all = new Set(['0', '1', '2', '3']);
                          const newSet = new Set<string>();
                          all.forEach(id => { if (!selectedOtherIds.has(id)) newSet.add(id); });
                          setSelectedOtherIds(newSet);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        🔄 反选
                      </button>
                      <button
                        onClick={() => {
                          if (selectedOtherIds.size === 0) return;
                          alert(`已删除选中的 ${selectedOtherIds.size} 个 LORA 预设（演示模式，实际删除需要后端支持）`);
                          setSelectedOtherIds(new Set());
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: selectedOtherIds.size > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.04)',
                          color: selectedOtherIds.size > 0 ? '#fca5a5' : 'rgba(255,255,255,0.3)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: selectedOtherIds.size > 0 ? 'pointer' : 'not-allowed',
                        }}
                      >
                        🗑️ 批量删除 {selectedOtherIds.size > 0 && `(${selectedOtherIds.size})`}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                      {[
                        { name: '✨ 动漫二次元 LORA 预设', scale: '0.85', desc: '日系唯美画风强化，适用于动漫电影分镜。' },
                        { name: '✨ 水墨江南写意 LORA 权重', scale: '0.70', desc: '中国风泼墨意境渲染，适用于古风艺术短片。' },
                        { name: '✨ 3D 拟真次世代渲染 LORA', scale: '0.90', desc: '虚幻5级别写实大片光影，适用于商用广告。' },
                        { name: '✨ 赛博朋克深空霓虹 LORA', scale: '0.80', desc: '绚丽霓虹灯光轨迹增强，适用于科幻感合成。' },
                      ].map((lora, idx) => {
                        const isSelected = selectedOtherIds.has(String(idx));
                        return (
                      <div
                        key={idx}
                        onClick={() => {
                          const newSet = new Set(selectedOtherIds);
                          const key = String(idx);
                          if (newSet.has(key)) {
                            newSet.delete(key);
                          } else {
                            newSet.add(key);
                          }
                          setSelectedOtherIds(newSet);
                        }}
                        style={{
                          borderRadius: '14px',
                          border: isSelected ? '2px solid rgba(168, 85, 247, 0.8)' : '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255,255,255,0.02)',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          justifyContent: 'space-between',
                          textAlign: 'left',
                          boxShadow: isSelected ? '0 0 20px rgba(168, 85, 247, 0.3)' : 'none',
                          transition: 'all 0.2s',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        {/* 复选框 */}
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          background: isSelected ? 'rgba(168, 85, 247, 0.9)' : 'rgba(0,0,0,0.6)',
                          border: `2px solid ${isSelected ? '#a855f7' : 'rgba(255,255,255,0.4)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: '#fff',
                          zIndex: 10,
                        }}>
                          {isSelected && '✓'}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#fff', margin: 0 }}>{lora.name}</h4>
                          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '6px', lineHeight: '1.4', margin: 0 }}>{lora.desc}</p>
                        </div>
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#a855f7', fontWeight: 700 }}>
                            <span>推荐使用权重:</span>
                            <span>{lora.scale}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`LORA 预设权重 [${lora.scale}] 已成功复制，可在高级菜单的扩展参数中粘贴引用！`);
                            }}
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
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ---------------- 3. HISTORY GENERATED VIEW ---------------- */}
            {activeFloatingPopup === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* 批量操作栏 */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 12px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
                  <button
                    onClick={() => {
                      const items = historyItems.filter(item => item.type === historySubTab);
                      if (selectedHistoryIds.size === items.length) {
                        setSelectedHistoryIds(new Set());
                      } else {
                        setSelectedHistoryIds(new Set(items.map(a => a.id)));
                      }
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'rgba(168, 85, 247, 0.2)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {(() => {
                      const items = historyItems.filter(item => item.type === historySubTab);
                      return selectedHistoryIds.size === items.length ? '☑️ 取消全选' : '☑️ 全选';
                    })()}
                  </button>
                  <button
                    onClick={() => {
                      const items = historyItems.filter(item => item.type === historySubTab);
                      const all = new Set(items.map(a => a.id));
                      const newSet = new Set<string>();
                      all.forEach(id => { if (!selectedHistoryIds.has(id)) newSet.add(id); });
                      setSelectedHistoryIds(newSet);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'rgba(255,255,255,0.08)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    🔄 反选
                  </button>
                  <button
                    onClick={() => {
                      if (selectedHistoryIds.size === 0) return;
                      if (confirm(`确定删除选中的 ${selectedHistoryIds.size} 个历史记录吗？`)) {
                        // 需要从 historyItems 中删除
                        const newHistory = historyItems.filter(item => !selectedHistoryIds.has(item.id));
                        localStorage.setItem('toonflow_history_assets_v2', JSON.stringify(newHistory));
                        setSelectedHistoryIds(new Set());
                        // 触发刷新
                        window.location.reload();
                      }
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: selectedHistoryIds.size > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.04)',
                      color: selectedHistoryIds.size > 0 ? '#fca5a5' : 'rgba(255,255,255,0.3)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: selectedHistoryIds.size > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    🗑️ 批量删除 {selectedHistoryIds.size > 0 && `(${selectedHistoryIds.size})`}
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                  {historyItems.filter(item => item.type === historySubTab).length === 0 ? (
                    <div style={{ gridColumn: '1 / span 4', padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                      📭 暂无此分类下的 AI 成果历史生成记录。
                    </div>
                  ) : (
                    historyItems
                      .filter(item => item.type === historySubTab)
                      .map((item) => {
                        const isSelected = selectedHistoryIds.has(item.id);
                        return (
                        <div
                          key={item.id}
                          onClick={() => {
                            const newSet = new Set(selectedHistoryIds);
                            if (newSet.has(item.id)) {
                              newSet.delete(item.id);
                            } else {
                              newSet.add(item.id);
                            }
                            setSelectedHistoryIds(newSet);
                          }}
                          style={{
                            borderRadius: '14px',
                            overflow: 'hidden',
                            border: isSelected ? '2px solid rgba(168, 85, 247, 0.8)' : '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(0,0,0,0.2)',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            boxShadow: isSelected ? '0 0 20px rgba(168, 85, 247, 0.3)' : 'none',
                            transition: 'all 0.2s',
                            cursor: 'pointer',
                            position: 'relative',
                          }}
                        >
                          {/* 复选框 */}
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            background: isSelected ? 'rgba(168, 85, 247, 0.9)' : 'rgba(0,0,0,0.6)',
                            border: isSelected ? '2px solid #a855f7' : '2px solid rgba(255,255,255,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            color: '#fff',
                            zIndex: 10,
                          }}>
                            {isSelected && '✓'}
                          </div>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullScreenMedia({ url: item.url, type: item.type });
                            }}
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
                            {item.type === 'video' && <ResolvedMedia url={item.url} type="video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay loop muted playsInline />}
                            {item.type === 'audio' && <ResolvedMedia url={item.url} type="audio" style={{ width: '100%', height: '24px' }} controls />}
                            
                            <span style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff' }}>🔍</span>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={item.name}>
                              {item.name}
                            </span>
                            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>
                              物理格式: {item.url.split('.').pop()?.toUpperCase() || 'UNKNOWN'}
                            </span>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onInjectAsset(item.url, item.type, item.name);
                            }}
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
                          >
                            ➕ 装载到当前节点
                          </button>
                        </div>
                      );
                      })
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
