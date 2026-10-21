// Contactformulier op de homepage.
import { verstuur, track } from './util.js';
import { validateField } from './validate.js';

export function initForms() {
	const form = document.getElementById('contact-form');
	if (!form) return;
	const message = document.getElementById('form-msg');
	const submitBtn = form.querySelector('button[type="submit"]');
	const SUBMIT_LABEL = submitBtn.textContent;

	if (form.elements.privacy) form.elements.privacy.addEventListener('change', function () { validateField(form.elements.privacy); });

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
		if (form.elements.privacy && !validateField(form.elements.privacy)) { form.elements.privacy.focus(); return; }

		submitBtn.disabled = true;
		submitBtn.textContent = 'Verzenden...';

		verstuur({
			soort: 'contact',
			naam: name,
			email: email,
			bericht: text,
			nieuwsbrief: Boolean(form.elements.nieuwsbrief && form.elements.nieuwsbrief.checked),
			akkoord: Boolean(form.elements.privacy && form.elements.privacy.checked),
			botcheck: Boolean(form.elements.botcheck && form.elements.botcheck.checked)
		}).then(function (antwoord) {
			track('generate_lead', { lead_type: 'contact' });
			const nieuwsbrief = antwoord.mail && form.elements.nieuwsbrief && form.elements.nieuwsbrief.checked;
			say('Bedankt! Je bericht is verstuurd.' + (antwoord.mail ? ' Je krijgt een bevestiging per mail' + (nieuwsbrief ? ', met daarin de knop om je aanmelding voor de nieuwsbrief te bevestigen.' : '.') : '') + ' Ik neem snel contact met je op.', true);
			form.reset();
		}).catch(function (error) {
			say(error.message, false);
		}).finally(function () {
			submitBtn.disabled = false;
			submitBtn.textContent = SUBMIT_LABEL;
		});
	});
}
