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

// Het e-mailadres van de winkel staat gecodeerd in winkel.json (achterstevoren, in base64), net als op de site;
// zie mailCode in src/templates/helpers.js.
export function ontcijferMail(code) {
	try { return atob(code || '').split('').reverse().join(''); } catch (e) { return ''; }
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
			tekstLabel: p.personalize ? 'Tekst op het product' : 'Wens',
			afbeelding: p.mailImage || '' // productfoto voor de mail, relatief aan de site (assets/mail/...)
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
//
// In de stijl van de site: een donker kader met het logo, een witte kaart met de cyaan-mint balk, koppen in Syne
// en tekst in Space Grotesk (mailprogramma's zonder webfonts, zoals Gmail, tonen Arial). Alles met tabellen en
// inline stijlen, want veel mailprogramma's negeren de rest. De plaatjes staan op de site zelf (assets/mail/,
// gemaakt door build.js). Wit in het midden houdt de mail goed leesbaar, ook als iemand hem uitprint.

const KLEUR = {
	donker: '#12151c', merk: '#03bcca', mint: '#5de8d0', zacht: '#e0ebe9', grijs: '#959daa', licht: '#f0efee',
	tekst: '#12151c', gedempt: '#5b6472', link: '#027a8c', lijn: '#e3e8ec' // gedempt en link: genoeg contrast op wit
};
const KOP = "'Syne','Trebuchet MS',Arial,sans-serif";
const LETTER = "'Space Grotesk','Segoe UI',Arial,Helvetica,sans-serif";
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

// preheader: de regel die mailprogramma's in de inbox naast het onderwerp tonen
function omhulsel(titel, preheader, inhoud, voet, winkel) {
	const url = winkel.url;
	return '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
		+ '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>' + esc(titel) + '</title>'
		+ '<style>@font-face{font-family:"Syne";font-weight:400 800;src:url(' + url + '/assets/fonts/syne-latin.woff2) format("woff2")}'
		+ '@font-face{font-family:"Space Grotesk";font-weight:300 700;src:url(' + url + '/assets/fonts/space-grotesk-latin.woff2) format("woff2")}'
		+ '@media (max-width:480px){.kaart{padding:26px 20px 10px 20px!important}}</style></head>'
		+ '<body style="margin:0;padding:0;background:' + KLEUR.donker + '">'
		+ '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:' + KLEUR.donker + '">' + esc(preheader) + '&#847;&zwnj;&nbsp;'.repeat(30) + '</div>'
		+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + KLEUR.donker + '" style="background:' + KLEUR.donker + '"><tr><td align="center" style="padding:28px 12px 36px 12px">'
		+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">'
		+ '<tr><td style="padding:0 4px 20px 4px"><a href="' + esc(url) + '"><img src="' + esc(url) + '/assets/mail/logo.png" width="139" height="52" alt="JelgerS3D" style="display:block;border:0;outline:none;color:' + KLEUR.licht + ';font:700 20px ' + KOP + '"></a></td></tr>'
		+ '<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:16px;overflow:hidden">'
		+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
		+ '<tr><td height="4" bgcolor="' + KLEUR.merk + '" style="height:4px;line-height:4px;font-size:0;background:' + KLEUR.merk + ';background-image:linear-gradient(90deg,' + KLEUR.merk + ',' + KLEUR.mint + ')">&nbsp;</td></tr>'
		+ '<tr><td class="kaart" style="padding:32px 32px 14px 32px;font:15px/1.6 ' + LETTER + ';color:' + KLEUR.tekst + '">' + inhoud + '</td></tr>'
		+ '</table></td></tr>'
		+ '<tr><td style="padding:22px 4px 0 4px;font:12px/1.7 ' + LETTER + ';color:' + KLEUR.grijs + '">' + voet + '</td></tr>'
		+ '</table></td></tr></table></body></html>';
}

function bovenkop(t) { return '<p style="margin:0 0 6px 0;font:700 12px/1.4 ' + LETTER + ';letter-spacing:0.08em;text-transform:uppercase;color:' + KLEUR.link + '">' + esc(t) + '</p>'; }
// letter: andere letter dan Syne, voor een bestelnummer (de cijfers van Syne zijn sierlijk, niet goed voor te lezen)
function titel(html, letter) { return '<h1 style="margin:0 0 14px 0;font:800 26px/1.2 ' + (letter || KOP) + ';color:' + KLEUR.tekst + '">' + html + '</h1>'; }
function kop(t) { return '<h2 style="margin:28px 0 10px 0;font:700 17px/1.3 ' + KOP + ';color:' + KLEUR.tekst + '">' + esc(t) + '</h2>'; }
function alinea(html, stijl) { return '<p style="margin:0 0 14px 0' + (stijl ? ';' + stijl : '') + '">' + html + '</p>'; }
function gedempt(html) { return '<span style="color:' + KLEUR.gedempt + '">' + html + '</span>'; }
function link(href, html) { return '<a href="' + esc(href) + '" style="color:' + KLEUR.link + '">' + html + '</a>'; }
function label(html) { return '<span style="display:inline-block;background:' + KLEUR.zacht + ';border-radius:999px;padding:6px 14px;font-weight:700;white-space:nowrap">' + html + '</span>'; }
function notitie(html) { return '<div style="background:' + KLEUR.zacht + ';border-radius:12px;padding:14px 16px;margin:6px 0 16px 0;font-size:14px">' + html + '</div>'; }
function citaat(t) { return '<div style="background:' + KLEUR.zacht + ';border-radius:12px;padding:14px 16px;margin:0 0 14px 0;white-space:pre-wrap">' + esc(t) + '</div>'; }

// Knoppen voor Jelger: in één tik de klant mailen of bellen
function knoppen(lijst) {
	return '<p style="margin:4px 0 6px 0">' + lijst.filter(Boolean).map(function (k, i) {
		const kleur = i === 0 ? KLEUR.merk : KLEUR.zacht;
		return '<a href="' + esc(k[0]) + '" style="display:inline-block;margin:0 8px 10px 0;padding:10px 18px;border-radius:999px;background:' + kleur + ';color:' + KLEUR.donker + ';font:700 14px/1.2 ' + LETTER + ';text-decoration:none">' + esc(k[1]) + '</a>';
	}).join('') + '</p>';
}

// Tabel met label/waarde-rijen; waarden zijn al geëscaped HTML
function gegevens(rijen) {
	return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:0 0 8px 0">'
		+ rijen.filter(function (r) { return r[1]; }).map(function (r) {
			const cel = 'padding:9px 0;vertical-align:top;border-bottom:1px solid ' + KLEUR.lijn;
			return '<tr><td style="' + cel + ';padding-right:14px;color:' + KLEUR.gedempt + ';white-space:nowrap;width:120px">' + esc(r[0]) + '</td>'
				+ '<td style="' + cel + '">' + r[1] + '</td></tr>';
		}).join('') + '</table>';
}

function stappen(lijst) {
	return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0">' + lijst.map(function (s, i) {
		return '<tr><td width="38" style="vertical-align:top;padding:0 0 12px 0"><div style="width:26px;height:26px;border-radius:13px;background:' + KLEUR.merk + ';color:' + KLEUR.donker + ';font:700 13px/26px ' + LETTER + ';text-align:center">' + (i + 1) + '</div></td>'
			+ '<td style="vertical-align:top;padding:3px 0 12px 0">' + s + '</td></tr>';
	}).join('') + '</table>';
}

