// Aanvraagformulieren: maatwerk op een productpagina (Custom Lightbox), de 3D-printservice, of een seintje
// zodra een product weer beschikbaar is. Welke het is staat in data-request: offerte, printservice of
// beschikbaarheid. Alles gaat naar de Supabase-functie "formulier" (zie verstuur() in util.js).
import { verstuur, track } from './util.js';
import { validateForm, watchForm } from './validate.js';
import { initUpload } from './upload.js';

// De ingevulde velden met hun label als naam ("Gewenste kleur": "Rood"). Zo staan ze in de database en
// in de mails zoals de bezoeker ze zag, ook als een pagina andere velden heeft dan een andere.
function velden(form, values) {
	const uit = {};
	Array.from(form.querySelectorAll('input, textarea, select')).forEach(function (field) {
		if (!field.name || ['name', 'email', 'botcheck', 'privacy', 'nieuwsbrief'].indexOf(field.name) !== -1 || !values[field.name]) return;
		const label = field.id && form.querySelector('label[for="' + field.id + '"]');
		uit[label ? label.textContent.replace(/\s*\*\s*$/, '').trim() : field.name] = values[field.name];
	});
	return uit;
}

export function initRequest() {
	const form = document.querySelector('.request-form');
	if (!form) return;
	const message = form.querySelector('[data-request-msg]');
	const success = document.querySelector('[data-request-success]');
	const submitBtn = form.querySelector('button[type="submit"]');
	const SUBMIT_LABEL = submitBtn.textContent;
	const upload = initUpload(form); // printservice en maatwerk: bestanden meesturen

	watchForm(form);

	function fout(tekst) {
		message.textContent = tekst;
		message.className = 'checkout-msg checkout-msg-error';
	}

	form.addEventListener('submit', function (event) {
		event.preventDefault();
		if (!validateForm(form)) return;
		const bestandFout = upload ? upload.fout() : '';
		if (bestandFout) { fout(bestandFout); return; }

		const values = {};
		new FormData(form).forEach(function (value, key) { values[key] = String(value).trim(); });

		submitBtn.disabled = true;
		submitBtn.textContent = 'Verzenden...';
		message.textContent = '';

		// Eerst de bestanden (met de voortgang op de knop), dan het formulier met hun id's
		(upload ? upload.upload(function (procent) { submitBtn.textContent = 'Uploaden... ' + procent + '%'; }) : Promise.resolve([])).then(function (bestanden) {
			submitBtn.textContent = 'Verzenden...';
			return verstuur({
				soort: form.dataset.request,
				naam: values.name || '',
				email: values.email,
				product: form.dataset.product, // de functie zoekt de naam zelf op in de catalogus
				velden: velden(form, values),
				bestanden: bestanden,
				nieuwsbrief: values.nieuwsbrief === 'ja',
				akkoord: Boolean(values.privacy),
				botcheck: form.elements.botcheck.checked
			});
		}).then(function (antwoord) {
			track('generate_lead', { lead_type: form.dataset.request, item_id: form.dataset.product });
			const extra = [];
			if (antwoord.bestanden) extra.push(antwoord.bestanden === 1 ? 'Je bestand is goed aangekomen.' : 'Je ' + antwoord.bestanden + ' bestanden zijn goed aangekomen.');
			if (antwoord.mail) extra.push('Je krijgt ook een bevestiging per mail.');
			if (antwoord.mail && values.nieuwsbrief === 'ja') extra.push('Daarin staat ook de knop om je aanmelding voor de nieuwsbrief te bevestigen.');
			if (extra.length) {
				const p = document.createElement('p');
				p.textContent = extra.join(' ');
				success.appendChild(p);
			}
			form.hidden = true;
			success.hidden = false;
			success.focus();
		}).catch(function (error) {
			submitBtn.disabled = false;
			submitBtn.textContent = SUBMIT_LABEL;
			fout(error.message);
		});
	});
}
