export function esc(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function euro(amount) {
	return '€' + Number(amount).toFixed(2).replace('.', ',');
}

export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Verstuurt een formulier via Web3Forms; geeft true terug bij succes
export function sendForm(formData) {
	return fetch('https://api.web3forms.com/submit', { method: 'POST', body: formData })
		.then(function (response) { return response.json(); })
		.then(function (data) { return Boolean(data && data.success); });
}

// Zet een meetmoment klaar in de dataLayer, in de vorm die Google Tag Manager en GA4 verwachten (ecommerce-object).
// De site verstuurt zelf niets: tags in Tag Manager bepalen wat ermee gebeurt, binnen de toestemming (zie consent.js).
export function track(event, params) {
	window.dataLayer = window.dataLayer || [];
	if (params && params.ecommerce) window.dataLayer.push({ ecommerce: null });
	window.dataLayer.push(Object.assign({ event: event }, params || {}));
}

// Winkelwagenregels -> GA4 "items"
export function trackItems(lines) {
	return lines.map(function (line) {
		return { item_id: line.id, item_name: line.name, item_variant: line.label || undefined, price: line.price, quantity: line.qty };
	});
}
