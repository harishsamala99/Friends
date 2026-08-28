
ALTER VIEW public.standings SET (security_invoker = on);
ALTER VIEW public.top_scorers SET (security_invoker = on);
ALTER VIEW public.player_stats SET (security_invoker = on);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.match_events_sync() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_fixture_score(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_officiate(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_officiate(uuid) TO authenticated;
