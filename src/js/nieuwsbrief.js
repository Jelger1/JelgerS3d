// Aanmelden voor de nieuwsbrief met alleen een e-mailadres (onderaan elke pagina en op de bedanktpagina; zie
// nieuwsbriefForm in src/templates/helpers.js). De functie stuurt eerst een mail met een bevestigingsknop.
import { verstuur, track } from './util.js';

export function initNieuwsbrief() {
	document.querySelectorAll('form[data-nieuwsbrief]').forEach(function (form) {
		const message = form.querySelector('[data-nieuwsbrief-msg]');
		const button = form.querySelector('button[type="submit"]');
		const LABEL = button.textContent;

		function say(text, ok) {
			message.textContent = text;
			message.className = 'newsletter-msg ' + (ok ? 'is-ok' : 'is-error');
		}

		form.addEventListener('submit', function (event) {
			event.preventDefault();
			const email = form.elements.email;
			if (!email.value.trim() || !email.checkValidity()) {
				say('Vul een geldig e-mailadres in.', false);
				email.focus();
				return;
			}
			button.disabled = true;
			button.textContent = 'Aanmelden...';
			verstuur({
				soort: 'nieuwsbrief',
				email: email.value.trim(),
				bron: form.dataset.nieuwsbrief,
				botcheck: form.elements.botcheck.checked
			}).then(function () {
				track('sign_up', { method: 'nieuwsbrief', bron: form.dataset.nieuwsbrief });
				say('Bijna klaar! Check je mail en klik op de bevestigingsknop.', true);
				form.reset();
			}).catch(function (error) {
				say(error.message, false);
			}).finally(function () {
				button.disabled = false;
				button.textContent = LABEL;
			});
		});
	});
}
