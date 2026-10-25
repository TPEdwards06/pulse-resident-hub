import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, must } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { ResidentPicker } from "@/components/pulse/ResidentPicker";
import { Panel, StaffTitle, btn, btnGhost, td, th } from "@/components/pulse/staff";

export const Route = createFileRoute("/staff/packages")({
  component: StaffPackages,
});

const CARRIERS = ["Amazon", "UPS", "FedEx", "USPS", "DHL", "Other"];

function StaffPackages() {
  const qc = useQueryClient();
  const [resident, setResident] = useState("");
  const [carrier, setCarrier] = useState("Amazon");
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["staff-packages", showAll],
    queryFn: () => {
      let q = supabase.from("packages").select("*, profiles(full_name, units(unit_number))").order("arrived_at", { ascending: false }).limit(200);
      if (!showAll) q = q.is("picked_up_at", null);
      return must(q);
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["staff-packages"] });
  const log = useMutation({
    mutationFn: async () => {
      if (!resident) throw new Error("Choose a resident");
      await must(supabase.from("packages").insert({ resident_id: resident, carrier, note: note.trim().slice(0, 200) || null }));
    },
    onSuccess: () => { toast.success("Logged — resident notified"); setNote(""); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const pickup = useMutation({
    mutationFn: (id: string) => must(supabase.from("packages").update({ picked_up_at: new Date().toISOString() }).eq("id", id)),
    onSuccess: refresh,
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <StaffTitle title="Packages" sub="Logging a package sends the resident a personal notification." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel title="Log a package">
          <div className="grid gap-2 font-type text-sm">
            <ResidentPicker value={resident} onChange={setResident} />
            <select className="field" value={carrier} onChange={(e) => setCarrier(e.target.value)}>{CARRIERS.map((c) => <option key={c}>{c}</option>)}</select>
            <input className="field" placeholder="Note (e.g. Large box)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className={btn} disabled={log.isPending} onClick={() => log.mutate()}>Log & notify</button>
          </div>
        </Panel>
        <Panel className="overflow-x-auto p-0">
          <label className="flex items-center gap-2 p-4 font-type text-sm"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show picked-up packages</label>
          <table className="w-full">
            <thead><tr className="border-y border-black/10"><th className={th}>Unit</th><th className={th}>Resident</th><th className={th}>Package</th><th className={th}>Arrived</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-black/5">
              {data.map((p) => (
                <tr key={p.id}>
                  <td className={td}>{p.profiles?.units?.unit_number}</td>
                  <td className={td}>{p.profiles?.full_name}</td>
                  <td className={td}>{p.carrier}{p.note ? ` · ${p.note}` : ""}</td>
                  <td className={`${td} text-xs`}>{fmtDateTime(p.arrived_at)}</td>
                  <td className={td}>{p.picked_up_at ? <span className="text-xs text-black/55">Picked up {fmtDateTime(p.picked_up_at)}</span> : <button className={btnGhost} onClick={() => pickup.mutate(p.id)}>Picked up</button>}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td className={td} colSpan={5}>No packages waiting.</td></tr>}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
