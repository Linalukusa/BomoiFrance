-- BOMOI Mediation Hub — V2, Étape 10 : flux d'action partagée (démarrer /
-- compter / terminer / clôturer), freins par occurrence, idées reçues.
--
-- Additive uniquement : aucune colonne ni table existante supprimée. Les
-- anciennes colonnes (activities.duration/note/support_used, table
-- orientations) restent en base pour l'historique ; l'application cesse
-- simplement de les écrire à partir de cette version.
--
-- Même ordre de sections que 0001_init.sql, pour la même raison (Postgres
-- résout les objets référencés dans le corps d'une fonction à la création,
-- pas seulement à l'exécution) :
--   B. Colonnes/tables ajoutées (sans policies)
--   C. Fonction helper is_activity_participant (référence activity_participants, créée en B)
--   D. Policies (référencent les helpers de C)
--   E. Triggers + fonctions RPC (référencent les tables/policies ci-dessus) + vues

-- =========================================================================
-- B. Colonnes et tables ajoutées
-- =========================================================================

alter table public.activities
  add column status text not null default 'en_cours'
    check (status in ('en_cours', 'a_completer', 'cloturee')),
  add column started_at timestamptz,
  add column ended_at timestamptz,
  add column closed_at timestamptz,
  add column collection_id uuid references public.aggregate_collection_results (id),
  add column orientations_in_person integer not null default 0 check (orientations_in_person >= 0),
  add column orientations_remote integer not null default 0 check (orientations_remote >= 0),
  add column period text check (period in ('cours', 'examens', 'rentree', 'vacances')),
  add column audience text check (audience in ('etudiants', 'personnel', 'mixte', 'grand_public')),
  add column event_context text check (event_context in (
    'aucun', 'collecte_dans_la_semaine', 'journee_mondiale', 'evenement_campus', 'autre'
  )),
  add column supports_used text[] not null default '{}',
  add column worked_well text check (char_length(worked_well) <= 500),
  add column journal_surprise text check (char_length(journal_surprise) <= 500),
  add column journal_quote text check (char_length(journal_quote) <= 300),
  add column journal_learning text check (char_length(journal_learning) <= 500),
  add column media_captured boolean not null default false,
  add column category_version text not null default '2026-11',
  add constraint activities_ended_after_started
    check (ended_at is null or started_at is null or ended_at >= started_at),
  add constraint activities_collection_only_for_presence_collecte
    check (collection_id is null or activity_type = 'presence_collecte');

comment on column public.activities.status is 'en_cours | a_completer | cloturee — flux V2 (démarrer/compter/terminer/clôturer). Les activités créées avant cette migration passent directement à cloturee.';
comment on column public.activities.duration is '@deprecated V2 : remplacé par started_at/ended_at. Conservé pour historique, jamais réécrit depuis la V2.';
comment on column public.activities.note is '@deprecated V2 pour la saisie libre générale : remplacé par worked_well/journal_*. Conservé pour historique, jamais réécrit depuis la V2.';
comment on column public.activities.support_used is '@deprecated V2 : remplacé par supports_used (tableau). Conservé pour historique, jamais réécrit depuis la V2.';
comment on column public.activities.supports_used is 'Remplace support_used (texte libre unique) par un tableau à choix multiple + "Autre" en texte libre dans le tableau — pas de contrainte DB, même raison que l''ancien support_used.';

-- Toutes les activités existant avant cette migration sont des actions déjà
-- terminées au sens V1 (pas de notion "en cours" avant la V2) : elles
-- passent directement au statut final, avec une version de catégories
-- distincte pour les distinguer des données saisies avec le nouveau modèle.
update public.activities
set status = 'cloturee', closed_at = updated_at, category_version = '2026-05';

create index idx_activities_status on public.activities (status);

comment on table public.activities is 'Depuis la V2 : action potentiellement partagée entre plusieurs médiateurs (voir activity_participants). mediator_id reste le créateur, jamais modifiable (trigger guard_activity_update).';

-- activity_participants — médiateurs présents sur une action partagée.
create table public.activity_participants (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  mediator_id uuid not null references public.mediators (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (activity_id, mediator_id)
);

comment on table public.activity_participants is 'Le créateur (activities.mediator_id) y est inséré automatiquement par start_activity(). Permet à plusieurs médiateurs de compter la même action sans double comptage au dashboard.';

alter table public.activity_participants enable row level security;

create index idx_activity_participants_activity on public.activity_participants (activity_id);
create index idx_activity_participants_mediator on public.activity_participants (mediator_id);

alter table public.activity_barriers
  add column occurrences integer not null default 1 check (occurrences >= 1),
  add column category_version text not null default '2026-11';

comment on column public.activity_barriers.occurrences is 'Nombre de fois où ce frein a été entendu sur cette activité (incrémenté via increment_barrier) — remplace le modèle V1 "présent/absent".';

update public.activity_barriers set category_version = '2026-05';

-- activity_misconceptions — idées reçues entendues sur le terrain, courtes,
-- rattachables à une catégorie de frein. Même esprit que activity_barriers :
-- strictement anonyme, jamais de nom/contact/détail de santé (contrôle
-- applicatif sur ce texte libre, comme pour activities.note en V1).
create table public.activity_misconceptions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  mediator_id uuid not null references public.mediators (id) on delete cascade,
  barrier_id uuid references public.barriers (id),
  content text not null check (char_length(content) <= 200),
  category_version text not null default '2026-11',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.activity_misconceptions is 'RÈGLE ABSOLUE (comme orientations) : aucune colonne nom/téléphone/e-mail/identifiant de contact, ici ni ailleurs.';

alter table public.activity_misconceptions enable row level security;

create trigger trg_activity_misconceptions_updated_at
  before update on public.activity_misconceptions
  for each row execute function public.set_updated_at();

create index idx_activity_misconceptions_activity on public.activity_misconceptions (activity_id);

-- =========================================================================
-- C. Fonction helper (référence activity_participants, créée en B) —
--    SECURITY DEFINER + STABLE pour éviter la récursion RLS, même principe
--    que current_role_name() sur profiles (0001_init.sql section C).
-- =========================================================================

create or replace function public.is_activity_participant(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.activity_participants
    where activity_id = p_activity_id and mediator_id = auth.uid()
  );
$$;

-- =========================================================================
-- D. Policies (référencent is_activity_participant, créée en C)
-- =========================================================================

-- activities : une action partagée doit être visible et modifiable par
-- chacun de ses participants, pas seulement par son créateur. L'archivage
-- (voir trigger guard_activity_update en section E) reste réservé au créateur.
drop policy activities_select on public.activities;
create policy activities_select on public.activities
  for select using (
    mediator_id = auth.uid()
    or public.is_activity_participant(id)
    or public.is_coordinator_or_admin()
  );

drop policy activities_update_self on public.activities;
create policy activities_update_self on public.activities
  for update using (
    mediator_id = auth.uid() or public.is_activity_participant(id)
  )
  with check (
    mediator_id = auth.uid() or public.is_activity_participant(id)
  );

-- activity_participants
create policy activity_participants_select on public.activity_participants
  for select using (
    mediator_id = auth.uid()
    or public.is_activity_participant(activity_id)
    or public.is_coordinator_or_admin()
  );

-- Seul le créateur de l'activité ajoute des participants (via start_activity,
-- au démarrage) — pas d'écran pour en ajouter after-the-fact en V2.
create policy activity_participants_insert on public.activity_participants
  for insert with check (
    exists (select 1 from public.activities a where a.id = activity_id and a.mediator_id = auth.uid())
  );

-- activity_barriers : un participant (pas seulement le créateur) doit
-- pouvoir compter un frein entendu sur une action partagée. La ligne est
-- unique par (activity_id, barrier_id), pas par mediator_id — mediator_id
-- n'identifie donc plus que l'auteur du premier tap (dénormalisation
-- informative, cf. commentaire V1), jamais la seule personne autorisée à la
-- modifier ensuite. Le SELECT doit lui aussi être participant-aware : sans
-- ça, increment_barrier() ne peut même pas lire la ligne existante d'un
-- autre participant (son SELECT interne renvoie "aucune ligne", traité à
-- tort comme "rien à décrémenter" — constaté et corrigé pendant la
-- vérification locale de cette étape, cf. rapport de fin d'étape).
drop policy activity_barriers_select on public.activity_barriers;
create policy activity_barriers_select on public.activity_barriers
  for select using (
    mediator_id = auth.uid()
    or public.is_coordinator_or_admin()
    or exists (
      select 1 from public.activities a
      where a.id = activity_id and (a.mediator_id = auth.uid() or public.is_activity_participant(a.id))
    )
  );

drop policy activity_barriers_insert on public.activity_barriers;
create policy activity_barriers_insert on public.activity_barriers
  for insert with check (
    mediator_id = auth.uid()
    and exists (
      select 1 from public.activities a
      where a.id = activity_id and (a.mediator_id = auth.uid() or public.is_activity_participant(a.id))
    )
  );

drop policy activity_barriers_update_self on public.activity_barriers;
create policy activity_barriers_update_self on public.activity_barriers
  for update using (
    exists (
      select 1 from public.activities a
      where a.id = activity_id and (a.mediator_id = auth.uid() or public.is_activity_participant(a.id))
    )
  )
  with check (
    exists (
      select 1 from public.activities a
      where a.id = activity_id and (a.mediator_id = auth.uid() or public.is_activity_participant(a.id))
    )
  );

-- Nouveau en V2 : increment_barrier() doit pouvoir supprimer la ligne quand
-- occurrences retombe à 0 (la contrainte occurrences >= 1 interdit de la
-- mettre à jour à 0). Coexiste avec activity_barriers_delete_admin (policies
-- permissives cumulatives).
create policy activity_barriers_delete_self on public.activity_barriers
  for delete using (
    exists (
      select 1 from public.activities a
      where a.id = activity_id and (a.mediator_id = auth.uid() or public.is_activity_participant(a.id))
    )
  );

-- activity_misconceptions : RLS identique à activity_barriers (y compris le
-- SELECT participant-aware, même raison).
create policy activity_misconceptions_select on public.activity_misconceptions
  for select using (
    mediator_id = auth.uid()
    or public.is_coordinator_or_admin()
    or exists (
      select 1 from public.activities a
      where a.id = activity_id and (a.mediator_id = auth.uid() or public.is_activity_participant(a.id))
    )
  );

create policy activity_misconceptions_insert on public.activity_misconceptions
  for insert with check (
    mediator_id = auth.uid()
    and exists (
      select 1 from public.activities a
      where a.id = activity_id and (a.mediator_id = auth.uid() or public.is_activity_participant(a.id))
    )
  );

create policy activity_misconceptions_update_self on public.activity_misconceptions
  for update using (mediator_id = auth.uid()) with check (mediator_id = auth.uid());

create policy activity_misconceptions_delete_admin on public.activity_misconceptions
  for delete using (public.is_admin());

-- =========================================================================
-- E. Triggers + fonctions RPC (toutes SECURITY INVOKER — défaut non modifié
--    — mediator_id toujours pris de auth.uid(), jamais d'un paramètre
--    client) + mise à jour des vues dashboard.
-- =========================================================================

-- Empêche la réassignation du créateur et l'archivage par un participant,
-- quel que soit le chemin pris (RLS seule ne peut pas comparer OLD/NEW sur
-- une colonne qui n'est pas celle filtrée par la condition elle-même) — même
-- principe que prevent_role_self_change sur profiles (0001_init.sql).
create or replace function public.guard_activity_update()
returns trigger
language plpgsql
as $$
begin
  if new.mediator_id is distinct from old.mediator_id then
    raise exception 'Le créateur d''une activité ne peut pas être modifié.';
  end if;

  if new.archived_at is distinct from old.archived_at and old.mediator_id <> auth.uid() then
    raise exception 'Seul le créateur de l''activité peut l''archiver.';
  end if;

  return new;
end;
$$;

create trigger trg_activities_guard_update
  before update on public.activities
  for each row execute function public.guard_activity_update();

create or replace function public.start_activity(
  p_campus text,
  p_activity_type text,
  p_collection_id uuid default null,
  p_participant_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_activity_id uuid;
  v_participant_id uuid;
begin
  insert into public.activities (
    mediator_id, activity_date, campus, activity_type, status, started_at, collection_id
  ) values (
    auth.uid(), current_date, p_campus, p_activity_type, 'en_cours', now(), p_collection_id
  )
  returning id into v_activity_id;

  insert into public.activity_participants (activity_id, mediator_id)
  values (v_activity_id, auth.uid());

  foreach v_participant_id in array p_participant_ids
  loop
    if v_participant_id is distinct from auth.uid() then
      insert into public.activity_participants (activity_id, mediator_id)
      values (v_activity_id, v_participant_id)
      on conflict (activity_id, mediator_id) do nothing;
    end if;
  end loop;

  return v_activity_id;
end;
$$;

-- Les 5 grands compteurs de l'écran terrain. Reproduit le bornage déjà fait
-- côté client dans ActivityForm.tsx (V1) : si people_reached baisse, les
-- deux compteurs qui en dépendent sont ramenés au même niveau.
create or replace function public.increment_activity_counter(
  p_activity_id uuid,
  p_counter text,
  p_delta integer
)
returns table (
  people_reached integer,
  meaningful_conversations integer,
  interested_people integer,
  orientations_in_person integer,
  orientations_remote integer
)
language plpgsql
set search_path = public
as $$
declare
  v_people_reached integer;
  v_meaningful_conversations integer;
  v_interested_people integer;
  v_orientations_in_person integer;
  v_orientations_remote integer;
begin
  if p_counter not in (
    'people_reached', 'meaningful_conversations', 'interested_people',
    'orientations_in_person', 'orientations_remote'
  ) then
    raise exception 'Compteur invalide: %', p_counter;
  end if;

  select a.people_reached, a.meaningful_conversations, a.interested_people,
         a.orientations_in_person, a.orientations_remote
  into v_people_reached, v_meaningful_conversations, v_interested_people,
       v_orientations_in_person, v_orientations_remote
  from public.activities a
  where a.id = p_activity_id
  for update;

  if not found then
    raise exception 'Activité inconnue ou non autorisée.';
  end if;

  if p_counter = 'people_reached' then
    v_people_reached := greatest(0, v_people_reached + p_delta);
    if v_meaningful_conversations > v_people_reached then
      v_meaningful_conversations := v_people_reached;
    end if;
    if v_interested_people > v_people_reached then
      v_interested_people := v_people_reached;
    end if;
  elsif p_counter = 'meaningful_conversations' then
    v_meaningful_conversations := greatest(0, least(v_people_reached, v_meaningful_conversations + p_delta));
  elsif p_counter = 'interested_people' then
    v_interested_people := greatest(0, least(v_people_reached, v_interested_people + p_delta));
  elsif p_counter = 'orientations_in_person' then
    v_orientations_in_person := greatest(0, v_orientations_in_person + p_delta);
  elsif p_counter = 'orientations_remote' then
    v_orientations_remote := greatest(0, v_orientations_remote + p_delta);
  end if;

  update public.activities
  set people_reached = v_people_reached,
      meaningful_conversations = v_meaningful_conversations,
      interested_people = v_interested_people,
      orientations_in_person = v_orientations_in_person,
      orientations_remote = v_orientations_remote
  where id = p_activity_id;

  if not found then
    raise exception 'Mise à jour non autorisée.';
  end if;

  return query
    select v_people_reached, v_meaningful_conversations, v_interested_people,
           v_orientations_in_person, v_orientations_remote;
end;
$$;

-- Upsert manuel (pas ON CONFLICT ... DO UPDATE) : la contrainte
-- occurrences >= 1 interdirait d'écrire 0, donc le cas "tombe à 0" doit
-- passer par un DELETE plutôt que par une mise à jour invalide.
create or replace function public.increment_barrier(
  p_activity_id uuid,
  p_barrier_id uuid,
  p_delta integer
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_current integer;
  v_new_count integer;
begin
  select occurrences into v_current
  from public.activity_barriers
  where activity_id = p_activity_id and barrier_id = p_barrier_id;

  if v_current is null then
    if p_delta <= 0 then
      return 0;
    end if;

    insert into public.activity_barriers (activity_id, barrier_id, mediator_id, occurrences, category_version)
    values (p_activity_id, p_barrier_id, auth.uid(), p_delta, '2026-11');

    return p_delta;
  end if;

  v_new_count := v_current + p_delta;

  if v_new_count <= 0 then
    delete from public.activity_barriers
    where activity_id = p_activity_id and barrier_id = p_barrier_id;
    return 0;
  end if;

  update public.activity_barriers
  set occurrences = v_new_count
  where activity_id = p_activity_id and barrier_id = p_barrier_id;

  if not found then
    raise exception 'Mise à jour non autorisée.';
  end if;

  return v_new_count;
end;
$$;

create or replace function public.end_activity(p_activity_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.activities
  set ended_at = now(), status = 'a_completer'
  where id = p_activity_id;

  if not found then
    raise exception 'Activité inconnue ou non autorisée.';
  end if;
end;
$$;

-- Ne bloque jamais sur un champ facultatif vide : aucune validation de
-- complétude ici, uniquement le changement de statut/horodatage.
create or replace function public.close_activity(p_activity_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.activities
  set closed_at = now(), status = 'cloturee'
  where id = p_activity_id;

  if not found then
    raise exception 'Activité inconnue ou non autorisée.';
  end if;
end;
$$;

-- create_activity_with_orientations n'est plus utilisée côté application
-- (remplacée par start_activity + increment_activity_counter) mais n'est
-- pas supprimée (données/historique). Revoke de authenticated uniquement :
-- anon l'avait déjà perdu en 0005.
revoke execute on function public.create_activity_with_orientations(
  date, text, text, integer, integer, integer, text, text, text, jsonb
) from authenticated;

-- Leçon de 0005/0006 : les `alter default privileges` de 0002_grants.sql
-- rouvrent l'accès à anon/authenticated sur CHAQUE fonction créée ensuite —
-- revoke explicite puis grant minimal pour chacune des fonctions ci-dessus.
-- is_activity_participant reste accessible à authenticated (nécessaire pour
-- que les policies RLS ci-dessus s'évaluent côté client), mais jamais à anon.
revoke all on function public.is_activity_participant(uuid) from public, anon, authenticated;
grant execute on function public.is_activity_participant(uuid) to authenticated;

revoke all on function public.start_activity(text, text, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.start_activity(text, text, uuid, uuid[]) to authenticated;

revoke all on function public.increment_activity_counter(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.increment_activity_counter(uuid, text, integer) to authenticated;

revoke all on function public.increment_barrier(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_barrier(uuid, uuid, integer) to authenticated;

revoke all on function public.end_activity(uuid) from public, anon, authenticated;
grant execute on function public.end_activity(uuid) to authenticated;

revoke all on function public.close_activity(uuid) from public, anon, authenticated;
grant execute on function public.close_activity(uuid) to authenticated;

-- Vues dashboard : orientations_count/declared_orientations additionnent
-- désormais les compteurs V2 (activities.orientations_in_person/_remote) et
-- l'historique V1 (table orientations, jamais vidée). occurrences devient
-- une somme (plusieurs occurrences par ligne) plutôt qu'un COUNT(*) de
-- lignes. Les indicateurs d'impact (et, par cohérence, la répartition par
-- campus) excluent désormais les actions encore en_cours : leurs chiffres
-- ne sont pas définitifs. CREATE OR REPLACE VIEW conserve les GRANT déjà
-- posés en 0006 (security_invoker=true, revoke anon, select authenticated) :
-- pas besoin de les reposer ici.
create or replace view public.v_dashboard_impact
with (security_invoker = true) as
select
  (select count(*) from public.mediators where archived_at is null) as mediators_recruited,
  (select count(*) from public.mediators where archived_at is null and status in ('forme', 'actif')) as mediators_trained,
  (select count(*) from public.mediators where archived_at is null and status = 'actif') as mediators_active,
  (select count(*) from public.activities where archived_at is null and status <> 'en_cours') as activities_count,
  (select coalesce(sum(people_reached), 0) from public.activities where archived_at is null and status <> 'en_cours') as people_reached,
  (select coalesce(sum(meaningful_conversations), 0) from public.activities where archived_at is null and status <> 'en_cours') as meaningful_conversations,
  (select coalesce(sum(interested_people), 0) from public.activities where archived_at is null and status <> 'en_cours') as interested_people,
  (
    (select coalesce(sum(orientations_in_person + orientations_remote), 0)
       from public.activities where archived_at is null and status <> 'en_cours')
    +
    (select count(*) from public.orientations where archived_at is null)
  ) as orientations_count;

create or replace view public.v_dashboard_barriers
with (security_invoker = true) as
select
  b.id as barrier_id,
  b.label,
  b.sort_order,
  coalesce(sum(ab.occurrences), 0) as occurrences
from public.barriers b
left join public.activity_barriers ab on ab.barrier_id = b.id and ab.archived_at is null
group by b.id, b.label, b.sort_order
order by b.sort_order;

create or replace view public.v_dashboard_campus
with (security_invoker = true) as
select campus, count(*) as activities_count
from public.activities
where archived_at is null and status <> 'en_cours'
group by campus
order by activities_count desc;

create or replace view public.v_reliability
with (security_invoker = true) as
select
  (select coalesce(sum(click_count), 0) from public.link_clicks where archived_at is null) as efs_clicks,
  (
    (select coalesce(sum(orientations_in_person + orientations_remote), 0)
       from public.activities where archived_at is null and status <> 'en_cours')
    +
    (select count(*) from public.orientations where archived_at is null)
  ) as declared_orientations;
