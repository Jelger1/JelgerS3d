// Toegankelijke panelen (winkelwagen, checkout, fotoviewer): focus vasthouden,
// Escape om te sluiten, scroll van de pagina blokkeren en focus terugzetten.
const stack = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(el) {
	return Array.from(el.querySelectorAll(FOCUSABLE)).filter(function (node) {
		return node.offsetParent !== null || node === document.activeElement;
	});
}

export function openDialog(el, options) {
	if (!el || isOpen(el)) return;
	options = options || {};
	stack.push({ el: el, opener: document.activeElement, onClose: options.onClose });
	el.removeAttribute('inert');
	el.setAttribute('aria-hidden', 'false');
	document.body.classList.add('is-locked');

	const target = options.initialFocus || focusables(el)[0];
	// Wacht één frame zodat de CSS-transitie de focus niet verstoort
	requestAnimationFrame(function () { if (target) target.focus({ preventScroll: true }); });
}

export function closeDialog(el) {
	const index = stack.findIndex(function (entry) { return entry.el === el; });
	if (index === -1) return;
	const entry = stack.splice(index, 1)[0];
	el.setAttribute('aria-hidden', 'true');
	el.setAttribute('inert', '');
	if (stack.length === 0) document.body.classList.remove('is-locked');
	if (entry.onClose) entry.onClose();
	if (entry.opener && document.contains(entry.opener)) entry.opener.focus({ preventScroll: true });
}

export function isOpen(el) {
	return stack.some(function (entry) { return entry.el === el; });
}

document.addEventListener('keydown', function (event) {
	const top = stack[stack.length - 1];
	if (!top) return;

	if (event.key === 'Escape') {
		event.preventDefault();
		closeDialog(top.el);
		return;
	}
	if (event.key !== 'Tab') return;

	const nodes = focusables(top.el);
	if (!nodes.length) { event.preventDefault(); return; }
	const first = nodes[0], last = nodes[nodes.length - 1];
	if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
	else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
	else if (!top.el.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
});
