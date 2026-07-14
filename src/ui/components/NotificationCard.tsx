import { AlertTriangle, AlertCircle, Info, Wrench, X } from 'lucide-preact';
import { HealthStatus } from '../../shared/types';
import { useEffect, useState } from 'preact/hooks';

export interface NotificationAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface NotificationProps {
  id: string;
  severity: HealthStatus | 'info' | 'system';
  title: string;
  description: string;
  actions?: NotificationAction[];
  onDismiss: (id: string) => void;
  autoDismissMs?: number;
}

export function NotificationCard({ id, severity, title, description, actions = [], onDismiss, autoDismissMs = 10000 }: NotificationProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (autoDismissMs > 0) {
      const timer = setTimeout(() => handleDismiss(), autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismissMs]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 200); // Wait for exit animation
  };

  const getSeverityStyles = () => {
    switch (severity) {
      case 'caution':
        return { border: 'border-l-[3px] border-l-[var(--status-caution)]', bg: 'bg-[var(--bg-primary)]', icon: <AlertTriangle className="text-[var(--status-caution)]" size={18} /> };
      case 'warning':
        return { border: 'border-l-[3px] border-l-[var(--status-warning)]', bg: 'bg-[var(--bg-primary)]', icon: <AlertTriangle className="text-[var(--status-warning)]" size={18} /> };
      case 'critical':
        return { border: 'border-l-[3px] border-l-[var(--status-critical)]', bg: 'bg-[var(--bg-primary)] shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]', icon: <AlertCircle className="text-[var(--status-critical)]" size={18} /> };
      case 'info':
        return { border: 'border-l-[3px] border-l-[var(--accent-cyan)]', bg: 'bg-[var(--bg-primary)]', icon: <Info className="text-[var(--accent-cyan)]" size={18} /> };
      case 'system':
      default:
        return { border: 'border-l-[3px] border-l-[var(--text-muted)]', bg: 'bg-[var(--bg-primary)]', icon: <Wrench className="text-[var(--text-muted)]" size={18} /> };
    }
  };

  const styles = getSeverityStyles();

  return (
    <div 
      className={`w-80 rounded-lg shadow-lg border border-[var(--border-subtle)] p-4 flex gap-3 ${styles.bg} ${styles.border} pointer-events-auto transition-all duration-200 ease-out ${isExiting ? 'opacity-0 translate-x-8' : 'animate-in slide-in-from-right-8 fade-in'}`}
    >
      <div className="mt-0.5 shrink-0">
        {styles.icon}
      </div>
      
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex justify-between items-start">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] leading-tight">{title}</h4>
          <button onClick={handleDismiss} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] -mt-1 -mr-1 transition-colors">
            <X size={16} />
          </button>
        </div>
        
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-1">
          {description}
        </p>
        
        {actions.length > 0 && (
          <div className="flex gap-2 mt-1">
            {actions.map((action, i) => (
              <button 
                key={i}
                onClick={() => { action.onClick(); handleDismiss(); }}
                className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${action.primary ? 'bg-[var(--bg-tertiary)] hover:bg-[var(--text-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
