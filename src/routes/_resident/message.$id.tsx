import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useFeed, useFeedActions } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { AmberButton, Card, Empty, Loading, PageHeader } from "@/components/pulse/ui";

export const Route = createFileRoute("/_resident/message/$id")({
  component: Message,
});

function Message() {
  const { id } = Route.useParams();
  const { data: feed, isLoading } = useFeed();
  const { seen, ack } = useFeedActions();
  const m = feed?.find((x) => x.delivery_id === id);

  // Opening a message is what counts as "seen" for the staff analytics.
  useEffect(() => {
    if (m && !m.seen_at && !seen.isPending) seen.mutate(m.delivery_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.delivery_id, m?.seen_at]);

  if (isLoading) return <Loading />;
  if (!m) return (<div><PageHeader title="Message" back="/feed" /><Card><Empty>This message isn't available.</Empty></Card></div>);

  return (
    <div>
      <PageHeader title={m.is_personal ? "For you" : "Announcement"} back="/feed" />
      <Card className={m.priority === "urgent" ? "ring-2 ring-amber-pill" : ""}>
        {m.priority === "urgent" && <p className="font-type text-xs font-bold uppercase tracking-wide text-urgent">Urgent</p>}
        <h2 className="font-type text-lg font-bold text-amber-ink">{m.title}</h2>
        <p className="mt-1 font-type text-xs text-black/55">{fmtDateTime(m.scheduled_at)}</p>
        <p className="mt-4 whitespace-pre-wrap font-type text-sm leading-relaxed">{m.body}</p>
        {m.requires_ack && (
          <div className="mt-5 border-t border-black/10 pt-4">
            {m.acked_at ? (
              <p className="font-hand text-lg text-amber-ink">✓ You confirmed this on {fmtDateTime(m.acked_at)}</p>
            ) : (
              <AmberButton onClick={() => ack.mutate(m.delivery_id)} disabled={ack.isPending} className="w-full">
                Got it
              </AmberButton>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
