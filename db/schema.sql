-- Soberana Network · Member Portal — Etapa 1 schema (C-003 §3)
-- Run FIRST in the Supabase SQL editor. Then policies.sql, seed-public.sql, seed-private.sql.

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type application_status as enum ('received','screening','scoring','committee','decided');
create type gate_result as enum ('pending','pass','fail','na');
create type reviewer_role as enum ('admin','reviewer','readonly');
create type decision_outcome as enum ('advance','conditional','decline','sponsored_route');
create type entity_class as enum ('founding','institutional','sponsored');

-- ---------- tables ----------
create table markets (
  code text primary key,                -- 'CO','MX','BR','US','EC','PE',...
  name text not null,
  rails text[] not null default '{}',
  seat_total int,                       -- seeded privately; null = undisclosed
  seats_allocated int not null default 0,
  live boolean not null default false,
  notes text
);

create sequence application_ref_seq;

create table applications (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  status application_status not null default 'received',
  entity_class entity_class not null default 'founding',
  company text not null,
  website text,
  country_code text references markets(code),
  market_other text,                    -- when country not in the list
  rails_operated text,
  regulator text,
  license_id text,
  operating_role text,
  tpv_band text,
  contact_name text not null,
  contact_email text not null,
  corridors_contribute text,
  corridors_receive text,
  contribution text,
  consent boolean not null default false,
  source text not null default 'portal',   -- 'portal' | 'test'
  created_at timestamptz not null default now(),
  constraint market_present check (country_code is not null or market_other is not null)
);
create index on applications (status);
create index on applications (lower(contact_email));

-- C-001 §4 Stage 0 hard gates
create table application_gates (
  application_id uuid not null references applications(id) on delete cascade,
  gate_code text not null check (gate_code in ('D1_license','D1_funds_flow','D4_sandbox','D5_program','D6_live_flows')),
  result gate_result not null default 'pending',
  note text,
  decided_by uuid,
  decided_at timestamptz,
  primary key (application_id, gate_code)
);

-- weights/bands seeded ONLY via seed-private.sql (never in the public repo)
create table scoring_dimensions (
  code text primary key check (code in ('D2','D3','D5','D6','D7')),
  label text not null,
  weight int not null check (weight > 0),
  band_guide text,
  sort int not null default 0
);

create table application_scores (
  application_id uuid not null references applications(id) on delete cascade,
  dimension_code text not null references scoring_dimensions(code),
  points numeric not null check (points >= 0),
  note text,
  scored_by uuid,
  updated_at timestamptz not null default now(),
  primary key (application_id, dimension_code)
);

create table decisions (
  application_id uuid primary key references applications(id) on delete cascade,
  outcome decision_outcome not null,
  rationale text not null,
  conditions text,                      -- dated remediation plan for 'conditional'
  board_ref text,
  decided_by uuid,
  decided_at timestamptz not null default now()
);

create table pipeline_events (          -- append-only audit log
  id bigint generated always as identity primary key,
  application_id uuid not null references applications(id) on delete cascade,
  actor uuid,
  event text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index on pipeline_events (application_id, created_at);

create table reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role reviewer_role not null default 'reviewer',
  active boolean not null default true
);

-- ---------- helpers ----------
create or replace function is_reviewer() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from reviewers where user_id = auth.uid() and active) $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from reviewers where user_id = auth.uid() and active and role = 'admin') $$;

-- ---------- triggers ----------
create or replace function trg_cap_score() returns trigger
language plpgsql security definer set search_path = public as $$
declare w int;
begin
  select weight into w from scoring_dimensions where code = new.dimension_code;
  if new.points > w then
    raise exception 'points % exceed weight % for %', new.points, w, new.dimension_code;
  end if;
  new.updated_at := now();
  new.scored_by := auth.uid();
  return new;
end $$;
create trigger cap_score before insert or update on application_scores
for each row execute function trg_cap_score();

create or replace function trg_log_gate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.decided_by := auth.uid();
  new.decided_at := now();
  insert into pipeline_events (application_id, actor, event, detail)
  values (new.application_id, auth.uid(), 'gate_' || new.result, new.gate_code || coalesce(': ' || new.note, ''));
  return new;
