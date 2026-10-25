import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { must } from "@/lib/api";

export function useResidents() {
  return useQuery({
    queryKey: ["residents"],
    queryFn: () => must(supabase.from("profiles").select("id, full_name, email, unit_id, lease_end, current_rent, renewal_status, phone, units(unit_number, building, floor)").not("unit_id", "is", null)),
    select: (rows) => [...rows].sort((a, b) => (a.units?.unit_number ?? "").localeCompare(b.units?.unit_number ?? "")),
  });
}

export function ResidentPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data = [] } = useResidents();
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose unit / resident…</option>
      {data.map((r) => <option key={r.id} value={r.id}>{r.units?.unit_number} — {r.full_name}</option>)}
    </select>
  );
}
