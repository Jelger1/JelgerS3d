// Tests voor de logica van de Supabase-functie "formulier" (supabase/functions/formulier/logica.js):
// invoer controleren, spam herkennen, prijzen narekenen en de mails. Draai met: npm test
// Bouw eerst de site (npm run build): de laatste test rekent alle producten uit dist/js/winkel.json na.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
	controleer, spamSignaal, stilWeggooien, prijzen, ordernummer, mailEigenaar, mailKlant, ontcijferMail, MIN_DUUR_MS,
	controleerBestanden, bestandsnaam, grootteTekst, typesTekst, mailNieuwsbrief, mailHerinnering, telling
} from '../supabase/functions/formulier/logica.js';
import helpers from '../src/templates/helpers.js';

const CATALOGUS = {
	vaas: { name: 'Kami Vase', sale: 'cart', variants: [{ id: 'm', label: 'Medium', price: 24.95 }, { id: 'l', label: 'Large', price: 34.95 }], personalize: false, wish: true, mailImage: 'assets/mail/kami-vase-c-400.jpg' },
	hanger: { name: 'Straatnaam Sleutelhanger', sale: 'cart', variants: [{ id: 'standaard', label: '', price: 3.95 }], personalize: true, wish: false },
	lamp: { name: 'Helio Lamp', sale: 'cart', variants: [{ id: 'standaard', price: 0.1 }], personalize: false, wish: false },
	lightbox: { name: 'Custom Lightbox', sale: 'request', variants: [], personalize: false, wish: false },
	non: { name: 'Blonde Non', sale: 'external', variants: [], personalize: false, wish: false }
};
const WINKEL = {
	naam: 'JelgerS3D', eigenaar: 'Jelger Sieler', mail: helpers.mailCode('info@example.nl'), url: 'https://jelgers3d.nl',
	instagram: 'https://www.instagram.com/jelgers3d/', slogan: '3D-design met karakter',
	adres: 'Abtenlaan 42, Kerkrade', kvk: '12345678', btw: 'NL000000000B00', ophaalplaats: 'Kerkrade',
	levertijd: 'Ik streef ernaar dat het binnen een week klaar is.'
};

function bestelling(extra) {
	return Object.assign({
		soort: 'bestelling', naam: ' Anne-Marie  de Vries ', email: ' Anne@Example.NL ', telefoon: '06 12345678', akkoord: true, duur: 30000,
		bestelling: { levering: 'Verzenden', adres: 'Straat 1', postcode: '6461 AA', plaats: 'Kerkrade', land: 'Nederland', opmerkingen: 'Graag\nin het rood', regels: [{ id: 'vaas', variant: 'm', aantal: 2, tekst: 'Rood' }] }
	}, extra);
}
const ok = function (invoer) { const r = controleer(invoer, CATALOGUS); assert.equal(r.ok, true, r.fout); return r.data; };
const fout = function (invoer) { const r = controleer(invoer, CATALOGUS); assert.equal(r.ok, false); return r.fout; };

test('controleer: onbekende of kapotte aanvragen', function () {
	assert.equal(fout(null), 'Ongeldige aanvraag.');
	assert.equal(fout([]), 'Ongeldige aanvraag.');
	assert.equal(fout({ soort: 'iets' }), 'Onbekend formulier.');
	assert.equal(fout({ soort: 'contact', naam: 'Jan', email: 'geen-adres', bericht: 'Hoi' }), 'Vul een geldig e-mailadres in.');
	assert.equal(fout({ soort: 'contact', naam: 'Jan', email: 'jan@voorbeeld', bericht: 'Hoi' }), 'Vul een geldig e-mailadres in.');
});

test('controleer: contact', function () {
	assert.equal(fout({ soort: 'contact', email: 'jan@voorbeeld.nl', bericht: 'Hoi' }), 'Vul je naam in.');
	assert.equal(fout({ soort: 'contact', naam: 'Jan', email: 'jan@voorbeeld.nl', bericht: '   ' }), 'Vul je bericht in.');
	const d = ok({ soort: 'contact', naam: '  Jan   Jansen ', email: 'JAN@Voorbeeld.nl', bericht: '  Regel 1\r\nRegel 2  ', akkoord: true });
	assert.equal(d.naam, 'Jan Jansen');
	assert.equal(d.email, 'jan@voorbeeld.nl');
	assert.equal(d.bericht, 'Regel 1\nRegel 2');
	assert.equal(d.akkoord, true);
	assert.equal(ok({ soort: 'contact', naam: 'Jan', email: 'jan@voorbeeld.nl', bericht: 'x', akkoord: 'ja' }).akkoord, false);
});

