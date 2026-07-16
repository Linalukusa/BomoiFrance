-- BOMOI Mediation Hub — schéma initial
-- Toutes les tables exposées ont RLS activée dans cette même migration (aucune fenêtre non protégée).
-- UUID partout, created_at/updated_at systématiques, archived_at pour le soft delete côté médiateur.
--
-- ORDRE DU FICHIER (important, ne pas réorganiser sans y réfléchir) :
--   A. Extension + fonction utilitaire générique (aucune dépendance de table)
--   B. Toutes les tables (dans l'ordre de leurs dépendances de clé étrangère),
--      chacune avec RLS activée, son trigger updated_at, ses index et sa seed
--      éventuelle — mais SANS policies et SANS fonction qui référence une
--      autre table.
--   C. Fonctions "helper" de rôle (current_role_name/is_admin/is_coordinator_or_admin) :
--      elles référencent public.profiles, qui doit donc déjà exister.
--   D. Policies RLS de toutes les tables : elles référencent les fonctions de C
--      et parfois d'autres tables (EXISTS ...), qui doivent donc déjà exister.
--   E. Fonctions privilégiées (SECURITY DEFINER) et les triggers qui en dépendent :
--      set_user_role() référence audit_logs, get_or_create_efs_link() référence
--      link_clicks/activities, log_hard_delete() référence audit_logs — toutes
--      doivent donc être définies après B (tables) et C (helpers).
--
-- Raison : Postgres résout les objets référencés dans le corps d'une fonction
-- "language sql" au moment du CREATE FUNCTION (pas seulement à l'exécution), et
-- le compilateur PL/pgSQL fait de même dès qu'une requête a une cible typée
-- (ex. SELECT ... INTO). Une fonction qui référence une table pas encore créée
-- fait donc échouer la migration immédiatement, même si la table est créée plus
-- bas dans le même fichier.

-- =========================================================================
-- A. Extension + fonction utilitaire générique
-- =========================================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- B. Tables (ordre de dépendance des clés étrangères)
-- =========================================================================

-- profiles — identité + rôle. Une ligne par utilisateur Supabase Auth.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'mediator' check (role in ('mediator', 'coordinator', 'admin')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Identité + rôle. Le rôle ne doit jamais être modifié directement par le client : passer par la fonction public.set_user_role (admin uniquement).';

alter table public.profiles enable row level security;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- mediators — fiche médiateur (1-1 avec profiles pour role='mediator')
create table public.mediators (
  id uuid primary key references public.profiles (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  university text not null,
  languages text[] not null default '{}',
  status text not null default 'candidat'
    check (status in ('candidat', 'selectionne', 'forme', 'actif', 'inactif')),
  availability text,
  charter_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.mediators.status is 'candidat | selectionne | forme | actif | inactif';
comment on column public.mediators.archived_at is 'Anonymisation prévue 12 mois après passage à inactif (purge planifiée hors périmètre de cette migration).';

alter table public.mediators enable row level security;

create trigger trg_mediators_updated_at
  before update on public.mediators
  for each row execute function public.set_updated_at();

-- activities
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  mediator_id uuid not null references public.mediators (id) on delete cascade,
  activity_date date not null,
  campus text not null,
  activity_type text not null check (activity_type in (
    'conversation_individuelle', 'petit_groupe', 'atelier', 'stand',
    'reunion_associative', 'whatsapp', 'reseaux_sociaux', 'evenement', 'presence_collecte'
  )),
  people_reached integer not null default 0 check (people_reached >= 0),
  meaningful_conversations integer not null default 0
    check (meaningful_conversations >= 0 and meaningful_conversations <= people_reached),
  interested_people integer not null default 0
    check (interested_people >= 0 and interested_people <= people_reached),
  support_used text,
  duration text check (duration in ('15min', '30min', '45min', '1h', '1h30', '2h_plus')),
  note text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.activities.support_used is 'Texte libre. Suggestions verrouillées côté UI (chips + Autre) : flyer, affiche, brochure, vidéo, carte-réponse, lien EFS, aucun, autre. Pas de contrainte DB pour permettre la saisie libre via "Autre".';
comment on column public.activities.note is 'Note libre anonyme — ne doit jamais contenir de nom, contact ou donnée médicale (contrôle applicatif, pas de contrainte DB possible sur du texte libre).';

alter table public.activities enable row level security;

create trigger trg_activities_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

create index idx_activities_mediator on public.activities (mediator_id);
create index idx_activities_date on public.activities (activity_date);

-- aggregate_collection_results — sert aussi de référentiel des collectes
-- (créé à l'avance par l'admin, résultats renseignés après coup)
create table public.aggregate_collection_results (
  id uuid primary key default gen_random_uuid(),
  collection_date date not null,
  location text not null,
  donors_count integer check (donors_count >= 0),
  first_time_donors_count integer check (first_time_donors_count >= 0),
  notes text,
  entered_by uuid references public.profiles (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.aggregate_collection_results is 'Une ligne par collecte. Créée par un admin avant la collecte (donors_count/first_time_donors_count = NULL), complétée après retour officiel EFS. Jamais déduite ou estimée par l''application.';

alter table public.aggregate_collection_results enable row level security;

create trigger trg_collections_updated_at
  before update on public.aggregate_collection_results
  for each row execute function public.set_updated_at();

-- orientations — RÈGLE ABSOLUE : jamais de nom/téléphone/e-mail/identifiant de contact.
create table public.orientations (
  id uuid primary key default gen_random_uuid(),
  mediator_id uuid not null references public.mediators (id) on delete cascade,
  activity_id uuid references public.activities (id) on delete set null,
  collection_id uuid references public.aggregate_collection_results (id),
  orientation_date date not null,
  channel text not null check (channel in ('en_personne', 'whatsapp', 'reseaux_sociaux', 'telephone', 'autre')),
  status text not null check (status in (
    'information_transmise', 'lien_efs_partage', 'interesse', 'presence_confirmee'
  )),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orientations is 'RÈGLE ABSOLUE : aucune colonne nom/téléphone/e-mail/identifiant de contact, ici ni ailleurs. Voir SECURITY.md.';

alter table public.orientations enable row level security;

create trigger trg_orientations_updated_at
  before update on public.orientations
  for each row execute function public.set_updated_at();

create index idx_orientations_mediator on public.orientations (mediator_id);
create index idx_orientations_activity on public.orientations (activity_id);

-- barriers — catalogue fixe (11 catégories + Autre), lecture seule pour les médiateurs
create table public.barriers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.barriers enable row level security;

create trigger trg_barriers_updated_at
  before update on public.barriers
  for each row execute function public.set_updated_at();

insert into public.barriers (code, label, sort_order) values
  ('manque_information', 'Manque d''information', 1),
  ('peurs', 'Peurs', 2),
  ('croyances_idees_recues', 'Croyances et idées reçues', 3),
  ('manque_confiance', 'Manque de confiance', 4),
  ('sante_eligibilite', 'Santé ou éligibilité', 5),
  ('disponibilite', 'Disponibilité', 6),
  ('motivation', 'Motivation', 7),
  ('experience_precedente', 'Expérience précédente', 8),
  ('communication', 'Communication', 9),
  ('representation', 'Représentation', 10),
  ('autre', 'Autre', 11);

-- activity_barriers — liaison many-to-many activité <-> frein
create table public.activity_barriers (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  barrier_id uuid not null references public.barriers (id),
  mediator_id uuid not null references public.mediators (id) on delete cascade,
  note text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, barrier_id)
);

comment on column public.activity_barriers.mediator_id is 'Dénormalisé depuis activities.mediator_id pour simplifier les policies RLS et les index.';

alter table public.activity_barriers enable row level security;

create trigger trg_activity_barriers_updated_at
  before update on public.activity_barriers
  for each row execute function public.set_updated_at();

create index idx_activity_barriers_activity on public.activity_barriers (activity_id);
create index idx_activity_barriers_barrier on public.activity_barriers (barrier_id);

-- link_clicks — registre des liens courts EFS + compteur (pas de ligne par clic, pas d'IP)
create table public.link_clicks (
  id uuid primary key default gen_random_uuid(),
  mediator_id uuid not null references public.mediators (id) on delete cascade,
  activity_id uuid references public.activities (id) on delete set null,
  slug text not null unique,
  click_count integer not null default 0 check (click_count >= 0),
  last_clicked_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.link_clicks is 'Un enregistrement par lien généré (registre + compteur), pas un enregistrement par clic. Aucune IP stockée : voir SECURITY.md pour l''anti-bot en mémoire côté Edge.';

alter table public.link_clicks enable row level security;

create trigger trg_link_clicks_updated_at
  before update on public.link_clicks
  for each row execute function public.set_updated_at();

create index idx_link_clicks_mediator on public.link_clicks (mediator_id);

-- audit_logs — traçabilité (changements de rôle, suppressions définitives)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Écriture uniquement via triggers/fonctions SECURITY DEFINER. Ne doit jamais contenir de donnée personnelle sur une personne sensibilisée/orientée (il n''en existe aucune dans le système).';

alter table public.audit_logs enable row level security;

-- =========================================================================
-- C. Fonctions helper de rôle (référencent public.profiles, créée en B)
-- =========================================================================

-- Lecture du rôle de l'utilisateur courant. STABLE + SECURITY DEFINER pour être
-- utilisable dans les policies RLS sans re-déclencher RLS sur profiles (évite la récursion).
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role_name() = 'admin';
$$;

create or replace function public.is_coordinator_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role_name() in ('coordinator', 'admin');
$$;

-- =========================================================================
-- D. Policies RLS (référencent les fonctions de C et les tables de B)
-- =========================================================================

-- profiles
-- Un utilisateur voit son propre profil ; coordinator/admin voient tous les profils.
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_coordinator_or_admin());

-- Un utilisateur peut modifier son propre profil, mais jamais sa colonne role
-- (contrôlé par le trigger prevent_role_self_change en section E, pas seulement par la policy).
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_update_admin on public.profiles
  for update using (public.is_admin()) with check (true);

create policy profiles_delete_admin on public.profiles
  for delete using (public.is_admin());

-- mediators
create policy mediators_select on public.mediators
  for select using (id = auth.uid() or public.is_coordinator_or_admin());

create policy mediators_insert on public.mediators
  for insert with check (public.is_coordinator_or_admin());

create policy mediators_update_self on public.mediators
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy mediators_update_coordinator on public.mediators
  for update using (public.is_coordinator_or_admin()) with check (public.is_coordinator_or_admin());

create policy mediators_delete_admin on public.mediators
  for delete using (public.is_admin());

-- activities
create policy activities_select on public.activities
  for select using (mediator_id = auth.uid() or public.is_coordinator_or_admin());

create policy activities_insert on public.activities
  for insert with check (mediator_id = auth.uid());

-- Le médiateur peut modifier ses propres activités (y compris les archiver via archived_at),
-- mais jamais changer le mediator_id (transfert d'activité interdit).
create policy activities_update_self on public.activities
  for update using (mediator_id = auth.uid()) with check (mediator_id = auth.uid());

create policy activities_delete_admin on public.activities
  for delete using (public.is_admin());

-- aggregate_collection_results
-- Lecture ouverte à tout utilisateur authentifié (mediator inclus, pour choisir
-- la collecte concernée dans le formulaire d'orientation).
create policy collections_select on public.aggregate_collection_results
  for select using (auth.uid() is not null);

create policy collections_write_admin on public.aggregate_collection_results
  for insert with check (public.is_admin());

create policy collections_update_admin on public.aggregate_collection_results
  for update using (public.is_admin()) with check (public.is_admin());

create policy collections_delete_admin on public.aggregate_collection_results
  for delete using (public.is_admin());

-- orientations
create policy orientations_select on public.orientations
  for select using (mediator_id = auth.uid() or public.is_coordinator_or_admin());

create policy orientations_insert on public.orientations
  for insert with check (
    mediator_id = auth.uid()
    and (activity_id is null or exists (
      select 1 from public.activities a where a.id = activity_id and a.mediator_id = auth.uid()
    ))
  );

create policy orientations_update_self on public.orientations
  for update using (mediator_id = auth.uid()) with check (mediator_id = auth.uid());

create policy orientations_delete_admin on public.orientations
  for delete using (public.is_admin());

-- barriers
create policy barriers_select on public.barriers
  for select using (auth.uid() is not null);

create policy barriers_write_admin on public.barriers
  for all using (public.is_admin()) with check (public.is_admin());

-- activity_barriers
create policy activity_barriers_select on public.activity_barriers
  for select using (mediator_id = auth.uid() or public.is_coordinator_or_admin());

create policy activity_barriers_insert on public.activity_barriers
  for insert with check (
    mediator_id = auth.uid()
    and exists (select 1 from public.activities a where a.id = activity_id and a.mediator_id = auth.uid())
  );

create policy activity_barriers_update_self on public.activity_barriers
  for update using (mediator_id = auth.uid()) with check (mediator_id = auth.uid());

create policy activity_barriers_delete_admin on public.activity_barriers
  for delete using (public.is_admin());

-- link_clicks
-- Aucune policy INSERT/UPDATE pour mediator/coordinator : la génération du lien passe
-- exclusivement par la fonction get_or_create_efs_link (SECURITY DEFINER, section E) et
-- l'incrément du compteur par la route de redirection (service_role, hors RLS par nature).
create policy link_clicks_select on public.link_clicks
  for select using (mediator_id = auth.uid() or public.is_coordinator_or_admin());

create policy link_clicks_delete_admin on public.link_clicks
  for delete using (public.is_admin());

-- audit_logs
create policy audit_logs_select_admin on public.audit_logs
  for select using (public.is_admin());

-- Pas de policy insert/update/delete ouverte : toute écriture passe par des fonctions
-- SECURITY DEFINER (set_user_role, log_hard_delete, section E) qui contournent RLS par conception.

-- =========================================================================
-- E. Fonctions privilégiées (SECURITY DEFINER) et triggers associés
--    (référencent audit_logs et/ou is_admin(), tous deux définis plus haut)
-- =========================================================================

-- Empêche toute modification de `role` hors de la fonction set_user_role.
create or replace function public.prevent_role_self_change()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier un rôle (utiliser public.set_user_role).';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_self_change();

-- Fonction dédiée au changement de rôle, seule voie autorisée, avec journal d'audit.
create or replace function public.set_user_role(p_user_id uuid, p_new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_role text;
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier un rôle.';
  end if;
  if p_new_role not in ('mediator', 'coordinator', 'admin') then
    raise exception 'Rôle invalide: %', p_new_role;
  end if;

  select role into v_old_role from public.profiles where id = p_user_id;

  update public.profiles set role = p_new_role where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'role_change', 'profiles', p_user_id,
          jsonb_build_object('old_role', v_old_role, 'new_role', p_new_role));
end;
$$;

create or replace function public.get_or_create_efs_link(p_activity_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  if p_activity_id is not null and not exists (
    select 1 from public.activities where id = p_activity_id and mediator_id = auth.uid()
  ) then
    raise exception 'Activité inconnue ou non autorisée.';
  end if;

  select slug into v_slug from public.link_clicks
    where mediator_id = auth.uid()
      and activity_id is not distinct from p_activity_id
      and archived_at is null;

  if v_slug is not null then
    return v_slug;
  end if;

  v_slug := encode(gen_random_bytes(6), 'base64');
  v_slug := regexp_replace(v_slug, '[^a-zA-Z0-9]', '', 'g');
  v_slug := left(v_slug, 8);

  insert into public.link_clicks (mediator_id, activity_id, slug)
  values (auth.uid(), p_activity_id, v_slug);

  return v_slug;
end;
$$;

create or replace function public.log_hard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'hard_delete', TG_TABLE_NAME, old.id, to_jsonb(old));
  return old;
end;
$$;

create trigger trg_log_delete_mediators
  before delete on public.mediators
  for each row execute function public.log_hard_delete();

create trigger trg_log_delete_activities
  before delete on public.activities
  for each row execute function public.log_hard_delete();

create trigger trg_log_delete_orientations
  before delete on public.orientations
  for each row execute function public.log_hard_delete();

create trigger trg_log_delete_activity_barriers
  before delete on public.activity_barriers
  for each row execute function public.log_hard_delete();

create trigger trg_log_delete_profiles
  before delete on public.profiles
  for each row execute function public.log_hard_delete();
