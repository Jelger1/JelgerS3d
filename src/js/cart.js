// Winkelwagen-opslag. Bewaart alleen product, variant en aantal in localStorage;
// naam en prijs komen altijd vers uit de catalogus (catalog.js wordt door de build gegenereerd).
import catalog from './catalog.js';

const STORAGE_KEY = 'js3d-cart-v1';
const MAX_QTY = 99;
const listeners = new Set();

let items = load();

function findVariant(id, variantId) {
	const product = catalog[id];
	if (!product || product.sale !== 'cart') return null;
	return product.variants.find(function (v) { return v.id === variantId; }) || null;
}

function load() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
		// Producten die niet meer bestaan of niet meer te koop zijn vallen er vanzelf uit
		return saved.filter(function (item) {
			return item && findVariant(item.id, item.variant) && item.qty >= 1;
		}).map(function (item) {
			return { id: item.id, variant: item.variant, qty: Math.min(MAX_QTY, Math.floor(item.qty)) };
		});
	} catch (e) {
		return [];
	}
}

function save() {
	try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { /* privémodus: alleen in geheugen */ }
	notify();
}

function notify() {
	listeners.forEach(function (fn) { fn(); });
}

function find(id, variantId) {
	return items.find(function (item) { return item.id === id && item.variant === variantId; });
}

export function add(id, variantId, qty) {
	if (!findVariant(id, variantId)) return false;
	const existing = find(id, variantId);
	if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + (qty || 1));
	else items.push({ id: id, variant: variantId, qty: Math.min(MAX_QTY, qty || 1) });
	save();
	return true;
}

export function setQty(id, variantId, qty) {
	const existing = find(id, variantId);
	if (!existing) return;
	if (qty <= 0) items = items.filter(function (item) { return item !== existing; });
	else existing.qty = Math.min(MAX_QTY, Math.floor(qty));
	save();
}

export function remove(id, variantId) {
	setQty(id, variantId, 0);
}

export function clear() {
	items = [];
	save();
}

// Regels met alle weergavegegevens erbij
export function getLines() {
	return items.map(function (item) {
		const product = catalog[item.id];
		const variant = findVariant(item.id, item.variant);
		return {
			id: item.id,
			variant: item.variant,
			qty: item.qty,
			name: product.name,
			label: variant.label,
			fullName: product.name + (variant.label ? ' – ' + variant.label : ''),
			price: variant.price,
			lineTotal: variant.price * item.qty,
			image: product.image,
			url: product.url
		};
	});
}

export function count() {
	return items.reduce(function (sum, item) { return sum + item.qty; }, 0);
}

export function total() {
	return getLines().reduce(function (sum, line) { return sum + line.lineTotal; }, 0);
}

export function subscribe(fn) {
	listeners.add(fn);
	return function () { listeners.delete(fn); };
}

export function productName(id, variantId) {
	const variant = findVariant(id, variantId);
	return variant ? catalog[id].name + (variant.label ? ' – ' + variant.label : '') : '';
}

// Houd meerdere tabbladen gelijk
window.addEventListener('storage', function (event) {
	if (event.key !== STORAGE_KEY) return;
	items = load();
	notify();
});