test('controleer: de productnaam komt uit de catalogus, niet van de bezoeker', function () {
	assert.equal(ok({ soort: 'offerte', naam: 'Jan', email: 'jan@voorbeeld.nl', product: 'lightbox', velden: { Wens: 'Logo' } }).product, 'Custom Lightbox');
	assert.equal(ok({ soort: 'offerte', naam: 'Jan', email: 'jan@voorbeeld.nl', product: 'GOEDKOPE PILLEN', velden: { Wens: 'Logo' } }).product, '');
	assert.equal(ok({ soort: 'offerte', naam: 'Jan', email: 'jan@voorbeeld.nl', product: '__proto__', velden: { Wens: 'Logo' } }).product, '');
	assert.equal(ok({ soort: 'printservice', naam: 'Jan', email: 'jan@voorbeeld.nl', product: 'iets anders', velden: { Model: 'Een vaas' } }).product, '3D-printservice');
	assert.equal(ok({ soort: 'beschikbaarheid', email: 'jan@voorbeeld.nl', product: 'non' }).product, 'Blonde Non');
	assert.match(fout({ soort: 'beschikbaarheid', email: 'jan@voorbeeld.nl', product: 'bestaat-niet' }), /bestaat niet meer/);
});

test('controleer: aanvragen met velden', function () {
	assert.equal(fout({ soort: 'offerte', naam: 'Jan', email: 'jan@voorbeeld.nl', product: 'lightbox', velden: { Wens: '  ' } }), 'Vertel kort wat je wilt laten maken.');
	assert.equal(fout({ soort: 'printservice', naam: 'Jan', email: 'jan@voorbeeld.nl', velden: [] }), 'Vertel kort wat je wilt laten maken.');
	const veel = {};
	for (let i = 0; i < 20; i++) veel['Veld ' + i] = 'waarde ' + i;
	const d = ok({ soort: 'offerte', naam: 'Jan', email: 'jan@voorbeeld.nl', product: 'lightbox', velden: Object.assign({ 'Leeg': '' }, veel) });
	assert.equal(Object.keys(d.velden).length, 11, 'hooguit 12 velden, lege vallen weg');
	assert.equal(ok({ soort: 'beschikbaarheid', email: 'jan@voorbeeld.nl', product: 'non' }).naam, '', 'naam is hier niet verplicht');
});

test('controleer: bestelling', function () {
	const d = ok(bestelling());
	assert.equal(d.naam, 'Anne-Marie de Vries');
	assert.equal(d.email, 'anne@example.nl');
	assert.equal(d.opmerkingen, 'Graag\nin het rood');
	assert.deepEqual(d.regels, [{ id: 'vaas', variant: 'm', aantal: 2, tekst: 'Rood' }]);

	assert.equal(fout(bestelling({ telefoon: ' ' })), 'Vul je telefoonnummer in.');
	assert.equal(fout(bestelling({ bestelling: { levering: 'Verzenden', adres: 'Straat 1', regels: [{ id: 'vaas', variant: 'm', aantal: 1 }] } })), 'Vul je adres volledig in.');
	const ophalen = ok(bestelling({ bestelling: { levering: 'Ophalen', regels: [{ id: 'vaas', variant: 'm', aantal: 1 }] } }));
	assert.equal(ophalen.levering, 'Ophalen');
	assert.equal(ophalen.adres, undefined);
	assert.equal(ok(bestelling({ bestelling: { levering: 'Raket', adres: 'a', postcode: 'b', plaats: 'c', regels: [{ id: 'vaas', variant: 'm', aantal: 1 }] } })).levering, 'Verzenden');

	assert.equal(fout(bestelling({ bestelling: { levering: 'Ophalen', regels: [] } })), 'Je winkelwagen is leeg.');
	assert.match(fout(bestelling({ bestelling: { levering: 'Ophalen', regels: new Array(51).fill({ id: 'vaas', variant: 'm', aantal: 1 }) } })), /te veel regels/);
	for (const aantal of [0, -1, 100, 'veel', 1.5e9]) {
		assert.match(fout(bestelling({ bestelling: { levering: 'Ophalen', regels: [{ id: 'vaas', variant: 'm', aantal: aantal }] } })), /klopt iets niet/, 'aantal ' + aantal);
	}
	assert.equal(ok(bestelling({ bestelling: { levering: 'Ophalen', regels: [{ id: 'vaas', variant: 'm', aantal: 2.7 }] } })).regels[0].aantal, 2);
});

