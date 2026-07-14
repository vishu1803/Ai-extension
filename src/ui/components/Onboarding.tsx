import { useState } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState';
import { ArrowRight, Check, Sparkles, Activity, ArrowRightLeft, Shield, Moon, Sun, Monitor } from 'lucide-preact';
import { AppState } from '../../storage';

interface OnboardingProps {
  onFinish?: () => void;
}

export function Onboarding({ onFinish }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const state = useAppState();

  const updateSettings = async (updates: Partial<AppState>) => {
    const { storageLayer } = await import('../../storage');
    await storageLayer.updateAppState(updates);
  };

  const nextStep = () => setStep(s => s + 1);
  const finish = () => {
    if (onFinish) onFinish();
  };

  if (step === 1) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] p-6 text-[var(--text-primary)]">
        <div className="max-w-xl w-full animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
          
          <div className="w-24 h-24 mx-auto bg-[var(--accent-gradient)] rounded-3xl flex items-center justify-center mb-8 shadow-[var(--shadow-card)] relative group cursor-default">
            <div className="absolute inset-0 bg-white/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Sparkles size={40} className="text-white" />
          </div>

          <h1 className="text-4xl font-bold mb-4 tracking-tight">Welcome to AI Context Tracker</h1>
          <p className="text-lg text-[var(--text-secondary)] mb-10 leading-relaxed max-w-md mx-auto">
            Take control of your AI conversations. Monitor context limits, prevent memory degradation, and transfer knowledge across platforms effortlessly.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 text-left">
            <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex flex-col items-center text-center">
              <Activity size={24} className="text-[var(--accent-cyan)] mb-3" />
              <h3 className="font-semibold mb-2">Track Context</h3>
              <p className="text-xs text-[var(--text-muted)]">Real-time visibility into token consumption.</p>
            </div>
            <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex flex-col items-center text-center">
              <Shield size={24} className="text-[var(--status-caution)] mb-3" />
              <h3 className="font-semibold mb-2">Health Alerts</h3>
              <p className="text-xs text-[var(--text-muted)]">Get warned before the AI forgets context.</p>
            </div>
            <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex flex-col items-center text-center">
              <ArrowRightLeft size={24} className="text-[var(--accent-purple)] mb-3" />
              <h3 className="font-semibold mb-2">Smart Transfer</h3>
              <p className="text-xs text-[var(--text-muted)]">Move context smoothly between platforms.</p>
            </div>
          </div>

          <button onClick={nextStep} className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--accent-gradient)] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all text-lg">
            Get Started <ArrowRight size={20} />
          </button>
          
          <p className="text-xs text-[var(--text-muted)] mt-6 font-medium tracking-wide uppercase">100% Local • Zero Data Collection</p>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] p-6 text-[var(--text-primary)]">
        <div className="max-w-xl w-full animate-in fade-in slide-in-from-right-8 duration-500">
          
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3 tracking-tight">Quick Setup</h2>
            <p className="text-[var(--text-secondary)]">Let's tailor the experience to your workflow.</p>
          </div>

          <div className="flex flex-col gap-6 mb-10">
            
            {/* Theme Selection */}
            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <h3 className="font-semibold mb-4 text-center">Choose your theme</h3>
              <div className="flex gap-4">
                {(['dark', 'light', 'system'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => updateSettings({ theme: t })}
                    className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all capitalize font-medium ${
                      state.theme === t 
                        ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]' 
                        : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {t === 'dark' && <Moon size={24} />}
                    {t === 'light' && <Sun size={24} />}
                    {t === 'system' && <Monitor size={24} />}
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div className="p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center">
              <h3 className="font-semibold mb-2">Supported Platforms Active</h3>
              <p className="text-sm text-[var(--text-muted)] mb-5">Context Tracker runs automatically on these sites.</p>
              
              <div className="flex justify-center gap-6">
                <div className="flex flex-col items-center gap-2 text-[var(--accent-cyan)]">
                  <div className="w-12 h-12 rounded-full bg-[var(--accent-cyan)]/20 flex items-center justify-center">
                    <Check size={20} />
                  </div>
                  <span className="text-xs font-semibold">ChatGPT</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-[var(--accent-purple)]">
                  <div className="w-12 h-12 rounded-full bg-[var(--accent-purple)]/20 flex items-center justify-center">
                    <Check size={20} />
                  </div>
                  <span className="text-xs font-semibold">Claude</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-[#4285F4]">
                  <div className="w-12 h-12 rounded-full bg-[#4285F4]/20 flex items-center justify-center">
                    <Check size={20} />
                  </div>
                  <span className="text-xs font-semibold">Gemini</span>
                </div>
              </div>
            </div>
            
          </div>

          <div className="flex gap-4">
            <button onClick={() => setStep(1)} className="px-6 py-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] rounded-xl font-semibold transition-colors">
              Back
            </button>
            <button onClick={nextStep} className="flex-1 flex justify-center items-center gap-2 py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl font-semibold hover:opacity-90 transition-opacity">
              Continue
            </button>
          </div>
          
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] p-6 text-[var(--text-primary)]">
      <div className="max-w-xl w-full animate-in zoom-in duration-500 text-center">
        
        <div className="w-24 h-24 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-8 border-4 border-green-500/30">
          <Check size={48} className="text-green-500" />
        </div>

        <h2 className="text-3xl font-bold mb-4 tracking-tight">You're all set!</h2>
        <p className="text-lg text-[var(--text-secondary)] mb-10 leading-relaxed max-w-md mx-auto">
          AI Context Tracker is running silently in the background. Open any supported AI chat platform to see the widget in action.
        </p>

        <button onClick={finish} className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--accent-gradient)] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all text-lg">
          Complete Setup
        </button>
        
      </div>
    </div>
  );
}