end $$;
create trigger log_gate before insert or update on application_gates
for each row execute function trg_log_gate();

create or replace function trg_log_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.decided_by := auth.uid();
  update applications set status = 'decided' where id = new.application_id;
  insert into pipeline_events (application_id, actor, event, detail)
  values (new.application_id, auth.uid(), 'decision', new.outcome || ': ' || new.rationale);
  return new;
end $$;
create trigger log_decision before insert on decisions
for each row execute function trg_log_decision();

-- ---------- totals view (C-001 §4 Stage 1–2) ----------
create view v_application_totals
with (security_invoker = true) as
select a.id as application_id,
  (select count(*) from application_gates g where g.application_id = a.id and g.result = 'fail')    as gates_failed,
  (select count(*) from application_gates g where g.application_id = a.id and g.result = 'pending') as gates_pending,
  (select count(*) from application_scores s where s.application_id = a.id)                          as dims_scored,
  (select coalesce(sum(s.points), 0) from application_scores s where s.application_id = a.id)        as total_points,
  (select coalesce(sum(d.weight), 0) from scoring_dimensions d)                                      as max_points,
  case
    when (select count(*) from application_gates g where g.application_id = a.id and g.result in ('fail','pending')) > 0 then null
    when (select count(*) from application_scores s where s.application_id = a.id) < 5 then null
    when (select sum(s.points) from application_scores s where s.application_id = a.id) >= 70 then 'advance'
    when (select sum(s.points) from application_scores s where s.application_id = a.id) >= 50 then 'conditional'
    else 'decline'
  end as band
from applications a;

-- ---------- RPCs ----------
create or replace function submit_application(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(payload->>'contact_email'));
  v_id uuid; v_ref text;
begin
  -- honeypot: silently accept and drop
  if coalesce(payload->>'company_web','') <> '' then
    return jsonb_build_object('ok', true, 'ref', null);
  end if;
  if coalesce(trim(payload->>'company'),'') = '' or coalesce(trim(payload->>'contact_name'),'') = ''
     or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
     or coalesce((payload->>'consent')::boolean, false) is distinct from true
     or (coalesce(payload->>'country_code','') = '' and coalesce(trim(payload->>'market_other'),'') = '') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if (select count(*) from applications
      where lower(contact_email) = v_email and created_at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  v_ref := 'SN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('application_ref_seq')::text, 4, '0');
  insert into applications (ref, entity_class, company, website, country_code, market_other, rails_operated,
    regulator, license_id, operating_role, tpv_band, contact_name, contact_email,
    corridors_contribute, corridors_receive, contribution, consent)
  values (v_ref,
    coalesce(nullif(payload->>'entity_class',''), 'founding')::entity_class,
    trim(payload->>'company'), nullif(trim(payload->>'website'),''),
    nullif(payload->>'country_code',''), nullif(trim(payload->>'market_other'),''),
    nullif(trim(payload->>'rails_operated'),''), nullif(trim(payload->>'regulator'),''),
    nullif(trim(payload->>'license_id'),''), nullif(payload->>'operating_role',''),
    nullif(payload->>'tpv_band',''), trim(payload->>'contact_name'), v_email,
    nullif(trim(payload->>'corridors_contribute'),''), nullif(trim(payload->>'corridors_receive'),''),
    nullif(trim(payload->>'contribution'),''), true)
  returning id into v_id;

  insert into application_gates (application_id, gate_code)
  select v_id, g from unnest(array['D1_license','D1_funds_flow','D4_sandbox','D5_program','D6_live_flows']) g;

  insert into pipeline_events (application_id, actor, event, detail)
  values (v_id, null, 'submitted', 'via portal');

  return jsonb_build_object('ok', true, 'id', v_id, 'ref', v_ref);
end $$;

create or replace function set_application_status(app_id uuid, new_status application_status, note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_status application_status;
begin
  if not is_reviewer() then raise exception 'not_authorized'; end if;
  select status into old_status from applications where id = app_id for update;
  if old_status is null then raise exception 'not_found'; end if;
  update applications set status = new_status where id = app_id;
  insert into pipeline_events (application_id, actor, event, detail)
  values (app_id, auth.uid(), 'status_change', old_status || ' → ' || new_status || coalesce(': ' || note, ''));
end $$;
