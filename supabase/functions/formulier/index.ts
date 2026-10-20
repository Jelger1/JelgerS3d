// Supabase Edge Function "formulier": ontvangt alle formulieren van jelgers3d.nl (bestellen, contact,
// maatwerk, printservice, beschikbaarheid). Controleert de invoer, houdt bots tegen, slaat alles op in de
// database en stuurt twee mails via Resend: een bevestiging naar de klant en een overzicht naar Jelger.
//
// Instellingen (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY   verplicht, de sleutel van resend.com
//   MAIL_VAN         afzender, bv. "JelgerS3D <bestellingen@jelgers3d.nl>" (domein moet bij Resend geverifieerd zijn)
//   MAIL_EIGENAAR    waar Jelger de overzichten wil ontvangen
//   SITE_URL         standaard https://jelgers3d.nl
// SUPABASE_URL en de sleutel voor de database (SUPABASE_SECRET_KEYS of SUPABASE_SERVICE_ROLE_KEY) zet Supabase zelf.
//
// De functie draait zonder inlog ("verify_jwt = false"): de website is openbaar. Bescherming zit hierin:
// honeypot, minimale invultijd, linkfilter, maximaal 5 inzendingen per IP per 10 minuten en per
// e-mailadres per dag. Robots krijgen een nep-"verstuurd" zodat ze niet leren om de filters heen te werken.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { controleer, spamSignaal, stilWeggooien, prijzen, ordernummer, mailEigenaar, mailKlant, ontcijferMail } from './logica.js';

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://jelgers3d.nl').replace(/\/$/, '');
const MAIL_VAN = Deno.env.get('MAIL_VAN') ?? 'JelgerS3D <bestellingen@jelgers3d.nl>';
const MAIL_EIGENAAR = Deno.env.get('MAIL_EIGENAAR') ?? '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = geheimeSleutel();
const HERKOMST = [SITE_URL, SITE_URL.replace('://', '://www.')];
const LIMIET_IP = 5;       // per 10 minuten
const LIMIET_EMAIL = 5;    // per 24 uur

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

// Bedrijfsgegevens en prijzen komen van de website zelf (gemaakt door build.js uit data/*.json),
// zodat er maar één plek is waar ze staan. Vijf minuten bewaren is genoeg. Het e-mailadres staat er
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
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'content-type',
		'Vary': 'Origin'
	};
}

function antwoord(body: unknown, status: number, headers: Record<string, string>) {
	return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function hash(waarde: string) {
	const data = new TextEncoder().encode(waarde + '|' + SERVICE_KEY.slice(-16));
	const digest = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
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

async function stuurMail(aan: string, antwoordAan: string, mail: { onderwerp: string; html: string; tekst: string }) {
	if (!RESEND_KEY || !aan) return false;
	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: MAIL_VAN, to: [aan], reply_to: antwoordAan || undefined, subject: mail.onderwerp, html: mail.html, text: mail.tekst })
		});
		if (!res.ok) console.error('Resend weigerde de mail', res.status, await res.text());
		return res.ok;
	} catch (e) {
		console.error('Resend niet bereikbaar', e);
		return false;
	}
}

Deno.serve(async (req) => {
	const headers = cors(req.headers.get('origin'));
	if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
	if (req.method !== 'POST') return antwoord({ ok: false, fout: 'Alleen POST.' }, 405, headers);

	let invoer: any;
	try { invoer = await req.json(); } catch { return antwoord({ ok: false, fout: 'Ongeldige aanvraag.' }, 400, headers); }

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
		const extra = { id, regels: berekend.regels, totaal: berekend.totaal, moment, dashboard };
		const [eigenaar, klant] = await Promise.all([
			stuurMail(MAIL_EIGENAAR || w.winkel.email, data.email, mailEigenaar(data, extra, w.winkel)),
			stuurMail(data.email, MAIL_EIGENAAR || w.winkel.email, mailKlant(data, extra, w.winkel))
		]);
		await db.from('bestellingen').update({ mail_eigenaar: eigenaar, mail_klant: klant }).eq('id', id);
		return antwoord({ ok: true, id, totaal: berekend.totaal, mail: klant }, 200, headers);
	}

	// Overige formulieren. Lijkt het op SEO-spam (veel links), dan wel opslaan maar niet mailen.
	const spam = spamSignaal(invoer, data);
	const { data: rij, error } = await db.from('berichten').insert({
		soort: data.soort, naam: data.naam || null, email: data.email, product: data.product || null,
		velden: data.velden ?? {}, bericht: data.bericht ?? null, akkoord_op: akkoordOp,
		status: spam ? 'spam' : 'nieuw', spam_reden: spam
	}).select('id').single();
	if (error) {
		console.error('Opslaan bericht mislukt', error);
		return antwoord({ ok: false, fout: 'Je bericht kon niet worden opgeslagen. Probeer het opnieuw of mail me direct.' }, 500, headers);
	}
	if (spam) return antwoord({ ok: true, id: null }, 200, headers);

	const extra = { id: rij.id, moment, dashboard };
	const [eigenaar, klant] = await Promise.all([
		stuurMail(MAIL_EIGENAAR || w.winkel.email, data.email, mailEigenaar(data, extra, w.winkel)),
		stuurMail(data.email, MAIL_EIGENAAR || w.winkel.email, mailKlant(data, extra, w.winkel))
	]);
	await db.from('berichten').update({ mail_eigenaar: eigenaar, mail_klant: klant }).eq('id', rij.id);
	return antwoord({ ok: true, id: rij.id, mail: klant }, 200, headers);
});
