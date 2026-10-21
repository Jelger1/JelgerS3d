// Bestanden meesturen met een aanvraag (printservice, maatwerk). Ze gaan rechtstreeks naar de opslag van Supabase:
// de site vraagt eerst uploadadressen aan de functie, de browser uploadt, en het formulier stuurt daarna alleen de
// id's mee. Zie uploadAdressen() in supabase/functions/formulier/index.ts en uploadField in src/templates/helpers.js.
import { verstuur } from './util.js';

function grootte(bytes) {
	if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' kB';
	return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}

// Uploadt één bestand naar een uploadadres. XMLHttpRequest in plaats van fetch: alleen die meldt de voortgang.
function put(url, file, voortgang) {
	return new Promise(function (resolve, reject) {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
		xhr.setRequestHeader('x-upsert', 'false');
		xhr.upload.onprogress = function (event) { if (event.lengthComputable) voortgang(event.loaded); };
		xhr.onload = function () {
			if (xhr.status >= 200 && xhr.status < 300) resolve();
			else reject(new Error(file.name + ' kon niet worden geüpload. Probeer het opnieuw, of verstuur het formulier zonder bestand en mail het.'));
		};
		xhr.onerror = function () { reject(new Error('De verbinding viel weg tijdens het uploaden. Probeer het opnieuw.')); };
		xhr.send(file);
	});
}

// Geeft { fout(), upload(voortgang), wis() } terug, of null als het formulier geen uploadveld heeft
export function initUpload(form) {
	const box = form.querySelector('[data-upload]');
	if (!box) return null;
	const input = box.querySelector('input[type="file"]');
	const drop = box.querySelector('[data-upload-drop]');
	const lijst = box.querySelector('[data-upload-list]');
	const types = box.dataset.types.split(',');
	const max = Number(box.dataset.max);
	const maxMB = Number(box.dataset.maxMb);
	let bestanden = [];

	function render() {
		lijst.textContent = '';
		bestanden.forEach(function (file, i) {
			const item = document.createElement('li');
			item.className = 'upload-item';
			const naam = document.createElement('span');
			naam.className = 'upload-name';
			naam.textContent = file.name;
			const maat = document.createElement('span');
			maat.className = 'upload-size';
			maat.textContent = grootte(file.size);
			const weg = document.createElement('button');
			weg.type = 'button';
			weg.className = 'upload-remove';
			weg.textContent = 'Verwijderen';
			weg.setAttribute('aria-label', file.name + ' verwijderen');
			weg.addEventListener('click', function () { bestanden.splice(i, 1); render(); input.focus(); });
			item.append(naam, maat, weg);
			lijst.appendChild(item);
		});
		box.classList.toggle('has-files', bestanden.length > 0);
	}

	// Gekozen bestanden komen bij de lijst (een tweede keer kiezen vervangt de eerste keuze dus niet)
	input.addEventListener('change', function () {
		Array.from(input.files).forEach(function (file) {
			const dubbel = bestanden.some(function (b) { return b.name === file.name && b.size === file.size; });
			if (!dubbel) bestanden.push(file);
		});
		input.value = '';
		render();
	});
	// Slepen werkt vanzelf (het bestandsveld ligt over het hele vak); dit geeft alleen de markering
	['dragenter', 'dragover'].forEach(function (type) { drop.addEventListener(type, function () { drop.classList.add('is-over'); }); });
	['dragleave', 'drop'].forEach(function (type) { drop.addEventListener(type, function () { drop.classList.remove('is-over'); }); });

	// Dezelfde regels als de functie, zodat je het meteen hoort en niet pas na het uploaden
	function fout() {
		if (bestanden.length > max) return 'Je kunt hooguit ' + max + ' bestanden meesturen.';
		for (let i = 0; i < bestanden.length; i++) {
			const file = bestanden[i];
			const punt = file.name.lastIndexOf('.');
			const ext = punt > 0 ? file.name.slice(punt + 1).toLowerCase() : '';
			if (types.indexOf(ext) === -1) return file.name + ' kan ik niet gebruiken. Dit kan wel: ' + box.dataset.typesLabel + '.';
			if (!file.size) return file.name + ' is leeg.';
			if (file.size > maxMB * 1024 * 1024) return file.name + ' is groter dan ' + maxMB + ' MB. Verstuur het formulier zonder dit bestand en mail het daarna.';
		}
		return '';
	}

	// Uploadt alle bestanden en geeft hun id's terug. voortgang(procent) is voor de tekst op de knop.
	function upload(voortgang) {
		if (!bestanden.length) return Promise.resolve([]);
		const totaal = bestanden.reduce(function (som, file) { return som + file.size; }, 0);
		const geladen = bestanden.map(function () { return 0; });
		return verstuur({
			actie: 'upload',
			soort: form.dataset.request,
			bestanden: bestanden.map(function (file) { return { naam: file.name, grootte: file.size }; })
		}).then(function (antwoord) {
			return Promise.all(antwoord.bestanden.map(function (adres, i) {
				return put(adres.url, bestanden[i], function (bytes) {
					geladen[i] = bytes;
					voortgang(Math.min(99, Math.round(geladen.reduce(function (som, b) { return som + b; }, 0) / totaal * 100)));
				}).then(function () { return adres.id; });
			}));
		});
	}

	return { fout: fout, upload: upload, wis: function () { bestanden = []; render(); } };
}
