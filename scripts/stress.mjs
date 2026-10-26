// Stress + abuse test against the live Pulse backend.
// Usage: node scripts/stress.mjs <password-for-stress-users>
// Expects the seeded residents to have auth users with that password (created by the test harness SQL).
const URL = "https://qaonevwkzvbgibogzuvz.supabase.co";
const KEY = "sb_publishable_3W-dv80bxow3QN7pEca2Tg_3mHp1F-B";
const STRESS_PW = process.argv[2];
const DEMO_PW = "pulse-demo-2026!";
const RESIDENTS = ["marcus.lee", "priya.n", "diego.r", "hannah.k", "jamal.w", "sofia.g", "ethan.c", "olivia.m", "noah.p", "ava.t",
  "liam.o", "mia.j", "lucas.n", "zoe.a", "ryan.s", "emma.b", "kai.h", "grace.l", "omar.f"].map((n) => `${n}@pulse.demo`);

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

async function login(email, password) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!j.access_token) throw new Error(`login ${email}: ${JSON.stringify(j)}`);
  return j.access_token;
}
async function api(token, path, { method = "GET", body, prefer } = {}) {
  const t0 = performance.now();
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, ok: r.ok, data, ms: performance.now() - t0 };
}
const rpc = (t, fn, args = {}) => api(t, `rpc/${fn}`, { method: "POST", body: args });
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const lat = (rs) => `p50 ${pct(rs.map((r) => r.ms), 50).toFixed(0)}ms · p95 ${pct(rs.map((r) => r.ms), 95).toFixed(0)}ms · max ${Math.max(...rs.map((r) => r.ms)).toFixed(0)}ms`;

