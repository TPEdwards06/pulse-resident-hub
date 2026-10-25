import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, must, rpc } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Panel, ReachBar, StaffTitle, btn, td, th } from "@/components/pulse/staff";

export const Route = createFileRoute("/staff/messages/$id")({
  component: MessageDetail,
});

type Recipient = { delivery_id: string; resident_id: string; full_name: string; unit_number: string | null; building: string | null; seen_at: string | null; acked_at: string | null };

function MessageDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unseen" | "unconfirmed">("unseen");
  const msg = useQuery({ queryKey: ["message", id], queryFn: () => must(supabase.from("messages").select("*").eq("id", id).single()) });
  const rec = useQuery({ queryKey: ["recipients", id], queryFn: () => rpc<Recipient[]>("message_recipients", { _message_id: id }) });
  const resend = useMutation({
    mutationFn: () => rpc<number>("resend_reminder", { _message_id: id }),
    onSuccess: (n) => { toast.success(n ? `Reminder sent to ${n} resident${n === 1 ? "" : "s"} who haven't seen it` : "Everyone has seen it"); qc.invalidateQueries({ queryKey: ["msg-stats"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const m = msg.data;
  const all = rec.data ?? [];
  const seen = all.filter((r) => r.seen_at).length;
  const acked = all.filter((r) => r.acked_at).length;
  const rows = all.filter((r) => filter === "all" || (filter === "unseen" ? !r.seen_at : !r.acked_at));
  const unseen = all.length - seen;

  return (
    <div>
      <Link to="/staff/messages" className="font-type text-sm underline">← All messages</Link>
      <StaffTitle title={m?.title ?? "…"} sub={m ? `${m.audience_label ?? ""} · ${fmtDateTime(m.scheduled_at)}` : ""}
        right={<button className={btn} disabled={resend.isPending || unseen === 0} onClick={() => resend.mutate()}>Resend to {unseen} who haven't seen it</button>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel className="overflow-x-auto p-0">
          <div className="flex gap-2 p-4 font-type text-sm">
            {(["unseen", ...(m?.requires_ack ? ["unconfirmed"] : []), "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f as typeof filter)} className={`rounded-full px-3 py-1 ${filter === f ? "bg-black text-white" : "bg-cream"}`}>
                {f === "unseen" ? `Not seen (${unseen})` : f === "unconfirmed" ? `Not confirmed (${all.length - acked})` : `Everyone (${all.length})`}
              </button>
            ))}
          </div>
          <table className="w-full">
            <thead><tr className="border-y border-black/10"><th className={th}>Resident</th><th className={th}>Unit</th><th className={th}>Seen</th>{m?.requires_ack && <th className={th}>Confirmed</th>}</tr></thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((r) => (
                <tr key={r.delivery_id}>
                  <td className={td}>{r.full_name}</td>
                  <td className={td}>{r.unit_number}</td>
                  <td className={`${td} text-xs`}>{r.seen_at ? fmtDateTime(r.seen_at) : <b className="text-urgent">Not yet</b>}</td>
                  {m?.requires_ack && <td className={`${td} text-xs`}>{r.acked_at ? fmtDateTime(r.acked_at) : "—"}</td>}
                </tr>
              ))}
              {rows.length === 0 && <tr><td className={td} colSpan={4}>Nobody in this list 🎉</td></tr>}
            </tbody>
          </table>
        </Panel>
        <Panel title="Reach">
          <ReachBar delivered={all.length} seen={seen} acked={acked} requiresAck={!!m?.requires_ack} />
          <p className="mt-4 whitespace-pre-wrap font-type text-sm text-black/80">{m?.body}</p>
        </Panel>
      </div>
    </div>
  );
}
