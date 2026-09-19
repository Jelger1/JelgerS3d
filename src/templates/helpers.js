// Kleine hulpfuncties voor alle templates.

function esc(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function euro(amount) {
	return '€' + Number(amount).toFixed(2).replace('.', ',');
}

// Laagste prijs van een product (null als er geen prijs is, bv. "binnenkort")
function minPrice(product) {
	if (product.variants && product.variants.length) {
		return Math.min.apply(null, product.variants.map(function (v) { return v.price; }));
	}
	return product.priceFrom != null ? product.priceFrom : null;
}

function priceLabel(product) {
	const price = minPrice(product);
	if (price == null) return '';
	const hasRange = product.priceFrom != null || (product.variants.length > 1 &&
		product.variants.some(function (v) { return v.price !== price; }));
	return (hasRange ? 'Vanaf ' : '') + euro(price);
}

// Zelfde als priceLabel, maar met "Vanaf" als klein label boven de prijs
function priceHtml(product) {
	const label = priceLabel(product);
	return label.indexOf('Vanaf ') === 0
		? '<span class="price-from">Vanaf</span> ' + label.slice(6)
		: label;
}

function productUrl(product, root) {
	return (root || '') + 'producten/' + product.id + '.html';
}

// Responsive <img> met srcset uit het afbeeldingsmanifest.
// opts: alt, sizes, root, className, eager (boven de vouw), attrs (extra attributen als string),
//       crop (true = de productuitsnede met het product in het midden, in plaats van de volledige foto)
function variantsOf(entry, crop) {
	return crop && entry.crop ? entry.crop.variants : entry.variants;
}

function img(manifest, file, opts) {
	opts = opts || {};
	const entry = manifest[file];
	if (!entry) throw new Error('Afbeelding niet gevonden in assets/: ' + file);
	const root = opts.root || '';
	const base = root + 'assets/img/';
	const variants = variantsOf(entry, opts.crop);
	const srcset = variants.map(function (v) { return base + v.file + ' ' + v.w + 'w'; }).join(', ');
	// Middelste variant als fallback-src
	const fallback = variants[Math.min(1, variants.length - 1)];
	const largest = variants[variants.length - 1];
	return '<img src="' + base + fallback.file + '"'
		+ ' srcset="' + srcset + '"'
		+ ' sizes="' + esc(opts.sizes || '100vw') + '"'
		+ ' width="' + largest.w + '" height="' + largest.h + '"'
		+ ' alt="' + esc(opts.alt || '') + '"'
		+ (opts.className ? ' class="' + esc(opts.className) + '"' : '')
		+ (opts.eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"')
		+ (opts.attrs ? ' ' + opts.attrs : '')
		+ '>';
}

function imgPath(manifest, file, width, root, crop) {
	const entry = manifest[file];
	if (!entry) throw new Error('Afbeelding niet gevonden in assets/: ' + file);
	const variants = variantsOf(entry, crop);
	const variant = variants.find(function (v) { return v.w >= width; }) || variants[variants.length - 1];
	return (root || '') + 'assets/img/' + variant.file;
}

// srcset van de productuitsnede, voor <link rel="preload">
function cropSrcset(manifest, file, root) {
	return variantsOf(manifest[file], true).map(function (v) { return (root || '') + 'assets/img/' + v.file + ' ' + v.w + 'w'; }).join(', ');
}

function jsonLd(data) {
	// "</script>" in data mag de scripttag nooit kunnen afsluiten
	return '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>';
}

// Vervangt {{sleutel}} in een HTML-partial
function fill(template, values) {
	return template.replace(/\{\{\s*([\w:.-]+)\s*\}\}/g, function (match, key) {
		if (!(key in values)) throw new Error('Onbekende placeholder {{' + key + '}}');
		return values[key];
	});
}

module.exports = {
	esc: esc, euro: euro, minPrice: minPrice, priceLabel: priceLabel, priceHtml: priceHtml, productUrl: productUrl,
	img: img, imgPath: imgPath, cropSrcset: cropSrcset, jsonLd: jsonLd, fill: fill
};
