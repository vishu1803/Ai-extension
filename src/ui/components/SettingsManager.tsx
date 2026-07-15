import { useAppState } from '../hooks/useAppState';
import { storageLayer } from '../../storage';
import { AppState } from '../../shared/types';

export function SettingsManager() {
  const state = useAppState();

  const updateSettings = async (updates: Partial<AppState>) => {
    await storageLayer.updateAppState(updates);
  };

  return (
    <div className="flex flex-col gap-6 p-4 text-[#f4f4f5] bg-[#0a0a0c] h-full">
      {/* Extension Status */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
          Extension Status
        </h3>

        <div className="bg-[#121216] border border-[#2a2a30] rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[14px] font-medium text-white">Enable Context Tracking</span>
              <p className="text-[12px] text-[#a1a1aa] mt-0.5">
                Pause tracking if you're having private conversations.
              </p>
            </div>
            {/* Toggle */}
            <button
              onClick={() => updateSettings({ trackingEnabled: !state.trackingEnabled })}
              className={`w-10 h-5.5 rounded-full relative transition-colors ${state.trackingEnabled ? 'bg-[#22d3ee]' : 'bg-[#3f3f46]'}`}
            >
              <div
                className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform ${state.trackingEnabled ? 'left-[19px]' : 'left-[2px]'}`}
              ></div>
            </button>
          </div>
        </div>
      </section>

      {/* Thresholds */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
          Thresholds
        </h3>

        <div className="bg-[#121216] border border-[#2a2a30] rounded-xl p-4 flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <span className="text-[14px] font-medium text-white">
              Warning Level ({state.thresholds.warning}%)
            </span>
            <input
              type="range"
              min="50"
              max="90"
              value={state.thresholds.warning}
              onChange={(e) =>
                updateSettings({
                  thresholds: {
                    ...state.thresholds,
                    warning: parseInt((e.target as HTMLInputElement).value),
                  },
                })
              }
              className="w-full h-1.5 bg-[#2a2a30] rounded-lg appearance-none cursor-pointer accent-[#eab308]"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[14px] font-medium text-white">
              Critical Level ({state.thresholds.critical}%)
            </span>
            <input
              type="range"
              min="80"
              max="99"
              value={state.thresholds.critical}
              onChange={(e) =>
                updateSettings({
                  thresholds: {
                    ...state.thresholds,
                    critical: parseInt((e.target as HTMLInputElement).value),
                  },
                })
              }
              className="w-full h-1.5 bg-[#2a2a30] rounded-lg appearance-none cursor-pointer accent-[#ef4444]"
            />
          </div>
        </div>
      </section>

      {/* Advanced */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
          Advanced
        </h3>

        <div className="bg-[#121216] border border-[#2a2a30] rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[14px] font-medium text-white">Auto-Snapshot</span>
              <p className="text-[12px] text-[#a1a1aa] mt-0.5">
                Take a snapshot automatically when context reaches 90%
              </p>
            </div>
            {/* Toggle */}
            <button className="w-10 h-5.5 rounded-full relative transition-colors bg-[#22d3ee] shrink-0 ml-2">
              <div className="absolute top-0.5 left-[19px] w-4.5 h-4.5 bg-white rounded-full transition-transform"></div>
            </button>
          </div>

          <div className="border-t border-[#2a2a30] pt-4 flex items-center justify-between">
            <span className="text-[14px] font-medium text-white">Dark Mode</span>
            {/* Toggle */}
            <button
              onClick={() => updateSettings({ theme: state.theme === 'dark' ? 'light' : 'dark' })}
              className={`w-10 h-5.5 rounded-full relative transition-colors shrink-0 ${state.theme === 'dark' ? 'bg-[#22d3ee]' : 'bg-[#3f3f46]'}`}
            >
              <div
                className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform ${state.theme === 'dark' ? 'left-[19px]' : 'left-[2px]'}`}
              ></div>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
