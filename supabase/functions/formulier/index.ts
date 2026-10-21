// Supabase Edge Function "formulier": ontvangt alle formulieren van jelgers3d.nl (bestellen, contact,
// maatwerk, printservice, beschikbaarheid, nieuwsbrief). Controleert de invoer, houdt bots tegen, slaat alles op in de
// database en stuurt mails via Resend: een bevestiging naar de klant en een overzicht naar Jelger.
//
// Wat de functie verder doet (veld "actie" in de aanvraag):
//   upload      uploadadressen geven voor bestanden bij een aanvraag (3D-bestanden, logo's); de browser uploadt
//               daarna zelf naar Supabase Storage (bucket "uploads", privé)
//   gereageerd  de knop "Ik heb gereageerd" uit Jelgers mail (via jelgers3d.nl/gereageerd.html, ondertekende link)
//   bevestig    de bevestigingsknop van de nieuwsbrief (via jelgers3d.nl/nieuwsbrief.html); daarna staat het adres
//               ook als contact in Resend, segment "Nieuwsbrief", voor nieuwsbrieven vanuit het Resend-dashboard
//   taken       elk uur via pg_cron: oude bestanden en onbevestigde aanmeldingen opruimen, en om 9 uur een herinnering
//               aan Jelger voor wat al dagen op "nieuw" staat
// Een GET met ?bestand=...&k=... (de downloadlink in Jelgers mail) stuurt door naar het bestand.
//
// Het portfolio van Jelger (jelgersieler.nl, JSdesign) gebruikt deze functie ook, alleen voor het contactformulier
// (veld "site": "portfolio"). Die berichten staan in dezelfde tabel met site = jelgersieler.nl, en de mails erover
// krijgen de naam, het adres en het logo van het portfolio (het logo en de lettertypen staan daar ook op de site).
//
// Instellingen (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY   verplicht, de sleutel van resend.com (voor de nieuwsbrief met toegang tot contacten)
//   MAIL_VAN         afzender, bv. "JelgerS3D <bestellingen@jelgers3d.nl>" (domein moet bij Resend geverifieerd zijn)
//   MAIL_VAN_PORTFOLIO  optioneel: afzender voor het portfolio (standaard hetzelfde adres met de naam JSdesign)
//   MAIL_EIGENAAR    waar Jelger de overzichten wil ontvangen
//   RESEND_SEGMENT   optioneel: id van het segment voor de nieuwsbrief (anders zoekt of maakt de functie "Nieuwsbrief")
//   SITE_URL         standaard https://jelgers3d.nl
// SUPABASE_URL en de sleutel voor de database (SUPABASE_SECRET_KEYS of SUPABASE_SERVICE_ROLE_KEY) zet Supabase zelf.
//
// De functie draait zonder inlog ("verify_jwt = false"): de website is openbaar. Bescherming zit hierin:
// honeypot, minimale invultijd, linkfilter, maximaal 5 inzendingen per IP per 10 minuten en per
// e-mailadres per dag. Robots krijgen een nep-"verstuurd" zodat ze niet leren om de filters heen te werken.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import {
	controleer, controleerBestanden, spamSignaal, stilWeggooien, prijzen, ordernummer, ontcijferMail,
	mailEigenaar, mailKlant, mailNieuwsbrief, mailHerinnering
} from './logica.js';

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://jelgers3d.nl').replace(/\/$/, '');
const MAIL_VAN = Deno.env.get('MAIL_VAN') ?? 'JelgerS3D <bestellingen@jelgers3d.nl>';
const MAIL_EIGENAAR = Deno.env.get('MAIL_EIGENAAR') ?? '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = geheimeSleutel();
const FUNCTIE_URL = SUPABASE_URL + '/functions/v1/formulier';
const PORTFOLIO = { site: 'jelgersieler.nl', naam: 'JSdesign', url: 'https://jelgersieler.nl', slogan: 'Designer · Developer · Maker' };
const MAIL_VAN_PORTFOLIO = Deno.env.get('MAIL_VAN_PORTFOLIO') ?? MAIL_VAN.replace(/^[^<]*</, PORTFOLIO.naam + ' <');
const HERKOMST = [SITE_URL, SITE_URL.replace('://', '://www.'), PORTFOLIO.url, PORTFOLIO.url.replace('://', '://www.')];
const LIMIET_IP = 5;            // inzendingen per IP per 10 minuten
const LIMIET_EMAIL = 5;         // inzendingen per e-mailadres per 24 uur
const BUCKET = 'uploads';
const LIMIET_UPLOADS_IP = 10;   // bestanden per IP per 10 minuten
const LIMIET_UPLOADS_DAG = 100; // bestanden per dag in totaal, zodat niemand de opslag kan volladen
const HERINNER_UUR = 9;         // herinneringen om 9 uur 's ochtends, Nederlandse tijd
const HERINNER_NA = [2, 5];     // dagen tot de eerste en de tweede (laatste) herinnering
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAG = 24 * 60 * 60 * 1000;

