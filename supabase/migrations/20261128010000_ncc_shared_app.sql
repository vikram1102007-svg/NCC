-- NCC Shared Two-Day Event Application Schema (Auth + RLS + Atomic Capacity/Duplicate Checks)
-- Safe for multi-device student registration, attendance, certificates, and server-verified admin operations.

create table if not exists public.ncc_settings (
  id integer primary key default 1 check (id = 1),
  event_dates_text text not null default 'Dates To be announced (Two-Day Format)',
  venue_text text not null default 'College Parade Ground & Campus Arena (TBA)',
  contact_email text not null default 'ncc-unit@college.example',
  contact_phone text not null default '+91 00000 00000 (Placeholder)',
  signatory_left text not null default 'ANO / Unit Officer (Placeholder)',
  signatory_right text not null default 'Senior Under Officer / Organiser (Placeholder)',
  updated_at timestamptz not null default now()
);

create table if not exists public.ncc_events (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  title text not null check (char_length(trim(title)) between 2 and 120),
  day smallint not null check (day in (1, 2)),
  time text not null default 'TBA',
  venue text not null default 'TBA',
  type text not null check (type in ('Individual', 'Team')),
  team_size_label text not null default 'Individual',
  capacity integer not null default 30 check (capacity > 0 and capacity <= 5000),
  fee integer not null default 0 check (fee >= 0),
  status_label text not null default 'Open',
  registration_open boolean not null default true,
  subject_to_approvals boolean not null default false,
  description text not null default '',
  criteria text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ncc_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  phone text not null default '',
  regimental_no text not null default '',
  department text not null default '',
  year text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Separate admin membership table (no client writes permitted; enforced via RLS + service role/dashboard)
create table if not exists public.ncc_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('super_admin', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.ncc_registrations (
  id text primary key,
  qr_token text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references public.ncc_events(id) on delete restrict,
  name text not null,
  email text not null,
  regimental_no text not null default '',
  team_name text not null default '',
  fee integer not null default 0,
  status text not null default 'Registered' check (status in ('Registered', 'Confirmed', 'Cancelled')),
  payment text not null default 'Demo pending' check (payment in ('Demo pending', 'Demo paid', 'No fee (TBA)')),
  attended boolean not null default false,
  certificate_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ncc_registrations_user_event_active_idx
  on public.ncc_registrations (user_id, event_id)
  where status <> 'Cancelled';

create index if not exists ncc_registrations_event_status_idx
  on public.ncc_registrations (event_id, status);

create table if not exists public.ncc_certificates (
  certificate_id text primary key,
  registration_id text not null unique references public.ncc_registrations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_name text not null,
  regimental_no text not null default 'N/A',
  event_title text not null,
  event_day text not null,
  signatory_left text not null,
  signatory_right text not null,
  issued_at timestamptz not null default now()
);

create index if not exists ncc_certificates_user_id_idx
  on public.ncc_certificates (user_id);

-- Enable RLS on every public table
alter table public.ncc_settings enable row level security;
alter table public.ncc_events enable row level security;
alter table public.ncc_profiles enable row level security;
alter table public.ncc_admins enable row level security;
alter table public.ncc_registrations enable row level security;
alter table public.ncc_certificates enable row level security;

-- Helper: check whether current authenticated user is an NCC admin
create or replace function public.is_ncc_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.ncc_admins a
      where a.user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_ncc_admin() from public;
grant execute on function public.is_ncc_admin() to authenticated;

-- Auto-create profile when a user signs up via Supabase Auth
create or replace function public.handle_new_ncc_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_name text;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, 'Cadet'), '@', 1));
  insert into public.ncc_profiles (id, name, email, phone, regimental_no, department, year)
  values (
    new.id,
    left(v_name, 120),
    lower(coalesce(new.email, '')),
    left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 30),
    left(coalesce(new.raw_user_meta_data ->> 'regimentalNo', ''), 60),
    left(coalesce(new.raw_user_meta_data ->> 'department', ''), 80),
    left(coalesce(new.raw_user_meta_data ->> 'year', ''), 20)
  )
  on conflict (id) do update
  set
    name = excluded.name,
    email = excluded.email,
    phone = case when excluded.phone <> '' then excluded.phone else public.ncc_profiles.phone end,
    regimental_no = case when excluded.regimental_no <> '' then excluded.regimental_no else public.ncc_profiles.regimental_no end,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_ncc on auth.users;
