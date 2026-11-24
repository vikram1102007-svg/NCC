-- NCC registration foundation. Apply only after an NCC Supabase project is approved.
-- Public registration is closed by default. No payment gateway is configured here.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text,
  venue text,
  start_date date,
  end_date date,
  registration_open boolean not null default false,
  registration_starts_at timestamptz,
  registration_ends_at timestamptz,
  capacity integer check (capacity is null or capacity > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date),
  check (registration_starts_at is null or registration_ends_at is null or registration_ends_at >= registration_starts_at)
);

create table if not exists public.event_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 2 and 120),
  registration_mode text not null check (registration_mode in ('individual', 'team')),
  min_team_size integer not null default 1 check (min_team_size >= 1),
  max_team_size integer not null default 1 check (max_team_size >= min_team_size and max_team_size <= 25),
  capacity integer check (capacity is null or capacity > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, code),
  unique (id, event_id),
  check (
    (registration_mode = 'individual' and min_team_size = 1 and max_team_size = 1)
    or registration_mode = 'team'
  )
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  category_id uuid not null,
  registration_ref text not null unique,
  idempotency_key uuid not null unique,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  contact_name text not null check (char_length(trim(contact_name)) between 2 and 100),
  contact_email text not null check (char_length(contact_email) <= 254),
  contact_phone text not null check (char_length(contact_phone) between 8 and 20),
  institution_name text not null check (char_length(trim(institution_name)) between 2 and 160),
  team_name text,
  member_names text[] not null default '{}',
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected', 'cancelled')),
  qr_token_hash text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, event_id) references public.event_categories(id, event_id),
  check (contact_email = lower(contact_email)),
  check (contact_phone ~ '^\+?[0-9][0-9 ()-]{6,18}[0-9]$'),
  check (cardinality(member_names) <= 25)
);

create unique index if not exists registrations_event_category_email_key
  on public.registrations (event_id, category_id, lower(contact_email))
  where status <> 'cancelled';

