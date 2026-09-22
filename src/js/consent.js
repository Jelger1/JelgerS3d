// Cookietoestemming (AVG + ePrivacy/Telecommunicatiewet) voor Google Tag Manager.
//
// Uitgangspunten:
//   - Alle tags, ook Google Analytics, zitten in Tag Manager. Tag Manager staat bovenaan elke pagina
//     (src/templates/layout.js), met direct daarvóór de standaardtoestemming (Consent Mode v2): alles geweigerd,
//     of de keuze die de bezoeker eerder maakte. Deze module toont de banner en geeft nieuwe keuzes door.
//   - Tags in Tag Manager moeten die toestemming respecteren. Tags van Google doen dat zelf; bij andere tags stel je
//     het in bij de tag. Na elke keuze komt er een dataLayer-event "cookie_consent_update".
//   - De categorieën volgen uit data/site.json > analytics (ga4 = Statistieken, googleAds = Marketing). Zonder die
//     ID's valt er niets te kiezen en verschijnt er geen banner; "Cookie-instellingen" in de footer werkt altijd.
//   - "Alles accepteren" en "Weigeren" zijn even prominent; via "Voorkeuren beheren" kies je per categorie.
//   - De keuze wordt 12 maanden onthouden en is altijd aan te passen of in te trekken via de footer.
//     Opslagnaam en termijn staan ook in het inline script in layout.js: houd die gelijk.
import { openDialog, closeDialog } from './dialog.js';

const STORAGE_KEY = 'js3d-consent-v2';
const MAX_AGE_DAYS = 365;
const html = document.documentElement;
const ga4 = html.dataset.ga4 || '';
const ads = html.dataset.ads || '';
const root = document.body.dataset.root || '';
// De cookies die Google per categorie plaatst; bij weigeren of intrekken ruimt de site ze op
const GOOGLE_COOKIES = { statistics: /^_ga(_|$)/, marketing: /^_(gcl|gac)_/ };

// Welke categorieën zijn er op deze site? Alleen wat echt gebruikt wordt, wordt gevraagd.
const CATEGORIES = [
	{ id: 'necessary', label: 'Noodzakelijk', locked: true, active: true, text: 'Nodig om de winkel te laten werken: je winkelwagen en je cookiekeuze worden in je eigen browser bewaard. Hiermee word je niet gevolgd.' },
	{ id: 'statistics', label: 'Statistieken', active: Boolean(ga4), text: 'Google Analytics meet hoe de website wordt gebruikt, zodat ik hem kan verbeteren. Hiervoor plaatst Google cookies.' },
	{ id: 'marketing', label: 'Marketing', active: Boolean(ads), text: 'Google Ads meet of een advertentie tot een bestelling heeft geleid. Hiervoor plaatst Google cookies.' }
].filter(function (category) { return category.active; });
const OPTIONAL = CATEGORIES.filter(function (category) { return !category.locked; });

let bannerEl = null;
let dialogEl = null;

function gtag() { window.dataLayer.push(arguments); }

function readChoice() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
		if (!saved || !saved.date) return null;
		const ageDays = (Date.now() - new Date(saved.date).getTime()) / 86400000;
		if (ageDays > MAX_AGE_DAYS) return null; // na een jaar opnieuw vragen
		// Is er sinds de keuze een categorie bijgekomen die de bezoeker nooit heeft gezien? Dan opnieuw vragen.
		const seen = saved.seen || [];
		if (OPTIONAL.some(function (category) { return seen.indexOf(category.id) === -1; })) return null;
		return saved;
	} catch (e) { return null; }
}

function saveChoice(choice) {
	// Toestemming geldt alleen voor categorieën die ook echt getoond zijn ("seen")
	const offered = function (id) { return OPTIONAL.some(function (category) { return category.id === id; }); };
	const record = {
		statistics: offered('statistics') && Boolean(choice.statistics),
		marketing: offered('marketing') && Boolean(choice.marketing),
		seen: OPTIONAL.map(function (category) { return category.id; }),
		date: new Date().toISOString()
	};
	try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch (e) { /* privémodus: keuze geldt alleen voor deze pagina */ }
	return record;
}

