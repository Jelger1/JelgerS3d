// Algemene interface: mobiel menu, uitklapblokken en subtiele scroll-animaties.
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

function initToggles() {
	document.querySelectorAll('[data-toggle]').forEach(function (button) {
		const target = document.getElementById(button.dataset.toggle);
		if (!target) return;
		button.addEventListener('click', function () {
			const open = target.classList.toggle('show');
			button.setAttribute('aria-expanded', open ? 'true' : 'false');
			button.textContent = open ? button.dataset.labelClose : button.dataset.labelOpen;
		});
	});
}

function initReveal() {
	const elements = document.querySelectorAll('.services, .showcase, .contact, .pdp-details, .pdp-related');
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

export function initUi() {
	initNav();
	initToggles();
	initReveal();
}