// Nieuwere projecten hebben "secret keys" (een JSON-lijst, de eerste heet "default"), oudere een service
// role key. Supabase zet ze zelf klaar; welke er is, maakt niet uit.
function geheimeSleutel() {
	try {
		const sleutels = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
		if (sleutels && typeof sleutels.default === 'string' && sleutels.default) return sleutels.default;
	} catch { /* dan de oude sleutel */ }
	return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const dashboard = SUPABASE_URL.replace(/^https:\/\/([^.]+)\.supabase\.co.*/, 'https://supabase.com/dashboard/project/$1/editor');

// Bedrijfsgegevens, prijzen en de regels voor uploads komen van de website zelf (gemaakt door build.js uit
// data/*.json), zodat er maar één plek is waar ze staan. Vijf minuten bewaren is genoeg. Het e-mailadres staat er
// gecodeerd in, tegen robots die adressen verzamelen.
let winkelCache: { tijd: number; data: any } | null = null;
async function winkel() {
	if (winkelCache && Date.now() - winkelCache.tijd < 5 * 60 * 1000) return winkelCache.data;
	const res = await fetch(SITE_URL + '/js/winkel.json?n=' + Date.now());
	if (!res.ok) throw new Error('winkel.json niet bereikbaar: ' + res.status);
	const data = await res.json();
	data.winkel.email = ontcijferMail(data.winkel.mail);
	winkelCache = { tijd: Date.now(), data };
	return winkelCache.data;
}

function cors(herkomst: string | null) {
	const toegestaan = herkomst && (HERKOMST.includes(herkomst) || /^http:\/\/localhost(:\d+)?$/.test(herkomst));
	return {
		'Access-Control-Allow-Origin': toegestaan ? herkomst! : HERKOMST[0],
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'content-type',
		'Vary': 'Origin'
	};
}

function antwoord(body: unknown, status: number, headers: Record<string, string>) {
	return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

function tekstAntwoord(tekst: string, status: number) {
	return new Response(tekst, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

function hex(buffer: ArrayBuffer) {
	return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hash(waarde: string) {
	return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(waarde + '|' + SERVICE_KEY.slice(-16))));
}

// Ondertekende links (downloadlinks en "Ik heb gereageerd"): alleen wie de mail heeft, kan ze gebruiken
let tekenSleutel: CryptoKey | null = null;
async function teken(tekst: string) {
	tekenSleutel ??= await crypto.subtle.importKey('raw', new TextEncoder().encode('jelgers3d-links|' + SERVICE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return hex(await crypto.subtle.sign('HMAC', tekenSleutel, new TextEncoder().encode(tekst))).slice(0, 32);
}

async function klopt(tekst: string, handtekening: unknown) {
	const juist = await teken(tekst);
	if (typeof handtekening !== 'string' || handtekening.length !== juist.length) return false;
	let verschil = 0;
	for (let i = 0; i < juist.length; i++) verschil |= juist.charCodeAt(i) ^ handtekening.charCodeAt(i);
	return verschil === 0;
}

async function gereageerdLink(tabel: 'b' | 'm', id: string) {
	return SITE_URL + '/gereageerd.html#' + tabel + '=' + encodeURIComponent(id) + '&k=' + await teken('gereageerd|' + tabel + '|' + id);
}

async function bestandLink(id: string) {
	return FUNCTIE_URL + '?bestand=' + id + '&k=' + await teken('bestand|' + id);
}

// Het IP-adres van de bezoeker, voor de limiet per IP. Is er geen, dan geldt alleen de limiet per
// e-mailadres: anders zouden alle bezoekers samen één limiet delen.
function bezoekerIp(req: Request) {
	return (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? (req.headers.get('x-forwarded-for') ?? '').split(',')[0]).trim();
}

// Hoeveel inzendingen er in de laatste minuten waren met deze hash. Lukt het tellen niet, dan geen limiet:
// liever een keer spam dan een bestelling die niet aankomt.
async function recent(kolom: 'ip_hash' | 'email_hash', waarde: string, minuten: number) {
	const { count, error } = await db.from('inzendingen_log').select('*', { count: 'exact', head: true })
		.eq(kolom, waarde).gte('aangemaakt', new Date(Date.now() - minuten * 60 * 1000).toISOString());
	if (error) console.error('Tellen mislukt', error);
	return count ?? 0;
}

async function stuurMail(aan: string, antwoordAan: string, mail: { onderwerp: string; html: string; tekst: string }, van = MAIL_VAN) {
	if (!RESEND_KEY || !aan) return false;
	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: van, to: [aan], reply_to: antwoordAan || undefined, subject: mail.onderwerp, html: mail.html, text: mail.tekst })
		});
		if (!res.ok) console.error('Resend weigerde de mail', res.status, await res.text());
		return res.ok;
	} catch (e) {
		console.error('Resend niet bereikbaar', e);
		return false;
	}
}

