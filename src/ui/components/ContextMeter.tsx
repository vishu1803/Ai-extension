import { HealthStatus } from '../../shared/types';

interface ContextMeterProps {
  value: number; // 0 to 100
  variant: 'circular' | 'semicircular' | 'mini';
  status: HealthStatus;
}

export function ContextMeter({ value, variant, status }: ContextMeterProps) {
  // Normalize value between 0 and 100
  const fill = Math.min(Math.max(value, 0), 100);
  
  // Colors based on status
  const gradientId = `gradient-${status}`;
  const strokeColors = {
    healthy: ['#00D4FF', '#3B82F6'], // cyan to blue
    caution: ['#FBBF24', '#F59E0B'], // yellow to amber
    warning: ['#F59E0B', '#F97316'], // amber to orange
    critical: ['#F97316', '#EF4444'] // orange to red
  };
  const [colorStart, colorEnd] = strokeColors[status] || strokeColors.healthy;

  if (variant === 'circular' || variant === 'mini') {
    const size = variant === 'circular' ? 140 : 60;
    const strokeWidth = variant === 'circular' ? 8 : 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (fill / 100) * circumference;

    return (
      <div 
        className="relative flex items-center justify-center" 
        style={{ width: size, height: size }}
        role="meter"
        aria-label="Context capacity used"
        aria-valuenow={Math.round(fill)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <svg width={size} height={size} className="transform -rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colorStart} />
              <stop offset="100%" stopColor={colorEnd} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="var(--border-subtle, rgba(255,255,255,0.08))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
        </svg>
        {variant === 'circular' && (
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-[var(--text-primary)]">{Math.round(fill)}%</span>
            <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider">Used</span>
          </div>
        )}
      </div>
    );
  }

  // Semicircular variant for Dashboard
  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI;
  const offset = circumference - (fill / 100) * circumference;

  return (
    <div 
      className="relative flex flex-col items-center justify-end" 
      style={{ width: size, height: size / 2 }}
      role="meter"
      aria-label="Context capacity used"
      aria-valuenow={Math.round(fill)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size / 2} className="overflow-hidden">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colorStart} />
            <stop offset="100%" stopColor={colorEnd} />
          </linearGradient>
        </defs>
        <path
          d={`M ${strokeWidth/2} ${size/2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${size/2}`}
          fill="transparent"
          stroke="var(--border-subtle, rgba(255,255,255,0.08))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={`M ${strokeWidth/2} ${size/2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${size/2}`}
          fill="transparent"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      <div className="absolute bottom-2 flex flex-col items-center">
        <span className="text-4xl font-bold text-[var(--text-primary)]">{Math.round(fill)}%</span>
      </div>
    </div>
  );
}
