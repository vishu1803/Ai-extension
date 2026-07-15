import { AlertTriangle, AlertCircle, Info, Wrench, X } from 'lucide-preact';
import { HealthStatus } from '../../shared/types';
import { useEffect, useState, useCallback } from 'preact/hooks';

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

export function NotificationCard({
  id,
  severity,
  title,
  description,
  actions = [],
  onDismiss,
  autoDismissMs = 10000,
}: NotificationProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 200);
  }, [id, onDismiss]);

  useEffect(() => {
    if (autoDismissMs > 0) {
      const timer = setTimeout(() => handleDismiss(), autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismissMs, handleDismiss]);

  const getSeverityStyles = () => {
    switch (severity) {
      case 'caution':
        return {
          border: 'border-l-4 border-l-[#eab308]',
          icon: <AlertTriangle className="text-[#eab308]" size={16} />,
        };
      case 'warning':
        return {
          border: 'border-l-4 border-l-[#f97316]',
          icon: <AlertTriangle className="text-[#f97316]" size={16} />,
        };
      case 'critical':
        return {
          border: 'border-l-4 border-l-[#ef4444]',
          icon: <AlertCircle className="text-[#ef4444]" size={16} />,
        };
      case 'info':
        return {
          border: 'border-l-4 border-l-[#22d3ee]',
          icon: <Info className="text-[#22d3ee]" size={16} />,
        };
      case 'system':
      default:
        return {
          border: 'border-l-4 border-l-[#a1a1aa]',
          icon: <Wrench className="text-[#a1a1aa]" size={16} />,
        };
    }
  };

  const styles = getSeverityStyles();

  return (
    <div
      className={`w-[340px] rounded-lg shadow-2xl border border-[#2a2a30] bg-[#121216] p-4 flex gap-3 ${styles.border} pointer-events-auto transition-all duration-200 ease-out ${isExiting ? 'opacity-0 translate-x-8' : 'animate-in slide-in-from-right-8 fade-in'}`}
    >
      <div className="mt-1 shrink-0">{styles.icon}</div>

      <div className="flex-1 flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <h4 className="text-[14px] font-bold text-white leading-tight">{title}</h4>
          <button
            onClick={handleDismiss}
            className="text-[#a1a1aa] hover:text-white -mt-1 -mr-1 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[13px] text-[#a1a1aa] leading-snug">{description}</p>

        {actions.length > 0 && (
          <div className="flex gap-2 mt-2">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  action.onClick();
                  handleDismiss();
                }}
                className={`text-[12px] px-3 py-1.5 rounded-md font-semibold transition-colors ${action.primary ? 'bg-[#22d3ee] hover:bg-[#06b6d4] text-black' : 'bg-transparent border border-[#2a2a30] text-white hover:bg-[#2a2a30]'}`}
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
