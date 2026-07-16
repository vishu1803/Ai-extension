import { useState, useEffect } from 'preact/hooks';
import { useAppState } from '../../ui/hooks/useAppState';
import { ContextMeter } from '../../ui/components/ContextMeter';
import { PlatformBadge } from '../../ui/components/PlatformBadge';
import { ConversationHistory } from '../../ui/components/ConversationHistory';
import { SummaryScreen } from '../../ui/components/SummaryScreen';
import { SettingsManager } from '../../ui/components/SettingsManager';
import {
  FileText,
  ArrowRightLeft,
  Download,
  AlertTriangle,
  ArrowUpRight,
  Activity,
} from 'lucide-preact';

type Tab = 'dashboard' | 'summary' | 'history' | 'settings';

export function App() {
  useEffect(() => {
    console.log('[SidePanel] Panel mounted');
    return () => console.log('[SidePanel] Component unmounted');
  }, []);
  
  console.log('[SidePanel] React rerender');

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const status = useAppState((s) => s.status);
  const tokenEstimate = useAppState((s) => s.tokenEstimate);
  const stats = useAppState((s) => s.stats);
  const platform = useAppState((s) => s.platform);

  const fillPercentage = Math.min((tokenEstimate.count / stats.contextLimit) * 100, 100);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'summary', label: 'Summary' },
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] overflow-hidden text-[#f4f4f5]">
      {/* Title */}
      <div className="pt-5 px-5 pb-3">
        <h1 className="text-xl font-semibold tracking-tight text-white">AI Context Tracker</h1>
      </div>

      {/* Header Navigation */}
      <header className="flex border-b border-[#2a2a30] px-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex-1 py-3 text-[13px] font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-[#22d3ee] text-[#22d3ee]'
                : 'border-transparent text-[#a1a1aa] hover:text-[#f4f4f5]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-6 p-5 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-8">
            {/* Context Meter Section */}
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-white">Context Meter</h2>

              <div className="flex flex-col items-center bg-gradient-to-b from-[#121216] to-[#0a0a0c] pt-4 rounded-xl relative">
                <ContextMeter value={fillPercentage} variant="semicircular" status={status} />

                <div className="mt-6 flex flex-col items-center gap-3 w-full">
                  <span className="text-[13px] text-[#a1a1aa]">
                    {tokenEstimate.count.toLocaleString()} / {stats.contextLimit.toLocaleString()}{' '}
                    tokens
                  </span>
                  <div className="mb-2 scale-90">
                    <PlatformBadge platform={platform} />
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Cards Section */}
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-white">Metrics Cards</h2>
              <div className="grid grid-cols-2 gap-3">
                {/* Input Tokens */}
                <div className="bg-[#121216] border border-[#22d3ee]/40 rounded-xl p-3 shadow-[0_0_15px_rgba(34,211,238,0.05)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#22d3ee]/20 to-transparent"></div>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[12px] text-[#a1a1aa]">Input Tokens</span>
                    <ArrowUpRight size={14} className="text-[#22d3ee]" />
                  </div>
                  <div className="text-xl font-bold text-white tracking-tight">
                    {(tokenEstimate.inputCount || 0).toLocaleString()}
                  </div>
                </div>

                {/* Output Tokens */}
                <div className="bg-[#121216] border border-[#a855f7]/40 rounded-xl p-3 shadow-[0_0_15px_rgba(168,85,247,0.05)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#a855f7]/20 to-transparent"></div>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[12px] text-[#a1a1aa]">Output Tokens</span>
                    <Activity size={14} className="text-[#a855f7]" />
                  </div>
                  <div className="text-xl font-bold text-white tracking-tight">
                    {(tokenEstimate.outputCount || 0).toLocaleString()}
                  </div>
                </div>

                {/* Turns */}
                <div className="bg-[#121216] border border-[#2a2a30] rounded-xl p-3">
                  <div className="text-[12px] text-[#a1a1aa] mb-1">Turns</div>
                  <div className="text-xl font-bold text-white tracking-tight">{stats.turns}</div>
                </div>

                {/* Avg/Turn */}
                <div className="bg-[#121216] border border-[#2a2a30] rounded-xl p-3">
                  <div className="text-[12px] text-[#a1a1aa] mb-1">Avg/Turn</div>
                  <div className="text-xl font-bold text-white tracking-tight">
                    {Math.round(stats.avgTokensPerTurn).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Context Health Section */}
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-white">Context Health</h2>

              <div className="bg-[#121216] border border-[#2a2a30] rounded-xl p-4 flex flex-col gap-4">
                <div
                  className={`flex items-center gap-2 ${
                    status === 'healthy'
                      ? 'text-[#4ade80]'
                      : status === 'caution'
                        ? 'text-[#eab308]'
                        : status === 'warning'
                          ? 'text-[#f97316]'
                          : 'text-[#ef4444]'
                  }`}
                >
                  <AlertTriangle size={16} />
                  <span className="text-sm font-medium">
                    {status === 'healthy'
                      ? 'Optimal — Context is healthy'
                      : status === 'caution'
                        ? 'Caution — Context is getting dense'
                        : status === 'warning'
                          ? 'Warning — Nearing context limit'
                          : 'Critical — Context limit exceeded'}
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#a1a1aa] w-24">
                      Context Fill: {Math.round(fillPercentage)}%
                    </span>
                    <div className="flex-1 flex gap-1 h-1.5 bg-[#2a2a30] rounded-full overflow-hidden ml-4">
                      <div
                        className={`rounded-full h-full ${
                          status === 'healthy'
                            ? 'bg-[#4ade80]'
                            : status === 'caution'
                              ? 'bg-[#eab308]'
                              : status === 'warning'
                                ? 'bg-[#f97316]'
                                : 'bg-[#ef4444]'
                        }`}
                        style={{ width: `${Math.max(2, fillPercentage)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#a1a1aa] w-24">
                      Repetition: {stats.healthMetrics.repetition}
                    </span>
                    <div className="flex-1 flex gap-1 h-1.5 ml-4">
                      <div
                        className={`flex-1 rounded-full ${stats.healthMetrics.repetition !== 'Low' ? 'bg-[#eab308]' : 'bg-[#22c55e]'}`}
                      ></div>
                      <div
                        className={`flex-1 rounded-full ${stats.healthMetrics.repetition === 'High' ? 'bg-[#ef4444]' : stats.healthMetrics.repetition === 'Medium' ? 'bg-[#eab308]' : 'bg-[#2a2a30]'}`}
                      ></div>
                      <div
                        className={`flex-1 rounded-full ${stats.healthMetrics.repetition === 'High' ? 'bg-[#ef4444]' : 'bg-[#2a2a30]'}`}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#a1a1aa] w-24">
                      Length Drift: {stats.healthMetrics.lengthDrift}
                    </span>
                    <div className="flex-1 flex gap-1 h-1.5 ml-4">
                      <div className="flex-1 bg-[#22c55e] rounded-full opacity-100"></div>
                      <div
                        className={`flex-1 rounded-full ${stats.healthMetrics.lengthDrift === 'Stable' ? 'bg-[#22c55e]' : 'bg-[#2a2a30]'}`}
                      ></div>
                      <div
                        className={`flex-1 rounded-full ${stats.healthMetrics.lengthDrift === 'Growing' ? 'bg-[#eab308]' : 'bg-[#2a2a30]'}`}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#a1a1aa] w-24">
                      Instruction: {stats.healthMetrics.instruction}
                    </span>
                    <div className="flex-1 flex gap-1 h-1.5 ml-4">
                      <div
                        className={`flex-1 rounded-full ${stats.healthMetrics.instruction === 'Poor' ? 'bg-[#ef4444]' : 'bg-[#22c55e]'}`}
                      ></div>
                      <div
                        className={`flex-1 rounded-full ${stats.healthMetrics.instruction === 'Poor' ? 'bg-[#2a2a30]' : stats.healthMetrics.instruction === 'Fair' ? 'bg-[#eab308]' : 'bg-[#22c55e]'}`}
                      ></div>
                      <div
                        className={`flex-1 rounded-full ${stats.healthMetrics.instruction === 'Good' ? 'bg-[#22c55e]' : 'bg-[#2a2a30]'}`}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#a1a1aa] w-24">
                      Explicit: {stats.healthMetrics.explicit}
                    </span>
                    <div className="flex-1 flex gap-1 h-1.5 ml-4">
                      <div
                        className={`flex-1 rounded-full ${stats.healthMetrics.explicit === 'None' ? 'bg-[#22c55e]' : 'bg-[#eab308]'}`}
                      ></div>
                      <div
                        className={`flex-1 rounded-full ${stats.healthMetrics.explicit === 'High' ? 'bg-[#ef4444]' : 'bg-[#2a2a30]'}`}
                      ></div>
                      <div
                        className={`flex-1 rounded-full ${stats.healthMetrics.explicit === 'High' ? 'bg-[#ef4444]' : 'bg-[#2a2a30]'}`}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-white">Quick Actions</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('summary')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#121216] border border-[#2a2a30] rounded-lg text-[13px] text-[#a1a1aa] hover:text-white transition-colors"
                >
                  <FileText size={14} /> Summary
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#121216] border border-[#2a2a30] rounded-lg text-[13px] text-[#a1a1aa] hover:text-white transition-colors">
                  <ArrowRightLeft size={14} /> Transfer
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#121216] border border-[#2a2a30] rounded-lg text-[13px] text-[#a1a1aa] hover:text-white transition-colors"
                >
                  <Download size={14} /> Export
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

        {activeTab === 'settings' && (
          <div className="h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SettingsManager />
          </div>
        )}
      </main>
    </div>
  );
}
