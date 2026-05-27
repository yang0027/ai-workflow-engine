import React, { useState, useEffect } from 'react';
import { SelfTemplateService, SelfCreatedTemplate } from '../../services/self-template.service';
import { useReactFlow } from '@xyflow/react';

export interface SelfCreatedTabProps {
  onSpawnSelfTemplate: (nodes: any[], edges: any[]) => void;
  onClose: () => void;
}

export const SelfCreatedTab: React.FC<SelfCreatedTabProps> = ({
  onSpawnSelfTemplate,
  onClose
}) => {
  const { screenToFlowPosition } = useReactFlow();
  const [templates, setTemplates] = useState<SelfCreatedTemplate[]>([]);

  // 1. 物理拉取自建模板并绑定自愈事件监听
  const refreshTemplates = () => {
    setTemplates(SelfTemplateService.getTemplates());
  };

  useEffect(() => {
    refreshTemplates();

    // 绑定画布打包成功时的自动刷新事件
    window.addEventListener('self_templates_updated', refreshTemplates);
    return () => {
      window.removeEventListener('self_templates_updated', refreshTemplates);
    };
  }, []);

  // 2. 物理删除模板
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确认要物理删除该自建画布模板吗？该操作不可撤销。')) {
      SelfTemplateService.deleteTemplate(id);
      refreshTemplates();
    }
  };

  // 3. 物理装载（实例化连线网络，并自动防碰撞自愈）
  const handleSpawn = (tpl: SelfCreatedTemplate) => {
    // 获取当前视口的中心坐标，让生成的组合完美对齐在用户的当前视线中心
    let viewportCenter = { x: 300, y: 300 };
    try {
      viewportCenter = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
    } catch (err) {}

    // 执行防 ID 碰撞和拓扑连线自愈重新生成
    const healed = SelfTemplateService.healAndPrepareData(tpl, viewportCenter);
    
    // 执行回调灌装到画布
    onSpawnSelfTemplate(healed.nodes, healed.edges);
    
    // 优雅关闭大窗，让用户立刻看到连线网络生成的震撼瞬间
    onClose();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
      
      {/* 🔮 科技感磨砂顶部通知横幅 */}
      <div
        style={{
          padding: '20px 24px',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.02) 100%)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.05)',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '32px', filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))' }}>🧩</span>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: 0 }}>
              自建画布连线网络大仓 (Custom Blueprints)
            </h3>
            <p style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', margin: 0, lineHeight: '1.4' }}>
              在这里，您可以无限次、无缝复用自己先前打包好的节点组合。
              装载引擎会自动重塑所有节点的 ID 标识与级联连线网络，彻底阻断任何碰撞和数据污染，实现云原生级丝滑载入。
            </p>
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px',
          padding: '6px 14px',
          fontSize: '11px',
          color: '#c084fc',
          fontWeight: 'bold',
          whiteSpace: 'nowrap'
        }}>
          共存盘 {templates.length} 个模板
        </div>
      </div>

      {templates.length === 0 ? (
        /* 空白提示 */
        <div
          style={{
            textAlign: 'center',
            padding: '120px 0',
            color: 'rgba(255,255,255,0.3)',
            border: '1px dashed rgba(255,255,255,0.06)',
            borderRadius: '20px',
            background: 'rgba(255,255,255,0.01)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <span style={{ fontSize: '36px' }}>📭</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>暂无任何自建画布模板</div>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', maxWidth: '320px', lineHeight: '1.5', margin: 0 }}>
            请直接在画布上框选 **2 个以上** 的节点，在自动呈现的悬浮菜单中点击 **「💾 打包存为模板」** 完成存盘，即可在这里实时查看！
          </p>
        </div>
      ) : (
        /* 模板列表网格 */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {templates.map(tpl => (
            <div
              key={tpl.id}
              onClick={() => handleSpawn(tpl)}
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255, 255, 255, 0.01)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(168, 85, 247, 0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* 物理删除悬浮按钮 */}
              <button
                onClick={(e) => handleDelete(tpl.id, e)}
                style={{
                  position: 'absolute',
                  top: '18px',
                  right: '18px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: 0,
                  zIndex: 20,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                title="删除该模板"
              >
                ×
              </button>

              {/* 封面图片 */}
              <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: '12px', background: 'rgba(0,0,0,0.4)' }}>
                <img src={tpl.cover} alt={tpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                
                {/* 物理角标：节点数与连线数 */}
                <span
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    background: 'rgba(11, 15, 26, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(8px)',
                    color: '#c084fc',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    fontSize: '9px',
                    fontWeight: 700,
                    zIndex: 5
                  }}
                >
                  🧩 {tpl.nodeCount} 节点 · 🔗 {tpl.edgeCount} 连线
                </span>
              </div>

              {/* 文字描述 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'space-between', textAlign: 'left' }}>
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#fff', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={tpl.name}>
                    {tpl.name}
                  </h4>
                  <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', lineHeight: '1.45', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '26px', margin: 0 }}>
                    {tpl.description}
                  </p>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleSpawn(tpl); }}
                  style={{
                    marginTop: '8px',
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.35)',
                    color: '#d8b4fe',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    outline: 'none',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.3)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)';
                    e.currentTarget.style.color = '#d8b4fe';
                  }}
                >
                  ➕ 装载连线网络到画布
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
