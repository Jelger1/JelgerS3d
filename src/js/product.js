// Productpagina: galerij, variantkeuze met live prijs, toevoegen en de mobiele koopbalk.
import { addAndShow } from './cart-ui.js';
import { openLightbox } from './lightbox.js';
import { euro, prefersReducedMotion } from './util.js';

function initGallery() {
	const gallery = document.querySelector('[data-gallery]');
	if (!gallery) return;
	const track = gallery.querySelector('[data-slides]');
	const slides = Array.from(track.children);
	const thumbs = Array.from(gallery.querySelectorAll('[data-slide]'));

	function setActive(index) {
		thumbs.forEach(function (thumb, i) {
			thumb.classList.toggle('is-active', i === index);
			if (i === index) thumb.setAttribute('aria-current', 'true');
			else thumb.removeAttribute('aria-current');
		});
	}

	thumbs.forEach(function (thumb) {
		thumb.addEventListener('click', function () {
			const slide = slides[Number(thumb.dataset.slide)];
			track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
		});
	});

	// De actieve thumbnail volgt het swipen
	if (thumbs.length && 'IntersectionObserver' in window) {
		const observer = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) setActive(slides.indexOf(entry.target));
			});
		}, { root: track, threshold: 0.6 });
		slides.forEach(function (slide) { observer.observe(slide); });
	}

	const zoomButtons = Array.from(gallery.querySelectorAll('[data-zoom]'));
	const photos = zoomButtons.map(function (button) { return { src: button.dataset.full, alt: button.dataset.alt }; });
	const heading = document.querySelector('.pdp-title');
	zoomButtons.forEach(function (button) {
		button.addEventListener('click', function () {
			openLightbox(photos, Number(button.dataset.zoom), heading ? heading.textContent : '');
		});
	});
}

function initBuyForm() {
	const form = document.querySelector('.pdp-form');
	if (!form) return;
	const priceEl = document.getElementById('pdp-price');
	const sticky = document.querySelector('[data-sticky]');
	const stickyPrice = sticky ? sticky.querySelector('[data-sticky-price]') : null;

	function selectedVariant() {
		const field = form.elements.variant;
		return field.value;
	}

	form.addEventListener('change', function (event) {
		if (event.target.name !== 'variant') return;
		const label = euro(event.target.dataset.price);
		priceEl.textContent = label;
		if (stickyPrice) stickyPrice.textContent = label;
	});

	// Bij meerdere varianten toont de pagina eerst "Vanaf"; zet de prijs van de voorgeselecteerde variant
	const checked = form.querySelector('input[name="variant"]:checked');
	if (checked) {
		priceEl.textContent = euro(checked.dataset.price);
		if (stickyPrice) stickyPrice.textContent = euro(checked.dataset.price);
	}

	form.addEventListener('submit', function (event) {
		event.preventDefault();
		addAndShow(form.dataset.product, selectedVariant());
	});

	// Mobiele koopbalk: zichtbaar zolang de echte knop niet in beeld is. Dus ook direct bij
	// binnenkomst, zodat prijs en koopknop op een telefoon altijd zonder scrollen te zien zijn.
	if (sticky && 'IntersectionObserver' in window) {
		sticky.querySelector('[data-sticky-add]').addEventListener('click', function () {
			addAndShow(form.dataset.product, selectedVariant());
		});
		new IntersectionObserver(function (entries) {
			sticky.hidden = entries[0].isIntersecting;
		}).observe(form.querySelector('.pdp-add'));
	}
}

export function initProduct() {
	initGallery();
	initBuyForm();
}
