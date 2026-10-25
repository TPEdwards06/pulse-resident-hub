import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Card, Loading, PhoneFrame, Tagline } from "@/components/pulse/ui";
import { PulseLogo } from "@/components/PulseLogo";

// Session lives in browser storage, so resident pages render on the client only.
export const Route = createFileRoute("/_resident")({
  ssr: false,
  component: ResidentLayout,
});

function ResidentLayout() {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <PhoneFrame><Loading /></PhoneFrame>;
  if (!me) return <Navigate to="/login" />;
  if (me.isStaff) return <Navigate to="/staff" />;
  if (!me.profile?.unit_id) return <PendingScreen name={me.profile?.full_name} />;
  return (
    <PhoneFrame>
      <Outlet />
    </PhoneFrame>
  );
}

function PendingScreen({ name }: { name?: string | null | undefined }) {
  return (
    <PhoneFrame>
      <PulseLogo />
      <Card className="mt-8 text-center">
        <h2 className="font-hand text-2xl text-amber-ink">Almost there{name ? `, ${name}` : ""}!</h2>
        <p className="mt-3 font-type text-sm leading-relaxed">
          Your account is waiting for the leasing office to verify your unit. Once they do, your building
          announcements, packages, payments and renewal updates will show up here.
        </p>
        <p className="mt-3 font-type text-xs text-black/60">Questions? Call the office at (512) 555-0100.</p>
        <button onClick={() => supabase.auth.signOut()} className="mt-5 font-type text-sm underline">
          Sign out
        </button>
      </Card>
      <Tagline />
    </PhoneFrame>
  );
}
