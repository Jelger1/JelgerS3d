// Webshop: filteren en sorteren. De keuzes staan in de URL (webshop.html?type=vaas&prijs=tot-10),
// zodat je een gefilterde weergave kunt delen of als landingspagina voor een advertentie kunt gebruiken.
import { openDialog, closeDialog, isOpen } from './dialog.js';
import { prefersReducedMotion, esc } from './util.js';

const GROUPS = ['type', 'collectie', 'materiaal', 'prijs'];
const SORT_PARAM = 'sorteer';
const mobile = window.matchMedia('(max-width: 900px)');

let form, grid, cards, sortSelect, heading, defaultHeading, defaultTitle;

function inputsOf(group) {
	return Array.from(form.querySelectorAll('input[name="' + group + '"]'));
}

function selected(group) {
	return inputsOf(group).filter(function (input) { return input.checked; });
}

// Past één kaart bij de gekozen waarden van één filtergroep?
function matchesGroup(card, group, chosen) {
	if (!chosen.length) return true;
	if (group === 'prijs') {
		if (card.dataset.price == null) return false;
		const price = Number(card.dataset.price);
		return chosen.some(function (input) {
			const min = input.dataset.min, max = input.dataset.max;
			return (min == null || price >= Number(min)) && (max == null || price < Number(max));
		});
	}
	const key = { type: 'type', collectie: 'collection', materiaal: 'material' }[group];
	return chosen.some(function (input) { return card.dataset[key] === input.value; });
}

function matches(card, except) {
	return GROUPS.every(function (group) {
		return group === except || matchesGroup(card, group, selected(group));
	});
}

function sortCards(list) {
	const mode = sortSelect.value;
	const byIndex = function (a, b) { return Number(a.dataset.index) - Number(b.dataset.index); };
	// Producten zonder prijs ("binnenkort") komen bij sorteren op prijs achteraan
	const price = function (card) { return card.dataset.price == null ? Infinity : Number(card.dataset.price); };
	if (mode === 'prijs-oplopend') return list.sort(function (a, b) { return price(a) - price(b) || byIndex(a, b); });
	if (mode === 'prijs-aflopend') return list.sort(function (a, b) { return (price(b) === Infinity ? -1 : price(b)) - (price(a) === Infinity ? -1 : price(a)) || byIndex(a, b); });
	if (mode === 'naam') return list.sort(function (a, b) { return a.dataset.name.localeCompare(b.dataset.name, 'nl'); });
	return list.sort(byIndex);
}

function render(animate) {
	let visible = 0;
	cards.forEach(function (card) {
		const show = matches(card);
		// Kaarten die erbij komen faden kort in. Bewust een gewone CSS-animatie en geen View Transition:
		// die blokkeert klikken zolang hij loopt, waardoor een snelle tweede filterklik verloren ging.
		if (animate && show && card.hidden) {
			card.classList.remove('is-entering');
			void card.offsetWidth;
			card.classList.add('is-entering');
		}
		card.hidden = !show;
		if (show) visible++;
	});
	sortCards(cards.slice()).forEach(function (card) { grid.appendChild(card); });

	// Aantallen per filteroptie: hoeveel producten blijven er over als je déze optie kiest?
	GROUPS.forEach(function (group) {
		inputsOf(group).forEach(function (input) {
			const count = cards.filter(function (card) { return matches(card, group) && matchesGroup(card, group, [input]); }).length;
			input.closest('.chip').querySelector('[data-facet-count]').textContent = count;
			input.disabled = count === 0 && !input.checked;
			input.closest('.chip').classList.toggle('is-empty', input.disabled);
		});
	});

	document.querySelectorAll('[data-count]').forEach(function (el) { el.textContent = visible; });
	document.querySelectorAll('[data-count-label]').forEach(function (el) { el.textContent = visible === 1 ? 'product' : 'producten'; });
	document.querySelector('[data-empty]').hidden = visible !== 0;
	grid.hidden = visible === 0;

	renderActive();
	renderHeading();
}

