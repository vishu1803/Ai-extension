import { useState, useRef } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState';
import { storageLayer } from '../../storage';
import { Save, Download, Upload, Monitor, Moon, Sun, Keyboard, Shield, Bell, Database, Check } from 'lucide-preact';
import { AppState, defaultState } from '../../storage';

export function SettingsManager() {
  const state = useAppState();
  const [toast, setToast] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const updateSettings = async (updates: Partial<AppState>) => {
    await storageLayer.updateAppState(updates);
  };

  const handleBackup = async () => {
    const currentState = await storageLayer.appState.getValue();
    const dataStr = JSON.stringify(currentState, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-context-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded successfully!');
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleRestoreFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed && typeof parsed === 'object') {
          // Merge with current state to avoid breaking schema
          const currentState = await storageLayer.appState.getValue();
          await storageLayer.appState.setValue({ ...currentState, ...parsed });
          showToast('Settings restored successfully!');
        }
      } catch (err) {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  const resetToDefaults = async () => {
    if (confirm('Are you sure you want to reset all settings to defaults? Your snapshots and history will be kept.')) {
      await updateSettings({
        theme: defaultState.theme,
        thresholds: defaultState.thresholds,
        notificationsEnabled: defaultState.notificationsEnabled,
        supportedPlatforms: defaultState.supportedPlatforms,
        summaryFrequency: defaultState.summaryFrequency,
        exportFormat: defaultState.exportFormat,
        storageLocation: defaultState.storageLocation,
        privacy: defaultState.privacy
      });
      showToast('Settings reset to defaults.');
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-10 text-[var(--text-primary)]">
      
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[var(--status-healthy)] text-white px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
          <Check size={16} /> {toast}
        </div>
      )}

      {/* General Appearance */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
          <Monitor size={16} /> Appearance
        </h3>
        
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Theme Mode</span>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Choose your preferred visual style</p>
            </div>
            <div className="flex bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-subtle)]">
              {(['dark', 'light', 'system'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => updateSettings({ theme: t })}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 capitalize transition-all ${state.theme === t ? 'bg-[var(--bg-tertiary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {t === 'dark' && <Moon size={14} />}
                  {t === 'light' && <Sun size={14} />}
                  {t === 'system' && <Monitor size={14} />}
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Warning Thresholds */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
          <Bell size={16} /> Alerts & Thresholds
        </h3>
        
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Enable Smart Notifications</span>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Show toast cards when approaching limits</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={state.notificationsEnabled} onChange={e => updateSettings({ notificationsEnabled: (e.target as HTMLInputElement).checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-cyan)]"></div>
            </label>
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-[var(--status-caution)]">Caution Threshold</span>
              <span>{state.thresholds.caution}%</span>
            </div>
            <input type="range" min="50" max="80" value={state.thresholds.caution} onChange={e => updateSettings({ thresholds: { ...state.thresholds, caution: parseInt((e.target as HTMLInputElement).value) } })} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--status-caution)]" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-[var(--status-warning)]">Warning Threshold</span>
              <span>{state.thresholds.warning}%</span>
            </div>
            <input type="range" min="70" max="90" value={state.thresholds.warning} onChange={e => updateSettings({ thresholds: { ...state.thresholds, warning: parseInt((e.target as HTMLInputElement).value) } })} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--status-warning)]" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-[var(--status-critical)]">Critical Threshold</span>
              <span>{state.thresholds.critical}%</span>
            </div>
            <input type="range" min="85" max="99" value={state.thresholds.critical} onChange={e => updateSettings({ thresholds: { ...state.thresholds, critical: parseInt((e.target as HTMLInputElement).value) } })} className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--status-critical)]" />
          </div>
        </div>
      </section>

      {/* Engine & Platforms */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
          <Database size={16} /> Data & Engine
        </h3>
        
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 flex flex-col gap-4">
          
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Supported Platforms</span>
            <div className="flex flex-col gap-2 mt-1">
              {(['chatgpt', 'claude', 'gemini'] as const).map(p => (
                <label key={p} className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={state.supportedPlatforms[p]} onChange={e => updateSettings({ supportedPlatforms: { ...state.supportedPlatforms, [p]: (e.target as HTMLInputElement).checked } })} className="rounded text-[var(--accent-cyan)] focus:ring-[var(--accent-cyan)] bg-[var(--bg-primary)] border-[var(--border-subtle)]" />
                  <span className="text-sm capitalize group-hover:text-[var(--accent-cyan)] transition-colors">{p === 'chatgpt' ? 'ChatGPT' : p}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-4 flex items-center justify-between">
            <span className="text-sm font-medium">Summary Update Frequency</span>
            <select 
              value={state.summaryFrequency} 
              onChange={e => updateSettings({ summaryFrequency: parseInt((e.target as HTMLSelectElement).value) })}
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
              value={state.exportFormat} 
              onChange={e => updateSettings({ exportFormat: (e.target as HTMLSelectElement).value as any })}
              className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[var(--accent-cyan)]"
            >
              <option value="markdown">Markdown (.md)</option>
              <option value="json">JSON (.json)</option>
              <option value="text">Plain Text (.txt)</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Storage Location</span>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Sync requires Chrome sign-in</p>
            </div>
            <select 
              value={state.storageLocation} 
              onChange={e => updateSettings({ storageLocation: (e.target as HTMLSelectElement).value as any })}
              className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[var(--accent-cyan)]"
            >
              <option value="local">Local Device Only</option>
              <option value="sync">Chrome Sync (Cloud)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
          <Shield size={16} /> Privacy
        </h3>
        
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Retain Conversation History</span>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Save past conversations locally</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={state.privacy.enableHistory} onChange={e => updateSettings({ privacy: { ...state.privacy, enableHistory: (e.target as HTMLInputElement).checked } })} className="sr-only peer" />
              <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-cyan)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[var(--status-critical)]">Anonymous Analytics</span>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Help improve Context Tracker</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={state.privacy.allowAnalytics} onChange={e => updateSettings({ privacy: { ...state.privacy, allowAnalytics: (e.target as HTMLInputElement).checked } })} className="sr-only peer" />
              <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--status-critical)]"></div>
            </label>
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
          <Keyboard size={16} /> Keyboard Shortcuts
        </h3>
        
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--text-secondary)]">Toggle Widget Visibility</span>
            <kbd className="px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded text-xs font-mono">Alt+Shift+C</kbd>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--text-secondary)]">Open Sidepanel Dashboard</span>
            <kbd className="px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded text-xs font-mono">Alt+Shift+D</kbd>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--text-secondary)]">Generate Transfer Summary</span>
            <kbd className="px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded text-xs font-mono">Alt+Shift+T</kbd>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--text-secondary)]">Take Conversation Snapshot</span>
            <kbd className="px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded text-xs font-mono">Alt+Shift+S</kbd>
          </div>
        </div>
      </section>

      {/* Backup & Restore */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
          <Save size={16} /> Backup & Restore
        </h3>
        
        <div className="flex gap-3">
          <button onClick={handleBackup} className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors">
            <Download size={16} /> Backup Data
          </button>
          
          <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleRestoreFile} />
          
          <button onClick={handleRestoreClick} className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors">
            <Upload size={16} /> Restore Data
          </button>
        </div>
      </section>

      {/* Reset */}
      <div className="mt-4 border-t border-[var(--border-subtle)] pt-6 flex justify-center">
        <button onClick={resetToDefaults} className="text-sm font-medium text-[var(--status-critical)] hover:underline opacity-80 hover:opacity-100 transition-opacity">
          Reset all settings to default
        </button>
      </div>

    </div>
  );
}
