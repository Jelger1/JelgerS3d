// Algemene interface: mobiel menu, seizoensmelding en subtiele scroll-animaties.
import { prefersReducedMotion } from './util.js';

function initNav() {
	const toggle = document.querySelector('.nav-toggle');
	const nav = document.getElementById('main-nav');
	if (!toggle || !nav) return;

	function setOpen(open) {
		nav.classList.toggle('show', open);
		toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
	}

	toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('show')); });
	nav.addEventListener('click', function (event) { if (event.target.closest('a')) setOpen(false); });
	document.addEventListener('keydown', function (event) {
		if (event.key === 'Escape' && nav.classList.contains('show')) { setOpen(false); toggle.focus(); }
	});
}

function initReveal() {
	const elements = document.querySelectorAll('.section, .pdp-details, .pdp-related');
	if (prefersReducedMotion || !('IntersectionObserver' in window) || !elements.length) return;

	const observer = new IntersectionObserver(function (entries) {
		entries.forEach(function (entry) {
			if (!entry.isIntersecting) return;
			entry.target.classList.add('is-revealed');
			observer.unobserve(entry.target);
		});
	}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

	elements.forEach(function (el) {
		// Wat al in beeld staat hoeft niet in te faden
		if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
		el.classList.add('reveal');
		observer.observe(el);
	});
}

// Seizoensmelding ("Op tijd voor Kerst? Bestel uiterlijk ..."). Eerlijke urgentie: de data komen uit
// site.json > deadlines, de melding verschijnt pas vanaf "showFrom" en verdwijnt vanzelf na "orderBefore".
// Bewust in de browser berekend: zo klopt hij ook als de site een tijd niet opnieuw is gebouwd.
function initDeadlines() {
	const now = new Date();
	const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
	document.querySelectorAll('[data-deadlines]').forEach(function (el) {
		let list = [];
		try { list = JSON.parse(el.dataset.deadlines); } catch (e) {}
		const active = list.find(function (d) { return today >= d.showFrom && today <= d.orderBefore; });
		if (!active) return;
		const date = new Date(active.orderBefore + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
		el.textContent = 'Op tijd voor ' + active.occasion + '? Bestel uiterlijk ' + date + '.';
		el.hidden = false;
	});
}

export function initUi() {
	initNav();
	initReveal();
	initDeadlines();
}
