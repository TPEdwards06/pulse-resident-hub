import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, must, rpc } from "@/lib/api";
import { fmtDate, fmtDateTime, money, toISODate } from "@/lib/format";
import { useResidents } from "@/components/pulse/ResidentPicker";
import { Panel, StaffTitle, btn, td, th } from "@/components/pulse/staff";

export const Route = createFileRoute("/staff/residents")({
  component: Residents,
});

type Pending = { id: string; full_name: string; email: string; created_at: string };

function Residents() {
  const qc = useQueryClient();
  const residents = useResidents();
  const pending = useQuery({ queryKey: ["pending"], queryFn: () => rpc<Pending[]>("pending_residents") });
  const units = useQuery({ queryKey: ["units"], queryFn: () => must(supabase.from("units").select("*").order("unit_number")) });
  const occupied = new Set((residents.data ?? []).map((r) => r.unit_id));
  const vacant = (units.data ?? []).filter((u) => !occupied.has(u.id));
  const [q, setQ] = useState("");

  return (
    <div>
      <StaffTitle title="Residents" sub="Self sign-ups stay pending until you verify their unit — they get no building messages until then." />
      <Panel title={`Pending verification (${pending.data?.length ?? 0})`}>
        {(pending.data ?? []).length === 0 ? <p className="font-type text-sm text-black/60">No one is waiting.</p> : (
          <ul className="divide-y divide-black/10">
            {pending.data!.map((p) => <PendingRow key={p.id} p={p} vacant={vacant} onDone={() => qc.invalidateQueries()} />)}
          </ul>
        )}
      </Panel>

      <Panel title={`Directory (${residents.data?.length ?? 0})`} className="mt-6 overflow-x-auto">
        <input className="field mb-3 max-w-xs" placeholder="Search name or unit" value={q} onChange={(e) => setQ(e.target.value)} />
        <table className="w-full">
          <thead><tr className="border-b border-black/10"><th className={th}>Unit</th><th className={th}>Name</th><th className={th}>Email</th><th className={th}>Phone</th><th className={th}>Lease ends</th><th className={th}>Rent</th></tr></thead>
          <tbody className="divide-y divide-black/5">
            {(residents.data ?? []).filter((r) => !q || `${r.full_name} ${r.units?.unit_number}`.toLowerCase().includes(q.toLowerCase())).map((r) => (
              <tr key={r.id}><td className={td}>{r.units?.unit_number}</td><td className={td}>{r.full_name}</td><td className={`${td} text-xs`}>{r.email}</td><td className={`${td} text-xs`}>{r.phone}</td><td className={td}>{fmtDate(r.lease_end)}</td><td className={td}>{money(r.current_rent)}</td></tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function PendingRow({ p, vacant, onDone }: { p: Pending; vacant: { id: string; unit_number: string }[]; onDone: () => void }) {
  const inAYear = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return toISODate(d); })();
  const [unit, setUnit] = useState("");
  const [lease, setLease] = useState(inAYear);
  const [rent, setRent] = useState("1100");
  const approve = useMutation({
    mutationFn: () => {
      if (!unit) throw new Error("Choose a unit");
      return rpc("approve_resident", { _profile: p.id, _unit: unit, _lease_end: lease, _rent: Number(rent) });
    },
    onSuccess: () => { toast.success(`${p.full_name} verified`); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <li className="flex flex-wrap items-end gap-2 py-3 font-type text-sm">
      <div className="mr-auto"><b>{p.full_name}</b><div className="text-xs text-black/55">{p.email} · signed up {fmtDateTime(p.created_at)}</div></div>
      <select className="field w-28" value={unit} onChange={(e) => setUnit(e.target.value)}>
        <option value="">Unit…</option>{vacant.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
      </select>
      <input className="field w-36" type="date" value={lease} onChange={(e) => setLease(e.target.value)} />
      <input className="field w-24" type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
      <button className={btn} disabled={approve.isPending} onClick={() => approve.mutate()}>Verify</button>
    </li>
  );
}
