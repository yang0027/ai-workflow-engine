import React from 'react';
import { ResolvedMedia } from './ResolvedMedia';

export interface WorkflowTextareaMentionItem {
  id: string;
  name: string;
  type?: 'image' | 'video' | 'audio' | 'text';
  url?: string;
  token?: string;
}

interface WorkflowTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  mentionItems?: WorkflowTextareaMentionItem[];
  onMentionSelect?: (item: WorkflowTextareaMentionItem, index: number) => void;
}

const BASE_TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  minHeight: '80px',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '12px',
  lineHeight: '1.5',
  padding: '8px 10px',
  outline: 'none',
  resize: 'vertical',
  overflowY: 'auto',
  fontFamily: 'var(--font-sans)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
};

function getMentionToken(item: WorkflowTextareaMentionItem, index: number) {
  if (item.token) return item.token;
  const label = item.type === 'video' ? '视频' : item.type === 'audio' ? '音频' : item.type === 'text' ? '文本' : '图';
  return `@[${label}${index + 1}] `;
}

export const WorkflowTextarea = React.forwardRef<HTMLTextAreaElement, WorkflowTextareaProps>(
  ({
    value,
    onChange,
    mentionItems = [],
    onMentionSelect,
    disabled,
    className,
    style,
    onMouseDown,
    onFocus,
    onBlur,
    rows = 3,
    placeholder,
    ...rest
  }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    const [showMentionList, setShowMentionList] = React.useState(false);
    const [mentionStart, setMentionStart] = React.useState<number | null>(null);

    const setRefs = React.useCallback((node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }, [ref]);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      onChange(nextValue);

      const cursor = event.target.selectionStart;
      const textBeforeCursor = nextValue.slice(0, cursor);
      const lastAt = textBeforeCursor.lastIndexOf('@');
      const shouldOpenMentions = !disabled && mentionItems.length > 0 && lastAt !== -1 && lastAt >= textBeforeCursor.length - 8;
      setMentionStart(shouldOpenMentions ? lastAt : null);
      setShowMentionList(shouldOpenMentions);
    };

    const handleSelectMention = (item: WorkflowTextareaMentionItem, index: number) => {
      const textarea = innerRef.current;
      const cursor = textarea?.selectionStart ?? value.length;
      const start = mentionStart ?? Math.max(0, cursor - 1);
      const token = getMentionToken(item, index);
      const nextValue = value.slice(0, start) + token + value.slice(cursor);
      onChange(nextValue);
      onMentionSelect?.(item, index);
      setShowMentionList(false);

      requestAnimationFrame(() => {
        if (!textarea) return;
        const nextCursor = start + token.length;
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      });
    };

    const mergedStyle: React.CSSProperties = {
      ...BASE_TEXTAREA_STYLE,
      ...style,
      // 强约束：所有工作流文本框视觉规格统一，调用方只能覆盖尺寸、间距等布局属性。
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '12px'
    };

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: style?.flex,
      height: style?.height,
      minHeight: style?.minHeight,
      maxHeight: style?.maxHeight
    };

    return (
      <div style={containerStyle}>
        <style>{`
          .workflow-textarea::placeholder {
            color: rgba(255,255,255,0.4);
          }
        `}</style>
        <textarea
          {...rest}
          ref={(node) => {
            setRefs(node);
            if (node) {
              // 捕获阶段拦截原生 wheel 事件并强行切断，防止 ReactFlow 的全局被动 wheel 监听器捕获它
              const blockWheel = (e: WheelEvent) => {
                e.stopPropagation();
              };
              node.removeEventListener('wheel', blockWheel);
              node.addEventListener('wheel', blockWheel, { capture: true, passive: true });
            }
          }}
          rows={rows}
          value={value}
          aria-disabled={disabled || undefined}
          className={`workflow-textarea nodrag custom-scrollbar${className ? ` ${className}` : ''}`}
          placeholder={placeholder}
          onChange={handleChange}
          onMouseDown={(event) => {
            if (event.button !== 2) {
              event.stopPropagation();
            }
            onMouseDown?.(event);
          }}
          onFocus={(event) => {
            event.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
            onFocus?.(event);
          }}
          onBlur={(event) => {
            event.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            onBlur?.(event);
          }}
          style={mergedStyle}
        />

        {showMentionList && mentionItems.length > 0 && (
          <div
            className="nodrag"
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              position: 'absolute',
              left: 0,
              bottom: 'calc(100% + 4px)',
              width: '220px',
              padding: '4px',
              background: 'rgba(11, 15, 26, 0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
              zIndex: 3000,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', padding: '4px 6px', fontWeight: 700 }}>
              引用上游节点：
            </div>
            {mentionItems.map((item, index) => (
              <div
                key={item.id}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleSelectMention(item, index);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  color: '#fff',
                  background: 'transparent',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(event) => event.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)'}
                onMouseLeave={(event) => event.currentTarget.style.background = 'transparent'}
              >
                {item.url && item.type !== 'audio' && item.type !== 'text' ? (
                  <ResolvedMedia url={item.url} type={item.type === 'video' ? 'video' : 'image'} style={{ width: '16px', height: '16px', borderRadius: '2px', objectFit: 'cover' }} />
                ) : (
                  <span style={{ width: '16px', textAlign: 'center' }}>{item.type === 'audio' ? '♪' : 'T'}</span>
                )}
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                  {item.name} ({getMentionToken(item, index).trim().replace('@[', '').replace(']', '')})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

WorkflowTextarea.displayName = 'WorkflowTextarea';
