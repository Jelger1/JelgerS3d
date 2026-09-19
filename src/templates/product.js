// De productpagina (producten/<id>.html). Eén template voor alle producten.
const h = require('./helpers');
const c = require('./components');

const GALLERY_SIZES = '(max-width: 900px) 100vw, 580px';

function gallery(product, ctx, root) {
	const slides = product.images.map(function (image, i) {
		// In het kader staat de uitsnede met het product in het midden; vergroten toont de volledige foto
		const full = h.imgPath(ctx.images, image.file, 1600, root);
		return '<li class="pdp-slide" id="foto-' + (i + 1) + '">'
			+ '<button type="button" class="pdp-zoom" data-zoom="' + i + '" data-full="' + full + '" data-alt="' + h.esc(image.alt) + '" aria-label="Foto ' + (i + 1) + ' vergroten">'
			+ h.img(ctx.images, image.file, { alt: image.alt, sizes: GALLERY_SIZES, root: root, eager: i === 0, crop: true })
			+ '</button></li>';
	}).join('\n\t\t\t');

	let thumbs = '';
	if (product.images.length > 1) {
		thumbs = '\t\t<ul class="pdp-thumbs" aria-label="Kies een foto">\n'
			+ product.images.map(function (image, i) {
				return '\t\t\t<li><button type="button" class="pdp-thumb' + (i === 0 ? ' is-active' : '') + '" data-slide="' + i + '" aria-label="Toon foto ' + (i + 1) + '"' + (i === 0 ? ' aria-current="true"' : '') + '>'
					+ h.img(ctx.images, image.file, { alt: '', sizes: '72px', root: root, crop: true }) + '</button></li>';
			}).join('\n') + '\n\t\t</ul>\n';
	}

	return '<div class="pdp-gallery" data-gallery>\n'
		+ '\t\t<ul class="pdp-slides" data-slides tabindex="0" aria-label="Productfoto\'s van ' + h.esc(product.name) + '">\n\t\t\t' + slides + '\n\t\t</ul>\n'
		+ thumbs
		+ '\t</div>';
}

function buyBox(product, ctx, root) {
	if (product.sale === 'cart') {
		const multiple = product.variants.length > 1;
		const options = multiple
			? '<fieldset class="product-options">\n\t\t\t\t<legend>Kies je uitvoering</legend>\n'
				+ product.variants.map(function (variant, i) {
					return '\t\t\t\t<label class="size-option"><input type="radio" name="variant" value="' + h.esc(variant.id) + '" data-price="' + variant.price + '"' + (i === 0 ? ' checked' : '') + '>'
						+ '<span>' + h.esc(variant.label) + '</span><span class="size-option-price">' + h.euro(variant.price) + '</span></label>';
				}).join('\n') + '\n\t\t\t</fieldset>'
			: '<input type="hidden" name="variant" value="' + h.esc(product.variants[0].id) + '">';

		return '<form class="pdp-form" data-product="' + h.esc(product.id) + '">\n'
			+ '\t\t\t' + options + '\n'
			+ '\t\t\t<button type="submit" class="btn btn-primary btn-block pdp-add">In winkelwagen</button>\n'
			+ '\t\t</form>\n'
			// Eerlijke urgentie: verschijnt alleen in de weken voor een echte feestdag en verdwijnt daarna vanzelf (zie site.json > deadlines)
			+ '\t\t<p class="deadline-note" data-deadlines="' + h.esc(JSON.stringify(ctx.site.deadlines || [])) + '" hidden></p>';
	}
	if (product.sale === 'external') {
		return '<a class="btn btn-primary btn-block" href="' + h.esc(product.externalUrl) + '" target="_blank" rel="noopener">' + h.esc(product.externalLabel) + '</a>\n'
			+ '\t\t<p class="pdp-note">Dit ontwerp is exclusief verkrijgbaar via de webshop van de opdrachtgever.</p>';
	}
	const key = h.esc(ctx.site.web3forms.contactKey);
	const name = h.esc(product.name);

	if (product.sale === 'request') {
		// Maatwerk: aanvraag direct op de productpagina, zonder omweg via het contactformulier
		return '<form class="request-form" data-request="offerte" data-product="' + h.esc(product.id) + '" data-product-name="' + name + '" data-access-key="' + key + '" novalidate>\n'
			+ '\t\t\t<h2 class="request-title">Vraag jouw prijs en ontwerp aan</h2>\n'
			+ '\t\t\t<div class="form-row">\n'
			+ '\t\t\t\t<div class="form-group"><label for="rq-name">Naam <span aria-hidden="true">*</span></label><input type="text" id="rq-name" name="name" required autocomplete="name"></div>\n'
			+ '\t\t\t\t<div class="form-group"><label for="rq-email">E-mailadres <span aria-hidden="true">*</span></label><input type="email" id="rq-email" name="email" required autocomplete="email"></div>\n'
			+ '\t\t\t</div>\n'
			+ '\t\t\t<div class="form-row">\n'
			+ '\t\t\t\t<div class="form-group"><label for="rq-size">Gewenste afmeting</label><input type="text" id="rq-size" name="size" placeholder="Bijv. 20 cm breed"></div>\n'
			+ '\t\t\t\t<div class="form-group form-group-narrow"><label for="rq-qty">Aantal</label><input type="number" id="rq-qty" name="quantity" min="1" value="1" inputmode="numeric"></div>\n'
			+ '\t\t\t</div>\n'
			+ '\t\t\t<div class="form-group"><label for="rq-text">Wat wil je laten maken? <span aria-hidden="true">*</span></label><textarea id="rq-text" name="text" rows="3" required placeholder="Je logo, naam of idee, en waar hij komt te staan"></textarea></div>\n'
			+ '\t\t\t<input type="checkbox" name="botcheck" class="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">\n'
			+ '\t\t\t<p class="checkout-msg" data-request-msg role="alert"></p>\n'
			+ '\t\t\t<button type="submit" class="btn btn-primary btn-block">Verstuur aanvraag</button>\n'
			+ '\t\t\t<p class="pdp-note">Vrijblijvend. Je ontvangt eerst een voorstel met prijs. Je logo of afbeelding (PNG, JPG, PDF, AI of SVG) stuur je daarna per mail na.</p>\n'
			+ '\t\t</form>\n'
			+ '\t\t<div class="request-success" data-request-success hidden tabindex="-1"><strong>Bedankt, je aanvraag is verstuurd!</strong><p>Ik neem zo snel mogelijk contact met je op met een voorstel.</p></div>';
	}
	return '<form class="request-form" data-request="beschikbaarheid" data-product="' + h.esc(product.id) + '" data-product-name="' + name + '" data-access-key="' + key + '" novalidate>\n'
		+ '\t\t\t<h2 class="request-title">Houd mij op de hoogte</h2>\n'
		+ '\t\t\t<div class="form-group"><label for="rq-email">E-mailadres <span aria-hidden="true">*</span></label><input type="email" id="rq-email" name="email" required autocomplete="email" placeholder="je@email.nl"></div>\n'
		+ '\t\t\t<input type="checkbox" name="botcheck" class="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">\n'
		+ '\t\t\t<p class="checkout-msg" data-request-msg role="alert"></p>\n'
		+ '\t\t\t<button type="submit" class="btn btn-primary btn-block">Laat het me weten</button>\n'
		+ '\t\t\t<p class="pdp-note">Dit product is op dit moment niet te bestellen. Je krijgt één bericht zodra hij er weer is, verder niets.</p>\n'
		+ '\t\t</form>\n'
		+ '\t\t<div class="request-success" data-request-success hidden tabindex="-1"><strong>Genoteerd!</strong><p>Je hoort van mij zodra de ' + name + ' weer beschikbaar is.</p></div>';
}

