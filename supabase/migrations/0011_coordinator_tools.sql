-- BOMOI Mediation Hub — V2, Étape 14 : outils coordinateur (médiathèque,
-- observations de terrain, journal des évolutions de l'outil). Les écrans
-- /sessions (présence) et /collectes (résultats officiels EFS) n'ont besoin
-- d'aucune nouvelle table : sessions/session_attendance existent depuis
-- 0010, aggregate_collection_results depuis 0001 (écran explicitement
-- exclu de l'Étape 9 à la demande de BOMOI, construit seulement ici).
--
-- Renumérotée depuis 0009_coordinator_tools.sql (numérotation suggérée par
-- le prompt V2 d'origine), décalée de deux crans supplémentaires par
-- 0009/0010 déjà utilisées.
--
-- Même ordre de sections que les migrations précédentes : B (tables), D
-- (policies — aucun nouveau helper nécessaire en C, is_coordinator_or_admin
-- et is_admin existent depuis 0001).

-- =========================================================================
-- B. Tables
-- =========================================================================

-- media_log — traçabilité des photos/vidéos prises sur le terrain (projet
-- documentaire « Regards Croisés », besoins de communication BOMOI/EFS).
-- Jamais le fichier lui-même (pas de pipeline de stockage dans ce projet) :
-- juste un lien externe (Drive, etc.) et le consentement obtenu.
create table public.media_log (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities (id) on delete set null,
  media_date date not null,
  media_type text not null check (media_type in ('photo', 'video')),
  description text check (char_length(description) <= 300),
  consent_obtained boolean not null default false,
  external_link text check (char_length(external_link) <= 500),
  created_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.media_log is 'Jamais le fichier média lui-même, seulement sa trace (lien externe) et le consentement obtenu pour son usage (communication/documentaire).';

alter table public.media_log enable row level security;

create trigger trg_media_log_updated_at
  before update on public.media_log
  for each row execute function public.set_updated_at();

-- field_observations — notes qualitatives du coordinateur après une visite
-- de terrain (matière pour le guide de médiation BOMOI et la recherche
-- iCOMMS sur l'adoption de l'outil) — jamais un outil de notation
-- individuelle, jamais visible par le médiateur observé (PRD §4.7 : pas de
-- classement entre médiateurs — même esprit étendu ici par prudence).
create table public.field_observations (
  id uuid primary key default gen_random_uuid(),
  observation_date date not null,
  campus text,
  mediator_id uuid references public.mediators (id) on delete set null,
  activity_id uuid references public.activities (id) on delete set null,
  content text not null check (char_length(content) <= 1000),
  created_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.field_observations is 'Notes internes coordinateur/admin, jamais exposées au médiateur concerné — à ne jamais utiliser pour comparer ou classer les médiateurs entre eux (PRD §4.7).';

alter table public.field_observations enable row level security;

create trigger trg_field_observations_updated_at
  before update on public.field_observations
  for each row execute function public.set_updated_at();

-- tool_changelog — historique des évolutions de l'outil lui-même, lisible
-- par tous (coordinateur ET médiateur) : sert à la fois de transparence
-- envers les médiateurs (l'outil est conçu par BOMOI, pas co-créé — §0 du
-- prompt V2) et de repère temporel pour la recherche iCOMMS sur l'adoption.
create table public.tool_changelog (
  id uuid primary key default gen_random_uuid(),
  release_date date not null,
  title text not null check (char_length(title) <= 200),
  description text check (char_length(description) <= 1000),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tool_changelog enable row level security;

create trigger trg_tool_changelog_updated_at
  before update on public.tool_changelog
  for each row execute function public.set_updated_at();

-- =========================================================================
-- D. Policies
-- =========================================================================

create policy media_log_select on public.media_log
  for select using (public.is_coordinator_or_admin());

create policy media_log_insert on public.media_log
  for insert with check (public.is_coordinator_or_admin() and created_by = auth.uid());

create policy media_log_update on public.media_log
  for update using (public.is_coordinator_or_admin()) with check (public.is_coordinator_or_admin());

create policy media_log_delete_admin on public.media_log
  for delete using (public.is_admin());

create policy field_observations_select on public.field_observations
  for select using (public.is_coordinator_or_admin());

create policy field_observations_insert on public.field_observations
  for insert with check (public.is_coordinator_or_admin() and created_by = auth.uid());

create policy field_observations_update on public.field_observations
  for update using (public.is_coordinator_or_admin()) with check (public.is_coordinator_or_admin());

create policy field_observations_delete_admin on public.field_observations
  for delete using (public.is_admin());

-- Catalogue lisible par tout compte authentifié (aucune donnée personnelle),
-- même principe que barriers/sessions.
create policy tool_changelog_select on public.tool_changelog
  for select using (auth.uid() is not null);

create policy tool_changelog_insert on public.tool_changelog
  for insert with check (public.is_coordinator_or_admin() and created_by = auth.uid());

create policy tool_changelog_update on public.tool_changelog
  for update using (public.is_coordinator_or_admin()) with check (public.is_coordinator_or_admin());

create policy tool_changelog_delete_admin on public.tool_changelog
  for delete using (public.is_admin());
