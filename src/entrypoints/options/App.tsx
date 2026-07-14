import { useState, useEffect } from 'preact/hooks';
import { useAppState } from '../../ui/hooks/useAppState';
import { Onboarding } from '../../ui/components/Onboarding';
import { Settings, Bell, Shield, Paintbrush, MonitorSmartphone, HelpCircle } from 'lucide-preact';

export function App() {
  const [activeMenu, setActiveMenu] = useState('general');
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const { theme, setTheme } = useAppState();

  // Check onboarding status on mount
  useEffect(() => {
    import('../../storage').then(m => {
      m.storageLayer.appState.getValue().then((state: any) => {
        setOnboardingComplete(state.onboardingComplete === true);
      });
    });
  }, []);

  const handleOnboardingFinish = async () => {
    const { storageLayer } = await import('../../storage');
    await storageLayer.updateAppState({ onboardingComplete: true } as any);
    setOnboardingComplete(true);
  };

  // Loading state
  if (onboardingComplete === null) {
    return <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)] text-[var(--text-muted)]">Loading...</div>;
  }

  // Show Onboarding if not completed
  if (!onboardingComplete) {
    return <Onboarding onFinish={handleOnboardingFinish} />;
  }

  const menu = [
    { id: 'general', label: 'General', icon: <Settings size={18} /> },
    { id: 'appearance', label: 'Appearance', icon: <Paintbrush size={18} /> },
    { id: 'alerts', label: 'Alerts & Thresholds', icon: <Bell size={18} /> },
    { id: 'platforms', label: 'Platforms', icon: <MonitorSmartphone size={18} /> },
    { id: 'privacy', label: 'Privacy', icon: <Shield size={18} /> },
    { id: 'about', label: 'About', icon: <HelpCircle size={18} /> }
  ];

  return (
    <div className="flex max-w-5xl mx-auto h-screen bg-[var(--bg-primary)]">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-8 px-4 hidden md:block">
        <h1 className="text-xl font-bold mb-8 px-4 bg-clip-text text-transparent bg-[var(--accent-gradient)]">
          AI Context Tracker
        </h1>
        <nav className="flex flex-col gap-1.5" role="navigation" aria-label="Settings sections">
          {menu.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              aria-current={activeMenu === item.id ? 'page' : undefined}
              className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                activeMenu === item.id 
                  ? 'bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] shadow-sm' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 md:p-12">
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          <h2 className="text-3xl font-bold mb-8">
            {menu.find(m => m.id === activeMenu)?.label}
          </h2>

          {activeMenu === 'general' && (
            <div className="flex flex-col gap-8">
              <section className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[var(--shadow-card)]">
                <h3 className="text-lg font-semibold mb-1">Widget Position</h3>
                <p className="text-[var(--text-secondary)] text-sm mb-6">Reset the widget position if it gets lost off-screen.</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Reset Position</span>
                  <button 
                    onClick={() => useAppState.getState().setWidgetPosition({ x: 20, y: 20 })}
                    className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium transition-colors"
                  >
                    Reset to Default
                  </button>
                </div>
              </section>
              
              <section className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[var(--shadow-card)] flex flex-col gap-4">
                <h3 className="text-lg font-semibold mb-1">Backup & Restore</h3>
                <p className="text-[var(--text-secondary)] text-sm mb-2">Export your settings, snapshots, and metrics to a JSON file.</p>
                <div className="flex gap-3">
                  <button onClick={async () => {
                    const dataStr = JSON.stringify(await import('../../storage').then(m => m.storageLayer.appState.getValue()), null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `ai-context-tracker-backup.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }} className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium hover:bg-[var(--bg-primary)] transition-colors">
                    Download Backup
                  </button>
                  <button onClick={() => document.getElementById('restore-file')?.click()} className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium hover:bg-[var(--bg-primary)] transition-colors">
                    Restore Data
                  </button>
                  <input id="restore-file" type="file" accept=".json" className="hidden" onChange={(e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                      try {
                        const parsed = JSON.parse(ev.target?.result as string);
                        if (parsed) {
                          const { storageLayer } = await import('../../storage');
                          const currentState = await storageLayer.appState.getValue();
                          await storageLayer.appState.setValue({ ...currentState, ...parsed });
                          alert('Restored successfully');
                        }
                      } catch(e) { alert('Invalid backup'); }
                    };
                    reader.readAsText(file);
                  }} />
                </div>
              </section>
            </div>
          )}

          {activeMenu === 'appearance' && (
            <div className="flex flex-col gap-8">
              <section className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[var(--shadow-card)]">
                <h3 className="text-lg font-semibold mb-4">Theme Preference</h3>
                <div className="flex gap-4">
                  {(['dark', 'light', 'system'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all capitalize font-medium ${
                        theme === t 
                          ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]' 
                          : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeMenu === 'alerts' && (
            <div className="flex flex-col gap-8">
              <section className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Smart Notifications</h3>
                    <p className="text-[var(--text-secondary)] text-sm">Show toast cards when approaching limits</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={useAppState.getState().notificationsEnabled} onChange={e => {
                      const enabled = (e.target as HTMLInputElement).checked;
                      import('../../storage').then(m => m.storageLayer.updateAppState({ notificationsEnabled: enabled }));
                    }} className="sr-only peer" />
                    <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-cyan)]"></div>
                  </label>
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-6">
                  <h3 className="text-lg font-semibold mb-1">Health Thresholds</h3>
                  <p className="text-[var(--text-secondary)] text-sm mb-6">Adjust when the extension warns you about context limits.</p>
                  
                  {useAppState.getState().thresholds && (
                    <div className="flex flex-col gap-8">
                      <div>
                        <div className="flex justify-between text-sm font-medium mb-2">
                          <span className="text-[var(--status-caution)]">Caution</span>
                          <span>{useAppState.getState().thresholds.caution}%</span>
                        </div>
                        <input type="range" min="50" max="80" value={useAppState.getState().thresholds.caution} onInput={(e) => useAppState.getState().setThresholds({ ...useAppState.getState().thresholds, caution: parseInt((e.target as HTMLInputElement).value) })} className="w-full h-2 rounded-lg appearance-none bg-[var(--status-caution)]/20 cursor-pointer accent-[var(--status-caution)]" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-medium mb-2">
                          <span className="text-[var(--status-warning)]">Warning</span>
                          <span>{useAppState.getState().thresholds.warning}%</span>
                        </div>
                        <input type="range" min="70" max="90" value={useAppState.getState().thresholds.warning} onInput={(e) => useAppState.getState().setThresholds({ ...useAppState.getState().thresholds, warning: parseInt((e.target as HTMLInputElement).value) })} className="w-full h-2 rounded-lg appearance-none bg-[var(--status-warning)]/20 cursor-pointer accent-[var(--status-warning)]" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-medium mb-2">
                          <span className="text-[var(--status-critical)]">Critical</span>
                          <span>{useAppState.getState().thresholds.critical}%</span>
                        </div>
                        <input type="range" min="85" max="99" value={useAppState.getState().thresholds.critical} onInput={(e) => useAppState.getState().setThresholds({ ...useAppState.getState().thresholds, critical: parseInt((e.target as HTMLInputElement).value) })} className="w-full h-2 rounded-lg appearance-none bg-[var(--status-critical)]/20 cursor-pointer accent-[var(--status-critical)]" />
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeMenu === 'platforms' && (
            <div className="flex flex-col gap-8">
              <section className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[var(--shadow-card)]">
                <h3 className="text-lg font-semibold mb-6">Supported Platforms</h3>
                <div className="flex flex-col gap-4">
                  {(['chatgpt', 'claude', 'gemini'] as const).map(p => (
                    <label key={p} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm font-medium capitalize">{p === 'chatgpt' ? 'ChatGPT' : p}</span>
                      <div className="relative inline-flex items-center">
                        <input type="checkbox" checked={useAppState.getState().supportedPlatforms[p]} onChange={e => {
                          const checked = (e.target as HTMLInputElement).checked;
                          import('../../storage').then(m => m.storageLayer.updateAppState({
                            supportedPlatforms: { ...useAppState.getState().supportedPlatforms, [p]: checked }
                          }));
                        }} className="sr-only peer" />
                        <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-cyan)]"></div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
              
              <section className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[var(--shadow-card)]">
                <h3 className="text-lg font-semibold mb-6">Data Engine</h3>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium">Summary Update Frequency</span>
                  <select 
                    value={useAppState.getState().summaryFrequency} 
                    onChange={e => import('../../storage').then(m => m.storageLayer.updateAppState({ summaryFrequency: parseInt((e.target as HTMLSelectElement).value) }))}
                    className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[var(--accent-cyan)]"
                  >
                    <option value="1">Every Turn (High CPU)</option>
                    <option value="3">Every 3 Turns (Balanced)</option>
                    <option value="5">Every 5 Turns (Optimal)</option>
                    <option value="10">Every 10 Turns (Eco)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Default Export Format</span>
                  <select 
                    value={useAppState.getState().exportFormat} 
                    onChange={e => import('../../storage').then(m => m.storageLayer.updateAppState({ exportFormat: (e.target as HTMLSelectElement).value as any }))}
                    className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[var(--accent-cyan)]"
                  >
                    <option value="markdown">Markdown (.md)</option>
                    <option value="json">JSON (.json)</option>
                    <option value="text">Plain Text (.txt)</option>
                  </select>
                </div>
              </section>
            </div>
          )}

          {activeMenu === 'privacy' && (
            <div className="flex flex-col gap-8">
              <section className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[var(--shadow-card)]">
                <h3 className="text-lg font-semibold mb-1">Privacy Controls</h3>
                <p className="text-[var(--text-secondary)] text-sm mb-6">AI Context Tracker is 100% local. Your data never leaves your browser.</p>
                
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-sm font-medium">Retain Conversation History</span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Save past conversations locally</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={useAppState.getState().privacy.enableHistory} onChange={e => {
                      const checked = (e.target as HTMLInputElement).checked;
                      import('../../storage').then(m => m.storageLayer.updateAppState({
                        privacy: { ...useAppState.getState().privacy, enableHistory: checked }
                      }));
                    }} className="sr-only peer" />
                    <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-cyan)]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div>
                    <span className="text-sm font-medium text-[var(--status-critical)]">Anonymous Analytics</span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Help improve Context Tracker</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={useAppState.getState().privacy.allowAnalytics} onChange={e => {
                      const checked = (e.target as HTMLInputElement).checked;
                      import('../../storage').then(m => m.storageLayer.updateAppState({
                        privacy: { ...useAppState.getState().privacy, allowAnalytics: checked }
                      }));
                    }} className="sr-only peer" />
                    <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--status-critical)]"></div>
                  </label>
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-4">
                  <button onClick={async () => {
                    if (confirm('Are you sure? This will permanently delete ALL data including snapshots, history, and settings.')) {
                      const { storageLayer, defaultState } = await import('../../storage');
                      await storageLayer.appState.setValue({ ...defaultState, onboardingComplete: true } as any);
                      alert('All data cleared.');
                    }
                  }} className="text-sm text-[var(--status-critical)] font-medium hover:underline">
                    Clear All Data
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeMenu === 'about' && (
            <div className="flex flex-col gap-8">
              <section className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[var(--shadow-card)] text-center">
                <div className="w-20 h-20 mx-auto bg-[var(--accent-gradient)] rounded-2xl flex items-center justify-center mb-6 shadow-[var(--shadow-card)]">
                  <h1 className="text-3xl text-white font-bold tracking-tighter">AI</h1>
                </div>
                <h3 className="text-2xl font-bold mb-1">AI Context Tracker</h3>
                <p className="text-[var(--text-secondary)] mb-6">Version 1.0.0</p>
                <p className="text-sm max-w-md mx-auto leading-relaxed mb-8">
                  A privacy-first browser extension that gives AI power users real-time visibility into context limits and helps preserve conversation quality.
                </p>
                <div className="flex justify-center gap-4">
                  <a href="#" className="text-sm font-medium text-[var(--accent-cyan)] hover:underline">View Changelog</a>
                  <a href="#" className="text-sm font-medium text-[var(--accent-cyan)] hover:underline">Report Issue</a>
                  <a href="#" className="text-sm font-medium text-[var(--accent-cyan)] hover:underline">Privacy Policy</a>
                </div>
              </section>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
