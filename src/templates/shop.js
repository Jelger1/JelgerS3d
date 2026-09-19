// De winkelpagina (webshop.html): alle producten uit data/products.json.
const h = require('./helpers');
const c = require('./components');

function shopPage(ctx) {
	const site = ctx.site;
	const products = ctx.products;
	const prices = products.map(h.minPrice).filter(function (p) { return p != null; });

	const cards = products.map(function (product, i) {
		// De eerste rij staat boven de vouw en laadt dus direct
		return c.productCard(product, ctx, { eager: i < 3 });
	}).join('\n');

	const main = '<div class="container">\n'
		+ '\t<header class="page-header">\n'
		+ '\t\t<h1>Vind jouw <span class="highlight">unieke stuk</span></h1>\n'
		+ '\t\t<p class="page-subtitle">Handgemaakt in Limburg, met liefde voor detail</p>\n'
		+ '\t\t<p class="page-description">Elk ontwerp vertelt een verhaal. Of je nu zoekt naar een statement voor je interieur, een cadeau met <span class="highlight">betekenis</span> of een stukje Limburgse trots, hier vind je het.</p>\n'
		+ '\t</header>\n'
		+ '\t<section aria-label="Producten">\n'
		+ '\t\t<div class="grid grid-products products" id="product-grid">\n' + cards + '\n\t\t</div>\n'
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
