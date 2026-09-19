// De winkelpagina (webshop.html): alle producten uit data/products.json, met filters.
// Het filteren zelf gebeurt in de browser (src/js/shop.js); de keuzes staan in de URL,
// bv. webshop.html?type=vaas, zodat elke gefilterde weergave een eigen link heeft (handig voor advertenties).
const h = require('./helpers');
const c = require('./components');

// "3D-geprinte *designvazen*" -> het deel tussen sterretjes krijgt de accentkleur
function highlight(text) {
	return h.esc(text).replace(/\*(.+?)\*/g, '<span class="highlight">$1</span>');
}

function chip(group, value, label, count, attrs) {
	return '<label class="chip"><input type="checkbox" name="' + group + '" value="' + h.esc(value) + '"' + (attrs || '') + '>'
		+ '<span>' + h.esc(label) + ' <small data-facet-count>' + count + '</small></span></label>';
}

function filterGroup(group, legend, chips) {
	if (!chips.length) return '';
	return '\t\t<fieldset class="filter-group" data-group="' + group + '">\n'
		+ '\t\t\t<legend>' + h.esc(legend) + '</legend>\n'
		+ '\t\t\t<div class="chips">' + chips.join('') + '</div>\n'
		+ '\t\t</fieldset>\n';
}

function inBucket(price, bucket) {
	return price != null && (bucket.min == null || price >= bucket.min) && (bucket.max == null || price < bucket.max);
}

function filters(ctx) {
	const site = ctx.site;
	const products = ctx.products;
	function countBy(fn) { return products.filter(fn).length; }

	const types = Object.keys(site.types).map(function (key) {
		const n = countBy(function (p) { return p.type === key; });
		return n ? chip('type', key, site.types[key].label, n, ' data-heading="' + h.esc(highlight(site.types[key].heading || site.types[key].label)) + '" data-title="' + h.esc(site.types[key].label) + '"') : '';
	}).filter(Boolean);

	const collections = Object.keys(site.collections).map(function (key) {
		const n = countBy(function (p) { return p.collection === key; });
		return n ? chip('collectie', key, site.collections[key].label, n) : '';
	}).filter(Boolean);

	// Materiaal verschijnt vanzelf als filter zodra het bij producten is ingevuld
	const materials = Array.from(new Set(products.map(function (p) { return p.material; }).filter(Boolean))).sort().map(function (m) {
		return chip('materiaal', m, m, countBy(function (p) { return p.material === m; }));
	});

	const prices = site.priceBuckets.map(function (bucket) {
		const n = countBy(function (p) { return inBucket(h.minPrice(p), bucket); });
		return n ? chip('prijs', bucket.id, bucket.label, n, (bucket.min != null ? ' data-min="' + bucket.min + '"' : '') + (bucket.max != null ? ' data-max="' + bucket.max + '"' : '')) : '';
	}).filter(Boolean);

	return '<form class="shop-filters" id="shop-filters" aria-label="Producten filteren">\n'
		+ '\t\t<div class="shop-filters-head">\n'
		+ '\t\t\t<h2>Filters</h2>\n'
		+ '\t\t\t<button type="button" class="cart-close" data-filter-close aria-label="Filters sluiten">✕</button>\n'
		+ '\t\t</div>\n'
		+ '\t\t<div class="shop-filters-body">\n'
		+ filterGroup('type', 'Type', types)
		+ filterGroup('collectie', 'Collectie', collections)
		+ filterGroup('materiaal', 'Materiaal', materials)
		+ filterGroup('prijs', 'Prijs', prices)
		+ '\t\t</div>\n'
		+ '\t\t<div class="shop-filters-foot">\n'
		+ '\t\t\t<button type="button" class="btn outline" data-filter-reset>Wis filters</button>\n'
		+ '\t\t\t<button type="button" class="btn btn-primary" data-filter-close>Toon <span data-count>' + products.length + '</span> producten</button>\n'
		+ '\t\t</div>\n'
		+ '\t</form>';
}

