import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, must, rpc } from "@/lib/api";
import { daysUntil, fmtDate, leftLabel, money } from "@/lib/format";
import type { RenewalRow } from "@/lib/staff-types";
import { Panel, StaffTitle, btn, btnGhost, td, th } from "@/components/pulse/staff";

export const Route = createFileRoute("/staff/renewals")({
  component: Renewals,
});

const STATUS = { undecided: "Undecided", renewing: "Renewing", not_renewing: "Not renewing" };

function Renewals() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["renewal-board"], queryFn: () => rpc<RenewalRow[]>("renewal_board") });
  const [editing, setEditing] = useState<RenewalRow | null>(null);
  const [rent, setRent] = useState("");
  const [expires, setExpires] = useState("");
  const [status, setStatus] = useState<"all" | RenewalRow["renewal_status"]>("undecided");

  const save = useMutation({
    mutationFn: async () => {
      const r = editing!;
      const amount = Number(rent);
      if (!(amount > 0 && amount <= 10000)) throw new Error("Offer must be between $1 and $10,000");
      if (!expires) throw new Error("Pick an offer expiry date");
      // Insert or update; the database trigger notifies the resident (and flags a price change).
      await must(supabase.from("renewal_offers").upsert(
        { resident_id: r.resident_id, current_rent: r.current_rent ?? amount, offer_rent: amount, offer_expires: expires },
        { onConflict: "resident_id" },
      ));
    },
    onSuccess: () => { toast.success(`Offer saved — ${editing!.full_name} was notified`); setEditing(null); qc.invalidateQueries({ queryKey: ["renewal-board"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const rows = data.filter((r) => status === "all" || r.renewal_status === status);

  return (
    <div>
      <StaffTitle title="Renewals" sub="Who's running out of time — and whether they've even seen their notice." />
      <div className="mb-3 flex flex-wrap gap-2 font-type text-sm">
        {(["undecided", "renewing", "not_renewing", "all"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 ${status === s ? "bg-black text-white" : "bg-white"}`}>
            {s === "all" ? "All" : STATUS[s]} ({s === "all" ? data.length : data.filter((r) => r.renewal_status === s).length})
          </button>
        ))}
      </div>
      <Panel className="overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr className="border-b border-black/10">
            <th className={th}>Resident</th><th className={th}>Deadline</th><th className={th}>Status</th><th className={th}>Rent → Offer</th><th className={th}>Renewal notices</th><th className={th} />
          </tr></thead>
          <tbody className="divide-y divide-black/5">
            {isLoading && <tr><td className={td} colSpan={6}>Loading…</td></tr>}
            {rows.map((r) => {
              const deadline = r.offer_expires ?? r.lease_end;
              const left = daysUntil(deadline);
              const hot = r.renewal_status === "undecided" && left != null && left <= 14;
              return (
                <tr key={r.resident_id} className={hot ? "bg-amber-pill/10" : ""}>
                  <td className={td}><b>{r.full_name}</b><div className="text-xs text-black/55">{r.unit_number} · lease ends {fmtDate(r.lease_end)}</div></td>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(deadline)}<div className={`text-xs ${hot ? "font-bold text-urgent" : "text-black/55"}`}>{leftLabel(left)}</div></td>
                  <td className={td}>{STATUS[r.renewal_status]}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {money(r.current_rent)} → {r.offer_rent ? <b>{money(r.offer_rent)}</b> : <span className="text-black/50">no offer</span>}
                    {r.previous_offer_rent != null && Number(r.previous_offer_rent) !== Number(r.offer_rent) && <div className="text-[11px] text-urgent">changed from {money(r.previous_offer_rent)}</div>}
                  </td>
                  <td className={`${td} text-xs`}>
                    {r.renewal_notices === 0 ? "None sent" : r.renewal_notices_seen === 0 ? <b className="text-urgent">0 of {r.renewal_notices} opened</b> : `${r.renewal_notices_seen} of ${r.renewal_notices} opened`}
                  </td>
                  <td className={td}>
                    <button className={btnGhost} onClick={() => { setEditing(r); setRent(String(r.offer_rent ?? Math.round(Number(r.current_rent ?? 0) * 1.04))); setExpires(r.offer_expires ?? ""); }}>
                      {r.offer_rent ? "Edit offer" : "Send offer"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-sm rounded-[1.4rem] bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-hand text-2xl">Renewal offer · {editing.full_name}</h2>
            <p className="font-type text-xs text-black/60">Current rent {money(editing.current_rent)}. Changing the price notifies the resident immediately.</p>
            <div className="mt-3 grid gap-2 font-type text-sm">
              <label className="grid gap-1">Offer rent ($/mo)<input className="field" type="number" min={1} max={10000} value={rent} onChange={(e) => setRent(e.target.value)} /></label>
              <label className="grid gap-1">Offer expires<input className="field" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
            </div>
            <div className="mt-4 flex gap-2">
              <button className={`${btn} flex-1`} disabled={save.isPending} onClick={() => save.mutate()}>Save & notify</button>
              <button className={btnGhost} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
