-- Applied 11 Nov 2026 (Nik): the Kingpin reads his side's night chat but cannot write in it (canChat in shared/engine.ts).
CREATE OR REPLACE FUNCTION public.can_read_message(m messages)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.party_players x left join public.player_secrets s on s.player_id = x.id
    where x.party_id = m.party_id and x.user_id = auth.uid() and (
      m.channel = 'town' or (m.channel = 'private' and m.recipient = x.id) or (m.channel = 'dead' and (s.view->>'alive') = 'false')
      or (m.channel = s.view->>'faction')
      or (m.channel <> 'private' and (s.view->>'over') = 'true'))) $function$;
