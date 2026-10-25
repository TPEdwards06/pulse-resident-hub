import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, must } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Panel, StaffTitle, btnGhost, td, th } from "@/components/pulse/staff";

export const Route = createFileRoute("/staff/rooms")({
  component: StaffRooms,
});

function StaffRooms() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["staff-reservations"],
    queryFn: () => must(supabase.from("reservations").select("*, rooms(name), profiles(full_name, units(unit_number))").gte("ends_at", new Date().toISOString()).order("starts_at").limit(300)),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => must(supabase.from("reservations").delete().eq("id", id)),
    onSuccess: () => { toast.success("Booking cancelled"); qc.invalidateQueries({ queryKey: ["staff-reservations"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div>
      <StaffTitle title="Room bookings" sub="Upcoming study and conference room reservations." />
      <Panel className="overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr className="border-b border-black/10"><th className={th}>Room</th><th className={th}>When</th><th className={th}>Resident</th><th className={th} /></tr></thead>
          <tbody className="divide-y divide-black/5">
            {data.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.rooms?.name}</td>
                <td className={td}>{fmtDateTime(r.starts_at)} – {new Date(r.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</td>
                <td className={td}>{r.profiles?.full_name} <span className="text-xs text-black/55">{r.profiles?.units?.unit_number}</span></td>
                <td className={td}><button className={btnGhost} onClick={() => cancel.mutate(r.id)}>Cancel</button></td>
              </tr>
            ))}
            {data.length === 0 && <tr><td className={td} colSpan={4}>No upcoming bookings.</td></tr>}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
