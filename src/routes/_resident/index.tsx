import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { isDone, offerChanged, useFeed, useFeedActions, useMyCharges, useMyOffer, useMyPackages, type FeedItem } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { PulseLogo } from "@/components/PulseLogo";
import { Avatar, Card, Checkbox, Tagline } from "@/components/pulse/ui";
import { BookPenIcon, BoxesIcon, HandCoinIcon, QuestionIcon } from "@/components/pulse/icons";

export const Route = createFileRoute("/_resident/")({
  component: Home,
});

const PREVIEW_COUNT = 4;

function Home() {
  const { data: me } = useMe();
  const { data: feed = [] } = useFeed();
  const { data: charges = [] } = useMyCharges();
  const { data: packages = [] } = useMyPackages();
  const { data: offer } = useMyOffer();
  const { seen, ack } = useFeedActions();
  const navigate = useNavigate();

  const unread = feed.filter((m) => !isDone(m));
  const nextDue = charges.find((c) => c.status === "due");
  const waiting = packages.filter((p) => !p.picked_up_at).length;
  // Not-done first (urgent on top), then the most recent done ones.
  const preview = [
    ...unread.sort((a, b) => Number(b.priority === "urgent") - Number(a.priority === "urgent")),
    ...feed.filter(isDone),
  ].slice(0, PREVIEW_COUNT);

  const tick = (m: FeedItem) => {
    if (isDone(m)) return;
    (m.requires_ack ? ack : seen).mutate(m.delivery_id);
  };

  return (
    <div>
      <div className="flex items-start justify-between">
        <PulseLogo />
        <button onClick={() => supabase.auth.signOut()} title="Sign out" className="pt-1">
          <Avatar name={me?.profile?.full_name} />
        </button>
      </div>

      <dl className="mt-1 space-y-0.5 font-type text-[12.5px] leading-snug text-black">
        <div><dt className="inline font-bold">Resident at:</dt> <dd className="inline">Union on San Antonio{me?.profile?.units ? ` · ${me.profile.units.unit_number}` : ""}</dd></div>
        <div><dt className="inline font-bold">Next Payment Due:</dt> <dd className="inline">{nextDue ? fmtDate(nextDue.due_date) : "Nothing due"}</dd></div>
        <div><dt className="inline font-bold">Notifications:</dt> <dd className="inline">{unread.length}</dd></div>
      </dl>

      <Card className="mt-4 px-5 pb-4 pt-3">
        <h2 className="text-center font-hand text-[1.15rem] text-amber-ink">Apartment Notifications</h2>
        {preview.length === 0 ? (
          <p className="mt-2 text-center font-type text-xs text-amber-ink">You're all caught up!</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {preview.map((m) => (
              <li key={m.delivery_id} className="flex items-start gap-2.5">
                <Checkbox checked={isDone(m)} onClick={() => tick(m)} label={m.requires_ack ? `Acknowledge ${m.title}` : `Mark ${m.title} as read`} />
                <button
                  onClick={() => navigate({ to: "/message/$id", params: { id: m.delivery_id } })}
                  className={`text-left font-type text-[12.5px] leading-snug text-amber-ink hover:underline ${isDone(m) ? "opacity-75" : ""}`}
                >
                  {m.priority === "urgent" && !isDone(m) && <span className="mr-1 font-bold text-urgent">!</span>}
                  {m.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        {feed.length > 0 && (
          <div className="mt-2 text-right">
            <Link to="/feed" className="font-hand text-sm text-amber-ink underline-offset-2 hover:underline">
              See all ({feed.length})
            </Link>
          </div>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Tile to="/packages" label={`Packages (${waiting})`} icon={<BoxesIcon className="h-[4.6rem] w-[4.6rem]" />} />
        <Tile to="/payments" label="Payments" icon={<HandCoinIcon className="h-[4.6rem] w-[4.6rem]" />} />
        <Tile to="/rooms" label="Reserve a Room" icon={<BookPenIcon className="h-[4.6rem] w-[4.6rem]" />} />
        <Tile to="/faq" label="Resident FAQ" icon={<QuestionIcon className="h-[4.4rem] w-[4.4rem]" />} />
      </div>

      <Link
        to="/renewal"
        className="relative mt-8 flex items-center justify-center whitespace-nowrap rounded-full bg-amber-pill px-4 py-2 font-type text-[12.5px] font-bold text-black transition hover:brightness-105"
      >
        Interested in renewing your lease?
        {offerChanged(offer) && (
          <span className="absolute -top-2.5 right-3 rounded-full bg-black px-2 py-0.5 text-[9.5px] font-bold text-amber-pill">New price</span>
        )}
      </Link>

      <Tagline />
    </div>
  );
}

function Tile({ to, label, icon }: { to: "/packages" | "/payments" | "/rooms" | "/faq"; label: string; icon: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex aspect-[1.18] flex-col items-center justify-center gap-2 rounded-[1.6rem] bg-white text-black transition hover:-translate-y-0.5"
    >
      {icon}
      <span className="font-hand text-[1.05rem]">{label}</span>
    </Link>
  );
}
