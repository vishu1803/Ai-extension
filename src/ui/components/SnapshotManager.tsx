import { useState, useMemo } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState';
import { Snapshot } from '../../shared/types';
import { storageLayer } from '../../storage';
import { Camera, Search, Trash2, Tag, ArrowRightLeft, Clock, GitCompare, ChevronDown } from 'lucide-preact';
import { PlatformBadge } from './PlatformBadge';
import { HealthBadge } from './HealthBadge';

export function SnapshotManager() {
  const { snapshots, platform, tokenEstimate, currentSummary, status } = useAppState();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    snapshots.forEach(s => s.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [snapshots]);

  const filteredSnapshots = useMemo(() => {
    return snapshots.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (s.summary?.projectGoal || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = activeTag ? s.tags.includes(activeTag) : true;
      return matchesSearch && matchesTag;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [snapshots, searchQuery, activeTag]);

  const handleCreateSnapshot = async () => {
    const newSnapshot: Snapshot = {
      id: 'snap_' + Date.now(),
      name: `Snapshot ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      timestamp: Date.now(),
      platform,
      model: 'Auto-detected',
      tokenCount: tokenEstimate.count,
      tags: [],
      summary: currentSummary
    };
    
    await storageLayer.updateAppState({
      snapshots: [...snapshots, newSnapshot]
    });
  };

  const handleDelete = async (id: string) => {
    await storageLayer.updateAppState({
      snapshots: snapshots.filter(s => s.id !== id)
    });
  };

  const handleRestore = async (snapshot: Snapshot) => {
    if (confirm('Restore this snapshot? This will overwrite your current context memory.')) {
      await storageLayer.updateAppState({
        currentSummary: snapshot.summary,
        // We do not restore tokenCount as the actual DOM observer handles live token counts.
        // The snapshot purely restores memory/summary context.
      });
    }
  };

  const handleAddTag = async (id: string) => {
    const tag = prompt('Enter a new tag:');
    if (!tag) return;
    
    await storageLayer.updateAppState({
      snapshots: snapshots.map(s => {
        if (s.id === id) {
          return { ...s, tags: [...new Set([...s.tags, tag.toLowerCase()])] };
        }
        return s;
      })
    });
  };

  const handleRemoveTag = async (id: string, tagToRemove: string) => {
    await storageLayer.updateAppState({
      snapshots: snapshots.map(s => {
        if (s.id === id) {
          return { ...s, tags: s.tags.filter(t => t !== tagToRemove) };
        }
        return s;
      })
    });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] p-5 gap-5 text-[var(--text-primary)]">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Snapshot Manager</h2>
        <button 
          onClick={handleCreateSnapshot}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-gradient)] text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all hover:scale-105"
        >
          <Camera size={16} /> Take Snapshot
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-[var(--text-muted)]" size={16} />
          <input 
            type="text" 
            placeholder="Search snapshots by name or goal..." 
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[var(--accent-cyan)] text-[var(--text-primary)]"
          />
        </div>
        
        {allTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button 
              onClick={() => setActiveTag(null)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border ${activeTag === null ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent' : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--text-muted)]'}`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button 
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`whitespace-nowrap flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${activeTag === tag ? 'bg-[var(--accent-cyan)] text-[var(--bg-primary)] border-transparent' : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--text-muted)]'}`}
              >
                <Tag size={12} /> {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3">
        {filteredSnapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center text-[var(--text-muted)]">
            <Camera size={48} className="opacity-20 mb-3" />
            <p>No snapshots found.</p>
            <p className="text-xs mt-1">Take a snapshot before making big changes to your conversation.</p>
          </div>
        ) : (
          filteredSnapshots.map(snap => (
            <div key={snap.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
              
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-sm">{snap.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1">
                    <Clock size={12} /> {new Date(snap.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={snap.platform} />
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--bg-tertiary)]">{(snap.tokenCount / 1000).toFixed(1)}k tokens</span>
                </div>
              </div>

              {snap.summary?.projectGoal && (
                <p className="text-xs text-[var(--text-secondary)] italic line-clamp-2">
                  "{snap.summary.projectGoal}"
                </p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {snap.tags.map(t => (
                  <span key={t} className="flex items-center gap-1 text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-2 py-1 rounded-md">
                    {t}
                    <button onClick={() => handleRemoveTag(snap.id, t)} className="hover:text-[var(--status-critical)] transition-colors"><X size={10} /></button>
                  </span>
                ))}
                <button onClick={() => handleAddTag(snap.id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-cyan)] font-medium px-2 py-1 border border-dashed border-[var(--border-subtle)] rounded-md transition-colors">+ Tag</button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)] mt-1">
                <button onClick={() => setCompareId(compareId === snap.id ? null : snap.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors font-medium">
                  <GitCompare size={14} /> Compare
                </button>
                <button onClick={() => handleDelete(snap.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md text-[var(--status-critical)] hover:bg-[rgba(239,68,68,0.1)] transition-colors">
                  <Trash2 size={14} /> Delete
                </button>
                <button onClick={() => handleRestore(snap)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-colors font-medium border border-[var(--border-subtle)]">
                  <ArrowRightLeft size={14} /> Restore Context
                </button>
              </div>

              {compareId === snap.id && (
                <div className="mt-2 p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-subtle)] text-xs animate-in slide-in-from-top-2">
                  <h4 className="font-semibold mb-2 flex items-center gap-1.5 text-[var(--text-secondary)]"><GitCompare size={12} /> Changes since snapshot</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[var(--text-muted)] block mb-0.5">Tokens</span>
                      <span className={`font-bold ${tokenEstimate.count > snap.tokenCount ? 'text-[var(--status-critical)]' : 'text-[var(--status-healthy)]'}`}>
                        {tokenEstimate.count > snap.tokenCount ? '+' : ''}{((tokenEstimate.count - snap.tokenCount) / 1000).toFixed(1)}k
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block mb-0.5">Tasks Completed</span>
                      <span className="font-bold">
                        {Math.max(0, (currentSummary?.completedTasks.length || 0) - (snap.summary?.completedTasks.length || 0))} new
                      </span>
                    </div>
                  </div>
                  {(currentSummary?.facts.length || 0) !== (snap.summary?.facts.length || 0) && (
                    <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                      <span className="text-[var(--text-muted)] block mb-0.5">Knowledge Added</span>
                      <span className="font-medium text-[var(--text-secondary)]">
                        {Math.abs((currentSummary?.facts.length || 0) - (snap.summary?.facts.length || 0))} new facts learned
                      </span>
                    </div>
                  )}
                </div>
              )}

            </div>
          ))
        )}
      </div>

    </div>
  );
}

// X icon for removing tags
function X({ size = 24, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
