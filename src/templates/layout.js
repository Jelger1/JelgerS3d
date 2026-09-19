// Het HTML-skelet van elke pagina: <head> met SEO-tags, header, footer, winkelwagen.
const h = require('./helpers');

const FONTS = ['space-grotesk-latin.woff2', 'syne-latin.woff2'];

// page: { path, root, name, title, description, ogImage, ogType, jsonLd[], preload, main, noindex }
function layout(page, ctx) {
	const site = ctx.site;
	const root = page.root || '';
	const canonical = site.url + '/' + (page.path === 'index.html' ? '' : page.path);
	const ogImage = site.url + '/assets/og/' + page.ogImage;
	const v = '?v=' + ctx.version;

	let header = h.fill(ctx.partials.header, {
		root: root,
		currentShop: page.name === 'shop' ? ' aria-current="page"' : ''
	});
	// Op de homepage zelf scrollen de ankerlinks binnen de pagina
	if (page.name === 'home') header = header.replace(/href="index\.html#/g, 'href="#');

	const footer = h.fill(ctx.partials.footer, {
		root: root,
		year: String(ctx.year),
		name: h.esc(site.name),
		email: h.esc(site.email),
		addressLine: h.addressLine(site),
		kvk: h.esc(site.kvk),
		btw: h.esc(site.btw),
		instagram: h.esc(site.instagram),
		categoryLinks: (site.categoryPages || []).map(function (cat) {
			return '<a href="' + root + cat.slug + '.html">' + h.esc(cat.label) + '</a>';
		}).join('\n\t\t\t'),
		usps: site.usps.map(function (usp) {
			return '<li><span class="check" aria-hidden="true">✓</span> ' + h.esc(usp) + '</li>';
		}).join('\n\t\t\t')
	});

	const cart = h.fill(ctx.partials.cart, {
		root: root,
		shippingNote: h.esc(site.shipping.note)
	});

	// Alleen als er ID's zijn ingevuld komen ze in de pagina; consent.js doet de rest
	const analytics = site.analytics || {};
	const analyticsAttrs = (analytics.ga4 ? ' data-ga4="' + h.esc(analytics.ga4) + '"' : '')
		+ (analytics.googleAds ? ' data-ads="' + h.esc(analytics.googleAds) + '"' : '')
		+ (analytics.adsConversionLabel ? ' data-ads-label="' + h.esc(analytics.adsConversionLabel) + '"' : '');

	const preload = page.preload
		? '\t<link rel="preload" as="image" imagesrcset="' + h.esc(page.preload.srcset) + '" imagesizes="' + h.esc(page.preload.sizes) + '" fetchpriority="high">\n'
		: '';

	return '<!doctype html>\n'
		+ '<!-- GEGENEREERD BESTAND: pas dit niet handmatig aan. Bewerk data/ of src/ en draai "npm run build". -->\n'
		+ '<html lang="nl"' + analyticsAttrs + '>\n<head>\n'
		+ '\t<meta charset="utf-8">\n'
		+ '\t<meta name="viewport" content="width=device-width, initial-scale=1">\n'
		+ '\t<title>' + h.esc(page.title) + '</title>\n'
		+ '\t<meta name="description" content="' + h.esc(page.description) + '">\n'
		+ '\t<meta name="robots" content="' + (page.noindex ? 'noindex, follow' : 'index, follow, max-snippet:-1, max-image-preview:large') + '">\n'
		+ '\t<link rel="canonical" href="' + h.esc(canonical) + '">\n'
		+ '\t<meta name="theme-color" content="#12151c">\n'
		+ '\t<meta property="og:type" content="' + (page.ogType || 'website') + '">\n'
		+ '\t<meta property="og:url" content="' + h.esc(canonical) + '">\n'
		+ '\t<meta property="og:title" content="' + h.esc(page.ogTitle || page.title) + '">\n'
		+ '\t<meta property="og:description" content="' + h.esc(page.description) + '">\n'
		+ '\t<meta property="og:image" content="' + h.esc(ogImage) + '">\n'
		+ '\t<meta property="og:image:width" content="1200">\n'
		+ '\t<meta property="og:image:height" content="630">\n'
		+ '\t<meta property="og:site_name" content="' + h.esc(site.name) + '">\n'
		+ '\t<meta property="og:locale" content="nl_NL">\n'
		+ '\t<meta name="twitter:card" content="summary_large_image">\n'
		+ '\t<link rel="icon" type="image/svg+xml" href="' + root + 'assets/js-3D-LOGO.svg">\n'
		+ FONTS.map(function (font) { return '\t<link rel="preload" as="font" type="font/woff2" href="' + root + 'assets/fonts/' + font + '" crossorigin>\n'; }).join('')
		+ '\t<link rel="stylesheet" href="' + root + 'css/styles.css' + v + '">\n'
		+ preload
		+ (page.jsonLd || []).map(function (data) { return '\t' + h.jsonLd(data) + '\n'; }).join('')
		+ '\t<script type="module" src="' + root + 'js/main.js' + v + '"></script>\n'
		+ '</head>\n'
		+ '<body data-page="' + page.name + '" data-root="' + root + '">\n'
		+ header + '\n'
		+ '<main id="main">\n' + page.main + '\n</main>\n'
		+ footer + '\n'
		+ cart + '\n'
		+ '</body>\n</html>\n';
}

module.exports = layout;