// Central-time wall clock -> ISO, independent of the machine's timezone.
function central(daysAhead, hour) {
  const d = new Date(Date.now() + daysAhead * 864e5);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(d);
  for (const off of ["-05:00", "-06:00"]) {
    const iso = new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00${off}`);
    const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(iso));
    if (h === hour) return iso.toISOString();
  }
  throw new Error("tz");
}

const main = async () => {
  console.log("Logging in 19 residents + John + staff…");
  const staff = await login("jane@pulse.demo", DEMO_PW);
  const john = await login("john@pulse.demo", DEMO_PW);
  const tokens = await Promise.all(RESIDENTS.map((e) => login(e, STRESS_PW)));
  const all = [john, ...tokens];
  const me = await Promise.all(all.map((t) => api(t, "profiles?select=id,email")));
  const pid = me.map((r) => r.data[0].id);

  // 1. Double-booking race: 20 residents grab the same room + slot at the same instant.
  const rooms = (await api(john, "rooms?select=id,name&order=name")).data;
  const room = rooms.find((r) => r.name === "Conference Room").id;
  const slot = { starts_at: central(5, 15), ends_at: central(5, 16) };
  const race = await Promise.all(all.map((t, i) => api(t, "reservations", { method: "POST", body: { room_id: room, resident_id: pid[i], ...slot }, prefer: "return=minimal" })));
  const won = race.filter((r) => r.ok).length;
  check("Double-booking race: 20 simultaneous bookings of one slot", won === 1, `${won} succeeded, ${race.filter((r) => r.status === 409 || /exclu/i.test(JSON.stringify(r.data))).length} rejected as overlapping · ${lat(race)}`);

  // 2. Booking rules.
  // Use a resident with no bookings so the 3-booking cap is measured cleanly.
  const counts = await Promise.all(all.map((t, i) => api(t, `reservations?select=id&resident_id=eq.${pid[i]}`)));
  const j = counts.findIndex((r, i) => i > 0 && r.data.length === 0);
  const m = all[j], mp = pid[j];
  const book = (body) => api(m, "reservations", { method: "POST", body: { room_id: rooms[0].id, resident_id: mp, ...body }, prefer: "return=minimal" });
  const longB = await book({ starts_at: central(3, 9), ends_at: central(3, 13) });
  check("Rejects a 4-hour booking", !longB.ok, longB.data?.message);
  const farB = await book({ starts_at: central(30, 9), ends_at: central(30, 10) });
  check("Rejects booking 30 days ahead", !farB.ok, farB.data?.message);
  const nightB = await book({ starts_at: central(3, 3), ends_at: central(3, 4) });
  check("Rejects a 3 AM booking", !nightB.ok, nightB.data?.message);
  const pastB = await book({ starts_at: new Date(Date.now() - 3 * 36e5).toISOString(), ends_at: new Date(Date.now() - 2 * 36e5).toISOString() });
  check("Rejects a booking in the past", !pastB.ok, pastB.data?.message);
  const four = [];
  for (let i = 0; i < 4; i++) four.push(await book({ starts_at: central(4, 8 + i * 2), ends_at: central(4, 9 + i * 2) }));
  check("Caps a resident at 3 upcoming bookings", four.filter((r) => r.ok).length === 3 && !four[3].ok, four[3].data?.message);
  const someoneElse = await api(m, "reservations", { method: "POST", body: { room_id: rooms[1].id, resident_id: pid[j === 2 ? 3 : 2], starts_at: central(6, 10), ends_at: central(6, 11) }, prefer: "return=minimal" });
  check("Can't book on behalf of another resident", !someoneElse.ok, someoneElse.data?.message);

  // 3. Cross-resident tampering.
  const aFeed = (await rpc(john, "my_feed")).data;
  const steal = await Promise.all([
    rpc(m, "ack_message", { _delivery_id: aFeed[0].delivery_id }),
    rpc(m, "mark_seen", { _delivery_id: aFeed[1].delivery_id }),
  ]);
  const aFeed2 = (await rpc(john, "my_feed")).data;
  const untouched = aFeed2.find((x) => x.delivery_id === aFeed[0].delivery_id).acked_at === aFeed[0].acked_at
    && aFeed2.find((x) => x.delivery_id === aFeed[1].delivery_id).seen_at === aFeed[1].seen_at;
  check("Another resident can't mark John's messages read", untouched && steal.every((r) => r.ok));
  const aCharges = (await api(john, "charges?select=id,status&status=eq.due")).data;
  await rpc(m, "pay_charge", { _charge_id: aCharges[0].id });
  const still = (await api(john, `charges?select=status&id=eq.${aCharges[0].id}`)).data[0].status;
  check("Another resident can't pay/clear John's charge", still === "due");
  const aRes = (await api(john, `reservations?select=id&resident_id=eq.${pid[0]}`)).data;
  const del = await api(m, `reservations?id=eq.${aRes[0]?.id}`, { method: "DELETE", prefer: "return=representation" });
  check("Another resident can't cancel John's booking", Array.isArray(del.data) && del.data.length === 0);
  const peek = await Promise.all(["profiles?select=email", "charges?select=resident_id", "packages?select=resident_id", "renewal_offers?select=resident_id", "deliveries?select=id", "messages?select=id"].map((p) => api(m, p)));
  const leaks = peek.map((r, i) => [i, new Set((r.data ?? []).map((x) => x.resident_id ?? x.email ?? x.id)).size]);
  check("Resident sees only own rows in every table", peek[0].data.length === 1 && peek[1].data.every((x) => x.resident_id === mp) && peek[2].data.every((x) => x.resident_id === mp) && peek[3].data.every((x) => x.resident_id === mp) && peek[4].data.length === 0 && peek[5].data.length === 0, JSON.stringify(leaks));
  const staffCalls = await Promise.all(["audience_count", "send_message", "resend_reminder", "run_daily_reminders", "reset_demo", "pending_residents", "message_stats", "renewal_board", "approve_resident"].map((f) => rpc(m, f, f === "audience_count" ? { rule: {} } : {})));
  check("All 9 staff RPCs refuse a resident", staffCalls.every((r) => !r.ok), staffCalls.map((r) => r.status).join(","));
  const forge = await api(m, "messages", { method: "POST", body: { title: "FREE RENT", body: "x" }, prefer: "return=minimal" });
  const forgeD = await api(m, "deliveries", { method: "POST", body: { message_id: aFeed[0].message_id, resident_id: mp }, prefer: "return=minimal" });
  check("Resident can't insert messages or deliveries directly", !forge.ok && !forgeD.ok);

  // 4. Input limits / injection.
  const big = await rpc(staff, "send_message", { _title: "x".repeat(5000), _body: "", _category: "announcement", _priority: "normal", _requires_ack: false, _rule: { resident_ids: [pid[0]] }, _label: "t" });
  check("Rejects a 5000-char title", !big.ok, big.data?.message);
  const sqlish = await rpc(staff, "audience_count", { rule: { buildings: ["A'); drop table messages; --"] } });
  check("Audience filter treats SQL-looking input as data", sqlish.ok && sqlish.data === 0, `count=${sqlish.data}`);
  const badRule = await rpc(staff, "audience_count", { rule: { lease_end_before: "not-a-date" } });
  check("Malformed audience date is rejected (no crash)", !badRule.ok, badRule.data?.message);

  // 5. Broadcast + read storm: staff sends 5 building-wide messages in parallel, then 20 residents
  //    open their feeds and mark everything seen at once.
  const sends = await Promise.all([1, 2, 3, 4, 5].map((i) => rpc(staff, "send_message", { _title: `Load test ${i}`, _body: "Stress test broadcast", _category: "announcement", _priority: "normal", _requires_ack: i % 2 === 0, _rule: {}, _label: "All residents" })));
  check("5 parallel broadcasts to all residents", sends.every((r) => r.ok), lat(sends));
  const feeds = await Promise.all(all.flatMap((t) => [1, 2, 3, 4, 5].map(() => rpc(t, "my_feed"))));
  check("100 concurrent feed loads", feeds.every((r) => r.ok), lat(feeds));
  const marks = await Promise.all(all.map(async (t) => {
    const f = (await rpc(t, "my_feed")).data.filter((x) => x.title.startsWith("Load test"));
    return Promise.all(f.map((x) => rpc(t, x.requires_ack ? "ack_message" : "mark_seen", { _delivery_id: x.delivery_id })));
  }));
  const flat = marks.flat();
  check(`${flat.length} concurrent read receipts`, flat.every((r) => r.ok), lat(flat));
  const stats = (await rpc(staff, "message_stats")).data.filter((x) => x.title.startsWith("Load test"));
  const consistent = stats.every((s) => s.delivered === 20 && s.seen === 20 && (!s.requires_ack || s.acked === 20));
  check("Analytics match exactly after the storm (20/20 seen per message)", consistent, stats.map((s) => `${s.seen}/${s.delivered}`).join(" "));

  // 6. Hammer: 300 mixed resident reads in parallel.
  const paths = ["charges?select=*", "packages?select=*", "renewal_offers?select=*", "faqs?select=*", "rooms?select=*"];
  const hammer = await Promise.all(Array.from({ length: 300 }, (_, i) => (i % 3 === 0 ? rpc(all[i % 20], "my_feed") : api(all[i % 20], paths[i % paths.length]))));
  const errs = hammer.filter((r) => !r.ok);
  check("300 parallel mixed requests", errs.length === 0, `${errs.length} errors${errs[0] ? ` (${errs[0].status})` : ""} · ${lat(hammer)}`);

  // 7. Send rate limit (30/hour per staff account).
  let n = 0, blocked = null;
  for (let i = 0; i < 40 && !blocked; i++) {
    const r = await rpc(staff, "send_message", { _title: `Rate ${i}`, _body: "", _category: "announcement", _priority: "normal", _requires_ack: false, _rule: { resident_ids: [pid[0]] }, _label: "t" });
    if (r.ok) n++; else blocked = r.data?.message;
  }
  check("Staff send rate limit kicks in", !!blocked && /limit/i.test(blocked), `blocked after ${n} more sends: ${blocked}`);

  // 8. FAQ view inflation.
  const faq = (await api(john, "faqs?select=id,view_count&limit=1")).data[0];
  await Promise.all(Array.from({ length: 50 }, () => rpc(john, "view_faq", { _id: faq.id })));
  const after = (await api(john, `faqs?select=view_count&id=eq.${faq.id}`)).data[0].view_count;
  check("50 rapid views from one user count at most once", after - faq.view_count <= 1, `${faq.view_count} → ${after}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(2); });
