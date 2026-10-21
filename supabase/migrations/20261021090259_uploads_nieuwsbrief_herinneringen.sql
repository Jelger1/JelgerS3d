-- Bestanden bij aanvragen, de nieuwsbrief, "Ik heb gereageerd" en herinneringen. Zie supabase/functions/formulier/index.ts.
-- (Via de MCP-koppeling uitgevoerd; daarom staan verwijderrechten en revokes in de volgende migratie.)

-- "Ik heb gereageerd" (knop in Jelgers mail) en hoeveel herinneringen er al zijn verstuurd (hooguit twee)
alter table public.bestellingen
	add column gereageerd_op timestamptz,
	add column herinneringen smallint not null default 0;
alter table public.berichten
	add column gereageerd_op timestamptz,
	add column herinneringen smallint not null default 0;

-- Bestanden die bij een aanvraag zijn geüpload. Het bestand zelf staat in Storage (bucket "uploads", privé);
-- hier de oorspronkelijke naam en bij welk bericht het hoort. Na data/site.json > uploads.keepMonths weg.
create table public.uploads (
	id uuid primary key,
	aangemaakt timestamptz not null default now(),
	pad text not null unique,                    -- plek in de bucket, met een willekeurige naam
	naam text not null,                          -- naam zoals de bezoeker hem uploadde
	grootte bigint not null,
	soort text not null check (soort in ('offerte', 'printservice')),
	ip_hash text not null default '',            -- tegen misbruik: hooguit 10 bestanden per IP per 10 minuten
	bericht_id uuid                              -- leeg tot het formulier is verstuurd; losse bestanden na een dag weg
);
create index uploads_aangemaakt on public.uploads (aangemaakt);
create index uploads_ip on public.uploads (ip_hash, aangemaakt);
create index uploads_bericht on public.uploads (bericht_id);

-- Aanmeldingen voor de nieuwsbrief (dubbele opt-in). Bevestigde adressen staan ook als contact in Resend; daar
-- verstuurt Jelger de nieuwsbrief en daar meldt iemand zich af. Dit is het bewijs van de toestemming.
create table public.nieuwsbrief (
	id uuid primary key default gen_random_uuid(),
	email text not null unique,
	bron text not null,                          -- footer, bedankt, of het formulier met het vinkje
	aangevraagd timestamptz not null default now(),
	token_hash text unique,                      -- hash van de bevestigingslink; de link zelf staat alleen in de mail
	bevestigd_op timestamptz,                    -- onbevestigd na 30 dagen weg
	resend_id text                               -- contact in Resend; leeg als het overzetten (nog) niet lukte
);

-- Wanneer de uurlijkse taken en de dagelijkse herinnering het laatst draaiden
create table public.taken (
	naam text primary key,
	laatst timestamptz not null
);

alter table public.uploads enable row level security;
alter table public.nieuwsbrief enable row level security;
alter table public.taken enable row level security;

-- Alleen de functie (service role); het verwijderen van oude rijen staat in de volgende migratie
grant select, insert, update on public.uploads, public.nieuwsbrief, public.taken to service_role;

-- Privé opslag voor de bestanden, hooguit 50 MB per bestand (gelijk aan data/site.json > uploads.maxMB)
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', false, 52428800)
on conflict (id) do nothing;

-- Elk uur de functie aanroepen voor de taken (opruimen, herinnering om 9 uur Nederlandse tijd)
create extension if not exists pg_net;
select cron.schedule(
	'jelgers3d-taken',
	'5 * * * *',
	$$
	select net.http_post(
		url := 'https://kgxhefdzufhmigbmchhk.supabase.co/functions/v1/formulier',
		body := '{"actie": "taken"}'::jsonb,
		headers := '{"Content-Type": "application/json"}'::jsonb,
		timeout_milliseconds := 60000
	);
	$$
);