create table if not exists public.admin_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  role text not null check (role in ('super_admin', 'event_admin', 'checkin_staff', 'report_viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, event_id, role)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete restrict,
  provider text not null,
  provider_order_id text unique,
  provider_payment_id text unique,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  event_day smallint not null check (event_day in (1, 2)),
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references auth.users(id),
  unique (registration_id, event_day)
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  event_id uuid references public.events(id) on delete set null,
  actor_id uuid references auth.users(id),
  action text not null check (char_length(action) between 2 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Opaque HMAC subjects only; no raw IP address or email is stored here.
create table if not exists public.registration_rate_limits (
  subject_hash text primary key check (subject_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.event_categories enable row level security;
alter table public.registrations enable row level security;
alter table public.admin_memberships enable row level security;
alter table public.payments enable row level security;
alter table public.attendance enable row level security;
alter table public.audit_events enable row level security;
alter table public.registration_rate_limits enable row level security;

drop policy if exists "published events are public" on public.events;
create policy "published events are public"
  on public.events for select to anon, authenticated
  using (is_published = true);

drop policy if exists "active categories of published events are public" on public.event_categories;
create policy "active categories of published events are public"
  on public.event_categories for select to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.is_published = true
    )
  );

drop policy if exists "admins can read their own membership" on public.admin_memberships;
create policy "admins can read their own membership"
  on public.admin_memberships for select to authenticated
  using (user_id = (select auth.uid()) and is_active = true);

-- Explicit grants are required for newly created tables; RLS remains the row-level boundary.
revoke all on public.events, public.event_categories, public.registrations,
  public.admin_memberships, public.payments, public.attendance, public.audit_events,
  public.registration_rate_limits from public, anon, authenticated;

grant select on public.events, public.event_categories to anon, authenticated;
grant select on public.admin_memberships to authenticated;
grant all on public.events, public.event_categories, public.registrations,
  public.admin_memberships, public.payments, public.attendance, public.audit_events,
  public.registration_rate_limits to service_role;

create or replace function public.consume_registration_rate_limit(
  p_subject_hash text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_subject_hash !~ '^[a-f0-9]{64}$'
     or p_max_requests < 1
     or p_window_seconds < 1 then
    raise exception 'Invalid rate limit parameters' using errcode = '22023';
  end if;

  insert into public.registration_rate_limits (
    subject_hash, window_started_at, request_count, updated_at
  )
  values (p_subject_hash, now(), 1, now())
  on conflict (subject_hash) do update
  set
    window_started_at = case
      when public.registration_rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      then now()
      else public.registration_rate_limits.window_started_at
    end,
    request_count = case
      when public.registration_rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      then 1
      else public.registration_rate_limits.request_count + 1
    end,
    updated_at = now()
  returning request_count into v_count;

  return v_count <= p_max_requests;
end;
$$;

create or replace function public.create_public_registration(
  p_event_slug text,
  p_category_code text,
  p_idempotency_key uuid,
  p_request_hash text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_institution_name text,
  p_team_name text,
  p_member_names text[]
)
returns table (
  registration_id uuid,
  registration_ref text,
  registration_status text,
  created boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_category public.event_categories%rowtype;
  v_existing public.registrations%rowtype;
  v_count integer;
  v_ref text;
  v_members text[] := coalesce(p_member_names, array[]::text[]);
begin
  if p_idempotency_key is null
     or p_request_hash !~ '^[a-f0-9]{64}$'
     or p_event_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or p_category_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or char_length(trim(coalesce(p_contact_name, ''))) not between 2 and 100
     or lower(trim(coalesce(p_contact_email, ''))) !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
     or char_length(trim(coalesce(p_contact_email, ''))) > 254
     or trim(coalesce(p_contact_phone, '')) !~ '^\+?[0-9][0-9 ()-]{6,18}[0-9]$'
     or char_length(trim(coalesce(p_institution_name, ''))) not between 2 and 160
     or cardinality(v_members) > 25
     or exists (select 1 from unnest(v_members) member_name where char_length(trim(member_name)) not between 2 and 100) then
    raise exception 'Registration details are invalid' using errcode = '22023';
  end if;

  select * into v_existing
  from public.registrations r
  where r.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception 'Idempotency key was reused with different details' using errcode = '22023';
    end if;
    return query select v_existing.id, v_existing.registration_ref, v_existing.status, false;
    return;
  end if;

  -- Serialise registrations for this event so event/category capacity cannot be oversubscribed.
  select * into v_event
  from public.events e
  where e.slug = p_event_slug
    and e.is_published = true
    and e.registration_open = true
  for update;

  if not found then
    raise exception 'Registration is closed or event is unavailable' using errcode = 'P0001';
  end if;

  if (v_event.registration_starts_at is not null and now() < v_event.registration_starts_at)
     or (v_event.registration_ends_at is not null and now() > v_event.registration_ends_at) then
    raise exception 'Registration is outside the allowed window' using errcode = 'P0001';
  end if;

  select * into v_category
  from public.event_categories c
  where c.event_id = v_event.id
    and c.code = p_category_code
    and c.is_active = true;

  if not found then
    raise exception 'Selected category is unavailable' using errcode = '22023';
  end if;

  if v_category.registration_mode = 'individual' then
    if cardinality(v_members) <> 0 or nullif(trim(coalesce(p_team_name, '')), '') is not null then
      raise exception 'Individual registration cannot include team details' using errcode = '22023';
    end if;
  else
    if char_length(trim(coalesce(p_team_name, ''))) not between 2 and 100
       or cardinality(v_members) < v_category.min_team_size
       or cardinality(v_members) > v_category.max_team_size then
      raise exception 'Team name or team size is invalid for this category' using errcode = '22023';
    end if;
  end if;

  select count(*) into v_count
  from public.registrations r
  where r.event_id = v_event.id and r.status <> 'cancelled';

  if v_event.capacity is not null and v_count >= v_event.capacity then
    raise exception 'Event capacity has been reached' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.registrations r
  where r.event_id = v_event.id
    and r.category_id = v_category.id
    and r.status <> 'cancelled';

  if v_category.capacity is not null and v_count >= v_category.capacity then
    raise exception 'Category capacity has been reached' using errcode = 'P0001';
  end if;

  v_ref := 'NCC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.registrations (
    event_id, category_id, registration_ref, idempotency_key, request_hash,
    contact_name, contact_email, contact_phone, institution_name, team_name, member_names
  )
  values (
    v_event.id, v_category.id, v_ref, p_idempotency_key, p_request_hash,
    trim(p_contact_name), lower(trim(p_contact_email)), trim(p_contact_phone),
    trim(p_institution_name), nullif(trim(coalesce(p_team_name, '')), ''), v_members
  )
  returning id, registration_ref, status
  into registration_id, registration_ref, registration_status;

  created := true;
  return next;
end;
$$;

-- SECURITY DEFINER functions are not public APIs. Only the server-side secret role may execute them.
revoke all on function public.consume_registration_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.create_public_registration(text, text, uuid, text, text, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.consume_registration_rate_limit(text, integer, integer) to service_role;
grant execute on function public.create_public_registration(text, text, uuid, text, text, text, text, text, text, text[]) to service_role;
