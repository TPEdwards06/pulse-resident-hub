import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { isDone, useFeed, useFeedActions } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Card, Checkbox, Empty, Loading, PageHeader } from "@/components/pulse/ui";

export const Route = createFileRoute("/_resident/feed")({
  component: Feed,
});

const LABEL: Record<string, string> = {
  announcement: "Announcement", event: "Event", safety: "Safety", package: "Package",
  payment: "Payment", renewal: "Renewal", maintenance: "Maintenance",
};

function Feed() {
  const { data: feed, isLoading } = useFeed();
  const { seen, ack } = useFeedActions();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  if (isLoading) return <Loading />;
  const items = (feed ?? []).filter((m) => filter === "all" || !isDone(m));
  const urgent = items.filter((m) => m.priority === "urgent" && !isDone(m));
  const rest = items.filter((m) => !(m.priority === "urgent" && !isDone(m)));

  return (
    <div>
      <PageHeader title="Notifications" />
      <div className="mb-4 flex gap-2 font-type text-sm">
        {(["all", "unread"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 ${filter === f ? "bg-black text-white" : "bg-white"}`}>
            {f === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>
      {items.length === 0 && <Card><Empty>Nothing here — you're all caught up.</Empty></Card>}
      <div className="space-y-3">
        {[...urgent, ...rest].map((m) => (
          <Card key={m.delivery_id} className={m.priority === "urgent" && !isDone(m) ? "ring-2 ring-amber-pill" : ""}>
            <div className="flex items-start gap-3">
              <Checkbox
                checked={isDone(m)}
                onClick={() => !isDone(m) && (m.requires_ack ? ack : seen).mutate(m.delivery_id)}
                label={m.title}
              />
              <Link to="/message/$id" params={{ id: m.delivery_id }} className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-type text-[11px] uppercase tracking-wide text-black/55">
                  {m.priority === "urgent" && <span className="font-bold text-urgent">Urgent</span>}
                  <span>{m.is_personal ? "For you" : LABEL[m.category]}</span>
                  <span>· {fmtDateTime(m.scheduled_at)}</span>
                </div>
                <p className="mt-0.5 font-type text-sm font-bold text-amber-ink">{m.title}</p>
                <p className="mt-1 line-clamp-2 font-type text-xs text-black/75">{m.body}</p>
                {m.requires_ack && !m.acked_at && <p className="mt-1 font-hand text-sm text-urgent">Please confirm you've read this</p>}
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
