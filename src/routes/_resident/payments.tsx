import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { errMsg, rpc, useMyCharges } from "@/lib/api";
import { daysUntil, fmtDate, money } from "@/lib/format";
import { AmberButton, Card, Empty, HandTitle, Loading, OutlineButton, PageHeader } from "@/components/pulse/ui";

export const Route = createFileRoute("/_resident/payments")({
  component: Payments,
});

function Payments() {
  const { data = [], isLoading } = useMyCharges();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const pay = useMutation({
    mutationFn: (id: string) => rpc("pay_charge", { _charge_id: id }),
    onSuccess: () => {
      toast.success("Payment recorded — thank you!");
      setConfirming(null);
      qc.invalidateQueries({ queryKey: ["charges"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (isLoading) return <Loading />;
  const due = data.filter((c) => c.status === "due");
  const paid = data.filter((c) => c.status === "paid").reverse();
  const balance = due.reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div>
      <PageHeader title="Payments" />
      <Card className="text-center">
        <p className="font-type text-xs uppercase tracking-wide text-black/60">Current balance</p>
        <p className="font-hand text-5xl text-black">{money(balance)}</p>
        {due[0] && <p className="font-type text-xs text-black/70">Next due {fmtDate(due[0].due_date)} ({daysUntil(due[0].due_date)} days)</p>}
      </Card>

      <Card className="mt-4">
        <HandTitle className="text-xl">Upcoming charges</HandTitle>
        {due.length === 0 ? <Empty>You're paid up.</Empty> : (
          <ul className="mt-2 space-y-3">
            {due.map((c) => (
              <li key={c.id} className="rounded-2xl bg-cream p-3 font-type text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{c.description}</p>
                    <p className="text-xs text-black/60">Due {fmtDate(c.due_date)}</p>
                  </div>
                  <p className="font-bold">{money(c.amount)}</p>
                </div>
                {confirming === c.id ? (
                  <div className="mt-3 flex gap-2">
                    <AmberButton className="flex-1" disabled={pay.isPending} onClick={() => pay.mutate(c.id)}>
                      Confirm {money(c.amount)}
                    </AmberButton>
                    <OutlineButton onClick={() => setConfirming(null)}>Cancel</OutlineButton>
                  </div>
                ) : (
                  <AmberButton className="mt-3 w-full" onClick={() => setConfirming(c.id)}>Pay now</AmberButton>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 font-type text-[11px] text-black/55">
          Demo: payments are simulated. In production this hands off to the property's payment portal.
        </p>
      </Card>

      <Card className="mt-4">
        <HandTitle className="text-xl">History</HandTitle>
        {paid.length === 0 ? <Empty>No payments yet.</Empty> : (
          <ul className="mt-2 divide-y divide-black/10 font-type text-sm">
            {paid.map((c) => (
              <li key={c.id} className="flex justify-between py-2">
                <span>{c.description}</span>
                <span>{money(c.amount)} <span className="text-xs text-black/55">paid {fmtDate(c.paid_at?.slice(0, 10))}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
