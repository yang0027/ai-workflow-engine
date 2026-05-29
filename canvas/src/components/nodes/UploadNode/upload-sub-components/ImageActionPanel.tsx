import React from 'react';

export interface ImageActionPanelProps {
  id: string;
  fileUrl: string;
  activeSubPanel: 'angle' | 'light' | 'camera' | 'hd' | 'grid' | 'crop' | null;
  setActiveSubPanel: (panel: 'angle' | 'light' | 'camera' | 'hd' | 'grid' | 'crop' | null) => void;
  angleVal: number;
  setAngleVal: (val: number) => void;
  selectedDir: string;
  handleDirSelect: (dir: string) => void;
  lightTab: 'main' | 'fill';
  setLightTab: (tab: 'main' | 'fill') => void;
  lightColor: string;
  setLightColor: (color: string) => void;
  lightIntensity: number;
  setLightIntensity: (val: number) => void;
  selectedLightPreset: string;
  setSelectedLightPreset: (preset: string) => void;
  cropRatio: string;
  setCropRatio: (ratio: string) => void;
  cropOffset: number;
  setCropOffset: (val: number) => void;
  triggerChainAction: (actionLabel: string, mockUrl: string) => void;
  handleOpenFullscreenPreview: () => void;
}

export const ImageActionPanel: React.FC<ImageActionPanelProps> = ({
  activeSubPanel, setActiveSubPanel, angleVal, setAngleVal, selectedDir, handleDirSelect,
  lightTab, setLightTab, lightColor, setLightColor, lightIntensity, setLightIntensity,
  selectedLightPreset, setSelectedLightPreset, cropRatio, setCropRatio, cropOffset, setCropOffset,
  triggerChainAction, handleOpenFullscreenPreview
}) => {
  const directions = ['正面', '侧面', '俯视', '仰视', '左45°', '右45°', '背面', '顶视'];
  const lightPresets = ['林布兰光', '蝴蝶光', '顶光', '侧逆光', '舞台光'];
  const cameraPans = ['横移 (Pan)', '推近 (Push In)', '拉远 (Pull Out)', '环绕 (Orbit)', '升降 (Crane)'];
  const moodRemakes = ['喜悦情绪', '恐惧笼罩', '忧郁深沉', '紧张狂躁', '赛博迷幻'];
  const hdOptions = ['高清重绘', '高清放大', '局部消除', '智能扩图', '人像抠图'];
  const gridOptions = ['4宫格 (2x2)', '9宫格 (3x3)', '16宫格 (4x4)', '25宫格 (5x5)', '自定义分镜'];
  const cropRatios = ['1:1', '4:3', '16:9', '9:16', '自定义'];

  return (
    <div className="nodrag" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      style={{ position: 'absolute', bottom: '190px', left: '50%', transform: 'translateX(-50%)', width: '320px', background: 'rgba(11, 15, 26, 0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(168, 85, 247, 0.1)', borderRadius: '12px', padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: '5px', zIndex: 1000, animation: 'slideUpSub 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <style>{`@keyframes slideUpSub { from { transform: translate(-50%, 15px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}</style>

      {activeSubPanel && (
        <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.04)', padding: '8px', color: '#fff', marginBottom: '2px' }}>
          {activeSubPanel === 'angle' && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: `radial-gradient(circle at 30% 30%, #ffffff 0%, rgba(168, 85, 247, 0.4) 40%, rgba(15, 23, 42, 0.95) 100%)`, boxShadow: '0 0 10px rgba(168, 85, 247, 0.3), inset 0 0 6px rgba(255,255,255,0.2)', transform: `rotateY(${angleVal}deg)`, transition: 'transform 0.1s ease-out' }} />
                <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>3D 角度球</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>旋转角度</span>
                  <span style={{ color: 'rgba(168, 85, 247, 1)', fontWeight: 'bold' }}>{angleVal}°</span>
                </div>
                <input type="range" className="nodrag" onMouseDown={(e) => e.stopPropagation()} min="-180" max="180" value={angleVal} onChange={(e) => setAngleVal(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#a855f7', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '1.5px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginTop: '2px' }}>
                  {directions.map((dir) => (
                    <button key={dir} onClick={() => handleDirSelect(dir)} style={{ padding: '3px 1px', borderRadius: '4px', background: selectedDir === dir ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.02)', border: selectedDir === dir ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(255,255,255,0.05)', color: selectedDir === dir ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: '8.5px', cursor: 'pointer' }}>{dir}</button>
                  ))}
                </div>
                <button onClick={() => triggerChainAction(`角度旋转 ${angleVal}° (${selectedDir})`, 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119')} style={{ marginTop: '2px', padding: '4px', borderRadius: '5px', background: 'rgba(168, 85, 247, 0.25)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#fff', fontSize: '9.5px', fontWeight: 'bold', cursor: 'pointer' }}>🔄 确认生成新角度节点</button>
              </div>
            </div>
          )}

          {activeSubPanel === 'light' && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, #fff 0%, ${lightColor} 45%, rgba(10, 10, 15, 0.95) 100%)`, boxShadow: `0 0 12px ${lightColor}44, inset 0 0 6px rgba(255,255,255,0.15)` }} />
                <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>光源立体球</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '1px' }}>
                  {(['main', 'fill'] as const).map((t) => (
                    <button key={t} onClick={() => setLightTab(t)} style={{ flex: 1, padding: '2px 3px', border: 'none', borderRadius: '3px', background: lightTab === t ? 'rgba(168, 85, 247, 0.2)' : 'transparent', color: '#fff', fontSize: '8.5px', fontWeight: 'bold', cursor: 'pointer' }}>{t === 'main' ? '☀️ 主光' : '🌖 辅光'}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.5)' }}>光色:</span>
                    <input type="color" className="nodrag" onMouseDown={(e) => e.stopPropagation()} value={lightColor} onChange={(e) => setLightColor(e.target.value)} style={{ width: '16px', height: '14px', border: 'none', background: 'none', cursor: 'pointer' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ffffff'].map((c) => (
                      <div key={c} onClick={() => setLightColor(c)} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c, border: lightColor === c ? '1px solid #fff' : 'none', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>照度强度</span>
                  <span style={{ color: 'rgba(168, 85, 247, 1)' }}>{lightIntensity}%</span>
                </div>
                <input type="range" className="nodrag" onMouseDown={(e) => e.stopPropagation()} min="10" max="100" value={lightIntensity} onChange={(e) => setLightIntensity(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#a855f7', height: '2.5px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                  {lightPresets.map((p) => (
                    <button key={p} onClick={() => { setSelectedLightPreset(p); if (p === '林布兰光') { setLightColor('#ec4899'); setLightIntensity(75); } else if (p === '蝴蝶光') { setLightColor('#f59e0b'); setLightIntensity(80); } else if (p === '舞台光') { setLightColor('#a855f7'); setLightIntensity(95); } }}
                      style={{ padding: '2px 4px', borderRadius: '3px', background: selectedLightPreset === p ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.02)', border: '1px solid ' + (selectedLightPreset === p ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.05)'), color: '#fff', fontSize: '8px', cursor: 'pointer' }}>{p}</button>
                  ))}
                </div>
                <button onClick={() => triggerChainAction(`智能打光 (${selectedLightPreset})`, 'https://images.unsplash.com/photo-1541701494587-cb58502866ab')} style={{ marginTop: '2px', padding: '4px', borderRadius: '5px', background: 'linear-gradient(135deg, #a855f7, #ec4899)', border: 'none', color: '#fff', fontSize: '9.5px', fontWeight: 'bold', cursor: 'pointer' }}>💡 确认打光并输出新节点</button>
              </div>
            </div>
          )}

          {activeSubPanel === 'camera' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>📽️ 导演运镜/情绪控制:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '4px 6px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '8.5px', color: '#a855f7', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>🎥 运镜控制</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {cameraPans.map((c) => (
                      <button key={c} onClick={() => triggerChainAction(`运镜-${c}`, 'https://images.unsplash.com/photo-1451187580459-43490279c0fa')} style={{ padding: '3px 4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', color: 'rgba(255,255,255,0.8)', fontSize: '8.5px', textAlign: 'left', cursor: 'pointer' }}>{c}</button>
                    ))}
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '4px 6px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '8.5px', color: '#ec4899', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>🎭 情绪重塑</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {moodRemakes.map((m) => (
                      <button key={m} onClick={() => triggerChainAction(`情绪-${m}`, 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5')} style={{ padding: '3px 4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', color: 'rgba(255,255,255,0.8)', fontSize: '8.5px', textAlign: 'left', cursor: 'pointer' }}>{m}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubPanel === 'hd' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>✨ HD 高清增强选项:</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                {hdOptions.map((opt) => (
                  <button key={opt} onClick={() => triggerChainAction(`HD-${opt}`, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe')} style={{ padding: '4px 2px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '5px', color: '#fff', fontSize: '9px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#a855f7')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}>{opt}</button>
                ))}
              </div>
            </div>
          )}

          {activeSubPanel === 'grid' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>⊞ 分镜网格裁切:</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                {gridOptions.map((opt) => (
                  <button key={opt} onClick={() => triggerChainAction(`网格-${opt}`, 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5')} style={{ padding: '4px 2px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '5px', color: '#fff', fontSize: '9px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ec4899')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}>{opt}</button>
                ))}
              </div>
            </div>
          )}

          {activeSubPanel === 'crop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '9.5px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 'bold' }}>✂️ 比例裁剪</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '48px', background: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(168, 85, 247, 0.6)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', width: cropRatio === '1:1' ? '30px' : cropRatio === '4:3' ? '40px' : cropRatio === '16:9' ? '56px' : cropRatio === '9:16' ? '20px' : '48px', height: cropRatio === '1:1' ? '30px' : cropRatio === '4:3' ? '30px' : cropRatio === '16:9' ? '32px' : cropRatio === '9:16' ? '36px' : '24px', border: '1.5px solid rgba(168, 85, 247, 0.95)', background: 'rgba(168, 85, 247, 0.15)', left: `${cropOffset - (cropRatio === '16:9' ? 35 : 20)}%`, top: '50%', transform: 'translateY(-50%)', transition: 'all 0.2s' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {cropRatios.map((r) => (
                      <button key={r} onClick={() => setCropRatio(r)} style={{ padding: '2px 3px', borderRadius: '4px', background: cropRatio === r ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.02)', border: '1px solid ' + (cropRatio === r ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.05)'), color: '#fff', fontSize: '8px', cursor: 'pointer' }}>{r}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px' }}><span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>裁剪偏移</span><span>{cropOffset}%</span></div>
                  <input type="range" className="nodrag" onMouseDown={(e) => e.stopPropagation()} min="20" max="80" value={cropOffset} onChange={(e) => setCropOffset(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#a855f7', height: '2.5px' }} />
                </div>
              </div>
              <button onClick={() => triggerChainAction(`本地裁剪 (${cropRatio})`, 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853')} style={{ padding: '4px', background: 'rgba(168, 85, 247, 0.25)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '5px', color: '#fff', fontSize: '9.5px', fontWeight: 'bold', cursor: 'pointer' }}>✂️ 确认裁剪并生成连线子节点</button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '3px' }}>
        {[
          { id: 'angle', label: '🔄 角度' },
          { id: 'light', label: '💡 打光' },
          { id: 'panorama', label: '🌐 全景', direct: true, mockUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf' },
          { id: 'camera', label: '🎬 导演' },
          { id: 'hd', label: 'HD 高清' },
          { id: 'fullscreen', label: '⛶ 全屏', directAction: handleOpenFullscreenPreview }
        ].map((tool) => {
          const active = activeSubPanel === tool.id;
          return (
            <button key={tool.id} onClick={() => {
              if (tool.directAction) tool.directAction();
              else if (tool.direct) triggerChainAction('360全景', tool.mockUrl || '');
              else setActiveSubPanel(active ? null : tool.id as any);
            }} style={{ flex: 1, padding: '4px 2px', borderRadius: '5px', border: active ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)', background: active ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.02)', color: active ? '#fff' : 'rgba(255, 255, 255, 0.75)', fontSize: '9px', fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', textAlign: 'center', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#fff'; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)'; } }}>
              {tool.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