function productLd(product, ctx) {
	const site = ctx.site;
	const url = site.url + '/' + h.productUrl(product);
	const data = {
		'@context': 'https://schema.org',
		'@type': 'Product',
		name: product.name,
		description: product.seo.description,
		sku: product.id,
		url: url,
		image: product.images.map(function (image) { return site.url + '/' + h.imgPath(ctx.images, image.file, 1600); }),
		brand: { '@type': 'Brand', name: site.name },
		category: site.types[product.type].label
	};
	if (product.material) data.material = product.material;

	function offer(variant) {
		return {
			'@type': 'Offer',
			name: variant.label || product.name,
			price: variant.price.toFixed(2),
			priceCurrency: 'EUR',
			availability: 'https://schema.org/InStock',
			itemCondition: 'https://schema.org/NewCondition',
			url: url,
			seller: { '@type': 'Organization', name: site.name }
		};
	}

	if (product.sale === 'cart' && product.variants.length === 1) {
		data.offers = offer(product.variants[0]);
	} else if (product.sale === 'cart') {
		const prices = product.variants.map(function (v) { return v.price; });
		data.offers = {
			'@type': 'AggregateOffer',
			priceCurrency: 'EUR',
			lowPrice: Math.min.apply(null, prices).toFixed(2),
			highPrice: Math.max.apply(null, prices).toFixed(2),
			offerCount: product.variants.length,
			offers: product.variants.map(offer)
		};
	} else if (product.sale === 'request' && product.priceFrom != null) {
		data.offers = { '@type': 'AggregateOffer', priceCurrency: 'EUR', lowPrice: product.priceFrom.toFixed(2), url: url };
	} else {
		// Zonder aanbod (extern / binnenkort) geen Product-schema: Google keurt dat af
		return null;
	}
	return data;
}

