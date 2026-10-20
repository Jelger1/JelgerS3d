// Aanvraagformulier op de productpagina: offerte voor maatwerk (Custom Lightbox)
// of een seintje zodra een product weer beschikbaar is (Kami Lamp).
import { sendForm, track } from './util.js';
import { validateForm, watchForm } from './validate.js';

// De aanvraagmail volgt de labels van het formulier zelf. Zo klopt hij ook als een pagina andere
// velden heeft (de printservice vraagt bijvoorbeeld een kleur in plaats van een afmeting).
function quoteLines(form, values) {
	return Array.from(form.querySelectorAll('input, textarea, select')).filter(function (field) {
		return field.name && field.name !== 'botcheck' && field.name !== 'privacy' && values[field.name];
	}).map(function (field) {
		const label = field.id && form.querySelector('label[for="' + field.id + '"]');
		const naam = label ? label.textContent.replace(/\s*\*\s*$/, '').trim() : field.name;
		return naam + ': ' + values[field.name];
	}).join('\n');
}

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
			? 'AANVRAAG ' + product.toUpperCase() + '\n\n' + quoteLines(form, values) + '\n'
			: values.email + ' wil een bericht zodra de ' + product + ' weer beschikbaar is.';
		const consent = values.privacy ? '\n\nAkkoord met privacyverklaring: ja, op ' + new Date().toLocaleString('nl-NL') : '';

		const data = new FormData();
		data.append('access_key', form.dataset.accessKey);
		data.append('subject', (isQuote ? 'Aanvraag ' : 'Beschikbaarheid ') + product + ' via JelgerS3D.nl');
		data.append('from_name', 'JelgerS3D Website');
		if (values.name) data.append('name', values.name);
		data.append('email', values.email);
		data.append('message', text + consent);
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
