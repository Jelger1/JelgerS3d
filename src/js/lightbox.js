// Fotoviewer voor de productgalerij (pijltjestoetsen, vorige/volgende, teller).
import { openDialog, closeDialog, isOpen } from './dialog.js';

const modal = document.getElementById('modal');
const image = document.getElementById('modal-image');
const title = document.getElementById('modal-title');
const counter = document.getElementById('modal-counter');
const prevBtn = document.getElementById('modal-prev');
const nextBtn = document.getElementById('modal-next');

let photos = [];
let index = 0;

function show() {
	const photo = photos[index];
	image.src = photo.src;
	image.alt = photo.alt;
	const many = photos.length > 1;
	prevBtn.hidden = nextBtn.hidden = counter.hidden = !many;
	counter.textContent = (index + 1) + ' / ' + photos.length;
}

function step(delta) {
	if (photos.length < 2) return;
	index = (index + delta + photos.length) % photos.length;
	show();
}

// photos: [{ src, alt }]
export function openLightbox(list, startIndex, heading) {
	if (!modal || !list.length) return;
	photos = list;
	index = startIndex || 0;
	title.textContent = heading || '';
	show();
	openDialog(modal, { initialFocus: document.getElementById('modal-close') });
}

export function initLightbox() {
	if (!modal) return;
	document.getElementById('modal-close').addEventListener('click', function () { closeDialog(modal); });
	modal.addEventListener('click', function (event) { if (event.target === modal) closeDialog(modal); });
	prevBtn.addEventListener('click', function () { step(-1); });
	nextBtn.addEventListener('click', function () { step(1); });
	document.addEventListener('keydown', function (event) {
		if (!isOpen(modal)) return;
		if (event.key === 'ArrowLeft') step(-1);
		if (event.key === 'ArrowRight') step(1);
	});
}
