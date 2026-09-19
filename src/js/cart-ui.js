// De winkelwagen-zijbalk: tonen, aantallen aanpassen, feedback na toevoegen en suggesties ("Maak het compleet").
import * as cart from './cart.js';
import catalog from './catalog.js';
import { openDialog, closeDialog } from './dialog.js';
import { esc, euro, track } from './util.js';

const root = document.body.dataset.root || '';
const sidebar = document.getElementById('cart-sidebar');
const overlay = document.getElementById('cart-overlay');
const toggle = document.getElementById('cart-toggle');
const itemsEl = document.getElementById('cart-items');
const countEl = document.getElementById('cart-count');
const totalEl = document.getElementById('cart-total-price');
const addedEl = document.getElementById('cart-added');
const checkoutBtn = document.getElementById('cart-checkout');
const suggestEl = document.getElementById('cart-suggest');
const suggestList = document.getElementById('cart-suggest-list');
const MAX_SUGGESTIONS = 2;
const ADDON_MAX = 15;

let highlightKey = null;

function lineKey(line) { return line.id + ':' + line.variant; }

function render() {
	const lines = cart.getLines();
	const count = cart.count();

	countEl.textContent = count;
	countEl.hidden = count === 0;
	toggle.setAttribute('aria-label', 'Winkelwagen openen, ' + count + (count === 1 ? ' artikel' : ' artikelen'));
	totalEl.textContent = euro(cart.total());
	checkoutBtn.hidden = lines.length === 0;
	renderSuggestions(lines);

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

// Suggesties zijn kleine extra's die je er makkelijk bij neemt (tot ADDON_MAX euro), niet nóg een vaas van €35.
// Eerst wat bij de artikelen in de wagen past ("related" in products.json), daarna de voordeligste.
// Alleen producten die je met één klik kunt toevoegen (dus zonder variantkeuze).
function renderSuggestions(lines) {
	const inCart = new Set(lines.map(function (line) { return line.id; }));
	const price = function (id) { return catalog[id].variants[0].price; };
	const isAddon = function (id) {
		const p = catalog[id];
		return p && p.sale === 'cart' && p.variants.length === 1 && !inCart.has(id) && price(id) <= ADDON_MAX;
	};
	const related = lines.flatMap(function (line) { return catalog[line.id].related; });
	const cheapest = Object.keys(catalog).filter(isAddon).sort(function (a, b) { return price(a) - price(b); });
	const picks = Array.from(new Set(related.concat(cheapest))).filter(isAddon).slice(0, MAX_SUGGESTIONS);

	suggestEl.hidden = lines.length === 0 || picks.length === 0;
	suggestList.innerHTML = picks.map(function (id) {
		const p = catalog[id];
		return '<li class="cart-suggest-item">'
			+ '<img src="' + root + esc(p.image) + '" alt="" width="48" height="60" loading="lazy">'
			+ '<div><a href="' + root + esc(p.url) + '">' + esc(p.name) + '</a><span>' + euro(p.variants[0].price) + '</span></div>'
			+ '<button type="button" class="cart-suggest-add" data-add="' + esc(id) + '" data-variant="' + esc(p.variants[0].id) + '" data-source="suggestie" aria-label="' + esc(p.name) + ' toevoegen">+</button>'
			+ '</li>';
	}).join('');
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
export function addAndShow(id, variantId, source) {
	highlightKey = id + ':' + variantId;
	if (!cart.add(id, variantId, 1)) return;
	const added = cart.getLines().find(function (line) { return line.id === id && line.variant === variantId; });
	track('add_to_cart', { source: source || 'product', ecommerce: { currency: 'EUR', value: added.price, items: [{ item_id: id, item_name: added.name, item_variant: added.label || undefined, price: added.price, quantity: 1 }] } });
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
	document.querySelectorAll('[data-open-cart]').forEach(function (button) { button.addEventListener('click', openCart); });

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
		addAndShow(button.dataset.add, button.dataset.variant, button.dataset.source || 'kaart');
	});
}