test('spamSignaal: robots en linkspam', function () {
	const contact = { soort: 'contact', naam: 'Jan', email: 'jan@voorbeeld.nl', bericht: 'Hoi', duur: 5000 };
	assert.equal(spamSignaal(contact, null), null);
	assert.equal(spamSignaal(Object.assign({}, contact, { botcheck: true }), null), 'honeypot');
	for (const duur of [undefined, null, '5000', NaN, -10, 0, MIN_DUUR_MS - 1]) {
		assert.equal(spamSignaal(Object.assign({}, contact, { duur: duur }), null), 'te snel', 'duur ' + duur);
	}
	assert.equal(spamSignaal(Object.assign({}, contact, { duur: MIN_DUUR_MS }), null), null);
	assert.equal(spamSignaal(null, null), 'te snel');

	const links = function (bericht) { return spamSignaal(contact, ok(Object.assign({}, contact, { bericht: bericht }))); };
	assert.equal(links('Zie https://a.nl en www.b.nl'), null, 'twee links mag');
	assert.equal(links('https://a.nl http://b.nl www.c.nl'), 'links');
	assert.equal(links('[url=x]a[/url] [URL=y]b[/URL] [url=z]c[/url]'), 'links');
	const velden = { soort: 'offerte', naam: 'Jan', email: 'jan@voorbeeld.nl', product: 'lightbox', duur: 5000, velden: { A: 'https://a.nl', B: 'https://b.nl', C: 'www.c.nl' } };
	assert.equal(spamSignaal(velden, ok(velden)), 'links', 'ook links in velden tellen');
	const order = bestelling({ bestelling: { levering: 'Ophalen', opmerkingen: 'https://a.nl https://b.nl https://c.nl', regels: [{ id: 'vaas', variant: 'm', aantal: 1 }] } });
	assert.equal(spamSignaal(order, ok(order)), null, 'een bestelling wordt nooit als linkspam weggezet');

	assert.equal(stilWeggooien('honeypot'), true);
	assert.equal(stilWeggooien('te snel'), true);
	assert.equal(stilWeggooien('links'), false);
	assert.equal(stilWeggooien(null), false);
});

test('prijzen: narekenen met de catalogus', function () {
	const r = prijzen([{ id: 'vaas', variant: 'l', aantal: 3, tekst: 'Rood' }, { id: 'hanger', variant: 'standaard', aantal: 1, tekst: 'Abtenlaan' }, { id: 'lamp', variant: 'standaard', aantal: 3, tekst: 'genegeerd' }], CATALOGUS);
	assert.equal(r.ok, true);
	assert.equal(r.regels[0].regelTotaal, 104.85);
	assert.equal(r.regels[0].tekstLabel, 'Wens');
	assert.equal(r.regels[1].tekstLabel, 'Tekst op het product');
	assert.equal(r.regels[2].regelTotaal, 0.3, 'geen 0.30000000000000004');
	assert.equal(r.regels[2].tekst, '', 'tekst alleen bij producten met een wens of personalisatie');
	assert.equal(r.totaal, 109.1);
	assert.deepEqual(Object.keys(r.regels[0]).sort(), ['aantal', 'afbeelding', 'id', 'naam', 'prijs', 'regelTotaal', 'tekst', 'tekstLabel', 'variant']);
	assert.equal(r.regels[0].afbeelding, 'assets/mail/kami-vase-c-400.jpg');
	assert.equal(r.regels[1].afbeelding, '', 'zonder foto in de catalogus: leeg');

	assert.match(prijzen([{ id: 'bestaat-niet', variant: 'm', aantal: 1 }], CATALOGUS).fout, /niet meer te bestellen/);
	assert.match(prijzen([{ id: 'lightbox', variant: 'm', aantal: 1 }], CATALOGUS).fout, /niet meer te bestellen/);
	assert.match(prijzen([{ id: '__proto__', variant: 'm', aantal: 1 }], CATALOGUS).fout, /niet meer te bestellen/);
	assert.match(prijzen([{ id: 'vaas', variant: 'xl', aantal: 1 }], CATALOGUS).fout, /uitvoering van de Kami Vase bestaat niet meer/);
	assert.match(prijzen([{ id: 'hanger', variant: 'standaard', aantal: 1, tekst: '' }], CATALOGUS).fout, /Vul de tekst voor de Straatnaam Sleutelhanger in/);
});

test('ordernummer', function () {
	assert.match(ordernummer(), /^JS3D-[0-9A-Z]{10}$/);
	assert.equal(ordernummer(1760968800000, 0), 'JS3D-MGZ7CU8000');
	assert.equal(ordernummer(1760968800000, 0.999), 'JS3D-MGZ7CU80ZY');
	assert.notEqual(ordernummer(1760968800000, 0.1), ordernummer(1760968800000, 0.2), 'zelfde moment, ander willekeurig deel');
});

const MOMENT = '2026-10-20T12:30:00.000Z';

