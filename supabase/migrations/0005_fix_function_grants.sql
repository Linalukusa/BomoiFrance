-- Corrige un écart introduit par 0002_grants.sql : son
-- `alter default privileges in schema public grant all on routines to anon,
-- authenticated, service_role` accorde EXECUTE à anon ET authenticated sur
-- CHAQUE fonction créée ensuite par le même rôle — y compris
-- create_activity_with_orientations (0003) et increment_link_click (0004).
--
-- Leur `revoke all on function ... from public` respectif ne suffisait pas à
-- l'annuler : REVOKE ... FROM PUBLIC ne retire que le droit accordé au
-- pseudo-rôle PUBLIC, jamais un droit accordé nommément à un rôle (anon,
-- authenticated) — les deux sont des droits distincts en Postgres. Constaté
-- en local (has_function_privilege) : anon pouvait exécuter les deux
-- fonctions malgré les GRANT ciblés qui suivaient leur création.
--
-- À partir de maintenant, toute fonction dont l'accès doit être restreint
-- doit être suivie d'un REVOKE explicite sur les rôles nommés à exclure, pas
-- seulement `... FROM PUBLIC`.

revoke execute on function public.create_activity_with_orientations(
  date, text, text, integer, integer, integer, text, text, text, jsonb
) from anon;

revoke execute on function public.increment_link_click(text) from anon, authenticated;
