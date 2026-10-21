// afrekenen.html: overzicht van de winkelwagen, validatie en het versturen van de aanvraag naar de
// Supabase-functie "formulier", die de prijzen narekent, de bestelling opslaat en beide mails verstuurt.
// Na succes gaat de bezoeker naar bedankt.html; de bestelling reist mee via sessionStorage.
import * as cart from './cart.js';
import { esc, euro, verstuur, track, trackItems } from './util.js';
import { validateForm, watchForm } from './validate.js';

export const LAST_ORDER_KEY = 'js3d-last-order';
const root = document.body.dataset.root || '';

// Regels als HTML; wordt ook op de bedanktpagina gebruikt
export function linesHtml(lines, total) {
	return '<ul class="checkout-line-list">' + lines.map(function (line) {
		return '<li class="checkout-line">'
			+ '<img src="' + root + esc(line.image) + '" alt="" width="56" height="70" loading="lazy">'
			+ '<div><strong>' + esc(line.name) + '</strong>'
			+ (line.label ? '<span>' + esc(line.label) + '</span>' : '')
			+ '<span>Aantal: ' + line.qty + '</span></div>'
			+ '<span class="checkout-line-price">' + euro(line.lineTotal) + '</span>'
			+ '</li>';
	}).join('') + '</ul>'
		+ '<div class="checkout-item checkout-item-total"><strong>Totaal</strong><strong>' + euro(total) + '</strong></div>';
}

export function initCheckout() {
	const form = document.getElementById('checkout-form');
	if (!form) return;
	const layout = document.getElementById('checkout-layout');
	const empty = document.getElementById('checkout-empty');
	const summary = document.getElementById('checkout-summary');
	const message = document.getElementById('checkout-msg');
	const submitBtn = document.getElementById('checkout-submit');
	const SUBMIT_LABEL = submitBtn.textContent;
	let sending = false;

	function render() {
		if (sending) return; // tijdens het versturen wordt de wagen geleegd; laat de pagina dan met rust
		const lines = cart.getLines();
		layout.hidden = lines.length === 0;
		empty.hidden = lines.length !== 0;
		summary.innerHTML = linesHtml(lines, cart.total());
	}

	cart.subscribe(render);
	render();
	watchForm(form);

	// Wie komt ophalen hoeft geen adres in te vullen. Een uitgeschakeld fieldset telt niet mee bij validatie en verzenden.
	const addressFields = form.querySelector('[data-address]');
	function syncDelivery() {
		const pickup = form.elements.delivery.value === 'Ophalen';
		addressFields.hidden = pickup;
		addressFields.disabled = pickup;
	}
	form.addEventListener('change', function (event) { if (event.target.name === 'delivery') syncDelivery(); });
	syncDelivery();

	if (cart.count() > 0) {
		track('begin_checkout', { ecommerce: { currency: 'EUR', value: cart.total(), items: trackItems(cart.getLines()) } });
	}

	form.addEventListener('submit', function (event) {
		event.preventDefault();
		if (sending || cart.count() === 0) return;
		if (!validateForm(form)) {
			message.textContent = 'Nog niet alles is goed ingevuld. Kijk even bij de gemarkeerde velden.';
			message.className = 'checkout-msg checkout-msg-error';
			return;
		}

		const values = {};
		new FormData(form).forEach(function (value, key) { values[key] = String(value).trim(); });
		const lines = cart.getLines();
		const total = cart.total();

		sending = true;
		submitBtn.disabled = true;
		submitBtn.textContent = 'Verzenden...';
		message.textContent = '';
		message.className = 'checkout-msg';

		// Alleen wat nodig is: de functie zoekt naam en prijs zelf op in de catalogus van de site
		verstuur({
			soort: 'bestelling',
			naam: values.name,
			email: values.email,
			telefoon: values.phone,
			nieuwsbrief: values.nieuwsbrief === 'ja',
			akkoord: Boolean(values.privacy),
			botcheck: form.elements.botcheck.checked,
			bestelling: {
				levering: values.delivery,
				adres: values.address,
				postcode: values.postcode,
				plaats: values.city,
				land: values.country,
				opmerkingen: values.notes,
				regels: lines.map(function (line) { return { id: line.id, variant: line.variant, aantal: line.qty, tekst: line.text || '' }; })
			}
		}).then(function (antwoord) {
			try {
				sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ id: antwoord.id, mail: antwoord.mail === true, nieuwsbrief: values.nieuwsbrief === 'ja', lines: lines, total: antwoord.totaal != null ? antwoord.totaal : total, tracked: false }));
			} catch (e) { /* zonder sessionStorage toont de bedanktpagina alleen de algemene tekst */ }
			cart.clear();
			location.href = form.dataset.thanks;
		}).catch(function (error) {
			sending = false;
			submitBtn.disabled = false;
			submitBtn.textContent = SUBMIT_LABEL;
			message.textContent = error.message + ' Je gegevens blijven staan.';
			message.className = 'checkout-msg checkout-msg-error';
		});
	});
}

// bedankt.html: toon wat er is aangevraagd en zet (één keer) de conversie klaar voor Ads/Analytics
export function initThanks() {
	const box = document.getElementById('thanks-order');
	if (!box) return;
	let order = null;
	try { order = JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY)); } catch (e) {}
	if (!order || !order.lines || !order.lines.length) return;

	// Vinkje voor de nieuwsbrief al aangezet: dan geen tweede aanmeldveld, maar een verwijzing naar de knop in de mail
	const newsletter = document.getElementById('thanks-newsletter');
	if (newsletter && order.nieuwsbrief && order.mail) {
		document.getElementById('thanks-newsletter-text').textContent = 'Je vinkte aan dat je op de hoogte wilt blijven. Bevestig dat met de knop in je bevestigingsmail; pas dan sta je op de lijst.';
		const form = newsletter.querySelector('form');
		if (form) form.remove();
	}

	document.getElementById('thanks-lines').innerHTML = linesHtml(order.lines, order.total);
	box.hidden = false;
	// Bestelnummer, en alleen als de ontvangstbevestiging echt is verstuurd ook dat het in je mail staat
	const number = document.getElementById('thanks-number');
	if (number && order.id) {
		number.innerHTML = 'Je bestelnummer is <strong>' + esc(order.id) + '</strong>.' + (order.mail ? ' Je krijgt ook een ontvangstbevestiging per mail.' : '');
		number.hidden = false;
	}

	if (!order.tracked) {
		track('generate_lead', { ecommerce: { transaction_id: order.id, currency: 'EUR', value: order.total, items: trackItems(order.lines) } });
		order.tracked = true;
		try { sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order)); } catch (e) {}
	}
}