test('mails bij een bestelling', function () {
	const data = ok(bestelling({ naam: 'Anne-Marie <b>de Vries</b>' }));
	const berekend = prijzen(data.regels, CATALOGUS);
	const extra = { id: 'JS3D-TEST01', regels: berekend.regels, totaal: berekend.totaal, moment: MOMENT, dashboard: 'https://supabase.com/dashboard/project/abc/editor', gereageerdLink: 'https://jelgers3d.nl/gereageerd.html#b=JS3D-TEST01&k=abc' };

	const jelger = mailEigenaar(data, extra, WINKEL);
	assert.equal(jelger.onderwerp, 'Nieuwe bestelling JS3D-TEST01: 2 items, €49,90 (verzenden)');
	assert.ok(jelger.html.includes('Anne-Marie &lt;b&gt;de Vries&lt;/b&gt;'), 'naam geëscaped');
	assert.ok(!jelger.html.includes('<b>de Vries'));
	assert.ok(jelger.html.includes('20 oktober 2026 om 14:30'), 'tijd in Nederlandse tijd');
	assert.ok(jelger.html.includes('Graag<br>in het rood'));
	assert.ok(jelger.html.includes('href="tel:0612345678"'));
	assert.ok(jelger.html.includes('Straat 1, 6461 AA Kerkrade, Nederland'));
	assert.ok(jelger.html.includes('Alles terugzien in Supabase'));
	assert.ok(jelger.tekst.includes('2× Kami Vase (Medium) — €49,90'));
	assert.ok(jelger.html.includes('href="mailto:anne@example.nl?subject=Je%20bestelling%20JS3D-TEST01%20bij%20JelgerS3D"'), 'knop om de klant te mailen');
	assert.ok(jelger.html.includes('>Bel 06 12345678</a>'), 'knop om te bellen');
	assert.ok(jelger.html.includes('href="https://jelgers3d.nl/gereageerd.html#b=JS3D-TEST01&amp;k=abc"') && jelger.html.includes('>Ik heb gereageerd</a>'), 'knop "Ik heb gereageerd"');
	assert.ok(jelger.tekst.includes('Ik heb gereageerd: https://jelgers3d.nl/gereageerd.html#b=JS3D-TEST01&k=abc'));
	assert.ok(jelger.html.includes('Anne-Marie &lt;b&gt;de Vries&lt;/b&gt; · €49,90 · verzenden naar Kerkrade'), 'voorbeeldregel in de inbox');

	// Huisstijl: JS-teken als PNG van de site met de naam erbij (logoletter), Saira en DM Sans, raspberry-aqua balk, productfoto
	assert.ok(jelger.html.includes('src="https://jelgers3d.nl/assets/mail/logo.png" width="44" height="41"'));
	assert.ok(jelger.html.includes('text-transform:uppercase;color:#f3fffd">JelgerS3D</td>'), 'naam naast het teken');
	assert.ok(jelger.html.includes("font-family:\"Saira\"") && jelger.html.includes("'DM Sans'") && jelger.html.includes("font-family:\"Stevie Sans\""));
	assert.ok(jelger.html.includes('linear-gradient(90deg,#f10067,#03bcca)'));
	assert.ok(jelger.html.includes('<img src="https://jelgers3d.nl/assets/mail/kami-vase-c-400.jpg" width="48" height="60" alt=""'));

	const klant = mailKlant(data, extra, WINKEL);
	assert.equal(klant.onderwerp, 'Je bestelling bij JelgerS3D is binnen (JS3D-TEST01)');
	assert.ok(klant.html.includes('Hoi Anne-Marie,'));
	assert.ok(klant.html.includes('ontvangstbevestiging'));
	assert.ok(klant.html.includes('Exclusief verzendkosten'));
	assert.ok(klant.html.includes('€24,95 per stuk'));
	assert.ok(klant.html.includes('Wens: “Rood”'));
	assert.ok(!klant.html.includes('in het rood'), 'opmerkingen alleen voor Jelger');
	assert.ok(klant.html.includes('KvK 12345678'));
	assert.ok(klant.html.includes('Bestelnummer JS3D-TEST01. Je betaalt nog niets'), 'voorbeeldregel in de inbox');
	assert.ok(klant.html.includes('>Instagram</a>') && klant.html.includes('3D-design met karakter · Handgemaakt in Limburg'));
	assert.ok(klant.tekst.startsWith('Hoi Anne-Marie,'));
	assert.ok(!klant.html.includes('gereageerd'), 'de knop voor Jelger staat niet in de mail aan de klant');
	assert.ok(!klant.html.includes('Als eerste horen'), 'zonder vinkje geen nieuwsbriefblok');
	const metNieuwsbrief = mailKlant(data, Object.assign({}, extra, { nieuwsbriefLink: 'https://jelgers3d.nl/nieuwsbrief.html#t=abc' }), WINKEL);
	assert.ok(metNieuwsbrief.html.includes('href="https://jelgers3d.nl/nieuwsbrief.html#t=abc"') && metNieuwsbrief.html.includes('Ja, houd me op de hoogte'));
	assert.ok(metNieuwsbrief.tekst.includes('https://jelgers3d.nl/nieuwsbrief.html#t=abc'));

	const ophalen = ok(bestelling({ bestelling: { levering: 'Ophalen', regels: [{ id: 'vaas', variant: 'm', aantal: 1 }] } }));
	const extra1 = Object.assign({}, extra, prijzen(ophalen.regels, CATALOGUS));
	assert.equal(mailEigenaar(ophalen, extra1, WINKEL).onderwerp, 'Nieuwe bestelling JS3D-TEST01: 1 item, €24,95 (ophalen)');
	const klant1 = mailKlant(ophalen, extra1, WINKEL);
	assert.ok(klant1.html.includes('een moment om op te halen in Kerkrade'));
	assert.ok(!klant1.html.includes('Bezorgadres'));
});

