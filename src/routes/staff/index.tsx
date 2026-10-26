import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, must, rpc } from "@/lib/api";
import { daysUntil, leftLabel } from "@/lib/format";
import type { MsgStat, RenewalRow } from "@/lib/staff-types";
import { Panel, ReachBar, Stat, StaffTitle, btn, btnGhost } from "@/components/pulse/staff";

export const Route = createFileRoute("/staff/")({
  component: Overview,
});

function Overview() {
  const qc = useQueryClient();
  const stats = useQuery({ queryKey: ["msg-stats"], queryFn: () => rpc<MsgStat[]>("message_stats") });
  const board = useQuery({ queryKey: ["renewal-board"], queryFn: () => rpc<RenewalRow[]>("renewal_board") });
  const pending = useQuery({ queryKey: ["pending"], queryFn: () => rpc<unknown[]>("pending_residents") });
  const pkgs = useQuery({
    queryKey: ["staff-packages-waiting"],
    queryFn: () => must(supabase.from("packages").select("id", { count: "exact", head: false }).is("picked_up_at", null)),
  });

  const reminders = useMutation({
    mutationFn: () => rpc<number>("run_daily_reminders"),
    onSuccess: (n) => { toast.success(n ? `Sent ${n} renewal reminder${n === 1 ? "" : "s"}` : "No reminders due today"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const reset = useMutation({
    mutationFn: () => rpc("reset_demo"),
    onSuccess: () => { toast.success("Demo data restored"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const recent = (stats.data ?? []).filter((m) => Date.now() - new Date(m.scheduled_at).getTime() < 14 * 864e5 && new Date(m.scheduled_at).getTime() <= Date.now());
  const sent = recent.reduce((s, m) => s + m.delivered, 0);
  const seen = recent.reduce((s, m) => s + m.seen, 0);
  const atRisk = (board.data ?? []).filter((r) => r.renewal_status === "undecided" && (daysUntil(r.offer_expires ?? r.lease_end) ?? 999) <= 30);
  const unseenRenewal = atRisk.filter((r) => r.renewal_notices > 0 && r.renewal_notices_seen === 0);

  return (
    <div>
      <StaffTitle
        title="Good to see you, Jane"
        sub="What residents have — and haven't — seen."
        right={
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={reminders.isPending} onClick={() => reminders.mutate()}>Run daily reminders</button>
            <button className={btnGhost} disabled={reset.isPending}
              onClick={() => confirm("Restore the original demo data? Everything changed during the demo will be replaced.") && reset.mutate()}>
              Reset demo data
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Seen rate (14 days)" value={sent ? `${Math.round((seen / sent) * 100)}%` : "—"} hint={`${seen} of ${sent} deliveries opened`} />
        <Stat label="Renewals at risk" value={atRisk.length} hint={`${unseenRenewal.length} haven't opened their renewal notice`} />
        <Stat label="Packages waiting" value={pkgs.data?.length ?? "—"} />
        <Stat label="Pending sign-ups" value={pending.data?.length ?? "—"} hint="Need unit verification" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Needs a follow-up">
          {unseenRenewal.length === 0 && atRisk.length === 0 ? (
            <p className="font-type text-sm text-black/60">No renewals at risk in the next 30 days.</p>
          ) : (
            <ul className="divide-y divide-black/10">
              {atRisk.slice(0, 8).map((r) => (
                <li key={r.resident_id} className="flex items-center justify-between py-2 font-type text-sm">
                  <span><b>{r.full_name}</b> · {r.unit_number}</span>
                  <span className="text-xs">
                    <span className={(daysUntil(r.offer_expires ?? r.lease_end) ?? 0) < 0 ? "font-bold text-urgent" : ""}>{leftLabel(daysUntil(r.offer_expires ?? r.lease_end))}</span> ·{" "}
                    {r.renewal_notices_seen === 0 ? <b className="text-urgent">never opened notice</b> : "opened notice"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/staff/renewals" className="mt-3 inline-block font-type text-sm underline">Open renewals board →</Link>
        </Panel>
        <Panel title="Latest messages">
          <ul className="space-y-3">
            {recent.slice(0, 5).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4">
                <Link to="/staff/messages/$id" params={{ id: m.id }} className="min-w-0 truncate font-type text-sm font-bold hover:underline">{m.title}</Link>
                <ReachBar delivered={m.delivered} seen={m.seen} acked={m.acked} requiresAck={m.requires_ack} />
              </li>
            ))}
          </ul>
          <Link to="/staff/compose" className={`${btn} mt-4 inline-block`}>New message</Link>
        </Panel>
      </div>
    </div>
  );
}
