import { useState, useEffect } from 'preact/hooks';
import { Copy, Edit, Save, X, Check } from 'lucide-preact';
import { useAppState } from '../hooks/useAppState';
import { generateTransferTemplate } from '../../engines/summary/transfer-template';

interface TransferSummaryModalProps {
  onClose: () => void;
}

export function TransferSummaryModal({ onClose }: TransferSummaryModalProps) {
  const currentSummary = useAppState((s) => s.currentSummary);
  const platform = useAppState((s) => s.platform);
  const stats = useAppState((s) => s.stats);
  const tokenEstimate = useAppState((s) => s.tokenEstimate);

  const [markdown, setMarkdown] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (currentSummary) {
      generateTransferTemplate(currentSummary).then(setMarkdown);
    }
  }, [currentSummary]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const platformName =
    platform === 'chatgpt'
      ? 'ChatGPT'
      : platform === 'claude'
        ? 'Claude'
        : platform === 'gemini'
          ? 'Gemini'
          : 'Claude Fable 5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {/* Container to handle the gradient border */}
      <div className="relative w-full max-w-lg p-[1px] rounded-2xl bg-gradient-to-br from-[#a855f7] via-transparent to-[#22d3ee] shadow-[0_0_30px_rgba(34,211,238,0.15)] animate-in zoom-in-95 duration-200">
        <div className="w-full bg-[#121216] rounded-2xl flex flex-col overflow-hidden pb-4">
          {/* Header */}
          <div className="flex justify-between items-start p-6 pb-4">
            <div>
              <h2 className="text-[22px] font-bold text-white mb-1">Transfer Summary</h2>
              <p className="text-[13px] text-[#a1a1aa]">
                Generated from {platformName} · {stats.turns} turns ·{' '}
                {tokenEstimate.count >= 1000
                  ? (tokenEstimate.count / 1000).toFixed(0) + 'K'
                  : tokenEstimate.count}{' '}
                tokens
              </p>
            </div>
            <button onClick={onClose} className="text-[#a1a1aa] hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Content Area */}
          <div className="px-6 pb-6">
            <div className="w-full bg-[#0a0a0c] border border-[#2a2a30] rounded-xl overflow-hidden relative">
              <textarea
                value={markdown}
                readOnly
                className="w-full h-[320px] p-5 pr-8 bg-transparent text-[13px] text-white font-mono resize-none focus:outline-none leading-relaxed"
                style={{ scrollbarWidth: 'none' }} // Hide native scrollbar, styling custom below if needed
              />
              {/* Fake scrollbar thumb for visual match exactly as in design */}
              <div className="absolute right-1 top-2 bottom-2 w-1.5 bg-[#2a2a30] rounded-full"></div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-6 flex gap-4 relative">
            <button
              onClick={handleCopy}
              className="flex-1 flex justify-center items-center gap-2 py-3 rounded-xl text-[14px] font-semibold bg-gradient-to-r from-[#22d3ee] to-[#60a5fa] text-black hover:opacity-90 transition-opacity"
            >
              <Copy size={18} /> Copy
            </button>
            <button className="flex-1 flex justify-center items-center gap-2 py-3 rounded-xl border border-[#2a2a30] text-[14px] font-semibold text-white hover:bg-[#2a2a30] transition-colors">
              <Edit size={18} /> Edit
            </button>
            <button className="flex-1 flex justify-center items-center gap-2 py-3 rounded-xl border border-[#2a2a30] text-[14px] font-semibold text-white hover:bg-[#2a2a30] transition-colors">
              <Save size={18} /> Save
            </button>
          </div>

          {/* Copied Success Text */}
          {copied && (
            <div className="px-6 pt-3 flex items-center gap-1.5 text-[13px] font-medium text-[#4ade80] animate-in slide-in-from-bottom-2 fade-in">
              <Check size={14} /> Copied to clipboard!
            </div>
          )}
          {/* Add a spacer so the container height doesn't jump, matching design layout */}
          {!copied && <div className="px-6 pt-3 h-[32px]"></div>}
        </div>
      </div>
    </div>
  );
}
