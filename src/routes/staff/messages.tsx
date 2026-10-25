import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { rpc } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { MsgStat } from "@/lib/staff-types";
import { Panel, ReachBar, StaffTitle, btn, td, th } from "@/components/pulse/staff";

export const Route = createFileRoute("/staff/messages")({
  component: Messages,
});

function Messages() {
  const child = useMatch({ from: "/staff/messages/$id", shouldThrow: false });
  const [personal, setPersonal] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["msg-stats", personal], queryFn: () => rpc<MsgStat[]>("message_stats", { _include_personal: personal }) });
  if (child) return <Outlet />;

  return (
    <div>
      <StaffTitle title="Messages & reach" sub="Sending isn't reaching — see who actually opened each message."
        right={<Link to="/staff/compose" className={btn}>New message</Link>} />
      <label className="mb-3 flex items-center gap-2 font-type text-sm">
        <input type="checkbox" checked={personal} onChange={(e) => setPersonal(e.target.checked)} /> Include automatic personal notifications
      </label>
      <Panel className="overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr className="border-b border-black/10"><th className={th}>Message</th><th className={th}>Audience</th><th className={th}>Sent</th><th className={th}>Reach</th></tr></thead>
          <tbody className="divide-y divide-black/5">
            {isLoading && <tr><td className={td} colSpan={4}>Loading…</td></tr>}
            {data.map((m) => {
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
                  <td className={`${td} whitespace-nowrap text-xs`}>{future ? <b>Scheduled {fmtDateTime(m.scheduled_at)}</b> : fmtDateTime(m.scheduled_at)}</td>
                  <td className={td}><ReachBar delivered={m.delivered} seen={m.seen} acked={m.acked} requiresAck={m.requires_ack} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
