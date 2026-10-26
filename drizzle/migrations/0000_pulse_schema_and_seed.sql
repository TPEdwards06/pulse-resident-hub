create extension if not exists btree_gist;

create type public.app_role as enum ('resident','staff');
create type public.renewal_status as enum ('undecided','renewing','not_renewing');
create type public.msg_category as enum ('announcement','event','safety','package','payment','renewal','maintenance');
create type public.msg_priority as enum ('normal','urgent');

-- UNITS
create table public.units (
  id uuid primary key default gen_random_uuid(),
  building text not null,
  floor int not null,
  unit_number text not null unique
);
grant select on public.units to authenticated;
grant all on public.units to service_role;
alter table public.units enable row level security;

-- PROFILES
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text unique,
  full_name text not null,
  unit_id uuid references public.units(id) on delete set null,
  phone text,
  lease_end date,
  renewal_status public.renewal_status not null default 'undecided',
  current_rent numeric(10,2),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.staff_emails (email text primary key);
grant all on public.staff_emails to service_role;
alter table public.staff_emails enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'staff')
$$;
create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid() limit 1
$$;

-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  category public.msg_category not null default 'announcement',
  priority public.msg_priority not null default 'normal',
  requires_ack boolean not null default false,
  audience_rule jsonb not null default '{}'::jsonb,
  audience_label text,
  is_personal boolean not null default false,
  parent_message_id uuid references public.messages(id) on delete set null,
  dedupe_key text unique,
  scheduled_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  resident_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  seen_at timestamptz,
  acked_at timestamptz,
  unique (message_id, resident_id)
);
create index on public.deliveries(resident_id);
grant select, insert, update, delete on public.deliveries to authenticated;
grant all on public.deliveries to service_role;
alter table public.deliveries enable row level security;

