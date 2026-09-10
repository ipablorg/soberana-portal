-- Soberana Network · Member Portal — Etapa 1 RLS policies (C-003 §5)
-- Run SECOND, after schema.sql.

alter table markets            enable row level security;
alter table applications       enable row level security;
alter table application_gates  enable row level security;
alter table scoring_dimensions enable row level security;
alter table application_scores enable row level security;
alter table decisions          enable row level security;
alter table pipeline_events    enable row level security;
alter table reviewers          enable row level security;

-- markets: public read; admin write
create policy markets_read  on markets for select to anon, authenticated using (true);
create policy markets_write on markets for all    to authenticated using (is_admin()) with check (is_admin());

-- applications: NO direct insert (RPC only). Applicant reads own; reviewer reads all.
-- No update policy: status changes go through set_application_status (definer).
create policy app_read_own on applications for select to authenticated
  using (lower(contact_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy app_read_reviewer on applications for select to authenticated
  using (is_reviewer());

-- gates / scores: reviewers only
create policy gates_rw on application_gates for all to authenticated
  using (is_reviewer()) with check (is_reviewer());
create policy scores_rw on application_scores for all to authenticated
  using (is_reviewer()) with check (is_reviewer());

-- scoring dimensions: reviewers read; admin write
create policy dims_read  on scoring_dimensions for select to authenticated using (is_reviewer());
create policy dims_write on scoring_dimensions for all    to authenticated using (is_admin()) with check (is_admin());

-- decisions: reviewers read; ADMIN records (C-001 approval chain — Board/committee record)
create policy decisions_read   on decisions for select to authenticated using (is_reviewer());
create policy decisions_insert on decisions for insert to authenticated with check (is_admin());

-- pipeline events: reviewers read + append manual notes; never update/delete
create policy events_read   on pipeline_events for select to authenticated using (is_reviewer());
create policy events_insert on pipeline_events for insert to authenticated with check (is_reviewer());

-- reviewers: own row visible; admin manages
create policy reviewers_read_own on reviewers for select to authenticated using (user_id = auth.uid());
create policy reviewers_admin    on reviewers for all    to authenticated using (is_admin()) with check (is_admin());

-- ---------- function grants ----------
revoke execute on function submit_application(jsonb) from public;
grant  execute on function submit_application(jsonb) to anon, authenticated;

revoke execute on function set_application_status(uuid, application_status, text) from public;
grant  execute on function set_application_status(uuid, application_status, text) to authenticated;

revoke execute on function is_reviewer() from public;
grant  execute on function is_reviewer() to authenticated;
revoke execute on function is_admin() from public;
grant  execute on function is_admin() to authenticated;

-- view: authenticated only (security_invoker → underlying RLS still applies)
revoke all on v_application_totals from anon;
grant select on v_application_totals to authenticated;
