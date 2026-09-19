// Contactformulier op de homepage. Komt iemand via een productpagina
// (?onderwerp=custom-lightbox), dan staat het bericht alvast klaar.
import catalog from './catalog.js';
import { sendForm } from './util.js';

function prefill(form) {
	const subject = new URLSearchParams(location.search).get('onderwerp');
	const product = subject && catalog[subject];
	if (!product) return;
	const field = form.querySelector('[name="message"]');
	if (field.value) return;

	field.value = product.sale === 'request'
		? 'Ik ben geïnteresseerd in een ' + product.name + '.\n\nGewenste afmeting:\nGewenst aantal:\nBeschrijving van het ontwerp:\n\n(Je logo of afbeelding kun je daarna per mail nasturen: PNG, JPG, PDF, AI of SVG.)'
		: 'Ik heb interesse in de ' + product.name + '. Laat je het weten zodra hij weer beschikbaar is?';
	form.dataset.subject = product.name;
}

export function initForms() {
	const form = document.getElementById('contact-form');
	if (!form) return;
	const message = document.getElementById('form-msg');
	const submitBtn = form.querySelector('button[type="submit"]');
	const SUBMIT_LABEL = submitBtn.textContent;

	prefill(form);

	function say(text, ok) {
		message.textContent = text;
		message.className = 'form-msg ' + (ok ? 'form-msg-success' : 'form-msg-error');
	}

	form.addEventListener('submit', function (event) {
		event.preventDefault();
		const name = form.elements.name.value.trim();
		const email = form.elements.email.value.trim();
		const text = form.elements.message.value.trim();
		if (!name || !email || !text) { say('Vul alle velden in.', false); return; }
		if (!form.elements.email.checkValidity()) { say('Controleer je e-mailadres.', false); return; }

		const data = new FormData(form);
		data.append('subject', (form.dataset.subject ? 'Aanvraag ' + form.dataset.subject : 'Contactaanvraag') + ' van ' + name + ' via JelgerS3D.nl');
		data.append('from_name', 'JelgerS3D Website');

		submitBtn.disabled = true;
		submitBtn.textContent = 'Verzenden...';

		sendForm(data).then(function (ok) {
			if (!ok) throw new Error('afgewezen');
			say('Bedankt! Je bericht is verstuurd. Ik neem snel contact met je op.', true);
			form.reset();
		}).catch(function (error) {
			say(error.message === 'afgewezen' ? 'Er ging iets mis. Probeer het opnieuw.' : 'Verbindingsfout. Controleer je internet en probeer opnieuw.', false);
		}).finally(function () {
			submitBtn.disabled = false;
			submitBtn.textContent = SUBMIT_LABEL;
		});
	});
}
