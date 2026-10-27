-- V2 Étape 11 : l'écran « Démarrer une action » doit proposer les autres
-- médiateurs actifs comme participants potentiels (chips "prénom + initiale
-- du nom"). SECURITY.md §2 documente explicitement qu'un médiateur ne voit
-- que sa propre ligne dans `mediators` (policy mediators_select) — élargir
-- cette policy pour que tout médiateur voie toutes les colonnes de tous les
-- autres (université, langues, disponibilité, et en Étape 13 : statut de
-- consentement recherche, research_code, motif de départ...) violerait
-- cette règle documentée.
--
-- Troisième "élévation de privilège contrôlée" au sens de SECURITY.md §3
-- (les deux premières : set_user_role, invitation d'un médiateur) : une
-- fonction SECURITY DEFINER étroite qui n'expose jamais que id/prénom/nom
-- des médiateurs actifs, rien d'autre, sans toucher à mediators_select.

create or replace function public.list_active_mediators()
returns table (id uuid, first_name text, last_name text)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.first_name, m.last_name
  from public.mediators m
  where m.status = 'actif' and m.archived_at is null and m.id <> auth.uid();
$$;

revoke all on function public.list_active_mediators() from public, anon, authenticated;
grant execute on function public.list_active_mediators() to authenticated;
