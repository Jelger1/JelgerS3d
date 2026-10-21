// Losse pagina's: de privacyverklaring (tekst uit src/pages/privacy.html) en de 404-pagina.
const h = require('./helpers');

function legalValues(site) {
	const updated = new Date((site.legal && site.legal.updated || '2026-01-01') + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
	return {
		name: h.esc(site.name), owner: h.esc(site.owner), city: h.esc((site.address && site.address.city) || site.pickupLocation),
		emailLink: h.mailLink(site.email, './'), kvk: h.esc(site.kvk), btw: h.esc(site.btw),
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
		cookieText: cookieText,
		uploadMaanden: String(site.uploads ? site.uploads.keepMonths : 6)
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

// 3D-printservice: iemand stuurt een bestand en ik print het. De prijzen komen uit
// data/site.json > printService, zodat de tabel en de teksten niet uit elkaar kunnen lopen.
function printServicePage(ctx, template) {
	const site = ctx.site;
	const ps = site.printService || {};
	const prijs = function (gram) { return Math.max(ps.minimumOrder, gram * ps.pricePerGram); };

	// Voorbeeldgewichten: laat zien waar het minimumbedrag ophoudt en de prijs per gram begint
	const rijen = [100, 150, 250, 500, 1000].map(function (gram) {
		const bedrag = prijs(gram);
		const minimum = bedrag === ps.minimumOrder;
		return '\t\t<tr><th scope="row">' + (gram === 1000 ? '1 kilo' : gram + ' gram') + '</th>'
			+ '<td>' + h.euro(bedrag) + (minimum ? ' <span class="text-page-note">(minimumbedrag)</span>' : '') + '</td></tr>';
	}).join('\n');
	const prijstabel = '<div class="table-scroll">\n<table class="text-table">\n'
		+ '\t<thead><tr><th scope="col">Gewicht van de print</th><th scope="col">Prijs</th></tr></thead>\n'
		+ '\t<tbody>\n' + rijen + '\n\t</tbody>\n</table>\n</div>';

	const vragen = [
		{ q: 'Wat kost 3D-printen per gram?', a: 'Standaard PLA in één kleur kost ' + h.euro(ps.pricePerGram) + ' per gram, met een minimum van ' + h.euro(ps.minimumOrder) + ' per opdracht. Een print van 250 gram kost dus ' + h.euro(prijs(250)) + '.' },
		{ q: 'Welke bestanden kan ik aanleveren?', a: ps.formats + '. Heb je nog geen bestand maar wel een idee of een schets? Dan maak ik het ontwerp; dat spreken we apart af.' },
		{ q: 'Hoe lang duurt het?', a: site.delivery.leadTimeLong },
		{ q: 'Hoe groot kan mijn model zijn?', a: 'Ik print op ' + ps.printers + ': ' + ps.maxSize + '. Stuur je bestand gerust, dan laat ik weten of het past.' },
		{ q: 'Kan ik mijn print ophalen?', a: 'Ja, ophalen in ' + site.pickupLocation + ' kan. Laten bezorgen kan ook; de verzendkosten hoor je voordat je betaalt.' },
		{ q: 'Print je ook in meerdere kleuren?', a: 'Het tarief geldt voor één kleur per print. Meerdere kleuren of een ander materiaal kunnen vaak wel, dat stemmen we vooraf af.' }
	];
	const faq = '<h2 id="veelgestelde-vragen">Veelgestelde vragen over 3D-printen</h2>\n<div class="faq">\n'
		+ vragen.map(function (item) {
			return '\t<details class="faq-item"><summary>' + h.esc(item.q) + '</summary><p>' + h.esc(item.a) + '</p></details>';
		}).join('\n') + '\n</div>';

	// Zelfde formulier als de maatwerkaanvraag op een productpagina (src/js/request.js)
	const formulier = '<form class="request-form" data-request="printservice" data-product="3d-printservice" novalidate>\n'
		+ '\t<div class="form-row">\n'
		+ '\t\t<div class="form-group"><label for="rq-name">Naam <span aria-hidden="true">*</span></label><input type="text" id="rq-name" name="name" required autocomplete="name"></div>\n'
		+ '\t\t<div class="form-group"><label for="rq-email">E-mailadres <span aria-hidden="true">*</span></label><input type="email" id="rq-email" name="email" required autocomplete="email"></div>\n'
		+ '\t</div>\n'
		+ '\t<div class="form-row">\n'
		+ '\t\t<div class="form-group"><label for="rq-size">Gewenste kleur</label><input type="text" id="rq-size" name="size" placeholder="Bijv. mat zwart"></div>\n'
		+ '\t\t<div class="form-group form-group-narrow"><label for="rq-qty">Aantal</label><input type="number" id="rq-qty" name="quantity" min="1" value="1" inputmode="numeric"></div>\n'
		+ '\t</div>\n'
		+ '\t' + h.uploadField(site, 'printservice', { label: 'Je 3D-bestand', hint: 'Groter bestand of nog niet klaar? Verstuur gewoon het formulier en mail het bestand later.' }) + '\n'
		+ '\t<div class="form-group"><label for="rq-text">Wat wil je laten printen? <span aria-hidden="true">*</span></label><textarea id="rq-text" name="text" rows="3" required placeholder="Waar het voor is en wanneer je het nodig hebt"></textarea></div>\n'
		+ '\t<input type="checkbox" name="botcheck" class="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">\n'
		+ '\t' + h.nieuwsbriefCheckbox('rq-nieuwsbrief') + '\n'
		+ '\t' + h.privacyCheckbox(site, '', 'rq-privacy', false) + '\n'
		+ '\t<p class="checkout-msg" data-request-msg role="alert"></p>\n'
		+ '\t<button type="submit" class="btn btn-primary btn-block">Verstuur je aanvraag</button>\n'
		+ '\t<p class="pdp-note">Vrijblijvend. Je hoort eerst de prijs en de levertijd; je betaalt pas na jouw akkoord.</p>\n'
		+ '</form>\n'
		+ '<div class="request-success" data-request-success hidden tabindex="-1"><strong>Bedankt, je aanvraag is verstuurd!</strong><p>Ik laat je zo snel mogelijk weten wat het kost en hoe lang het duurt.</p></div>';

	const body = h.fill(template.replace(/^<!--[\s\S]*?-->\s*/, ''), {
		prijsPerGram: h.euro(ps.pricePerGram),
		minimum: h.euro(ps.minimumOrder),
		formats: h.esc(ps.formats),
		formatsOf: h.esc(ps.formats.replace(' en ', ' of ')),
		materiaal: h.esc(ps.material),
		printers: h.esc(ps.printers),
		maxSize: h.esc(ps.maxSize),
		plaats: h.esc(site.pickupLocation),
		levertijd: h.esc(site.delivery.leadTime + '.'),
		maxMB: String(site.uploads ? site.uploads.maxMB : 50),
		emailLink: h.mailLink(site.email, './'),
		prijstabel: prijstabel,
		faq: faq,
		formulier: formulier
	});

	return {
		path: '3d-printservice.html',
		root: '',
		name: 'text',
		title: '3D-printservice vanaf ' + h.euro(ps.pricePerGram) + ' per gram | ' + site.name,
		ogTitle: '3D-printservice in Limburg',
		description: 'Stuur je 3D-bestand (' + ps.formats.replace(' en ', ' of ') + ') en ik print het in ' + site.pickupLocation + '. Standaard PLA ' + h.euro(ps.pricePerGram) + ' per gram, minimaal ' + h.euro(ps.minimumOrder) + ' per opdracht.',
		ogImage: ctx.images[site.homeImages.hero.file].og,
		jsonLd: [{
			'@context': 'https://schema.org',
			'@type': 'Service',
			name: '3D-printservice',
			serviceType: '3D-printen',
			provider: { '@type': 'Organization', name: site.name, url: site.url },
			areaServed: { '@type': 'AdministrativeArea', name: 'Limburg' },
			description: 'Je stuurt een 3D-bestand (' + ps.formats.replace(' en ', ' of ') + ') en het wordt geprint in ' + site.pickupLocation + '.',
			offers: {
				'@type': 'Offer',
				priceCurrency: 'EUR',
				priceSpecification: {
					'@type': 'UnitPriceSpecification',
					price: ps.pricePerGram.toFixed(2),
					priceCurrency: 'EUR',
					unitText: 'gram',
					minPrice: ps.minimumOrder.toFixed(2)
				}
			}
		}, {
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: vragen.map(function (item) {
				return { '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } };
			})
		}],
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
			+ '\t<p class="cta-row"><a class="btn primary" href="/webshop.html">Naar de webshop</a> <a class="btn outline" href="/">Naar de homepage</a></p>\n'
			+ '\t<ul class="chips">\n\t\t' + links + '\n\t</ul>\n'
			+ '</div>'
	};
}

// Pagina's die je alleen via een link in een mail bereikt: de bevestiging van de nieuwsbrief en de knop "Ik heb
// gereageerd" in Jelgers mail. De code staat in het adres achter # (komt dus niet in serverlogs of statistieken);
// src/js/bevestig.js stuurt hem naar de Supabase-functie en vult de tekst in.
function confirmPage(ctx, opts) {
	const site = ctx.site;
	return {
		path: opts.path,
		root: '',
		name: 'confirm',
		noindex: true,
		title: opts.title + ' | ' + site.name,
		description: opts.description,
		ogImage: ctx.images[site.defaultOgImage].og,
		main: '<div class="container checkout-page thanks-page confirm-page" data-bevestig="' + opts.action + '">\n'
			+ '\t<div class="success-icon" aria-hidden="true" data-bevestig-icoon hidden>✓</div>\n'
			+ '\t<h1 data-bevestig-titel>' + h.esc(opts.busy) + '</h1>\n'
			+ '\t<p class="thanks-intro" data-bevestig-tekst aria-live="polite"></p>\n'
			+ '\t<noscript><p class="thanks-intro">Zet JavaScript aan om dit af te ronden.</p></noscript>\n'
			+ '\t<p class="thanks-actions" data-bevestig-acties hidden>' + opts.actions + '</p>\n'
			+ '</div>'
	};
}

// jelgers3d.nl/nieuwsbrief: aanmeldpagina om te delen op social media. Met de code uit de bevestigingsmail
// (#t=...) is dezelfde pagina de bevestiging; src/js/bevestig.js verbergt dan het aanmeldgedeelte.
// De foto's komen uit data/site.json > newsletterPage.products.
function newsletterPage(ctx) {
	const site = ctx.site;
	const ids = (site.newsletterPage && site.newsletterPage.products) || [];
	const tegels = ids.filter(function (id) { return ctx.byId[id]; }).map(function (id) {
		const p = ctx.byId[id];
		return '\t\t\t<a class="newsletter-tile" href="' + h.productUrl(p, '') + '">'
			+ h.img(ctx.images, p.images[0].file, { alt: p.images[0].alt || p.name, sizes: '(max-width: 760px) 45vw, 240px', crop: true })
			+ '<span>' + h.esc(p.name) + '</span></a>';
	}).join('\n');
	const voordelen = [
		'Als eerste weten wanneer er een nieuw ontwerp is',
		'Speciale acties en deals in je mailbox',
		'Geen spam: alleen een mail als er echt iets te melden is',
		'Afmelden kan altijd, met één klik'
	];
	return {
		path: 'nieuwsbrief.html',
		root: '',
		name: 'confirm', // geen tweede aanmeldveld in de footer
		title: 'Nieuwsbrief | ' + site.name,
		ogTitle: 'Meld je aan voor de nieuwsbrief van ' + site.name,
		description: 'Hoor als eerste over nieuwe 3D-geprinte ontwerpen en speciale acties van ' + site.name + '. Afmelden kan altijd, met één klik.',
		ogImage: ctx.images[site.defaultOgImage].og,
		main: '<div class="container newsletter-page" data-bevestig="bevestig" data-bezig="Je aanmelding wordt bevestigd...">\n'
			+ '\t<div class="newsletter-hero">\n'
			+ '\t\t<div class="newsletter-hero-text">\n'
			+ '\t\t\t<p class="kicker" data-aanmelden>Nieuwsbrief</p>\n'
			+ '\t\t\t<div class="success-icon" aria-hidden="true" data-bevestig-icoon hidden>✓</div>\n'
			+ '\t\t\t<h1 data-bevestig-titel>Mis nooit meer een <span class="highlight">nieuw ontwerp</span></h1>\n'
			+ '\t\t\t<p class="newsletter-confirm-text" data-bevestig-tekst aria-live="polite" hidden></p>\n'
			+ '\t\t\t<p class="newsletter-intro" data-aanmelden>Meld je aan en hoor als eerste wanneer er iets nieuws uit mijn printers komt, en over speciale acties. Handgemaakt in Limburg, recht in je mailbox.</p>\n'
			+ '\t\t\t<ul class="feature-list" data-aanmelden>\n' + voordelen.map(function (v) { return '\t\t\t\t<li>' + h.esc(v) + '</li>'; }).join('\n') + '\n\t\t\t</ul>\n'
			+ '\t\t\t<div class="newsletter-page-form" data-aanmelden>' + h.nieuwsbriefForm('pagina', '') + '</div>\n'
			+ '\t\t\t<noscript><p>Zet JavaScript aan om je aan te melden.</p></noscript>\n'
			+ '\t\t\t<p class="thanks-actions newsletter-confirm-actions" data-bevestig-acties hidden><a class="btn btn-primary" href="webshop.html">Bekijk de webshop</a></p>\n'
			+ '\t\t\t<p class="newsletter-more" data-aanmelden><a href="webshop.html">Liever meteen rondkijken? Bekijk de webshop <span aria-hidden="true">→</span></a></p>\n'
			+ '\t\t</div>\n'
			+ '\t\t<div class="newsletter-tiles">\n' + tegels + '\n\t\t</div>\n'
			+ '\t</div>\n'
			+ '</div>'
	};
}

function repliedPage(ctx) {
	return confirmPage(ctx, {
		path: 'gereageerd.html', action: 'gereageerd', title: 'Gereageerd', busy: 'Even geduld...',
		description: 'Voor de eigenaar van ' + ctx.site.name + ': een bestelling of aanvraag als gereageerd markeren.',
		actions: '<a class="btn btn-primary" data-bevestig-dashboard href="https://supabase.com/dashboard" target="_blank" rel="noopener">Open in Supabase</a>'
	});
}

module.exports = {
	privacyPage: privacyPage, termsPage: termsPage, notFoundPage: notFoundPage, printServicePage: printServicePage,
	newsletterPage: newsletterPage, repliedPage: repliedPage
};
