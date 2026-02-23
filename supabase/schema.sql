-- Run this in Supabase SQL Editor.
-- It creates the tables used by this app and secure per-user policies.

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  icon text null,
  is_archived boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false
);

create table if not exists public.time_entries (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null default '',
  start_time bigint not null,
  end_time bigint null,
  duration bigint null,
  is_manual boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false
);

create index if not exists projects_user_updated_idx on public.projects (user_id, updated_at desc);
create index if not exists entries_user_updated_idx on public.time_entries (user_id, updated_at desc);
create index if not exists entries_project_idx on public.time_entries (project_id);

alter table public.projects enable row level security;
alter table public.time_entries enable row level security;

drop policy if exists projects_select_own on public.projects;
drop policy if exists projects_insert_own on public.projects;
drop policy if exists projects_update_own on public.projects;
drop policy if exists projects_delete_own on public.projects;

create policy projects_select_own
  on public.projects
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy projects_insert_own
  on public.projects
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy projects_update_own
  on public.projects
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy projects_delete_own
  on public.projects
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists entries_select_own on public.time_entries;
drop policy if exists entries_insert_own on public.time_entries;
drop policy if exists entries_update_own on public.time_entries;
drop policy if exists entries_delete_own on public.time_entries;

create policy entries_select_own
  on public.time_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy entries_insert_own
  on public.time_entries
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and p.user_id = (select auth.uid())
    )
  );

create policy entries_update_own
  on public.time_entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and p.user_id = (select auth.uid())
    )
  );

create policy entries_delete_own
  on public.time_entries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
