import type { ReactNode } from "react";
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
export function PeriodPicker({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <input type="date" value={from} onChange={(e) => onChange(e.target.value, to)} className="h-9 rounded-md border border-input bg-card px-2" />
      <span className="text-muted-foreground">até</span>
      <input type="date" value={to} onChange={(e) => onChange(from, e.target.value)} className="h-9 rounded-md border border-input bg-card px-2" />
    </div>
  );
}
