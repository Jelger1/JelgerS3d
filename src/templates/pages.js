// Losse pagina's: de privacyverklaring (tekst uit src/pages/privacy.html) en de 404-pagina.
const h = require('./helpers');

function legalValues(site) {
	const updated = new Date((site.legal && site.legal.updated || '2026-01-01') + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
	return {
		name: h.esc(site.name), owner: h.esc(site.owner), city: h.esc((site.address && site.address.city) || site.pickupLocation),
		email: h.esc(site.email), kvk: h.esc(site.kvk), btw: h.esc(site.btw),
		addressHtml: h.addressLine(site, '<br>'), updated: updated
	};
}

function privacyPage(ctx, template) {
	const site = ctx.site;
	const measuring = Boolean(site.analytics && (site.analytics.ga4 || site.analytics.googleAds));
	const cookieText = measuring
		? '<p><strong>Alleen met jouw toestemming</strong> gebruik ik diensten van Google'
			+ (site.analytics.ga4 ? ' om te meten hoe de website wordt gebruikt (Google Analytics)' : '')
			+ (site.analytics.ga4 && site.analytics.googleAds ? ' en' : '')
			+ (site.analytics.googleAds ? ' om te meten of advertenties tot een bestelling leiden (Google Ads)' : '')
			+ '. Daarbij plaatst Google cookies en kan het je gegevens buiten de EER verwerken. Zolang je geen toestemming geeft, wordt er niets van Google geladen. Je kiest per categorie en kunt je keuze altijd aanpassen of intrekken via "Cookie-instellingen" onderaan elke pagina. Je keuze wordt maximaal 12 maanden onthouden; daarna vraag ik het opnieuw.</p>'
		: '<p>Deze website plaatst <strong>geen analytische cookies en geen marketingcookies</strong> en volgt je niet. Verandert dat ooit, dan vraag ik je eerst om toestemming via een cookiemelding waarin weigeren net zo makkelijk is als accepteren.</p>';

	const body = h.fill(template.replace(/^<!--[\s\S]*?-->\s*/, ''), Object.assign(legalValues(site), { cookieText: cookieText }));

	return {
		path: 'privacy.html',
		root: '',
		name: 'text',
		title: 'Privacyverklaring | ' + site.name,
		description: 'Hoe ' + site.name + ' omgaat met je gegevens: welke gegevens ik ontvang bij een bestelling of bericht, waarvoor ik ze gebruik en wat je rechten zijn.',
		ogImage: ctx.images[site.defaultOgImage].og,
		main: '<div class="container text-page">\n' + body + '\n</div>'
	};
}

function termsPage(ctx, template) {
	const site = ctx.site;
	return {
		path: 'voorwaarden.html',
		root: '',
		name: 'text',
		title: 'Algemene voorwaarden | ' + site.name,
		description: 'De algemene voorwaarden van ' + site.name + ': hoe bestellen werkt, prijzen en betaling, levering en ophalen, herroepingsrecht, garantie en klachten.',
		ogImage: ctx.images[site.defaultOgImage].og,
		main: '<div class="container text-page">\n' + h.fill(template.replace(/^<!--[\s\S]*?-->\s*/, ''), legalValues(site)) + '\n</div>'
	};
}

// GitHub Pages toont 404.html voor elk adres dat niet bestaat, ook in submappen.
// Daarom gebruikt deze pagina adressen vanaf de hoofdmap ("/css/...") in plaats van relatieve.
function notFoundPage(ctx) {
	const site = ctx.site;
	const links = site.categoryPages.map(function (page) {
		return '<li><a class="chip-link" href="/' + page.slug + '.html">' + h.esc(page.label) + '</a></li>';
	}).join('\n\t\t');

	return {
		path: '404.html',
		root: '/',
		name: 'text',
		noindex: true,
		title: 'Pagina niet gevonden | ' + site.name,
		description: 'Deze pagina bestaat niet (meer). Bekijk de webshop van ' + site.name + ' of ga terug naar de homepage.',
		ogImage: ctx.images[site.defaultOgImage].og,
		main: '<div class="container text-page not-found">\n'
			+ '\t<p class="kicker">Foutcode 404</p>\n'
			+ '\t<h1>Deze pagina is <span class="highlight">niet gevonden</span></h1>\n'
			+ '\t<p class="text-page-intro">Misschien is het product uit de collectie gehaald of klopt de link niet meer. Geen zorgen, de rest staat er nog.</p>\n'
			+ '\t<p class="cta-row"><a class="btn primary" href="/webshop.html">Naar de webshop</a> <a class="btn outline" href="/index.html">Naar de homepage</a></p>\n'
			+ '\t<ul class="chips">\n\t\t' + links + '\n\t</ul>\n'
			+ '</div>'
	};
}

module.exports = { privacyPage: privacyPage, termsPage: termsPage, notFoundPage: notFoundPage };