test('mails: geen spam via de bevestiging aan de klant', function () {
	const data = ok({ soort: 'contact', naam: 'www.goedkoop.biz Jansen', email: 'slachtoffer@voorbeeld.nl', bericht: 'Koop nu op https://spam.example/pillen of www.spam.example' });
	const klant = mailKlant(data, { id: 'x', moment: MOMENT }, WINKEL);
	assert.ok(klant.html.includes('Hoi,'), 'geen webadres als aanhef');
	assert.ok(!/spam\.example|goedkoop/.test(klant.html + klant.tekst + klant.onderwerp), 'links staan niet in de mail aan de klant');
	assert.ok(klant.html.includes('Koop nu op [link] of [link]'));
	assert.ok(mailEigenaar(data, { id: 'x', moment: MOMENT }, WINKEL).html.includes('https://spam.example/pillen'), 'Jelger ziet wel alles');

	const order = ok(bestelling({ naam: 'Jan', bestelling: { levering: 'Verzenden', adres: 'Kijk op www.spam.example', postcode: '1', plaats: 'x', regels: [{ id: 'hanger', variant: 'standaard', aantal: 1, tekst: 'https://spam.example' }] } }));
	const extra = Object.assign({ id: 'JS3D-X', moment: MOMENT }, prijzen(order.regels, CATALOGUS));
	const klant2 = mailKlant(order, extra, WINKEL);
	assert.ok(!/spam\.example/.test(klant2.html + klant2.tekst), 'ook niet via adres of tekst op het product');

	const velden = ok({ soort: 'offerte', naam: 'Jan', email: 'jan@voorbeeld.nl', product: 'lightbox', velden: { 'Kijk op https://spam.example': 'en www.spam.example' } });
	assert.ok(!/spam\.example/.test(mailKlant(velden, { id: 'x', moment: MOMENT }, WINKEL).html));
	assert.ok(/(Hoi Jan,)/.test(mailKlant(velden, { id: 'x', moment: MOMENT }, WINKEL).html));
});

test('mails bij aanvragen en berichten', function () {
	const extra = { id: 'abc', moment: MOMENT };
	const offerte = ok({ soort: 'offerte', naam: 'Jan Jansen', email: 'jan@voorbeeld.nl', product: 'lightbox', velden: { 'Wat wil je laten maken?': 'Een lightbox\nmet ons logo' } });
	assert.equal(mailEigenaar(offerte, extra, WINKEL).onderwerp, 'Nieuwe aanvraag Custom Lightbox van Jan Jansen');
	assert.equal(mailKlant(offerte, extra, WINKEL).onderwerp, 'Je aanvraag bij JelgerS3D is binnen');
	assert.ok(mailKlant(offerte, extra, WINKEL).html.includes('voor de <strong>Custom Lightbox</strong>'));
	assert.ok(mailKlant(offerte, extra, WINKEL).html.includes('Een lightbox<br>met ons logo'));
	const zonderProduct = ok({ soort: 'offerte', naam: 'Jan', email: 'jan@voorbeeld.nl', product: 'weg', velden: { Wens: 'x' } });
	assert.equal(mailEigenaar(zonderProduct, extra, WINKEL).onderwerp, 'Nieuwe aanvraag van Jan');

	const print = ok({ soort: 'printservice', naam: 'Jan', email: 'jan@voorbeeld.nl', velden: { Model: 'Vaas' } });
	assert.equal(mailEigenaar(print, extra, WINKEL).onderwerp, 'Nieuwe printaanvraag van Jan');
	assert.ok(mailKlant(print, extra, WINKEL).html.includes('Stuur je bestand (STL of 3MF) als antwoord op deze mail'));

	const seintje = ok({ soort: 'beschikbaarheid', email: 'jan@voorbeeld.nl', product: 'non' });
	assert.equal(mailEigenaar(seintje, extra, WINKEL).onderwerp, 'jan@voorbeeld.nl wil een seintje over de Blonde Non');
	assert.equal(mailKlant(seintje, extra, WINKEL).onderwerp, 'Je hoort het zodra de Blonde Non er weer is');

	const contact = ok({ soort: 'contact', naam: 'Jan', email: 'jan@voorbeeld.nl', bericht: 'Vraagje' });
	assert.equal(mailEigenaar(contact, extra, WINKEL).onderwerp, 'Nieuw bericht van Jan');
	assert.equal(mailKlant(contact, extra, WINKEL).onderwerp, 'Je bericht aan JelgerS3D is binnen');
});

