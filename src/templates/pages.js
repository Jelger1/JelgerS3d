// Losse pagina's: de privacyverklaring (tekst uit src/pages/privacy.html) en de 404-pagina.
const h = require('./helpers');

function privacyPage(ctx, template) {
	const site = ctx.site;
	const measuring = Boolean(site.analytics && (site.analytics.ga4 || site.analytics.googleAds));
	const cookieText = measuring
		? '<p>Alleen als je daar toestemming voor geeft, gebruik ik Google-diensten om te meten hoe de website wordt gebruikt en of advertenties werken. Daarbij worden cookies geplaatst. Zonder jouw toestemming gebeurt dat niet, en je kunt je keuze altijd aanpassen via "Cookie-instellingen" onderaan elke pagina.</p>'
		: '<p>Deze website gebruikt geen analytische cookies en geen advertentiecookies, en volgt je niet. Verandert dat ooit, dan vraag ik je eerst om toestemming.</p>';

	const body = h.fill(template.replace(/^<!--[\s\S]*?-->\s*/, ''), {
		name: h.esc(site.name), owner: h.esc(site.owner), city: h.esc(site.pickupLocation),
		email: h.esc(site.email), kvk: h.esc(site.kvk), cookieText: cookieText
	});

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

module.exports = { privacyPage: privacyPage, notFoundPage: notFoundPage };
