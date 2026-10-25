import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, must } from "@/lib/api";
import { Panel, StaffTitle, btn, btnGhost } from "@/components/pulse/staff";

export const Route = createFileRoute("/staff/faqs")({
  component: Faqs,
});

const schema = z.object({
  question: z.string().trim().min(1, "Add a question").max(200),
  answer: z.string().trim().min(1, "Add an answer").max(2000),
  category: z.string().trim().min(1).max(40),
});
type Draft = { id?: string; question: string; answer: string; category: string };
const BLANK: Draft = { question: "", answer: "", category: "General" };

function Faqs() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["faqs"], queryFn: () => must(supabase.from("faqs").select("*").order("view_count", { ascending: false })) });
  const [draft, setDraft] = useState<Draft>(BLANK);
  const refresh = () => qc.invalidateQueries({ queryKey: ["faqs"] });
  const save = useMutation({
    mutationFn: async () => {
      const v = schema.parse(draft);
      if (draft.id) await must(supabase.from("faqs").update(v).eq("id", draft.id));
      else await must(supabase.from("faqs").insert(v));
    },
    onSuccess: () => { toast.success("FAQ saved"); setDraft(BLANK); refresh(); },
    onError: (e) => toast.error(e instanceof z.ZodError ? e.issues[0]?.message ?? "Check the form" : errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => must(supabase.from("faqs").delete().eq("id", id)),
    onSuccess: refresh,
    onError: (e) => toast.error(errMsg(e)),
  });
  const max = Math.max(1, ...data.map((f) => f.view_count));

  return (
    <div>
      <StaffTitle title="Resident FAQ" sub="Most-viewed first — these are the calls you're not getting." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel>
          <ul className="divide-y divide-black/10">
            {data.map((f) => (
              <li key={f.id} className="py-3 font-type text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div><b>{f.question}</b> <span className="text-xs text-black/50">· {f.category}</span><p className="mt-1 line-clamp-2 text-black/75">{f.answer}</p></div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="mb-1 h-1.5 w-24 rounded-full bg-black/10"><div className="h-full rounded-full bg-amber-pill" style={{ width: `${(f.view_count / max) * 100}%` }} /></div>
                    {f.view_count} views
                    <div className="mt-1 space-x-2">
                      <button className="underline" onClick={() => setDraft({ id: f.id, question: f.question, answer: f.answer, category: f.category })}>Edit</button>
                      <button className="text-urgent underline" onClick={() => confirm("Delete this FAQ?") && remove.mutate(f.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={draft.id ? "Edit FAQ" : "Add FAQ"}>
          <div className="grid gap-2 font-type text-sm">
            <input className="field" placeholder="Question" maxLength={200} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
            <textarea className="field min-h-32" placeholder="Answer" maxLength={2000} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
            <input className="field" placeholder="Category" maxLength={40} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            <div className="flex gap-2">
              <button className={`${btn} flex-1`} disabled={save.isPending} onClick={() => save.mutate()}>Save</button>
              {draft.id && <button className={btnGhost} onClick={() => setDraft(BLANK)}>Cancel</button>}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
