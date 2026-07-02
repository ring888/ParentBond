import type { ReactNode } from "react";

export function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {action && <span>{action}</span>}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track" aria-label={`完成进度 ${value}%`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <article className="stat-tile">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

export function ListIcon({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="list-icon">
      {icon}
      <span>{label}</span>
    </div>
  );
}
