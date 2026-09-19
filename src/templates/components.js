// Herbruikbare bouwstenen: productkaart, reviews, broodkruimels.
const h = require('./helpers');

const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

const CARD_SIZES = '(max-width: 600px) 90vw, (max-width: 900px) 45vw, 320px';

function kicker(product, ctx) {
	const type = ctx.site.types[product.type];
	const collection = ctx.site.collections[product.collection];
	return h.esc(type.singular) + ' · ' + h.esc(collection.label);
}

// De actie onderaan een kaart hangt af van hoe het product verkocht wordt
function cardAction(product, root) {
	const url = h.productUrl(product, root);
	if (product.sale === 'cart' && product.variants.length === 1) {
		return '<button class="btn btn-add-cart" type="button" data-add="' + h.esc(product.id) + '" data-variant="' + h.esc(product.variants[0].id) + '">In winkelwagen</button>';
	}
	if (product.sale === 'cart') return '<a class="btn btn-add-cart" href="' + url + '">Kies je optie</a>';
	if (product.sale === 'external') return '<a class="btn outline" href="' + h.esc(product.externalUrl) + '" target="_blank" rel="noopener">' + h.esc(product.externalLabel) + '</a>';
	if (product.sale === 'request') return '<a class="btn btn-add-cart" href="' + url + '">Vraag aan</a>';
	return '<a class="btn outline" href="' + url + '">Bekijk</a>';
}

function productCard(product, ctx, opts) {
	opts = opts || {};
	const root = opts.root || '';
	const url = h.productUrl(product, root);
	const first = product.images[0];
	const second = product.images[1];
	const price = h.priceHtml(product);
	// Koppen moeten netjes aflopen: direct onder de h1 van een pagina is een kaart een h2, binnen een sectie een h3
	const heading = opts.heading || 'h3';

	// Kaarten tonen de productuitsnede: vast 4:5-kader met het product in het midden
	let media = h.img(ctx.images, first.file, { alt: first.alt, sizes: opts.sizes || CARD_SIZES, root: root, eager: opts.eager, crop: true });
	// Tweede foto vloeit in bij hover (alleen op apparaten met een muis)
	if (second) {
		media += h.img(ctx.images, second.file, { alt: '', sizes: opts.sizes || CARD_SIZES, root: root, className: 'product-thumb-alt', crop: true });
	}

	return '<article class="product-card' + (opts.className ? ' ' + opts.className : '') + '"'
		+ ' data-id="' + h.esc(product.id) + '" data-type="' + h.esc(product.type) + '" data-collection="' + h.esc(product.collection) + '"'
		+ ' data-name="' + h.esc(product.name) + '"'
		+ (product.material ? ' data-material="' + h.esc(product.material) + '"' : '')
		+ (h.minPrice(product) != null ? ' data-price="' + h.minPrice(product) + '"' : '')
		// Alleen op de webshop: de volgorde voor "Aanbevolen"
		+ (opts.index != null ? ' data-index="' + opts.index + '"' : '') + '>\n'
		+ '\t<a class="product-thumb" href="' + url + '" tabindex="-1" aria-hidden="true">' + media
		+ (product.sale === 'soon' ? '<span class="badge badge-promo">Binnenkort</span>' : (product.badge ? '<span class="badge badge-promo">' + h.esc(product.badge) + '</span>' : ''))
		+ '</a>\n'
		+ '\t<div class="product-info">\n'
		+ '\t\t<p class="product-kicker">' + kicker(product, ctx) + '</p>\n'
		+ '\t\t<' + heading + ' class="product-title"><a href="' + url + '">' + h.esc(product.name) + '</a></' + heading + '>\n'
		+ '\t\t<p class="muted">' + h.esc(product.tagline) + '</p>\n'
		+ '\t\t<div class="product-card-foot">\n'
		+ '\t\t\t' + (price ? '<p class="product-price">' + price + '</p>' : '<p class="product-price product-price-muted">Binnenkort</p>') + '\n'
		+ '\t\t\t' + cardAction(product, root) + '\n'
		+ '\t\t</div>\n'
		+ '\t</div>\n'
		+ '</article>';
}

function stars(rating) {
	let out = '<div class="review-stars" role="img" aria-label="' + rating + ' van 5 sterren">';
	for (let i = 1; i <= 5; i++) {
		out += '<svg class="' + (i <= rating ? 'star' : 'star-empty') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR_PATH + '"/></svg>';
	}
	return out + '</div>';
}

function reviewCard(review) {
	return '<li class="review-card">\n'
		+ '\t' + stars(review.rating) + '\n'
		+ '\t<blockquote class="review-text">“' + h.esc(review.text) + '”</blockquote>\n'
		+ '\t<p class="review-meta"><span class="review-author">' + h.esc(review.author) + '</span> <span class="review-product">' + h.esc(review.productLabel) + '</span></p>\n'
		+ '</li>';
}

function reviewsSection(reviews, heading) {
	if (!reviews.length) return '';
	return '<section class="reviews-banner" aria-labelledby="reviews-heading">\n'
		+ '\t<h2 id="reviews-heading" class="reviews-heading">' + h.esc(heading) + '</h2>\n'
		+ '\t<ul class="reviews-track" tabindex="0" aria-label="Klantreviews, horizontaal te scrollen">\n'
		+ reviews.map(reviewCard).join('\n') + '\n'
		+ '\t</ul>\n'
		+ '</section>';
}

// Horizontale rail met scroll-snap en vorige/volgende-knoppen
function productRail(products, ctx, opts) {
	opts = opts || {};
	return '<div class="rail" data-rail>\n'
		+ '\t<button class="rail-btn rail-btn-prev" type="button" aria-label="Vorige producten" data-rail-prev>‹</button>\n'
		+ '\t<div class="rail-track" data-rail-track>\n'
		+ products.map(function (p) { return productCard(p, ctx, { root: opts.root, className: 'rail-card', sizes: '300px' }); }).join('\n') + '\n'
		+ '\t</div>\n'
		+ '\t<button class="rail-btn rail-btn-next" type="button" aria-label="Volgende producten" data-rail-next>›</button>\n'
		+ '</div>';
}

// items: [{ label, url }] - het laatste item is de huidige pagina
function breadcrumbs(items) {
	return '<nav class="breadcrumbs" aria-label="Kruimelpad"><ol>'
		+ items.map(function (item, i) {
			const last = i === items.length - 1;
			return '<li>' + (last
				? '<span aria-current="page">' + h.esc(item.label) + '</span>'
				: '<a href="' + item.url + '">' + h.esc(item.label) + '</a>') + '</li>';
		}).join('')
		+ '</ol></nav>';
}

function breadcrumbsLd(items, site) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map(function (item, i) {
			return { '@type': 'ListItem', position: i + 1, name: item.label, item: site.url + '/' + item.path };
		})
	};
}

module.exports = {
	productCard: productCard, productRail: productRail, reviewsSection: reviewsSection,
	breadcrumbs: breadcrumbs, breadcrumbsLd: breadcrumbsLd, kicker: kicker, stars: stars, reviewCard: reviewCard
};
