// afrekenen.html en bedankt.html. De inhoud van de winkelwagen vult de browser in (src/js/checkout.js).
// bedankt.html is een eigen pagina, zodat je in Google Ads/Analytics een conversie op die URL kunt meten.
const h = require('./helpers');

function field(opts) {
	const id = 'co-' + opts.name;
	const required = opts.required !== false;
	const control = opts.type === 'textarea'
		? '<textarea id="' + id + '" name="' + opts.name + '" rows="3"' + (opts.placeholder ? ' placeholder="' + h.esc(opts.placeholder) + '"' : '') + '></textarea>'
		: '<input type="' + (opts.type || 'text') + '" id="' + id + '" name="' + opts.name + '"'
			+ (required ? ' required' : '')
			+ (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : '')
			+ (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '')
			+ (opts.placeholder ? ' placeholder="' + h.esc(opts.placeholder) + '"' : '')
			+ ' aria-describedby="' + id + '-error">';
	return '<div class="form-group' + (opts.className ? ' ' + opts.className : '') + '">\n'
		+ '\t\t\t\t\t<label for="' + id + '">' + h.esc(opts.label) + (required ? ' <span aria-hidden="true">*</span>' : ' <span class="optional">(optioneel)</span>') + '</label>\n'
		+ '\t\t\t\t\t' + control + '\n'
		+ '\t\t\t\t\t<p class="field-error" id="' + id + '-error" hidden></p>\n'
		+ '\t\t\t\t</div>';
}

const STEPS = [
	['Aanvraag versturen', 'Je vult je gegevens in. Je betaalt nu nog niets.'],
	['Persoonlijk contact', 'Ik neem contact op over kleur, details en verzending.'],
	['Betaling & productie', 'Pas na jouw akkoord wordt er betaald en geprint.']
];

function steps(active) {
	return '<ol class="checkout-steps">\n' + STEPS.map(function (step, i) {
		return '\t\t<li' + (i === active ? ' class="is-active" aria-current="step"' : (i < active ? ' class="is-done"' : '')) + '>'
			+ '<span class="step-number" aria-hidden="true">' + (i < active ? '✓' : i + 1) + '</span>'
			+ '<div><strong>' + h.esc(step[0]) + '</strong><p>' + h.esc(step[1]) + '</p></div></li>';
	}).join('\n') + '\n\t</ol>';
}

