// Paginaovergang in de huisstijl: bij een klik op een link naar een andere pagina van de site schuiven drie banden
// (raspberry, aqua, Midnight Slate) schuin over het scherm en valt het JS-teken in elkaar. Pas dan gaat de browser
// naar de nieuwe pagina, die achter hetzelfde doek begint (zie het scriptje in de <head>, layout.js) en het weer
// wegschuift. De opmaak staat in src/partials/curtain.html en src/css/brand.css.
import { prefersReducedMotion } from './util.js';

const VANGNET_MS = 1100; // als het einde van de animatie niet gemeld wordt, toch doorgaan
const AANKOMST_MS = 1600;

function isPaginaLink(event, link) {
	if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
	if ((link.target && link.target !== '_self') || link.hasAttribute('download') || link.hasAttribute('data-no-transition')) return false;
	const url = new URL(link.href, location.href);
	if (url.origin !== location.origin) return false;
	if (url.pathname === location.pathname && url.search === location.search) return false; // zelfde pagina, ook #anker
	return /(\/|\.html)$/.test(url.pathname); // alleen pagina's, geen bestanden
}

function vertrek(href) {
	const html = document.documentElement;
	try { sessionStorage.setItem('pc', String(Date.now())); } catch (e) { /* privévenster: dan alleen het vertrek */ }
	html.classList.remove('pc-arriving');
	html.classList.add('pc-leaving');
	let weg = false;
	function ga() {
		if (weg) return;
		weg = true;
		location.href = href;
	}
	const laatste = document.querySelector('.pc-band-3');
	if (laatste) laatste.addEventListener('animationend', ga, { once: true });
	setTimeout(ga, VANGNET_MS);
}

export function initTransition() {
	const html = document.documentElement;
	if (html.classList.contains('pc-arriving')) setTimeout(function () { html.classList.remove('pc-arriving'); }, AANKOMST_MS);
	// Terug met de knop van de browser: de vorige pagina kan nog met het doek ervoor in het geheugen staan
	window.addEventListener('pageshow', function (event) { if (event.persisted) html.classList.remove('pc-leaving', 'pc-arriving'); });
	if (prefersReducedMotion || !document.querySelector('.page-curtain')) return;

	// Als laatste geregistreerd (main.js), zodat andere klik-afhandelingen eerst hun preventDefault kunnen doen
	document.addEventListener('click', function (event) {
		const link = event.target.closest('a[href]');
		if (!link || !isPaginaLink(event, link)) return;
		event.preventDefault();
		vertrek(link.href);
	});
}
