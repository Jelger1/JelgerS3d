// Winkelwagen-opslag. Bewaart alleen product, variant, aantal en een eventuele persoonlijke tekst in localStorage;
// naam en prijs komen altijd vers uit de catalogus (catalog.js wordt door de build gegenereerd).
import catalog from './catalog.js';

const STORAGE_KEY = 'js3d-cart-v1';
const MAX_QTY = 99;
const MAX_TEXT = 40;
const listeners = new Set();

let items = load();

function findVariant(id, variantId) {
	const product = catalog[id];
	if (!product || product.sale !== 'cart') return null;
	return product.variants.find(function (v) { return v.id === variantId; }) || null;
}

// Persoonlijke tekst (bv. de straatnaam op een sleutelhanger): alleen bij producten met "personalize", en dan verplicht
function cleanText(id, text) {
	const product = catalog[id];
	if (!product || !product.personalize) return '';
	return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
}

function isValid(item) {
	if (!item || !findVariant(item.id, item.variant) || !(item.qty >= 1)) return false;
	return !catalog[item.id].personalize || Boolean(cleanText(item.id, item.text));
}

// Een regel is uniek per product + variant + tekst: "Abtenlaan" en "Dorpsstraat" zijn twee regels
export function keyOf(item) {
	return item.id + '|' + item.variant + '|' + (item.text || '');
}

function load() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
		// Producten die niet meer bestaan of niet meer te koop zijn vallen er vanzelf uit
		return saved.filter(isValid).map(function (item) {
			return { id: item.id, variant: item.variant, qty: Math.min(MAX_QTY, Math.floor(item.qty)), text: cleanText(item.id, item.text) };
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

function findByKey(key) {
	return items.find(function (item) { return keyOf(item) === key; });
}

// Geeft de sleutel van de regel terug, of null als toevoegen niet kan
export function add(id, variantId, qty, text) {
	const item = { id: id, variant: variantId, qty: Math.min(MAX_QTY, qty || 1), text: cleanText(id, text) };
	if (!isValid(item)) return null;
	const existing = findByKey(keyOf(item));
	if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + item.qty);
	else items.push(item);
	save();
	return keyOf(item);
}

export function setQty(key, qty) {
	const existing = findByKey(key);
	if (!existing) return;
	if (qty <= 0) items = items.filter(function (item) { return item !== existing; });
	else existing.qty = Math.min(MAX_QTY, Math.floor(qty));
	save();
}

export function remove(key) {
	setQty(key, 0);
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
		const details = [variant.label, item.text ? '“' + item.text + '”' : ''].filter(Boolean).join(' · ');
		return {
			key: keyOf(item),
			id: item.id,
			variant: item.variant,
			qty: item.qty,
			text: item.text,
			name: product.name,
			label: details,
			fullName: product.name + (details ? ' – ' + details : ''),
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

// Houd meerdere tabbladen gelijk
window.addEventListener('storage', function (event) {
	if (event.key !== STORAGE_KEY) return;
	items = load();
	notify();
});
