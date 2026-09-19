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

// Zet een meetmoment klaar in de dataLayer (GA4-formaat). Er wordt niets verstuurd zolang er geen
// Google Tag op de site staat; zodra die er is, pakt hij deze events vanzelf op.
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
