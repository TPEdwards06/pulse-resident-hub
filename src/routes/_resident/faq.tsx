import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { must, rpc } from "@/lib/api";
import { Card, Empty, HandTitle, Loading, PageHeader } from "@/components/pulse/ui";

export const Route = createFileRoute("/_resident/faq")({
  component: Faq,
});

function Faq() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["faqs"],
    queryFn: () => must(supabase.from("faqs").select("*").order("view_count", { ascending: false })),
  });
  if (isLoading) return <Loading />;

  const term = q.trim().toLowerCase();
  const hits = data.filter((f) => !term || `${f.question} ${f.answer} ${f.category}`.toLowerCase().includes(term));
  const groups = [...new Set(hits.map((f) => f.category))];
  const toggle = (id: string) => {
    if (open !== id) rpc("view_faq", { _id: id }).catch(() => {});
    setOpen(open === id ? null : id);
  };

  return (
    <div>
      <PageHeader title="Resident FAQ" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={100}
        placeholder="Search — parking, guests, Wi-Fi…"
        className="w-full rounded-full border-0 bg-white px-4 py-2.5 font-type text-sm outline-none ring-1 ring-black/15 focus:ring-2 focus:ring-amber-pill"
      />
      <div className="mt-4 space-y-4">
        {groups.map((g) => (
          <Card key={g}>
            <HandTitle className="text-xl">{g}</HandTitle>
            <ul className="mt-1 divide-y divide-black/10">
              {hits.filter((f) => f.category === g).map((f) => (
                <li key={f.id}>
                  <button onClick={() => toggle(f.id)} className="flex w-full items-center justify-between gap-2 py-2.5 text-left font-type text-sm font-bold" aria-expanded={open === f.id}>
                    {f.question}<span className="text-amber-ink">{open === f.id ? "–" : "+"}</span>
                  </button>
                  {open === f.id && <p className="pb-3 font-type text-sm leading-relaxed text-black/80">{f.answer}</p>}
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {hits.length === 0 && <Card><Empty>No answers match "{q}".</Empty></Card>}
      </div>
      <Card className="mt-4 text-center">
        <p className="font-hand text-lg">Still need help?</p>
        <p className="font-type text-sm">Contact the office: <a className="underline" href="tel:+15125550100">(512) 555-0100</a></p>
        <p className="font-type text-xs text-black/60">Mon–Fri 9 AM – 6 PM · Sat 10 AM – 5 PM</p>
      </Card>
    </div>
  );
}
