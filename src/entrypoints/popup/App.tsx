import { useState } from 'preact/hooks';
import { useAppState } from '../../ui/hooks/useAppState';
import { ContextMeter } from '../../ui/components/ContextMeter';
import { HealthBadge } from '../../ui/components/HealthBadge';
import { PlatformBadge } from '../../ui/components/PlatformBadge';
import { TransferDialog } from '../../ui/components/TransferDialog';
import { ArrowRightLeft, LayoutDashboard } from 'lucide-preact';

export function App() {
  const status = useAppState(s => s.status);
  const tokenEstimate = useAppState(s => s.tokenEstimate);
  const stats = useAppState(s => s.stats);
  const platform = useAppState(s => s.platform);
  const [showTransfer, setShowTransfer] = useState(false);
  const [copiedTransfer, setCopiedTransfer] = useState(false);
  
  const fillPercentage = (tokenEstimate.count / stats.contextLimit) * 100;

  const openDashboard = () => {
    // In actual implementation, we'd open the side panel
    console.log('Open Dashboard clicked');
  };

  return (
    <div className="flex flex-col h-full p-5 gap-6 relative">
      
      {/* Header */}
      <header className="flex justify-between items-center">
        <h1 className="text-sm font-semibold tracking-wide">AI Context Tracker</h1>
        <PlatformBadge platform={platform} />
      </header>

      {/* Hero: Context Meter */}
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <ContextMeter value={fillPercentage} variant="circular" status={status} />
        <HealthBadge status={status} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="flex flex-col p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Used</span>
          <span className="text-lg font-bold">{(tokenEstimate.count / 1000).toFixed(1)}k</span>
        </div>
        <div className="flex flex-col p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Remaining</span>
          <span className="text-lg font-bold">{((stats.contextLimit - tokenEstimate.count) / 1000).toFixed(1)}k</span>
        </div>
        <div className="flex flex-col p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Turns</span>
          <span className="text-lg font-bold">{stats.turns}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button 
          onClick={() => setShowTransfer(true)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] font-medium text-sm transition-colors"
        >
          <ArrowRightLeft size={16} />
          Transfer
        </button>
        <button 
          onClick={openDashboard}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--accent-gradient)] text-white shadow-lg hover:shadow-xl hover:scale-[1.02] font-medium text-sm transition-all"
        >
          <LayoutDashboard size={16} />
          Dashboard
        </button>
      </div>

      {showTransfer && <TransferDialog onClose={() => setShowTransfer(false)} />}
    </div>
  );
}
