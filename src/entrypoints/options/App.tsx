import { useState, useEffect } from 'preact/hooks';
import { useAppState } from '../../ui/hooks/useAppState';
import { Onboarding } from '../../ui/components/Onboarding';
import { Settings, Bell, Shield, Paintbrush, MonitorSmartphone, HelpCircle } from 'lucide-preact';

export function App() {
  const [activeMenu, setActiveMenu] = useState('general');
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const { theme, setTheme, thresholds } = useAppState();

  // Local state for options to match UI before saving
  const [localWidgetState, setLocalWidgetState] = useState(false);
  const [localConfidence, setLocalConfidence] = useState(true);
  const [localSound, setLocalSound] = useState(false);
  const [localWidgetPos, setLocalWidgetPos] = useState('Bottom Right');

  // Check onboarding status on mount
  useEffect(() => {
    import('../../storage').then((m) => {
      m.storageLayer.appState.getValue().then((state) => {
        setOnboardingComplete(state.onboardingComplete === true);
      });
    });
  }, []);

  const handleOnboardingFinish = async () => {
    const { storageLayer } = await import('../../storage');
    await storageLayer.updateAppState({ onboardingComplete: true });
    setOnboardingComplete(true);
  };

  // Loading state
  if (onboardingComplete === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f0f14] text-[#a1a1aa]">
        Loading...
      </div>
    );
  }

  // Show Onboarding if not completed
  if (!onboardingComplete) {
    return <Onboarding onFinish={handleOnboardingFinish} />;
  }

  const menu = [
    { id: 'general', label: 'General', icon: <Settings size={18} /> },
    { id: 'appearance', label: 'Appearance', icon: <Paintbrush size={18} /> },
    { id: 'alerts', label: 'Alerts', icon: <Bell size={18} /> },
    { id: 'platforms', label: 'Platforms', icon: <MonitorSmartphone size={18} /> },
    { id: 'privacy', label: 'Privacy', icon: <Shield size={18} /> },
    { id: 'about', label: 'About', icon: <HelpCircle size={18} /> },
  ];

  return (
    <div className="flex max-w-[1200px] mx-auto h-screen bg-[#0f0f14] text-white">
      {/* Sidebar Navigation */}
      <aside className="w-[280px] bg-[#121216] border-r border-[#2a2a30] py-8 px-5 hidden md:block">
        <h2 className="text-[11px] font-bold text-[#a1a1aa] mb-4 uppercase tracking-widest px-2">
          Left Sidebar
        </h2>
        <nav className="flex flex-col gap-1" role="navigation" aria-label="Settings sections">
          {menu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                activeMenu === item.id
                  ? 'bg-[#1b2b34] text-[#22d3ee]'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a20]'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 bg-[#0f0f14]">
        <div className="max-w-3xl">
          <h2 className="text-[11px] font-bold text-[#a1a1aa] mb-4 uppercase tracking-widest">
            Right Content Area
          </h2>

          <h1 className="text-[28px] font-bold mb-8 text-white">
            {menu.find((m) => m.id === activeMenu)?.label}
          </h1>

          {activeMenu === 'general' && (
            <div className="flex flex-col gap-5">
              <div className="flex gap-5">
                {/* Theme Block */}
                <div className="flex-1 bg-[#121216] border border-[#2a2a30] rounded-2xl p-5 flex flex-col justify-center">
                  <h3 className="text-[16px] font-semibold text-white mb-4">Theme</h3>
                  <div className="flex bg-[#0a0a0c] border border-[#2a2a30] rounded-full p-1 w-full">
                    <button
                      className={`flex-1 py-1.5 rounded-full text-[14px] font-medium transition-colors ${theme === 'light' ? 'bg-[#22d3ee] text-black' : 'text-[#a1a1aa] hover:text-white'}`}
                      onClick={() => setTheme('light')}
                    >
                      Light
                    </button>
                    <button
                      className={`flex-1 py-1.5 rounded-full text-[14px] font-medium transition-colors ${theme === 'dark' ? 'bg-[#22d3ee] text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'text-[#a1a1aa] hover:text-white'}`}
                      onClick={() => setTheme('dark')}
                    >
                      Dark
                    </button>
                    <button
                      className={`flex-1 py-1.5 rounded-full text-[14px] font-medium transition-colors ${theme === 'system' ? 'bg-[#22d3ee] text-black' : 'text-[#a1a1aa] hover:text-white'}`}
                      onClick={() => setTheme('system')}
                    >
                      Auto
                    </button>
                  </div>
                </div>

                {/* Widget Position Block */}
                <div className="flex-1 bg-[#121216] border border-[#2a2a30] rounded-2xl p-5">
                  <h3 className="text-[16px] font-semibold text-white mb-4">Widget Position</h3>
                  <div className="bg-[#0a0a0c] border border-[#2a2a30] rounded-xl px-4 py-2.5 flex justify-between items-center mb-4 cursor-pointer">
                    <span className="text-[14px] text-white">{localWidgetPos}</span>
                    <ChevronDownIcon size={16} className="text-[#a1a1aa]" />
                  </div>

                  {/* 2x2 Grid Representation */}
                  <div className="w-full h-[60px] border border-[#2a2a30] rounded-lg grid grid-cols-2 grid-rows-2 gap-1 p-1">
                    <div className="bg-[#2a2a30] rounded w-5 h-5 opacity-30"></div>
                    <div className="bg-[#2a2a30] rounded w-5 h-5 justify-self-end opacity-30"></div>
                    <div className="bg-[#2a2a30] rounded w-5 h-5 self-end opacity-30"></div>
                    <div className="bg-[#22d3ee] rounded w-5 h-5 self-end justify-self-end shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
                  </div>
                </div>
              </div>

              {/* Default Widget State & Confidence Badge Row */}
              <div className="flex gap-5">
                <div className="flex-1 bg-[#121216] border border-[#2a2a30] rounded-2xl p-5">
                  <h3 className="text-[16px] font-semibold text-white mb-4">
                    Default Widget State
                  </h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setLocalWidgetState(!localWidgetState)}
                      className={`w-[42px] h-[24px] rounded-full relative transition-colors ${localWidgetState ? 'bg-[#22d3ee]' : 'bg-[#3f3f46]'}`}
                    >
                      <div
                        className={`absolute top-[2px] w-[20px] h-[20px] bg-white rounded-full transition-transform ${localWidgetState ? 'left-[20px]' : 'left-[2px]'}`}
                      ></div>
                    </button>
                    <span className="text-[14px] text-[#a1a1aa]">Start expanded</span>
                  </div>
                </div>

                <div className="flex-1 bg-[#121216] border border-[#2a2a30] rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-[16px] font-semibold text-white mb-2">Confidence Badge</h3>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setLocalConfidence(!localConfidence)}
                        className={`w-[42px] h-[24px] rounded-full relative transition-colors ${localConfidence ? 'bg-[#22d3ee]' : 'bg-[#3f3f46]'}`}
                      >
                        <div
                          className={`absolute top-[2px] w-[20px] h-[20px] bg-white rounded-full transition-transform ${localConfidence ? 'left-[20px]' : 'left-[2px]'}`}
                        ></div>
                      </button>
                      <span className="text-[14px] text-[#a1a1aa]">Show estimation accuracy</span>
                    </div>
                  </div>
                  {/* Glowing Cyan Square */}
                  <div className="w-[48px] h-[48px] rounded-xl bg-gradient-to-br from-[#22d3ee] to-[#38bdf8] shadow-[0_0_20px_rgba(34,211,238,0.4)] opacity-90 border border-white/20"></div>
                </div>
              </div>

              {/* Alert Thresholds Block */}
              <div className="bg-[#121216] border border-[#2a2a30] rounded-2xl p-6">
                <h3 className="text-[16px] font-semibold text-white mb-6">Alert Thresholds</h3>

                <div className="flex flex-col gap-6">
                  {/* Caution */}
                  <div className="relative">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[14px] text-white">
                        Caution Level: {thresholds.caution}%
                      </span>
                    </div>
                    <div className="relative h-1.5 w-full bg-[#2a2a30] rounded-full">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#4ade80] to-[#eab308]"
                        style={{ width: `${thresholds.caution}%` }}
                      ></div>
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#3f3f46] border-[3px] border-[#a1a1aa] rounded-full cursor-pointer"
                        style={{ left: `calc(${thresholds.caution}% - 8px)` }}
                      ></div>
                      <div
                        className="absolute top-[-30px] px-2 py-1 bg-[#2a2a30] text-[12px] rounded text-[#a1a1aa]"
                        style={{ left: `calc(${thresholds.caution}% - 18px)` }}
                      >
                        {thresholds.caution}%
                      </div>
                    </div>
                  </div>

                  {/* Warning */}
                  <div className="relative mt-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[14px] text-white">
                        Warning Level: {thresholds.warning}%
                      </span>
                    </div>
                    <div className="relative h-1.5 w-full bg-[#2a2a30] rounded-full">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#eab308] to-[#f97316]"
                        style={{ width: `${thresholds.warning}%` }}
                      ></div>
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#3f3f46] border-[3px] border-[#a1a1aa] rounded-full cursor-pointer"
                        style={{ left: `calc(${thresholds.warning}% - 8px)` }}
                      ></div>
                      <div
                        className="absolute top-[-30px] px-2 py-1 bg-[#2a2a30] text-[12px] rounded text-[#a1a1aa]"
                        style={{ left: `calc(${thresholds.warning}% - 18px)` }}
                      >
                        {thresholds.warning}%
                      </div>
                    </div>
                  </div>

                  {/* Critical */}
                  <div className="relative mt-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[14px] text-white">
                        Critical Level: {thresholds.critical}%
                      </span>
                    </div>
                    <div className="relative h-1.5 w-full bg-[#2a2a30] rounded-full">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#f97316] to-[#ef4444]"
                        style={{ width: `${thresholds.critical}%` }}
                      ></div>
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#3f3f46] border-[3px] border-[#a1a1aa] rounded-full cursor-pointer"
                        style={{ left: `calc(${thresholds.critical}% - 8px)` }}
                      ></div>
                      <div
                        className="absolute top-[-30px] px-2 py-1 bg-[#2a2a30] text-[12px] rounded text-[#a1a1aa]"
                        style={{ left: `calc(${thresholds.critical}% - 18px)` }}
                      >
                        {thresholds.critical}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sound Alerts Block */}
              <div className="bg-[#121216] border border-[#2a2a30] rounded-2xl p-6 flex justify-between items-center">
                <div>
                  <h3 className="text-[16px] font-semibold text-white mb-1">Sound Alerts</h3>
                  <p className="text-[14px] text-[#a1a1aa]">Play sound on critical alerts</p>
                </div>
                <button
                  onClick={() => setLocalSound(!localSound)}
                  className={`w-[42px] h-[24px] rounded-full relative transition-colors ${localSound ? 'bg-[#22d3ee]' : 'bg-[#3f3f46]'}`}
                >
                  <div
                    className={`absolute top-[2px] w-[20px] h-[20px] bg-white rounded-full transition-transform ${localSound ? 'left-[20px]' : 'left-[2px]'}`}
                  ></div>
                </button>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end items-center gap-6 mt-4">
                <button className="text-[14px] text-[#a1a1aa] hover:text-white transition-colors">
                  Reset to Defaults
                </button>
                <button className="px-6 py-2.5 bg-[#40848a] hover:bg-[#347378] text-white font-medium rounded-xl transition-colors">
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Dummy placeholders for other menus */}
          {activeMenu !== 'general' && (
            <div className="text-[#a1a1aa]">This section is active. (Placeholder)</div>
          )}
        </div>
      </main>
    </div>
  );
}

function ChevronDownIcon(props: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size}
      height={props.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
