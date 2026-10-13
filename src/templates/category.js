// Categoriepagina's (vazen.html, lampen.html, ...). Anders dan de filterlinks van de webshop hebben deze
// een eigen URL met eigen tekst, titel en omschrijving, zodat Google ze als aparte pagina kan tonen.
// Welke pagina's er zijn bepaal je in data/site.json > categoryPages.
const h = require('./helpers');
const c = require('./components');

function highlight(text) {
	return h.esc(text).replace(/\*(.+?)\*/g, '<span class="highlight">$1</span>');
}

// Lopende tekst uit site.json: **vet** blijft leesbaar in het bestand en wordt hier <strong>
function rich(text) {
	return h.esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// Vergelijkingstabel (site.json > categoryPages > compare): maat en prijs per model, uit products.json
// zodat hij vanzelf klopt als er een product of prijs verandert.
function compareTable(page, products) {
	const rows = products.map(function (p) {
		const labels = (p.variants || []).map(function (v) { return v.label; }).filter(Boolean);
		const size = (p.specs || []).find(function (s) { return /^(hoogte|formaat|formaten)$/i.test(s.label); });
		const maat = labels.length > 1 ? labels.join(' of ') : (size ? size.value : 'Eén uitvoering');
		return '\t\t\t\t<tr><th scope="row"><a href="' + h.productUrl(p) + '">' + h.esc(p.name) + '</a></th>'
			+ '<td>' + h.esc(maat) + '</td><td>' + h.priceLabel(p) + '</td></tr>';
	}).join('\n');
	return '\t<section class="category-text" aria-labelledby="vergelijk">\n'
		+ '\t\t<h2 id="vergelijk">' + h.esc(page.label) + ' vergelijken</h2>\n'
		+ '\t\t<div class="table-scroll">\n\t\t\t<table class="text-table">\n'
		+ '\t\t\t\t<thead><tr><th scope="col">Model</th><th scope="col">Maat of uitvoering</th><th scope="col">Prijs</th></tr></thead>\n'
		+ '\t\t\t\t<tbody>\n' + rows + '\n\t\t\t\t</tbody>\n'
		+ '\t\t\t</table>\n\t\t</div>\n'
		+ '\t</section>\n';
}

// Tekstblokken onder de producten: koppen met alinea's, een opsomming en/of genummerde stappen
function sections(page) {
	return (page.sections || []).map(function (s, i) {
		const id = 'sectie-' + (i + 1);
		return '\t<section class="category-text" aria-labelledby="' + id + '">\n'
			+ '\t\t<h2 id="' + id + '">' + h.esc(s.heading) + '</h2>\n'
			+ (s.text || []).map(function (p) { return '\t\t<p>' + rich(p) + '</p>\n'; }).join('')
			+ (s.list ? '\t\t<ul class="category-list">\n' + s.list.map(function (item) { return '\t\t\t<li>' + rich(item) + '</li>\n'; }).join('') + '\t\t</ul>\n' : '')
			+ (s.steps ? '\t\t<ol class="category-steps">\n' + s.steps.map(function (item) { return '\t\t\t<li>' + rich(item) + '</li>\n'; }).join('') + '\t\t</ol>\n' : '')
			+ (s.after || []).map(function (p) { return '\t\t<p>' + rich(p) + '</p>\n'; }).join('')
			+ '\t</section>\n';
	}).join('');
}

function faqSection(page) {
	if (!(page.faq || []).length) return '';
	return '\t<section class="category-text category-faq" aria-labelledby="veelgestelde-vragen">\n'
		+ '\t\t<h2 id="veelgestelde-vragen">Veelgestelde vragen</h2>\n'
		+ '\t\t<div class="faq">\n'
		+ page.faq.map(function (item) {
			return '\t\t\t<details class="faq-item"><summary>' + h.esc(item.q) + '</summary><p>' + h.esc(item.a) + '</p></details>\n';
		}).join('')
		+ '\t\t</div>\n\t</section>\n';
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
		{ label: 'Home', path: '', url: './' },
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
		+ (page.compare ? compareTable(page, products) : '')
		+ sections(page)
		+ faqSection(page)
		+ '\t<nav class="category-more" aria-label="Meer categorieën">\n'
		+ '\t\t<p>Verder kijken</p>\n'
		+ '\t\t<ul class="chips">\n'
		+ others.map(function (other) { return '\t\t\t<li><a class="chip-link" href="' + other.slug + '.html">' + h.esc(other.label) + '</a></li>'; }).join('\n') + '\n'
		+ '\t\t\t<li><a class="chip-link" href="webshop.html">Alle producten</a></li>\n'
		+ '\t\t\t<li><a class="chip-link" href="producten/custom-lightbox.html">Op maat</a></li>\n'
		+ '\t\t</ul>\n'
		+ '\t</nav>\n'
		+ '</div>';

	const ld = [
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
	];
	if ((page.faq || []).length) {
		ld.push({
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: page.faq.map(function (item) {
				return { '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } };
			})
		});
	}

	return {
		path: path,
		root: '',
		name: 'category',
		title: page.seoTitle + ' | ' + site.name,
		ogTitle: page.seoTitle,
		description: page.seoDescription,
		ogImage: ctx.images[products[0].images[0].file].og,
		jsonLd: ld,
		main: main
	};
}

module.exports = { categoryPage: categoryPage, productsFor: productsFor };
