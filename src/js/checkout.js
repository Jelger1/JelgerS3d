// Bestelaanvraag: overzicht tonen en het formulier versturen via Web3Forms.
import * as cart from './cart.js';
import { openDialog, closeDialog } from './dialog.js';
import { esc, euro, sendForm } from './util.js';

const overlay = document.getElementById('checkout-overlay');
const form = document.getElementById('checkout-form');
const summary = document.getElementById('checkout-summary');
const message = document.getElementById('checkout-msg');
const success = document.getElementById('checkout-success');
const banner = overlay ? overlay.querySelector('.checkout-info-banner') : null;
const submitBtn = document.getElementById('checkout-submit');
const SUBMIT_LABEL = submitBtn ? submitBtn.textContent : '';

function showForm(visible) {
	form.hidden = !visible;
	summary.hidden = !visible;
	banner.hidden = !visible;
	success.hidden = visible;
}

function renderSummary() {
	summary.innerHTML = '<h3>Jouw bestelling</h3>'
		+ cart.getLines().map(function (line) {
			return '<div class="checkout-item"><span>' + line.qty + '× ' + esc(line.fullName) + '</span><span>' + euro(line.lineTotal) + '</span></div>';
		}).join('')
		+ '<div class="checkout-item checkout-item-total"><strong>Totaal</strong><strong>' + euro(cart.total()) + '</strong></div>';
}

export function openCheckout() {
	if (!overlay) return;
	renderSummary();
	showForm(true);
	message.textContent = '';
	message.className = 'checkout-msg';
	openDialog(overlay, { initialFocus: document.getElementById('checkout-name') });
}

function closeCheckout() {
	closeDialog(overlay);
}

function orderText(values) {
	const lines = cart.getLines().map(function (line) {
		return line.qty + '× ' + line.fullName + ' — ' + euro(line.lineTotal) + (line.qty > 1 ? ' (' + euro(line.price) + ' per stuk)' : '');
	});
	return 'BESTELLING VIA JELGERS3D.NL\n\n'
		+ 'Producten:\n' + lines.join('\n') + '\n\nTotaal: ' + euro(cart.total()) + '\n\n'
		+ 'Klantgegevens:\n'
		+ 'Naam: ' + values.name + '\n'
		+ 'Email: ' + values.email + '\n'
		+ 'Telefoon: ' + values.phone + '\n'
		+ 'Adres: ' + values.address + '\n'
		+ 'Postcode: ' + values.postcode + '\n'
		+ 'Plaats: ' + values.city + '\n'
		+ (values.notes ? '\nOpmerkingen: ' + values.notes + '\n' : '');
}

export function initCheckout() {
	if (!overlay || !form) return;

	document.getElementById('checkout-close').addEventListener('click', closeCheckout);
	overlay.addEventListener('click', function (event) { if (event.target === overlay) closeCheckout(); });
	document.getElementById('checkout-success-close').addEventListener('click', function () {
		closeCheckout();
		closeDialog(document.getElementById('cart-sidebar'));
	});

	form.addEventListener('submit', function (event) {
		event.preventDefault();
		if (cart.count() === 0) return;

		const values = {};
		new FormData(form).forEach(function (value, key) { values[key] = String(value).trim(); });

		const data = new FormData();
		data.append('access_key', form.dataset.accessKey);
		data.append('subject', 'Nieuwe bestelling JelgerS3D — ' + cart.count() + ' item(s)');
		data.append('from_name', 'JelgerS3D Webshop');
		data.append('name', values.name);
		data.append('email', values.email);
		data.append('message', orderText(values));

		submitBtn.disabled = true;
		submitBtn.textContent = 'Verzenden...';
		message.textContent = '';

		sendForm(data).then(function (ok) {
			if (!ok) throw new Error('afgewezen');
			form.reset();
			cart.clear();
			showForm(false);
			document.getElementById('checkout-success-close').focus();
		}).catch(function (error) {
			message.textContent = error.message === 'afgewezen'
				? 'Er ging iets mis. Probeer het opnieuw.'
				: 'Verbindingsfout. Controleer je internet en probeer opnieuw.';
			message.className = 'checkout-msg checkout-msg-error';
		}).finally(function () {
			submitBtn.disabled = false;
			submitBtn.textContent = SUBMIT_LABEL;
		});
	});
}
