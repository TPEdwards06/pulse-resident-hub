import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo";
import { PulseLogo } from "@/components/PulseLogo";
import { AmberButton, Card, OutlineButton, PhoneFrame, Tagline } from "@/components/pulse/ui";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: Login,
});

const creds = z.object({
  email: z.string().trim().email("Enter a valid email").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  name: z.string().trim().max(80).optional(),
});

function Login() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!isLoading && me) return <Navigate to={me.isStaff ? "/staff" : "/"} />;

  const done = async () => {
    await qc.invalidateQueries({ queryKey: ["me"] });
    navigate({ to: "/" });
  };

  const signIn = async (email: string, password: string) => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message === "Email not confirmed" ? "Check your inbox to confirm your email first." : "Wrong email or password." });
    done();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = creds.safeParse(form);
    if (!parsed.success) return setMsg({ ok: false, text: parsed.error.issues[0]?.message ?? "Check the form" });
    if (mode === "in") return signIn(parsed.data.email, parsed.data.password);
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.name || undefined }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    if (data.session) return done();
    setMsg({ ok: true, text: "Check your email to confirm your account. After that, the leasing office verifies your unit." });
  };

  return (
    <PhoneFrame>
      <div className="flex justify-center pt-4"><PulseLogo /></div>
      <p className="mt-1 text-center font-type text-xs">Westside Commons</p>

      <Card className="mt-6">
        <h2 className="text-center font-hand text-2xl text-amber-ink">Try the demo</h2>
        <div className="mt-3 grid gap-2">
          <AmberButton disabled={busy} onClick={() => signIn(DEMO_ACCOUNTS.resident.email, DEMO_PASSWORD)}>
            Demo as Resident ({DEMO_ACCOUNTS.resident.name})
          </AmberButton>
          <OutlineButton disabled={busy} onClick={() => signIn(DEMO_ACCOUNTS.staff.email, DEMO_PASSWORD)}>
            Demo as Staff (Jordan – Leasing)
          </OutlineButton>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-3 flex justify-center gap-2 font-type text-sm">
          {(["in", "up"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setMsg(null); }} className={`rounded-full px-3 py-1 ${mode === m ? "bg-black text-white" : "bg-cream"}`}>
              {m === "in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="grid gap-2 font-type text-sm">
          {mode === "up" && (
            <input className="field" placeholder="Full name" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          )}
          <input className="field" type="email" autoComplete="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="field" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <AmberButton type="submit" disabled={busy} className="mt-1">{mode === "in" ? "Sign in" : "Create account"}</AmberButton>
        </form>
        {msg && <p className={`mt-3 text-center font-type text-xs ${msg.ok ? "text-black" : "text-urgent"}`}>{msg.text}</p>}
      </Card>
      <Tagline />
    </PhoneFrame>
  );
}
