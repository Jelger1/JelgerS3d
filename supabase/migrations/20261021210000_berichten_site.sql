-- Van welke website een bericht komt. Het portfolio (jelgersieler.nl, JSdesign) gebruikt het contactformulier van
-- de functie "formulier" ook; die berichten krijgen site = 'jelgersieler.nl'. Alles van de winkel houdt de standaard.
alter table public.berichten
	add column site text not null default 'jelgers3d.nl'
		check (site in ('jelgers3d.nl', 'jelgersieler.nl'));
