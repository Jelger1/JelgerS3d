// Formuliervalidatie met duidelijke Nederlandse meldingen, per veld onder het veld getoond.
const NL_POSTCODE = /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/;

const RULES = {
	name: function (value) { return value.length < 2 ? 'Vul je naam in.' : ''; },
	email: function (value, input) { return !value ? 'Vul je e-mailadres in.' : (input.validity.typeMismatch || !/.+@.+\..+/.test(value) ? 'Dit e-mailadres lijkt niet te kloppen.' : ''); },
	phone: function (value) { return value.replace(/\D/g, '').length < 8 ? 'Vul een telefoonnummer in waarop ik je kan bereiken.' : ''; },
	address: function (value) { return !value ? 'Vul je straat en huisnummer in.' : (!/\d/.test(value) ? 'Vergeet je huisnummer niet.' : ''); },
	postcode: function (value, input) {
		if (!value) return 'Vul je postcode in.';
		const country = input.form.elements.country;
		return country && country.value === 'Nederland' && !NL_POSTCODE.test(value) ? 'Een Nederlandse postcode ziet eruit als 1234 AB.' : '';
	},
	city: function (value) { return !value ? 'Vul je woonplaats in.' : ''; },
	text: function (value) { return value.length < 5 ? 'Vertel kort wat je wilt laten maken.' : ''; },
	privacy: function (value, input) { return input.checked ? '' : 'Vink dit aan om het formulier te kunnen versturen.'; }
};

function errorElement(input) {
	const id = input.getAttribute('aria-describedby');
	let el = id ? document.getElementById(id) : null;
	if (!el) {
		// Veld zonder eigen foutregel in de HTML: maak er een aan
		el = document.createElement('p');
		el.className = 'field-error';
		el.id = input.id + '-error';
		el.hidden = true;
		input.setAttribute('aria-describedby', el.id);
		(input.closest('.form-consent') || input).insertAdjacentElement(input.closest('.form-consent') ? 'beforeend' : 'afterend', el);
	}
	return el;
}

export function validateField(input) {
	const rule = RULES[input.name];
	if (!rule) return true;
	const message = rule(input.value.trim(), input);
	const el = errorElement(input);
	el.textContent = message;
	el.hidden = !message;
	input.setAttribute('aria-invalid', message ? 'true' : 'false');
	return !message;
}

// Valideert het hele formulier en zet de focus op het eerste veld dat niet klopt
export function validateForm(form) {
	let firstInvalid = null;
	Array.from(form.elements).forEach(function (input) {
		// Velden in een uitgeschakeld blok (bv. het adres bij "Zelf ophalen") tellen niet mee
		if (!input.name || !RULES[input.name] || input.matches(':disabled')) return;
		if (!validateField(input) && !firstInvalid) firstInvalid = input;
	});
	if (firstInvalid) firstInvalid.focus();
	return !firstInvalid;
}

// Controleer een veld zodra je het verlaat; na een fout ook tijdens het typen, zodat de melding direct verdwijnt
export function watchForm(form) {
	form.addEventListener('focusout', function (event) {
		if (event.target.name && RULES[event.target.name] && event.target.value && event.target.type !== 'checkbox') validateField(event.target);
	});
	form.addEventListener('input', function (event) {
		if (event.target.getAttribute('aria-invalid') === 'true') validateField(event.target);
	});
	form.addEventListener('change', function (event) {
		if (event.target.type === 'checkbox' && RULES[event.target.name]) validateField(event.target);
		// Ander land gekozen: de postcode kan nu wel of niet meer kloppen
		if (event.target.name === 'country' && form.elements.postcode.value) validateField(form.elements.postcode);
	});
}
