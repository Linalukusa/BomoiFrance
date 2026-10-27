-- BOMOI Mediation Hub — V2, Étape 15 : vue de métriques d'usage pour la
-- recherche iCOMMS sur l'adoption de l'outil par les médiateurs.
--
-- Renumérotée depuis 0010_research.sql (numérotation suggérée par le
-- prompt V2 d'origine), décalée de deux crans par 0010/0011 déjà utilisées.
--
-- security_invoker = true, même raisonnement de non-fuite que
-- v_mediator_hours (0010) : un médiateur qui l'interroge ne voit jamais
-- que sa propre ligne (mediators_select), quoi que les sous-requêtes
-- voient par ailleurs chez un co-participant d'action partagée.

create view public.v_usage_metrics with (security_invoker = true) as
select
  m.id as mediator_id,
  coalesce(started.count, 0) as activities_started,
  coalesce(participated.count, 0) as activities_participated,
  coalesce(closed.count, 0) as activities_closed,
  closed.avg_closure_hours,
  coalesce(shared.count, 0) as shared_activities_count,
  coalesce(misconceptions.count, 0) as misconceptions_logged,
  coalesce(sessions.count, 0) as sessions_attended
from public.mediators m
left join (
  select mediator_id, count(*) as count
  from public.activities
  group by mediator_id
) started on started.mediator_id = m.id
left join (
  select ap.mediator_id, count(*) as count
  from public.activity_participants ap
  group by ap.mediator_id
) participated on participated.mediator_id = m.id
left join (
  select mediator_id, count(*) as count,
         avg(extract(epoch from (closed_at - started_at)) / 3600.0) as avg_closure_hours
  from public.activities
  where status = 'cloturee' and started_at is not null and closed_at is not null
  group by mediator_id
) closed on closed.mediator_id = m.id
left join (
  select ap.mediator_id, count(*) as count
  from public.activity_participants ap
  join (
    select activity_id, count(*) as participant_count
    from public.activity_participants
    group by activity_id
  ) pc on pc.activity_id = ap.activity_id
  where pc.participant_count > 1
  group by ap.mediator_id
) shared on shared.mediator_id = m.id
left join (
  select mediator_id, count(*) as count
  from public.activity_misconceptions
  group by mediator_id
) misconceptions on misconceptions.mediator_id = m.id
left join (
  select mediator_id, count(*) as count
  from public.session_attendance
  group by mediator_id
) sessions on sessions.mediator_id = m.id;

comment on view public.v_usage_metrics is 'Signaux d''adoption de l''outil (fréquence d''usage des écrans démarrer/terrain/clôture, pas de performance de médiation) — jamais affichés comme un objectif chiffré individuel. Consommée uniquement par la route d''export pseudonymisé (app/api/export/[dataset]/route.ts, Étape 15).';

-- Leçon de 0005/0006 : revoke explicite puis grant minimal.
revoke all on public.v_usage_metrics from public, anon, authenticated;
grant select on public.v_usage_metrics to authenticated;
