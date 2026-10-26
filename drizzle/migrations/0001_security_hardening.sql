-- Security hardening + demo reset (applied after 0000_pulse_schema_and_seed.sql)

-- 1. Only link a pre-seeded profile / grant staff once the email is CONFIRMED.
--    Self sign-ups that match nothing become "pending" residents (no unit) until staff approve them.
create or replace function public.link_user(_uid uuid, _email text, _meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid; is_s boolean;
begin
  if exists (select 1 from public.profiles where user_id = _uid) then return; end if;
  is_s := exists (select 1 from public.staff_emails where lower(email) = lower(_email));
  update public.profiles set user_id = _uid where lower(email) = lower(_email) and user_id is null returning id into pid;
  if pid is null then
    insert into public.profiles(user_id, email, full_name)
    values (_uid, _email, left(coalesce(nullif(trim(_meta->>'full_name'), ''), split_part(_email, '@', 1)), 80))
    on conflict (email) do nothing;
  end if;
  insert into public.user_roles(user_id, role)
  values (_uid, case when is_s then 'staff' else 'resident' end::public.app_role) on conflict do nothing;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null then
    perform public.link_user(new.id, new.email, new.raw_user_meta_data);
  end if;
  return new;
end $$;

create or replace function public.handle_user_confirmed() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.link_user(new.id, new.email, new.raw_user_meta_data);
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

-- Staff approve a pending resident by assigning a unit + lease.
create or replace function public.approve_resident(_profile uuid, _unit uuid, _lease_end date, _rent numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  if _rent is null or _rent <= 0 or _rent > 10000 then raise exception 'Rent must be between $1 and $10,000'; end if;
  if _lease_end is null or _lease_end <= current_date then raise exception 'Lease end must be in the future'; end if;
  if exists (select 1 from public.profiles where unit_id = _unit and id <> _profile) then raise exception 'That unit is already occupied'; end if;
  update public.profiles set unit_id = _unit, lease_end = _lease_end, current_rent = _rent
  where id = _profile and unit_id is null and not exists (select 1 from public.staff_emails s where lower(s.email) = lower(profiles.email));
  if not found then raise exception 'Resident not found or already approved'; end if;
  perform public.create_notification(_profile, 'Welcome to Pulse!',
    'Your unit is verified. You''ll get building announcements, package alerts, payment reminders and renewal updates here.', 'announcement');
end $$;

-- 2. Residents read their feed only through RPCs that return safe columns
--    (no audience_rule, no other residents' IDs, nothing scheduled for later).
drop policy if exists "residents read addressed messages" on public.messages;
create policy "staff read messages" on public.messages for select to authenticated using (public.is_staff());
drop policy if exists "own deliveries" on public.deliveries;
create policy "staff read deliveries" on public.deliveries for select to authenticated using (public.is_staff());

create or replace function public.my_feed()
returns table(delivery_id uuid, message_id uuid, title text, body text, category public.msg_category,
              priority public.msg_priority, requires_ack boolean, is_personal boolean,
              scheduled_at timestamptz, seen_at timestamptz, acked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, m.id, m.title, m.body, m.category, m.priority, m.requires_ack, m.is_personal, m.scheduled_at, d.seen_at, d.acked_at
  from public.deliveries d join public.messages m on m.id = d.message_id
  where d.resident_id = public.current_profile_id() and m.scheduled_at <= now()
  order by m.scheduled_at desc
  limit 200
$$;

-- 3. FAQ views count once per user.
create table if not exists public.faq_views (
  faq_id uuid not null references public.faqs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (faq_id, user_id)
);
alter table public.faq_views enable row level security;
grant all on public.faq_views to service_role;

create or replace function public.view_faq(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.faq_views(faq_id, user_id) values (_id, auth.uid()) on conflict do nothing;
  if found then update public.faqs set view_count = view_count + 1 where id = _id; end if;
end $$;

-- 4. Room booking limits.
create or replace function public.trg_reservation_rules() returns trigger language plpgsql security definer set search_path = public as $$
declare local_start timestamp := new.starts_at at time zone 'America/Chicago';
        local_end timestamp := new.ends_at at time zone 'America/Chicago';
begin
  if public.seeding() or public.is_staff() then return new; end if;
  if not exists (select 1 from public.profiles where id = new.resident_id and unit_id is not null) then
    raise exception 'Your account must be verified by the office before booking rooms';
  end if;
  if new.starts_at <= now() then raise exception 'Pick a time in the future'; end if;
  if new.starts_at > now() + interval '14 days' then raise exception 'Rooms can be booked up to 14 days ahead'; end if;
  if new.ends_at - new.starts_at > interval '2 hours' then raise exception 'Bookings are limited to 2 hours'; end if;
  if local_start::time < time '07:00' or local_end::time > time '23:00' or local_end::date <> local_start::date then
    raise exception 'Rooms are open 7 AM – 11 PM';
  end if;
  if (select count(*) from public.reservations where resident_id = new.resident_id and ends_at > now()) >= 3 then
    raise exception 'You can have at most 3 upcoming bookings';
  end if;
  return new;
end $$;
drop trigger if exists reservation_rules on public.reservations;
create trigger reservation_rules before insert on public.reservations for each row execute function public.trg_reservation_rules();

-- 5. Input limits.
alter table public.messages add constraint messages_title_len check (char_length(title) between 1 and 120),
                            add constraint messages_body_len check (char_length(body) <= 2000);
alter table public.faqs add constraint faqs_q_len check (char_length(question) between 1 and 200),
                        add constraint faqs_a_len check (char_length(answer) between 1 and 2000);
alter table public.packages add constraint packages_carrier_len check (char_length(carrier) between 1 and 60),
                            add constraint packages_note_len check (note is null or char_length(note) <= 200);
alter table public.charges add constraint charges_amount_max check (amount <= 10000),
                           add constraint charges_desc_len check (char_length(description) between 1 and 120);
alter table public.profiles add constraint profiles_name_len check (char_length(full_name) between 1 and 80);

-- 6. Staff send rate limit (also stops a runaway demo-staff session from spamming everyone).
create or replace function public.send_message(_title text, _body text, _category public.msg_category, _priority public.msg_priority, _requires_ack boolean, _rule jsonb, _label text, _scheduled_at timestamptz default null, _parent uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid; ts timestamptz := coalesce(_scheduled_at, now());
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  if coalesce(trim(_title),'') = '' then raise exception 'Title required'; end if;
  if ts > now() + interval '90 days' then raise exception 'Schedule within the next 90 days'; end if;
  if (select count(*) from public.messages where created_by = public.current_profile_id() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Sending limit reached (30 messages per hour)';
  end if;
  insert into public.messages(title, body, category, priority, requires_ack, audience_rule, audience_label, scheduled_at, created_by, parent_message_id)
  values (trim(_title), coalesce(_body,''), _category, _priority, _requires_ack, coalesce(_rule,'{}'::jsonb), left(_label, 120), ts, public.current_profile_id(), _parent)
  returning id into mid;
  insert into public.deliveries(message_id, resident_id, delivered_at)
  select mid, r, ts from public.audience_residents(coalesce(_rule,'{}'::jsonb)) r;
  return mid;
end $$;

-- 7. Demo seed as a function so staff can restore the class demo.
create or replace function public.seed_demo() returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('pulse.seeding', 'on', true);

  insert into public.staff_emails values ('jane@pulse.demo') on conflict do nothing;
  insert into public.profiles(email, full_name) values ('jane@pulse.demo', 'Jane Doe') on conflict (email) do nothing;

  insert into public.profiles(email, full_name, unit_id, phone, lease_end, renewal_status, current_rent)
  select v.email, v.name, (select id from public.units where unit_number = v.unit), v.phone, current_date + v.days, v.status::public.renewal_status, v.rent
  from (values
   ('john@pulse.demo','John Doe','A201','512-555-0142', 81,'undecided',1150),
   ('marcus.lee@pulse.demo','Marcus Lee','A101','512-555-0101', 12,'undecided',1085),
   ('priya.n@pulse.demo','Priya Natarajan','A102','512-555-0102', 25,'renewing',1120),
   ('diego.r@pulse.demo','Diego Ramirez','A202','512-555-0103', 40,'undecided',1150),
   ('hannah.k@pulse.demo','Hannah Kim','A301','512-555-0104', 58,'not_renewing',1175),
   ('jamal.w@pulse.demo','Jamal Washington','A302','512-555-0105', 75,'undecided',1175),
   ('sofia.g@pulse.demo','Sofia Garcia','A401','512-555-0106', 95,'renewing',1199),
   ('ethan.c@pulse.demo','Ethan Chen','A501','512-555-0107', 130,'undecided',1225),
   ('olivia.m@pulse.demo','Olivia Martinez','B101','512-555-0108', 8,'undecided',1050),
   ('noah.p@pulse.demo','Noah Patel','B102','512-555-0109', 33,'undecided',1050),
   ('ava.t@pulse.demo','Ava Thompson','B201','512-555-0110', 47,'renewing',1095),
   ('liam.o@pulse.demo','Liam O''Brien','B302','512-555-0111', 66,'undecided',1110),
   ('mia.j@pulse.demo','Mia Johnson','B401','512-555-0112', 150,'undecided',1140),
   ('lucas.n@pulse.demo','Lucas Nguyen','B502','512-555-0113', 200,'renewing',1160),
   ('zoe.a@pulse.demo','Zoe Adeyemi','C101','512-555-0114', 20,'not_renewing',990),
   ('ryan.s@pulse.demo','Ryan Singh','C201','512-555-0115', 52,'undecided',1020),
   ('emma.b@pulse.demo','Emma Brooks','C202','512-555-0116', 88,'undecided',1020),
   ('kai.h@pulse.demo','Kai Hernandez','C301','512-555-0117', 110,'renewing',1065),
   ('grace.l@pulse.demo','Grace Liu','C402','512-555-0118', 175,'undecided',1080),
   ('omar.f@pulse.demo','Omar Farouk','C501','512-555-0119', 240,'undecided',1100)
  ) as v(email, name, unit, phone, days, status, rent)
  on conflict (email) do update set full_name = excluded.full_name, unit_id = excluded.unit_id, phone = excluded.phone,
    lease_end = excluded.lease_end, renewal_status = excluded.renewal_status, current_rent = excluded.current_rent;

  insert into public.renewal_offers(resident_id, current_rent, offer_rent, offer_expires)
  select p.id, p.current_rent, round(p.current_rent * 1.04), least(p.lease_end - 45, current_date + 30)
  from public.profiles p where p.unit_id is not null and p.lease_end < current_date + 160 and p.email like '%@pulse.demo' and p.email <> 'john@pulse.demo';
  insert into public.renewal_offers(resident_id, current_rent, offer_rent, offer_expires)
  select id, 1150, 1195, current_date + 21 from public.profiles where email = 'john@pulse.demo';

  insert into public.rooms(name, location, capacity)
  select * from (values ('Study Room 1', 'Building A · 2nd floor', 4), ('Study Room 2', 'Building B · Lobby level', 6), ('Conference Room', 'Clubhouse', 10)) v(n, l, c)
  where not exists (select 1 from public.rooms);

  insert into public.faqs(question, answer, category, view_count) values
   ('Where can I park?', 'Residents with a permit may park on levels 2–5 of the garage. Level 1 is reserved for guests and leasing visitors (2-hour limit). Permits are $45/month and can be added in the leasing office.', 'Parking', 42),
   ('What is the guest policy?', 'Guests may stay up to 3 consecutive nights and no more than 7 nights per month. Overnight guests must be registered with the front desk. Residents are responsible for their guests at all times.', 'Community', 27),
   ('How do I submit a maintenance request?', 'Submit requests through the resident portal or call the office at (512) 555-0100. For emergencies (flooding, no heat/AC in extreme weather, gas smell), call the 24/7 line at (512) 555-0199.', 'Maintenance', 63),
   ('What are the package room hours?', 'The package room is open daily from 8:00 AM to 9:00 PM. You''ll get a Pulse notification as soon as a package is logged. Packages not picked up within 7 days may be returned to sender.', 'Packages', 51),
   ('When is rent due?', 'Rent is due on the 1st of each month. You can pay through the property portal by ACH, debit or credit card (card payments include a processing fee).', 'Payments', 88),
   ('What are the late fees?', 'Rent paid after 11:59 PM on the 3rd incurs a $75 initial late fee plus $10 per additional day, up to a maximum of $150 per month.', 'Payments', 39),
   ('How does lease renewal work?', 'Renewal offers are sent about 90 days before your lease ends. Review the offer in Pulse and tap "I''ll renew" or "Not renewing" before the offer expires. If the price changes, you''ll be notified immediately in Pulse.', 'Leasing', 74),
   ('What are the amenity hours?', 'Pool: 9 AM – 10 PM (seasonal). Fitness center: 24/7 with key fob. Clubhouse & study rooms: 7 AM – 11 PM. Rooftop deck: 10 AM – 10 PM.', 'Amenities', 33),
   ('How do I connect to the Wi-Fi?', 'Join "Union-Resident" and sign in with your unit number and the Wi-Fi code from your move-in packet. Need help? Contact the 24/7 internet support line at (888) 555-0177.', 'Tech', 56),
   ('What do I need to do before move-out?', 'Give 60 days written notice, schedule a pre-move-out inspection, clean the unit, and return all keys and fobs to the office. Your deposit is returned within 30 days of move-out.', 'Leasing', 21);

  insert into public.messages(title, body, category, priority, requires_ack, audience_rule, audience_label, scheduled_at, created_by, created_at)
  select v.title, v.body, v.cat::public.msg_category, v.pri::public.msg_priority, v.ack, v.rule::jsonb, v.label,
    now() - (v.hrs || ' hours')::interval, (select id from public.profiles where email = 'jane@pulse.demo'), now() - (v.hrs || ' hours')::interval
  from (values
   ('Yoga Class at 9:30 AM on ' || to_char(current_date + 4, 'FMMM/FMDD'), 'Join us on the rooftop deck for a free beginner-friendly yoga class. Mats provided — bring water!', 'event', 'normal', false, '{}', 'All residents', 72),
   ('Fire Drill set for 3:25 PM on ' || to_char(current_date + 6, 'FMMM/FMDD'), 'The fire alarm will sound for approximately 10 minutes. Please exit using the nearest stairwell and gather in the north courtyard. Do not use elevators.', 'safety', 'urgent', true, '{}', 'All residents', 30),
   ('Package room overflow — please pick up your packages!', 'The package room is at capacity. If you''ve received a package notification, please pick it up today between 8 AM and 9 PM.', 'package', 'normal', false, '{}', 'All residents', 6),
   ('Building B pool closed for resurfacing', 'The Building B pool will be closed through Friday for resurfacing. The Building A pool remains open.', 'maintenance', 'normal', false, '{"buildings":["B"]}', 'Building B', 50),
   ('Renewal offers are out — decide by your offer date', 'If your lease ends in the next few months, your renewal offer is now in Pulse. Tap the renewal banner to review it.', 'renewal', 'normal', true, '{"renewal_statuses":["undecided"]}', 'Renewal status: undecided', 100),
   ('Water shut-off on floor 3, Thursday 10 AM–12 PM', 'Plumbers will be replacing a valve. Water will be off for floor 3 in all buildings.', 'maintenance', 'urgent', true, '{"floors":["3"]}', 'Floor 3', 20)
  ) as v(title, body, cat, pri, ack, rule, label, hrs);

  insert into public.deliveries(message_id, resident_id, delivered_at)
  select m.id, r, m.scheduled_at from public.messages m cross join lateral public.audience_residents(m.audience_rule) r;

  update public.deliveries set seen_at = delivered_at + interval '2 hours' where abs(hashtext(id::text)) % 100 < 62;
  update public.deliveries d set acked_at = seen_at + interval '5 minutes'
  from public.messages m where m.id = d.message_id and m.requires_ack and d.seen_at is not null and abs(hashtext(d.id::text || 'a')) % 100 < 70;
  update public.deliveries d set seen_at = case when m.title like 'Yoga%' then d.delivered_at + interval '1 hour' else null end, acked_at = null
  from public.messages m, public.profiles p
  where m.id = d.message_id and p.id = d.resident_id and p.email = 'john@pulse.demo';

  insert into public.charges(resident_id, description, amount, due_date, status, paid_at)
  select id, 'Rent – ' || to_char(date_trunc('month', current_date), 'FMMonth YYYY'), current_rent, date_trunc('month', current_date)::date, 'paid', date_trunc('month', current_date) + interval '1 day'
  from public.profiles where unit_id is not null;

  insert into public.packages(resident_id, carrier, note, arrived_at, picked_up_at)
  select p.id, v.carrier, v.note, now() - (v.d || ' days')::interval, now() - (v.d || ' days')::interval + interval '6 hours'
  from (values ('john@pulse.demo','USPS','Small parcel', 9), ('john@pulse.demo','Amazon','Box', 16), ('priya.n@pulse.demo','DHL','Box', 4)) v(email, carrier, note, d)
  join public.profiles p on p.email = v.email;

  insert into public.reservations(room_id, resident_id, starts_at, ends_at)
  select r.id, p.id, ((current_date + v.d) + (v.h || ' hours')::interval) at time zone 'America/Chicago', ((current_date + v.d) + ((v.h + 1) || ' hours')::interval) at time zone 'America/Chicago'
  from (values ('Study Room 1','priya.n@pulse.demo',1,14), ('Study Room 1','diego.r@pulse.demo',1,18), ('Study Room 2','ava.t@pulse.demo',1,10), ('Conference Room','ethan.c@pulse.demo',2,19), ('Study Room 1','john@pulse.demo',2,16)) v(room, email, d, h)
  join public.rooms r on r.name = v.room join public.profiles p on p.email = v.email;

  perform set_config('pulse.seeding', 'off', true);

  -- These fire the normal notification triggers.
  insert into public.charges(resident_id, description, amount, due_date)
  select id, 'Rent – ' || to_char(date_trunc('month', current_date) + interval '1 month', 'FMMonth YYYY'), current_rent, (date_trunc('month', current_date) + interval '1 month')::date
  from public.profiles where email in ('john@pulse.demo','marcus.lee@pulse.demo','olivia.m@pulse.demo','diego.r@pulse.demo');
  insert into public.charges(resident_id, description, amount, due_date)
  select id, 'Parking permit', 45, (date_trunc('month', current_date) + interval '1 month')::date from public.profiles where email = 'john@pulse.demo';

  insert into public.packages(resident_id, carrier, note, arrived_at)
  select p.id, v.carrier, v.note, now() - (v.hrs || ' hours')::interval
  from (values ('john@pulse.demo','Amazon','Medium box', 5), ('john@pulse.demo','UPS','Envelope', 26),
               ('jamal.w@pulse.demo','FedEx','Large box', 3), ('mia.j@pulse.demo','USPS','Small parcel', 30), ('ryan.s@pulse.demo','Amazon','Bag', 8)) v(email, carrier, note, hrs)
  join public.profiles p on p.email = v.email;

  update public.renewal_offers set offer_rent = 1225 where resident_id = (select id from public.profiles where email = 'john@pulse.demo');
end $$;

create or replace function public.reset_demo() returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  delete from public.deliveries where true;
  delete from public.messages where true;
  delete from public.packages where true;
  delete from public.charges where true;
  delete from public.reservations where true;
  delete from public.renewal_offers where true;
  delete from public.faq_views where true;
  delete from public.faqs where true;
  update public.profiles set unit_id = null, lease_end = null, current_rent = null, renewal_status = 'undecided'
  where email not like '%@pulse.demo';
  perform public.seed_demo();
end $$;

-- 8. Function privileges: Postgres grants EXECUTE to PUBLIC by default. Lock everything down,
--    then grant only what signed-in users need. (Skip extension-owned functions like btree_gist's.)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
alter default privileges in schema public revoke execute on functions from public;

grant execute on function public.is_staff() to authenticated;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.seeding() to authenticated;
grant execute on function public.my_feed() to authenticated;
grant execute on function public.mark_seen(uuid) to authenticated;
grant execute on function public.ack_message(uuid) to authenticated;
grant execute on function public.set_renewal_status(public.renewal_status) to authenticated;
grant execute on function public.pay_charge(uuid) to authenticated;
grant execute on function public.view_faq(uuid) to authenticated;
grant execute on function public.audience_count(jsonb) to authenticated;
grant execute on function public.send_message(text,text,public.msg_category,public.msg_priority,boolean,jsonb,text,timestamptz,uuid) to authenticated;
grant execute on function public.resend_reminder(uuid) to authenticated;
grant execute on function public.run_daily_reminders() to authenticated;
grant execute on function public.approve_resident(uuid,uuid,date,numeric) to authenticated;
grant execute on function public.reset_demo() to authenticated;

-- 9. Staff list of self-signed-up residents awaiting unit verification.
create or replace function public.pending_residents()
returns table(id uuid, full_name text, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  return query
    select p.id, p.full_name, p.email, p.created_at from public.profiles p
    where p.unit_id is null and p.user_id is not null
      and not exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.role = 'staff')
    order by p.created_at;
end $$;
revoke execute on function public.pending_residents() from public, anon;
grant execute on function public.pending_residents() to authenticated;

-- 10. Staff reporting RPCs (aggregate server-side; PostgREST caps responses at 1000 rows).
create or replace function public.message_stats(_include_personal boolean default false)
returns table(id uuid, title text, category public.msg_category, priority public.msg_priority, requires_ack boolean, audience_label text,
              scheduled_at timestamptz, parent_message_id uuid, is_personal boolean, delivered int, seen int, acked int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  return query
    select m.id, m.title, m.category, m.priority, m.requires_ack, m.audience_label, m.scheduled_at, m.parent_message_id, m.is_personal,
           count(d.id)::int, count(d.seen_at)::int, count(d.acked_at)::int
    from public.messages m left join public.deliveries d on d.message_id = m.id
    where _include_personal or not m.is_personal
    group by m.id order by m.scheduled_at desc limit 500;
end $$;

create or replace function public.message_recipients(_message_id uuid)
returns table(delivery_id uuid, resident_id uuid, full_name text, unit_number text, building text, seen_at timestamptz, acked_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  return query
    select d.id, p.id, p.full_name, u.unit_number, u.building, d.seen_at, d.acked_at
    from public.deliveries d join public.profiles p on p.id = d.resident_id left join public.units u on u.id = p.unit_id
    where d.message_id = _message_id order by d.seen_at nulls first, u.unit_number;
end $$;

create or replace function public.renewal_board()
returns table(resident_id uuid, full_name text, unit_number text, lease_end date, renewal_status public.renewal_status, current_rent numeric,
              offer_rent numeric, previous_offer_rent numeric, offer_expires date, renewal_notices int, renewal_notices_seen int, last_seen timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  return query
    select p.id, p.full_name, u.unit_number, p.lease_end, p.renewal_status, p.current_rent, o.offer_rent, o.previous_offer_rent, o.offer_expires,
           count(d.id)::int, count(d.seen_at)::int, max(d.seen_at)
    from public.profiles p join public.units u on u.id = p.unit_id
    left join public.renewal_offers o on o.resident_id = p.id
    left join public.deliveries d on d.resident_id = p.id and exists (select 1 from public.messages m where m.id = d.message_id and m.category = 'renewal' and m.scheduled_at <= now())
    group by p.id, u.unit_number, o.offer_rent, o.previous_offer_rent, o.offer_expires
    order by p.lease_end nulls last;
end $$;

revoke execute on function public.message_stats(boolean), public.message_recipients(uuid), public.renewal_board() from public, anon;
grant execute on function public.message_stats(boolean), public.message_recipients(uuid), public.renewal_board() to authenticated;

-- 11. Payment notifications name the charge ("Parking permit due 11/1"), so two charges don't look identical.
create or replace function public.trg_charge_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.seeding() or new.status = 'paid' then return new; end if;
  perform public.create_notification(new.resident_id, left(new.description || ' due ' || to_char(new.due_date, 'FMMM/FMDD'), 120),
    new.description || ': $' || to_char(new.amount, 'FM999,990.00') || ' is due ' || to_char(new.due_date, 'FMDay, Mon DD') || '.',
    'payment');
  return new;
end $$;
revoke execute on function public.trg_charge_notify() from public, anon, authenticated;

-- 12. "Your Amazon package arrived…" (was "A Amazon package…").
create or replace function public.trg_package_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.seeding() or new.picked_up_at is not null then return new; end if;
  perform public.create_notification(new.resident_id, '📦 You have a package',
    'Your ' || new.carrier || ' package arrived ' || to_char(new.arrived_at at time zone 'America/Chicago', 'Mon DD at FMHH12:MI AM') || '. Pick it up at the package room (open 8 AM – 9 PM).',
    'package');
  return new;
end $$;
revoke execute on function public.trg_package_notify() from public, anon, authenticated;

-- 13. Message history stats: sender name and median minutes from delivery to first open.
drop function if exists public.message_stats(boolean);
create function public.message_stats(_include_personal boolean default false)
returns table(id uuid, title text, category public.msg_category, priority public.msg_priority, requires_ack boolean, audience_label text,
              scheduled_at timestamptz, parent_message_id uuid, is_personal boolean, sent_by text,
              delivered int, seen int, acked int, median_open_minutes numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  return query
    select m.id, m.title, m.category, m.priority, m.requires_ack, m.audience_label, m.scheduled_at, m.parent_message_id, m.is_personal,
           coalesce(s.full_name, 'Pulse (automatic)'),
           count(d.id)::int, count(d.seen_at)::int, count(d.acked_at)::int,
           round((percentile_cont(0.5) within group (order by extract(epoch from (d.seen_at - d.delivered_at)) / 60))::numeric, 1)
    from public.messages m
    left join public.profiles s on s.id = m.created_by
    left join public.deliveries d on d.message_id = m.id
    where _include_personal or not m.is_personal
    group by m.id, s.full_name order by m.scheduled_at desc limit 1000;
end $$;
revoke execute on function public.message_stats(boolean) from public, anon;
grant execute on function public.message_stats(boolean) to authenticated;
