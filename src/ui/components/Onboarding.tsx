import {
  Brain,
  Gauge,
  HeartPulse,
  ArrowRightLeft,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from 'lucide-preact';

interface OnboardingProps {
  onFinish?: () => void;
}

export function Onboarding({ onFinish }: OnboardingProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0c] p-6 text-[#f4f4f5]">
      <div className="max-w-4xl w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
        {/* Brain Icon */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 blur-3xl opacity-20"></div>
          <Brain
            size={80}
            className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 relative drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"
          />
        </div>

        {/* Headings */}
        <h1 className="text-[32px] md:text-[40px] font-bold mb-3 tracking-tight text-white">
          Welcome to AI Context Tracker
        </h1>
        <p className="text-[16px] md:text-[18px] text-[#a1a1aa] mb-12 max-w-lg mx-auto">
          Never lose context in your AI conversations again.
        </p>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 w-full max-w-3xl">
          <div className="p-6 rounded-2xl bg-[#121216] border border-[#2a2a30] flex flex-col items-center text-center hover:border-[#3f3f46] transition-colors">
            <Gauge size={32} className="text-[#22d3ee] mb-4" />
            <h3 className="text-[18px] font-semibold mb-2 text-white">Track Context</h3>
            <p className="text-[14px] text-[#a1a1aa] leading-snug px-2">
              Real-time token counting and context window monitoring
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121216] border border-[#2a2a30] flex flex-col items-center text-center hover:border-[#3f3f46] transition-colors">
            <HeartPulse size={32} className="text-[#4ade80] mb-4" />
            <h3 className="text-[18px] font-semibold mb-2 text-white">Health Alerts</h3>
            <p className="text-[14px] text-[#a1a1aa] leading-snug px-2">
              Know when your AI starts forgetting earlier instructions
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121216] border border-[#2a2a30] flex flex-col items-center text-center hover:border-[#3f3f46] transition-colors">
            <ArrowRightLeft size={32} className="text-[#a855f7] mb-4" />
            <h3 className="text-[18px] font-semibold mb-2 text-white">Smart Transfer</h3>
            <p className="text-[14px] text-[#a1a1aa] leading-snug px-2">
              Generate summaries to continue conversations anywhere
            </p>
          </div>
        </div>

        {/* Supported Platforms */}
        <div className="flex justify-center items-center gap-6 mb-12">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-[#10a37f] flex items-center justify-center text-white font-bold text-xs">
              GPT
            </div>
            <CheckCircle2 size={16} className="text-[#4ade80]" fill="currentColor" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-md bg-[#d97757] flex items-center justify-center text-white font-serif font-bold text-xs">
              Cl
            </div>
            <CheckCircle2 size={16} className="text-[#4ade80]" fill="currentColor" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#4285F4] font-bold text-xl">
              G
            </div>
            <CheckCircle2 size={16} className="text-[#a1a1aa]" fill="currentColor" />
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onFinish}
          className="inline-flex items-center gap-2 px-10 py-3.5 bg-gradient-to-r from-[#22d3ee] to-[#a855f7] text-black rounded-full font-bold text-[16px] hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:scale-105 transition-all mb-8"
        >
          Get Started <ArrowRight size={20} />
        </button>

        {/* Footer */}
        <div className="flex items-center gap-2 text-[13px] text-[#a1a1aa]">
          <ShieldCheck size={16} />
          <span>100% local · Zero data collection · Privacy first</span>
        </div>
      </div>
    </div>
  );
}
