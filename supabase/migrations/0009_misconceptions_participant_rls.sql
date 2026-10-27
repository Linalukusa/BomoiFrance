-- Corrige un oubli dans 0007_v2_activity_flow.sql, trouvé en préparant
-- l'écran de clôture (Étape 12) : activity_misconceptions_update_self
-- n'avait pas reçu le même traitement participant-aware que
-- activity_barriers_update_self, alors que le commentaire de 0007 disait
-- explicitement "RLS identique à activity_barriers". Conséquence concrète :
-- un participant qui n'est pas l'auteur d'une idée reçue ne pourrait jamais
-- la retirer (archived_at) lors de la clôture d'une action partagée.
--
-- Pas de policy delete_self ajoutée : le retrait se fait par archivage
-- (UPDATE archived_at), jamais par DELETE réel côté médiateur — même
-- principe que partout ailleurs dans le schéma.

drop policy activity_misconceptions_update_self on public.activity_misconceptions;

create policy activity_misconceptions_update_self on public.activity_misconceptions
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