test('berichten via het portfolio (jelgersieler.nl)', function () {
	const PORTFOLIO = Object.assign({}, WINKEL, { site: 'jelgersieler.nl', naam: 'JSdesign', url: 'https://jelgersieler.nl', slogan: 'Designer · Developer · Maker', portfolio: true });
	const d = ok({ site: 'portfolio', soort: 'contact', naam: 'Jan', email: 'jan@voorbeeld.nl', bericht: 'Leuk portfolio', nieuwsbrief: true, akkoord: true });
	assert.equal(d.site, 'portfolio');
	assert.equal(d.nieuwsbrief, false, 'de nieuwsbrief hoort bij de winkel');
	assert.equal(ok({ soort: 'contact', naam: 'Jan', email: 'jan@voorbeeld.nl', bericht: 'x' }).site, undefined, 'de winkel blijft de standaard');
	assert.equal(ok({ site: 'portfolio', soort: 'offerte', naam: 'Jan', email: 'jan@voorbeeld.nl', product: 'lightbox', velden: { Wens: 'x' } }).site, undefined, 'alleen het contactformulier');

	const extra = { id: 'abc', moment: MOMENT, gereageerdLink: 'https://jelgers3d.nl/gereageerd.html#m=abc&k=x' };
	const jelger = mailEigenaar(d, extra, PORTFOLIO);
	assert.equal(jelger.onderwerp, 'Nieuw bericht van Jan via jelgersieler.nl');
	assert.ok(jelger.html.includes('Nieuw bericht via je portfolio') && jelger.html.includes('https://jelgersieler.nl/assets/mail/logo.png'));
	const klant = mailKlant(d, extra, PORTFOLIO);
	assert.equal(klant.onderwerp, 'Je bericht aan JSdesign is binnen');
	assert.ok(klant.html.includes('Designer · Developer · Maker') && klant.html.includes('https://jelgersieler.nl/privacy.html'));
	assert.ok(!/voorwaarden|Handgemaakt in Limburg|KvK|Als eerste horen/.test(klant.html), 'geen winkelvoet en geen nieuwsbrief');
	assert.ok(klant.tekst.endsWith('JSdesign · https://jelgersieler.nl'));

	const herinnering = mailHerinnering([{ soort: 'contact', id: 'u3', naam: 'Jan', email: 'jan@voorbeeld.nl', tekst: 'Leuk portfolio', aangemaakt: '2026-10-21T06:00:00Z', keer: 1, gereageerdLink: 'https://jelgers3d.nl/gereageerd.html#m=u3&k=d', merk: 'JSdesign' }], WINKEL, new Date('2026-10-23T07:00:00Z').getTime());
	assert.ok(herinnering.html.includes('Bericht via je portfolio') && herinnering.html.includes(encodeURIComponent('Je bericht bij JSdesign')));
});

const UPLOADS = { maxMB: 50, keepMonths: 6, printservice: { types: ['stl', '3mf'], max: 2 }, offerte: { types: ['svg', 'png', 'jpg', 'jpeg', 'pdf'], max: 3 } };

test('bestanden: wat mag er geüpload worden', function () {
	const goed = controleerBestanden([{ naam: 'C:\\fakepath\\Mijn  vaas.STL', grootte: 1234 }], 'printservice', UPLOADS);
	assert.equal(goed.ok, true, goed.fout);
	assert.deepEqual(goed.bestanden, [{ naam: 'Mijn vaas.STL', ext: 'stl', grootte: 1234 }]);
	assert.match(controleerBestanden([{ naam: 'virus.exe', grootte: 10 }], 'printservice', UPLOADS).fout, /virus\.exe kan ik niet gebruiken\. Dit kan wel: STL of 3MF\./);
	assert.match(controleerBestanden([{ naam: 'logo.gif', grootte: 10 }], 'offerte', UPLOADS).fout, /SVG, PNG, JPG of PDF/);
	assert.match(controleerBestanden([{ naam: 'groot.stl', grootte: 51 * 1024 * 1024 }], 'printservice', UPLOADS).fout, /groter dan 50 MB/);
	assert.match(controleerBestanden([{ naam: 'leeg.stl', grootte: 0 }], 'printservice', UPLOADS).fout, /is leeg/);
	assert.match(controleerBestanden([{ naam: 'a.stl', grootte: 1 }, { naam: 'b.stl', grootte: 1 }, { naam: 'c.stl', grootte: 1 }], 'printservice', UPLOADS).fout, /hooguit 2 bestanden/);
	assert.equal(controleerBestanden([{ naam: 'a.stl', grootte: 1 }], 'contact', UPLOADS).ok, false, 'niet bij elk formulier');
	assert.equal(controleerBestanden([{ naam: 'a.stl', grootte: 1 }], 'printservice', null).ok, false, 'zonder instellingen geen uploads');
	assert.equal(controleerBestanden([{ naam: 'a.stl', grootte: 1 }], '__proto__', UPLOADS).ok, false);
	assert.equal(bestandsnaam('../../etc/<passwd>'), 'passwd');
	assert.equal(bestandsnaam('x'.repeat(200) + '.stl').length, 120);
	assert.ok(bestandsnaam('x'.repeat(200) + '.stl').endsWith('.stl'));
	assert.equal(grootteTekst(1500), '1 kB');
	assert.equal(grootteTekst(12.34 * 1024 * 1024), '12,3 MB');
	assert.equal(typesTekst(['stl']), 'STL');
});

