-- Restaure les privilèges Postgres standard sur le schéma public que
-- Supabase configure automatiquement à la création d'un projet.
--
-- Contexte : un incident de récupération a nécessité un
-- `drop schema public cascade; create schema public;` avant de recoller
-- 0001_init.sql. Le snippet donné à ce moment-là ne restaurait que l'accès
-- au schéma ("grant all on schema public"), pas les privilèges sur les
-- tables elles-mêmes — deux choses distinctes en Postgres. Résultat :
-- "permission denied for table ..." pour anon ET service_role, avant même
-- que RLS n'entre en jeu (RLS ne filtre que les LIGNES parmi ce qu'un rôle
-- peut déjà lire au niveau privilège ; il ne remplace pas le GRANT).
--
-- Vérifié sur Postgres 16 local : reproduit l'erreur avec le snippet
-- incomplet, confirmé que ces GRANT la résolvent (anon → 0 ligne sans
-- erreur car RLS filtre l'anonyme, service_role → toutes les lignes car
-- BYPASSRLS).
--
-- Sans effet sur un projet Supabase qui n'a jamais subi de
-- drop/recreate du schéma public : ces privilèges y sont déjà présents,
-- ces commandes sont idempotentes.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
