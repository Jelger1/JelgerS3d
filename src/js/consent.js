// Cookiemelding + Google-tags (Analytics 4 en/of Google Ads), alleen actief als er in data/site.json > analytics
// een ID is ingevuld. Werkwijze (Consent Mode v2, "basic"):
//   1. standaard staat alles op geweigerd en wordt er géén Google-script geladen;
//   2. pas na "Accepteren" wordt gtag.js geladen en worden de klaargezette meetmomenten verstuurd;
//   3. weigeren is net zo makkelijk als accepteren, en de keuze is altijd aan te passen via de footer.
const STORAGE_KEY = 'js3d-consent-v1';
const el = document.documentElement;
const ga4 = el.dataset.ga4 || '';
const ads = el.dataset.ads || '';
const adsLabel = el.dataset.adsLabel || '';

let loaded = false;

function gtag() { window.dataLayer.push(arguments); }

function readChoice() {
	try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
}

function saveChoice(value) {
	try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* privémodus: keuze geldt alleen voor deze pagina */ }
}

function loadTags() {
	if (loaded) return;
	loaded = true;
	gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' });
	const script = document.createElement('script');
	script.async = true;
	script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga4 || ads);
	document.head.appendChild(script);
	gtag('js', new Date());
	if (ga4) gtag('config', ga4);
	if (ads) gtag('config', ads);
}

function banner() {
	let box = document.getElementById('cookie-banner');
	if (box) { box.hidden = false; return box; }

	box = document.createElement('section');
	box.id = 'cookie-banner';
	box.className = 'cookie-banner';
	box.setAttribute('aria-label', 'Cookies');
	box.innerHTML = '<p><strong>Mag ik meten wat werkt?</strong> Met je toestemming gebruik ik cookies van Google om te zien hoe de site wordt gebruikt en of advertenties werken. De winkel werkt ook prima zonder. '
		+ '<a href="' + (document.body.dataset.root || '') + 'privacy.html">Meer uitleg</a></p>'
		+ '<div class="cookie-banner-actions">'
		+ '<button type="button" class="btn outline" data-consent="denied">Weigeren</button>'
		+ '<button type="button" class="btn outline" data-consent="granted">Accepteren</button>'
		+ '</div>';
	box.addEventListener('click', function (event) {
		const button = event.target.closest('[data-consent]');
		if (!button) return;
		const previous = readChoice();
		saveChoice(button.dataset.consent);
		box.hidden = true;
		if (button.dataset.consent === 'granted') loadTags();
		// Toestemming ingetrokken terwijl de tags al draaien: herladen is de enige nette manier om ze te stoppen
		else if (previous === 'granted') location.reload();
	});
	document.body.appendChild(box);
	return box;
}

// Wordt door track() in util.js aangeroepen bij elk meetmoment
export function sendEvent(event, params) {
	if (!ga4 && !ads) return;
	const flat = Object.assign({}, params || {});
	if (flat.ecommerce) { Object.assign(flat, flat.ecommerce); delete flat.ecommerce; }
	gtag('event', event, flat);

	// Een verstuurde bestelling telt als conversie in Google Ads
	if (ads && adsLabel && event === 'generate_lead' && flat.transaction_id) {
		gtag('event', 'conversion', { send_to: ads + '/' + adsLabel, value: flat.value, currency: flat.currency, transaction_id: flat.transaction_id });
	}
}

export function initConsent() {
	if (!ga4 && !ads) return;
	window.dataLayer = window.dataLayer || [];
	gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });

	const choice = readChoice();
	if (choice === 'granted') loadTags();
	else if (choice !== 'denied') banner();

	document.querySelectorAll('[data-cookie-settings]').forEach(function (button) {
		button.hidden = false;
		button.addEventListener('click', function () { banner(); });
	});
}
