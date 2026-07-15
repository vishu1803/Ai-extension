import { useState, useMemo } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState';
import { PlatformBadge } from './PlatformBadge';
import { Search, Camera, ChevronDown } from 'lucide-preact';
import { PlatformId, HealthStatus } from '../../shared/types';

export function ConversationHistory() {
  const snapshots = useAppState((s) => s.snapshots);
  const thresholds = useAppState((s) => s.thresholds);
  const stats = useAppState((s) => s.stats);

  const [platformFilter, setPlatformFilter] = useState<PlatformId | 'all'>('all');

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

  // Convert snapshots to history entries
  const historyEntries = useMemo(() => {
    return snapshots
      .filter((s) => platformFilter === 'all' || s.platform === platformFilter)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [snapshots, platformFilter]);

  const platforms: { id: PlatformId | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'chatgpt', label: 'ChatGPT' },
    { id: 'claude', label: 'Claude' },
    { id: 'gemini', label: 'Gemini' },
  ];

  // Helper for date formatting
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    const isYesterday =
      d.getDate() === today.getDate() - 1 &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    if (isToday) {
      return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else if (isYesterday) {
      return 'Yesterday';
    } else {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] p-5 pb-6 overflow-y-auto">
      {/* Filter Bar */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex gap-2" role="tablist">
          {platforms.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatformFilter(p.id)}
              role="tab"
              aria-selected={platformFilter === p.id}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                platformFilter === p.id
                  ? 'bg-[#22d3ee] text-black border border-[#22d3ee]'
                  : 'bg-transparent text-[#a1a1aa] border border-[#3f3f46] hover:text-[#f4f4f5]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button className="text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors p-1">
          <Search size={18} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 flex flex-col gap-3" role="list">
        {historyEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-10 text-center text-[#737373]">
            <p className="text-sm">No conversations match your filter.</p>
          </div>
        ) : (
          historyEntries.map((entry) => {
            const pct = Math.round((entry.tokenCount / stats.contextLimit) * 100);
            const status = getHealthFromTokens(entry.tokenCount);

            return (
              <div
                key={entry.id}
                className="bg-[#121216] border border-[#2a2a30] rounded-xl p-4 transition-colors"
                role="listitem"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={entry.platform} />
                    <span className="text-[13px] text-[#e4e4e7]">{entry.model}</span>
                  </div>
                  <span className="text-[12px] text-[#737373]">{formatTime(entry.timestamp)}</span>
                </div>

                <h3 className="text-[15px] font-semibold text-white mb-3 truncate">{entry.name}</h3>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 bg-[#2a2a30] text-[#a1a1aa] text-[11px] font-medium rounded-full">
                      {Math.max(1, Math.round(entry.tokenCount / 2000))} turns
                    </span>
                    <span className="px-2.5 py-1 bg-[#2a2a30] text-[#a1a1aa] text-[11px] font-medium rounded-full">
                      {Math.round(entry.tokenCount / 1000)}K tokens
                    </span>
                    <span className="px-2.5 py-1 bg-[#2a2a30] text-[#a1a1aa] text-[11px] font-medium rounded-full flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${getHealthColor(status)}`}></div>
                      {pct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[#737373]">
                    <button
                      className="hover:text-white transition-colors p-1"
                      aria-label="Snapshot"
                    >
                      <Camera size={14} />
                    </button>
                    <button className="hover:text-white transition-colors p-1">
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer text */}
      <div className="mt-5 text-center text-[12px]">
        <span className="text-[#22d3ee] font-medium cursor-pointer hover:underline">Load More</span>
        <span className="text-[#737373]">
          {' '}
          · Showing {historyEntries.length} of {snapshots.length > 0 ? snapshots.length : 0}{' '}
          conversations
        </span>
      </div>
    </div>
  );
}
