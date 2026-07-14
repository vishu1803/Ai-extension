import { useState } from 'preact/hooks';
import { useAppState } from '../../ui/hooks/useAppState';
import { ContextMeter } from '../../ui/components/ContextMeter';
import { MetricCard } from '../../ui/components/MetricCard';
import { PlatformBadge } from '../../ui/components/PlatformBadge';
import { SnapshotManager } from '../../ui/components/SnapshotManager';
import { ConversationHistory } from '../../ui/components/ConversationHistory';
import { SummaryScreen } from '../../ui/components/SummaryScreen';
import { LayoutDashboard, FileText, Camera, History } from 'lucide-preact';

type Tab = 'dashboard' | 'summary' | 'snapshots' | 'history';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const status = useAppState(s => s.status);
  const tokenEstimate = useAppState(s => s.tokenEstimate);
  const stats = useAppState(s => s.stats);
  const platform = useAppState(s => s.platform);
  
  const fillPercentage = (tokenEstimate.count / stats.contextLimit) * 100;

  const tabs = [
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { id: 'summary', icon: <FileText size={18} />, label: 'Summary' },
    { id: 'history', icon: <History size={18} />, label: 'History' },
    { id: 'snapshots', icon: <Camera size={18} />, label: 'Snapshots' }
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden">
      
      {/* Header Navigation */}
      <header className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 pt-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex-1 flex flex-col items-center gap-1.5 p-2 border-b-2 transition-colors ${activeTab === tab.id ? 'border-[var(--accent-cyan)] text-[var(--accent-cyan)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-t-lg'}`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
          </button>
        ))}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-6 p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Top row: Platform & Model */}
            <div className="flex justify-between items-center">
              <PlatformBadge platform={platform} />
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${tokenEstimate.isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  {tokenEstimate.isStreaming ? 'Streaming...' : 'Idle'}
                </span>
              </div>
            </div>

            {/* Semicircular Gauge */}
            <div className="flex justify-center -mb-4">
              <ContextMeter value={fillPercentage} variant="semicircular" status={status} />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <MetricCard label="Tokens Used" value={(tokenEstimate.count / 1000).toFixed(1) + 'k'} trend="+12%" trendUp={false} />
              <MetricCard label="Context Limit" value={(stats.contextLimit / 1000).toFixed(0) + 'k'} />
              <MetricCard label="Total Turns" value={stats.turns} />
              <MetricCard label="Avg/Turn" value={(stats.avgTokensPerTurn / 1000).toFixed(1) + 'k'} />
            </div>

            {/* Health Signals */}
            <div className="mt-4 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Health Signals</h3>
              
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--text-secondary)]">Context Fill</span>
                  <span className="font-bold">{Math.round(fillPercentage)}%</span>
                </div>
                <div className="w-full bg-[var(--border-subtle)] h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 bg-[var(--status-${status})]`} style={{ width: `${Math.min(fillPercentage, 100)}%` }}></div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)] flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--status-healthy)]"></div>
                    Response Repetition
                  </span>
                  <span className="text-xs text-[var(--status-healthy)] font-medium">Low</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)] flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--status-healthy)]"></div>
                    Instruction Drift
                  </span>
                  <span className="text-xs text-[var(--status-healthy)] font-medium">None</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)] flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--status-healthy)]"></div>
                    Response Length
                  </span>
                  <span className="text-xs text-[var(--status-healthy)] font-medium">Stable</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)] flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--status-caution)]"></div>
                    Turn Count
                  </span>
                  <span className="text-xs text-[var(--status-caution)] font-medium">{stats.turns} turns</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setActiveTab('summary')}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium transition-colors"
                >
                  <FileText size={16} /> View Summary
                </button>
                <button 
                  onClick={() => setActiveTab('snapshots')}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium transition-colors"
                >
                  <Camera size={16} /> Snapshot
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SummaryScreen />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <ConversationHistory />
          </div>
        )}

        {activeTab === 'snapshots' && (
          <div className="h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SnapshotManager />
          </div>
        )}

      </main>
    </div>
  );
}
