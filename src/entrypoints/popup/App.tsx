import { useState } from 'preact/hooks';
import { useAppState } from '../../ui/hooks/useAppState';
import { ContextMeter } from '../../ui/components/ContextMeter';
import { Settings } from 'lucide-preact';
import { SettingsManager } from '../../ui/components/SettingsManager';

export function App() {
  const status = useAppState((s) => s.status);
  const tokenEstimate = useAppState((s) => s.tokenEstimate);
  const stats = useAppState((s) => s.stats);
  const platform = useAppState((s) => s.platform);
  const [showSettings, setShowSettings] = useState(false);

  const fillPercentage = Math.min((tokenEstimate.count / stats.contextLimit) * 100, 100);

  const openDashboard = () => {
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      (chrome.sidePanel.open as any)({ windowId: undefined }).catch(console.error);
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'healthy':
        return 'Fresh';
      case 'caution':
        return 'Caution';
      case 'warning':
        return 'Warning';
      case 'critical':
        return 'Critical';
      default:
        return 'Fresh';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'healthy':
        return 'bg-[#4ade80]';
      case 'caution':
        return 'bg-[#eab308]';
      case 'warning':
        return 'bg-[#f97316]';
      case 'critical':
        return 'bg-[#ef4444]';
      default:
        return 'bg-[#4ade80]';
    }
  };

  if (showSettings) {
    return (
      <div className="flex flex-col w-[360px] h-[480px] bg-[#121216] text-[#f4f4f5] overflow-hidden relative">
        <div className="flex justify-between items-center px-5 py-4 border-b border-[#2a2a30]">
          <h1 className="text-[18px] font-bold text-white">Settings</h1>
          <button
            onClick={() => setShowSettings(false)}
            className="text-[#a1a1aa] hover:text-white transition-colors text-[14px] font-medium"
          >
            Done
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SettingsManager />
        </div>
      </div>
    );
  }

  const tokenText = tokenEstimate.count.toLocaleString();
  const remainingText = Math.max(0, stats.contextLimit - tokenEstimate.count).toLocaleString();
  const platformName =
    platform === 'chatgpt'
      ? 'ChatGPT'
      : platform === 'claude'
        ? 'Claude'
        : platform === 'gemini'
          ? 'Gemini'
          : 'GPT-5.5';

  return (
    <div className="flex flex-col w-[360px] h-[480px] bg-[#121216] p-5 text-white relative border border-[#2a2a30] rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-[20px] font-bold tracking-tight text-white">AI Context Tracker</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="text-[#a1a1aa] hover:text-white transition-colors p-1"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Main Graphic: Circular progress meter */}
      <div className="flex flex-col items-center justify-center mb-8">
        <ContextMeter value={fillPercentage} variant="circular" status={status} />
      </div>

      {/* Data Block */}
      <div className="bg-[#1a1a20] rounded-xl border border-[#2a2a30] overflow-hidden mb-4">
        <div className="flex justify-between items-center px-4 py-3 border-b border-[#2a2a30]">
          <span className="text-[14px] text-[#a1a1aa]">Tokens Used</span>
          <span className="text-[15px] font-bold text-white">{tokenText}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3 border-b border-[#2a2a30]">
          <span className="text-[14px] text-[#a1a1aa]">Remaining</span>
          <span className="text-[15px] font-bold text-[#22d3ee]">{remainingText}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-[14px] text-[#a1a1aa]">Model</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#4ade80]"></div>
            <span className="text-[15px] font-bold text-white">{platformName}</span>
          </div>
        </div>
      </div>

      {/* Context Health Block */}
      <div className="bg-[#1a1a20] rounded-xl border border-[#2a2a30] p-4 mb-5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[14px] text-[#a1a1aa]">Context Health</span>
          <div className="flex items-center gap-1.5 bg-[#2a2a30] px-2.5 py-1 rounded-full">
            <span className="text-[12px] font-medium text-[#4ade80]">{getStatusText()}</span>
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
          </div>
        </div>
        <div className="w-full h-[6px] rounded-full overflow-hidden flex gap-1">
          <div className="h-full bg-[#4ade80] w-full shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={openDashboard}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#22d3ee] to-[#a855f7] text-black font-semibold text-[14px] hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(34,211,238,0.2)]"
        >
          Open Dashboard
        </button>
        <button
          onClick={openDashboard}
          className="flex-1 py-3 rounded-xl border border-[#3f3f46] bg-gradient-to-r from-[#22d3ee]/5 to-[#a855f7]/5 text-white font-semibold text-[14px] hover:border-[#a855f7]/50 transition-colors"
        >
          Transfer
        </button>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-[#52525b]">Powered by AI Context Tracker</div>
    </div>
  );
}
