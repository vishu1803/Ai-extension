import { useState, useMemo } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState';
import { RefreshCw, Copy, Check, FileText, AlertCircle } from 'lucide-preact';
import { StructuredSummary } from '../../engines/summary/types';

export function SummaryScreen() {
  const currentSummary = useAppState(s => s.currentSummary) as StructuredSummary | null;
  const stats = useAppState(s => s.stats);
  const platform = useAppState(s => s.platform);
  
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Build display sections from the real summary data
  const sections = useMemo(() => {
    if (!currentSummary) return [];
    const s: { label: string; items: string[] }[] = [];
    
    if (currentSummary.projectGoal) s.push({ label: '🎯 Project Goal', items: [currentSummary.projectGoal] });
    if (currentSummary.facts.length > 0) s.push({ label: '📋 Facts', items: currentSummary.facts });
    if (currentSummary.architectureDecisions.length > 0) s.push({ label: '🏗️ Architecture Decisions', items: currentSummary.architectureDecisions });
    if (currentSummary.filesCreated.length > 0) s.push({ label: '📁 Files Created', items: currentSummary.filesCreated });
    if (currentSummary.completedTasks.length > 0) s.push({ label: '✅ Completed Tasks', items: currentSummary.completedTasks });
    if (currentSummary.pendingTasks.length > 0) s.push({ label: '⏳ Pending Tasks', items: currentSummary.pendingTasks });
    if (currentSummary.bugs.length > 0) s.push({ label: '🐛 Bugs', items: currentSummary.bugs });
    if (currentSummary.links.length > 0) s.push({ label: '🔗 Links', items: currentSummary.links });
    if (currentSummary.apis.length > 0) s.push({ label: '⚡ APIs', items: currentSummary.apis });
    if (currentSummary.userPreferences.length > 0) s.push({ label: '⚙️ User Preferences', items: currentSummary.userPreferences });
    if (currentSummary.currentDiscussion) s.push({ label: '💬 Current Discussion', items: [currentSummary.currentDiscussion] });
    
    return s;
  }, [currentSummary]);

  // Derive topic tags from actual data
  const topicTags = useMemo(() => {
    if (!currentSummary) return [];
    const tags: string[] = [];
    if (currentSummary.projectGoal) tags.push('Goal Defined');
    if (currentSummary.codeGenerated) tags.push('Code Generated');
    if (currentSummary.filesCreated.length > 0) tags.push(`${currentSummary.filesCreated.length} Files`);
    if (currentSummary.bugs.length > 0) tags.push(`${currentSummary.bugs.length} Bugs`);
    if (currentSummary.pendingTasks.length > 0) tags.push(`${currentSummary.pendingTasks.length} Pending`);
    if (currentSummary.completedTasks.length > 0) tags.push(`${currentSummary.completedTasks.length} Done`);
    if (currentSummary.links.length > 0) tags.push(`${currentSummary.links.length} Links`);
    return tags.slice(0, 6); // Max 6 tags
  }, [currentSummary]);

  const handleCopy = async () => {
    if (!currentSummary) return;
    const text = sections.map(s => `${s.label}\n${s.items.map(i => `  • ${i}`).join('\n')}`).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    setRegenerating(true);
    // The summary engine runs in the background — send a message to trigger it
    import('../../messaging/client').then(m => {
      m.messaging.sendToBackground({ type: 'GET_STATE' }).then(() => {
        setRegenerating(false);
      });
    });
    setTimeout(() => setRegenerating(false), 1500);
  };

  // Compute coverage estimate based on what fields are populated
  const coverage = useMemo(() => {
    if (!currentSummary) return 0;
    const fields = [
      currentSummary.projectGoal,
      currentSummary.facts.length > 0,
      currentSummary.architectureDecisions.length > 0,
      currentSummary.completedTasks.length > 0,
      currentSummary.currentDiscussion
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [currentSummary]);

  // Empty state
  if (!currentSummary || sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-[var(--text-muted)]" role="status">
        <FileText size={48} className="opacity-20 mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">No Summary Yet</h3>
        <p className="text-sm max-w-xs">Start a conversation on a supported platform and the summary will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] p-5 gap-4 text-[var(--text-primary)]">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">Rolling Summary</h2>
          <div className="flex items-center gap-1.5 text-xs text-[var(--status-healthy)]" role="status" aria-live="polite">
            <div className="relative w-2 h-2">
              <div className="absolute inset-0 rounded-full bg-[var(--status-healthy)] opacity-75 animate-ping"></div>
              <div className="w-2 h-2 rounded-full bg-[var(--status-healthy)]"></div>
            </div>
            Live
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleRegenerate} 
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Regenerate summary"
          >
            <RefreshCw size={16} className={regenerating ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={handleCopy} 
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Copy summary to clipboard"
          >
            {copied ? <Check size={16} className="text-[var(--status-healthy)]" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Topic Tags */}
      {topicTags.length > 0 && (
        <div className="flex flex-wrap gap-2" role="list" aria-label="Summary topics">
          {topicTags.map((tag, i) => (
            <span key={i} className="px-2.5 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[11px] font-medium rounded-full border border-[var(--border-subtle)]" role="listitem">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Summary Sections */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1" role="region" aria-label="Summary content">
        {sections.map((section, idx) => (
          <div key={idx} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold mb-2 text-[var(--text-primary)]">{section.label}</h3>
            <ul className="flex flex-col gap-1">
              {section.items.map((item, j) => (
                <li key={j} className="text-xs text-[var(--text-secondary)] leading-relaxed pl-2 border-l-2 border-[var(--border-subtle)]">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-3 border-t border-[var(--border-subtle)]">
        <span className="text-xs text-[var(--text-muted)]">
          Coverage: {coverage}% • {stats.turns} turns tracked
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          Updates every {useAppState.getState().summaryFrequency} turns
        </span>
      </div>
    </div>
  );
}
