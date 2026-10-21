-- Rechten voor de tabellen uit 20261021090259. Dit bestand voert de GitHub-koppeling van Supabase uit bij een push
-- naar main (de MCP-koppeling voert revoke en delete niet uit). Mag vaker draaien.

-- Bezoekers (anon/authenticated) krijgen niets, ook niet als RLS ooit uit zou gaan
revoke all on public.uploads, public.nieuwsbrief, public.taken from anon, authenticated;

-- De functie ruimt oude bestanden en onbevestigde aanmeldingen zelf op (zie opruimen() in index.ts)
grant delete on public.uploads, public.nieuwsbrief to service_role;

