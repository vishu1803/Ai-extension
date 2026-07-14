import { useRef, useEffect } from 'preact/hooks';
import { useAppState } from '../../../ui/hooks/useAppState';
import { ContextMeter } from '../../../ui/components/ContextMeter';
import { HealthBadge } from '../../../ui/components/HealthBadge';

export function Widget() {
  const status = useAppState(s => s.status);
  const tokenEstimate = useAppState(s => s.tokenEstimate);
  const stats = useAppState(s => s.stats);
  const widgetCollapsed = useAppState(s => s.widgetCollapsed);
  const toggleWidget = useAppState(s => s.toggleWidget);
  const widgetPosition = useAppState(s => s.widgetPosition);
  const setWidgetPosition = useAppState(s => s.setWidgetPosition);
  
  const fillPercentage = (tokenEstimate.count / stats.contextLimit) * 100;
  
  const widgetRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Compute glow border based on health status
  const glowColors = {
    healthy: 'border-transparent',
    caution: 'border-[var(--status-caution)] shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    warning: 'border-[var(--status-warning)] shadow-[0_0_20px_rgba(249,115,22,0.5)]',
    critical: 'border-[var(--status-critical)] shadow-[0_0_25px_rgba(239,68,68,0.7)]'
  };

  const bgStyle = 'bg-[var(--bg-glass)] backdrop-blur-xl border border-[var(--border-subtle)]';

  // Handle Dragging
  const onPointerDown = (e: preact.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    // Only allow drag from the drag handle area to not interfere with clicks
    if ((e.target as HTMLElement).closest('button')) return;
    
    isDragging.current = true;
    const rect = widgetRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      // Lock body pointer events during drag for smoothness
      document.body.style.userSelect = 'none';
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: preact.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    
    // Calculate new position
    // Note: widgetPosition stores {x, y} as left, bottom coordinates!
    const newLeft = e.clientX - dragOffset.current.x;
    
    // We need to calculate bottom based on window innerHeight
    // rect.top = e.clientY - dragOffset.current.y
    // bottom = window.innerHeight - (rect.top + rect.height)
    const newTop = e.clientY - dragOffset.current.y;
    const rect = widgetRef.current?.getBoundingClientRect();
    const height = rect ? rect.height : (widgetCollapsed ? 40 : 160);
    const newBottom = window.innerHeight - (newTop + height);
    
    // Constrain to screen bounds
    const maxLeft = window.innerWidth - (rect ? rect.width : 240);
    const clampedLeft = Math.max(0, Math.min(newLeft, maxLeft));
    const clampedBottom = Math.max(0, Math.min(newBottom, window.innerHeight - height));
    
    // For smooth visual updates during drag (without spamming storage)
    if (widgetRef.current) {
      widgetRef.current.style.left = `${clampedLeft}px`;
      widgetRef.current.style.bottom = `${clampedBottom}px`;
    }
  };

  const onPointerUp = (e: preact.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (isDragging.current) {
      isDragging.current = false;
      document.body.style.userSelect = '';
      e.currentTarget.releasePointerCapture(e.pointerId);
      
      // Save final position to state
      if (widgetRef.current) {
        const rect = widgetRef.current.getBoundingClientRect();
        const bottom = window.innerHeight - rect.bottom;
        setWidgetPosition({ x: rect.left, y: bottom });
      }
    }
  };

  // Draggable style
  const style = {
    position: 'fixed' as const,
    left: `${widgetPosition.x}px`,
    bottom: `${widgetPosition.y}px`,
    zIndex: 2147483647 // Max z-index to stay on top
  };

  if (widgetCollapsed) {
    return (
      <div 
        ref={widgetRef}
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={toggleWidget}
        className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:scale-105 transition-transform duration-200 ease-out widget-collapsed ${glowColors[status]} touch-none`}
        title="Double-click to expand, drag to move"
      >
        <div className="flex items-center justify-center relative w-3 h-3">
          {status === 'critical' && <div className="absolute inset-0 rounded-full bg-[var(--status-critical)] opacity-75 animate-[pulse-ring_2s_infinite]"></div>}
          <div className={`w-3 h-3 rounded-full bg-[var(--status-${status})]`}></div>
        </div>
        <span className="text-[var(--text-primary)] font-bold text-sm">{Math.round(fillPercentage)}%</span>
        <span className="text-[var(--text-secondary)] font-medium text-xs">{(tokenEstimate.count / 1000).toFixed(1)}k</span>
      </div>
    );
  }

  // Expanded View
  return (
    <div 
      ref={widgetRef}
      style={style}
      className={`flex flex-col gap-4 p-5 rounded-2xl w-[240px] shadow-[var(--shadow-card)] transition-shadow duration-200 ease-out ${bgStyle} ${glowColors[status]} touch-none`}
    >
      <div 
        className="flex justify-between items-center cursor-move"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <HealthBadge status={status} />
        <button onClick={toggleWidget} className="text-[var(--text-secondary)] hover:text-white transition-colors p-1" aria-label="Collapse widget">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
        </button>
      </div>
      
      <div className="flex justify-center -my-2 pointer-events-none">
        <ContextMeter value={fillPercentage} variant="mini" status={status} />
      </div>

      <div className="flex justify-between items-center text-sm border-t border-[var(--border-subtle)] pt-3 pointer-events-none">
        <span className="text-[var(--text-secondary)] font-medium">Est. Tokens</span>
        <span className="font-bold text-white">{(tokenEstimate.count / 1000).toFixed(1)}k</span>
      </div>
    </div>
  );
}