// Rij met gekozen filters, elk los te verwijderen
function renderActive() {
	const active = GROUPS.flatMap(function (group) { return selected(group); });
	const bar = document.querySelector('[data-active]');
	const badge = document.querySelector('[data-filter-badge]');
	badge.hidden = active.length === 0;
	badge.textContent = active.length;
	bar.hidden = active.length === 0;
	bar.innerHTML = active.map(function (input) {
		const label = input.nextElementSibling.firstChild.textContent.trim();
		return '<button type="button" class="active-chip" data-remove="' + esc(input.name) + ':' + esc(input.value) + '" aria-label="Filter ' + esc(label) + ' verwijderen">' + esc(label) + ' <span aria-hidden="true">✕</span></button>';
	}).join('') + (active.length > 1 ? '<button type="button" class="btn-text" data-filter-reset>Wis alles</button>' : '');
}

// Precies één type gekozen: kop en paginatitel sluiten aan op die categorie (relevant voor advertenties)
function renderHeading() {
	const types = selected('type');
	if (types.length === 1) {
		heading.innerHTML = types[0].dataset.heading;
		document.title = types[0].dataset.title + ' | JelgerS3D webshop';
	} else {
		heading.innerHTML = defaultHeading;
		document.title = defaultTitle;
	}
}

function writeUrl() {
	const params = new URLSearchParams();
	GROUPS.forEach(function (group) {
		const values = selected(group).map(function (input) { return input.value; });
		if (values.length) params.set(group, values.join(','));
	});
	if (sortSelect.value) params.set(SORT_PARAM, sortSelect.value);
	const query = params.toString();
	history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
}

function readUrl() {
	const params = new URLSearchParams(location.search);
	GROUPS.forEach(function (group) {
		const values = (params.get(group) || '').split(',');
		inputsOf(group).forEach(function (input) { input.checked = values.indexOf(input.value) !== -1; });
	});
	const sort = params.get(SORT_PARAM) || '';
	sortSelect.value = Array.from(sortSelect.options).some(function (o) { return o.value === sort; }) ? sort : '';
}

function update() {
	writeUrl();
	render(!prefersReducedMotion);
}

function reset() {
	GROUPS.forEach(function (group) { inputsOf(group).forEach(function (input) { input.checked = false; }); });
	update();
}

// Op mobiel is het filterformulier een paneel dat van onderen inschuift
function initSheet() {
	const toggle = document.querySelector('[data-filter-open]');
	const backdrop = document.querySelector('.shop-filters-backdrop');

	function sync() {
		if (mobile.matches) {
			if (!isOpen(form)) { form.setAttribute('aria-hidden', 'true'); form.setAttribute('inert', ''); }
		} else {
			if (isOpen(form)) closeDialog(form);
			form.removeAttribute('aria-hidden');
			form.removeAttribute('inert');
		}
	}

	toggle.addEventListener('click', function () {
		backdrop.classList.add('is-open');
		toggle.setAttribute('aria-expanded', 'true');
		openDialog(form, {
			onClose: function () {
				backdrop.classList.remove('is-open');
				toggle.setAttribute('aria-expanded', 'false');
			}
		});
	});
	document.querySelectorAll('[data-filter-close]').forEach(function (el) {
		el.addEventListener('click', function () { closeDialog(form); });
	});
	mobile.addEventListener('change', sync);
	sync();
}

export function initShop() {
	form = document.getElementById('shop-filters');
	grid = document.getElementById('product-grid');
	if (!form || !grid) return;
	cards = Array.from(grid.children);
	sortSelect = document.querySelector('[data-sort]');
	heading = document.querySelector('[data-shop-heading]');
	defaultHeading = heading.innerHTML;
	defaultTitle = document.title;

	readUrl();
	render(false); // eerste weergave zonder animatie

	form.addEventListener('change', update);
	form.addEventListener('submit', function (event) { event.preventDefault(); });
	sortSelect.addEventListener('change', update);
	document.addEventListener('click', function (event) {
		if (event.target.closest('[data-filter-reset]')) { reset(); return; }
		const remove = event.target.closest('[data-remove]');
		if (!remove) return;
		const parts = remove.dataset.remove.split(':');
		const input = inputsOf(parts[0]).find(function (i) { return i.value === parts[1]; });
		if (input) { input.checked = false; update(); }
	});

	initSheet();
}
