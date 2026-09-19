// Controleert de gebouwde site in dist/: bestaan alle interne links, afbeeldingen,
// scripts en stylesheets? Is alle JSON-LD geldig? Heeft elke pagina precies één h1?
// Gebruik: npm run check   (na npm run build)
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const problems = [];
let pageCount = 0, refCount = 0;

function walk(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap(function (entry) {
		const full = path.join(dir, entry.name);
		return entry.isDirectory() ? walk(full) : [full];
	});
}

function isExternal(ref) {
	return /^(https?:|mailto:|tel:|data:|#)/.test(ref);
}

walk(DIST).filter(function (f) { return f.endsWith('.html'); }).forEach(function (file) {
	pageCount++;
	const rel = path.relative(DIST, file).replace(/\\/g, '/');
	const html = fs.readFileSync(file, 'utf8');

	const refs = [];
	const attr = /\s(?:href|src)="([^"]+)"/g;
	let m;
	while ((m = attr.exec(html))) refs.push(m[1]);
	const srcset = /\s(?:srcset|imagesrcset)="([^"]+)"/g;
	while ((m = srcset.exec(html))) m[1].split(',').forEach(function (part) { refs.push(part.trim().split(/\s+/)[0]); });
	const dataFull = /\sdata-full="([^"]+)"/g;
	while ((m = dataFull.exec(html))) refs.push(m[1]);

	refs.filter(function (ref) { return !isExternal(ref); }).forEach(function (ref) {
		refCount++;
		const clean = ref.split('#')[0].split('?')[0];
		if (!clean) return;
		const target = path.join(path.dirname(file), clean);
		if (!fs.existsSync(target)) problems.push(rel + ': verwijst naar ontbrekend bestand "' + ref + '"');
	});

	// Ankers binnen dezelfde pagina
	const anchors = /href="#([^"]+)"/g;
	while ((m = anchors.exec(html))) {
		if (!new RegExp('id="' + m[1] + '"').test(html)) problems.push(rel + ': anker #' + m[1] + ' bestaat niet op de pagina');
	}

	const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
	while ((m = ld.exec(html))) {
		try { JSON.parse(m[1]); } catch (e) { problems.push(rel + ': ongeldige JSON-LD (' + e.message + ')'); }
	}

	const h1 = (html.match(/<h1[\s>]/g) || []).length;
	if (h1 !== 1) problems.push(rel + ': ' + h1 + ' h1-koppen gevonden (moet precies 1 zijn)');
	if (!/<title>[^<]{10,}<\/title>/.test(html)) problems.push(rel + ': title ontbreekt of is te kort');
	if (!/<meta name="description" content="[^"]{50,}"/.test(html)) problems.push(rel + ': meta description ontbreekt of is te kort');
	const noAlt = (html.match(/<img(?![^>]*\salt=)[^>]*>/g) || []).length;
	if (noAlt) problems.push(rel + ': ' + noAlt + ' afbeelding(en) zonder alt-attribuut');
});

walk(DIST).filter(function (f) { return f.endsWith('.css'); }).forEach(function (file) {
	const css = fs.readFileSync(file, 'utf8');
	const url = /url\((['"]?)([^'")]+)\1\)/g;
	let m;
	while ((m = url.exec(css))) {
		if (isExternal(m[2])) continue;
		refCount++;
		if (!fs.existsSync(path.join(path.dirname(file), m[2].split('?')[0]))) problems.push(path.relative(DIST, file) + ': verwijst naar ontbrekend bestand "' + m[2] + '"');
	}
});

if (problems.length) {
	console.error('\n' + problems.length + ' probleem/problemen gevonden:\n - ' + problems.join('\n - ') + '\n');
	process.exit(1);
}
console.log('\n✓ ' + pageCount + ' pagina\'s gecontroleerd, ' + refCount + ' interne verwijzingen kloppen, JSON-LD en koppen in orde.\n');
