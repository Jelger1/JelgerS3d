-- Bestellingen en berichten van jelgers3d.nl.
--
-- Alleen de Edge Function "formulier" schrijft hierin, met de service role. Voor bezoekers is er geen
-- toegang: row level security staat aan en er zijn bewust geen policies. In het Supabase-dashboard
-- (Table Editor) zie je alles en kun je de status bijwerken.

create table public.bestellingen (
	id text primary key,                         -- bv. JS3D-MGX7K2P4, staat ook in beide mails
	aangemaakt timestamptz not null default now(),
	status text not null default 'nieuw'
		check (status in ('nieuw', 'bevestigd', 'betaald', 'geleverd', 'geannuleerd')),
	naam text not null,
	email text not null,
	telefoon text not null,
	levering text not null check (levering in ('Verzenden', 'Ophalen')),
	adres text,
	postcode text,
	plaats text,
	land text,
	opmerkingen text,
	regels jsonb not null,                       -- [{id, naam, variant, aantal, prijs, regelTotaal, tekst}]
	totaal numeric(10, 2) not null,              -- nagerekend met de prijzen van de site, excl. verzendkosten
	akkoord_op timestamptz,                      -- vinkje bij voorwaarden en privacyverklaring
	mail_klant boolean not null default false,   -- is de bevestiging verstuurd?
	mail_eigenaar boolean not null default false -- is het overzicht naar Jelger verstuurd?
);

create table public.berichten (
	id uuid primary key default gen_random_uuid(),
	aangemaakt timestamptz not null default now(),
	soort text not null check (soort in ('contact', 'offerte', 'printservice', 'beschikbaarheid')),
	status text not null default 'nieuw'
		check (status in ('nieuw', 'beantwoord', 'afgehandeld', 'spam')),
	spam_reden text,                             -- waarom het als spam is gemarkeerd (dan gaat er geen mail uit)
	naam text,
	email text not null,
	product text,
	velden jsonb not null default '{}'::jsonb,   -- de ingevulde velden, met het label als naam
	bericht text,
	akkoord_op timestamptz,
	mail_klant boolean not null default false,
	mail_eigenaar boolean not null default false
);

create index bestellingen_aangemaakt on public.bestellingen (aangemaakt desc);
create index berichten_aangemaakt on public.berichten (aangemaakt desc);

-- Tegen misbruik: wie verstuurde er recent iets? Alleen gehashte waarden, na een dag weg.
create table public.inzendingen_log (
	id uuid primary key default gen_random_uuid(),
	aangemaakt timestamptz not null default now(),
	ip_hash text not null,                       -- leeg als het IP-adres onbekend is
	email_hash text not null
);
create index inzendingen_log_ip on public.inzendingen_log (ip_hash, aangemaakt);
create index inzendingen_log_email on public.inzendingen_log (email_hash, aangemaakt);

alter table public.bestellingen enable row level security;
alter table public.berichten enable row level security;
alter table public.inzendingen_log enable row level security;

-- Rechten: alleen wat de functie gebruikt (lezen, toevoegen, bijwerken; nooit verwijderen).
grant select, insert, update on public.bestellingen, public.berichten to service_role;
grant select, insert on public.inzendingen_log to service_role;

-- Voor het automatisch opruimen volgens de privacyverklaring (de taak zelf staat in de volgende migratie)
create extension if not exists pg_cron;