// De bestelde producten met foto. url: het adres van de site, waar de foto's staan.
function regelsHtml(regels, totaal, voetnoot, url) {
	const cel = 'padding:12px 0;vertical-align:top;border-bottom:1px solid ' + KLEUR.lijn;
	return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">'
		+ regels.map(function (r) {
			const details = [r.variant, r.tekst ? r.tekstLabel + ': “' + esc(r.tekst) + '”' : ''].filter(Boolean).join(' · ');
			const foto = r.afbeelding
				? '<img src="' + esc(url + '/' + r.afbeelding) + '" width="48" height="60" alt="" style="display:block;border:0;border-radius:8px;background:' + KLEUR.zacht + '">'
				: '<div style="width:48px;height:60px;border-radius:8px;background:' + KLEUR.zacht + '"></div>';
			return '<tr><td width="62" style="' + cel + ';padding-right:14px">' + foto + '</td>'
				+ '<td style="' + cel + '"><strong>' + r.aantal + '× ' + esc(r.naam) + '</strong>'
				+ (details ? '<br>' + gedempt(details) : '')
				+ (r.aantal > 1 ? '<br>' + gedempt(euro(r.prijs) + ' per stuk') : '') + '</td>'
				+ '<td style="' + cel + ';padding-left:12px;text-align:right;white-space:nowrap">' + euro(r.regelTotaal) + '</td></tr>';
		}).join('')
		+ '<tr><td></td><td style="padding:14px 0 2px 0;font:700 16px/1.3 ' + KOP + '">Totaal</td>'
		+ '<td style="padding:14px 0 2px 0;text-align:right;white-space:nowrap;font:700 16px/1.3 ' + KOP + '">' + euro(totaal) + '</td></tr>'
		+ (voetnoot ? '<tr><td></td><td colspan="2" style="padding:2px 0 4px 0;color:' + KLEUR.gedempt + ';font-size:13px">' + esc(voetnoot) + '</td></tr>' : '')
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

function voetLink(href, t) { return '<a href="' + esc(href) + '" style="color:' + KLEUR.merk + ';text-decoration:none">' + esc(t) + '</a>'; }

function winkelVoet(w) {
	return '<strong style="color:' + KLEUR.licht + '">' + esc(w.naam) + '</strong>' + (w.slogan ? ' · ' + esc(w.slogan) : '') + ' · Handgemaakt in Limburg<br>'
		+ esc(w.adres) + ' · KvK ' + esc(w.kvk) + ' · Btw ' + esc(w.btw) + '<br>'
		+ [voetLink(w.url, w.url.replace(/^https?:\/\//, '')), w.instagram ? voetLink(w.instagram, 'Instagram') : '',
			voetLink(w.url + '/voorwaarden.html', 'Algemene voorwaarden'), voetLink(w.url + '/privacy.html', 'Privacyverklaring')].filter(Boolean).join(' · ');
}

// Mail naar Jelger: alles overzichtelijk bij elkaar, met knoppen om de klant meteen te mailen of te bellen.
// Antwoorden op de mail zelf gaat ook naar de klant (reply-to). extra: { id, regels, totaal, moment, dashboard }
export function mailEigenaar(data, extra, winkel) {
	const moment = datum(extra.moment);
	const klant = [
		['Naam', esc(data.naam)],
		['E-mail', link('mailto:' + data.email, esc(data.email))],
		['Telefoon', data.telefoon ? link('tel:' + data.telefoon.replace(/[^\d+]/g, ''), esc(data.telefoon)) : '']
	];
	const supabase = extra.dashboard ? [extra.dashboard, 'Open in Supabase'] : null;
	let onderwerp, preheader, inhoud, tekstversie;

	if (data.soort === 'bestelling') {
		const aantal = extra.regels.reduce(function (s, r) { return s + r.aantal; }, 0);
		onderwerp = 'Nieuwe bestelling ' + extra.id + ': ' + aantal + ' item' + (aantal === 1 ? '' : 's') + ', ' + euro(extra.totaal) + ' (' + data.levering.toLowerCase() + ')';
		preheader = data.naam + ' · ' + euro(extra.totaal) + ' · ' + (data.levering === 'Ophalen' ? 'ophalen in ' + winkel.ophaalplaats : 'verzenden naar ' + (data.plaats || ''));
		inhoud = bovenkop('Nieuwe bestelling') + titel(esc(extra.id), LETTER)
			+ alinea(gedempt(esc(moment) + ' · ' + esc(data.naam) + ' · ' + (data.levering === 'Ophalen' ? 'ophalen' : 'verzenden')))
			+ knoppen([['mailto:' + data.email + '?subject=' + encodeURIComponent('Je bestelling ' + extra.id + ' bij ' + winkel.naam), 'Mail ' + (voornaam(data.naam) || 'klant')],
				['tel:' + data.telefoon.replace(/[^\d+]/g, ''), 'Bel ' + data.telefoon], supabase])
			+ kop('Besteld')
			+ regelsHtml(extra.regels, extra.totaal, data.levering === 'Verzenden' ? 'Exclusief verzendkosten.' : 'Wordt opgehaald, geen verzendkosten.', winkel.url)
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
		preheader = data.bericht ? data.bericht.slice(0, 120) : Object.keys(data.velden || {}).map(function (l) { return data.velden[l]; }).join(' · ').slice(0, 120) || onderwerp;
		const velden = Object.keys(data.velden || {}).map(function (label) { return [label, esc(data.velden[label]).replace(/\n/g, '<br>')]; });
		inhoud = bovenkop({ contact: 'Nieuw bericht', offerte: 'Nieuwe aanvraag', printservice: 'Nieuwe printaanvraag', beschikbaarheid: 'Seintje gevraagd' }[data.soort])
			+ titel(esc(data.naam || data.email))
			+ alinea(gedempt(esc(moment) + (data.product ? ' · ' + esc(data.product) : '')))
			+ knoppen([['mailto:' + data.email + '?subject=' + encodeURIComponent('Re: ' + onderwerp), 'Beantwoorden'], supabase])
			+ (data.bericht ? citaat(data.bericht) : '')
			+ (velden.length ? gegevens(velden) : '')
			+ (data.soort === 'printservice' ? notitie('<strong>Let op:</strong> het bestand komt apart per mail. De klant heeft gelezen dat het als antwoord op jouw bericht kan worden nagestuurd.') : '')
			+ kop('Afzender')
			+ gegevens(klant.concat([['Akkoord', data.akkoord ? 'Privacyverklaring, op ' + esc(moment) : '']]));
		tekstversie = onderwerp.toUpperCase() + '\n' + moment + '\n\n'
			+ (data.bericht ? data.bericht + '\n\n' : '')
			+ Object.keys(data.velden || {}).map(function (l) { return l + ': ' + data.velden[l]; }).join('\n')
			+ '\n\nNaam: ' + (data.naam || '-') + '\nE-mail: ' + data.email;
	}

	const voet = 'Antwoord je op deze mail, dan gaat je antwoord naar ' + esc(data.email) + '.'
		+ (extra.dashboard ? '<br>' + voetLink(extra.dashboard, 'Alles terugzien in Supabase') : '');
	return {
		onderwerp: onderwerp,
		html: omhulsel(onderwerp, preheader, inhoud, voet, winkel),
		tekst: tekstversie + '\n\nAntwoorden op deze mail gaat naar ' + data.email + '.'
	};
}

// Bevestiging voor de klant
export function mailKlant(data, extra, winkel) {
	const naam = voornaam(data.naam);
	const hoi = naam ? 'Hoi ' + esc(naam) + ',' : 'Hoi,';
	const velden = Object.keys(data.velden || {}).map(function (label) { return [zonderLinks(label), zonderLinks(data.velden[label])]; });
	const afsluiting = alinea('Vragen, of wil je iets veranderen? Beantwoord gewoon deze mail.')
		+ alinea('Groet,<br><strong>' + esc(winkel.eigenaar.split(' ')[0]) + '</strong><br>' + gedempt(esc(winkel.naam)));
	let onderwerp, preheader, inhoud, tekstversie;

	if (data.soort === 'bestelling') {
		// Let op de woorden: dit is een ONTVANGSTbevestiging. "De bevestiging" uit de algemene voorwaarden
		// (met totaalprijs en levertijd, waarmee de overeenkomst ontstaat) stuurt Jelger zelf na het contact.
		onderwerp = 'Je bestelling bij ' + winkel.naam + ' is binnen (' + extra.id + ')';
		preheader = 'Bestelnummer ' + extra.id + '. Je betaalt nog niets: ik neem eerst persoonlijk contact met je op.';
		const regels = extra.regels.map(function (r) { return Object.assign({}, r, { tekst: zonderLinks(r.tekst) }); });
		const adres = zonderLinks(adresRegel(data));
		inhoud = bovenkop('Bestelling ontvangen') + titel('Bedankt voor je bestelling!')
			+ alinea(hoi + ' ik heb je bestelling goed ontvangen. Hieronder zie je wat je hebt besteld en hoe het verder gaat.')
			+ alinea(label('Bestelnummer ' + esc(extra.id)))
			+ kop('Dit heb je besteld')
			+ regelsHtml(regels, extra.totaal, data.levering === 'Verzenden' ? 'Exclusief verzendkosten. Die hoor je van mij voordat je betaalt.' : 'Je haalt het op in ' + winkel.ophaalplaats + ', dus zonder verzendkosten.', winkel.url)
			+ (data.levering === 'Verzenden' ? alinea(gedempt('Bezorgadres: ' + esc(adres)), 'margin-top:10px;font-size:14px') : '')
			+ kop('Hoe gaat het nu verder?')
			+ stappen([
				'Ik neem persoonlijk contact met je op om kleur, details en ' + (data.levering === 'Ophalen' ? 'een moment om op te halen in ' + esc(winkel.ophaalplaats) : 'de verzendkosten') + ' af te spreken.',
				'Pas als alles klopt, betaal je en ga ik voor je printen.',
				esc(winkel.levertijd)
			])
			+ notitie('<strong>Dit is een ontvangstbevestiging:</strong> je hoeft nu nog niets te betalen. Na ons contact krijg je van mij de definitieve bevestiging met de totaalprijs, inclusief eventuele verzendkosten, en de levertijd. Pas als jij die goedkeurt, is de bestelling definitief.')
			+ afsluiting;
		tekstversie = (naam ? 'Hoi ' + naam + ',' : 'Hoi,') + '\n\nBedankt voor je bestelling! Je bestelnummer is ' + extra.id + '.\n\n' + regelsTekst(regels, extra.totaal)
			+ (data.levering === 'Verzenden' ? '\n(exclusief verzendkosten)\nBezorgadres: ' + adres : '\nJe haalt het op in ' + winkel.ophaalplaats + '.')
			+ '\n\nHoe nu verder: ik neem persoonlijk contact met je op. Pas als alles klopt, betaal je en ga ik printen. ' + winkel.levertijd
			+ '\n\nDit is een ontvangstbevestiging: je hoeft nu nog niets te betalen. Na ons contact krijg je de definitieve bevestiging met de totaalprijs en de levertijd.';
	} else if (data.soort === 'beschikbaarheid') {
		onderwerp = 'Je hoort het zodra de ' + data.product + ' er weer is';
		preheader = 'Eén mail zodra hij weer te bestellen is. Verder niets.';
		inhoud = bovenkop('Je staat genoteerd') + titel('Je hoort het als eerste')
			+ alinea('Hoi, zodra de <strong>' + esc(data.product) + '</strong> weer te bestellen is, krijg je één mail van mij. Verder niets.') + afsluiting;
		tekstversie = 'Je staat genoteerd: zodra de ' + data.product + ' weer te bestellen is, krijg je één mail van mij.';
	} else {
		const wat = TITELS[data.soort];
		onderwerp = data.soort === 'contact' ? 'Je bericht aan ' + winkel.naam + ' is binnen' : 'Je ' + wat + ' bij ' + winkel.naam + ' is binnen';
		preheader = data.soort === 'contact' ? 'Ik reageer zo snel mogelijk, meestal binnen een paar dagen.' : 'Je hoort zo snel mogelijk wat het kost en hoe lang het duurt.';
		const bericht = zonderLinks(data.bericht);
		inhoud = bovenkop(wat.charAt(0).toUpperCase() + wat.slice(1) + ' ontvangen') + titel('Bedankt voor je ' + wat + '!')
			+ alinea(hoi + ' ' + (data.soort === 'contact' ? 'ik reageer zo snel mogelijk, meestal binnen een paar dagen.'
				: 'je ' + wat + (data.soort === 'offerte' && data.product ? ' voor de <strong>' + esc(data.product) + '</strong>' : '') + ' is binnen. Ik laat je zo snel mogelijk weten wat het kost en hoe lang het duurt.'))
			+ (data.soort === 'printservice' ? notitie('<strong>Stuur je bestand (STL of 3MF) als antwoord op deze mail</strong>, als je dat nog niet hebt gedaan. Dan kan ik het meteen bekijken.') : '')
			+ kop('Wat je hebt gestuurd')
			+ (bericht ? citaat(bericht) : gegevens(velden.map(function (r) { return [r[0], esc(r[1]).replace(/\n/g, '<br>')]; })))
			+ alinea('Je zit nergens aan vast: eerst hoor je van mij, daarna beslis je.')
			+ afsluiting;
		tekstversie = 'Bedankt voor je ' + wat + '. Ik reageer zo snel mogelijk.\n\n' + (bericht || velden.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n'));
	}
	return {
		onderwerp: onderwerp,
		html: omhulsel(onderwerp, preheader, inhoud, winkelVoet(winkel), winkel),
		tekst: tekstversie + '\n\n' + winkel.naam + ' · ' + winkel.adres + ' · KvK ' + winkel.kvk + ' · ' + winkel.url
	};
}