function productPage(product, ctx) {
	const site = ctx.site;
	const root = '../';
	// Op de productpagina staat de eerste variant voorgeselecteerd, dus toon díe prijs (geen "Vanaf")
	const price = product.sale === 'cart' ? h.euro(product.variants[0].price) : h.priceLabel(product);
	const first = product.images[0];
	const firstEntry = ctx.images[first.file];

	const crumbs = [
		{ label: 'Home', path: '', url: root + 'index.html' },
		{ label: 'Webshop', path: 'webshop.html', url: root + 'webshop.html' },
		{ label: product.name, path: h.productUrl(product) }
	];

	const specs = product.specs.slice();
	if (product.material) specs.unshift({ label: 'Materiaal', value: product.material });

	const related = (product.related || []).map(function (id) { return ctx.byId[id]; });
	const reviews = ctx.reviews.filter(function (r) { return r.products.indexOf(product.id) !== -1; });

	const main = '<div class="container pdp-container">\n'
		+ '\t' + c.breadcrumbs(crumbs) + '\n'
		+ '\t<article class="pdp">\n'
		+ '\t' + gallery(product, ctx, root) + '\n'
		+ '\t<div class="pdp-buy">\n'
		+ '\t\t<p class="product-kicker">' + c.kicker(product, ctx) + '</p>\n'
		+ (product.badge ? '\t\t<p class="pdp-badge">' + h.esc(product.badge) + '</p>\n' : '')
		+ '\t\t<h1 class="pdp-title">' + h.esc(product.name) + '</h1>\n'
		+ '\t\t<p class="pdp-tagline">' + h.esc(product.tagline) + '</p>\n'
		+ (price ? '\t\t<p class="pdp-price" id="pdp-price" aria-live="polite">' + price + '</p>\n' : '\t\t<p class="pdp-price pdp-price-muted">Binnenkort beschikbaar</p>\n')
		+ (product.sale === 'cart' ? '\t\t<p class="pdp-price-note">' + h.esc(site.shipping.note) + '</p>\n' : '')
		+ '\t\t' + buyBox(product, ctx, root) + '\n'
		+ '\t\t<ul class="pdp-usps">\n'
		+ site.productUsps.map(function (usp) { return '\t\t\t<li>' + h.esc(usp) + '</li>'; }).join('\n') + '\n'
		+ '\t\t</ul>\n'
		+ (product.sale === 'cart'
			? '\t\t<details class="pdp-delivery">\n\t\t\t<summary>Levering en verzendkosten</summary>\n'
				+ '\t\t\t<p>' + h.esc(site.delivery.leadTimeLong) + '</p>\n\t\t\t<p>' + h.esc(site.delivery.shipping) + ' ' + h.esc(site.delivery.pickup) + '</p>\n\t\t</details>\n'
			: '')
		+ '\t</div>\n'
		+ '\t</article>\n\n'
		+ '\t<div class="pdp-details">\n'
		+ '\t\t<section class="pdp-story" aria-labelledby="story-heading">\n'
		+ '\t\t\t<h2 id="story-heading">Het verhaal</h2>\n'
		+ product.description.map(function (p) { return '\t\t\t<p>' + h.esc(p) + '</p>'; }).join('\n') + '\n'
		+ '\t\t</section>\n'
		+ '\t\t<section class="pdp-specs" aria-labelledby="specs-heading">\n'
		+ '\t\t\t<h2 id="specs-heading">In het kort</h2>\n'
		+ '\t\t\t<ul class="feature-list">\n'
		+ product.highlights.map(function (item) { return '\t\t\t\t<li>' + h.esc(item) + '</li>'; }).join('\n') + '\n'
		+ '\t\t\t</ul>\n'
		+ (specs.length
			? '\t\t\t<dl class="spec-list">\n' + specs.map(function (s) {
				return '\t\t\t\t<div><dt>' + h.esc(s.label) + '</dt><dd>' + h.esc(s.value) + '</dd></div>';
			}).join('\n') + '\n\t\t\t</dl>\n'
			: '')
		+ '\t\t</section>\n'
		+ '\t</div>\n'
		+ '</div>\n\n'
		+ c.reviewsSection(reviews, 'Wat klanten zeggen over de ' + product.name) + '\n'
		+ (related.length
			? '<section class="container pdp-related" aria-labelledby="related-heading">\n'
				+ '\t<h2 id="related-heading">Past erbij</h2>\n'
				+ '\t<div class="grid grid-products">\n'
				+ related.map(function (p) { return c.productCard(p, ctx, { root: root }); }).join('\n') + '\n'
				+ '\t</div>\n'
				+ '</section>\n'
			: '')
		+ (product.sale === 'cart'
			? '<div class="pdp-sticky" data-sticky hidden>\n'
				+ '\t<div><strong>' + h.esc(product.name) + '</strong><span data-sticky-price>' + price + '</span></div>\n'
				+ '\t<button type="button" class="btn btn-primary" data-sticky-add>In winkelwagen</button>\n'
				+ '</div>\n'
			: '');

	const ld = [c.breadcrumbsLd(crumbs, site)];
	const pLd = productLd(product, ctx);
	if (pLd) ld.push(pLd);

	return {
		path: h.productUrl(product),
		root: root,
		name: 'product',
		title: product.seo.title + ' | ' + site.name,
		ogTitle: product.seo.title,
		description: product.seo.description,
		ogImage: firstEntry.og,
		ogType: 'product',
		preload: { srcset: h.cropSrcset(ctx.images, first.file, root), sizes: GALLERY_SIZES },
		jsonLd: ld,
		main: main
	};
}

module.exports = productPage;
