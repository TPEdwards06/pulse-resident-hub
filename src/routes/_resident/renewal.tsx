import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/lib/me";
import { errMsg, offerChanged, rpc, useMyOffer } from "@/lib/api";
import { daysUntil, fmtDate, money, renewalDeadline } from "@/lib/format";
import { AmberButton, Card, HandTitle, Loading, OutlineButton, PageHeader } from "@/components/pulse/ui";

export const Route = createFileRoute("/_resident/renewal")({
  component: Renewal,
});

const STATUS = { undecided: "Not decided yet", renewing: "You're renewing 🎉", not_renewing: "You're not renewing" } as const;

function Renewal() {
  const { data: me, isLoading } = useMe();
  const { data: offer, isLoading: lo } = useMyOffer();
  const qc = useQueryClient();
  const decide = useMutation({
    mutationFn: (s: "renewing" | "not_renewing") => rpc("set_renewal_status", { _status: s }),
    onSuccess: (_, s) => { toast.success(s === "renewing" ? "Great — the office will send your renewal lease." : "Got it — the office will follow up about move-out."); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (isLoading || lo) return <Loading />;
  const p = me!.profile!;
  const deadline = renewalDeadline(p.lease_end, offer?.offer_expires);
  const left = daysUntil(deadline);
  const changed = offerChanged(offer);
  const diff = offer ? Number(offer.offer_rent) - Number(offer.current_rent) : 0;

  return (
    <div>
      <PageHeader title="Lease Renewal" />
      <Card className="text-center">
        <p className="font-type text-xs uppercase tracking-wide text-black/60">Decision due</p>
        <p className="font-hand text-6xl leading-none text-black">{left == null ? "—" : Math.max(left, 0)}</p>
        <p className="font-hand text-xl text-amber-ink">{left === 1 ? "day left" : "days left"}</p>
        <p className="mt-1 font-type text-xs text-black/70">Deadline {fmtDate(deadline)} · lease ends {fmtDate(p.lease_end)}</p>
      </Card>

      {changed && offer && (
        <div className="mt-4 rounded-[1.6rem] border-2 border-black bg-amber-pill p-4 font-type text-sm text-black">
          <p className="font-bold uppercase tracking-wide">⚠ Price change</p>
          <p className="mt-1">Your renewal offer changed from <b>{money(offer.previous_offer_rent)}</b> to <b>{money(offer.offer_rent)}</b>/mo.</p>
        </div>
      )}

      <Card className="mt-4">
        <HandTitle className="text-xl">Your offer</HandTitle>
        {offer ? (
          <dl className="mt-2 grid grid-cols-2 gap-3 font-type text-sm">
            <div className="rounded-2xl bg-cream p-3"><dt className="text-xs text-black/60">Current rent</dt><dd className="text-xl font-bold">{money(offer.current_rent)}</dd></div>
            <div className="rounded-2xl bg-cream p-3"><dt className="text-xs text-black/60">Renewal offer</dt><dd className="text-xl font-bold">{money(offer.offer_rent)}</dd></div>
            <div className="col-span-2 text-xs">
              {diff > 0 ? `That's ${money(diff)}/mo more than you pay now.` : diff < 0 ? `That's ${money(-diff)}/mo less than you pay now.` : "Same as your current rent."}
              {" "}Offer expires {fmtDate(offer.offer_expires)}.
            </div>
          </dl>
        ) : (
          <p className="mt-2 font-type text-sm">Your renewal offer isn't ready yet — we'll notify you here the moment it is.</p>
        )}
      </Card>

      <Card className="mt-4 text-center">
        <p className="font-type text-sm">Status: <b>{STATUS[p.renewal_status]}</b></p>
        <div className="mt-3 flex gap-2">
          <AmberButton className="flex-1" disabled={decide.isPending || p.renewal_status === "renewing"} onClick={() => decide.mutate("renewing")}>I'll renew</AmberButton>
          <OutlineButton className="flex-1" disabled={decide.isPending || p.renewal_status === "not_renewing"} onClick={() => decide.mutate("not_renewing")}>Not renewing</OutlineButton>
        </div>
      </Card>
    </div>
  );
}
