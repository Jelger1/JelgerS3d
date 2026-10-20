// Gedeelde logica van de Edge Function "formulier": invoer controleren, spam herkennen, prijzen narekenen
// en de mails opbouwen. Gewoon JavaScript zonder Deno- of Node-specifieke dingen, zodat dit bestand ook
// buiten Supabase te testen is. index.ts doet de rest (database, mail versturen, limieten).

export const SOORTEN = ['bestelling', 'contact', 'offerte', 'printservice', 'beschikbaarheid'];
export const MIN_DUUR_MS = 2000;   // sneller dan dit kan een mens geen formulier invullen
export const MAX_LINKS = 2;        // meer links in een bericht: vrijwel altijd SEO-spam

const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i;

export function esc(waarde) {
	return String(waarde == null ? '' : waarde)
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function euro(bedrag) {
	return '€' + Number(bedrag).toFixed(2).replace('.', ',');
}

function rond(bedrag) { return Math.round(bedrag * 100) / 100; }
function heeft(object, sleutel) { return Boolean(object) && Object.prototype.hasOwnProperty.call(object, sleutel); }

// Meerregelige tekst: alleen bijknippen. Eén regel: ook witruimte samenvoegen.
function tekst(waarde, max) { return String(waarde == null ? '' : waarde).replace(/\r\n?/g, '\n').trim().slice(0, max); }
function regel(waarde, max) { return tekst(waarde, max).replace(/\s+/g, ' '); }

// ---------------------------------------------------------------------------------------------- invoer

// De productnaam komt uit de catalogus van de site, niet van de bezoeker: hij staat in het onderwerp en de
// tekst van de bevestiging, en die kan naar elk adres gaan dat iemand invult.
function productNaam(soort, id, catalogus) {
	if (soort === 'printservice') return '3D-printservice';
	return heeft(catalogus, id) ? catalogus[id].name : '';
}

// Controleert en normaliseert wat de website stuurt. Geeft { ok: true, data } of { ok: false, fout }.
// catalogus: de producten uit /js/winkel.json.
export function controleer(invoer, catalogus) {
	const fout = function (bericht) { return { ok: false, fout: bericht }; };
	if (!invoer || typeof invoer !== 'object' || Array.isArray(invoer)) return fout('Ongeldige aanvraag.');
	if (SOORTEN.indexOf(invoer.soort) === -1) return fout('Onbekend formulier.');

	const data = {
		soort: invoer.soort,
		naam: regel(invoer.naam, 100),
		email: regel(invoer.email, 200).toLowerCase(),
		akkoord: invoer.akkoord === true,
		pagina: regel(invoer.pagina, 300)
	};
	if (!EMAIL.test(data.email)) return fout('Vul een geldig e-mailadres in.');
	if (data.soort !== 'beschikbaarheid' && !data.naam) return fout('Vul je naam in.');

	if (data.soort === 'contact') {
		data.bericht = tekst(invoer.bericht, 5000);
		if (!data.bericht) return fout('Vul je bericht in.');
	}

	if (data.soort === 'offerte' || data.soort === 'printservice' || data.soort === 'beschikbaarheid') {
		data.product = productNaam(data.soort, regel(invoer.product, 80), catalogus);
		if (data.soort === 'beschikbaarheid' && !data.product) return fout('Dit product bestaat niet meer. Ververs de pagina en probeer het opnieuw.');
		data.velden = {};
		const velden = invoer.velden && typeof invoer.velden === 'object' && !Array.isArray(invoer.velden) ? invoer.velden : {};
		Object.keys(velden).slice(0, 12).forEach(function (label) {
			const waarde = tekst(velden[label], 3000);
			if (waarde) data.velden[regel(label, 80)] = waarde;
		});
		if (data.soort !== 'beschikbaarheid' && !Object.keys(data.velden).length) return fout('Vertel kort wat je wilt laten maken.');
	}

	if (data.soort === 'bestelling') {
		const b = invoer.bestelling && typeof invoer.bestelling === 'object' ? invoer.bestelling : {};
		data.telefoon = regel(invoer.telefoon, 40);
		if (!data.telefoon) return fout('Vul je telefoonnummer in.');
		data.levering = b.levering === 'Ophalen' ? 'Ophalen' : 'Verzenden';
		if (data.levering === 'Verzenden') {
			data.adres = regel(b.adres, 200);
			data.postcode = regel(b.postcode, 20);
			data.plaats = regel(b.plaats, 100);
			data.land = regel(b.land, 60) || 'Nederland';
			if (!data.adres || !data.postcode || !data.plaats) return fout('Vul je adres volledig in.');
		}
		data.opmerkingen = tekst(b.opmerkingen, 2000);
		const regels = Array.isArray(b.regels) ? b.regels : [];
		if (!regels.length) return fout('Je winkelwagen is leeg.');
		if (regels.length > 50) return fout('Dat zijn te veel regels voor één bestelling. Stuur me even een mail.');
		data.regels = regels.map(function (r) {
			r = r && typeof r === 'object' ? r : {};
			return { id: regel(r.id, 80), variant: regel(r.variant, 80), aantal: Math.floor(Number(r.aantal)), tekst: regel(r.tekst, 60) };
		});
		if (data.regels.some(function (r) { return !r.id || !(r.aantal >= 1 && r.aantal <= 99); })) return fout('Er klopt iets niet in je winkelwagen. Ververs de pagina en probeer het opnieuw.');
	}
	return { ok: true, data: data };
}

// ---------------------------------------------------------------------------------------------- spam

// Geeft de reden terug als het spam lijkt, anders null.
//  - "honeypot" en "te snel": een robot. De afzender krijgt een nep-"verstuurd", er wordt niets opgeslagen.
//    De website stuurt altijd de invultijd mee (duur); ontbreekt die, dan kwam het niet van de website.
//  - "links": waarschijnlijk SEO-spam. Wordt opgeslagen met status spam (te controleren), maar zonder mails.
export function spamSignaal(invoer, data) {
	if (invoer && invoer.botcheck) return 'honeypot';
	if (!invoer || typeof invoer.duur !== 'number' || !(invoer.duur >= MIN_DUUR_MS)) return 'te snel';
	if (data && data.soort !== 'bestelling') {
		const vrij = [data.bericht || ''].concat(Object.keys(data.velden || {}).map(function (k) { return data.velden[k]; })).join(' ');
		const links = (vrij.match(/https?:\/\/|www\.|\[url/gi) || []).length;
		if (links > MAX_LINKS) return 'links';
	}
	return null;
}

export function stilWeggooien(reden) { return reden === 'honeypot' || reden === 'te snel'; }

// ---------------------------------------------------------------------------------------------- prijzen

// Rekent een bestelling na met de prijzen van de website (catalogus uit /js/winkel.json), zodat niemand
// via een aangepaste aanvraag een lagere prijs in zijn bevestiging krijgt.
export function prijzen(regels, catalogus) {
	const niet = function (bericht) { return { ok: false, fout: bericht }; };
	const uit = [];
	for (let i = 0; i < regels.length; i++) {
		const r = regels[i];
		const p = catalogus[r.id];
		if (!p || p.sale !== 'cart') return niet('Een product in je winkelwagen is niet meer te bestellen. Ververs de pagina en probeer het opnieuw.');
		const v = (p.variants || []).find(function (x) { return x.id === r.variant; });
		if (!v) return niet('De gekozen uitvoering van de ' + p.name + ' bestaat niet meer. Ververs de pagina en probeer het opnieuw.');
		if (p.personalize && !r.tekst) return niet('Vul de tekst voor de ' + p.name + ' in.');
		uit.push({
			id: r.id,
			naam: p.name,
			variant: v.label || '',
			aantal: r.aantal,
			prijs: v.price,
			regelTotaal: rond(v.price * r.aantal),
			tekst: p.personalize || p.wish ? r.tekst : '',
			tekstLabel: p.personalize ? 'Tekst op het product' : 'Wens'
		});
	}
	return { ok: true, regels: uit, totaal: rond(uit.reduce(function (som, r) { return som + r.regelTotaal; }, 0)) };
}

// Ordernummer: tijd in base36 plus twee willekeurige tekens, kort genoeg om over de telefoon te noemen
export function ordernummer(nu, willekeur) {
	const tijd = (nu || Date.now()).toString(36).toUpperCase();
	const extra = Math.floor((willekeur == null ? Math.random() : willekeur) * 1296).toString(36).toUpperCase().padStart(2, '0');
	return 'JS3D-' + tijd + extra;
}

// ---------------------------------------------------------------------------------------------- mails

const KLEUR = '#03bcca';
const TITELS = {
	contact: 'bericht',
	offerte: 'aanvraag',
	printservice: 'printaanvraag',
	beschikbaarheid: 'aanmelding'
};

// De bevestiging gaat naar het adres dat iemand invult, en dat kan ook dat van een ander zijn. Spammers
// misbruiken dat door een webadres in het naam- of berichtveld te zetten. Daarom in mails aan de klant:
// alleen een voornaam als het echt op een naam lijkt, en geen klikbare links. Jelger ziet alles wel.
function voornaam(naam) {
	const eerste = String(naam || '').split(' ')[0];
	return /^\p{L}[\p{L}'’-]{0,29}$/u.test(eerste) ? eerste : '';
}

function zonderLinks(waarde) { return String(waarde == null ? '' : waarde).replace(/(?:https?:\/\/|www\.)\S*/gi, '[link]'); }

function datum(moment) {
	return new Date(moment).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function omhulsel(titel, inhoud, voet) {
	return '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(titel) + '</title></head>'
		+ '<body style="margin:0;padding:0;background:#eef1f4;font-family:Arial,Helvetica,sans-serif;color:#1d2330;line-height:1.55">'
		+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f4;padding:24px 12px"><tr><td align="center">'
		+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">'
		+ '<tr><td style="background:#12151c;padding:18px 28px;font-size:20px;font-weight:bold;color:#ffffff">JelgerS3D<span style="color:' + KLEUR + '">.</span></td></tr>'
		+ '<tr><td style="padding:28px 28px 8px 28px;font-size:15px">' + inhoud + '</td></tr>'
		+ '<tr><td style="padding:16px 28px 22px 28px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb">' + voet + '</td></tr>'
		+ '</table></td></tr></table></body></html>';
}

function kop(t) { return '<h2 style="margin:24px 0 10px 0;font-size:16px;color:#12151c">' + esc(t) + '</h2>'; }
function alinea(html) { return '<p style="margin:0 0 14px 0">' + html + '</p>'; }

// Tabel met label/waarde-rijen; waarden zijn al geëscaped HTML
function gegevens(rijen) {
	return '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 8px 0">'
		+ rijen.filter(function (r) { return r[1]; }).map(function (r) {
			return '<tr><td style="padding:7px 12px 7px 0;color:#6b7280;vertical-align:top;white-space:nowrap;width:130px">' + esc(r[0]) + '</td>'
				+ '<td style="padding:7px 0;vertical-align:top">' + r[1] + '</td></tr>';
		}).join('') + '</table>';
}

function regelsHtml(regels, totaal, voetnoot) {
	return '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">'
		+ regels.map(function (r) {
			const details = [r.variant, r.tekst ? r.tekstLabel + ': “' + esc(r.tekst) + '”' : ''].filter(Boolean).join(' · ');
			return '<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;vertical-align:top"><strong>' + r.aantal + '× ' + esc(r.naam) + '</strong>'
				+ (details ? '<br><span style="color:#6b7280">' + details + '</span>' : '')
				+ (r.aantal > 1 ? '<br><span style="color:#6b7280">' + euro(r.prijs) + ' per stuk</span>' : '') + '</td>'
				+ '<td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;white-space:nowrap">' + euro(r.regelTotaal) + '</td></tr>';
		}).join('')
		+ '<tr><td style="padding:12px 0 2px 0"><strong>Totaal</strong></td><td style="padding:12px 0 2px 0;text-align:right"><strong>' + euro(totaal) + '</strong></td></tr>'
		+ (voetnoot ? '<tr><td colspan="2" style="padding:0 0 4px 0;color:#6b7280;font-size:13px">' + esc(voetnoot) + '</td></tr>' : '')
		+ '</table>';
}

function regelsTekst(regels, totaal) {
	return regels.map(function (r) {
		return r.aantal + '× ' + r.naam + (r.variant ? ' (' + r.variant + ')' : '') + ' — ' + euro(r.regelTotaal)
			+ (r.tekst ? '\n   ' + r.tekstLabel + ': ' + r.tekst : '');
	}).join('\n') + '\nTotaal: ' + euro(totaal);
}

function adresRegel(d) {
	return d.levering === 'Ophalen' ? 'Zelf ophalen' : [d.adres, [d.postcode, d.plaats].filter(Boolean).join(' '), d.land].filter(Boolean).join(', ');
}

function winkelVoet(w) {
	return esc(w.naam) + ' · ' + esc(w.adres) + '<br>KvK ' + esc(w.kvk) + ' · Btw ' + esc(w.btw) + ' · <a href="mailto:' + esc(w.email) + '" style="color:#6b7280">' + esc(w.email) + '</a>'
		+ '<br><a href="' + esc(w.url) + '/voorwaarden.html" style="color:#6b7280">Algemene voorwaarden</a> · <a href="' + esc(w.url) + '/privacy.html" style="color:#6b7280">Privacyverklaring</a>';
}

// Mail naar Jelger: alles overzichtelijk bij elkaar. Antwoorden gaat naar de klant (reply-to).
// extra: { id, regels, totaal, moment, dashboard }
export function mailEigenaar(data, extra, winkel) {
	const moment = datum(extra.moment);
	const klant = [
		['Naam', esc(data.naam)],
		['E-mail', '<a href="mailto:' + esc(data.email) + '" style="color:' + KLEUR + '">' + esc(data.email) + '</a>'],
		['Telefoon', data.telefoon ? '<a href="tel:' + esc(data.telefoon.replace(/[^\d+]/g, '')) + '" style="color:' + KLEUR + '">' + esc(data.telefoon) + '</a>' : '']
	];
	let onderwerp, inhoud, tekstversie;

	if (data.soort === 'bestelling') {
		const aantal = extra.regels.reduce(function (s, r) { return s + r.aantal; }, 0);
		onderwerp = 'Nieuwe bestelling ' + extra.id + ': ' + aantal + ' item' + (aantal === 1 ? '' : 's') + ', ' + euro(extra.totaal) + ' (' + data.levering.toLowerCase() + ')';
		inhoud = '<h1 style="margin:0 0 4px 0;font-size:22px">Nieuwe bestelling ' + esc(extra.id) + '</h1>'
			+ '<p style="margin:0 0 18px 0;color:#6b7280">' + esc(moment) + '</p>'
			+ regelsHtml(extra.regels, extra.totaal, data.levering === 'Verzenden' ? 'Exclusief verzendkosten.' : 'Wordt opgehaald, geen verzendkosten.')
			+ kop('Klant')
			+ gegevens(klant.concat([
				['Levering', data.levering === 'Ophalen' ? 'Zelf ophalen in ' + esc(winkel.ophaalplaats) : 'Verzenden'],
				['Adres', data.levering === 'Verzenden' ? esc(adresRegel(data)) : ''],
				['Opmerkingen', data.opmerkingen ? esc(data.opmerkingen).replace(/\n/g, '<br>') : ''],
				['Akkoord', data.akkoord ? 'Voorwaarden en privacyverklaring, op ' + esc(moment) : '']
			]));
		tekstversie = 'NIEUWE BESTELLING ' + extra.id + '\n' + moment + '\n\n' + regelsTekst(extra.regels, extra.totaal)
			+ '\n\nKLANT\nNaam: ' + data.naam + '\nE-mail: ' + data.email + '\nTelefoon: ' + data.telefoon
			+ '\nLevering: ' + (data.levering === 'Ophalen' ? 'Zelf ophalen' : 'Verzenden, ' + adresRegel(data))
			+ (data.opmerkingen ? '\nOpmerkingen: ' + data.opmerkingen : '');
	} else {
		const soortNaam = TITELS[data.soort];
		onderwerp = data.soort === 'contact' ? 'Nieuw bericht van ' + data.naam
			: data.soort === 'beschikbaarheid' ? data.email + ' wil een seintje over de ' + data.product
			: 'Nieuwe ' + soortNaam + (data.soort === 'offerte' && data.product ? ' ' + data.product : '') + ' van ' + data.naam;
		const velden = Object.keys(data.velden || {}).map(function (label) { return [label, esc(data.velden[label]).replace(/\n/g, '<br>')]; });
		inhoud = '<h1 style="margin:0 0 4px 0;font-size:22px">' + esc(onderwerp) + '</h1>'
			+ '<p style="margin:0 0 18px 0;color:#6b7280">' + esc(moment) + (data.product && data.soort !== 'beschikbaarheid' ? ' · ' + esc(data.product) : '') + '</p>'
			+ (data.bericht ? '<div style="background:#f3f5f7;border-radius:8px;padding:14px 16px;margin:0 0 8px 0;white-space:pre-wrap">' + esc(data.bericht) + '</div>' : '')
			+ (velden.length ? gegevens(velden) : '')
			+ kop('Afzender')
			+ gegevens(klant.concat([['Akkoord', data.akkoord ? 'Privacyverklaring, op ' + esc(moment) : '']]))
			+ (data.soort === 'printservice' ? alinea('<strong>Let op:</strong> het bestand komt apart per mail. De klant heeft gelezen dat het bestand als antwoord op jouw bericht kan worden nagestuurd.') : '');
		tekstversie = onderwerp.toUpperCase() + '\n' + moment + '\n\n'
			+ (data.bericht ? data.bericht + '\n\n' : '')
			+ Object.keys(data.velden || {}).map(function (l) { return l + ': ' + data.velden[l]; }).join('\n')
			+ '\n\nNaam: ' + (data.naam || '-') + '\nE-mail: ' + data.email;
	}

	const voet = 'Antwoord je op deze mail, dan gaat je antwoord naar ' + esc(data.email) + '.'
		+ (extra.dashboard ? '<br><a href="' + esc(extra.dashboard) + '" style="color:#6b7280">Alles terugzien in Supabase</a>' : '');
	return {
		onderwerp: onderwerp,
		html: omhulsel(onderwerp, inhoud, voet),
		tekst: tekstversie + '\n\nAntwoorden op deze mail gaat naar ' + data.email + '.'
	};
}

// Bevestiging voor de klant
export function mailKlant(data, extra, winkel) {
	const naam = voornaam(data.naam);
	const hoi = naam ? 'Hoi ' + esc(naam) + ',' : 'Hoi,';
	const velden = Object.keys(data.velden || {}).map(function (label) { return [zonderLinks(label), zonderLinks(data.velden[label])]; });
	const afsluiting = alinea('Vragen, of wil je iets veranderen? Beantwoord gewoon deze mail.') + alinea('Groet,<br>' + esc(winkel.eigenaar.split(' ')[0]) + ', ' + esc(winkel.naam));
	let onderwerp, inhoud, tekstversie;

	if (data.soort === 'bestelling') {
		// Let op de woorden: dit is een ONTVANGSTbevestiging. "De bevestiging" uit de algemene voorwaarden
		// (met totaalprijs en levertijd, waarmee de overeenkomst ontstaat) stuurt Jelger zelf na het contact.
		onderwerp = 'Je bestelling bij ' + winkel.naam + ' is binnen (' + extra.id + ')';
		const regels = extra.regels.map(function (r) { return Object.assign({}, r, { tekst: zonderLinks(r.tekst) }); });
		const adres = zonderLinks(adresRegel(data));
		const stappen = [
			'Ik neem persoonlijk contact met je op om kleur, details en ' + (data.levering === 'Ophalen' ? 'een moment om op te halen in ' + esc(winkel.ophaalplaats) : 'de verzendkosten') + ' af te spreken.',
			'Pas als alles klopt, betaal je en ga ik voor je printen.',
			esc(winkel.levertijd)
		];
		inhoud = alinea(hoi) + alinea('Bedankt voor je bestelling! Ik heb hem goed ontvangen. Je bestelnummer is <strong>' + esc(extra.id) + '</strong>.')
			+ kop('Dit heb je besteld')
			+ regelsHtml(regels, extra.totaal, data.levering === 'Verzenden' ? 'Exclusief verzendkosten. Die hoor je van mij voordat je betaalt.' : 'Je haalt het op in ' + winkel.ophaalplaats + ', dus zonder verzendkosten.')
			+ (data.levering === 'Verzenden' ? alinea('<span style="color:#6b7280">Bezorgadres: ' + esc(adres) + '</span>') : '')
			+ kop('Hoe gaat het nu verder?')
			+ '<ol style="margin:0 0 14px 0;padding-left:20px">' + stappen.map(function (s) { return '<li style="margin:0 0 6px 0">' + s + '</li>'; }).join('') + '</ol>'
			+ alinea('Dit is een ontvangstbevestiging: je hoeft nu nog niets te betalen. Na ons contact krijg je van mij de definitieve bevestiging met de totaalprijs, inclusief eventuele verzendkosten, en de levertijd. Pas als jij die goedkeurt, is de bestelling definitief.')
			+ afsluiting;
		tekstversie = (naam ? 'Hoi ' + naam + ',' : 'Hoi,') + '\n\nBedankt voor je bestelling! Je bestelnummer is ' + extra.id + '.\n\n' + regelsTekst(regels, extra.totaal)
			+ (data.levering === 'Verzenden' ? '\n(exclusief verzendkosten)\nBezorgadres: ' + adres : '\nJe haalt het op in ' + winkel.ophaalplaats + '.')
			+ '\n\nHoe nu verder: ik neem persoonlijk contact met je op. Pas als alles klopt, betaal je en ga ik printen. ' + winkel.levertijd
			+ '\n\nDit is een ontvangstbevestiging: je hoeft nu nog niets te betalen. Na ons contact krijg je de definitieve bevestiging met de totaalprijs en de levertijd.';
	} else if (data.soort === 'beschikbaarheid') {
		onderwerp = 'Je hoort het zodra de ' + data.product + ' er weer is';
		inhoud = alinea('Hoi,') + alinea('Je staat genoteerd: zodra de <strong>' + esc(data.product) + '</strong> weer te bestellen is, krijg je één mail van mij. Verder niets.') + afsluiting;
		tekstversie = 'Je staat genoteerd: zodra de ' + data.product + ' weer te bestellen is, krijg je één mail van mij.';
	} else {
		const wat = TITELS[data.soort];
		onderwerp = data.soort === 'contact' ? 'Je bericht aan ' + winkel.naam + ' is binnen' : 'Je ' + wat + ' bij ' + winkel.naam + ' is binnen';
		const bericht = zonderLinks(data.bericht);
		inhoud = alinea(hoi)
			+ alinea(data.soort === 'contact' ? 'Bedankt voor je bericht. Ik reageer zo snel mogelijk, meestal binnen een paar dagen.'
				: 'Bedankt voor je ' + wat + (data.soort === 'offerte' && data.product ? ' voor de <strong>' + esc(data.product) + '</strong>' : '') + '. Ik laat je zo snel mogelijk weten wat het kost en hoe lang het duurt.')
			+ (data.soort === 'printservice' ? alinea('<strong>Stuur je bestand (STL of 3MF) als antwoord op deze mail</strong>, als je dat nog niet hebt gedaan. Dan kan ik het meteen bekijken.') : '')
			+ kop('Wat je hebt gestuurd')
			+ (bericht ? '<div style="background:#f3f5f7;border-radius:8px;padding:14px 16px;margin:0 0 14px 0;white-space:pre-wrap">' + esc(bericht) + '</div>'
				: gegevens(velden.map(function (r) { return [r[0], esc(r[1]).replace(/\n/g, '<br>')]; })))
			+ alinea('Je zit nergens aan vast: eerst hoor je van mij, daarna beslis je.')
			+ afsluiting;
		tekstversie = 'Bedankt voor je ' + wat + '. Ik reageer zo snel mogelijk.\n\n' + (bericht || velden.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n'));
	}
	return { onderwerp: onderwerp, html: omhulsel(onderwerp, inhoud, winkelVoet(winkel)), tekst: tekstversie + '\n\n' + winkel.naam + ' · ' + winkel.adres + ' · KvK ' + winkel.kvk + ' · ' + winkel.email };
}
