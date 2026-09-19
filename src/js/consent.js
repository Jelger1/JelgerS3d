// Cookietoestemming (AVG + ePrivacy/Telecommunicatiewet) en het laden van Google-tags.
//
// Uitgangspunten:
//   - Zonder ID's in data/site.json > analytics plaatst de site geen enkele tracking- of marketingcookie.
//     Er is dan niets om toestemming voor te vragen, dus verschijnt er geen banner. "Cookie-instellingen"
//     in de footer laat wel altijd zien wat er gebruikt wordt.
//   - Met ID's: alles staat standaard op geweigerd (Consent Mode v2) en er wordt GEEN Google-script geladen
//     totdat de bezoeker toestemming geeft.
//   - "Alles accepteren" en "Weigeren" zijn even prominent; via "Voorkeuren beheren" kies je per categorie.
//   - De keuze wordt 12 maanden onthouden en is altijd aan te passen of in te trekken via de footer.
import { openDialog, closeDialog } from './dialog.js';

const STORAGE_KEY = 'js3d-consent-v2';
const MAX_AGE_DAYS = 365;
const html = document.documentElement;
const ga4 = html.dataset.ga4 || '';
const ads = html.dataset.ads || '';
const adsLabel = html.dataset.adsLabel || '';
const root = document.body.dataset.root || '';

// Welke categorieën zijn er op deze site? Alleen wat echt gebruikt wordt, wordt gevraagd.
const CATEGORIES = [
	{ id: 'necessary', label: 'Noodzakelijk', locked: true, active: true, text: 'Nodig om de winkel te laten werken: je winkelwagen en je cookiekeuze worden in je eigen browser bewaard. Hiermee word je niet gevolgd.' },
	{ id: 'statistics', label: 'Statistieken', active: Boolean(ga4), text: 'Google Analytics meet hoe de website wordt gebruikt, zodat ik hem kan verbeteren. Hiervoor plaatst Google cookies.' },
	{ id: 'marketing', label: 'Marketing', active: Boolean(ads), text: 'Google Ads meet of een advertentie tot een bestelling heeft geleid. Hiervoor plaatst Google cookies.' }
].filter(function (category) { return category.active; });
const OPTIONAL = CATEGORIES.filter(function (category) { return !category.locked; });

let tagsLoaded = false;
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

// Laadt gtag.js, en alleen de onderdelen waarvoor toestemming is
function loadTags(choice) {
	gtag('consent', 'update', consentState(choice));
	const wantsGa4 = ga4 && choice.statistics;
	const wantsAds = ads && choice.marketing;
	if (tagsLoaded || (!wantsGa4 && !wantsAds)) return;
	tagsLoaded = true;
	const script = document.createElement('script');
	script.async = true;
	script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(wantsGa4 ? ga4 : ads);
	document.head.appendChild(script);
	gtag('js', new Date());
	if (wantsGa4) gtag('config', ga4);
	if (wantsAds) gtag('config', ads);
}

function apply(choice) {
	const previous = readChoice();
	const record = saveChoice(choice);
	if (bannerEl) bannerEl.hidden = true;
	if (dialogEl) closeDialog(dialogEl);
	// Is er toestemming ingetrokken terwijl de tags al draaien, dan is herladen de enige nette manier om ze te stoppen
	const revoked = previous && ((previous.statistics && !record.statistics) || (previous.marketing && !record.marketing));
	if (revoked && tagsLoaded) { location.reload(); return; }
	loadTags(record);
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

// Wordt door track() in util.js aangeroepen bij elk meetmoment
export function sendEvent(event, params) {
	if (!OPTIONAL.length) return;
	const flat = Object.assign({}, params || {});
	if (flat.ecommerce) { Object.assign(flat, flat.ecommerce); delete flat.ecommerce; }
	gtag('event', event, flat);

	// Een verstuurde bestelling telt als conversie in Google Ads
	if (ads && adsLabel && event === 'generate_lead' && flat.transaction_id) {
		gtag('event', 'conversion', { send_to: ads + '/' + adsLabel, value: flat.value, currency: flat.currency, transaction_id: flat.transaction_id });
	}
}

export function initConsent() {
	document.querySelectorAll('[data-cookie-settings]').forEach(function (button) {
		button.addEventListener('click', showPreferences);
	});
	if (!OPTIONAL.length) return; // geen tags ingesteld: niets te vragen

	window.dataLayer = window.dataLayer || [];
	gtag('consent', 'default', consentState(null));

	const choice = readChoice();
	if (!choice) showBanner();
	else loadTags(choice);
}
