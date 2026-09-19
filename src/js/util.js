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
