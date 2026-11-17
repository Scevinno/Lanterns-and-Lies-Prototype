-- Sign-up checks (Nik, 17 Nov): is an email already used, and has its owner confirmed it?
-- Server only: the game function calls it with the service role; players can't, so it can't be used to test emails.
create or replace function public.lnl_email_status(p_email text)
returns table (id uuid, confirmed boolean)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.email_confirmed_at is not null
  from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1
$$;
revoke all on function public.lnl_email_status(text) from public, anon, authenticated;
grant execute on function public.lnl_email_status(text) to service_role;