-- PACKAGES / CHARGES
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.profiles(id) on delete cascade,
  carrier text not null,
  note text,
  arrived_at timestamptz not null default now(),
  picked_up_at timestamptz
);
grant select, insert, update, delete on public.packages to authenticated;
grant all on public.packages to service_role;
alter table public.packages enable row level security;

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.profiles(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  due_date date not null,
  status text not null default 'due' check (status in ('due','paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.charges to authenticated;
grant all on public.charges to service_role;
alter table public.charges enable row level security;

-- ROOMS
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  capacity int not null default 4
);
grant select, insert, update, delete on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  resident_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  exclude using gist (room_id with =, tstzrange(starts_at, ends_at) with &&)
);
grant select, insert, update, delete on public.reservations to authenticated;
grant all on public.reservations to service_role;
alter table public.reservations enable row level security;

-- FAQS
create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text not null default 'General',
  view_count int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.faqs to authenticated;
grant all on public.faqs to service_role;
alter table public.faqs enable row level security;

-- RENEWAL OFFERS
create table public.renewal_offers (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null unique references public.profiles(id) on delete cascade,
  current_rent numeric(10,2) not null,
  offer_rent numeric(10,2) not null,
  previous_offer_rent numeric(10,2),
  offer_expires date not null,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.renewal_offers to authenticated;
grant all on public.renewal_offers to service_role;
alter table public.renewal_offers enable row level security;

-- POLICIES
create policy "units readable" on public.units for select to authenticated using (true);
create policy "staff manage units" on public.units for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "own profile or staff" on public.profiles for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "staff manage profiles" on public.profiles for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create policy "residents read addressed messages" on public.messages for select to authenticated using (
  public.is_staff() or (scheduled_at <= now() and exists (
    select 1 from public.deliveries d where d.message_id = messages.id and d.resident_id = public.current_profile_id()))
);
create policy "staff manage messages" on public.messages for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "own deliveries" on public.deliveries for select to authenticated using (resident_id = public.current_profile_id() or public.is_staff());
create policy "staff manage deliveries" on public.deliveries for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "own packages" on public.packages for select to authenticated using (resident_id = public.current_profile_id() or public.is_staff());
create policy "staff manage packages" on public.packages for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "own charges" on public.charges for select to authenticated using (resident_id = public.current_profile_id() or public.is_staff());
create policy "staff manage charges" on public.charges for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "rooms readable" on public.rooms for select to authenticated using (true);
create policy "staff manage rooms" on public.rooms for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "reservations readable" on public.reservations for select to authenticated using (true);
create policy "book own" on public.reservations for insert to authenticated with check (resident_id = public.current_profile_id() and starts_at > now() - interval '1 hour');
create policy "cancel own or staff" on public.reservations for delete to authenticated using (resident_id = public.current_profile_id() or public.is_staff());

create policy "faqs readable" on public.faqs for select to authenticated using (true);
create policy "staff manage faqs" on public.faqs for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "own offer" on public.renewal_offers for select to authenticated using (resident_id = public.current_profile_id() or public.is_staff());
create policy "staff manage offers" on public.renewal_offers for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- AUDIENCE
create or replace function public.audience_residents(rule jsonb)
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p join public.units u on u.id = p.unit_id
  where (coalesce(jsonb_array_length(rule->'buildings'),0)=0 or u.building in (select jsonb_array_elements_text(rule->'buildings')))
    and (coalesce(jsonb_array_length(rule->'floors'),0)=0 or u.floor::text in (select jsonb_array_elements_text(rule->'floors')))
    and (coalesce(jsonb_array_length(rule->'unit_ids'),0)=0 or u.id::text in (select jsonb_array_elements_text(rule->'unit_ids')))
    and (coalesce(jsonb_array_length(rule->'renewal_statuses'),0)=0 or p.renewal_status::text in (select jsonb_array_elements_text(rule->'renewal_statuses')))
    and (coalesce(jsonb_array_length(rule->'resident_ids'),0)=0 or p.id::text in (select jsonb_array_elements_text(rule->'resident_ids')))
    and (coalesce(rule->>'lease_end_before','')='' or p.lease_end < (rule->>'lease_end_before')::date)
$$;
revoke execute on function public.audience_residents(jsonb) from public, anon, authenticated;

create or replace function public.audience_count(rule jsonb)
returns int language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  return (select count(*) from public.audience_residents(rule));
end $$;
grant execute on function public.audience_count(jsonb) to authenticated;

create or replace function public.create_notification(_resident uuid, _title text, _body text, _category public.msg_category, _priority public.msg_priority default 'normal', _ack boolean default false, _dedupe text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  insert into public.messages(title, body, category, priority, requires_ack, audience_rule, audience_label, is_personal, dedupe_key)
  values (_title, _body, _category, _priority, _ack, jsonb_build_object('resident_ids', jsonb_build_array(_resident::text)), 'Personal', true, _dedupe)
  on conflict (dedupe_key) do nothing
  returning id into mid;
  if mid is not null then
    insert into public.deliveries(message_id, resident_id) values (mid, _resident);
  end if;
  return mid;
end $$;
revoke execute on function public.create_notification(uuid,text,text,public.msg_category,public.msg_priority,boolean,text) from public, anon, authenticated;

create or replace function public.send_message(_title text, _body text, _category public.msg_category, _priority public.msg_priority, _requires_ack boolean, _rule jsonb, _label text, _scheduled_at timestamptz default null, _parent uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid; ts timestamptz := coalesce(_scheduled_at, now());
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  if coalesce(trim(_title),'') = '' then raise exception 'Title required'; end if;
  insert into public.messages(title, body, category, priority, requires_ack, audience_rule, audience_label, scheduled_at, created_by, parent_message_id)
  values (_title, coalesce(_body,''), _category, _priority, _requires_ack, coalesce(_rule,'{}'::jsonb), _label, ts, public.current_profile_id(), _parent)
  returning id into mid;
  insert into public.deliveries(message_id, resident_id, delivered_at)
  select mid, r, ts from public.audience_residents(coalesce(_rule,'{}'::jsonb)) r;
  return mid;
end $$;
grant execute on function public.send_message(text,text,public.msg_category,public.msg_priority,boolean,jsonb,text,timestamptz,uuid) to authenticated;

create or replace function public.resend_reminder(_message_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare m public.messages; ids jsonb; n int;
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  select * into m from public.messages where id = _message_id;
  select jsonb_agg(resident_id::text), count(*) into ids, n from public.deliveries where message_id = _message_id and seen_at is null;
  if coalesce(n,0) = 0 then return 0; end if;
  perform public.send_message('Reminder: ' || m.title, m.body, m.category, 'urgent', m.requires_ack, jsonb_build_object('resident_ids', ids), 'Follow-up: not yet seen', now(), m.id);
  return n;
end $$;
grant execute on function public.resend_reminder(uuid) to authenticated;

create or replace function public.mark_seen(_delivery_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.deliveries set seen_at = coalesce(seen_at, now())
  where id = _delivery_id and resident_id = public.current_profile_id();
$$;
grant execute on function public.mark_seen(uuid) to authenticated;

create or replace function public.ack_message(_delivery_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.deliveries set seen_at = coalesce(seen_at, now()), acked_at = coalesce(acked_at, now())
  where id = _delivery_id and resident_id = public.current_profile_id();
$$;
grant execute on function public.ack_message(uuid) to authenticated;

create or replace function public.set_renewal_status(_status public.renewal_status)
returns void language sql security definer set search_path = public as $$
  update public.profiles set renewal_status = _status where user_id = auth.uid();
$$;
grant execute on function public.set_renewal_status(public.renewal_status) to authenticated;

create or replace function public.pay_charge(_charge_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.charges set status = 'paid', paid_at = now()
  where id = _charge_id and status = 'due' and resident_id = public.current_profile_id();
$$;
grant execute on function public.pay_charge(uuid) to authenticated;

create or replace function public.view_faq(_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.faqs set view_count = view_count + 1 where id = _id;
$$;
grant execute on function public.view_faq(uuid) to authenticated;

create or replace function public.run_daily_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; t int; mid uuid;
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  for r in
    select p.id, coalesce(o.offer_expires, p.lease_end - 60) as deadline
    from public.profiles p left join public.renewal_offers o on o.resident_id = p.id
    where p.unit_id is not null and p.renewal_status = 'undecided' and p.lease_end is not null
  loop
    t := (select min(x) from unnest(array[60,30,14,7,1]) x where x >= (r.deadline - current_date));
    if t is null or (r.deadline - current_date) < 0 then continue; end if;
    mid := public.create_notification(r.id,
      case when t = 1 then 'Renewal deadline is TOMORROW' else 'Renewal deadline in ' || (r.deadline - current_date) || ' days' end,
      'Your lease renewal decision is due ' || to_char(r.deadline, 'Mon DD, YYYY') || '. Open Pulse to review your offer and let us know if you''re renewing.',
      'renewal', case when t <= 7 then 'urgent' else 'normal' end::public.msg_priority, t <= 14,
      'renewal-' || r.id || '-' || t || '-' || r.deadline);
    if mid is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
grant execute on function public.run_daily_reminders() to authenticated;

-- AUTO NOTIFICATION TRIGGERS
create or replace function public.seeding() returns boolean language sql stable as $$
  select coalesce(current_setting('pulse.seeding', true), '') = 'on'
$$;

create or replace function public.trg_package_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.seeding() or new.picked_up_at is not null then return new; end if;
  perform public.create_notification(new.resident_id, '📦 You have a package',
    'A ' || new.carrier || ' package arrived ' || to_char(new.arrived_at at time zone 'America/Chicago', 'Mon DD at HH12:MI AM') || '. Pick it up at the package room (open 8 AM – 9 PM).',
    'package');
  return new;
end $$;
create trigger package_notify after insert on public.packages for each row execute function public.trg_package_notify();

create or replace function public.trg_charge_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.seeding() or new.status = 'paid' then return new; end if;
  perform public.create_notification(new.resident_id, 'Payment due ' || to_char(new.due_date, 'Mon DD'),
    new.description || ': $' || to_char(new.amount, 'FM999,990.00') || ' is due ' || to_char(new.due_date, 'FMDay, Mon DD') || '.',
    'payment');
  return new;
end $$;
create trigger charge_notify after insert on public.charges for each row execute function public.trg_charge_notify();

create or replace function public.trg_offer_before() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.offer_rent is distinct from old.offer_rent then
    new.previous_offer_rent := old.offer_rent;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger offer_before before update on public.renewal_offers for each row execute function public.trg_offer_before();

create or replace function public.trg_offer_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.seeding() then return new; end if;
  if tg_op = 'INSERT' then
    perform public.create_notification(new.resident_id, 'Your renewal offer is ready',
      'Your renewal rent offer is $' || to_char(new.offer_rent, 'FM999,990') || '/mo (current: $' || to_char(new.current_rent, 'FM999,990') || '). Please decide by ' || to_char(new.offer_expires, 'Mon DD, YYYY') || '.',
      'renewal', 'normal', true);
  elsif new.offer_rent is distinct from old.offer_rent then
    perform public.create_notification(new.resident_id, 'Your renewal price changed',
      'Your renewal offer changed from $' || to_char(old.offer_rent, 'FM999,990') || ' to $' || to_char(new.offer_rent, 'FM999,990') || '/mo. Your current rent is $' || to_char(new.current_rent, 'FM999,990') || '. Offer expires ' || to_char(new.offer_expires, 'Mon DD, YYYY') || '.',
      'renewal', 'urgent', true);
  end if;
  return new;
end $$;
create trigger offer_notify after insert or update on public.renewal_offers for each row execute function public.trg_offer_notify();

-- SIGNUP
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid; is_s boolean; vacant uuid;
begin
  is_s := exists (select 1 from public.staff_emails where lower(email) = lower(new.email));
  update public.profiles set user_id = new.id where lower(email) = lower(new.email) and user_id is null returning id into pid;
  if pid is null then
    if not is_s then
      select u.id into vacant from public.units u where not exists (select 1 from public.profiles p where p.unit_id = u.id) order by u.unit_number limit 1;
    end if;
    insert into public.profiles(user_id, email, full_name, unit_id, lease_end, current_rent)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
            vacant, case when vacant is null then null else current_date + 240 end, case when vacant is null then null else 1095 end)
    returning id into pid;
    if vacant is not null then
      perform public.create_notification(pid, 'Welcome to Pulse!', 'You''ll get building announcements, package alerts, payment reminders and renewal updates here.', 'announcement');
    end if;
  end if;
  insert into public.user_roles(user_id, role) values (new.id, case when is_s then 'staff' else 'resident' end::public.app_role) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============ SEED ============
select set_config('pulse.seeding', 'on', true);

insert into public.units(building, floor, unit_number)
select b, f, b || f || lpad(n::text, 2, '0')
from unnest(array['A','B','C']) b, generate_series(1,5) f, generate_series(1,2) n;

insert into public.staff_emails values ('jane@pulse.demo');
insert into public.profiles(email, full_name) values ('jane@pulse.demo', 'Jane Doe');

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
) as v(email, name, unit, phone, days, status, rent);

insert into public.renewal_offers(resident_id, current_rent, offer_rent, offer_expires)
select p.id, p.current_rent, round(p.current_rent * 1.04), least(p.lease_end - 45, current_date + 30)
from public.profiles p where p.unit_id is not null and p.lease_end < current_date + 160 and p.email <> 'john@pulse.demo';

insert into public.renewal_offers(resident_id, current_rent, offer_rent, offer_expires)
select id, 1150, 1195, current_date + 21 from public.profiles where email = 'john@pulse.demo';

insert into public.rooms(name, location, capacity) values
 ('Study Room 1', 'Building A · 2nd floor', 4),
 ('Study Room 2', 'Building B · Lobby level', 6),
 ('Conference Room', 'Clubhouse', 10);

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

-- Building-wide sample messages
insert into public.messages(title, body, category, priority, requires_ack, audience_rule, audience_label, scheduled_at, created_by)
select v.title, v.body, v.cat::public.msg_category, v.pri::public.msg_priority, v.ack, v.rule::jsonb, v.label, now() - (v.hrs || ' hours')::interval,
  (select id from public.profiles where email = 'jane@pulse.demo')
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

-- John: only the yoga notice seen
update public.deliveries d set seen_at = case when m.title like 'Yoga%' then d.delivered_at + interval '1 hour' else null end, acked_at = null
from public.messages m, public.profiles p
where m.id = d.message_id and p.id = d.resident_id and p.email = 'john@pulse.demo';

-- Charges (paid history silent)
insert into public.charges(resident_id, description, amount, due_date, status, paid_at)
select id, 'Rent – ' || to_char(date_trunc('month', current_date), 'Month YYYY'), current_rent, date_trunc('month', current_date)::date, 'paid', date_trunc('month', current_date) + interval '1 day'
from public.profiles where unit_id is not null;

select set_config('pulse.seeding', 'off', true);

-- Upcoming charges (create notifications)
insert into public.charges(resident_id, description, amount, due_date)
select id, 'Rent – ' || to_char(date_trunc('month', current_date) + interval '1 month', 'FMMonth YYYY'), current_rent, (date_trunc('month', current_date) + interval '1 month')::date
from public.profiles where email in ('john@pulse.demo','marcus.lee@pulse.demo','olivia.m@pulse.demo','diego.r@pulse.demo');
insert into public.charges(resident_id, description, amount, due_date)
select id, 'Parking permit', 45, (date_trunc('month', current_date) + interval '1 month')::date from public.profiles where email = 'john@pulse.demo';

-- Packages
insert into public.packages(resident_id, carrier, note, arrived_at)
select p.id, v.carrier, v.note, now() - (v.hrs || ' hours')::interval
from (values ('john@pulse.demo','Amazon','Medium box', 5), ('john@pulse.demo','UPS','Envelope', 26),
             ('jamal.w@pulse.demo','FedEx','Large box', 3), ('mia.j@pulse.demo','USPS','Small parcel', 30), ('ryan.s@pulse.demo','Amazon','Bag', 8)) v(email, carrier, note, hrs)
join public.profiles p on p.email = v.email;
insert into public.packages(resident_id, carrier, note, arrived_at, picked_up_at)
select p.id, v.carrier, v.note, now() - (v.d || ' days')::interval, now() - (v.d || ' days')::interval + interval '6 hours'
from (values ('john@pulse.demo','USPS','Small parcel', 9), ('john@pulse.demo','Amazon','Box', 16), ('priya.n@pulse.demo','DHL','Box', 4)) v(email, carrier, note, d)
join public.profiles p on p.email = v.email;

-- John renewal price change
update public.renewal_offers set offer_rent = 1225 where resident_id = (select id from public.profiles where email = 'john@pulse.demo');

-- Reservations
insert into public.reservations(room_id, resident_id, starts_at, ends_at)
select r.id, p.id, ((current_date + v.d) + (v.h || ' hours')::interval) at time zone 'America/Chicago', ((current_date + v.d) + ((v.h + 1) || ' hours')::interval) at time zone 'America/Chicago'
from (values ('Study Room 1','priya.n@pulse.demo',1,14), ('Study Room 1','diego.r@pulse.demo',1,18), ('Study Room 2','ava.t@pulse.demo',1,10), ('Conference Room','ethan.c@pulse.demo',2,19), ('Study Room 1','john@pulse.demo',2,16)) v(room, email, d, h)
join public.rooms r on r.name = v.room join public.profiles p on p.email = v.email;
