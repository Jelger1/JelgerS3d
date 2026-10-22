// Gedeelde logica van de Edge Function "formulier": invoer controleren, spam herkennen, prijzen narekenen
// en de mails opbouwen. Gewoon JavaScript zonder Deno- of Node-specifieke dingen, zodat dit bestand ook
// buiten Supabase te testen is. index.ts doet de rest (database, mail versturen, limieten).

export const SOORTEN = ['bestelling', 'contact', 'offerte', 'printservice', 'beschikbaarheid', 'nieuwsbrief'];
export const MIN_DUUR_MS = 2000;   // sneller dan dit kan een mens geen formulier invullen
export const MAX_LINKS = 2;        // meer links in een bericht: vrijwel altijd SEO-spam
// Waar iemand zich voor de nieuwsbrief aanmeldde: onderaan een pagina, op de bedanktpagina, op de aanmeldpagina
// (jelgers3d.nl/nieuwsbrief, om te delen op social media) of met het vinkje in een formulier
export const BRONNEN = ['footer', 'bedankt', 'pagina', 'bestelling', 'contact', 'offerte', 'printservice'];

const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
	if (data.soort === 'nieuwsbrief') {
		data.bron = BRONNEN.indexOf(invoer.bron) !== -1 ? invoer.bron : 'footer';
		return { ok: true, data: data };
	}
	if (data.soort !== 'beschikbaarheid' && !data.naam) return fout('Vul je naam in.');
	// Het vinkje "houd me op de hoogte": alleen een verzoek, pas na de bevestigingsknop in de mail sta je op de lijst
	if (data.soort !== 'beschikbaarheid') data.nieuwsbrief = invoer.nieuwsbrief === true;
	// Het portfolio (jelgersieler.nl, JSdesign) stuurt alleen contactberichten; de nieuwsbrief hoort bij de winkel
	if (invoer.site === 'portfolio' && data.soort === 'contact') {
		data.site = 'portfolio';
		data.nieuwsbrief = false;
	}

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
		// Al geüploade bestanden (de id's die de functie bij het uploaden gaf); index.ts controleert of ze bestaan
		if (data.soort !== 'beschikbaarheid' && Array.isArray(invoer.bestanden)) {
			data.bestanden = invoer.bestanden.filter(function (id) { return typeof id === 'string' && UUID.test(id); }).slice(0, 10);
		}
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

// ---------------------------------------------------------------------------------------------- bestanden

// De naam zoals de bezoeker hem koos, maar zonder map, vreemde tekens of eindeloze lengte. Alleen voor de mails en
// als naam bij het downloaden: in de opslag krijgt elk bestand een eigen, willekeurige naam.
export function bestandsnaam(naam) {
	const schoon = String(naam == null ? '' : naam).split(/[\\/]/).pop()
		.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').replace(/\s+/g, ' ').trim();
	if (schoon.length <= 120) return schoon;
	const punt = schoon.lastIndexOf('.');
	const ext = punt > 0 && schoon.length - punt <= 10 ? schoon.slice(punt) : '';
	return schoon.slice(0, 120 - ext.length) + ext;
}

export function extensie(naam) {
	const punt = naam.lastIndexOf('.');
	return punt > 0 ? naam.slice(punt + 1).toLowerCase() : '';
}

// "STL of 3MF", "SVG, PNG, JPG, PDF, AI of EPS" (jpeg is hetzelfde als jpg)
export function typesTekst(types) {
	const lijst = types.filter(function (t) { return t !== 'jpeg'; }).map(function (t) { return t.toUpperCase(); });
	return lijst.length > 1 ? lijst.slice(0, -1).join(', ') + ' of ' + lijst[lijst.length - 1] : lijst.join('');
}

export function grootteTekst(bytes) {
	if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' kB';
	return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}

