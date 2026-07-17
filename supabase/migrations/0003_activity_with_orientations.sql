-- RPC transactionnelle : crée une activité et, le cas échéant, les
-- orientations saisies dans le même flux avant l'enregistrement final
-- (PRD §4.2 : « compteur visible + bouton + Ajouter une orientation dans le
-- flux, avant l'enregistrement final »). supabase-js n'expose pas d'API de
-- transaction multi-tables côté client : sans cette fonction, l'activité et
-- ses orientations seraient deux appels séparés, avec un risque d'activité
-- orpheline si le second échoue.
--
-- SECURITY INVOKER (par défaut, non modifié ici) : la fonction s'exécute
-- avec les droits de l'appelant, donc les policies RLS de activities et
-- orientations s'appliquent normalement à chaque INSERT — ce n'est pas une
-- élévation de privilège, juste un regroupement transactionnel. mediator_id
-- est pris de auth.uid() côté serveur, jamais d'un paramètre client : un
-- appelant ne peut techniquement pas créer une entrée pour quelqu'un d'autre.

create or replace function public.create_activity_with_orientations(
  p_activity_date date,
  p_campus text,
  p_activity_type text,
  p_people_reached integer,
  p_meaningful_conversations integer,
  p_interested_people integer,
  p_support_used text,
  p_duration text,
  p_note text,
  p_orientations jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_activity_id uuid;
  v_orientation jsonb;
begin
  insert into public.activities (
    mediator_id, activity_date, campus, activity_type, people_reached,
    meaningful_conversations, interested_people, support_used, duration, note
  ) values (
    auth.uid(), p_activity_date, p_campus, p_activity_type, p_people_reached,
    p_meaningful_conversations, p_interested_people, p_support_used, p_duration, p_note
  )
  returning id into v_activity_id;

  for v_orientation in select * from jsonb_array_elements(p_orientations)
  loop
    insert into public.orientations (
      mediator_id, activity_id, collection_id, orientation_date, channel, status
    ) values (
      auth.uid(),
      v_activity_id,
      nullif(v_orientation->>'collection_id', '')::uuid,
      (v_orientation->>'orientation_date')::date,
      v_orientation->>'channel',
      v_orientation->>'status'
    );
  end loop;

  return v_activity_id;
end;
$$;

revoke all on function public.create_activity_with_orientations from public;
grant execute on function public.create_activity_with_orientations to authenticated;
