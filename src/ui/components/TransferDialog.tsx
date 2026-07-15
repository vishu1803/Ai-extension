import { useState, useEffect } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState';
import { TransferEngine } from '../../engines/transfer';
import { ExportFormat, TargetLLM } from '../../engines/transfer/types';
import { Copy, Download, MessageSquarePlus, X } from 'lucide-preact';

interface TransferDialogProps {
  onClose: () => void;
}

export function TransferDialog({ onClose }: TransferDialogProps) {
  const currentSummary = useAppState((s) => s.currentSummary);

  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [target, setTarget] = useState<TargetLLM>('generic');
  const [includeMemory, setIncludeMemory] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [includePending, setIncludePending] = useState(true);
  const [nextPrompt, setNextPrompt] = useState('');

  const [preview, setPreview] = useState('');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (editMode) return; // Do not overwrite manual edits
    const result = TransferEngine.generateExport(currentSummary, {
      format,
      target,
      includeMemory,
      includeCompleted,
      includePending,
      nextPrompt,
    });
    setPreview(result.content);
  }, [
    currentSummary,
    format,
    target,
    includeMemory,
    includeCompleted,
    includePending,
    nextPrompt,
    editMode,
  ]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(preview);
    // In real app, show a toast here
  };

  const handleDownload = () => {
    const result = TransferEngine.generateExport(currentSummary, {
      format,
      target,
      includeMemory,
      includeCompleted,
      includePending,
      nextPrompt,
    });
    const blob = new Blob([result.content], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `context_transfer${result.extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenNewChat = () => {
    // Open target platform in new tab
    const urls: Record<TargetLLM, string> = {
      chatgpt: 'https://chatgpt.com',
      claude: 'https://claude.ai/new',
      gemini: 'https://gemini.google.com',
      generic: 'https://chatgpt.com',
    };

    // Copy to clipboard first so they can just paste
    navigator.clipboard.writeText(preview).then(() => {
      window.open(urls[target], '_blank');
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[var(--border-subtle)]">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-[var(--accent-gradient)]">
            Context Transfer
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Config Panel */}
          <div className="w-64 border-r border-[var(--border-subtle)] p-5 overflow-y-auto flex flex-col gap-6 bg-[var(--bg-secondary)]">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3 block">
                Target Platform
              </label>
              <select
                value={target}
                onChange={(e) => setTarget((e.target as HTMLSelectElement).value as TargetLLM)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg p-2 text-sm"
              >
                <option value="generic">Generic LLM</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="claude">Claude</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3 block">
                Export Format
              </label>
              <div className="flex bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg p-1">
                {(['markdown', 'text', 'json'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex-1 text-xs py-1.5 rounded-md capitalize transition-colors ${format === f ? 'bg-[var(--bg-tertiary)] font-medium shadow-sm' : 'text-[var(--text-secondary)]'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3 block">
                Include Content
              </label>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMemory}
                    onChange={(e) => setIncludeMemory((e.target as HTMLInputElement).checked)}
                    className="rounded text-[var(--accent-cyan)]"
                  />
                  Project Memory & Goals
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCompleted}
                    onChange={(e) => setIncludeCompleted((e.target as HTMLInputElement).checked)}
                    className="rounded text-[var(--accent-cyan)]"
                  />
                  Completed Work & Files
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePending}
                    onChange={(e) => setIncludePending((e.target as HTMLInputElement).checked)}
                    className="rounded text-[var(--accent-cyan)]"
                  />
                  Pending Tasks & Bugs
                </label>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 flex flex-col p-5 bg-[var(--bg-primary)] relative">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Live Preview
              </label>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={editMode}
                  onChange={(e) => setEditMode((e.target as HTMLInputElement).checked)}
                  className="rounded text-[var(--accent-cyan)]"
                />
                Edit Mode
              </label>
            </div>
            <textarea
              value={preview}
              onInput={(e) => setPreview((e.target as HTMLTextAreaElement).value)}
              readOnly={!editMode}
              className={`flex-1 w-full bg-[#111] text-[#0f0] font-mono text-sm p-4 rounded-lg border resize-none focus:outline-none ${editMode ? 'border-[var(--accent-cyan)]' : 'border-[var(--border-subtle)] opacity-90'}`}
            />

            <div className="mt-4">
              <input
                type="text"
                placeholder="Optional: Type your next prompt here to append it to the transfer..."
                value={nextPrompt}
                onInput={(e) => setNextPrompt((e.target as HTMLInputElement).value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-3 text-sm focus:outline-none focus:border-[var(--accent-cyan)]"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--border-subtle)] flex justify-end gap-3 bg-[var(--bg-secondary)] rounded-b-xl">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            <Download size={16} /> Download
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            <Copy size={16} /> Copy to Clipboard
          </button>
          <button
            onClick={handleOpenNewChat}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-[var(--accent-gradient)] text-white hover:opacity-90 shadow-lg hover:shadow-xl rounded-lg transition-all"
          >
            <MessageSquarePlus size={16} /> Copy & Open Chat
          </button>
        </div>
      </div>
    </div>
  );
}