// Controleert welke bestanden iemand wil uploaden, vóórdat de functie er een uploadadres voor geeft.
// lijst: [{ naam, grootte }] uit de browser. uploads: de instellingen uit winkel.json (data/site.json > uploads).
export function controleerBestanden(lijst, soort, uploads) {
	const fout = function (bericht) { return { ok: false, fout: bericht }; };
	const regels = uploads && heeft(uploads, soort) && uploads[soort] && Array.isArray(uploads[soort].types) ? uploads[soort] : null;
	if (!regels) return fout('Bij dit formulier kun je geen bestanden meesturen.');
	if (!Array.isArray(lijst) || !lijst.length) return fout('Kies eerst een bestand.');
	if (lijst.length > regels.max) return fout('Je kunt hooguit ' + regels.max + ' bestanden meesturen.');
	const max = uploads.maxMB * 1024 * 1024;
	const uit = [];
	for (let i = 0; i < lijst.length; i++) {
		const b = lijst[i] && typeof lijst[i] === 'object' ? lijst[i] : {};
		const naam = bestandsnaam(b.naam);
		const grootte = Math.floor(Number(b.grootte));
		if (!naam || regels.types.indexOf(extensie(naam)) === -1) return fout((naam || 'Dit bestand') + ' kan ik niet gebruiken. Dit kan wel: ' + typesTekst(regels.types) + '.');
		if (!(grootte > 0)) return fout(naam + ' is leeg.');
		if (grootte > max) return fout(naam + ' is groter dan ' + uploads.maxMB + ' MB. Mail dat bestand gerust na.');
		uit.push({ naam: naam, ext: extensie(naam), grootte: grootte });
	}
	return { ok: true, bestanden: uit };
}

// ---------------------------------------------------------------------------------------------- mails
//
// In de stijl van de site: een Midnight Slate-kader met het JS-teken, een Misty Sage-kaart met de raspberry-aqua
// balk, koppen in Saira Expanded en tekst in DM Sans (mailprogramma's zonder webfonts, zoals Gmail, tonen Arial). Alles
// met tabellen en inline stijlen, want veel mailprogramma's negeren de rest. De plaatjes staan op de site zelf
// (assets/mail/, gemaakt door build.js). Licht in het midden houdt de mail goed leesbaar, ook als iemand hem uitprint.

const KLEUR = {
	donker: '#080a0d', merk: '#03bcca', roze: '#f10067', kaart: '#f3fffd', zacht: '#e1efed', grijs: '#98a4a3',
	licht: '#f3fffd', tekst: '#080a0d', gedempt: '#56606b', link: '#027a8c', lijn: '#d9e6e4' // gedempt en link: genoeg contrast op de kaart
};
const KOP = "'Saira','Arial Narrow',Arial,sans-serif";
const LOGO = "'Stevie Sans','Saira',Arial,sans-serif"; // de naam naast het teken, zoals in het logo
const LETTER = "'DM Sans','Segoe UI',Arial,Helvetica,sans-serif";
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
		+ '<style>@font-face{font-family:"Saira";font-weight:600 900;font-stretch:100% 125%;src:url(' + url + '/assets/fonts/saira-latin.woff2) format("woff2")}'
		+ '@font-face{font-family:"Stevie Sans";font-weight:400 599;src:url(' + url + '/assets/fonts/stevie-sans-medium.woff2) format("woff2")}'
		+ '@font-face{font-family:"DM Sans";font-weight:300 700;src:url(' + url + '/assets/fonts/dm-sans-latin.woff2) format("woff2")}'
		+ 'h1,h2{font-stretch:125%}'
		+ '@media (max-width:480px){.kaart{padding:26px 20px 10px 20px!important}}</style></head>'
		+ '<body style="margin:0;padding:0;background:' + KLEUR.donker + '">'
		+ '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:' + KLEUR.donker + '">' + esc(preheader) + '&#847;&zwnj;&nbsp;'.repeat(30) + '</div>'
		+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + KLEUR.donker + '" style="background:' + KLEUR.donker + '"><tr><td align="center" style="padding:28px 12px 36px 12px">'
		+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">'
		+ '<tr><td style="padding:0 4px 20px 4px"><a href="' + esc(url) + '" style="text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0"><tr>'
		+ '<td style="padding:0 12px 0 0"><img src="' + esc(url) + '/assets/mail/logo.png" width="44" height="41" alt="" style="display:block;border:0;outline:none"></td>'
		+ '<td style="font:500 20px/1 ' + LOGO + ';letter-spacing:0.06em;text-transform:uppercase;color:' + KLEUR.licht + '">' + esc(winkel.naam) + '</td></tr></table></a></td></tr>'
		+ '<tr><td bgcolor="' + KLEUR.kaart + '" style="background:' + KLEUR.kaart + ';border-radius:16px;overflow:hidden">'
		+ '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
		+ '<tr><td height="4" bgcolor="' + KLEUR.merk + '" style="height:4px;line-height:4px;font-size:0;background:' + KLEUR.merk + ';background-image:linear-gradient(90deg,' + KLEUR.roze + ',' + KLEUR.merk + ')">&nbsp;</td></tr>'
		+ '<tr><td class="kaart" style="padding:32px 32px 14px 32px;font:15px/1.6 ' + LETTER + ';color:' + KLEUR.tekst + '">' + inhoud + '</td></tr>'
		+ '</table></td></tr>'
		+ '<tr><td style="padding:22px 4px 0 4px;font:12px/1.7 ' + LETTER + ';color:' + KLEUR.grijs + '">' + voet + '</td></tr>'
		+ '</table></td></tr></table></body></html>';
}

