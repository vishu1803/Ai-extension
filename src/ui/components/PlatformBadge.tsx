import { PlatformId } from '../../shared/types';
import { Bot, Sparkles, Cpu } from 'lucide-preact';

interface PlatformBadgeProps {
  platform: PlatformId | null;
  modelName?: string;
}

export function PlatformBadge({ platform, modelName }: PlatformBadgeProps) {
  if (!platform) return null;

  const configs = {
    chatgpt: {
      color: 'text-[#10A37F]',
      bg: 'bg-[#10A37F]/10',
      border: 'border-[#10A37F]/20',
      label: modelName || 'GPT-4',
      icon: <Cpu size={14} />
    },
    claude: {
      color: 'text-[#D97757]',
      bg: 'bg-[#D97757]/10',
      border: 'border-[#D97757]/20',
      label: modelName || 'Claude 3',
      icon: <Bot size={14} />
    },
    gemini: {
      color: 'text-[#1B73E8]',
      bg: 'bg-[#1B73E8]/10',
      border: 'border-[#1B73E8]/20',
      label: modelName || 'Gemini Pro',
      icon: <Sparkles size={14} />
    }
  };

  const c = configs[platform];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${c.bg} ${c.border} ${c.color} font-medium text-[11px]`}>
      {c.icon}
      <span>{c.label}</span>
    </div>
  );
}
