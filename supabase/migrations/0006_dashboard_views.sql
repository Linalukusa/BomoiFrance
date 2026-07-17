-- Vues d'agrégation du dashboard coordinateur/admin (PRD §4.8,
-- ARCHITECTURE.md §7 : v_dashboard_impact, v_dashboard_barriers,
-- v_dashboard_campus, v_reliability). Toutes filtrent archived_at IS NULL
-- une fois pour toutes, plutôt que de le répéter dans chaque requête
-- applicative.
--
-- `security_invoker = true` (Postgres 15+) est indispensable : sans cette
-- option, une vue s'exécute avec les droits de son propriétaire (postgres,
-- qui contourne RLS comme tout superutilisateur) — n'importe quel rôle
-- authenticated obtiendrait alors l'agrégat de TOUT le programme en
-- interrogeant directement la vue via PostgREST, y compris un médiateur, ce
-- que le PRD interdit explicitement (« ne peut jamais voir une vue agrégée
-- du programme », §2). Avec security_invoker, les policies RLS des tables
-- sous-jacentes s'appliquent normalement au rôle appelant : un
-- coordinateur/admin voit tout (is_coordinator_or_admin()), un médiateur ne
-- verrait que ses propres lignes agrégées — jamais celles des autres. La
-- page /dashboard reste de toute façon inaccessible à un médiateur seul via
-- le proxy (lib/supabase/middleware.ts) ; ceci est une deuxième ligne de
-- défense en cas d'appel direct à l'API, sur le même principe que la
-- correction apportée en 0005 pour les fonctions.

create or replace view public.v_dashboard_impact
with (security_invoker = true) as
select
  (select count(*) from public.mediators where archived_at is null) as mediators_recruited,
  (select count(*) from public.mediators where archived_at is null and status in ('forme', 'actif')) as mediators_trained,
  (select count(*) from public.mediators where archived_at is null and status = 'actif') as mediators_active,
  (select count(*) from public.activities where archived_at is null) as activities_count,
  (select coalesce(sum(people_reached), 0) from public.activities where archived_at is null) as people_reached,
  (select coalesce(sum(meaningful_conversations), 0) from public.activities where archived_at is null) as meaningful_conversations,
  (select coalesce(sum(interested_people), 0) from public.activities where archived_at is null) as interested_people,
  (select count(*) from public.orientations where archived_at is null) as orientations_count;

-- COUNT(*) groupé par barrier_id, jamais COUNT(DISTINCT activity_id) —
-- comptage par occurrence de catégorie, cf. PRD §4.8 Section 2.
create or replace view public.v_dashboard_barriers
with (security_invoker = true) as
select
  b.id as barrier_id,
  b.label,
  b.sort_order,
  count(ab.id) as occurrences
from public.barriers b
left join public.activity_barriers ab on ab.barrier_id = b.id and ab.archived_at is null
group by b.id, b.label, b.sort_order
order by b.sort_order;

create or replace view public.v_dashboard_campus
with (security_invoker = true) as
select campus, count(*) as activities_count
from public.activities
where archived_at is null
group by campus
order by activities_count desc;

-- Fiabilité des données (PRD §4.8 Section 4) : jamais présenté comme un
-- indicateur d'impact, toujours visuellement séparé côté application.
create or replace view public.v_reliability
with (security_invoker = true) as
select
  (select coalesce(sum(click_count), 0) from public.link_clicks where archived_at is null) as efs_clicks,
  (select count(*) from public.orientations where archived_at is null) as declared_orientations;

-- Comme pour les fonctions (0005) : les `alter default privileges` de
-- 0002_grants.sql accordent tout à anon/authenticated sur toute relation
-- créée ensuite, y compris ces vues. On révoque explicitement puis on ne
-- rouvre que SELECT à authenticated (jamais à anon — ces vues n'ont aucun
-- sens hors session).
revoke all on public.v_dashboard_impact from public, anon, authenticated;
revoke all on public.v_dashboard_barriers from public, anon, authenticated;
revoke all on public.v_dashboard_campus from public, anon, authenticated;
revoke all on public.v_reliability from public, anon, authenticated;

grant select on public.v_dashboard_impact to authenticated;
grant select on public.v_dashboard_barriers to authenticated;
grant select on public.v_dashboard_campus to authenticated;
grant select on public.v_reliability to authenticated;
