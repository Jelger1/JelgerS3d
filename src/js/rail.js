// Horizontale productrails: het scrollen en swipen doet CSS (scroll-snap),
// dit script voegt alleen de vorige/volgende-knoppen toe.
import { prefersReducedMotion } from './util.js';

export function initRails() {
	document.querySelectorAll('[data-rail]').forEach(function (rail) {
		const track = rail.querySelector('[data-rail-track]');
		const prev = rail.querySelector('[data-rail-prev]');
		const next = rail.querySelector('[data-rail-next]');

		function step(direction) {
			const card = track.firstElementChild;
			const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
			const distance = card ? (card.offsetWidth + gap) * Math.max(1, Math.floor(track.clientWidth / (card.offsetWidth + gap))) : track.clientWidth;
			track.scrollBy({ left: direction * distance, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
		}

		function update() {
			const max = track.scrollWidth - track.clientWidth;
			prev.disabled = track.scrollLeft <= 8;
			next.disabled = track.scrollLeft >= max - 8;
			rail.classList.toggle('is-static', max <= 2);
		}

		prev.addEventListener('click', function () { step(-1); });
		next.addEventListener('click', function () { step(1); });
		track.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		update();
	});
}
