import { useRef, useEffect } from 'preact/hooks';
import { useAppState } from '../../../ui/hooks/useAppState';
import { PlatformBadge } from '../../../ui/components/PlatformBadge';
import { ContextMeter } from '../../../ui/components/ContextMeter';
import { HealthBadge } from '../../../ui/components/HealthBadge';
import { ChevronDown, X, ArrowRight } from 'lucide-preact';
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

  const getStatusColors = (s: HealthStatus) => {
    switch (s) {
      case 'healthy':
        return {
          dot: 'bg-[#4ade80]',
          text: 'text-[#22d3ee]',
          border: 'border-white/10',
          shadow: '',
        };
      case 'caution':
        return {
          dot: 'bg-[#eab308]',
          text: 'text-[#eab308]',
          border: 'border-[#eab308]/50',
          shadow: 'shadow-[inset_0_0_15px_rgba(234,179,8,0.2),_0_0_15px_rgba(234,179,8,0.2)]',
        };
      case 'warning':
        return {
          dot: 'bg-[#f97316]',
          text: 'text-[#f97316]',
          border: 'border-[#f97316]/50',
          shadow: 'shadow-[inset_0_0_15px_rgba(249,115,22,0.3),_0_0_15px_rgba(249,115,22,0.3)]',
        };
      case 'critical':
        return {
          dot: 'bg-[#ef4444]',
          text: 'text-[#ef4444]',
          border: 'border-[#ef4444]/60',
          shadow: 'shadow-[inset_0_0_20px_rgba(239,68,68,0.4),_0_0_20px_rgba(239,68,68,0.4)]',
        };
      default:
        return {
          dot: 'bg-[#4ade80]',
          text: 'text-[#22d3ee]',
          border: 'border-white/10',
          shadow: '',
        };
    }
  };

  const colors = getStatusColors(status);
  const tokenText =
    tokenEstimate.count >= 1000
      ? (tokenEstimate.count / 1000).toFixed(0) + 'K'
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
      const rect = widgetRef.current?.getBoundingClientRect();
      const height = rect ? rect.height : widgetCollapsed ? 36 : 200;
      const width = rect ? rect.width : widgetCollapsed ? 180 : 240;
      const newBottom = window.innerHeight - (newTop + height);

      const maxLeft = window.innerWidth - width;
      const clampedLeft = Math.max(0, Math.min(newLeft, maxLeft));
      const clampedBottom = Math.max(0, Math.min(newBottom, window.innerHeight - height));

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
  }, [widgetCollapsed, setWidgetPosition]);

  const onPointerDown = (e: preact.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    // Prevent drag if clicking a button
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

  const handlePillClick = () => {
    if (!hasMoved.current) {
      toggleWidget();
    }
  };

  const style = {
    position: 'fixed' as const,
    left: `${widgetPosition.x}px`,
    bottom: `${widgetPosition.y}px`,
    zIndex: 2147483647,
  };

  if (widgetCollapsed) {
    return (
      <div
        ref={widgetRef}
        style={style}
        onPointerDown={onPointerDown}
        onClick={handlePillClick}
        className={`flex items-center justify-between w-[180px] h-[36px] rounded-full bg-[#0f0f14]/85 backdrop-blur-[18px] border px-4 cursor-pointer select-none hover:bg-[#151520]/90 transition-all ${colors.border} ${colors.shadow}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            {status === 'critical' && (
              <div className="absolute inset-0 rounded-full bg-[#ef4444] opacity-75 animate-ping"></div>
            )}
            <div
              className={`w-2.5 h-2.5 rounded-full ${colors.dot} shadow-[0_0_8px_currentColor]`}
            ></div>
          </div>
          <span className="text-white font-bold text-[14px] leading-none">
            {Math.round(fillPercentage)}%
          </span>
        </div>

        <div className="w-[1px] h-[16px] bg-white/10 mx-2"></div>

        <div className="flex items-center gap-2">
          <span className={`font-bold text-[14px] leading-none ${colors.text}`}>{tokenText}</span>
          <ChevronDown size={16} className="text-[#a1a1aa]" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={widgetRef}
      style={style}
      className={`w-[240px] h-[200px] rounded-2xl bg-[#0f0f14]/90 backdrop-blur-[18px] border border-[#2a2a30] shadow-2xl flex flex-col items-center select-none ${colors.shadow}`}
    >
      {/* Header Area (Draggable) */}
      <div
        className="w-full flex justify-between items-center px-4 pt-3 pb-1 cursor-move"
        onPointerDown={onPointerDown}
      >
        <div className="text-[13px] font-semibold text-white">Context Tracker</div>
        <button
          onClick={toggleWidget}
          className="text-[#a1a1aa] hover:text-white transition-colors cursor-pointer rounded-md hover:bg-white/10 p-0.5 pointer-events-auto"
        >
          <X size={14} />
        </button>
      </div>

      {/* Circle Meter */}
      <div className="mt-1 relative pointer-events-none">
        <ContextMeter value={fillPercentage} variant="mini" status={status} />
      </div>

      {/* Token text */}
      <div className="mt-2 text-[12px] font-medium text-[#a1a1aa] pointer-events-none">
        {tokenText} / {limitText} tokens
      </div>

      {/* Badges */}
      <div className="mt-2 flex flex-col items-center gap-1.5 pointer-events-none">
        <HealthBadge status={status} />
        <PlatformBadge platform={platform} />
      </div>

      <div className="w-full px-5 mt-3 pointer-events-none">
        <div className="w-full h-[3px] bg-[#eab308] rounded-full opacity-80"></div>
      </div>

      {/* Dashboard Link */}
      <button
        onClick={openSidePanel}
        className="mt-3 flex items-center gap-1 text-[13px] font-medium text-[#22d3ee] hover:text-cyan-300 transition-colors cursor-pointer"
      >
        Dashboard <ArrowRight size={14} />
      </button>
    </div>
  );
}
