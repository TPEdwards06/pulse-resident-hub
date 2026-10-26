import { createFileRoute, Link, Navigate, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { PulseLogo } from "@/components/PulseLogo";
import { Loading } from "@/components/pulse/ui";

export const Route = createFileRoute("/staff")({
  ssr: false,
  component: StaffLayout,
});

const NAV = [
  { to: "/staff", label: "Overview", exact: true },
  { to: "/staff/compose", label: "Compose" },
  { to: "/staff/messages", label: "Messages & reach" },
  { to: "/staff/renewals", label: "Renewals" },
  { to: "/staff/packages", label: "Packages" },
  { to: "/staff/charges", label: "Charges" },
  { to: "/staff/residents", label: "Residents" },
  { to: "/staff/faqs", label: "FAQ" },
  { to: "/staff/rooms", label: "Rooms" },
] as const;

function StaffLayout() {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <div className="min-h-screen bg-cream"><Loading /></div>;
  if (!me) return <Navigate to="/login" />;
  if (!me.isStaff) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-cream text-black md:flex">
      <aside className="border-b border-black/10 bg-white/60 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <PulseLogo size="md" />
          <p className="font-type text-[11px] text-black/60 md:mt-1">Union on San Antonio · Staff</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: "exact" in n }}
              className="shrink-0 rounded-xl px-3 py-2 font-type text-sm hover:bg-black/5"
              activeProps={{ className: "bg-amber-pill font-bold hover:bg-amber-pill" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-end gap-3 px-6 pt-4 font-type text-sm">
          {me.user.email?.endsWith("@pulse.demo") && (
            <span className="rounded-full border border-black px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">Demo mode</span>
          )}
          <span>{me.profile?.full_name}</span>
          <button onClick={() => supabase.auth.signOut()} className="underline">Sign out</button>
        </header>
        <div className="mx-auto max-w-6xl px-6 pb-12 pt-2">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