test('bestanden: in de mails', function () {
	const id = '0b6f8a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
	const print = ok({ soort: 'printservice', naam: 'Jan', email: 'jan@voorbeeld.nl', velden: { Model: 'Vaas' }, bestanden: [id, 'geen-uuid', 42] });
	assert.deepEqual(print.bestanden, [id], 'alleen geldige id\'s');
	const extra = { id: 'abc', moment: MOMENT, bewaarMaanden: 6, bestanden: [{ naam: 'vaas www.spam.example.stl', grootte: 2 * 1024 * 1024, link: 'https://x.supabase.co/functions/v1/formulier?bestand=' + id + '&k=123' }] };
	const jelger = mailEigenaar(print, extra, WINKEL);
	assert.ok(jelger.html.includes('>Downloaden</a>') && jelger.html.includes('bestand=' + id + '&amp;k=123'), 'downloadlink voor Jelger');
	assert.ok(jelger.html.includes('6 maanden bewaard'));
	assert.ok(!jelger.html.includes('er is geen bestand geüpload'));
	assert.ok(jelger.tekst.includes('vaas www.spam.example.stl (2,0 MB): https://'));
	const klant = mailKlant(print, extra, WINKEL);
	assert.ok(klant.html.includes('Je bestand is goed aangekomen'));
	assert.ok(klant.html.includes('vaas [link]') && !/spam\.example|Downloaden|bestand=/.test(klant.html), 'klant ziet naam en grootte, geen links');
	assert.ok(!klant.html.includes('Stuur je bestand'), 'geen verzoek om het bestand te mailen');
	assert.ok(mailEigenaar(print, { id: 'abc', moment: MOMENT }, WINKEL).html.includes('er is geen bestand geüpload'));
	assert.equal(ok({ soort: 'contact', naam: 'Jan', email: 'jan@voorbeeld.nl', bericht: 'x', bestanden: [id] }).bestanden, undefined, 'contact heeft geen bestanden');
});

test('nieuwsbrief: aanmelden en bevestigen', function () {
	const d = ok({ soort: 'nieuwsbrief', email: ' Jan@Voorbeeld.NL ', bron: 'footer' });
	assert.equal(d.email, 'jan@voorbeeld.nl');
	assert.equal(d.bron, 'footer');
	assert.equal(ok({ soort: 'nieuwsbrief', email: 'jan@voorbeeld.nl', bron: 'iets-geks' }).bron, 'footer');
	assert.equal(ok({ soort: 'nieuwsbrief', email: 'jan@voorbeeld.nl', bron: 'pagina' }).bron, 'pagina', 'de aanmeldpagina voor social media');
	assert.equal(fout({ soort: 'nieuwsbrief', email: 'geen' }), 'Vul een geldig e-mailadres in.');
	assert.equal(ok({ soort: 'contact', naam: 'Jan', email: 'jan@voorbeeld.nl', bericht: 'x', nieuwsbrief: true }).nieuwsbrief, true);
	assert.equal(ok({ soort: 'contact', naam: 'Jan', email: 'jan@voorbeeld.nl', bericht: 'x', nieuwsbrief: 'ja' }).nieuwsbrief, false, 'alleen een echt vinkje telt');
	assert.equal(ok({ soort: 'beschikbaarheid', email: 'jan@voorbeeld.nl', product: 'non', nieuwsbrief: true }).nieuwsbrief, undefined);
	const mail = mailNieuwsbrief('https://jelgers3d.nl/nieuwsbrief.html#t=abc', WINKEL);
	assert.equal(mail.onderwerp, 'Bevestig je aanmelding voor de nieuwsbrief van JelgerS3D');
	assert.ok(mail.html.includes('href="https://jelgers3d.nl/nieuwsbrief.html#t=abc"') && mail.html.includes('Ja, ik meld me aan'));
	assert.ok(mail.html.includes('zonder bevestiging sta je niet op de lijst'));
	assert.ok(mail.tekst.includes('https://jelgers3d.nl/nieuwsbrief.html#t=abc'));
});

