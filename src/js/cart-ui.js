// De winkelwagen-zijbalk: tonen, aantallen aanpassen, feedback na toevoegen.
import * as cart from './cart.js';
import { openDialog, closeDialog } from './dialog.js';
import { openCheckout } from './checkout.js';
import { esc, euro } from './util.js';

const root = document.body.dataset.root || '';
const sidebar = document.getElementById('cart-sidebar');
const overlay = document.getElementById('cart-overlay');
const toggle = document.getElementById('cart-toggle');
const itemsEl = document.getElementById('cart-items');
const countEl = document.getElementById('cart-count');
const totalEl = document.getElementById('cart-total-price');
const addedEl = document.getElementById('cart-added');
const checkoutBtn = document.getElementById('cart-checkout');

let highlightKey = null;

function lineKey(line) { return line.id + ':' + line.variant; }

function render() {
	const lines = cart.getLines();
	const count = cart.count();

	countEl.textContent = count;
	countEl.hidden = count === 0;
	toggle.setAttribute('aria-label', 'Winkelwagen openen, ' + count + (count === 1 ? ' artikel' : ' artikelen'));
	totalEl.textContent = euro(cart.total());
	checkoutBtn.disabled = lines.length === 0;

	if (!lines.length) {
		itemsEl.innerHTML = '<div class="cart-empty"><p>Je winkelwagen is nog leeg.</p>'
			+ '<p><a class="btn outline" href="' + root + 'webshop.html">Bekijk de webshop</a></p></div>';
		return;
	}

	itemsEl.innerHTML = '<ul class="cart-list">' + lines.map(function (line) {
		const key = lineKey(line);
		return '<li class="cart-item' + (key === highlightKey ? ' is-new' : '') + '" data-id="' + esc(line.id) + '" data-variant="' + esc(line.variant) + '">'
			+ '<a href="' + root + esc(line.url) + '" tabindex="-1" aria-hidden="true"><img src="' + root + esc(line.image) + '" alt="" class="cart-item-image" width="64" height="64" loading="lazy"></a>'
			+ '<div class="cart-item-info">'
			+ '<h3><a href="' + root + esc(line.url) + '">' + esc(line.name) + '</a></h3>'
			+ (line.label ? '<p class="cart-item-variant">' + esc(line.label) + '</p>' : '')
			+ '<div class="cart-item-row">'
			+ '<div class="qty" role="group" aria-label="Aantal ' + esc(line.fullName) + '">'
			+ '<button type="button" class="qty-btn" data-qty="-1" aria-label="Eén minder">−</button>'
			+ '<span class="qty-value" aria-live="polite">' + line.qty + '</span>'
			+ '<button type="button" class="qty-btn" data-qty="1" aria-label="Eén meer">+</button>'
			+ '</div>'
			+ '<p class="cart-item-price">' + euro(line.lineTotal) + '</p>'
			+ '</div></div>'
			+ '<button type="button" class="cart-item-remove" data-remove aria-label="Verwijder ' + esc(line.fullName) + '">✕</button>'
			+ '</li>';
	}).join('') + '</ul>';
}

export function openCart() {
	overlay.setAttribute('aria-hidden', 'false');
	toggle.setAttribute('aria-expanded', 'true');
	openDialog(sidebar, {
		onClose: function () {
			overlay.setAttribute('aria-hidden', 'true');
			toggle.setAttribute('aria-expanded', 'false');
			addedEl.hidden = true;
			highlightKey = null;
		}
	});
}

export function closeCart() {
	closeDialog(sidebar);
}

// Toevoegen + directe feedback: de zijbalk opent met het nieuwe artikel uitgelicht
// en de keuze "Verder winkelen" of "Bestelling afronden".
export function addAndShow(id, variantId) {
	highlightKey = id + ':' + variantId;
	if (!cart.add(id, variantId, 1)) return;
	addedEl.textContent = '✓ ' + cart.productName(id, variantId) + ' is toegevoegd';
	addedEl.hidden = false;
	openCart();

	toggle.classList.remove('is-bumped');
	void toggle.offsetWidth; // herstart de animatie
	toggle.classList.add('is-bumped');
}

export function initCartUi() {
	if (!sidebar) return;
	cart.subscribe(render);
	render();

	toggle.addEventListener('click', openCart);
	overlay.addEventListener('click', closeCart);
	document.getElementById('cart-close').addEventListener('click', closeCart);
	document.getElementById('cart-continue').addEventListener('click', closeCart);
	checkoutBtn.addEventListener('click', function () {
		if (cart.count() > 0) openCheckout();
	});

	itemsEl.addEventListener('click', function (event) {
		const item = event.target.closest('.cart-item');
		if (!item) return;
		const id = item.dataset.id, variant = item.dataset.variant;
		const qtyBtn = event.target.closest('[data-qty]');
		if (qtyBtn) {
			const line = cart.getLines().find(function (l) { return l.id === id && l.variant === variant; });
			if (line) cart.setQty(id, variant, line.qty + Number(qtyBtn.dataset.qty));
			// Na het hertekenen de focus op dezelfde knop houden
			const again = itemsEl.querySelector('.cart-item[data-id="' + id + '"][data-variant="' + variant + '"] [data-qty="' + qtyBtn.dataset.qty + '"]');
			(again || document.getElementById('cart-close')).focus();
		} else if (event.target.closest('[data-remove]')) {
			cart.remove(id, variant);
			document.getElementById('cart-close').focus();
		}
	});

	// "In winkelwagen"-knoppen op productkaarten (overal op de site)
	document.addEventListener('click', function (event) {
		const button = event.target.closest('[data-add]');
		if (!button) return;
		addAndShow(button.dataset.add, button.dataset.variant);
	});
}