function bovenkop(t) { return '<p style="margin:0 0 6px 0;font:700 12px/1.4 ' + LETTER + ';letter-spacing:0.08em;text-transform:uppercase;color:' + KLEUR.link + '">' + esc(t) + '</p>'; }
// letter: andere letter dan de koppen, voor een bestelnummer (dat moet je makkelijk kunnen overtypen)
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

// Meegestuurde bestanden. Voor Jelger met een downloadlink (b.link), voor de klant alleen naam en grootte.
function bestandenLijst(lijst, metLink) {
	const cel = 'padding:9px 0;vertical-align:top;border-bottom:1px solid ' + KLEUR.lijn;
	return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:0 0 12px 0">'
		+ lijst.map(function (b) {
			const naam = metLink ? b.naam : zonderLinks(b.naam);
			return '<tr><td style="' + cel + '"><strong>' + esc(naam) + '</strong><br>' + gedempt(grootteTekst(b.grootte)) + '</td>'
				+ (metLink ? '<td style="' + cel + ';padding-left:12px;text-align:right;white-space:nowrap">' + link(b.link, 'Downloaden') + '</td>' : '')
				+ '</tr>';
		}).join('') + '</table>';
}

// Het vinkje "houd me op de hoogte" werd aangezet: de bevestiging zit in de mail zelf, dus geen aparte mail
function nieuwsbriefBlok(href) {
	return '<div style="background:' + KLEUR.zacht + ';border-radius:12px;padding:16px 18px 6px 18px;margin:6px 0 18px 0">'
		+ '<p style="margin:0 0 10px 0;font-size:14px"><strong>Als eerste horen over nieuwe ontwerpen?</strong> Je vinkte aan dat je op de hoogte wilt blijven. '
		+ 'Bevestig dat met één klik. Doe je niets, dan sta je ook niet op de lijst.</p>'
		+ knoppen([[href, 'Ja, houd me op de hoogte']]) + '</div>';
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

// w.portfolio: een mail over een bericht via het portfolio (JSdesign). Dat is geen winkel: geen voorwaarden of KvK-regel.
function winkelVoet(w) {
	return '<strong style="color:' + KLEUR.licht + '">' + esc(w.naam) + '</strong>' + (w.slogan ? ' · ' + esc(w.slogan) : '') + (w.portfolio ? '' : ' · Handgemaakt in Limburg') + '<br>'
		+ (w.portfolio ? '' : esc(w.adres) + ' · KvK ' + esc(w.kvk) + ' · Btw ' + esc(w.btw) + '<br>')
		+ [voetLink(w.url, w.url.replace(/^https?:\/\//, '')), w.instagram ? voetLink(w.instagram, 'Instagram') : '',
			w.portfolio ? '' : voetLink(w.url + '/voorwaarden.html', 'Algemene voorwaarden'), voetLink(w.url + '/privacy.html', 'Privacyverklaring')].filter(Boolean).join(' · ');
}

function voetTekst(w) {
	return w.portfolio ? w.naam + ' · ' + w.url : w.naam + ' · ' + w.adres + ' · KvK ' + w.kvk + ' · ' + w.url;
}

// Mail naar Jelger: alles overzichtelijk bij elkaar, met knoppen om de klant meteen te mailen of te bellen.
// Antwoorden op de mail zelf gaat ook naar de klant (reply-to).
// extra: { id, regels, totaal, moment, dashboard, gereageerdLink, bestanden: [{ naam, grootte, link }], bewaarMaanden }
export function mailEigenaar(data, extra, winkel) {
	const moment = datum(extra.moment);
	const klant = [
		['Naam', esc(data.naam)],
		['E-mail', link('mailto:' + data.email, esc(data.email))],
		['Telefoon', data.telefoon ? link('tel:' + data.telefoon.replace(/[^\d+]/g, ''), esc(data.telefoon)) : '']
	];
	// Na het antwoorden één tik, dan komt er geen herinnering (de functie kan je antwoord in Gmail niet zien)
	const gereageerd = extra.gereageerdLink ? [extra.gereageerdLink, 'Ik heb gereageerd'] : null;
	const bestanden = extra.bestanden || [];
	let onderwerp, preheader, inhoud, tekstversie;

	if (data.soort === 'bestelling') {
		const aantal = extra.regels.reduce(function (s, r) { return s + r.aantal; }, 0);
		onderwerp = 'Nieuwe bestelling ' + extra.id + ': ' + aantal + ' item' + (aantal === 1 ? '' : 's') + ', ' + euro(extra.totaal) + ' (' + data.levering.toLowerCase() + ')';
		preheader = data.naam + ' · ' + euro(extra.totaal) + ' · ' + (data.levering === 'Ophalen' ? 'ophalen in ' + winkel.ophaalplaats : 'verzenden naar ' + (data.plaats || ''));
		inhoud = bovenkop('Nieuwe bestelling') + titel(esc(extra.id), LETTER)
			+ alinea(gedempt(esc(moment) + ' · ' + esc(data.naam) + ' · ' + (data.levering === 'Ophalen' ? 'ophalen' : 'verzenden')))
			+ knoppen([['mailto:' + data.email + '?subject=' + encodeURIComponent('Je bestelling ' + extra.id + ' bij ' + winkel.naam), 'Mail ' + (voornaam(data.naam) || 'klant')],
				['tel:' + data.telefoon.replace(/[^\d+]/g, ''), 'Bel ' + data.telefoon], gereageerd])
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
		const viaPortfolio = data.site === 'portfolio';
		onderwerp = data.soort === 'contact' ? 'Nieuw bericht van ' + data.naam + (viaPortfolio ? ' via ' + winkel.url.replace(/^https?:\/\//, '') : '')
			: data.soort === 'beschikbaarheid' ? data.email + ' wil een seintje over de ' + data.product
			: 'Nieuwe ' + soortNaam + (data.soort === 'offerte' && data.product ? ' ' + data.product : '') + ' van ' + data.naam;
		preheader = data.bericht ? data.bericht.slice(0, 120) : Object.keys(data.velden || {}).map(function (l) { return data.velden[l]; }).join(' · ').slice(0, 120) || onderwerp;
		const velden = Object.keys(data.velden || {}).map(function (label) { return [label, esc(data.velden[label]).replace(/\n/g, '<br>')]; });
		inhoud = bovenkop({ contact: viaPortfolio ? 'Nieuw bericht via je portfolio' : 'Nieuw bericht', offerte: 'Nieuwe aanvraag', printservice: 'Nieuwe printaanvraag', beschikbaarheid: 'Seintje gevraagd' }[data.soort])
			+ titel(esc(data.naam || data.email))
			+ alinea(gedempt(esc(moment) + (data.product ? ' · ' + esc(data.product) : '')))
			+ knoppen([['mailto:' + data.email + '?subject=' + encodeURIComponent('Re: ' + onderwerp), 'Beantwoorden'], gereageerd])
			+ (data.bericht ? citaat(data.bericht) : '')
			+ (velden.length ? gegevens(velden) : '')
			+ (bestanden.length
				? kop(bestanden.length === 1 ? 'Bestand' : 'Bestanden') + bestandenLijst(bestanden, true)
					+ (extra.bewaarMaanden ? alinea(gedempt('De bestanden blijven ' + extra.bewaarMaanden + ' maanden bewaard; daarna verwijdert de site ze automatisch.'), 'font-size:13px') : '')
				: data.soort === 'printservice' ? notitie('<strong>Let op:</strong> er is geen bestand geüpload. De klant heeft gelezen dat het als antwoord op jouw bericht kan worden nagestuurd.') : '')
			+ kop('Afzender')
			+ gegevens(klant.concat([['Akkoord', data.akkoord ? 'Privacyverklaring, op ' + esc(moment) : '']]));
		tekstversie = onderwerp.toUpperCase() + '\n' + moment + '\n\n'
			+ (data.bericht ? data.bericht + '\n\n' : '')
			+ Object.keys(data.velden || {}).map(function (l) { return l + ': ' + data.velden[l]; }).join('\n')
			+ (bestanden.length ? '\n\nBESTANDEN\n' + bestanden.map(function (b) { return b.naam + ' (' + grootteTekst(b.grootte) + '): ' + b.link; }).join('\n') : '')
			+ '\n\nNaam: ' + (data.naam || '-') + '\nE-mail: ' + data.email;
	}
	if (extra.gereageerdLink) tekstversie += '\n\nIk heb gereageerd: ' + extra.gereageerdLink;

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
	const nieuwsbrief = extra.nieuwsbriefLink ? nieuwsbriefBlok(extra.nieuwsbriefLink) : '';
	const bestanden = extra.bestanden || [];
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
			+ nieuwsbrief + afsluiting;
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
			+ (data.soort === 'printservice' && !bestanden.length ? notitie('<strong>Stuur je bestand (STL of 3MF) als antwoord op deze mail</strong>, als je dat nog niet hebt gedaan. Dan kan ik het meteen bekijken.') : '')
			+ kop('Wat je hebt gestuurd')
			+ (bericht ? citaat(bericht) : gegevens(velden.map(function (r) { return [r[0], esc(r[1]).replace(/\n/g, '<br>')]; })))
			+ (bestanden.length ? alinea('<strong>' + (bestanden.length === 1 ? 'Je bestand is' : 'Je bestanden zijn') + ' goed aangekomen:</strong>', 'margin-top:14px') + bestandenLijst(bestanden, false) : '')
			+ alinea('Je zit nergens aan vast: eerst hoor je van mij, daarna beslis je.')
			+ nieuwsbrief + afsluiting;
		tekstversie = 'Bedankt voor je ' + wat + '. Ik reageer zo snel mogelijk.\n\n' + (bericht || velden.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n'))
			+ (bestanden.length ? '\n\nGoed aangekomen: ' + bestanden.map(function (b) { return zonderLinks(b.naam) + ' (' + grootteTekst(b.grootte) + ')'; }).join(', ') : '');
	}
	if (extra.nieuwsbriefLink) tekstversie += '\n\nJe vinkte aan dat je op de hoogte wilt blijven van nieuwe ontwerpen. Bevestig dat met deze link: ' + extra.nieuwsbriefLink;
	return {
		onderwerp: onderwerp,
		html: omhulsel(onderwerp, preheader, inhoud, winkelVoet(winkel), winkel),
		tekst: tekstversie + '\n\n' + voetTekst(winkel)
	};
}

// Aanmelden voor de nieuwsbrief onderaan een pagina of op de bedanktpagina: eerst bevestigen (dubbele opt-in), zodat
// niemand een ander kan aanmelden. href: de bevestigingspagina op de site, met het geheime token erin.
export function mailNieuwsbrief(href, winkel) {
	const onderwerp = 'Bevestig je aanmelding voor de nieuwsbrief van ' + winkel.naam;
	const inhoud = bovenkop('Nog één klik') + titel('Bevestig je aanmelding')
		+ alinea('Hoi, leuk dat je als eerste wilt horen over nieuwe ontwerpen van ' + esc(winkel.naam) + '! Klik op de knop om je aanmelding te bevestigen.')
		+ knoppen([[href, 'Ja, ik meld me aan']])
		+ alinea(gedempt('Afmelden kan daarna altijd, met één klik onderaan elke mail. Heb je je niet aangemeld? Dan hoef je niets te doen: zonder bevestiging sta je niet op de lijst.'), 'font-size:14px;margin-top:8px')
		+ alinea('Groet,<br><strong>' + esc(winkel.eigenaar.split(' ')[0]) + '</strong><br>' + gedempt(esc(winkel.naam)));
	return {
		onderwerp: onderwerp,
		html: omhulsel(onderwerp, 'Nog één klik: bevestig dat je mails over nieuwe ontwerpen wilt ontvangen.', inhoud, winkelVoet(winkel), winkel),
		tekst: 'Leuk dat je als eerste wilt horen over nieuwe ontwerpen van ' + winkel.naam + '! Bevestig je aanmelding met deze link:\n' + href
			+ '\n\nHeb je je niet aangemeld? Dan hoef je niets te doen: zonder bevestiging sta je niet op de lijst.'
			+ '\n\n' + voetTekst(winkel)
	};
}

// ---------------------------------------------------------------------------------------------- herinnering

const WOORDEN = { bestelling: ['bestelling', 'bestellingen'], aanvraag: ['aanvraag', 'aanvragen'], bericht: ['bericht', 'berichten'] };
function woord(soort) { return soort === 'bestelling' ? 'bestelling' : soort === 'contact' ? 'bericht' : 'aanvraag'; }

// "2 bestellingen en 1 bericht"
export function telling(items) {
	const aantal = {};
	items.forEach(function (it) { aantal[woord(it.soort)] = (aantal[woord(it.soort)] || 0) + 1; });
	const delen = Object.keys(WOORDEN).filter(function (w) { return aantal[w]; }).map(function (w) { return aantal[w] + ' ' + WOORDEN[w][aantal[w] === 1 ? 0 : 1]; });
	return delen.length > 1 ? delen.slice(0, -1).join(', ') + ' en ' + delen[delen.length - 1] : delen.join('');
}

// Herinnering aan Jelger: bestellingen en aanvragen die al een paar dagen op "nieuw" staan.
// items: [{ soort, id, naam, email, product, totaal, levering, tekst, aangemaakt, keer, gereageerdLink, merk }]; nu: tijdstip in ms
// merk: alleen bij een bericht via het portfolio, de naam daarvan (JSdesign)
export function mailHerinnering(items, winkel, nu, dashboard) {
	const onderwerp = 'Herinnering: ' + telling(items) + ' ' + (items.length === 1 ? 'wacht' : 'wachten') + ' op je reactie';
	const regels = items.map(function (it) {
		const dagen = Math.max(1, Math.floor((nu - new Date(it.aangemaakt).getTime()) / 86400000));
		const kop = it.soort === 'bestelling' ? 'Bestelling ' + it.id : it.soort === 'contact' ? 'Bericht' + (it.merk ? ' via je portfolio' : '') : it.soort === 'printservice' ? 'Printaanvraag' : 'Aanvraag' + (it.product ? ' ' + it.product : '');
		const vol = it.soort === 'bestelling' ? euro(it.totaal) + ' · ' + String(it.levering || '').toLowerCase() : String(it.tekst || '').replace(/\s+/g, ' ').trim();
		const samenvatting = vol.length > 160 ? vol.slice(0, 157) + '…' : vol;
		const wie = (it.naam || it.email) + ' · ' + dagen + (dagen === 1 ? ' dag' : ' dagen') + ' geleden' + (it.keer > 1 ? ' · tweede herinnering' : '');
		const mailOnderwerp = it.soort === 'bestelling' ? 'Je bestelling ' + it.id + ' bij ' + winkel.naam : 'Je ' + TITELS[it.soort] + ' bij ' + (it.merk || winkel.naam);
		return { kop: kop, wie: wie, samenvatting: samenvatting, it: it, mailto: 'mailto:' + it.email + '?subject=' + encodeURIComponent(mailOnderwerp) };
	});
	const inhoud = bovenkop('Herinnering') + titel('Nog niet gereageerd')
		+ alinea((items.length === 1 ? 'Deze staat' : 'Deze staan') + ' al een paar dagen op "nieuw". Heb je al gereageerd? Tik dan op <strong>Ik heb gereageerd</strong>, dan hoor je er niets meer over.')
		+ regels.map(function (r) {
			return '<div style="border:1px solid ' + KLEUR.lijn + ';border-radius:12px;padding:14px 16px 4px 16px;margin:0 0 12px 0">'
				+ '<p style="margin:0 0 2px 0;font-weight:700">' + esc(r.kop) + '</p>'
				+ '<p style="margin:0 0 8px 0;font-size:13px;color:' + KLEUR.gedempt + '">' + esc(r.wie) + '</p>'
				+ (r.samenvatting ? '<p style="margin:0 0 6px 0;font-size:14px">' + esc(r.samenvatting) + '</p>' : '')
				+ knoppen([[r.it.gereageerdLink, 'Ik heb gereageerd'], [r.mailto, 'Mail ' + (voornaam(r.it.naam) || 'klant')]])
				+ '</div>';
		}).join('');
	const voet = 'Je krijgt hooguit twee herinneringen per bestelling of aanvraag: na twee en na vijf dagen.'
		+ (dashboard ? '<br>' + voetLink(dashboard, 'Alles bekijken in Supabase') : '');
	return {
		onderwerp: onderwerp,
		html: omhulsel(onderwerp, regels.map(function (r) { return r.kop + ' (' + r.wie + ')'; }).join(' · ').slice(0, 150), inhoud, voet, winkel),
		tekst: onderwerp.toUpperCase() + '\n\n' + regels.map(function (r) {
			return r.kop + '\n' + r.wie + (r.samenvatting ? '\n' + r.samenvatting : '') + '\nIk heb gereageerd: ' + r.it.gereageerdLink;
		}).join('\n\n')
	};
}
