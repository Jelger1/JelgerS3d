// Categoriepagina's (vazen.html, lampen.html, ...). Anders dan de filterlinks van de webshop hebben deze
// een eigen URL met eigen tekst, titel en omschrijving, zodat Google ze als aparte pagina kan tonen.
// Welke pagina's er zijn bepaal je in data/site.json > categoryPages.
const h = require('./helpers');
const c = require('./components');

function highlight(text) {
	return h.esc(text).replace(/\*(.+?)\*/g, '<span class="highlight">$1</span>');
}

function productsFor(page, products) {
	return products.filter(function (p) {
		return (!page.filter.type || p.type === page.filter.type)
			&& (!page.filter.collection || p.collection === page.filter.collection);
	});
}

function categoryPage(page, ctx) {
	const site = ctx.site;
	const products = productsFor(page, ctx.products);
	const path = page.slug + '.html';
	const crumbs = [
		{ label: 'Home', path: '', url: 'index.html' },
		{ label: 'Webshop', path: 'webshop.html', url: 'webshop.html' },
		{ label: page.label, path: path }
	];
	const others = site.categoryPages.filter(function (other) { return other.slug !== page.slug; });

	const main = '<div class="container">\n'
		+ '\t' + c.breadcrumbs(crumbs) + '\n'
		+ '\t<header class="page-header category-header">\n'
		+ '\t\t<h1>' + highlight(page.heading) + '</h1>\n'
		+ '\t\t<p class="page-description">' + h.esc(page.intro) + '</p>\n'
		+ '\t</header>\n'
		+ '\t<section aria-label="' + h.esc(page.label) + '">\n'
		+ '\t\t<div class="grid grid-products products">\n'
		+ products.map(function (p, i) { return c.productCard(p, ctx, { eager: i < 4, heading: 'h2' }); }).join('\n') + '\n'
		+ '\t\t</div>\n'
		+ '\t</section>\n'
		+ '\t<nav class="category-more" aria-label="Meer categorieën">\n'
		+ '\t\t<p>Verder kijken</p>\n'
		+ '\t\t<ul class="chips">\n'
		+ others.map(function (other) { return '\t\t\t<li><a class="chip-link" href="' + other.slug + '.html">' + h.esc(other.label) + '</a></li>'; }).join('\n') + '\n'
		+ '\t\t\t<li><a class="chip-link" href="webshop.html">Alle producten</a></li>\n'
		+ '\t\t\t<li><a class="chip-link" href="producten/custom-lightbox.html">Op maat</a></li>\n'
		+ '\t\t</ul>\n'
		+ '\t</nav>\n'
		+ '</div>';

	return {
		path: path,
		root: '',
		name: 'category',
		title: page.seoTitle + ' | ' + site.name,
		ogTitle: page.seoTitle,
		description: page.seoDescription,
		ogImage: ctx.images[products[0].images[0].file].og,
		jsonLd: [
			c.breadcrumbsLd(crumbs, site),
			{
				'@context': 'https://schema.org',
				'@type': 'CollectionPage',
				name: page.seoTitle,
				description: page.seoDescription,
				url: site.url + '/' + path,
				mainEntity: {
					'@type': 'ItemList',
					itemListElement: products.map(function (p, i) {
						return { '@type': 'ListItem', position: i + 1, url: site.url + '/' + h.productUrl(p), name: p.name };
					})
				}
			}
		],
		main: main
	};
}

module.exports = { categoryPage: categoryPage, productsFor: productsFor };