// ---------------------------------------------------------------------------------------------- nieuwsbrief

// Zet een aanmelding klaar en geeft de bevestigingslink terug, of null als het adres al op de lijst staat.
// Het token staat alleen in de mail; in de database staat er een hash van.
async function nieuwsbriefAanvraag(email: string, bron: string) {
	const { data: bestaand } = await db.from('nieuwsbrief').select('bevestigd_op').eq('email', email).maybeSingle();
	if (bestaand?.bevestigd_op) return null;
	const token = hex(crypto.getRandomValues(new Uint8Array(24)).buffer);
	const { error } = await db.from('nieuwsbrief').upsert(
		{ email, bron, token_hash: await hash('nieuwsbrief:' + token), aangevraagd: new Date().toISOString() },
		{ onConflict: 'email' }
	);
	if (error) { console.error('Aanmelding nieuwsbrief opslaan mislukt', error); return null; }
	return SITE_URL + '/nieuwsbrief.html#t=' + token;
}

async function resend(pad: string, init: RequestInit = {}) {
	return fetch('https://api.resend.com' + pad, { ...init, headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' } });
}

// Het segment "Nieuwsbrief" in Resend: waar Jelger zijn nieuwsbrieven (Broadcasts) naartoe stuurt
let segmentId: string | null = Deno.env.get('RESEND_SEGMENT') ?? null;
async function nieuwsbriefSegment() {
	if (segmentId) return segmentId;
	const lijst = await resend('/segments');
	if (!lijst.ok) { console.error('Segmenten ophalen mislukt', lijst.status, await lijst.text()); return null; }
	const gevonden = ((await lijst.json()).data ?? []).find((s: any) => s.name === 'Nieuwsbrief');
	if (gevonden) return segmentId = gevonden.id;
	const nieuw = await resend('/segments', { method: 'POST', body: JSON.stringify({ name: 'Nieuwsbrief' }) });
	if (!nieuw.ok) { console.error('Segment maken mislukt', nieuw.status, await nieuw.text()); return null; }
	return segmentId = (await nieuw.json()).id;
}

// Zet een bevestigd adres als contact in Resend. Geeft het contact-id terug, of null als het niet lukte
// (dan staat de aanmelding wel in de database en kan hij later alsnog worden overgezet).
async function naarResend(email: string) {
	if (!RESEND_KEY) return null;
	try {
		const segment = await nieuwsbriefSegment();
		const res = await resend('/contacts', { method: 'POST', body: JSON.stringify({ email, unsubscribed: false, ...(segment ? { segments: [{ id: segment }] } : {}) }) });
		if (res.ok) return (await res.json()).id ?? 'ok';
		console.error('Contact toevoegen mislukt', res.status, await res.text());
		return null;
	} catch (e) {
		console.error('Resend niet bereikbaar', e);
		return null;
	}
}

async function bevestigNieuwsbrief(token: unknown) {
	if (typeof token !== 'string' || !/^[0-9a-f]{48}$/.test(token)) return { ok: false, fout: 'Deze link klopt niet.' };
	const { data: rij } = await db.from('nieuwsbrief').select('id, email, bevestigd_op, aangevraagd, resend_id')
		.eq('token_hash', await hash('nieuwsbrief:' + token)).maybeSingle();
	if (!rij || (!rij.bevestigd_op && Date.now() - new Date(rij.aangevraagd).getTime() > 30 * DAG)) {
		return { ok: false, fout: 'Deze link is verlopen. Meld je gerust opnieuw aan.' };
	}
	if (rij.bevestigd_op && rij.resend_id) return { ok: true }; // twee keer geklikt: niets aan de hand
	const resendId = await naarResend(rij.email);
	const { error } = await db.from('nieuwsbrief').update({ bevestigd_op: rij.bevestigd_op ?? new Date().toISOString(), resend_id: resendId }).eq('id', rij.id);
	if (error) { console.error('Bevestigen mislukt', error); return { ok: false, fout: 'Er ging iets mis. Probeer het zo opnieuw.' }; }
	return { ok: true };
}

// ---------------------------------------------------------------------------------------------- bestanden

// Uploadadressen voor de bestanden die iemand bij een aanvraag meestuurt. De browser uploadt daarna zelf rechtstreeks
// naar de opslag; het formulier stuurt alleen de id's mee. Niet-gekoppelde bestanden ruimt "taken" na een dag op.
async function uploadAdressen(invoer: any, req: Request, headers: Record<string, string>) {
	if (spamSignaal(invoer, null)) return antwoord({ ok: false, fout: 'Er ging iets mis. Ververs de pagina en probeer het opnieuw.' }, 400, headers);
	const w = await winkel();
	const gecontroleerd = controleerBestanden(invoer.bestanden, invoer.soort, w.uploads);
	if (!gecontroleerd.ok) return antwoord({ ok: false, fout: gecontroleerd.fout }, 400, headers);
	const bestanden = gecontroleerd.bestanden;

	const ip = bezoekerIp(req);
	const ipHash = ip ? await hash('ip:' + ip) : '';
	const [perIp, perDag] = await Promise.all([
		ipHash ? db.from('uploads').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('aangemaakt', new Date(Date.now() - 10 * 60 * 1000).toISOString()) : { count: 0 },
		db.from('uploads').select('*', { count: 'exact', head: true }).gte('aangemaakt', new Date(Date.now() - DAG).toISOString())
	]);
	if ((perIp.count ?? 0) + bestanden.length > LIMIET_UPLOADS_IP || (perDag.count ?? 0) + bestanden.length > LIMIET_UPLOADS_DAG) {
		return antwoord({ ok: false, fout: 'Er worden nu te veel bestanden geüpload. Probeer het later opnieuw, of mail je bestand.' }, 429, headers);
	}

	const maand = new Date().toISOString().slice(0, 7);
	const rijen = bestanden.map((b: any) => ({ id: crypto.randomUUID(), pad: invoer.soort + '/' + maand + '/' + crypto.randomUUID() + '.' + b.ext, naam: b.naam, grootte: b.grootte, soort: invoer.soort, ip_hash: ipHash }));
	const { error } = await db.from('uploads').insert(rijen);
	if (error) { console.error('Uploads registreren mislukt', error); return antwoord({ ok: false, fout: 'Uploaden lukt nu niet. Mail je bestand gerust.' }, 500, headers); }
	const uit = [];
	for (const rij of rijen) {
		const { data, error: fout } = await db.storage.from(BUCKET).createSignedUploadUrl(rij.pad);
		if (fout || !data) { console.error('Uploadadres maken mislukt', fout); return antwoord({ ok: false, fout: 'Uploaden lukt nu niet. Mail je bestand gerust.' }, 500, headers); }
		uit.push({ id: rij.id, url: data.signedUrl });
	}
	return antwoord({ ok: true, bestanden: uit }, 200, headers);
}

// Koppelt geüploade bestanden aan een aanvraag. Alleen bestanden die echt zijn aangekomen, bij dit soort formulier
// horen en nog nergens aan vastzitten. Geeft ze terug met een downloadlink voor Jelgers mail.
async function koppelBestanden(ids: string[] | undefined, soort: string, berichtId: string) {
	if (!ids || !ids.length) return [];
	const { data: rijen, error } = await db.from('uploads').select('id, pad, naam, grootte, soort, bericht_id, aangemaakt').in('id', ids);
	if (error) { console.error('Uploads ophalen mislukt', error); return []; }
	const echt = [];
	for (const rij of rijen ?? []) {
		if (rij.bericht_id || rij.soort !== soort || Date.now() - new Date(rij.aangemaakt).getTime() > 3 * 60 * 60 * 1000) continue;
		const { data: bestaat } = await db.storage.from(BUCKET).exists(rij.pad);
		if (bestaat) echt.push(rij);
	}
	if (!echt.length) return [];
	// Het gehashte IP-adres is alleen nodig voor de limiet; losse bestanden (met hash) zijn na een dag weg
	const koppel = await db.from('uploads').update({ bericht_id: berichtId, ip_hash: '' }).in('id', echt.map((r) => r.id));
	if (koppel.error) console.error('Uploads koppelen mislukt', koppel.error);
	return Promise.all(echt.map(async (r) => ({ naam: r.naam, grootte: r.grootte, link: await bestandLink(r.id) })));
}

// De downloadlink uit Jelgers mail: controleert de handtekening en stuurt door naar een tijdelijke link (5 minuten)
async function download(url: URL) {
	const id = url.searchParams.get('bestand') ?? '';
	if (!UUID.test(id) || !(await klopt('bestand|' + id, url.searchParams.get('k')))) return tekstAntwoord('Deze link klopt niet.', 403);
	const { data: rij } = await db.from('uploads').select('pad, naam').eq('id', id).maybeSingle();
	if (!rij) return tekstAntwoord('Dit bestand is er niet meer: bestanden worden na een paar maanden automatisch verwijderd.', 404);
	const { data, error } = await db.storage.from(BUCKET).createSignedUrl(rij.pad, 300, { download: rij.naam });
	if (error || !data) { console.error('Downloadlink maken mislukt', error); return tekstAntwoord('Het bestand is nu niet bereikbaar. Probeer het zo opnieuw.', 500); }
	return Response.redirect(data.signedUrl, 302);
}

// ---------------------------------------------------------------------------------------------- gereageerd

// De knop "Ik heb gereageerd": daarna komt er geen herinnering meer. Een bericht gaat ook op "beantwoord".
async function gereageerd(invoer: any, headers: Record<string, string>) {
	const tabel = invoer.tabel === 'b' ? 'b' : invoer.tabel === 'm' ? 'm' : '';
	const id = typeof invoer.id === 'string' ? invoer.id : '';
	if (!tabel || !id || !(await klopt('gereageerd|' + tabel + '|' + id, invoer.k))) return antwoord({ ok: false, fout: 'Deze link klopt niet.' }, 403, headers);
	const naam = tabel === 'b' ? 'bestellingen' : 'berichten';
	const { data: rij } = await db.from(naam).select(tabel === 'b' ? 'id, naam, status, gereageerd_op' : 'id, naam, email, soort, status, gereageerd_op').eq('id', id).maybeSingle();
	if (!rij) return antwoord({ ok: false, fout: 'Deze bestelling of aanvraag bestaat niet meer.' }, 404, headers);
	const wijziging: Record<string, unknown> = { gereageerd_op: rij.gereageerd_op ?? new Date().toISOString() };
	if (tabel === 'm' && rij.status === 'nieuw') wijziging.status = 'beantwoord';
	const { error } = await db.from(naam).update(wijziging).eq('id', id);
	if (error) { console.error('Gereageerd opslaan mislukt', error); return antwoord({ ok: false, fout: 'Opslaan lukte niet. Probeer het zo opnieuw.' }, 500, headers); }
	const soortNaam: Record<string, string> = { contact: 'Bericht', offerte: 'Aanvraag', printservice: 'Printaanvraag' };
	const wat = tabel === 'b' ? 'Bestelling ' + rij.id + ' van ' + rij.naam : (soortNaam[rij.soort] ?? 'Aanvraag') + ' van ' + (rij.naam || rij.email);
	return antwoord({ ok: true, wat, al: Boolean(rij.gereageerd_op), dashboard }, 200, headers);
}

// ---------------------------------------------------------------------------------------------- taken (elk uur)

function amsterdam(moment: Date) {
	const delen = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(moment);
	const deel = (type: string) => delen.find((d) => d.type === type)?.value ?? '';
	return { datum: deel('year') + '-' + deel('month') + '-' + deel('day'), uur: Number(deel('hour')) };
}

// Oude en nooit gekoppelde bestanden weg, en aanmeldingen voor de nieuwsbrief die na 30 dagen niet zijn bevestigd.
// Bestanden gaan via de Storage-API (rechtstreeks in de database verwijderen mag niet).
async function opruimen(w: any) {
	const grens = new Date();
	grens.setMonth(grens.getMonth() - (w.uploads?.keepMonths ?? 6));
	const [oud, los] = await Promise.all([
		db.from('uploads').select('id, pad').lt('aangemaakt', grens.toISOString()).limit(500),
		db.from('uploads').select('id, pad').is('bericht_id', null).lt('aangemaakt', new Date(Date.now() - DAG).toISOString()).limit(500)
	]);
	const weg = [...(oud.data ?? []), ...(los.data ?? [])];
	if (weg.length) {
		const { error } = await db.storage.from(BUCKET).remove(weg.map((r) => r.pad));
		if (error) console.error('Bestanden verwijderen mislukt', error);
		else await db.from('uploads').delete().in('id', weg.map((r) => r.id));
	}
	const nb = await db.from('nieuwsbrief').delete({ count: 'exact' }).is('bevestigd_op', null).lt('aangevraagd', new Date(Date.now() - 30 * DAG).toISOString());
	if (nb.error) console.error('Onbevestigde aanmeldingen opruimen mislukt', nb.error);
	return { bestanden: weg.length, aanmeldingen: nb.count ?? 0 };
}

// Eén mail om 9 uur met alles wat al twee (of vijf) dagen op "nieuw" staat zonder "Ik heb gereageerd"
async function herinneren(w: any, nu: Date) {
	const tijd = amsterdam(nu);
	if (tijd.uur < HERINNER_UUR) return 'nog geen 9 uur';
	const { data: vorige } = await db.from('taken').select('laatst').eq('naam', 'herinnering').maybeSingle();
	if (vorige && amsterdam(new Date(vorige.laatst)).datum === tijd.datum) return 'vandaag al gedaan';
	await db.from('taken').upsert({ naam: 'herinnering', laatst: nu.toISOString() });

	const voor = (dagen: number) => new Date(nu.getTime() - dagen * DAG).toISOString();
	const bestellingen = (keer: number) => db.from('bestellingen').select('id, naam, email, totaal, levering, aangemaakt, herinneringen')
		.eq('status', 'nieuw').is('gereageerd_op', null).eq('herinneringen', keer).lt('aangemaakt', voor(HERINNER_NA[keer]));
	const berichten = (keer: number) => db.from('berichten').select('id, site, soort, naam, email, product, bericht, velden, aangemaakt, herinneringen')
		.eq('status', 'nieuw').neq('soort', 'beschikbaarheid').is('gereageerd_op', null).eq('herinneringen', keer).lt('aangemaakt', voor(HERINNER_NA[keer]));
	const lijsten = await Promise.all([bestellingen(0), bestellingen(1), berichten(0), berichten(1)]);
	lijsten.forEach((l) => { if (l.error) console.error('Herinneringen ophalen mislukt', l.error); });

	const items = [];
	for (const rij of [...(lijsten[0].data ?? []), ...(lijsten[1].data ?? [])]) {
		items.push({ tabel: 'b', soort: 'bestelling', id: rij.id, naam: rij.naam, email: rij.email, totaal: rij.totaal, levering: rij.levering, aangemaakt: rij.aangemaakt, keer: rij.herinneringen + 1, gereageerdLink: await gereageerdLink('b', rij.id) });
	}
	for (const rij of [...(lijsten[2].data ?? []), ...(lijsten[3].data ?? [])]) {
		const tekst = rij.bericht || Object.values(rij.velden ?? {}).join(' · ');
		items.push({ tabel: 'm', soort: rij.soort, id: rij.id, naam: rij.naam, email: rij.email, product: rij.product, tekst, aangemaakt: rij.aangemaakt, keer: rij.herinneringen + 1, gereageerdLink: await gereageerdLink('m', rij.id), merk: rij.site === PORTFOLIO.site ? PORTFOLIO.naam : undefined });
	}
	if (!items.length) return 'niets open';
	items.sort((a, b) => a.aangemaakt.localeCompare(b.aangemaakt));

	const verstuurd = await stuurMail(MAIL_EIGENAAR || w.winkel.email, '', mailHerinnering(items, w.winkel, nu.getTime(), dashboard));
	if (!verstuurd) return 'mail mislukt';
	for (const it of items) {
		await db.from(it.tabel === 'b' ? 'bestellingen' : 'berichten').update({ herinneringen: it.keer }).eq('id', it.id);
	}
	return items.length + ' in de herinnering';
}

// Openbaar aan te roepen (pg_cron doet dat elk uur), maar hooguit eens per 50 minuten echt uitgevoerd
async function taken(headers: Record<string, string>) {
	const nu = new Date();
	const { data: vorige } = await db.from('taken').select('laatst').eq('naam', 'uurlijks').maybeSingle();
	if (vorige && nu.getTime() - new Date(vorige.laatst).getTime() < 50 * 60 * 1000) return antwoord({ ok: true, overgeslagen: true }, 200, headers);
	await db.from('taken').upsert({ naam: 'uurlijks', laatst: nu.toISOString() });
	const w = await winkel();
	const verslag = { opgeruimd: await opruimen(w), herinnering: await herinneren(w, nu) };
	console.log('Taken', JSON.stringify(verslag));
	return antwoord({ ok: true, ...verslag }, 200, headers);
}

// ---------------------------------------------------------------------------------------------- formulieren

Deno.serve(async (req) => {
	const headers = cors(req.headers.get('origin'));
	if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
	if (req.method === 'GET') {
		const url = new URL(req.url);
		if (url.searchParams.has('bestand')) return download(url);
		return tekstAntwoord('Alleen POST.', 405);
	}
	if (req.method !== 'POST') return antwoord({ ok: false, fout: 'Alleen POST.' }, 405, headers);

	let invoer: any;
	try { invoer = await req.json(); } catch { return antwoord({ ok: false, fout: 'Ongeldige aanvraag.' }, 400, headers); }
	if (!invoer || typeof invoer !== 'object') return antwoord({ ok: false, fout: 'Ongeldige aanvraag.' }, 400, headers);

	try {
		if (invoer.actie === 'upload') return await uploadAdressen(invoer, req, headers);
		if (invoer.actie === 'gereageerd') return await gereageerd(invoer, headers);
		if (invoer.actie === 'bevestig') { const r = await bevestigNieuwsbrief(invoer.token); return antwoord(r, r.ok ? 200 : 400, headers); }
		if (invoer.actie === 'taken') return await taken(headers);
	} catch (e) {
		console.error('Actie ' + invoer.actie + ' mislukt', e);
		return antwoord({ ok: false, fout: 'Er ging iets mis aan mijn kant. Probeer het zo opnieuw.' }, 500, headers);
	}

	// Robots (honeypot, te snel of niet via de website): nep-"verstuurd", niets opslaan, niets mailen
	const robot = spamSignaal(invoer, null);
	if (robot && stilWeggooien(robot)) return antwoord({ ok: true, id: null }, 200, headers);

	let w: any;
	try { w = await winkel(); } catch (e) {
		console.error(e);
		return antwoord({ ok: false, fout: 'Er ging iets mis aan mijn kant. Probeer het zo opnieuw of mail me direct.' }, 503, headers);
	}

	const gecontroleerd = controleer(invoer, w.catalogus);
	if (!gecontroleerd.ok) return antwoord({ ok: false, fout: gecontroleerd.fout }, 400, headers);
	const data = gecontroleerd.data;

	// Limieten tegen misbruik, ook om te voorkomen dat iemand via de bevestigingsmail een ander bestookt
	const ip = bezoekerIp(req);
	const [ipHash, emailHash] = await Promise.all([ip ? hash('ip:' + ip) : '', hash('email:' + data.email)]);
	const [perIp, perEmail] = await Promise.all([ipHash ? recent('ip_hash', ipHash, 10) : 0, recent('email_hash', emailHash, 24 * 60)]);
	if (perIp >= LIMIET_IP || perEmail >= LIMIET_EMAIL) {
		return antwoord({ ok: false, fout: 'Je hebt net al een paar keer iets verstuurd. Probeer het later opnieuw, of mail me direct.' }, 429, headers);
	}
	const log = await db.from('inzendingen_log').insert({ ip_hash: ipHash, email_hash: emailHash });
	if (log.error) console.error('Loggen mislukt', log.error);

	// Aanmelden voor de nieuwsbrief (onderaan een pagina of op de bedanktpagina): een mail met de bevestigingsknop.
	// Staat het adres er al op, dan gebeurt er niets, maar het antwoord is hetzelfde (niemand kan zo adressen aftasten).
	if (data.soort === 'nieuwsbrief') {
		const link = await nieuwsbriefAanvraag(data.email, data.bron);
		if (link) await stuurMail(data.email, MAIL_EIGENAAR || w.winkel.email, mailNieuwsbrief(link, w.winkel));
		return antwoord({ ok: true }, 200, headers);
	}

	const moment = new Date().toISOString();
	const akkoordOp = data.akkoord ? moment : null;

	// Bestelling: prijzen narekenen en opslaan
	if (data.soort === 'bestelling') {
		const berekend = prijzen(data.regels, w.catalogus);
		if (!berekend.ok) return antwoord({ ok: false, fout: berekend.fout }, 400, headers);
		const id = ordernummer();
		const { error } = await db.from('bestellingen').insert({
			id, naam: data.naam, email: data.email, telefoon: data.telefoon, levering: data.levering,
			adres: data.adres ?? null, postcode: data.postcode ?? null, plaats: data.plaats ?? null, land: data.land ?? null,
			opmerkingen: data.opmerkingen || null, regels: berekend.regels, totaal: berekend.totaal, akkoord_op: akkoordOp
		});
		if (error) {
			console.error('Opslaan bestelling mislukt', error);
			return antwoord({ ok: false, fout: 'Je bestelling kon niet worden opgeslagen. Probeer het opnieuw of mail me direct.' }, 500, headers);
		}
		const extra = {
			id, regels: berekend.regels, totaal: berekend.totaal, moment, dashboard,
			gereageerdLink: await gereageerdLink('b', id),
			nieuwsbriefLink: data.nieuwsbrief ? await nieuwsbriefAanvraag(data.email, 'bestelling') : null
		};
		const [eigenaar, klant] = await Promise.all([
			stuurMail(MAIL_EIGENAAR || w.winkel.email, data.email, mailEigenaar(data, extra, w.winkel)),
			stuurMail(data.email, MAIL_EIGENAAR || w.winkel.email, mailKlant(data, extra, w.winkel))
		]);
		await db.from('bestellingen').update({ mail_eigenaar: eigenaar, mail_klant: klant }).eq('id', id);
		return antwoord({ ok: true, id, totaal: berekend.totaal, mail: klant }, 200, headers);
	}

	// Overige formulieren. Lijkt het op SEO-spam (veel links), dan wel opslaan maar niet mailen.
	// Een bericht via het portfolio krijgt in de mails de naam en het adres van het portfolio.
	const spam = spamSignaal(invoer, data);
	const portfolio = data.site === 'portfolio';
	const merk = portfolio ? { ...w.winkel, ...PORTFOLIO, portfolio: true } : w.winkel;
	const van = portfolio ? MAIL_VAN_PORTFOLIO : MAIL_VAN;
	const { data: rij, error } = await db.from('berichten').insert({
		...(portfolio ? { site: PORTFOLIO.site } : {}),
		soort: data.soort, naam: data.naam || null, email: data.email, product: data.product || null,
		velden: data.velden ?? {}, bericht: data.bericht ?? null, akkoord_op: akkoordOp,
		status: spam ? 'spam' : 'nieuw', spam_reden: spam
	}).select('id').single();
	if (error) {
		console.error('Opslaan bericht mislukt', error);
		return antwoord({ ok: false, fout: 'Je bericht kon niet worden opgeslagen. Probeer het opnieuw of mail me direct.' }, 500, headers);
	}
	if (spam) return antwoord({ ok: true, id: null }, 200, headers);

	const extra = {
		id: rij.id, moment, dashboard,
		bestanden: await koppelBestanden(data.bestanden, data.soort, rij.id),
		bewaarMaanden: w.uploads?.keepMonths ?? null,
		gereageerdLink: data.soort === 'beschikbaarheid' ? null : await gereageerdLink('m', rij.id),
		nieuwsbriefLink: data.nieuwsbrief ? await nieuwsbriefAanvraag(data.email, data.soort) : null
	};
	const [eigenaar, klant] = await Promise.all([
		stuurMail(MAIL_EIGENAAR || w.winkel.email, data.email, mailEigenaar(data, extra, merk), van),
		stuurMail(data.email, MAIL_EIGENAAR || w.winkel.email, mailKlant(data, extra, merk), van)
	]);
	await db.from('berichten').update({ mail_eigenaar: eigenaar, mail_klant: klant }).eq('id', rij.id);
	return antwoord({ ok: true, id: rij.id, mail: klant, bestanden: extra.bestanden.length }, 200, headers);
});
