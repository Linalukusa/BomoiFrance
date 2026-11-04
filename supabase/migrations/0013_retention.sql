-- BOMOI Mediation Hub — V2, Étape 16 : rétention et anonymisation.
--
-- Renumérotée depuis une numérotation V2 non explicitement suggérée par le
-- prompt d'origine pour cette partie (purge_expired_data()), placée après
-- 0012_usage_metrics.sql.
--
-- Périmètre volontairement restreint à la SEULE règle déjà confirmée et
-- sans ambiguïté (PRODUCT_REQUIREMENTS.md §6.3, SECURITY.md §6) :
-- anonymiser un compte médiateur inactif depuis 12 mois. Tout le reste
-- (purge des activités après « durée du programme + 3 ans ») dépend d'une
-- date de fin de programme que BOMOI n'a pas encore communiquée — écrire
-- une fonction qui supprimerait des lignes sur la base d'une date inventée
-- serait dangereux. Cette fonction-là reste à écrire une fois cette date
-- connue (voir DEVELOPMENT_PLAN.md, Étape 16).

alter table public.mediators
  add column anonymized_at timestamptz;

comment on column public.mediators.anonymized_at is 'Renseigné par purge_inactive_mediators() — une fois posé, first_name/last_name ne portent plus l''identité d''origine.';

-- SECURITY DEFINER : même famille que set_user_role (contrôle qui peut
-- déclencher une opération sensible plutôt qu'élargir une policy RLS).
-- is_admin() est revérifié ICI, pas seulement supposé par l'appelant — un
-- coordinateur pourrait techniquement obtenir le même résultat ligne par
-- ligne via mediators_update_coordinator, mais seul un admin peut
-- déclencher l'opération groupée.
create or replace function public.purge_inactive_mediators()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Réservé à l''administrateur.';
  end if;

  with anonymized as (
    update public.mediators
    set first_name = 'Médiateur',
        last_name = 'anonymisé',
        languages = '{}',
        availability = null,
        anonymized_at = now()
    where status = 'inactif'
      and left_at is not null
      and left_at < now() - interval '12 months'
      and anonymized_at is null
    returning id
  )
  select count(*) into v_count from anonymized;

  return v_count;
end;
$$;

comment on function public.purge_inactive_mediators() is 'Anonymise prénom/nom/langues/disponibilité des comptes inactifs depuis 12 mois (PRODUCT_REQUIREMENTS.md §6.3) — jamais automatique, déclenchée manuellement par un admin (/reglages). N''efface jamais research_code (pseudonyme opaque, pas une donnée identifiante) ni les activités déjà anonymes par construction.';

revoke all on function public.purge_inactive_mediators() from public, anon, authenticated;
grant execute on function public.purge_inactive_mediators() to authenticated;
