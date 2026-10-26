export const parseDate = (s: string) => new Date(s.length <= 10 ? `${s}T00:00:00` : s);

export const money = (n: number | string | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const fmtDate = (s: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", year: "numeric" }) =>
  s ? parseDate(s).toLocaleDateString("en-US", opts) : "—";

export const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export function daysUntil(s: string | null | undefined) {
  if (!s) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDate(s).getTime() - today.getTime()) / 86400000);
}

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function renewalDeadline(leaseEnd: string | null | undefined, offerExpires?: string | null) {
  if (offerExpires) return offerExpires;
  if (!leaseEnd) return null;
  const d = parseDate(leaseEnd);
  d.setDate(d.getDate() - 60);
  return toISODate(d);
}

export function leftLabel(days: number | null) {
  if (days == null) return "no deadline";
  if (days < 0) return `deadline passed ${-days}d ago`;
  return days === 0 ? "due today" : `${days}d left`;
}

// Staff pages poll so read receipts show up without a reload.
export const LIVE_MS = 10_000;

export const fmtMinutes = (m: number | null) =>
  m == null ? "—" : m < 1 ? "< 1 min" : m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} days`;

export const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
