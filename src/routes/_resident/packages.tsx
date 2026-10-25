import { createFileRoute } from "@tanstack/react-router";
import { useMyPackages } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Card, Empty, HandTitle, Loading, PageHeader } from "@/components/pulse/ui";
import { BoxesIcon } from "@/components/pulse/icons";

export const Route = createFileRoute("/_resident/packages")({
  component: Packages,
});

function Packages() {
  const { data = [], isLoading } = useMyPackages();
  if (isLoading) return <Loading />;
  const waiting = data.filter((p) => !p.picked_up_at);
  const history = data.filter((p) => p.picked_up_at);
  return (
    <div>
      <PageHeader title="Packages" />
      <Card>
        <HandTitle className="text-xl">Waiting for pickup ({waiting.length})</HandTitle>
        {waiting.length === 0 ? <Empty>No packages waiting.</Empty> : (
          <ul className="mt-3 space-y-3">
            {waiting.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <BoxesIcon className="h-10 w-10 shrink-0" />
                <div className="font-type text-sm">
                  <p className="font-bold">{p.carrier}{p.note ? ` · ${p.note}` : ""}</p>
                  <p className="text-xs text-black/60">Arrived {fmtDateTime(p.arrived_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 rounded-xl bg-cream px-3 py-2 font-type text-xs">Package room: open daily 8 AM – 9 PM. Bring your resident ID.</p>
      </Card>
      <Card className="mt-4">
        <HandTitle className="text-xl">Picked up</HandTitle>
        {history.length === 0 ? <Empty>No history yet.</Empty> : (
          <ul className="mt-2 divide-y divide-black/10 font-type text-sm">
            {history.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>{p.carrier}{p.note ? ` · ${p.note}` : ""}</span>
                <span className="text-xs text-black/60">{fmtDateTime(p.picked_up_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
