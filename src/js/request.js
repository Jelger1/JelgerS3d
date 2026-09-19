// Aanvraagformulier op de productpagina: offerte voor maatwerk (Custom Lightbox)
// of een seintje zodra een product weer beschikbaar is (Kami Lamp).
import { sendForm, track } from './util.js';
import { validateForm, watchForm } from './validate.js';

export function initRequest() {
	const form = document.querySelector('.request-form');
	if (!form) return;
	const message = form.querySelector('[data-request-msg]');
	const success = document.querySelector('[data-request-success]');
	const submitBtn = form.querySelector('button[type="submit"]');
	const SUBMIT_LABEL = submitBtn.textContent;
	const product = form.dataset.productName;
	const isQuote = form.dataset.request === 'offerte';

	watchForm(form);

	form.addEventListener('submit', function (event) {
		event.preventDefault();
		if (!validateForm(form)) return;

		const values = {};
		new FormData(form).forEach(function (value, key) { values[key] = String(value).trim(); });

		const text = isQuote
			? 'AANVRAAG ' + product.toUpperCase() + '\n\n'
				+ 'Naam: ' + values.name + '\nEmail: ' + values.email + '\n'
				+ 'Gewenste afmeting: ' + (values.size || '-') + '\nAantal: ' + (values.quantity || '1') + '\n\n'
				+ 'Omschrijving:\n' + values.text + '\n'
			: values.email + ' wil een bericht zodra de ' + product + ' weer beschikbaar is.';

		const data = new FormData();
		data.append('access_key', form.dataset.accessKey);
		data.append('subject', (isQuote ? 'Aanvraag ' : 'Beschikbaarheid ') + product + ' via JelgerS3D.nl');
		data.append('from_name', 'JelgerS3D Website');
		if (values.name) data.append('name', values.name);
		data.append('email', values.email);
		data.append('message', text);
		if (form.elements.botcheck.checked) data.append('botcheck', 'true');

		submitBtn.disabled = true;
		submitBtn.textContent = 'Verzenden...';
		message.textContent = '';

		sendForm(data).then(function (ok) {
			if (!ok) throw new Error('afgewezen');
			track('generate_lead', { lead_type: form.dataset.request, item_id: form.dataset.product });
			form.hidden = true;
			success.hidden = false;
			success.focus();
		}).catch(function (error) {
			submitBtn.disabled = false;
			submitBtn.textContent = SUBMIT_LABEL;
			message.textContent = error.message === 'afgewezen'
				? 'Er ging iets mis bij het versturen. Probeer het opnieuw.'
				: 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
			message.className = 'checkout-msg checkout-msg-error';
		});
	});
}
