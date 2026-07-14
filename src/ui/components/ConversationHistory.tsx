import { useState, useMemo } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState';
import { PlatformBadge } from './PlatformBadge';
import { HealthBadge } from './HealthBadge';
import { Search, MessageCircle, Clock, Trash2, FileText } from 'lucide-preact';
import { Snapshot, PlatformId, HealthStatus } from '../../shared/types';

/**
 * ConversationHistory displays snapshot-based history entries.
 * This reads from the snapshots stored in AppState (persisted to chrome.storage).
 * Future improvement: migrate to IndexedDB for large datasets.
 */
export function ConversationHistory() {
  const snapshots = useAppState(s => s.snapshots);
  const thresholds = useAppState(s => s.thresholds);
  const stats = useAppState(s => s.stats);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformId | 'all'>('all');

  // Derive health status from token count
  const getHealthFromTokens = (tokenCount: number): HealthStatus => {
    const pct = (tokenCount / stats.contextLimit) * 100;
    if (pct >= thresholds.critical) return 'critical';
    if (pct >= thresholds.warning) return 'warning';
    if (pct >= thresholds.caution) return 'caution';
    return 'healthy';
  };

  // Convert snapshots to history entries
  const historyEntries = useMemo(() => {
    return snapshots
      .filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (s.summary?.projectGoal || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPlatform = platformFilter === 'all' || s.platform === platformFilter;
        return matchesSearch && matchesPlatform;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [snapshots, searchQuery, platformFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this history entry?')) return;
    const { storageLayer } = await import('../../storage');
    await storageLayer.updateAppState({
      snapshots: snapshots.filter(s => s.id !== id)
    });
  };

  // Platform filter pills
  const platforms: { id: PlatformId | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'chatgpt', label: 'ChatGPT' },
    { id: 'claude', label: 'Claude' },
    { id: 'gemini', label: 'Gemini' }
  ];

  // Empty state
  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-[var(--text-muted)]" role="status">
        <MessageCircle size={48} className="opacity-20 mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">No History Yet</h3>
        <p className="text-sm max-w-xs">History entries are created from snapshots. Take a snapshot during a conversation to start building your history.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] p-5 gap-4 text-[var(--text-primary)]">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Conversation History</h2>
        <span className="text-xs text-[var(--text-muted)]">{snapshots.length} entries</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Platform filter">
          {platforms.map(p => (
            <button
              key={p.id}
              onClick={() => setPlatformFilter(p.id)}
              role="tab"
              aria-selected={platformFilter === p.id}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                platformFilter === p.id 
                  ? 'bg-[var(--accent-cyan)] text-white border-transparent' 
                  : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--text-muted)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-[var(--text-muted)]" size={16} />
          <input 
            type="text" 
            placeholder="Search history..." 
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[var(--accent-cyan)] text-[var(--text-primary)]"
            aria-label="Search conversation history"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3" role="list" aria-label="History entries">
        {historyEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center text-[var(--text-muted)]">
            <Search size={32} className="opacity-20 mb-2" />
            <p className="text-sm">No entries match your search.</p>
          </div>
        ) : (
          historyEntries.map(entry => (
            <div key={entry.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow" role="listitem">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate">{entry.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <PlatformBadge platform={entry.platform} />
                    <span className="text-xs text-[var(--text-muted)]">{entry.model}</span>
                  </div>
                </div>
                <HealthBadge status={getHealthFromTokens(entry.tokenCount)} />
              </div>
              
              {entry.summary?.projectGoal && (
                <p className="text-xs text-[var(--text-secondary)] mt-2 italic line-clamp-2 leading-relaxed">
                  "{entry.summary.projectGoal}"
                </p>
              )}

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {new Date(entry.timestamp).toLocaleDateString()}
                  </span>
                  <span className="font-bold">{(entry.tokenCount / 1000).toFixed(1)}k tokens</span>
                </div>
                <button 
                  onClick={() => handleDelete(entry.id)} 
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--status-critical)] transition-colors p-1"
                  aria-label={`Delete ${entry.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
