import type { ReactNode } from "react";

export function StaffTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-hand text-4xl leading-tight">{title}</h1>
        {sub && <p className="font-type text-sm text-black/65">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[1.4rem] bg-white p-5 ${className}`}>
      {title && <h2 className="mb-3 font-hand text-2xl text-amber-ink">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-[1.4rem] bg-white p-4">
      <p className="font-type text-xs uppercase tracking-wide text-black/55">{label}</p>
      <p className="mt-1 font-hand text-4xl leading-none">{value}</p>
      {hint && <p className="mt-1 font-type text-xs text-black/60">{hint}</p>}
    </div>
  );
}

// Seen / acknowledged bar for a message's reach.
export function ReachBar({ delivered, seen, acked, requiresAck }: { delivered: number; seen: number; acked: number; requiresAck: boolean }) {
  const p = (n: number) => (delivered ? Math.round((n / delivered) * 100) : 0);
  return (
    <div className="min-w-[160px]">
      <div className="relative h-2.5 overflow-hidden rounded-full bg-black/10">
        <div className="absolute inset-y-0 left-0 bg-amber-pill/50" style={{ width: `${p(seen)}%` }} />
        {requiresAck && <div className="absolute inset-y-0 left-0 bg-amber-pill" style={{ width: `${p(acked)}%` }} />}
      </div>
      <p className="mt-1 font-type text-[11px] text-black/65">
        {p(seen)}% seen{requiresAck ? ` · ${p(acked)}% confirmed` : ""} · {delivered} sent
      </p>
    </div>
  );
}

export const th = "px-3 py-2 text-left font-type text-[11px] font-bold uppercase tracking-wide text-black/55";
export const td = "px-3 py-2 font-type text-sm";
export const btn = "rounded-full bg-amber-pill px-4 py-2 font-type text-sm font-bold text-black hover:brightness-105 disabled:opacity-50";
export const btnGhost = "rounded-full border border-black px-4 py-2 font-type text-sm hover:bg-black/5 disabled:opacity-50";