function shopPage(ctx) {
	const site = ctx.site;
	const products = ctx.products;
	const prices = products.map(h.minPrice).filter(function (p) { return p != null; });

	const cards = products.map(function (product, i) {
		// De eerste rij staat boven de vouw en laadt dus direct
		return c.productCard(product, ctx, { eager: i < 4, index: i });
	}).join('\n');

	const main = '<div class="container">\n'
		+ '\t<header class="page-header">\n'
		+ '\t\t<h1 data-shop-heading>Vind jouw <span class="highlight">unieke stuk</span></h1>\n'
		+ '\t\t<p class="page-subtitle">Handgemaakt in Limburg, met liefde voor detail</p>\n'
		+ '\t\t<p class="page-description">Elk ontwerp vertelt een verhaal. Of je nu zoekt naar een statement voor je interieur, een cadeau met <span class="highlight">betekenis</span> of een stukje Limburgse trots, hier vind je het.</p>\n'
		+ '\t</header>\n'
		+ '\t<section class="shop" aria-label="Producten">\n'
		+ '\t' + filters(ctx) + '\n'
		+ '\t\t<div class="shop-filters-backdrop" data-filter-close></div>\n'
		+ '\t\t<div class="shop-toolbar">\n'
		+ '\t\t\t<button type="button" class="btn outline shop-filter-toggle" data-filter-open aria-controls="shop-filters" aria-expanded="false">\n'
		+ '\t\t\t\t<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="17" x2="14" y2="17"/></svg>\n'
		+ '\t\t\t\tFilters <span class="shop-filter-badge" data-filter-badge hidden></span>\n'
		+ '\t\t\t</button>\n'
		+ '\t\t\t<p class="shop-count" role="status"><strong data-count>' + products.length + '</strong> <span data-count-label>producten</span></p>\n'
		+ '\t\t\t<label class="shop-sort">Sorteer op\n'
		+ '\t\t\t\t<select data-sort>\n'
		+ '\t\t\t\t\t<option value="">Aanbevolen</option>\n'
		+ '\t\t\t\t\t<option value="prijs-oplopend">Prijs: laag naar hoog</option>\n'
		+ '\t\t\t\t\t<option value="prijs-aflopend">Prijs: hoog naar laag</option>\n'
		+ '\t\t\t\t\t<option value="naam">Naam A-Z</option>\n'
		+ '\t\t\t\t</select>\n'
		+ '\t\t\t</label>\n'
		+ '\t\t</div>\n'
		+ '\t\t<div class="shop-active" data-active hidden></div>\n'
		+ '\t\t<div class="grid grid-products products" id="product-grid">\n' + cards + '\n\t\t</div>\n'
		+ '\t\t<div class="shop-empty" data-empty hidden>\n'
		+ '\t\t\t<p><strong>Geen producten gevonden</strong></p>\n'
		+ '\t\t\t<p>Met deze combinatie van filters is er niets. Probeer een filter minder.</p>\n'
		+ '\t\t\t<button type="button" class="btn btn-primary" data-filter-reset>Wis alle filters</button>\n'
		+ '\t\t</div>\n'
		+ '\t</section>\n'
		+ '</div>\n'
		+ c.reviewsSection(ctx.reviews, 'Wat klanten zeggen');

	const crumbs = [{ label: 'Home', path: '' }, { label: 'Webshop', path: 'webshop.html' }];

	return {
		path: 'webshop.html',
		root: '',
		name: 'shop',
		title: 'Webshop – 3D-geprinte vazen, lampen & Limburgse cadeaus | ' + site.name,
		description: 'Shop unieke 3D-geprinte designvazen, lampen en Limburgse cadeaus van ' + site.owner + '. Eigen ontwerp, speciaal voor jou geprint in Limburg. Vanaf ' + h.euro(Math.min.apply(null, prices)) + '.',
		ogImage: ctx.images[site.defaultOgImage].og,
		jsonLd: [
			c.breadcrumbsLd(crumbs, site),
			{
				'@context': 'https://schema.org',
				'@type': 'ItemList',
				name: site.name + ' webshop',
				itemListElement: products.map(function (product, i) {
					return { '@type': 'ListItem', position: i + 1, url: site.url + '/' + h.productUrl(product), name: product.name };
				})
			}
		],
		main: main
	};
}

module.exports = shopPage;
