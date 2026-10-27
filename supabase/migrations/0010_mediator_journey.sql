-- BOMOI Mediation Hub — V2, Étape 13 : parcours médiateur (réglages globaux,
-- consentement recherche révocable, dates d'engagement, heures cumulées,
-- attestation imprimable coordinateur-only).
--
-- Renumérotée : la numérotation suggérée par le prompt V2 d'origine
-- (0008_mediator_journey.sql) a été décalée de deux crans par les
-- migrations 0008/0009 déjà utilisées pour des corrections trouvées en
-- cours de route (sélecteur de médiateurs pairs, RLS des idées reçues).
--
-- Report volontaire, signalé à l'utilisateur et accepté par lui avant cette
-- migration : la table `questionnaires` (échelles Likert + questions
-- ouvertes + SUS, vagues « début »/« fin ») n'est PAS créée ici. C'est un
-- instrument de recherche dont le texte exact doit être validé par le
-- comité d'éthique UCT/iCOMMS — l'inventer serait irresponsable. Elle
-- arrivera dans une migration dédiée une fois ce texte reçu, de même que la
-- section « Journal de bord » de l'écran de clôture (Étape 12), dont les 3
-- questions précises n'ont pas non plus été fournies.
--
-- Même ordre de sections que les migrations précédentes :
--   B. Colonnes/tables ajoutées (sans policies)
--   C. Fonction helper (référence app_settings, créée en B)
--   D. Policies (référencent le helper de C)
--   E. Triggers + vue (référencent les tables/policies ci-dessus)

-- =========================================================================
-- B. Colonnes et tables ajoutées
-- =========================================================================

-- app_settings — ligne unique (singleton), réglages globaux activables par
-- un admin (écran /reglages, Étape 14 — pas encore construit : en
-- attendant, un admin peut légitimement activer ce réglage via la console
-- Supabase directement, la policy d'update ci-dessous l'autorise déjà).
create table public.app_settings (
  id boolean primary key default true,
  research_collection_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

comment on table public.app_settings is 'Ligne unique (id=true). research_collection_enabled contrôle l''affichage des écrans de recherche (journal de bord, questionnaires) — reste à false tant que BOMOI n''a pas reçu l''approbation éthique UCT/iCOMMS.';

insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- mediators — dates d'engagement (pour le taux de rétention étudié par
-- iCOMMS), consentement recherche révocable, code pseudonymisé pour les
-- futurs exports (Étape 15), statut d'attestation d'heures.
alter table public.mediators
  add column joined_at timestamptz,
  add column left_at timestamptz,
  add column leave_reason text check (char_length(leave_reason) <= 500),
  add column research_consent_at timestamptz,
  add column research_withdrawn_at timestamptz,
  add column research_code text not null default encode(gen_random_bytes(6), 'hex'),
  add column certificate_status text not null default 'non_genere'
    check (certificate_status in ('non_genere', 'genere')),
  add column certificate_issued_at timestamptz,
  add constraint mediators_research_code_unique unique (research_code),
  add constraint mediators_left_after_joined
    check (left_at is null or joined_at is null or left_at >= joined_at),
  add constraint mediators_certificate_issued_consistency
    check ((certificate_status = 'genere') = (certificate_issued_at is not null));

comment on column public.mediators.joined_at is 'Date d''engagement dans le programme — distincte de created_at (le compte peut être créé avant le premier jour de terrain). Modifiable par coordinateur/admin uniquement (trigger guard_mediator_journey_fields).';
comment on column public.mediators.research_code is 'Pseudonyme opaque, immuable une fois généré (trigger), utilisé pour les exports de recherche (Étape 15) — jamais affiché nulle part comme identifiant de connexion.';
comment on column public.mediators.research_consent_at is 'Consentement recherche distinct du consentement RGPD d''onboarding (mediators.privacy_accepted_at) — facultatif, révocable à tout moment depuis /parcours. Ne peut être renseigné que par le médiateur lui-même (trigger).';
comment on column public.mediators.certificate_status is 'non_genere | genere — bascule uniquement par un coordinateur/admin depuis l''écran attestation (jamais par le médiateur, qui ne peut ni générer ni imprimer sa propre attestation).';

update public.mediators set joined_at = created_at where joined_at is null;

-- sessions — formations/temps collectifs (catalogue, pas de donnée
-- personnelle en soi : label + date + durée). Gestion complète (écran
-- /sessions) prévue à l'Étape 14 ; la table existe dès maintenant pour que
-- v_mediator_hours (section E) compte aussi ces heures-là, pas seulement
-- celles du terrain.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  label text not null check (char_length(label) <= 200),
  duration_minutes integer not null check (duration_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create trigger trg_sessions_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- session_attendance — qui était présent à quelle session (donnée
-- personnelle, contrairement à sessions lui-même).
create table public.session_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  mediator_id uuid not null references public.mediators (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, mediator_id)
);

alter table public.session_attendance enable row level security;

create index idx_session_attendance_mediator on public.session_attendance (mediator_id);

-- =========================================================================
-- C. Fonction helper (référence app_settings, créée en B)
-- =========================================================================

-- Exposition minimale du seul réglage pertinent pour un médiateur, plutôt
-- que d'ouvrir app_settings en lecture à authenticated (même principe que
-- list_active_mediators en 0008 — SECURITY.md §3, 4e instance) : évite de
-- devoir rouvrir une policy de table chaque fois qu'un futur réglage
-- sensible (Étape 14) s'ajoute à côté.
create or replace function public.is_research_collection_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(research_collection_enabled, false) from public.app_settings where id = true;
$$;

