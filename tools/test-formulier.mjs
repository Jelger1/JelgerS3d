// Tests voor de logica van de Supabase-functie "formulier" (supabase/functions/formulier/logica.js):
// invoer controleren, spam herkennen, prijzen narekenen en de mails. Draai met: npm test
// Bouw eerst de site (npm run build): de laatste test rekent alle producten uit dist/js/winkel.json na.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { controleer, spamSignaal, stilWeggooien, prijzen, ordernummer, mailEigenaar, mailKlant, MIN_DUUR_MS } from '../supabase/functions/formulier/logica.js';

const CATALOGUS = {
	vaas: { name: 'Kami Vase', sale: 'cart', variants: [{ id: 'm', label: 'Medium', price: 24.95 }, { id: 'l', label: 'Large', price: 34.95 }], personalize: false, wish: true },
	hanger: { name: 'Straatnaam Sleutelhanger', sale: 'cart', variants: [{ id: 'standaard', label: '', price: 3.95 }], personalize: true, wish: false },
	lamp: { name: 'Helio Lamp', sale: 'cart', variants: [{ id: 'standaard', price: 0.1 }], personalize: false, wish: false },
	lightbox: { name: 'Custom Lightbox', sale: 'request', variants: [], personalize: false, wish: false },
	non: { name: 'Blonde Non', sale: 'external', variants: [], personalize: false, wish: false }
};
const WINKEL = {
	naam: 'JelgerS3D', eigenaar: 'Jelger Sieler', email: 'info@example.nl', url: 'https://jelgers3d.nl',
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
	assert.deepEqual(Object.keys(r.regels[0]).sort(), ['aantal', 'id', 'naam', 'prijs', 'regelTotaal', 'tekst', 'tekstLabel', 'variant']);

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
	const extra = { id: 'JS3D-TEST01', regels: berekend.regels, totaal: berekend.totaal, moment: MOMENT, dashboard: 'https://supabase.com/dashboard/project/abc/editor' };

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

	const klant = mailKlant(data, extra, WINKEL);
	assert.equal(klant.onderwerp, 'Je bestelling bij JelgerS3D is binnen (JS3D-TEST01)');
	assert.ok(klant.html.includes('Hoi Anne-Marie,'));
	assert.ok(klant.html.includes('ontvangstbevestiging'));
	assert.ok(klant.html.includes('Exclusief verzendkosten'));
	assert.ok(klant.html.includes('€24,95 per stuk'));
	assert.ok(klant.html.includes('Wens: “Rood”'));
	assert.ok(!klant.html.includes('in het rood'), 'opmerkingen alleen voor Jelger');
	assert.ok(klant.html.includes('KvK 12345678'));
	assert.ok(klant.tekst.startsWith('Hoi Anne-Marie,'));

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

test('alle bestelbare producten van de site zijn na te rekenen', { skip: !existsSync(new URL('../dist/js/winkel.json', import.meta.url)) && 'bouw eerst de site' }, function () {
	const { winkel, catalogus } = JSON.parse(readFileSync(new URL('../dist/js/winkel.json', import.meta.url), 'utf8'));
	for (const sleutel of ['naam', 'eigenaar', 'email', 'url', 'adres', 'kvk', 'btw', 'ophaalplaats', 'levertijd']) assert.ok(winkel[sleutel], 'winkel.' + sleutel);
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