test('herinnering aan Jelger', function () {
	const nu = new Date('2026-10-23T07:00:00Z').getTime();
	const items = [
		{ soort: 'bestelling', id: 'JS3D-1', naam: 'Anne de Vries', email: 'anne@voorbeeld.nl', totaal: 49.9, levering: 'Verzenden', aangemaakt: '2026-10-20T10:00:00Z', keer: 1, gereageerdLink: 'https://jelgers3d.nl/gereageerd.html#b=JS3D-1&k=a' },
		{ soort: 'printservice', id: 'u1', naam: 'Jan', email: 'jan@voorbeeld.nl', tekst: 'Een vaas <b>van</b> 20 cm ' + 'x'.repeat(200), aangemaakt: '2026-10-18T10:00:00Z', keer: 2, gereageerdLink: 'https://jelgers3d.nl/gereageerd.html#m=u1&k=b' },
		{ soort: 'contact', id: 'u2', naam: '', email: 'piet@voorbeeld.nl', tekst: 'Vraagje', aangemaakt: '2026-10-21T06:00:00Z', keer: 1, gereageerdLink: 'https://jelgers3d.nl/gereageerd.html#m=u2&k=c' }
	];
	assert.equal(telling(items), '1 bestelling, 1 aanvraag en 1 bericht');
	assert.equal(telling([items[0], items[0]]), '2 bestellingen');
	const mail = mailHerinnering(items, WINKEL, nu, 'https://supabase.com/dashboard/project/abc/editor');
	assert.equal(mail.onderwerp, 'Herinnering: 1 bestelling, 1 aanvraag en 1 bericht wachten op je reactie');
	assert.equal(mailHerinnering([items[0]], WINKEL, nu).onderwerp, 'Herinnering: 1 bestelling wacht op je reactie');
	assert.ok(mail.html.includes('Bestelling JS3D-1') && mail.html.includes('€49,90 · verzenden'));
	assert.ok(mail.html.includes('Anne de Vries · 2 dagen geleden'));
	assert.ok(mail.html.includes('Jan · 4 dagen geleden · tweede herinnering'));
	assert.ok(mail.html.includes('piet@voorbeeld.nl · 2 dagen geleden'));
	assert.ok(mail.html.includes('Een vaas &lt;b&gt;van&lt;/b&gt;') && mail.html.includes('…'), 'geëscaped en ingekort');
	assert.ok(mail.html.includes('href="https://jelgers3d.nl/gereageerd.html#m=u1&amp;k=b"'));
	assert.ok(mail.html.includes('>Mail Anne</a>') && mail.html.includes('>Mail klant</a>'));
	assert.ok(mail.tekst.includes('Ik heb gereageerd: https://jelgers3d.nl/gereageerd.html#b=JS3D-1&k=a'));
});

test('het e-mailadres van de winkel: gecodeerd en weer leesbaar', function () {
	for (const adres of ['info@example.nl', 'sieler.jelger+shop@gmail.com']) {
		const code = helpers.mailCode(adres);
		assert.ok(!code.includes('@') && !code.includes(adres.split('@')[0]), 'niet herkenbaar in de code');
		assert.equal(ontcijferMail(code), adres);
	}
	assert.equal(ontcijferMail('geen base64!'), '');
	assert.equal(ontcijferMail(undefined), '');
});

test('alle bestelbare producten van de site zijn na te rekenen', { skip: !existsSync(new URL('../dist/js/winkel.json', import.meta.url)) && 'bouw eerst de site' }, function () {
	const { winkel, catalogus } = JSON.parse(readFileSync(new URL('../dist/js/winkel.json', import.meta.url), 'utf8'));
	for (const sleutel of ['naam', 'eigenaar', 'mail', 'url', 'adres', 'kvk', 'btw', 'ophaalplaats', 'levertijd']) assert.ok(winkel[sleutel], 'winkel.' + sleutel);
	const site = JSON.parse(readFileSync(new URL('../data/site.json', import.meta.url), 'utf8'));
	assert.equal(ontcijferMail(winkel.mail), site.email, 'het adres komt goed terug');
	assert.ok(!JSON.stringify(winkel).includes(site.email), 'en staat er niet leesbaar in');
	assert.ok(existsSync(new URL('../dist/assets/mail/logo.png', import.meta.url)), 'logo voor de mails');
	for (const id of Object.keys(catalogus)) assert.ok(existsSync(new URL('../dist/' + catalogus[id].mailImage, import.meta.url)), 'mailfoto van ' + id);
	const bestelbaar = Object.keys(catalogus).filter(function (id) { return catalogus[id].sale === 'cart'; });
	assert.ok(bestelbaar.length > 0);
	for (const id of bestelbaar) {
		for (const v of catalogus[id].variants) {
			const r = prijzen([{ id: id, variant: v.id, aantal: 2, tekst: 'Test' }], catalogus);
			assert.equal(r.ok, true, id + '/' + v.id + ': ' + r.fout);
			assert.equal(r.totaal, Math.round(v.price * 200) / 100, id + '/' + v.id);
		}
	}
});
