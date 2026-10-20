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

// Verstuurt een formulier naar de Supabase-functie "formulier" (supabase/functions/formulier/index.ts).
// Die slaat het op en mailt een bevestiging naar de bezoeker en een overzicht naar mij.
// Geeft het antwoord terug ({ ok, id, ... }) of gooit een fout met een melding die je zo kunt tonen.
// De invultijd gaat mee (milliseconden sinds het laden van de pagina): robots versturen binnen een seconde, mensen niet.
const BACKEND = document.documentElement.dataset.backend || '';

export function verstuur(gegevens) {
	if (!BACKEND) return Promise.reject(new Error('Versturen lukt nu niet. Mail me gerust direct.'));
	return fetch(BACKEND, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(Object.assign({ pagina: location.href, duur: Math.round(performance.now()) }, gegevens))
	}).catch(function () {
		throw new Error('Geen verbinding. Controleer je internet en probeer het opnieuw.');
	}).then(function (response) {
		return response.json().catch(function () { return {}; }).then(function (antwoord) {
			if (!response.ok || !antwoord.ok) throw new Error(antwoord.fout || 'Er ging iets mis bij het versturen. Probeer het opnieuw.');
			return antwoord;
		});
	});
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
