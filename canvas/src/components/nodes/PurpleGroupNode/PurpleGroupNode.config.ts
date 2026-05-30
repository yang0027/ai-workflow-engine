// PurpleGroupNode.config.ts
// 工作流组配置与静态数据

export interface PurpleGroupNodeProps {
  id: string;
  data: {
    label?: string;
    bgColor?: 'purple' | 'blue' | 'green' | 'amber' | 'rose';
  };
  selected?: boolean;
}

export const THEMES = {
  purple: {
    bg: 'rgba(168, 85, 247, 0.025)',
    border: 'rgba(168, 85, 247, 0.35)',
    borderActive: 'rgba(168, 85, 247, 0.85)',
    glow: 'rgba(168, 85, 247, 0.15)',
    text: 'rgba(168, 85, 247, 1)',
    dot: '#a855f7',
    name: '经典黛紫'
  },
  blue: {
    bg: 'rgba(59, 130, 246, 0.025)',
    border: 'rgba(59, 130, 246, 0.35)',
    borderActive: 'rgba(59, 130, 246, 0.85)',
    glow: 'rgba(59, 130, 246, 0.15)',
    text: 'rgba(59, 130, 246, 1)',
    dot: '#3b82f6',
    name: '极客科技蓝'
  },
  green: {
    bg: 'rgba(16, 185, 129, 0.025)',
    border: 'rgba(16, 185, 129, 0.35)',
    borderActive: 'rgba(16, 185, 129, 0.85)',
    glow: 'rgba(16, 185, 129, 0.15)',
    text: 'rgba(16, 185, 129, 1)',
    dot: '#10b981',
    name: '北极极光绿'
  },
  amber: {
    bg: 'rgba(245, 158, 11, 0.025)',
    border: 'rgba(245, 158, 11, 0.35)',
    borderActive: 'rgba(245, 158, 11, 0.85)',
    glow: 'rgba(245, 158, 11, 0.15)',
    text: 'rgba(245, 158, 11, 1)',
    dot: '#f59e0b',
    name: '落日琥珀黄'
  },
  rose: {
    bg: 'rgba(244, 63, 94, 0.025)',
    border: 'rgba(244, 63, 94, 0.35)',
    borderActive: 'rgba(244, 63, 94, 0.85)',
    glow: 'rgba(244, 63, 94, 0.15)',
    text: 'rgba(244, 63, 94, 1)',
    dot: '#f43f5e',
    name: '浅绯珊瑚粉'
  }
};
