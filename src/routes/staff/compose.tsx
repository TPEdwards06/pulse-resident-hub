import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, must, rpc } from "@/lib/api";
import { Panel, StaffTitle, btn } from "@/components/pulse/staff";

export const Route = createFileRoute("/staff/compose")({
  component: Compose,
});

const CATEGORIES = ["announcement", "event", "safety", "maintenance", "package", "payment", "renewal"] as const;
const STATUSES = [["undecided", "Undecided"], ["renewing", "Renewing"], ["not_renewing", "Not renewing"]] as const;

const schema = z.object({
  title: z.string().trim().min(1, "Add a title").max(120, "Title is limited to 120 characters"),
  body: z.string().max(2000, "Message is limited to 2000 characters"),
});

type Rule = { buildings: string[]; floors: string[]; unit_ids: string[]; renewal_statuses: string[]; lease_end_before: string };
const EMPTY: Rule = { buildings: [], floors: [], unit_ids: [], renewal_statuses: [], lease_end_before: "" };

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Compose() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("announcement");
  const [urgent, setUrgent] = useState(false);
  const [ack, setAck] = useState(false);
  const [when, setWhen] = useState("");
  const [rule, setRule] = useState<Rule>(EMPTY);

  const { data: units = [] } = useQuery({ queryKey: ["units"], queryFn: () => must(supabase.from("units").select("*").order("unit_number")) });
  const buildings = [...new Set(units.map((u) => u.building))];
  const floors = [...new Set(units.map((u) => String(u.floor)))].sort();

  const ruleJson = useMemo(() => {
    const r: Record<string, unknown> = {};
    for (const k of ["buildings", "floors", "unit_ids", "renewal_statuses"] as const) if (rule[k].length) r[k] = rule[k];
    if (rule.lease_end_before) r["lease_end_before"] = rule.lease_end_before;
    return r;
  }, [rule]);
  const label = useMemo(() => {
    const parts: string[] = [];
    if (rule.buildings.length) parts.push(`Building ${rule.buildings.join("/")}`);
    if (rule.floors.length) parts.push(`Floor ${rule.floors.join("/")}`);
    if (rule.unit_ids.length) parts.push(units.filter((u) => rule.unit_ids.includes(u.id)).map((u) => u.unit_number).join(", "));
    if (rule.renewal_statuses.length) parts.push(`Renewal: ${rule.renewal_statuses.join("/")}`);
    if (rule.lease_end_before) parts.push(`Lease ends before ${rule.lease_end_before}`);
    return parts.length ? parts.join(" · ") : "All residents";
  }, [rule, units]);

  // Debounced live recipient count.
  const [debounced, setDebounced] = useState(ruleJson);
  useEffect(() => { const t = setTimeout(() => setDebounced(ruleJson), 250); return () => clearTimeout(t); }, [ruleJson]);
  const count = useQuery({ queryKey: ["audience", debounced], queryFn: () => rpc<number>("audience_count", { rule: debounced }) });

  const send = useMutation({
    mutationFn: async () => {
      const v = schema.parse({ title, body });
      if (!count.data) throw new Error("No residents match this audience");
      return rpc<string>("send_message", {
        _title: v.title, _body: v.body, _category: category, _priority: urgent ? "urgent" : "normal",
        _requires_ack: ack, _rule: ruleJson, _label: label, _scheduled_at: when ? new Date(when).toISOString() : null,
      });
    },
    onSuccess: (id) => {
      toast.success(when ? `Scheduled for ${count.data} residents` : `Sent to ${count.data} residents`);
      qc.invalidateQueries({ queryKey: ["msg-stats"] });
      navigate({ to: "/staff/messages/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof z.ZodError ? e.issues[0]?.message ?? "Check the form" : errMsg(e)),
  });

  const chip = (on: boolean) => `rounded-full px-3 py-1 font-type text-sm ${on ? "bg-black text-white" : "bg-cream hover:bg-black/10"}`;

  return (
    <div>
      <StaffTitle title="Compose" sub="Building-wide or targeted — every recipient's view is tracked." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel title="Message">
          <div className="grid gap-3 font-type text-sm">
            <label className="grid gap-1">Title
              <input className="field" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fire Drill set for 3:25 PM on 10/7" />
              <span className="text-right text-[11px] text-black/50">{title.length}/120</span>
            </label>
            <label className="grid gap-1">Message
              <textarea className="field min-h-36" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What residents need to know…" />
              <span className="text-right text-[11px] text-black/50">{body.length}/2000</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setCategory(c)} className={chip(category === c)}>{c}</button>)}
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Urgent — pin to the top of residents' feeds</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Require "Got it" confirmation</label>
            <label className="grid gap-1">Send
              <input className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              <span className="text-[11px] text-black/50">Leave empty to send now.</span>
            </label>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Audience">
            <div className="grid gap-3 font-type text-sm">
              <button type="button" onClick={() => setRule(EMPTY)} className={chip(JSON.stringify(ruleJson) === "{}")}>All residents</button>
              <div>Building<div className="mt-1 flex flex-wrap gap-1.5">{buildings.map((b) => <button key={b} type="button" onClick={() => setRule({ ...rule, buildings: toggle(rule.buildings, b) })} className={chip(rule.buildings.includes(b))}>{b}</button>)}</div></div>
              <div>Floor<div className="mt-1 flex flex-wrap gap-1.5">{floors.map((f) => <button key={f} type="button" onClick={() => setRule({ ...rule, floors: toggle(rule.floors, f) })} className={chip(rule.floors.includes(f))}>{f}</button>)}</div></div>
              <div>Renewal status<div className="mt-1 flex flex-wrap gap-1.5">{STATUSES.map(([v, l]) => <button key={v} type="button" onClick={() => setRule({ ...rule, renewal_statuses: toggle(rule.renewal_statuses, v) })} className={chip(rule.renewal_statuses.includes(v))}>{l}</button>)}</div></div>
              <label className="grid gap-1">Lease ends before
                <input className="field" type="date" value={rule.lease_end_before} onChange={(e) => setRule({ ...rule, lease_end_before: e.target.value })} />
              </label>
              <details>
                <summary className="cursor-pointer">Specific units {rule.unit_ids.length ? `(${rule.unit_ids.length})` : ""}</summary>
                <div className="mt-2 flex flex-wrap gap-1">
                  {units.map((u) => <button key={u.id} type="button" onClick={() => setRule({ ...rule, unit_ids: toggle(rule.unit_ids, u.id) })} className={`${chip(rule.unit_ids.includes(u.id))} px-2 text-xs`}>{u.unit_number}</button>)}
                </div>
              </details>
            </div>
          </Panel>
          <div className="rounded-[1.4rem] bg-black p-5 text-white">
            <p className="font-type text-xs uppercase tracking-wide text-white/60">{label}</p>
            <p className="mt-1 font-hand text-3xl">{count.isFetching ? "…" : count.data ?? 0} residents will receive this</p>
            <button className={`${btn} mt-4 w-full`} disabled={send.isPending || !title.trim() || !count.data} onClick={() => send.mutate()}>
              {when ? "Schedule message" : "Send now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
