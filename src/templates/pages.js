// Losse pagina's: de privacyverklaring (tekst uit src/pages/privacy.html) en de 404-pagina.
const h = require('./helpers');

function legalValues(site) {
	const updated = new Date((site.legal && site.legal.updated || '2026-01-01') + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
	return {
		name: h.esc(site.name), owner: h.esc(site.owner), city: h.esc((site.address && site.address.city) || site.pickupLocation),
		email: h.esc(site.email), kvk: h.esc(site.kvk), btw: h.esc(site.btw),
		// Zonder straat op de site: eerlijk zeggen waar de klant het volledige adres wél krijgt
		addressHtml: h.addressLine(site, '<br>') + (site.address && site.address.onRequest && !site.address.street
			? ', ' + h.esc(site.address.country || 'Nederland') + '<br><span class="text-page-note">Ik werk vanuit huis. Het volledige adres staat in je orderbevestiging en op je factuur, en krijg je op verzoek per e-mail.</span>'
			: ''),
		updated: updated
	};
}

// "a", "a en b", "a, b en c"
function joinDutch(items) {
	return items.length > 1 ? items.slice(0, -1).join(', ') + ' en ' + items[items.length - 1] : items.join('');
}

function privacyPage(ctx, template) {
	const site = ctx.site;
	const analytics = site.analytics || {};
	// Alles loopt via Tag Manager, dat op elke pagina laadt (zie layout.js); zonder Tag Manager laadt er niets van Google
	const gtm = Boolean(analytics.gtm);
	const ga4 = gtm && analytics.ga4;
	const ads = gtm && analytics.googleAds;
	const services = [ga4 && 'Google Analytics', ads && 'Google Ads'].filter(Boolean);

	const statisticsRow = ga4
		? '\t\t<tr>\n'
			+ '\t\t\t<th scope="row">Meten hoe de website wordt gebruikt, zodat ik hem kan verbeteren (Google Analytics)</th>\n'
			+ '\t\t\t<td>Welke pagina\'s je bekijkt en wat je op de website doet, zoals producten in je winkelwagen leggen of een bestelling versturen (met de producten en het bedrag). Verder hoe je op de website kwam, je apparaat en browser, je globale locatie (land en stad) en een willekeurig cookie-ID. Volgens Google gebruikt Analytics je IP-adres alleen om die locatie te bepalen en wordt het niet opgeslagen.</td>\n'
			+ '\t\t\t<td>Jouw toestemming (art. 6 lid 1 onder a), die je altijd kunt intrekken</td>\n'
			+ '\t\t\t<td>Maximaal 14 maanden, daarna worden de gegevens van je bezoek automatisch verwijderd</td>\n'
			+ '\t\t</tr>'
		: '';

	const googleSharing = gtm
		? '<p>Daarnaast laadt de website op elke pagina <strong>Google Tag Manager</strong>' + (services.length ? ', met daarin ' + joinDutch(services) : '')
			+ '. Daarbij ontvangt Google gegevens over je bezoek' + (services.length ? '; cookies worden alleen met jouw toestemming geplaatst' : '') + '. Meer daarover lees je bij <a href="#cookies">cookies</a>.</p>'
		: '';

	const cookieText = gtm
		? '<p>Op elke pagina laadt de website <strong>Google Tag Manager</strong>, een hulpmiddel van Google om meetcodes te beheren. Tag Manager plaatst zelf geen cookies, maar Google ontvangt daarbij wel technische gegevens, zoals je IP-adres en welke pagina je bekijkt.</p>\n'
			+ (services.length
				? '<p>Via Tag Manager gebruik ik de volgende diensten van Google. Cookies plaatsen ze <strong>alleen met jouw toestemming</strong>:</p>\n<ul>\n'
					+ (ga4 ? '\t<li><strong>Statistieken (Google Analytics):</strong> meet hoe de website wordt gebruikt, zodat ik hem kan verbeteren. Met je toestemming plaatst Google hiervoor de cookies <code>_ga</code> en <code>_ga_' + h.esc(analytics.ga4.replace(/^G-/, '')) + '</code>, die maximaal 2 jaar na je laatste bezoek bewaard blijven. Zonder toestemming plaatst Google Analytics geen cookies, maar kan het wel een melding zonder cookies en zonder ID sturen (bijvoorbeeld dat er een pagina is bekeken), waarmee Google bezoekersaantallen schat.</li>\n' : '')
					+ (ads ? '\t<li><strong>Marketing (Google Ads):</strong> meet of een advertentie tot een bestelling heeft geleid. Met je toestemming plaatst Google hiervoor cookies.</li>\n' : '')
					+ '</ul>\n'
					+ '<p>Je kiest per categorie en kunt je keuze altijd aanpassen of intrekken via "Cookie-instellingen" onderaan elke pagina. Trek je je toestemming in, dan verwijdert de website ook de cookies die Google al had geplaatst. Google kan je gegevens ook buiten de EER verwerken, met de waarborgen die hierboven staan. Je keuze wordt maximaal 12 maanden onthouden; daarna vraag ik het opnieuw.</p>'
				: '<p>Via Tag Manager worden geen diensten geladen die cookies plaatsen of je volgen.</p>')
		: '<p>Deze website plaatst <strong>geen analytische cookies en geen marketingcookies</strong> en volgt je niet. Verandert dat ooit, dan vraag ik je eerst om toestemming via een cookiemelding waarin weigeren net zo makkelijk is als accepteren.</p>';

	const body = h.fill(template.replace(/^<!--[\s\S]*?-->\s*/, ''), Object.assign(legalValues(site), {
		usageData: ga4 ? ' en gegevens over hoe je de website gebruikt (Google Analytics, zie <a href="#cookies">cookies</a>)' : '',
		statisticsRow: statisticsRow,
		googleSharing: googleSharing,
		cookieText: cookieText
	}));

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
