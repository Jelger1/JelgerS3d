// afrekenen.html: overzicht van de winkelwagen, validatie en het versturen van de aanvraag (Web3Forms).
// Na succes gaat de bezoeker naar bedankt.html; de bestelling reist mee via sessionStorage.
import * as cart from './cart.js';
import { esc, euro, sendForm, track, trackItems } from './util.js';
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

function orderText(values, lines, total) {
	return 'BESTELLING VIA JELGERS3D.NL\n\n'
		+ 'Producten:\n' + lines.map(function (line) {
			return line.qty + '× ' + line.fullName + ' — ' + euro(line.lineTotal) + (line.qty > 1 ? ' (' + euro(line.price) + ' per stuk)' : '')
				+ (line.text ? '\n   TEKST OP HET PRODUCT: ' + line.text : '');
		}).join('\n')
		+ '\n\nTotaal: ' + euro(total) + '\n\n'
		+ 'Klantgegevens:\n'
		+ 'Naam: ' + values.name + '\n'
		+ 'Email: ' + values.email + '\n'
		+ 'Telefoon: ' + values.phone + '\n'
		+ 'Levering: ' + (values.delivery === 'Ophalen' ? 'Zelf ophalen in Kerkrade' : values.delivery) + '\n'
		+ (values.delivery === 'Ophalen' ? '' : 'Adres: ' + values.address + '\n'
			+ 'Postcode: ' + values.postcode + '\n'
			+ 'Plaats: ' + values.city + '\n'
			+ 'Land: ' + values.country + '\n')
		+ (values.notes ? '\nOpmerkingen: ' + values.notes + '\n' : '')
		+ (values.privacy ? '\nAkkoord met algemene voorwaarden en privacyverklaring: ja, op ' + new Date().toLocaleString('nl-NL') + '\n' : '');
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

		const data = new FormData();
		data.append('access_key', form.dataset.accessKey);
		data.append('subject', 'Nieuwe bestelling JelgerS3D — ' + cart.count() + ' item(s), ' + euro(total));
		data.append('from_name', 'JelgerS3D Webshop');
		data.append('name', values.name);
		data.append('email', values.email);
		data.append('message', orderText(values, lines, total));
		if (form.elements.botcheck.checked) data.append('botcheck', 'true');

		sending = true;
		submitBtn.disabled = true;
		submitBtn.textContent = 'Verzenden...';
		message.textContent = '';
		message.className = 'checkout-msg';

		sendForm(data).then(function (ok) {
			if (!ok) throw new Error('afgewezen');
			try {
				sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ id: 'JS3D-' + Date.now().toString(36).toUpperCase(), lines: lines, total: total, tracked: false }));
			} catch (e) { /* zonder sessionStorage toont de bedanktpagina alleen de algemene tekst */ }
			cart.clear();
			location.href = form.dataset.thanks;
		}).catch(function (error) {
			sending = false;
			submitBtn.disabled = false;
			submitBtn.textContent = SUBMIT_LABEL;
			message.textContent = error.message === 'afgewezen'
				? 'Er ging iets mis bij het versturen. Probeer het opnieuw.'
				: 'Geen verbinding. Controleer je internet en probeer het opnieuw. Je gegevens blijven staan.';
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

	document.getElementById('thanks-lines').innerHTML = linesHtml(order.lines, order.total);
	box.hidden = false;

	if (!order.tracked) {
		track('generate_lead', { ecommerce: { transaction_id: order.id, currency: 'EUR', value: order.total, items: trackItems(order.lines) } });
		order.tracked = true;
		try { sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order)); } catch (e) {}
	}
}