create trigger on_auth_user_created_ncc
  after insert on auth.users
  for each row execute function public.handle_new_ncc_user();

-- RLS Policies
drop policy if exists "settings readable by all" on public.ncc_settings;
create policy "settings readable by all"
  on public.ncc_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "settings editable by admins" on public.ncc_settings;
create policy "settings editable by admins"
  on public.ncc_settings for all
  to authenticated
  using (public.is_ncc_admin())
  with check (public.is_ncc_admin());

drop policy if exists "events readable by all" on public.ncc_events;
create policy "events readable by all"
  on public.ncc_events for select
  to anon, authenticated
  using (true);

drop policy if exists "events manageable by admins" on public.ncc_events;
create policy "events manageable by admins"
  on public.ncc_events for all
  to authenticated
  using (public.is_ncc_admin())
  with check (public.is_ncc_admin());

drop policy if exists "users read own profile or admin reads all" on public.ncc_profiles;
create policy "users read own profile or admin reads all"
  on public.ncc_profiles for select
  to authenticated
  using ((select auth.uid()) = id or public.is_ncc_admin());

drop policy if exists "users insert own profile" on public.ncc_profiles;
create policy "users insert own profile"
  on public.ncc_profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "users update own profile" on public.ncc_profiles;
create policy "users update own profile"
  on public.ncc_profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "admins can read own membership" on public.ncc_admins;
create policy "admins can read own membership"
  on public.ncc_admins for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users read own registrations or admin reads all" on public.ncc_registrations;
create policy "users read own registrations or admin reads all"
  on public.ncc_registrations for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_ncc_admin());

drop policy if exists "admins update registrations" on public.ncc_registrations;
create policy "admins update registrations"
  on public.ncc_registrations for update
  to authenticated
  using (public.is_ncc_admin())
  with check (public.is_ncc_admin());

drop policy if exists "admins delete registrations" on public.ncc_registrations;
create policy "admins delete registrations"
  on public.ncc_registrations for delete
  to authenticated
  using (public.is_ncc_admin());

drop policy if exists "users read own certificates or admin reads all" on public.ncc_certificates;
create policy "users read own certificates or admin reads all"
  on public.ncc_certificates for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_ncc_admin());

-- Explicit table grants
revoke all on public.ncc_settings, public.ncc_events, public.ncc_profiles,
  public.ncc_admins, public.ncc_registrations, public.ncc_certificates
  from public, anon, authenticated;

grant select on public.ncc_settings, public.ncc_events to anon, authenticated;
grant insert, update, delete on public.ncc_settings, public.ncc_events to authenticated;
grant select, insert, update on public.ncc_profiles to authenticated;
grant select on public.ncc_admins to authenticated;
grant select, update, delete on public.ncc_registrations to authenticated;
grant select on public.ncc_certificates to authenticated;

-- Public aggregate counts (zero PII exposed)
create or replace function public.get_event_taken_counts()
returns table (event_id text, taken_count bigint)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select r.event_id, count(*)::bigint as taken_count
  from public.ncc_registrations r
  where r.status <> 'Cancelled'
  group by r.event_id;
$$;

revoke all on function public.get_event_taken_counts() from public;
grant execute on function public.get_event_taken_counts() to anon, authenticated;

