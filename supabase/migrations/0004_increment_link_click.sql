-- Incrément atomique du compteur de clics d'un lien court EFS, appelé
-- exclusivement par la route de redirection publique `app/r/[slug]/route.ts`
-- via le client service_role (SECURITY.md : aucune IP n'est jamais lue ni
-- stockée par cette fonction ou par la route qui l'appelle).
--
-- Un UPDATE ... SET click_count = click_count + 1 direct (plutôt qu'un
-- lire-puis-écrire côté application) évite toute perte de clic en cas de
-- clics concurrents sur le même lien.

create or replace function public.increment_link_click(p_slug text)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.link_clicks
  set click_count = click_count + 1, last_clicked_at = now()
  where slug = p_slug and archived_at is null
  returning true;
$$;

revoke all on function public.increment_link_click from public;
grant execute on function public.increment_link_click to service_role;