-- =========================================================================
-- D. Policies (référencent is_research_collection_enabled, créée en C, et
--    is_coordinator_or_admin, créée en 0001)
-- =========================================================================

create policy app_settings_select on public.app_settings
  for select using (public.is_coordinator_or_admin());

create policy app_settings_update_admin on public.app_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- Catalogue sans donnée personnelle, lisible par tout compte authentifié —
-- même principe que barriers (0001).
create policy sessions_select on public.sessions
  for select using (auth.uid() is not null);

create policy sessions_insert_coordinator on public.sessions
  for insert with check (public.is_coordinator_or_admin());

create policy sessions_update_coordinator on public.sessions
  for update using (public.is_coordinator_or_admin()) with check (public.is_coordinator_or_admin());

create policy sessions_delete_coordinator on public.sessions
  for delete using (public.is_coordinator_or_admin());

create policy session_attendance_select on public.session_attendance
  for select using (mediator_id = auth.uid() or public.is_coordinator_or_admin());

create policy session_attendance_insert_coordinator on public.session_attendance
  for insert with check (public.is_coordinator_or_admin());

create policy session_attendance_update_coordinator on public.session_attendance
  for update using (public.is_coordinator_or_admin()) with check (public.is_coordinator_or_admin());

create policy session_attendance_delete_coordinator on public.session_attendance
  for delete using (public.is_coordinator_or_admin());

-- =========================================================================
-- E. Triggers + vue
-- =========================================================================

-- RLS seule ne peut pas restreindre QUI modifie QUELLE colonne d'une même
-- ligne (même limite que guard_activity_update, 0007) : sans ce trigger,
-- mediators_update_self laisserait un médiateur s'auto-délivrer une
-- attestation ou falsifier sa propre date d'engagement, et
-- mediators_update_coordinator laisserait un coordinateur consentir « à la
-- place » d'un médiateur à la recherche — invalide au sens RGPD (le
-- consentement doit venir du sujet lui-même).
create or replace function public.guard_mediator_journey_fields()
returns trigger
language plpgsql
as $$
begin
  if new.research_code is distinct from old.research_code and old.research_code is not null then
    raise exception 'Le code de recherche ne peut pas être modifié.';
  end if;

  if (
    new.research_consent_at is distinct from old.research_consent_at
    or new.research_withdrawn_at is distinct from old.research_withdrawn_at
  ) and auth.uid() <> old.id then
    raise exception 'Le consentement recherche ne peut être donné ou retiré que par le médiateur lui-même.';
  end if;

  if (
    new.certificate_status is distinct from old.certificate_status
    or new.certificate_issued_at is distinct from old.certificate_issued_at
    or new.joined_at is distinct from old.joined_at
    or new.left_at is distinct from old.left_at
    or new.leave_reason is distinct from old.leave_reason
  ) and not public.is_coordinator_or_admin() then
    raise exception 'Seul un coordinateur ou un administrateur peut modifier ce champ.';
  end if;

  return new;
end;
$$;

create trigger trg_mediators_guard_journey_fields
  before update on public.mediators
  for each row execute function public.guard_mediator_journey_fields();

-- v_mediator_hours — heures de terrain (durée des actions clôturées où le
-- médiateur est participant, créditées en entier à chacun, jamais
-- partagées — décision fonctionnelle V2 n°1) + heures de formation
-- (session_attendance). security_invoker=true : un médiateur qui
-- l'interroge ne voit que sa propre ligne (mediators_select), même si la
-- sous-requête activity_participants est, elle, visible plus largement
-- entre co-participants d'une même action (0007) — la jointure finale sur
-- m.id ne retient que ce que mediators_select autorise pour l'appelant.
create view public.v_mediator_hours with (security_invoker = true) as
select
  m.id as mediator_id,
  coalesce(field_hours.hours, 0) + coalesce(session_hours.hours, 0) as total_hours,
  coalesce(field_hours.hours, 0) as field_hours,
  coalesce(session_hours.hours, 0) as session_hours
from public.mediators m
left join (
  select ap.mediator_id, sum(extract(epoch from (a.ended_at - a.started_at)) / 3600.0) as hours
  from public.activity_participants ap
  join public.activities a on a.id = ap.activity_id
  where a.status = 'cloturee'
    and a.archived_at is null
    and a.started_at is not null
    and a.ended_at is not null
  group by ap.mediator_id
) field_hours on field_hours.mediator_id = m.id
left join (
  select sa.mediator_id, sum(s.duration_minutes) / 60.0 as hours
  from public.session_attendance sa
  join public.sessions s on s.id = sa.session_id
  group by sa.mediator_id
) session_hours on session_hours.mediator_id = m.id;

comment on view public.v_mediator_hours is 'total_hours sert de base à l''attestation (écran coordinateur /attestation) — jamais affiché comme un objectif chiffré individuel (PRD §4.7, pas de gamification).';

-- Leçon de 0005/0006 : revoke explicite puis grant minimal pour chaque
-- fonction/vue créée.
revoke all on function public.is_research_collection_enabled() from public, anon, authenticated;
grant execute on function public.is_research_collection_enabled() to authenticated;

revoke all on public.v_mediator_hours from public, anon, authenticated;
grant select on public.v_mediator_hours to authenticated;
