import { HealthStatus } from '../../shared/types';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-preact';

export function HealthBadge({ status }: { status: HealthStatus }) {
  const configs = {
    healthy: {
      color: 'text-[var(--status-healthy)]',
      bg: 'bg-[var(--status-healthy)]/10',
      border: 'border-[var(--status-healthy)]/20',
      label: 'Healthy',
      icon: <CheckCircle2 size={14} />
    },
    caution: {
      color: 'text-[var(--status-caution)]',
      bg: 'bg-[var(--status-caution)]/10',
      border: 'border-[var(--status-caution)]/20',
      label: 'Caution',
      icon: <AlertTriangle size={14} />
    },
    warning: {
      color: 'text-[var(--status-warning)]',
      bg: 'bg-[var(--status-warning)]/10',
      border: 'border-[var(--status-warning)]/20',
      label: 'Warning',
      icon: <AlertTriangle size={14} fill="currentColor" />
    },
    critical: {
      color: 'text-[var(--status-critical)]',
      bg: 'bg-[var(--status-critical)]/10',
      border: 'border-[var(--status-critical)]/20',
      label: 'Critical',
      icon: <AlertCircle size={14} />
    }
  };

  const c = configs[status] || configs.healthy;

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${c.bg} ${c.border} ${c.color} font-medium text-xs tracking-wide shadow-sm transition-colors duration-300`}
      role="status"
      aria-label={`Context health status: ${c.label}`}
    >
      {status === 'critical' ? (
        <div className="relative flex items-center justify-center w-3.5 h-3.5">
          <div className="absolute inline-flex h-full w-full rounded-full bg-[var(--status-critical)] opacity-75 animate-ping"></div>
          {c.icon}
        </div>
      ) : (
        c.icon
      )}
      {c.label}
    </div>
  );
}