-- Atomic registration RPC enforcing approval lock, duplicate prevention, team name, and event capacity
create or replace function public.register_for_ncc_events(
  p_event_ids text[],
  p_team_name text default ''
)
returns setof public.ncc_registrations
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.ncc_profiles%rowtype;
  v_event public.ncc_events%rowtype;
  v_eid text;
  v_taken bigint;
  v_reg_id text;
  v_token text;
  v_clean_team text := trim(coalesce(p_team_name, ''));
  v_inserted public.ncc_registrations%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required to register.' using errcode = '42501';
  end if;

  if p_event_ids is null or cardinality(p_event_ids) = 0 then
    raise exception 'Select at least one event.' using errcode = '22023';
  end if;

  select * into v_profile from public.ncc_profiles where id = v_uid;
  if not found then
    select
      u.id,
      coalesce(nullif(trim(u.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(u.email, 'Cadet'), '@', 1)),
      lower(coalesce(u.email, '')),
      coalesce(u.raw_user_meta_data ->> 'phone', ''),
      coalesce(u.raw_user_meta_data ->> 'regimentalNo', ''),
      coalesce(u.raw_user_meta_data ->> 'department', ''),
      coalesce(u.raw_user_meta_data ->> 'year', ''),
      now(),
      now()
    into v_profile
    from auth.users u
    where u.id = v_uid;

    insert into public.ncc_profiles (id, name, email, phone, regimental_no, department, year)
    values (v_profile.id, v_profile.name, v_profile.email, v_profile.phone, v_profile.regimental_no, v_profile.department, v_profile.year)
    on conflict (id) do nothing;
  end if;

  foreach v_eid in array p_event_ids loop
    -- Lock event row to prevent concurrent overbooking
    select * into v_event
    from public.ncc_events e
    where e.id = v_eid
    for update;

    if not found then
      raise exception 'Event % does not exist.', v_eid using errcode = '22023';
    end if;

    if not v_event.registration_open or v_event.subject_to_approvals then
      raise exception '% registration is not open (subject to approvals).', v_event.title using errcode = 'P0001';
    end if;

    if v_event.type = 'Team' and char_length(v_clean_team) < 2 then
      raise exception 'Please enter a team / squad name for %.', v_event.title using errcode = '22023';
    end if;

    if exists (
      select 1 from public.ncc_registrations r
      where r.user_id = v_uid and r.event_id = v_event.id and r.status <> 'Cancelled'
    ) then
      raise exception 'You already have an active registration for %.', v_event.title using errcode = '23505';
    end if;

    select count(*) into v_taken
    from public.ncc_registrations r
    where r.event_id = v_event.id and r.status <> 'Cancelled';

    if v_taken >= v_event.capacity then
      raise exception '% has reached full capacity.', v_event.title using errcode = 'P0001';
    end if;

    v_reg_id := 'NCC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    v_token := 'TKN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

    insert into public.ncc_registrations (
      id, qr_token, user_id, event_id, name, email, regimental_no, team_name, fee, status, payment
    )
    values (
      v_reg_id,
      v_token,
      v_uid,
      v_event.id,
      v_profile.name,
      v_profile.email,
      v_profile.regimental_no,
      case when v_event.type = 'Team' then v_clean_team else '' end,
      v_event.fee,
      'Registered',
      case when v_event.fee > 0 then 'Demo pending' else 'No fee (TBA)' end
    )
    returning * into v_inserted;

    return next v_inserted;
  end loop;
end;
$$;

revoke all on function public.register_for_ncc_events(text[], text) from public;
grant execute on function public.register_for_ncc_events(text[], text) to authenticated;

-- Student self-service cancellation RPC (ownership enforced)
create or replace function public.cancel_my_registration(p_reg_id text)
returns public.ncc_registrations
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.ncc_registrations%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.ncc_registrations
  set status = 'Cancelled', updated_at = now()
  where id = p_reg_id and user_id = v_uid
  returning * into v_row;

  if not found then
    raise exception 'Registration not found.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke all on function public.cancel_my_registration(text) from public;
grant execute on function public.cancel_my_registration(text) to authenticated;

-- Student demo-payment simulation RPC (updates only payment column on own active registration)
create or replace function public.simulate_my_demo_payment(p_reg_id text)
returns public.ncc_registrations
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.ncc_registrations%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.ncc_registrations
  set payment = 'Demo paid', updated_at = now()
  where id = p_reg_id and user_id = v_uid and status <> 'Cancelled'
  returning * into v_row;

  if not found then
    raise exception 'Active registration not found.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke all on function public.simulate_my_demo_payment(text) from public;
grant execute on function public.simulate_my_demo_payment(text) to authenticated;

-- Admin check-in by QR token or Reference ID (issues certificate atomically)
create or replace function public.admin_checkin_by_token(p_token text)
returns public.ncc_registrations
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean text := upper(trim(coalesce(p_token, '')));
  v_row public.ncc_registrations%rowtype;
  v_ev public.ncc_events%rowtype;
  v_settings public.ncc_settings%rowtype;
  v_cert_id text;
begin
  if not public.is_ncc_admin() then
    raise exception 'Admin privileges required.' using errcode = '42501';
  end if;

  if v_clean = '' then
    raise exception 'Enter a QR token or registration reference.' using errcode = '22023';
  end if;

  select * into v_row
  from public.ncc_registrations r
  where (upper(r.qr_token) = v_clean or upper(r.id) = v_clean)
    and r.status <> 'Cancelled'
  limit 1;

  if not found then
    raise exception 'No active registration matches that token.' using errcode = 'P0002';
  end if;

  v_cert_id := coalesce(v_row.certificate_id, 'CERT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));

  update public.ncc_registrations
  set attended = true, status = 'Confirmed', certificate_id = v_cert_id, updated_at = now()
  where id = v_row.id
  returning * into v_row;

  select * into v_ev from public.ncc_events where id = v_row.event_id;
  select * into v_settings from public.ncc_settings where id = 1;

  insert into public.ncc_certificates (
    certificate_id, registration_id, user_id, participant_name, regimental_no,
    event_title, event_day, signatory_left, signatory_right
  )
  values (
    v_cert_id,
    v_row.id,
    v_row.user_id,
    v_row.name,
    coalesce(nullif(v_row.regimental_no, ''), 'N/A'),
    coalesce(v_ev.title, v_row.event_id),
    'Day ' || coalesce(v_ev.day::text, '1'),
    coalesce(v_settings.signatory_left, 'ANO / Unit Officer'),
    coalesce(v_settings.signatory_right, 'Senior Under Officer')
  )
  on conflict (certificate_id) do nothing;

  return v_row;
end;
$$;

revoke all on function public.admin_checkin_by_token(text) from public;
grant execute on function public.admin_checkin_by_token(text) to authenticated;

-- Admin update registration (status, payment, attendance + automatic certificate issuance)
create or replace function public.admin_update_registration(
  p_reg_id text,
  p_status text default null,
  p_payment text default null,
  p_attended boolean default null
)
returns public.ncc_registrations
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_row public.ncc_registrations%rowtype;
  v_ev public.ncc_events%rowtype;
  v_settings public.ncc_settings%rowtype;
  v_cert_id text;
begin
  if not public.is_ncc_admin() then
    raise exception 'Admin privileges required.' using errcode = '42501';
  end if;

  select * into v_row from public.ncc_registrations where id = p_reg_id;
  if not found then
    raise exception 'Registration not found.' using errcode = 'P0002';
  end if;

  v_cert_id := v_row.certificate_id;
  if coalesce(p_attended, v_row.attended) and v_cert_id is null then
    v_cert_id := 'CERT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  end if;

  update public.ncc_registrations
  set
    status = coalesce(p_status, status),
    payment = coalesce(p_payment, payment),
    attended = coalesce(p_attended, attended),
    certificate_id = v_cert_id,
    updated_at = now()
  where id = p_reg_id
  returning * into v_row;

  if v_row.attended and v_row.certificate_id is not null then
    select * into v_ev from public.ncc_events where id = v_row.event_id;
    select * into v_settings from public.ncc_settings where id = 1;
    insert into public.ncc_certificates (
      certificate_id, registration_id, user_id, participant_name, regimental_no,
      event_title, event_day, signatory_left, signatory_right
    )
    values (
      v_row.certificate_id,
      v_row.id,
      v_row.user_id,
      v_row.name,
      coalesce(nullif(v_row.regimental_no, ''), 'N/A'),
      coalesce(v_ev.title, v_row.event_id),
      'Day ' || coalesce(v_ev.day::text, '1'),
      coalesce(v_settings.signatory_left, 'ANO / Unit Officer'),
      coalesce(v_settings.signatory_right, 'Senior Under Officer')
    )
    on conflict (certificate_id) do nothing;
  end if;

  return v_row;
end;
$$;

revoke all on function public.admin_update_registration(text, text, text, boolean) from public;
grant execute on function public.admin_update_registration(text, text, text, boolean) to authenticated;

-- Public single-certificate verification RPC (by exact certificate ID only; no list dump)
create or replace function public.verify_ncc_certificate(p_cert_id text)
returns setof public.ncc_certificates
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select *
  from public.ncc_certificates c
  where upper(c.certificate_id) = upper(trim(coalesce(p_cert_id, '')))
  limit 1;
$$;

revoke all on function public.verify_ncc_certificate(text) from public;
grant execute on function public.verify_ncc_certificate(text) to anon, authenticated;

-- Seed default settings and 5 NCC events (idempotent)
insert into public.ncc_settings (id) values (1) on conflict (id) do nothing;

insert into public.ncc_events (
  id, title, day, time, venue, type, team_size_label, capacity, fee, status_label, registration_open, subject_to_approvals, description, criteria
) values
  (
    'drill',
    'Drill',
    1,
    '09:30 IST (TBA)',
    'College Parade Ground (TBA)',
    'Team',
    'Squad / Individual',
    30,
    400,
    'Open',
    true,
    false,
    'Precision foot drill and command assessment judged on turnout, uniformity, and parade timing. Final criteria are pending committee review.',
    array[
      'Valid College ID and NCC cadet enrollment verification required on arrival.',
      'Complete NCC uniform turnout, polished footwear, and parade discipline.',
      'Synchronisation, posture, and command clarity during squad inspection.'
    ]
  ),
  (
    'quiz',
    'NCC & Defence Quiz',
    1,
    '13:30 IST (TBA)',
    'College Auditorium (TBA)',
    'Team',
    'Team (2 Cadets)',
    40,
    0,
    'Open',
    true,
    false,
    'Written preliminary screening followed by stage finals covering NCC history, Indian defence forces, and current affairs.',
    array[
      'Teams of two cadets from the same unit or institution.',
      'Preliminary written test determines top six teams for stage finals.',
      'Electronic gadgets are strictly prohibited inside the quiz hall.'
    ]
  ),
  (
    'map-reading',
    'Map Reading',
    2,
    '09:00 IST (TBA)',
    'Training Ground (TBA)',
    'Individual',
    'Individual / Pair',
    35,
    0,
    'Open',
    true,
    false,
    'Practical field-craft assessment of 6-figure grid references, prismatic compass bearings, and topographic route plotting.',
    array[
      'Accuracy in reading conventional signs and 6-figure grid coordinates.',
      'Compass bearing and back-bearing measurement within allotted time.',
      'Carry basic stationery (pencil, scale, eraser) to the reporting desk.'
    ]
  ),
  (
    'obstacle',
    'Obstacle Course',
    2,
    '11:00 IST (TBA)',
    'Obstacle Arena (TBA)',
    'Individual',
    'Individual',
    40,
    0,
    'Open',
    true,
    false,
    'Timed physical endurance and agility circuit covering standard cadet obstacles under officer supervision.',
    array[
      'PT kit and proper sports footwear are mandatory for safety.',
      'Successful clearance of each obstacle in sequence within cut-off time.',
      'Warm-up and fitness declaration required before starting.'
    ]
  ),
  (
    'firing',
    'Firing',
    2,
    '14:00 IST (Subject to approvals)',
    'Authorised Range Facility (TBA)',
    'Individual',
    'Individual',
    25,
    400,
    'Subject to approvals',
    false,
    true,
    'Proposed range activity. Firing is not confirmed and remains strictly subject to approvals from the organising unit and authorised safety officers.',
    array[
      'Activity is strictly subject to approvals and authorised range safety clearance.',
      'Mandatory range safety briefing and officer supervision before entry.',
      'Zero-tolerance compliance with range discipline and command whistle.'
    ]
  )
on conflict (id) do nothing;