function consentState(choice) {
	return {
		analytics_storage: choice && choice.statistics ? 'granted' : 'denied',
		ad_storage: choice && choice.marketing ? 'granted' : 'denied',
		ad_user_data: choice && choice.marketing ? 'granted' : 'denied',
		ad_personalization: choice && choice.marketing ? 'granted' : 'denied'
	};
}

// Verwijdert cookies waarvan de naam op het patroon past. Google zet ze op het hoofddomein (.jelgers3d.nl) en een
// cookie verdwijnt alleen met hetzelfde domein erbij, dus probeer elk niveau van de hostnaam (en zonder domein).
function removeCookies(pattern) {
	const parts = location.hostname.split('.');
	const domains = [''].concat(parts.map(function (part, i) { return '; domain=' + parts.slice(i).join('.'); }));
	document.cookie.split(';').forEach(function (cookie) {
		const name = cookie.split('=')[0].trim();
		if (!pattern.test(name)) return;
		domains.forEach(function (domain) { document.cookie = name + '=; max-age=0; path=/' + domain; });
	});
}

function apply(choice) {
	const previous = readChoice();
	const record = saveChoice(choice);
	if (bannerEl) bannerEl.hidden = true;
	if (dialogEl) closeDialog(dialogEl);
	const revoked = previous && ((previous.statistics && !record.statistics) || (previous.marketing && !record.marketing));
	// Bij intrekken eerst Analytics stilzetten, anders zet het de cookies die hieronder worden opgeruimd meteen opnieuw
	if (revoked && ga4 && !record.statistics) window['ga-disable-' + ga4] = true;
	gtag('consent', 'update', consentState(record));
	if (!record.statistics) removeCookies(GOOGLE_COOKIES.statistics);
	if (!record.marketing) removeCookies(GOOGLE_COOKIES.marketing);
	// Tags die al draaien zijn niet netjes te stoppen: herladen is de enige manier
	if (revoked) { location.reload(); return; }
	// Voor tags in Tag Manager die pas na een keuze mogen starten (trigger: aangepaste gebeurtenis)
	window.dataLayer.push({ event: 'cookie_consent_update', consent_statistics: record.statistics, consent_marketing: record.marketing });
}

function acceptAll() { apply({ statistics: true, marketing: true }); }
function rejectAll() { apply({ statistics: false, marketing: false }); }

function showBanner() {
	if (!bannerEl) {
		bannerEl = document.createElement('section');
		bannerEl.id = 'cookie-banner';
		bannerEl.className = 'cookie-banner';
		bannerEl.setAttribute('aria-label', 'Cookies');
		// Noem alleen waar het echt om gaat: statistieken, advertenties of allebei
		const purpose = [ga4 ? 'hoe de site wordt gebruikt' : '', ads ? 'of advertenties werken' : ''].filter(Boolean).join(' en ');
		bannerEl.innerHTML = '<p><strong>Mag ik meten wat werkt?</strong> Met je toestemming gebruik ik cookies van Google om te zien ' + purpose + '. De winkel werkt ook prima zonder. '
			+ '<a href="' + root + 'privacy.html#cookies">Meer uitleg</a></p>'
			+ '<div class="cookie-banner-actions">'
			+ '<button type="button" class="btn outline" data-consent-reject>Weigeren</button>'
			+ '<button type="button" class="btn outline" data-consent-accept>Alles accepteren</button>'
			+ '</div>'
			+ '<button type="button" class="cookie-banner-prefs" data-consent-prefs>Voorkeuren beheren</button>';
		bannerEl.querySelector('[data-consent-reject]').addEventListener('click', rejectAll);
		bannerEl.querySelector('[data-consent-accept]').addEventListener('click', acceptAll);
		bannerEl.querySelector('[data-consent-prefs]').addEventListener('click', showPreferences);
		document.body.appendChild(bannerEl);
	}
	bannerEl.hidden = false;
}

