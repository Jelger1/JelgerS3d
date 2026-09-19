// Afbeeldingspipeline: originelen uit assets/ -> geoptimaliseerde WebP's in dist/assets/img/
// en JPG's van 1200x630 voor link-previews in dist/assets/og/.
//
// Productfoto's krijgen daarnaast een vaste uitsnede (standaard 4:5) met het product in het midden.
// Waar het product staat geef je per foto op in products.json: "subject": [links, boven, rechts, onder] in procenten.
//
// Incrementeel: een foto wordt alleen opnieuw verwerkt als het origineel of de uitsnede-instelling wijzigt.
const fs = require('fs');
const path = require('path');

const PIPELINE_VERSION = 4; // ophogen forceert het opnieuw verwerken van alle foto's
const WIDTHS = [400, 800, 1600];
const CROP_WIDTHS = [400, 800, 1200];
const OG_SIZE = { width: 1200, height: 630 };
const SOURCE_EXT = /\.(jpe?g|png)$/i;

function slugify(filename) {
	return filename
		.replace(/\.[^.]+$/, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function pickWidths(steps, fullWidth) {
	const widths = steps.filter(function (w) { return w <= fullWidth; });
	const largest = widths.length ? widths[widths.length - 1] : 0;
	// Kleiner origineel dan de grootste stap: voeg de volle breedte toe (tenzij dat nauwelijks scheelt)
	if (fullWidth < steps[steps.length - 1] && fullWidth - largest > 100) widths.push(fullWidth);
	return widths;
}

// Berekent de uitsnede rond het product.
// W, H: afmetingen van de foto. opt: { subject, fill, pad }, ratio = breedte / hoogte van het kader.
// Geeft de uitsnede binnen de foto terug, plus hoeveel er eventueel aangevuld moet worden (pad).
function computeCrop(W, H, ratio, opt) {
	const subject = opt.subject;
	if (!subject) {
		// Geen product aangegeven: grootst mogelijke uitsnede vanuit het midden
		const w = Math.min(W, H * ratio), h = w / ratio;
		return { left: (W - w) / 2, top: (H - h) / 2, width: w, height: h, pad: null };
	}

	const sl = subject[0] / 100 * W, st = subject[1] / 100 * H;
	const sw = (subject[2] - subject[0]) / 100 * W, sh = (subject[3] - subject[1]) / 100 * H;
	const cx = sl + sw / 2, cy = st + sh / 2;

	// Het product vult hooguit "fill" van het kader, in breedte én hoogte
	let h = Math.max(sh / opt.fill, sw / opt.fill / ratio);
	let w = h * ratio;

	if (opt.pad) {
		// Studiofoto met egale achtergrond: wat buiten de foto valt wordt aangevuld met de achtergrondkleur
		const left = cx - w / 2, top = cy - h / 2;
		const inLeft = Math.max(0, left), inTop = Math.max(0, top);
		const inRight = Math.min(W, left + w), inBottom = Math.min(H, top + h);
		return {
			left: inLeft, top: inTop, width: inRight - inLeft, height: inBottom - inTop,
			pad: { left: inLeft - left, top: inTop - top, right: left + w - inRight, bottom: top + h - inBottom }
		};
	}

	// Nooit groter dan de foto zelf
	if (w > W) { w = W; h = w / ratio; }
	if (h > H) { h = H; w = h * ratio; }

	// Staat het product dicht bij een rand, dan zou de uitsnede tegen die rand schuiven en staat het
	// product niet meer in het midden. Maak de uitsnede dan kleiner, zolang het product er ruim in past.
	const centeredH = Math.min(2 * Math.min(cy, H - cy), 2 * Math.min(cx, W - cx) / ratio);
	const tightestH = Math.max(sh / 0.9, sw / 0.9 / ratio);
	if (h > centeredH) { h = Math.min(h, Math.max(centeredH, tightestH)); w = h * ratio; }

	const left = Math.min(Math.max(cx - w / 2, 0), W - w);
	const top = Math.min(Math.max(cy - h / 2, 0), H - h);
	return { left: left, top: top, width: w, height: h, pad: null };
}

// only:  bestandsnamen die de site echt gebruikt; andere foto's in assets/ worden overgeslagen.
// crops: { bestandsnaam: { subject, background, fill } } voor foto's die een productuitsnede krijgen.
// frame: { ratio: [4, 5], fill: 0.62 }
async function processImages({ srcDir, outDir, ogDir, ogFor = [], only = null, crops = {}, frame = { ratio: [4, 5], fill: 0.62 } }) {
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
	const ratio = frame.ratio[0] / frame.ratio[1];
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
		const cropOpt = crops[file] || null;
		const needsOg = wantsOg.has(file);
		const stamp = [PIPELINE_VERSION, stat.size, Math.round(stat.mtimeMs), JSON.stringify(cropOpt), cropOpt ? JSON.stringify(frame) : ''].join(':');
		const prev = previous[file];

		const outputs = prev ? prev.variants.concat(prev.crop ? prev.crop.variants : []) : [];
		const upToDate = prev && prev.stamp === stamp
			&& outputs.every(function (v) { return fs.existsSync(path.join(outDir, v.file)); })
			&& (!needsOg || (prev.og && fs.existsSync(path.join(ogDir, prev.og))));
		if (upToDate) { manifest[file] = prev; continue; }

		const slug = slugify(file);
		// .rotate() zonder argument past de EXIF-oriëntatie van de camera toe
		const meta = await sharp(srcPath).rotate().toBuffer({ resolveWithObject: true });
		const W = meta.info.width, H = meta.info.height;

		const variants = [];
		for (const w of pickWidths(WIDTHS, W)) {
			const outFile = slug + '-' + w + '.webp';
			const info = await sharp(meta.data)
				.resize({ width: w, withoutEnlargement: true })
				.webp({ quality: w >= 1600 ? 76 : 80, effort: 5 })
				.toFile(path.join(outDir, outFile));
			variants.push({ w: info.width, h: info.height, file: outFile });
		}

		const entry = { stamp: stamp, slug: slug, width: W, height: H, variants: variants };
		let cropBuffer = null;

		if (cropOpt) {
			const pad = Boolean(cropOpt.background);
			const c = computeCrop(W, H, ratio, { subject: cropOpt.subject, fill: cropOpt.fill || frame.fill, pad: pad });
			let pipeline = sharp(meta.data).extract({
				left: Math.round(c.left), top: Math.round(c.top),
				width: Math.max(1, Math.min(W - Math.round(c.left), Math.round(c.width))),
				height: Math.max(1, Math.min(H - Math.round(c.top), Math.round(c.height)))
			});
			if (c.pad) {
				const extend = {
					left: Math.round(c.pad.left), top: Math.round(c.pad.top),
					right: Math.round(c.pad.right), bottom: Math.round(c.pad.bottom)
				};
				// "auto": trek de randpixels van de foto door. Op een egale studio-achtergrond is dat naadloos,
				// ook als die achtergrond een zacht verloop heeft. Een kleurcode (#ffffff) vult met die kleur.
				if (cropOpt.background === 'auto') extend.extendWith = 'copy';
				else extend.background = cropOpt.background;
				pipeline = pipeline.extend(extend);
			}
			cropBuffer = await pipeline.png().toBuffer();
			const cropMeta = await sharp(cropBuffer).metadata();

			entry.crop = { variants: [] };
			for (const w of pickWidths(CROP_WIDTHS, cropMeta.width)) {
				const outFile = slug + '-c-' + w + '.webp';
				// Exacte kaderverhouding, zodat de browser niets meer hoeft bij te snijden
				const info = await sharp(cropBuffer)
					.resize({ width: w, height: Math.round(w / ratio), fit: 'cover' })
					.webp({ quality: 80, effort: 5 })
					.toFile(path.join(outDir, outFile));
				entry.crop.variants.push({ w: info.width, h: info.height, file: outFile });
			}
		}

		if (needsOg) {
			entry.og = slug + '.jpg';
			if (cropBuffer) {
				// Link-preview: het product volledig in beeld, op een vervaagde versie van dezelfde foto
				const backdrop = await sharp(meta.data)
					.resize({ width: OG_SIZE.width, height: OG_SIZE.height, fit: 'cover' })
					.blur(28).modulate({ brightness: 0.55 }).toBuffer();
				const front = await sharp(cropBuffer).resize({ height: OG_SIZE.height }).toBuffer();
				await sharp(backdrop).composite([{ input: front, gravity: 'centre' }])
					.jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(ogDir, entry.og));
			} else {
				await sharp(meta.data)
					.resize({ width: OG_SIZE.width, height: OG_SIZE.height, fit: 'cover', position: sharp.strategy.attention })
					.flatten({ background: '#12151c' })
					.jpeg({ quality: 82, mozjpeg: true })
					.toFile(path.join(ogDir, entry.og));
			}
		}

		manifest[file] = entry;
		processed++;
	}

	// Ruim uitvoer op van foto's die niet meer gebruikt worden
	const keepImg = new Set(['manifest.json']);
	const keepOg = new Set();
	Object.keys(manifest).forEach(function (f) {
		manifest[f].variants.forEach(function (v) { keepImg.add(v.file); });
		if (manifest[f].crop) manifest[f].crop.variants.forEach(function (v) { keepImg.add(v.file); });
		if (manifest[f].og) keepOg.add(manifest[f].og);
	});
	fs.readdirSync(outDir).forEach(function (f) { if (!keepImg.has(f)) fs.rmSync(path.join(outDir, f)); });
	fs.readdirSync(ogDir).forEach(function (f) { if (!keepOg.has(f)) fs.rmSync(path.join(ogDir, f)); });

	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t'));
	return { manifest: manifest, processed: processed, total: files.length };
}

module.exports = { processImages: processImages, slugify: slugify, computeCrop: computeCrop };
