import { useState, useMemo } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState';
import {
  RefreshCw,
  Copy,
  FileText,
  Target,
  Code,
  Bug,
  ListTodo,
  MessageSquare,
} from 'lucide-preact';
import { StructuredSummary } from '../../engines/summary/types';
import { TransferSummaryModal } from './TransferSummaryModal';
import { messaging } from '../../messaging/client';

export function SummaryScreen() {
  const currentSummary = useAppState((s) => s.currentSummary) as StructuredSummary | null;
  const stats = useAppState((s) => s.stats);

  const [regenerating, setRegenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Derive summary sections from live data
  const sections = useMemo(() => {
    if (!currentSummary) return [];

    const list: {
      icon: preact.ComponentType<{ size?: number; style?: object; className?: string }>;
      title: string;
      items: string[];
      color: string;
    }[] = [];

    // Project Goal
    if (currentSummary.projectGoal) {
      list.push({
        icon: Target,
        title: 'Project Goal',
        items: [currentSummary.projectGoal],
        color: '#22d3ee',
      });
    }

    // Key Context Points (from TF-IDF ranking)
    if (currentSummary.rankedSentences && currentSummary.rankedSentences.length > 0) {
      list.push({
        icon: MessageSquare,
        title: 'Key Context Points',
        items: currentSummary.rankedSentences.slice(0, 5),
        color: '#3b82f6',
      });
    }

    // Architecture Decisions
    if (currentSummary.architectureDecisions.length > 0) {
      list.push({
        icon: Target,
        title: 'Decisions Made',
        items: currentSummary.architectureDecisions.slice(0, 5),
        color: '#a855f7',
      });
    }

    // Files Referenced
    if (currentSummary.filesCreated.length > 0) {
      list.push({
        icon: Code,
        title: 'Files Referenced',
        items: currentSummary.filesCreated.slice(0, 8),
        color: '#22c55e',
      });
    }

    // Bugs
    if (currentSummary.bugs.length > 0) {
      list.push({
        icon: Bug,
        title: 'Issues Found',
        items: currentSummary.bugs.slice(0, 5),
        color: '#ef4444',
      });
    }

    // Pending Tasks
    if (currentSummary.pendingTasks.length > 0) {
      list.push({
        icon: ListTodo,
        title: 'Pending Tasks',
        items: currentSummary.pendingTasks.slice(0, 5),
        color: '#eab308',
      });
    }

    return list;
  }, [currentSummary]);

  // Live topic tags from the engine
  const topicTags = useMemo(() => {
    if (!currentSummary || !currentSummary.topicTags) return [];
    return currentSummary.topicTags;
  }, [currentSummary]);

  // Format "last updated" from real timestamp
  const lastUpdatedText = useMemo(() => {
    if (!currentSummary || !currentSummary.lastUpdatedAt) return '';
    const diff = Date.now() - currentSummary.lastUpdatedAt;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }, [currentSummary]);

  const handleRegenerate = () => {
    setRegenerating(true);
    messaging
      .sendToBackground({ type: 'REGENERATE_SUMMARY' } as { type: 'REGENERATE_SUMMARY' })
      .then(() => {
        setRegenerating(false);
      })
      .catch(() => {
        setRegenerating(false);
      });
    // Safety timeout
    setTimeout(() => setRegenerating(false), 3000);
  };

  // Empty state — no conversation being tracked yet
  if (!currentSummary || sections.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center flex-1 p-8 text-center text-[#a1a1aa] h-full"
        role="status"
      >
        <FileText size={48} className="opacity-20 mb-4" />
        <h3 className="text-lg font-semibold text-[#e4e4e7] mb-2">No Summary Yet</h3>
        <p className="text-sm max-w-xs">
          Start a conversation on a supported platform and the summary will appear here
          automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] p-5 pb-6 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Rolling Summary</h2>
        <button
          onClick={handleRegenerate}
          className="p-2 rounded-lg bg-[#121216] border border-[#2a2a30] hover:bg-[#1a1a20] transition-colors text-[#a1a1aa] hover:text-white"
          aria-label="Regenerate summary"
        >
          <RefreshCw size={16} className={regenerating ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Current Discussion Banner */}
      {currentSummary.currentDiscussion && (
        <div className="bg-[#121216] border border-[#22d3ee]/30 rounded-xl p-3 mb-4 shadow-[0_0_10px_rgba(34,211,238,0.05)]">
          <div className="text-[11px] font-semibold text-[#22d3ee] uppercase tracking-wider mb-1">
            Current Focus
          </div>
          <div className="text-[13px] text-[#e4e4e7] leading-snug">
            {currentSummary.currentDiscussion}
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-[#121216] border border-[#2a2a30] rounded-xl flex flex-col shadow-sm mb-4">
        {/* Inner Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-[#2a2a30] bg-[#ffffff03]">
          <span className="text-[13px] text-[#737373]">
            Covers {currentSummary.turnsCovered || stats.turns} turns · Updated{' '}
            {lastUpdatedText || 'just now'}
          </span>
          <div className="w-2 h-2 rounded-full bg-[#4ade80]"></div>
        </div>

        {/* Sections */}
        <div className="p-4 flex flex-col gap-5">
          {sections.map((section, sIdx) => {
            const Icon = section.icon;
            return (
              <div key={sIdx} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Icon size={14} style={{ color: section.color }} />
                  <span className="text-[13px] font-semibold" style={{ color: section.color }}>
                    {section.title}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 pl-5">
                  {section.items.map((item, iIdx) => (
                    <div key={iIdx} className="flex gap-2 items-start">
                      <div
                        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: section.color, opacity: 0.6 }}
                      ></div>
                      <span className="text-[13px] text-[#a1a1aa] leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tags & Footer Info */}
        {topicTags.length > 0 && (
          <div className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {topicTags.map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-transparent border border-[#3f3f46] text-[#a1a1aa] text-[11px] font-medium rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-auto">
        <button
          onClick={handleRegenerate}
          className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg border border-[#2a2a30] text-[13px] font-medium text-[#f4f4f5] hover:bg-[#2a2a30] transition-colors"
        >
          <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} /> Regenerate
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold bg-gradient-to-r from-[#4ade80] to-[#22d3ee] text-black shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:opacity-90 transition-opacity"
        >
          <Copy size={14} /> Copy Summary
        </button>
      </div>

      {/* Modal */}
      {showModal && <TransferSummaryModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
