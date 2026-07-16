import { useRef, useEffect, useState } from 'preact/hooks';
import { useAppState } from '../../../ui/hooks/useAppState';
import { PlatformBadge } from '../../../ui/components/PlatformBadge';
import { ContextMeter } from '../../../ui/components/ContextMeter';
import { HealthBadge } from '../../../ui/components/HealthBadge';
import { ChevronDown, X, ArrowRight, MousePointer2 } from 'lucide-preact';
import { HealthStatus } from '../../../shared/types';

export function Widget() {
  const status = useAppState((s) => s.status);
  const tokenEstimate = useAppState((s) => s.tokenEstimate);
  const stats = useAppState((s) => s.stats);
  const platform = useAppState((s) => s.platform);
  const widgetCollapsed = useAppState((s) => s.widgetCollapsed);
  const toggleWidget = useAppState((s) => s.toggleWidget);
  const widgetPosition = useAppState((s) => s.widgetPosition);
  const setWidgetPosition = useAppState((s) => s.setWidgetPosition);
  const openSidePanel = useAppState((s) => s.openSidePanel);

  const fillPercentage = Math.min((tokenEstimate.count / stats.contextLimit) * 100, 100);

  const widgetRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Determine actual expanded state (can be forced expanded, or temporarily expanded on hover)
  // For a dynamic island feel, maybe we expand on hover if collapsed, or toggle via click.
  const isExpanded = !widgetCollapsed || isHovered;

  const getStatusColors = (s: HealthStatus) => {
    switch (s) {
      case 'healthy':
        return {
          dot: 'bg-[#4ade80]',
          text: 'text-[#22d3ee]',
          border: 'border-white/10',
          shadow: 'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
          glow: 'shadow-[0_0_12px_rgba(74,222,128,0.4)]',
        };
      case 'caution':
        return {
          dot: 'bg-[#eab308]',
          text: 'text-[#eab308]',
          border: 'border-[#eab308]/40',
          shadow: 'shadow-[0_8px_32px_rgba(234,179,8,0.15)]',
          glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]',
        };
      case 'warning':
        return {
          dot: 'bg-[#f97316]',
          text: 'text-[#f97316]',
          border: 'border-[#f97316]/50',
          shadow: 'shadow-[0_8px_32px_rgba(249,115,22,0.2)]',
          glow: 'shadow-[0_0_12px_rgba(249,115,22,0.6)]',
        };
      case 'critical':
        return {
          dot: 'bg-[#ef4444]',
          text: 'text-[#ef4444]',
          border: 'border-[#ef4444]/60',
          shadow: 'shadow-[0_8px_32px_rgba(239,68,68,0.3)]',
          glow: 'shadow-[0_0_15px_rgba(239,68,68,0.8)]',
        };
      default:
        return {
          dot: 'bg-[#4ade80]',
          text: 'text-[#22d3ee]',
          border: 'border-white/10',
          shadow: 'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
          glow: 'shadow-[0_0_12px_rgba(74,222,128,0.4)]',
        };
    }
  };

  const colors = getStatusColors(status);
  const tokenText =
    tokenEstimate.count >= 1000
      ? (tokenEstimate.count / 1000).toFixed(1) + 'K'
      : tokenEstimate.count.toString();
  const limitText =
    stats.contextLimit >= 1000
      ? (stats.contextLimit / 1000).toFixed(0) + 'K'
      : stats.contextLimit.toString();

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;

      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      if (!hasMoved.current && dx < 5 && dy < 5) return;

      hasMoved.current = true;
      const newLeft = e.clientX - dragOffset.current.x;
      const newTop = e.clientY - dragOffset.current.y;
      
      const height = isExpanded ? 240 : 44;
      const width = isExpanded ? 260 : 160;
      
      const newBottom = window.innerHeight - (newTop + height);

      const maxLeft = window.innerWidth - width;
      const clampedLeft = Math.max(16, Math.min(newLeft, maxLeft - 16));
      const clampedBottom = Math.max(16, Math.min(newBottom, window.innerHeight - height - 16));

      if (widgetRef.current) {
        widgetRef.current.style.left = `${clampedLeft}px`;
        widgetRef.current.style.bottom = `${clampedBottom}px`;
      }
    };

    const onPointerUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.userSelect = '';

      if (hasMoved.current && widgetRef.current) {
        const rect = widgetRef.current.getBoundingClientRect();
        const bottom = window.innerHeight - rect.bottom;
        setWidgetPosition({ x: rect.left, y: bottom });
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isExpanded, setWidgetPosition]);

  const onPointerDown = (e: preact.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;

    isDragging.current = true;
    hasMoved.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };

    const rect = widgetRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      document.body.style.userSelect = 'none';
    }
  };

  const handleWidgetClick = (e: preact.JSX.TargetedMouseEvent<HTMLDivElement>) => {
    if (!hasMoved.current && !(e.target as HTMLElement).closest('button, a')) {
      toggleWidget();
    }
  };

  // -----------------------------------------
  // RENDER DYNAMIC ISLAND
  // -----------------------------------------
  
  // Base structural classes for smooth dynamic transitions
  const containerClasses = [
    'fixed z-[2147483647] flex flex-col items-center select-none overflow-hidden',
    'bg-[#09090b]/85 backdrop-blur-2xl border', // Premium deep dark glassmorphism
    colors.border,
    colors.shadow,
    'transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]', // Snappy but smooth spring-like curve
    isExpanded ? 'w-[260px] h-[240px] rounded-[32px] p-4 cursor-move' : 'w-[140px] h-[40px] rounded-full px-4 justify-center hover:bg-[#121217]/95 cursor-pointer'
  ].join(' ');

  return (
    <div
      ref={widgetRef}
      style={{ left: `${widgetPosition.x}px`, bottom: `${widgetPosition.y}px` }}
      className={containerClasses}
      onPointerDown={onPointerDown}
      onClick={handleWidgetClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ------------------------------------- */}
      {/* COLLAPSED / HEADER STATE              */}
      {/* ------------------------------------- */}
      <div 
        className={`w-full flex items-center justify-between transition-all duration-300 ${isExpanded ? 'h-6 mb-3' : 'h-full'}`}
      >
        {/* Left Side: Status Dot & Percentage */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            {status === 'critical' && (
              <div className="absolute inset-0 rounded-full bg-[#ef4444] opacity-75 animate-ping"></div>
            )}
            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${colors.glow}`}></div>
          </div>
          <span className={`font-semibold tracking-tight transition-all duration-300 ${isExpanded ? 'text-white text-[14px]' : 'text-white text-[15px]'}`}>
            {Math.round(fillPercentage)}%
          </span>
        </div>

        {/* Center line only in collapsed mode */}
        {!isExpanded && (
          <div className="w-[1px] h-[16px] bg-white/10 mx-1"></div>
        )}

        {/* Right Side: Token count or Close Button */}
        <div className="flex items-center">
          {!isExpanded ? (
            <span className={`font-semibold tracking-tight text-[15px] ${colors.text}`}>{tokenText}</span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); toggleWidget(); setIsHovered(false); }}
              className="text-[#a1a1aa] hover:text-white transition-colors cursor-pointer rounded-full bg-white/5 hover:bg-white/10 p-1 pointer-events-auto"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------- */}
      {/* EXPANDED CONTENT AREA                 */}
      {/* ------------------------------------- */}
      <div 
        className={`w-full flex flex-col items-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] origin-top ${
          isExpanded ? 'opacity-100 scale-100 h-full' : 'opacity-0 scale-95 h-0 pointer-events-none'
        }`}
      >
        {/* Circle Meter Area */}
        <div className="relative flex-shrink-0 w-full flex justify-center pointer-events-none -mt-1">
          <ContextMeter value={fillPercentage} variant="mini" status={status} />
        </div>

        {/* Metrics details */}
        <div className="mt-2 flex flex-col items-center gap-1 w-full pointer-events-none">
          <div className="text-[13px] font-medium text-[#a1a1aa] tracking-wide">
            <span className="text-white font-semibold">{tokenText}</span> / {limitText} tokens
          </div>
          <div className="flex items-center gap-2 mt-1.5">
             <HealthBadge status={status} />
             <PlatformBadge platform={platform} />
          </div>
        </div>

        <div className="flex-grow"></div>

        {/* Dashboard Link - Full Width Button style */}
        <button
          onClick={(e) => { e.stopPropagation(); openSidePanel(); }}
          className="w-full h-[42px] mt-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-[14px] flex items-center justify-center gap-2 text-[14px] font-semibold text-white transition-all pointer-events-auto shadow-sm active:scale-95 group"
        >
          View Dashboard <ArrowRight size={14} className="text-[#a1a1aa] group-hover:text-white transition-colors" />
        </button>
      </div>

      {/* Drag Indicator (only visible when expanded) */}
      <div className={`absolute bottom-1.5 flex justify-center w-full pointer-events-none transition-opacity duration-300 ${isExpanded ? 'opacity-30' : 'opacity-0'}`}>
         <div className="w-8 h-1 rounded-full bg-white"></div>
      </div>
    </div>
  );
}
