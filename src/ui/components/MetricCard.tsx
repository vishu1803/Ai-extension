interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
}

export function MetricCard({ label, value, trend, trendUp }: MetricCardProps) {
  return (
    <div className="flex flex-col p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] hover:shadow-lg hover:scale-[1.02] transition-all duration-150 ease-out cursor-default">
      <span className="text-[var(--text-secondary)] font-medium text-xs uppercase tracking-wider mb-1">
        {label}
      </span>
      <div className="flex items-baseline justify-between">
        <span className="text-[var(--text-primary)] font-bold text-2xl">
          {value}
        </span>
        {trend && (
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${trendUp ? 'bg-[var(--status-healthy)]/10 text-[var(--status-healthy)]' : 'bg-[var(--status-caution)]/10 text-[var(--status-caution)]'}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
