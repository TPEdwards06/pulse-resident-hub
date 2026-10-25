import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, must } from "@/lib/api";
import { fmtDate, money, toISODate } from "@/lib/format";
import { ResidentPicker } from "@/components/pulse/ResidentPicker";
import { Panel, StaffTitle, btn, td, th } from "@/components/pulse/staff";

export const Route = createFileRoute("/staff/charges")({
  component: Charges,
});

function Charges() {
  const qc = useQueryClient();
  const firstOfNext = (() => { const d = new Date(); return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 1)); })();
  const [form, setForm] = useState({ resident: "", description: "", amount: "", due: firstOfNext });
  const { data = [] } = useQuery({
    queryKey: ["staff-charges"],
    queryFn: () => must(supabase.from("charges").select("*, profiles(full_name, units(unit_number))").eq("status", "due").order("due_date").limit(300)),
  });
  const add = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      if (!form.resident) throw new Error("Choose a resident");
      if (!form.description.trim()) throw new Error("Add a description");
      if (!(amount > 0 && amount <= 10000)) throw new Error("Amount must be between $0.01 and $10,000");
      await must(supabase.from("charges").insert({ resident_id: form.resident, description: form.description.trim().slice(0, 120), amount, due_date: form.due }));
    },
    onSuccess: () => { toast.success("Charge added — resident notified"); setForm({ ...form, description: "", amount: "" }); qc.invalidateQueries({ queryKey: ["staff-charges"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const total = data.reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div>
      <StaffTitle title="Charges" sub="New charges send a 'Payment due' notification automatically." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel title="Add a charge">
          <div className="grid gap-2 font-type text-sm">
            <ResidentPicker value={form.resident} onChange={(resident) => setForm({ ...form, resident })} />
            <input className="field" placeholder="Description (e.g. Parking permit)" maxLength={120} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input className="field" type="number" min={0.01} max={10000} step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <label className="grid gap-1">Due date<input className="field" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></label>
            <button className={btn} disabled={add.isPending} onClick={() => add.mutate()}>Add & notify</button>
          </div>
        </Panel>
        <Panel title={`Outstanding · ${money(total)}`} className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-black/10"><th className={th}>Unit</th><th className={th}>Resident</th><th className={th}>Charge</th><th className={th}>Due</th><th className={th}>Amount</th></tr></thead>
            <tbody className="divide-y divide-black/5">
              {data.map((c) => (
                <tr key={c.id}><td className={td}>{c.profiles?.units?.unit_number}</td><td className={td}>{c.profiles?.full_name}</td><td className={td}>{c.description}</td><td className={td}>{fmtDate(c.due_date)}</td><td className={td}>{money(c.amount)}</td></tr>
              ))}
              {data.length === 0 && <tr><td className={td} colSpan={5}>Nothing outstanding.</td></tr>}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