function checkoutPage(ctx) {
	const site = ctx.site;
	const main = '<div class="container checkout-page">\n'
		+ '\t<p class="checkout-back"><a href="webshop.html">← Verder winkelen</a></p>\n'
		+ '\t<h1>Bestelling afronden</h1>\n'
		+ '\t' + steps(0) + '\n'
		+ '\t<div class="checkout-empty" id="checkout-empty" hidden>\n'
		+ '\t\t<p><strong>Je winkelwagen is nog leeg.</strong></p>\n'
		+ '\t\t<p><a class="btn btn-primary" href="webshop.html">Bekijk de webshop</a></p>\n'
		+ '\t</div>\n'
		+ '\t<div class="checkout-layout" id="checkout-layout">\n'
		+ '\t\t<form id="checkout-form" class="checkout-form" novalidate data-access-key="' + h.esc(site.web3forms.orderKey) + '" data-thanks="bedankt.html">\n'
		+ '\t\t\t<fieldset>\n'
		+ '\t\t\t\t<legend>Jouw gegevens</legend>\n'
		+ '\t\t\t\t' + field({ name: 'name', label: 'Naam', autocomplete: 'name', placeholder: 'Je volledige naam' }) + '\n'
		+ '\t\t\t\t' + field({ name: 'email', label: 'E-mailadres', type: 'email', autocomplete: 'email', placeholder: 'je@email.nl' }) + '\n'
		+ '\t\t\t\t' + field({ name: 'phone', label: 'Telefoonnummer', type: 'tel', autocomplete: 'tel', placeholder: '06 12345678' }) + '\n'
		+ '\t\t\t</fieldset>\n'
		+ '\t\t\t<fieldset>\n'
		+ '\t\t\t\t<legend>Levering</legend>\n'
		+ '\t\t\t\t<div class="choice-cards" role="radiogroup" aria-label="Hoe wil je je bestelling ontvangen?">\n'
		+ '\t\t\t\t\t<label class="choice-card"><input type="radio" name="delivery" value="Verzenden" checked><span><strong>Verzenden</strong><small>' + h.esc(site.delivery.shipping) + '</small></span></label>\n'
		+ '\t\t\t\t\t<label class="choice-card"><input type="radio" name="delivery" value="Ophalen"><span><strong>Zelf ophalen in ' + h.esc(site.pickupLocation) + '</strong><small>Geen verzendkosten. Adres en moment spreken we samen af.</small></span></label>\n'
		+ '\t\t\t\t</div>\n'
		+ '\t\t\t</fieldset>\n'
		+ '\t\t\t<fieldset data-address>\n'
		+ '\t\t\t\t<legend>Bezorgadres</legend>\n'
		+ '\t\t\t\t' + field({ name: 'address', label: 'Straat en huisnummer', autocomplete: 'street-address', placeholder: 'Straat 12' }) + '\n'
		+ '\t\t\t\t<div class="form-row">\n'
		+ '\t\t\t\t' + field({ name: 'postcode', label: 'Postcode', autocomplete: 'postal-code', placeholder: '1234 AB', className: 'form-group-narrow' }) + '\n'
		+ '\t\t\t\t' + field({ name: 'city', label: 'Plaats', autocomplete: 'address-level2', placeholder: 'Woonplaats' }) + '\n'
		+ '\t\t\t\t</div>\n'
		+ '\t\t\t\t<div class="form-group">\n'
		+ '\t\t\t\t\t<label for="co-country">Land</label>\n'
		+ '\t\t\t\t\t<select id="co-country" name="country" autocomplete="country-name">\n'
		+ '\t\t\t\t\t\t<option value="Nederland" selected>Nederland</option>\n'
		+ '\t\t\t\t\t\t<option value="België">België</option>\n'
		+ '\t\t\t\t\t\t<option value="Duitsland">Duitsland</option>\n'
		+ '\t\t\t\t\t</select>\n'
		+ '\t\t\t\t</div>\n'
		+ '\t\t\t</fieldset>\n'
		+ '\t\t\t<fieldset>\n'
		+ '\t\t\t\t<legend>Wensen</legend>\n'
		+ '\t\t\t\t' + field({ name: 'notes', label: 'Opmerkingen', type: 'textarea', required: false, placeholder: 'Gewenste kleur, eigen naam, bijzonderheden...' }) + '\n'
		+ '\t\t\t</fieldset>\n'
		// Onzichtbaar veld tegen spamrobots (Web3Forms negeert inzendingen waarbij dit is aangevinkt)
		+ '\t\t\t<input type="checkbox" name="botcheck" class="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">\n'
		+ '\t\t\t<p id="checkout-msg" class="checkout-msg" role="alert"></p>\n'
		+ '\t\t\t<button type="submit" id="checkout-submit" class="btn btn-primary btn-block">Aanvraag versturen</button>\n'
		+ '\t\t\t<p class="checkout-disclaimer">' + h.esc(site.shipping.note) + '. Dit is een aanvraag: je betaalt pas na bevestiging.</p>\n'
		+ '\t\t</form>\n'
		+ '\t\t<aside class="checkout-aside" aria-labelledby="summary-heading">\n'
		+ '\t\t\t<h2 id="summary-heading">Jouw bestelling</h2>\n'
		+ '\t\t\t<div id="checkout-summary" class="checkout-lines"></div>\n'
		+ '\t\t\t<button type="button" class="btn-text" data-open-cart>Winkelwagen wijzigen</button>\n'
		+ '\t\t\t<p class="deadline-note" data-deadlines="' + h.esc(JSON.stringify(site.deadlines || [])) + '" hidden></p>\n'
		+ '\t\t\t<ul class="pdp-usps">\n'
		+ site.productUsps.map(function (usp) { return '\t\t\t\t<li>' + h.esc(usp) + '</li>'; }).join('\n') + '\n'
		+ '\t\t\t</ul>\n'
		+ '\t\t</aside>\n'
		+ '\t</div>\n'
		+ '</div>';

	return {
		path: 'afrekenen.html',
		root: '',
		name: 'checkout',
		noindex: true,
		title: 'Bestelling afronden | ' + site.name,
		description: 'Rond je bestelling bij ' + site.name + ' af. Je verstuurt een aanvraag en betaalt pas na persoonlijke bevestiging.',
		ogImage: ctx.images[site.defaultOgImage].og,
		main: main
	};
}

function thanksPage(ctx) {
	const site = ctx.site;
	const main = '<div class="container checkout-page thanks-page">\n'
		+ '\t<div class="success-icon" aria-hidden="true">✓</div>\n'
		+ '\t<h1>Bedankt voor je aanvraag!</h1>\n'
		+ '\t<p class="thanks-intro">Je bestelling is bij mij binnengekomen. Ik neem zo snel mogelijk <strong>persoonlijk contact</strong> met je op om kleur, details en verzending door te spreken.</p>\n'
		+ '\t' + steps(1) + '\n'
		+ '\t<section class="checkout-aside thanks-order" id="thanks-order" aria-labelledby="thanks-heading" hidden>\n'
		+ '\t\t<h2 id="thanks-heading">Dit heb je aangevraagd</h2>\n'
		+ '\t\t<div id="thanks-lines" class="checkout-lines"></div>\n'
		+ '\t</section>\n'
		+ '\t<p class="thanks-actions"><a class="btn btn-primary" href="webshop.html">Verder kijken in de webshop</a> <a class="btn outline" href="' + h.esc(site.instagram) + '" target="_blank" rel="noopener noreferrer">Volg op Instagram</a></p>\n'
		+ '</div>';

	return {
		path: 'bedankt.html',
		root: '',
		name: 'thanks',
		noindex: true,
		title: 'Bedankt voor je aanvraag | ' + site.name,
		description: 'Bedankt voor je aanvraag bij ' + site.name + '. Ik neem zo snel mogelijk persoonlijk contact met je op.',
		ogImage: ctx.images[site.defaultOgImage].og,
		main: main
	};
}

module.exports = { checkoutPage: checkoutPage, thanksPage: thanksPage };
