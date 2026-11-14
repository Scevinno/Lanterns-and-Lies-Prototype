-- Nik, 14 Nov 2026: the crime family (was Syndicate) becomes the Mafia; the port company (was Cartel) becomes the Syndicate.
create or replace function pg_temp.sw(t text) returns text language sql immutable as
$$ select replace(replace(replace(t,'Syndicate','__MAFIA__'),'Cartel','Syndicate'),'__MAFIA__','Mafia') $$;
alter table public.parties drop constraint parties_mode_check;
update public.parties set mode = pg_temp.sw(mode) where mode in ('Syndicate','Cartel');
update public.parties set public_state = pg_temp.sw(public_state::text)::jsonb where public_state::text ~ 'Syndicate|Cartel';
alter table public.parties add constraint parties_mode_check check (mode = any (array['Mafia'::text,'Syndicate'::text,'Random'::text]));
update public.player_secrets set view = pg_temp.sw(view::text)::jsonb where view::text ~ 'Syndicate|Cartel';
update public.game_events set data = pg_temp.sw(data::text)::jsonb where data::text ~ 'Syndicate|Cartel';
update public.messages set body = pg_temp.sw(body) where body ~ 'Syndicate|Cartel';
update public.messages set channel = pg_temp.sw(channel) where channel in ('Syndicate','Cartel');
update public.roles set faction = pg_temp.sw(faction), summary = pg_temp.sw(summary), ability = pg_temp.sw(ability)
 where faction ~ 'Syndicate|Cartel' or summary ~ 'Syndicate|Cartel' or ability ~ 'Syndicate|Cartel';
