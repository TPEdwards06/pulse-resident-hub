import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { rpc } from "@/lib/api";
import { LIVE_MS, fmtDateTime, fmtMinutes } from "@/lib/format";
import type { MsgStat } from "@/lib/staff-types";
import { Panel, ReachBar, Stat, StaffTitle, btn, td, th } from "@/components/pulse/staff";

export const Route = createFileRoute("/staff/messages")({
  component: Messages,
});

function Messages() {
  const child = useMatch({ from: "/staff/messages/$id", shouldThrow: false });
  const [personal, setPersonal] = useState(false);
  const [q, setQ] = useState("");
  const { data = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["msg-stats", personal],
    queryFn: () => rpc<MsgStat[]>("message_stats", { _include_personal: personal }),
    refetchInterval: LIVE_MS,
  });
  if (child) return <Outlet />;

  const sent = data.filter((m) => new Date(m.scheduled_at).getTime() <= Date.now());
  const delivered = sent.reduce((s, m) => s + m.delivered, 0);
  const seen = sent.reduce((s, m) => s + m.seen, 0);
  const ackMsgs = sent.filter((m) => m.requires_ack);
  const ackDelivered = ackMsgs.reduce((s, m) => s + m.delivered, 0);
  const acked = ackMsgs.reduce((s, m) => s + m.acked, 0);
  const opens = sent.map((m) => m.median_open_minutes).filter((x): x is number => x != null).sort((a, b) => a - b);
  const typicalOpen = opens.length ? opens[Math.floor(opens.length / 2)] ?? null : null;
  const term = q.trim().toLowerCase();
  const rows = data.filter((m) => !term || `${m.title} ${m.audience_label ?? ""} ${m.sent_by}`.toLowerCase().includes(term));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <div>
      <StaffTitle title="Messages & reach" sub="Full history of every message: who it went to, who opened it, who confirmed."
        right={<Link to="/staff/compose" className={btn}>New message</Link>} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Messages sent" value={sent.length} hint={`${delivered} deliveries`} />
        <Stat label="Seen rate" value={pct(seen, delivered)} hint={`${seen} of ${delivered} opened`} />
        <Stat label="Confirmation rate" value={pct(acked, ackDelivered)} hint={`${acked} of ${ackDelivered} tapped "Got it"`} />
        <Stat label="Typical time to open" value={fmtMinutes(typicalOpen)} hint="Median across messages" />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-4 font-type text-sm">
        <input className="field max-w-xs" placeholder="Search title, audience or sender" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={personal} onChange={(e) => setPersonal(e.target.checked)} /> Include automatic notifications
        </label>
        <span className="ml-auto text-xs text-black/50">Live · updated {new Date(dataUpdatedAt || Date.now()).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
      </div>
      <Panel className="overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr className="border-b border-black/10"><th className={th}>Message</th><th className={th}>Audience</th><th className={th}>Sent by</th><th className={th}>Sent</th><th className={th}>Reach</th><th className={th}>Median open</th></tr></thead>
          <tbody className="divide-y divide-black/5">
            {isLoading && <tr><td className={td} colSpan={6}>Loading…</td></tr>}
            {rows.map((m) => {
              const future = new Date(m.scheduled_at).getTime() > Date.now();
              return (
                <tr key={m.id} className="hover:bg-cream/60">
                  <td className={td}>
                    <Link to="/staff/messages/$id" params={{ id: m.id }} className="font-bold hover:underline">{m.title}</Link>
                    <div className="text-[11px] uppercase tracking-wide text-black/50">
                      {m.priority === "urgent" && <b className="text-urgent">urgent · </b>}{m.category}{m.requires_ack ? " · needs confirmation" : ""}{m.parent_message_id ? " · follow-up" : ""}
                    </div>
                  </td>
                  <td className={`${td} text-xs`}>{m.audience_label}</td>
                  <td className={`${td} text-xs`}>{m.sent_by}</td>
                  <td className={`${td} whitespace-nowrap text-xs`}>{future ? <b>Scheduled {fmtDateTime(m.scheduled_at)}</b> : fmtDateTime(m.scheduled_at)}</td>
                  <td className={td}><ReachBar delivered={m.delivered} seen={m.seen} acked={m.acked} requiresAck={m.requires_ack} /></td>
                  <td className={`${td} whitespace-nowrap text-xs`}>{fmtMinutes(m.median_open_minutes)}</td>
                </tr>
              );
            })}
            {!isLoading && rows.length === 0 && <tr><td className={td} colSpan={6}>No messages match "{q}".</td></tr>}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