function showPreferences() {
	if (!dialogEl) {
		dialogEl = document.createElement('div');
		dialogEl.id = 'cookie-dialog';
		dialogEl.className = 'cookie-dialog';
		dialogEl.setAttribute('role', 'dialog');
		dialogEl.setAttribute('aria-modal', 'true');
		dialogEl.setAttribute('aria-labelledby', 'cookie-dialog-title');
		dialogEl.setAttribute('aria-hidden', 'true');
		dialogEl.setAttribute('inert', '');
		dialogEl.innerHTML = '<div class="cookie-dialog-panel">'
			+ '<div class="cookie-dialog-head"><h2 id="cookie-dialog-title">Cookie-instellingen</h2>'
			+ '<button type="button" class="cart-close" data-consent-close aria-label="Sluiten">✕</button></div>'
			+ '<div class="cookie-dialog-body">'
			+ '<p>' + (OPTIONAL.length
				? 'Kies zelf wat je toestaat. Je kunt je keuze altijd aanpassen via "Cookie-instellingen" onderaan elke pagina.'
				: 'Deze website gebruikt op dit moment alleen noodzakelijke opslag. Er worden geen analytische of marketingcookies geplaatst en je wordt niet gevolgd, dus er valt niets in te stellen.')
			+ ' <a href="' + root + 'privacy.html#cookies">Lees meer in de privacyverklaring</a>.</p>'
			+ CATEGORIES.map(function (category) {
				return '<label class="cookie-option"><span><strong>' + category.label + '</strong><small>' + category.text + '</small></span>'
					+ '<input type="checkbox" class="switch" data-category="' + category.id + '"' + (category.locked ? ' checked disabled' : '') + '>'
					+ '</label>';
			}).join('')
			+ '</div>'
			+ (OPTIONAL.length
				? '<div class="cookie-dialog-foot">'
					+ '<button type="button" class="btn outline" data-consent-reject>Weigeren</button>'
					+ '<button type="button" class="btn outline" data-consent-save>Keuze opslaan</button>'
					+ '<button type="button" class="btn outline" data-consent-accept>Alles accepteren</button>'
					+ '</div>'
				: '<div class="cookie-dialog-foot"><button type="button" class="btn outline" data-consent-close>Sluiten</button></div>')
			+ '</div>';
		dialogEl.addEventListener('click', function (event) {
			if (event.target === dialogEl || event.target.closest('[data-consent-close]')) { closeDialog(dialogEl); return; }
			if (event.target.closest('[data-consent-reject]')) rejectAll();
			else if (event.target.closest('[data-consent-accept]')) acceptAll();
			else if (event.target.closest('[data-consent-save]')) {
				const choice = {};
				dialogEl.querySelectorAll('[data-category]').forEach(function (input) { choice[input.dataset.category] = input.checked; });
				apply(choice);
			}
		});
		document.body.appendChild(dialogEl);
	}
	// Schakelaars tonen de huidige keuze; zonder keuze staat alles uit (nooit vooraf aangevinkt)
	const current = readChoice() || {};
	dialogEl.querySelectorAll('[data-category]:not([disabled])').forEach(function (input) { input.checked = Boolean(current[input.dataset.category]); });
	openDialog(dialogEl);
}

export function initConsent() {
	document.querySelectorAll('[data-cookie-settings]').forEach(function (button) {
		button.addEventListener('click', showPreferences);
	});
	if (!OPTIONAL.length) return; // geen categorieën ingesteld: niets te vragen

	window.dataLayer = window.dataLayer || [];
	// De standaardtoestemming en een eerder gemaakte keuze staan al in de dataLayer (inline script in de <head>)
	if (!readChoice()) showBanner();
}
