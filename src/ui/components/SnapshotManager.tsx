import { useAppState } from '../hooks/useAppState';
import { Snapshot, HealthStatus } from '../../shared/types';
import { storageLayer } from '../../storage';
import { Camera, Trash2, ArrowRightLeft, Edit2, Upload, Plus } from 'lucide-preact';
import { useMemo } from 'preact/hooks';

export function SnapshotManager() {
  const { snapshots, platform, tokenEstimate, currentSummary, stats, thresholds } = useAppState();

  const handleCreateSnapshot = async () => {
    const newSnapshot: Snapshot = {
      id: 'snap_' + Date.now(),
      name: `Snapshot ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      timestamp: Date.now(),
      platform,
      model: 'Auto-detected',
      tokenCount: tokenEstimate.count,
      tags: [],
      summary: currentSummary,
    };

    await storageLayer.updateAppState({
      snapshots: [newSnapshot, ...snapshots],
    });
  };

  const handleDelete = async (id: string) => {
    await storageLayer.updateAppState({
      snapshots: snapshots.filter((s) => s.id !== id),
    });
  };

  const handleRestore = async (snapshot: Snapshot) => {
    if (confirm('Restore this snapshot? This will overwrite your current context memory.')) {
      await storageLayer.updateAppState({
        currentSummary: snapshot.summary,
      });
    }
  };

  // Derive health status from token count
  const getHealthFromTokens = (tokenCount: number): HealthStatus => {
    const pct = (tokenCount / stats.contextLimit) * 100;
    if (pct >= thresholds.critical) return 'critical';
    if (pct >= thresholds.warning) return 'warning';
    if (pct >= thresholds.caution) return 'caution';
    return 'healthy';
  };

  const getHealthColor = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return 'bg-[#4ade80]';
      case 'caution':
        return 'bg-[#eab308]';
      case 'warning':
        return 'bg-[#f59e0b]';
      case 'critical':
        return 'bg-[#ef4444]';
      default:
        return 'bg-[#a1a1aa]';
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    if (isToday) {
      return `Today ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };

  const sortedSnapshots = useMemo(() => {
    return [...snapshots].sort((a, b) => b.timestamp - a.timestamp);
  }, [snapshots]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 pb-24">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-xl font-bold text-white">Snapshots</h2>
          <button
            onClick={handleCreateSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#22d3ee] text-[#22d3ee] rounded-md text-[13px] font-medium hover:bg-[#22d3ee]/10 transition-colors"
          >
            <Camera size={14} /> New Snapshot
          </button>
        </div>
        <p className="text-[13px] text-[#a1a1aa] mb-5 leading-relaxed">
          Save conversation state at any point. Restore
          <br />
          or compare later.
        </p>

        {/* List */}
        <div className="flex flex-col gap-3 mb-6">
          {sortedSnapshots.map((snap, idx) => {
            const isFirst = idx === 0;
            const pct = Math.round((snap.tokenCount / stats.contextLimit) * 100);
            const status = getHealthFromTokens(snap.tokenCount);
            const platformName =
              snap.platform === 'chatgpt'
                ? 'ChatGPT'
                : snap.platform === 'claude'
                  ? 'Claude'
                  : snap.platform === 'gemini'
                    ? 'Gemini'
                    : 'Auto-detected';

            return (
              <div
                key={snap.id}
                className={`rounded-xl flex flex-col overflow-hidden ${
                  isFirst
                    ? 'bg-[#121216] border border-[#22d3ee] shadow-[0_0_10px_rgba(34,211,238,0.1)] relative'
                    : 'bg-[#121216] border border-[#2a2a30]'
                }`}
              >
                {isFirst && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#22d3ee]"></div>}

                <div className="p-4 flex flex-col gap-2 relative">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[15px] text-white">{snap.name}</h3>
                    <Edit2 size={12} className="text-[#a1a1aa] cursor-pointer hover:text-white" />
                  </div>

                  <div className="text-[13px] text-[#a1a1aa]">
                    {platformName} · {Math.max(1, Math.round(snap.tokenCount / 2000))} turns ·{' '}
                    {Math.round(snap.tokenCount / 1000)}K tokens
                  </div>

                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[13px] text-[#a1a1aa]">{formatTime(snap.timestamp)}</span>
                    <span className="px-2.5 py-1 bg-[#2a2a30] text-[#a1a1aa] text-[11px] font-medium rounded-full flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${getHealthColor(status)}`}></div>
                      {pct}%
                    </span>
                  </div>
                </div>

                {isFirst && (
                  <div className="flex gap-4 px-4 py-3 border-t border-[#2a2a30] bg-[#ffffff02]">
                    <button
                      onClick={() => handleRestore(snap)}
                      className="flex items-center gap-1.5 text-[13px] text-[#a1a1aa] hover:text-white transition-colors"
                    >
                      <ArrowRightLeft size={14} /> Restore
                    </button>
                    <button className="flex items-center gap-1.5 text-[13px] text-[#a1a1aa] hover:text-white transition-colors">
                      <Upload size={14} /> Export
                    </button>
                    <button
                      onClick={() => handleDelete(snap.id)}
                      className="flex items-center gap-1.5 text-[13px] text-[#ef4444] hover:text-red-400 transition-colors ml-auto"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Compare Snapshots Box */}
        <div className="border border-dashed border-[#3f3f46] rounded-xl p-4 flex flex-col items-center text-center">
          <h3 className="font-semibold text-white mb-1 text-[15px]">Compare Snapshots</h3>
          <p className="text-[13px] text-[#a1a1aa] mb-4">
            Select two snapshots to see what changed
          </p>

          <div className="flex w-full gap-3 mb-3">
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-[#3f3f46] rounded-lg text-[13px] text-[#a1a1aa] hover:text-white hover:border-[#a1a1aa] transition-colors">
              <Plus size={14} /> Snapshot A
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-[#3f3f46] rounded-lg text-[13px] text-[#a1a1aa] hover:text-white hover:border-[#a1a1aa] transition-colors">
              <Plus size={14} /> Snapshot B
            </button>
          </div>

          <button className="w-full py-2.5 bg-[#2a2a30] text-[#737373] rounded-lg text-[13px] font-medium cursor-not-allowed">
            Compare
          </button>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#0a0a0c] border-t border-[#2a2a30] px-5 py-4">
        <div className="flex justify-between items-center text-[12px] text-[#a1a1aa] mb-2">
          <span>{snapshots.length} snapshots · 2.4 MB used</span>
        </div>
        <div className="w-full h-1 bg-[#2a2a30] rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full" style={{ width: '35%' }}></div>
        </div>
      </div>
    </div>
  );
}
