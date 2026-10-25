// Re-run only the double-booking race and print every response.
// Usage: node scripts/race.mjs <stress-password> <daysAhead> <hour>
const URL = "https://qaonevwkzvbgibogzuvz.supabase.co";
const KEY = "sb_publishable_3W-dv80bxow3QN7pEca2Tg_3mHp1F-B";
const [pw, daysAhead = "7", hour = "14"] = process.argv.slice(2);
const EMAILS = ["marcus.lee", "priya.n", "diego.r", "hannah.k", "jamal.w", "sofia.g", "ethan.c", "olivia.m", "noah.p", "ava.t",
  "liam.o", "mia.j", "lucas.n", "zoe.a", "ryan.s", "emma.b", "kai.h", "grace.l", "omar.f"].map((n) => `${n}@pulse.demo`);

async function login(email) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw }) });
  return (await r.json()).access_token;
}
const h = (t) => ({ apikey: KEY, Authorization: `Bearer ${t}`, "Content-Type": "application/json" });
function central(d, hr) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(Date.now() + d * 864e5));
  for (const off of ["-05:00", "-06:00"]) {
    const x = new Date(`${day}T${String(hr).padStart(2, "0")}:00:00${off}`);
    if (Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(x)) === hr) return x.toISOString();
  }
}

const tokens = await Promise.all(EMAILS.map(login));
const pids = await Promise.all(tokens.map(async (t) => (await (await fetch(`${URL}/rest/v1/profiles?select=id`, { headers: h(t) })).json())[0].id));
const room = (await (await fetch(`${URL}/rest/v1/rooms?select=id&name=eq.Study%20Room%202`, { headers: h(tokens[0]) })).json())[0].id;
const body = (i) => JSON.stringify({ room_id: room, resident_id: pids[i], starts_at: central(+daysAhead, +hour), ends_at: central(+daysAhead, +hour + 1) });
const t0 = performance.now();
const res = await Promise.all(tokens.map(async (t, i) => {
  const s = performance.now();
  const r = await fetch(`${URL}/rest/v1/reservations`, { method: "POST", headers: { ...h(t), Prefer: "return=minimal" }, body: body(i) });
  return { i, status: r.status, ms: Math.round(performance.now() - s), msg: (await r.text()).slice(0, 140) };
}));
console.log(`total ${Math.round(performance.now() - t0)}ms`);
const by = {};
for (const r of res) (by[`${r.status} ${r.msg}`] ??= []).push(r.ms);
for (const [k, v] of Object.entries(by)) console.log(`${v.length}x  ${k}  [${v.sort((a, b) => a - b).join(", ")} ms]`);
