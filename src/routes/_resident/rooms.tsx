import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { errMsg, must } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { AmberButton, Card, Empty, HandTitle, Loading, PageHeader } from "@/components/pulse/ui";

export const Route = createFileRoute("/_resident/rooms")({
  component: Rooms,
});

// Rooms are open 7 AM – 11 PM (enforced in the database too).
const OPEN = 7;
const CLOSE = 23;

function Rooms() {
  const { data: me } = useMe();
  const pid = me?.profile?.id;
  const qc = useQueryClient();
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const [day, setDay] = useState(0);
  const [roomId, setRoomId] = useState<string>("");
  const [hours, setHours] = useState(1);

  const { data: rooms = [], isLoading } = useQuery({ queryKey: ["rooms"], queryFn: () => must(supabase.from("rooms").select("*").order("name")) });
  const { data: resv = [] } = useQuery({
    queryKey: ["reservations"],
    queryFn: () => must(supabase.from("reservations").select("*").gte("ends_at", new Date().toISOString()).order("starts_at")),
  });
  const room = roomId || rooms[0]?.id;

  const book = useMutation({
    mutationFn: async (startHour: number) => {
      const s = new Date(days[day]!); s.setHours(startHour);
      const e = new Date(s); e.setHours(startHour + hours);
      await must(supabase.from("reservations").insert({ room_id: room!, resident_id: pid!, starts_at: s.toISOString(), ends_at: e.toISOString() }));
    },
    onSuccess: () => { toast.success("Room booked!"); qc.invalidateQueries({ queryKey: ["reservations"] }); },
    onError: (e) => toast.error(/exclu|overlap|conflict/i.test(errMsg(e)) ? "Someone just booked that time — pick another slot." : errMsg(e)),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => must(supabase.from("reservations").delete().eq("id", id)),
    onSuccess: () => { toast.success("Booking cancelled"); qc.invalidateQueries({ queryKey: ["reservations"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <Loading />;
  const now = Date.now();
  const taken = (h: number) => {
    const s = new Date(days[day]!); s.setHours(h);
    const e = new Date(s); e.setHours(h + hours);
    return resv.some((r) => r.room_id === room && new Date(r.starts_at) < e && new Date(r.ends_at) > s);
  };
  const past = (h: number) => { const s = new Date(days[day]!); s.setHours(h); return s.getTime() <= now; };
  const mine = resv.filter((r) => r.resident_id === pid);

  return (
    <div>
      <PageHeader title="Reserve a Room" />
      <Card>
        <HandTitle className="text-xl">Pick a room</HandTitle>
        <div className="mt-2 grid gap-2">
          {rooms.map((r) => (
            <button key={r.id} onClick={() => setRoomId(r.id)}
              className={`rounded-2xl border-2 px-3 py-2 text-left font-type text-sm ${room === r.id ? "border-black bg-cream" : "border-transparent bg-cream/50"}`}>
              <span className="font-bold">{r.name}</span> <span className="text-xs text-black/60">· {r.location} · up to {r.capacity}</span>
            </button>
          ))}
        </div>

        <HandTitle className="mt-4 text-xl">Day</HandTitle>
        <div className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {days.map((d, i) => (
            <button key={i} onClick={() => setDay(i)}
              className={`shrink-0 rounded-xl px-2.5 py-1.5 text-center font-type text-xs ${day === i ? "bg-black text-white" : "bg-cream"}`}>
              <div>{i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" })}</div>
              <div className="font-bold">{d.getMonth() + 1}/{d.getDate()}</div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 font-type text-sm">
          Length:
          {[1, 2].map((h) => (
            <button key={h} onClick={() => setHours(h)} className={`rounded-full px-3 py-1 ${hours === h ? "bg-black text-white" : "bg-cream"}`}>{h} hr</button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {Array.from({ length: CLOSE - OPEN - hours + 1 }, (_, i) => OPEN + i).map((h) => {
            const off = taken(h) || past(h);
            return (
              <button key={h} disabled={off || book.isPending} onClick={() => book.mutate(h)}
                className={`rounded-xl py-2 font-type text-xs ${off ? "bg-black/5 text-black/30 line-through" : "bg-white ring-1 ring-black/20 hover:bg-amber-pill/30"}`}>
                {new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" })}
              </button>
            );
          })}
        </div>
        <p className="mt-3 font-type text-[11px] text-black/55">Up to 2 hours per booking, 14 days ahead, 3 upcoming bookings max.</p>
      </Card>

      <Card className="mt-4">
        <HandTitle className="text-xl">My bookings</HandTitle>
        {mine.length === 0 ? <Empty>No upcoming bookings.</Empty> : (
          <ul className="mt-2 space-y-2">
            {mine.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-2xl bg-cream px-3 py-2 font-type text-sm">
                <span><b>{rooms.find((x) => x.id === r.room_id)?.name}</b><br /><span className="text-xs">{fmtDateTime(r.starts_at)} – {new Date(r.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span></span>
                <AmberButton className="px-3 py-1 text-xs" onClick={() => cancel.mutate(r.id)} disabled={cancel.isPending}>Cancel</AmberButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
