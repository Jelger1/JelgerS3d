-- Vervolg op 20261020205514_formulieren.sql (in de SQL Editor uitgevoerd: de MCP-koppeling voert revoke en delete
-- alleen uit na een bevestiging die VS Code niet kan tonen).

-- Rechten: dit project gaf anon en authenticated nog alle rechten op nieuwe tabellen. RLS houdt ze al tegen, maar
-- bezoekers krijgen hier niets, ook niet als RLS ooit uit zou gaan. De functie mag lezen, toevoegen en bijwerken.
revoke all on public.bestellingen, public.berichten, public.inzendingen_log from anon, authenticated, service_role;
grant select, insert, update on public.bestellingen, public.berichten to service_role;
grant select, insert on public.inzendingen_log to service_role;

-- De bewaartermijnen uit de privacyverklaring automatisch nakomen: berichten en aanvragen hooguit een
-- jaar, bestellingen hooguit twee jaar (facturen bewaar je in je administratie, niet hier).
select cron.schedule(
	'jelgers3d-opruimen',
	'15 3 * * *',
	$$
	delete from public.berichten where aangemaakt < now() - interval '1 year';
	delete from public.bestellingen where aangemaakt < now() - interval '2 years';
	delete from public.inzendingen_log where aangemaakt < now() - interval '1 day';
	$$
);
