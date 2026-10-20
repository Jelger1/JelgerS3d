// E-mailadressen staan gecodeerd in de HTML (data-mail, zie mailLink in src/templates/helpers.js), zodat robots
// die het web afstruinen ze niet vinden. Hier worden het voor de bezoeker weer gewone, klikbare adressen.
export function decodeMail(code) {
	try { return atob(code || '').split('').reverse().join(''); } catch (e) { return ''; }
}

export function initMail() {
	document.querySelectorAll('a[data-mail]').forEach(function (link) {
		const address = decodeMail(link.dataset.mail);
		if (!/^[^\s@]+@[^\s@]+$/.test(address)) return;
		link.href = 'mailto:' + address;
		link.textContent = address;
	});
}
