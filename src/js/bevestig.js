// nieuwsbrief.html en gereageerd.html: pagina's die je via een link in een mail bereikt. De code staat achter # in
// het adres; die gaat naar de Supabase-functie en daarna uit de adresbalk. Zie confirmPage in src/templates/pages.js.
import { verstuur } from './util.js';

export function initBevestig() {
	const pagina = document.querySelector('[data-bevestig]');
	if (!pagina) return;
	const titel = pagina.querySelector('[data-bevestig-titel]');
	const tekst = pagina.querySelector('[data-bevestig-tekst]');
	const icoon = pagina.querySelector('[data-bevestig-icoon]');
	const acties = pagina.querySelector('[data-bevestig-acties]');
	const code = new URLSearchParams(location.hash.slice(1));
	if (location.hash) history.replaceState(null, '', location.pathname);

	function klaar(kop, uitleg, gelukt) {
		titel.textContent = kop;
		tekst.textContent = uitleg;
		icoon.hidden = !gelukt;
		acties.hidden = false;
	}

	let gegevens;
	if (pagina.dataset.bevestig === 'bevestig') {
		gegevens = { actie: 'bevestig', token: code.get('t') || '' };
	} else {
		const tabel = code.has('b') ? 'b' : 'm';
		gegevens = { actie: 'gereageerd', tabel: tabel, id: code.get(tabel) || '', k: code.get('k') || '' };
	}

	verstuur(Object.assign({ pagina: location.pathname }, gegevens)).then(function (antwoord) {
		if (gegevens.actie === 'bevestig') {
			klaar('Je bent aangemeld!', 'Je hoort het als eerste als er een nieuw ontwerp is. Afmelden kan altijd, met één klik onderaan elke mail.', true);
			return;
		}
		klaar(antwoord.al ? 'Stond al op gereageerd' : 'Gemarkeerd als gereageerd', antwoord.wat + '. Hier krijg je geen herinnering meer over.', true);
		const dashboard = pagina.querySelector('[data-bevestig-dashboard]');
		if (dashboard && antwoord.dashboard) dashboard.href = antwoord.dashboard;
	}).catch(function (error) {
		klaar('Dat lukte niet', error.message, false);
	});
}
