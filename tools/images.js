// Afbeeldingspipeline: originelen uit assets/ -> geoptimaliseerde WebP's in dist/assets/img/
// en JPG's van 1200x630 voor link-previews in dist/assets/og/.
// Incrementeel: een foto wordt alleen opnieuw verwerkt als het origineel is gewijzigd.
const fs = require('fs');
const path = require('path');

const WIDTHS = [400, 800, 1600];
const OG_SIZE = { width: 1200, height: 630 };
const SOURCE_EXT = /\.(jpe?g|png)$/i;

function slugify(filename) {
	return filename
		.replace(/\.[^.]+$/, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

// only: lijst met bestandsnamen die de site echt gebruikt. Andere foto's in assets/ worden overgeslagen.
async function processImages({ srcDir, outDir, ogDir, ogFor = [], only = null }) {
	let sharp;
	try {
		sharp = require('sharp');
	} catch (e) {
		throw new Error('De afbeeldingstool "sharp" ontbreekt. Draai eerst eenmalig: npm install');
	}

	fs.mkdirSync(outDir, { recursive: true });
	fs.mkdirSync(ogDir, { recursive: true });

	const manifestPath = path.join(outDir, 'manifest.json');
	let previous = {};
	try { previous = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) {}

	const manifest = {};
	const wantsOg = new Set(ogFor);
	let processed = 0;

	const present = fs.readdirSync(srcDir).filter(function (f) { return SOURCE_EXT.test(f); });
	const files = only ? Array.from(new Set(only)) : present;

	// Bestandsnamen moeten exact kloppen, ook de hoofdletters: de online build draait op Linux
	const missing = files.filter(function (f) { return present.indexOf(f) === -1; });
	if (missing.length) throw new Error('Afbeelding(en) niet gevonden in assets/ (let op hoofdletters): ' + missing.join(', '));

	// Twee foto's met dezelfde naam maar een andere extensie zouden elkaars uitvoer overschrijven
	const slugs = {};
	files.forEach(function (f) {
		const slug = slugify(f);
		if (slugs[slug]) throw new Error('Naamconflict: ' + slugs[slug] + ' en ' + f + ' leveren dezelfde uitvoernaam op. Hernoem er een.');
		slugs[slug] = f;
	});
	for (const file of files) {
		const srcPath = path.join(srcDir, file);
		const stat = fs.statSync(srcPath);
		const stamp = stat.size + ':' + Math.round(stat.mtimeMs);
		const needsOg = wantsOg.has(file);
		const prev = previous[file];

		const upToDate = prev && prev.stamp === stamp
			&& prev.variants.every(function (v) { return fs.existsSync(path.join(outDir, v.file)); })
			&& (!needsOg || (prev.og && fs.existsSync(path.join(ogDir, prev.og))));
		if (upToDate) { manifest[file] = prev; continue; }

		const slug = slugify(file);
		// .rotate() zonder argument past de EXIF-oriëntatie van de camera toe
		const meta = await sharp(srcPath).rotate().toBuffer({ resolveWithObject: true });
		const fullWidth = meta.info.width;
		const fullHeight = meta.info.height;

		// Nooit opschalen: neem alleen breedtes die het origineel aankan
		const widths = WIDTHS.filter(function (w) { return w <= fullWidth; });
		const largest = widths.length ? widths[widths.length - 1] : 0;
		// Kleiner origineel dan de grootste stap: voeg de volle breedte toe (tenzij dat nauwelijks scheelt)
		if (fullWidth < WIDTHS[WIDTHS.length - 1] && fullWidth - largest > 100) widths.push(fullWidth);

		const variants = [];
		for (const w of widths) {
			const outFile = slug + '-' + w + '.webp';
			const info = await sharp(meta.data)
				.resize({ width: w, withoutEnlargement: true })
				.webp({ quality: w >= 1600 ? 76 : 80, effort: 5 })
				.toFile(path.join(outDir, outFile));
			variants.push({ w: info.width, h: info.height, file: outFile });
		}

		const entry = { stamp: stamp, slug: slug, width: fullWidth, height: fullHeight, variants: variants };

		if (needsOg) {
			entry.og = slug + '.jpg';
			await sharp(meta.data)
				.resize({ width: OG_SIZE.width, height: OG_SIZE.height, fit: 'cover', position: sharp.strategy.attention })
				.flatten({ background: '#12151c' })
				.jpeg({ quality: 82, mozjpeg: true })
				.toFile(path.join(ogDir, entry.og));
		}

		manifest[file] = entry;
		processed++;
	}

	// Ruim uitvoer op van foto's die niet meer gebruikt worden
	const keepImg = new Set(['manifest.json']);
	const keepOg = new Set();
	Object.keys(manifest).forEach(function (f) {
		manifest[f].variants.forEach(function (v) { keepImg.add(v.file); });
		if (manifest[f].og) keepOg.add(manifest[f].og);
	});
	fs.readdirSync(outDir).forEach(function (f) { if (!keepImg.has(f)) fs.rmSync(path.join(outDir, f)); });
	fs.readdirSync(ogDir).forEach(function (f) { if (!keepOg.has(f)) fs.rmSync(path.join(ogDir, f)); });

	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t'));
	return { manifest: manifest, processed: processed, total: files.length };
}

module.exports = { processImages: processImages, slugify: slugify };
