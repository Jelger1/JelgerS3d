// "Maak je eigen sleutelhanger": koppelt het invoerveld aan de live preview en aan de knoppen.
// Werkt op twee plekken: de productpagina (volledige tool) en de teaser op de homepage
// (daar gaat de getypte tekst mee naar de productpagina via ?tekst=...).
import { drawSign, signToBlob, cleanText, MAX_LENGTH } from './keychain-sign.js';
import { addAndShow } from './cart-ui.js';
import { track } from './util.js';

function slug(text) {
	return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ontwerp';
}

const siteRoot = document.body.dataset.root || '';

// Three.js heeft WebGL 2 nodig, en een grafische chip die het vlot kan tekenen ("failIfMajorPerformanceCaveat":
// zonder bruikbare chip zegt de browser nee). Kan het apparaat dat niet, dan halen we de 3D-code niet eens op.
function supports3D() {
	try {
		const gl = window.WebGL2RenderingContext && document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
		if (!gl) return false;
		const lose = gl.getExtension('WEBGL_lose_context');
		if (lose) lose.loseContext();
		return true;
	} catch (e) { return false; }
}

function initOne(root) {
	const canvas = root.querySelector('[data-keychain-canvas]');
	const input = root.querySelector('[data-keychain-input]');
	if (!canvas || !input) return;
	const placeholder = input.getAttribute('placeholder') || 'Jouw straat';
	const counter = root.querySelector('[data-keychain-count]');
	const hint = root.querySelector('[data-keychain-hint]');
	const needsText = Array.from(root.querySelectorAll('[data-keychain-needs-text]'));
	const teaserLink = root.querySelector('[data-keychain-link]');
	const mailLink = root.querySelector('[data-keychain-mail]');

	input.maxLength = MAX_LENGTH;

	function text() { return cleanText(input.value).trim(); }

	// De preview is eerst een 2D-tekening. Komt de tool in beeld, dan wordt het draaibare 3D-model opgehaald
	// en neemt dat het over. Lukt dat niet (oude browser, geen WebGL), dan blijft de 2D-tekening gewoon staan.
	const stage = canvas.parentElement;
	let view = null, canvas3d = null;

	function describe(target) {
		target.setAttribute('aria-label', (text()
			? 'Voorbeeld van je sleutelhanger: blauw straatnaambord met de tekst ' + text()
			: 'Voorbeeld van de sleutelhanger: blauw straatnaambord met witte rand en sleutelring')
			+ (target === canvas3d ? '. Sleep of gebruik de pijltjestoetsen om het model te draaien.' : ''));
	}

	// Scherp op elk scherm: het canvas krijgt zoveel pixels als het scherm echt toont
	function render() {
		if (view) { view.setText(text()); describe(canvas3d); return; }
		const width = Math.max(320, Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2)));
		if (canvas.width !== width) { canvas.width = width; canvas.height = Math.round(width / 2); }
		drawSign(canvas, text(), { placeholder: placeholder });
		describe(canvas);
	}
	function resized() { if (!view) render(); } // het 3D-model regelt zijn eigen formaat

	function load3D() {
		if (!supports3D()) { root.dataset.keychainMode = '2d'; return; }
		import('./keychain-3d.js').then(function (module) {
			const target = document.createElement('canvas');
			target.className = 'keychain-3d';
			target.setAttribute('role', 'img');
			stage.appendChild(target);
			return module.createKeychain3D(target, { fontUrl: siteRoot + 'assets/fonts/arimo-bold.typeface.json', placeholder: placeholder, text: text() }).then(function (created) {
				view = created;
				canvas3d = target;
				stage.keychainView = view;
				const tip = document.createElement('span');
				tip.className = 'keychain-stage-hint';
				tip.setAttribute('aria-hidden', 'true');
				tip.textContent = 'Sleep om te draaien';
				stage.appendChild(tip);
				stage.classList.add('is-3d');
				root.dataset.keychainMode = '3d';
				render();
			}, function (error) { target.remove(); throw error; });
		}).catch(function () { root.dataset.keychainMode = '2d'; });
	}

	function update() {
		// Niet-printbare tekens direct weghalen, zonder de cursor te laten verspringen
		const cleaned = cleanText(input.value);
		if (cleaned !== input.value) {
			const position = input.selectionStart - (input.value.length - cleaned.length);
			input.value = cleaned;
			try { input.setSelectionRange(position, position); } catch (e) {}
		}
		const value = text();
		render();
		if (counter) counter.textContent = input.value.length + ' / ' + MAX_LENGTH;
		needsText.forEach(function (el) {
			if (el.tagName === 'A') el.setAttribute('aria-disabled', value ? 'false' : 'true');
			else el.disabled = !value;
		});
		if (hint) hint.hidden = Boolean(value);
		if (teaserLink) teaserLink.href = teaserLink.dataset.keychainLink + (value ? '?tekst=' + encodeURIComponent(value) : '');
		if (mailLink) {
			const subject = 'Nieuwe bestelling sleutelhanger: ' + value;
			const body = 'Hallo Jelger,\n\nIk wil graag deze sleutelhanger bestellen:\n\n'
				+ 'Tekst op het bord: ' + value + '\nAantal: 1\n\n'
				+ 'Mijn gegevens:\nNaam:\nTelefoon:\nVerzenden of ophalen in Kerkrade:\nAdres (bij verzenden):\n\n'
				+ 'Tip: voeg de preview die je hebt gedownload toe als bijlage.\n\nGroet,';
			mailLink.href = 'mailto:' + mailLink.dataset.keychainMail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
		}
	}

	// Tekst meegekregen vanaf de homepage?
	const preset = new URLSearchParams(location.search).get('tekst');
	if (preset && !input.value) input.value = cleanText(preset);

	input.addEventListener('input', update);
	window.addEventListener('resize', resized);
	if ('ResizeObserver' in window) new ResizeObserver(resized).observe(canvas);
	// Links die tekst nodig hebben doen niets zolang het veld leeg is
	root.addEventListener('click', function (event) {
		const link = event.target.closest('a[aria-disabled="true"]');
		if (link) { event.preventDefault(); input.focus(); }
	});

	const download = root.querySelector('[data-keychain-download]');
	if (download) {
		download.addEventListener('click', function () {
			const value = text();
			if (!value) return;
			// In 3D krijg je het model zoals je het op dat moment hebt gedraaid; anders de 2D-tekening
			(view ? view.toBlob(2400, 1200) : signToBlob(value)).then(function (blob) {
				if (!blob) return;
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'sleutelhanger-' + slug(value) + '.png';
				document.body.appendChild(a);
				a.click();
				a.remove();
				setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
				track('keychain_download', { text_length: value.length });
			});
		});
	}

	const form = root.querySelector('[data-keychain-form]');
	if (form) {
		form.addEventListener('submit', function (event) {
			event.preventDefault();
			const value = text();
			if (!value) { input.focus(); return; }
			addAndShow(form.dataset.product, form.dataset.variant, 'ontwerptool', value);
		});
	}
	if (mailLink) mailLink.addEventListener('click', function () { if (text()) track('keychain_mail', {}); });

	update();

	// 3D pas ophalen wanneer de tool (bijna) in beeld is, en dan op een rustig moment
	if ('IntersectionObserver' in window) {
		const observer = new IntersectionObserver(function (entries) {
			if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
			observer.disconnect();
			if ('requestIdleCallback' in window) requestIdleCallback(load3D, { timeout: 2000 }); else setTimeout(load3D, 300);
		}, { rootMargin: '300px' });
		observer.observe(stage);
	}
}

export function initKeychain() {
	document.querySelectorAll('[data-keychain]').forEach(initOne);
}
