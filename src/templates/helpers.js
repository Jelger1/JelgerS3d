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

// Vestigingsadres uit site.json > address. Zolang straat en postcode leeg zijn blijft het bij de plaats
// (de build waarschuwt dan: een volledig adres is wettelijk verplicht).
function addressLine(site, separator) {
	const a = site.address || {};
	const parts = [];
	if (a.street) parts.push(esc(a.street));
	parts.push(esc([a.postcode, a.city].filter(Boolean).join(' ')));
	return parts.join(separator || ', ');
}

// Verplichte, nooit vooraf aangevinkte checkbox voor formulieren. withTerms: ook akkoord op de algemene voorwaarden
// (bestelformulier). Uit te zetten met site.json > forms.privacyCheckbox = false; de tekst wordt dan een mededeling.
function privacyCheckbox(site, root, id, withTerms) {
	const privacy = '<a href="' + (root || '') + 'privacy.html" target="_blank" rel="noopener">privacyverklaring</a>';
	const terms = '<a href="' + (root || '') + 'voorwaarden.html" target="_blank" rel="noopener">algemene voorwaarden</a>';
	if (!(site.forms && site.forms.privacyCheckbox)) {
		return '<p class="form-privacy-note">' + (withTerms ? 'Op je bestelling zijn de ' + terms + ' van toepassing. ' : '') + 'Hoe ik met je gegevens omga lees je in de ' + privacy + '.</p>';
	}
	const text = withTerms
		? 'Ik ga akkoord met de ' + terms + ' en met de verwerking van mijn gegevens zoals beschreven in de ' + privacy + '.'
		: 'Ik ga akkoord met de verwerking van mijn gegevens zoals beschreven in de ' + privacy + '.';
	return '<div class="form-consent">'
		+ '<label class="form-consent-label" for="' + id + '"><input type="checkbox" id="' + id + '" name="privacy" value="akkoord" required aria-describedby="' + id + '-error">'
		+ '<span>' + text + ' <span aria-hidden="true">*</span></span></label>'
		+ '<p class="field-error" id="' + id + '-error" hidden></p>'
		+ '</div>';
}

function jsonLd(data) {
	// "</script>" in data mag de scripttag nooit kunnen afsluiten
	return '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>';
}

// Bestanden meesturen met een aanvraag (printservice, maatwerk). Welke typen, hoeveel en hoe groot staat in
// data/site.json > uploads; dezelfde regels controleert de Supabase-functie. Het uploaden zelf: src/js/upload.js.
// Het bestandsveld heeft bewust geen name: het gaat niet mee als formulierveld, alleen de id's na het uploaden.
function typesLabel(types) {
	const lijst = types.filter(function (t) { return t !== 'jpeg'; }).map(function (t) { return t.toUpperCase(); });
	return lijst.length > 1 ? lijst.slice(0, -1).join(', ') + ' of ' + lijst[lijst.length - 1] : lijst.join('');
}

function uploadField(site, soort, opts) {
	const u = site.uploads;
	if (!u || !u[soort]) return '';
	const regels = u[soort];
	const label = typesLabel(regels.types);
	return '<div class="form-group upload" data-upload data-types="' + regels.types.join(',') + '" data-types-label="' + esc(label) + '" data-max="' + regels.max + '" data-max-mb="' + u.maxMB + '">'
		+ '<label for="rq-files">' + esc(opts.label) + ' <span class="optional">(' + esc(label) + ', tot ' + u.maxMB + ' MB' + (regels.max > 1 ? ', hooguit ' + regels.max + ' bestanden' : '') + ')</span></label>'
		+ '<div class="upload-drop" data-upload-drop>'
		+ '<input type="file" id="rq-files" class="upload-input"' + (regels.max > 1 ? ' multiple' : '') + ' accept="' + regels.types.map(function (t) { return '.' + t; }).join(',') + '" aria-describedby="rq-files-hint">'
		+ '<svg class="upload-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
		+ '<span class="upload-drop-text"><strong>Kies ' + (regels.max > 1 ? 'bestanden' : 'een bestand') + '</strong> of sleep ' + (regels.max > 1 ? 'ze' : 'het') + ' hierheen</span>'
		+ '</div>'
		+ '<ul class="upload-list" data-upload-list></ul>'
		+ '<p class="upload-hint" id="rq-files-hint">' + esc(opts.hint) + '</p>'
		+ '</div>';
}

// Het vinkje voor de nieuwsbrief in formulieren: standaard uit, en pas na de bevestigingsknop in de mail sta je op de lijst
function nieuwsbriefCheckbox(id) {
	return '<div class="form-consent form-optin">'
		+ '<label class="form-consent-label" for="' + id + '"><input type="checkbox" id="' + id + '" name="nieuwsbrief" value="ja">'
		+ '<span>Houd me op de hoogte van nieuwe ontwerpen (af en toe een mail, afmelden kan altijd)</span></label>'
		+ '</div>';
}

// Aanmelden voor de nieuwsbrief met alleen een e-mailadres (footer en bedanktpagina); src/js/nieuwsbrief.js verstuurt het
function nieuwsbriefForm(bron, root) {
	const id = 'nb-email-' + bron;
	return '<form class="newsletter-form" data-nieuwsbrief="' + bron + '" novalidate>'
		+ '<div class="newsletter-row">'
		+ '<label class="sr-only" for="' + id + '">E-mailadres</label>'
		+ '<input type="email" id="' + id + '" name="email" required autocomplete="email" placeholder="je@email.nl">'
		+ '<button type="submit" class="btn btn-primary">Aanmelden</button>'
		+ '</div>'
		+ '<input type="checkbox" name="botcheck" class="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">'
		+ '<p class="newsletter-note">Je krijgt eerst een mail om je aanmelding te bevestigen. Zie de <a href="' + (root || '') + 'privacy.html">privacyverklaring</a>.</p>'
		+ '<p class="newsletter-msg" data-nieuwsbrief-msg role="status"></p>'
		+ '</form>';
}

// Vervangt {{sleutel}} in een HTML-partial
// Je e-mailadres staat niet leesbaar in de HTML: robots die het web afstruinen naar adressen vinden zo geen adres
// en geen mailto-link. In de browser maakt src/js/mail.js er weer een gewone, klikbare link van; zonder JavaScript
// gaat de link naar het contactformulier. Code: het adres achterstevoren, in base64.
function mailCode(email) {
	return Buffer.from(String(email).split('').reverse().join(''), 'utf8').toString('base64');
}

function mailLink(email, home) {
	return '<a href="' + home + '#contact" data-mail="' + mailCode(email) + '">mijn e-mailadres</a>';
}

function fill(template, values) {
	return template.replace(/\{\{\s*([\w:.-]+)\s*\}\}/g, function (match, key) {
		if (!(key in values)) throw new Error('Onbekende placeholder {{' + key + '}}');
		return values[key];
	});
}

module.exports = {
	esc: esc, euro: euro, minPrice: minPrice, priceLabel: priceLabel, priceHtml: priceHtml, productUrl: productUrl,
	img: img, imgPath: imgPath, cropSrcset: cropSrcset, jsonLd: jsonLd, fill: fill,
	addressLine: addressLine, privacyCheckbox: privacyCheckbox, mailCode: mailCode, mailLink: mailLink,
	uploadField: uploadField, nieuwsbriefCheckbox: nieuwsbriefCheckbox, nieuwsbriefForm: nieuwsbriefForm
};
