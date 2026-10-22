// Bouwt de complete site in dist/ vanuit data/ en src/.
// Gebruik: npm run build   (of dubbelklik build.bat)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { processImages } = require('./tools/images');
const layout = require('./src/templates/layout');
const homePage = require('./src/templates/home');
const shopPage = require('./src/templates/shop');
const productPage = require('./src/templates/product');
const { checkoutPage, thanksPage } = require('./src/templates/checkout');
const { categoryPage, productsFor } = require('./src/templates/category');
const { privacyPage, termsPage, notFoundPage, printServicePage, newsletterPage, repliedPage } = require('./src/templates/pages');
const h = require('./src/templates/helpers');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SALE_TYPES = ['cart', 'external', 'request', 'soon'];
// Volgorde is van belang: later wint van eerder. Alles wordt samengevoegd tot één css/styles.css.
const CSS_FILES = ['fonts.css', 'reset.css', 'styles.css', 'components.css', 'product.css', 'shop.css', 'checkout.css', 'home.css', 'pages.css', 'keychain.css', 'brand.css'];

// Lettertypen die elke pagina vooraf laadt: de koppen (Saira) en de lopende tekst (DM Sans). De rest staat in fonts.css.
const PRELOAD_FONTS = ['saira-latin.woff2', 'dm-sans-latin.woff2'];

function readJson(file) {
	try {
		return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
	} catch (e) {
		throw new Error('Kan ' + file + ' niet lezen: ' + e.message);
	}
}

function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }

function write(file, content) {
	const target = path.join(DIST, file);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, content);
}

// Controleert de data. Fouten stoppen de build, waarschuwingen en todo's niet.
function validate(products, reviews, site) {
	const errors = [], warnings = [], todos = [];
	const ids = new Set();

	products.forEach(function (p, i) {
		const where = 'products.json > "' + (p.id || '#' + i) + '"';
		if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) errors.push(where + ': id ontbreekt of bevat andere tekens dan a-z, 0-9 en -');
		if (ids.has(p.id)) errors.push(where + ': id komt dubbel voor');
		ids.add(p.id);
		if (!p.name) errors.push(where + ': name ontbreekt');
		if (!site.types[p.type]) errors.push(where + ': onbekend type "' + p.type + '" (voeg toe in site.json > types)');
		if (!site.collections[p.collection]) errors.push(where + ': onbekende collection "' + p.collection + '"');
		if (SALE_TYPES.indexOf(p.sale) === -1) errors.push(where + ': sale moet een van ' + SALE_TYPES.join(', ') + ' zijn');
		if (p.sale === 'cart' && !(p.variants && p.variants.length)) errors.push(where + ': een product in de winkelwagen heeft minstens één variant met prijs nodig');
		(p.variants || []).forEach(function (v) {
			if (!v.id || typeof v.price !== 'number' || !(v.price > 0)) errors.push(where + ': variant zonder id of geldige prijs');
		});
		if ((p.variants || []).length > 1 && p.variants.some(function (v) { return !v.label; })) errors.push(where + ': bij meerdere varianten heeft elke variant een label nodig');
		if (p.sale === 'external' && !p.externalUrl) errors.push(where + ': externalUrl ontbreekt');
		if (p.personalize && (p.sale !== 'cart' || (p.variants || []).length !== 1)) errors.push(where + ': een product met "personalize" moet sale "cart" hebben en precies één variant');
		if (p.intro) {
			if (!(p.intro.price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(p.intro.until || '')) errors.push(where + ': "intro" heeft een price en een until nodig (datum als "2026-12-31")');
			else if ((p.variants || []).length !== 1) errors.push(where + ': een introductieprijs kan alleen bij precies één variant (anders is onduidelijk welke prijs verlaagd wordt)');
			else if (p.intro.price >= p.variants[0].price) errors.push(where + ': de introductieprijs moet lager zijn dan de gewone prijs in "variants"');
		}
		if (p.video) {
			if (!p.video.file || !fs.existsSync(path.join(ROOT, 'assets/video', p.video.file))) errors.push(where + ': video "' + (p.video.file || '') + '" staat niet in assets/video/ (maak hem met "npm run video")');
			if (!p.video.poster) errors.push(where + ': video heeft een "poster" nodig (een foto uit assets/ als voorbeeld)');
			if (!p.video.alt) warnings.push(where + ': video zonder "alt", beschrijf kort wat er te zien is');
		}
		if (!(p.images && p.images.length)) errors.push(where + ': minstens één afbeelding nodig');
		(p.images || []).forEach(function (image) {
			if (!fs.existsSync(path.join(ROOT, 'assets', image.file))) errors.push(where + ': afbeelding assets/' + image.file + ' bestaat niet');
			if (!image.alt) warnings.push(where + ': alt-tekst ontbreekt bij ' + image.file);
			const s = image.subject;
			if (!s) warnings.push(where + ': geen "subject" bij ' + image.file + ', de foto wordt vanuit het midden bijgesneden');
			else if (!Array.isArray(s) || s.length !== 4 || s.some(function (n) { return typeof n !== 'number' || n < 0 || n > 100; }) || s[0] >= s[2] || s[1] >= s[3]) {
				errors.push(where + ': "subject" bij ' + image.file + ' moet [links, boven, rechts, onder] zijn, in procenten van 0 tot 100');
			}
		});
		if (!p.seo || !p.seo.title || !p.seo.description) errors.push(where + ': seo.title en seo.description zijn verplicht');
		else {
			const volledigeTitel = p.seo.title.length + site.name.length + 3; // Google toont "<titel> | <sitenaam>"
			if (volledigeTitel > 60) warnings.push(where + ': de titel wordt met " | ' + site.name + '" ' + volledigeTitel + ' tekens; Google kapt af rond 60');
			if (p.seo.description.length > 160) warnings.push(where + ': seo.description is ' + p.seo.description.length + ' tekens (richtlijn: max 160)');
		}
		if (!p.material) todos.push(p.name + ': materiaal');
	});

	products.forEach(function (p) {
		(p.related || []).forEach(function (id) {
			if (!ids.has(id) || id === p.id) errors.push('products.json > "' + p.id + '": related "' + id + '" bestaat niet');
		});
	});
	(site.categoryPages || []).forEach(function (cat) {
		if (!/^[a-z0-9-]+$/.test(cat.slug || '')) errors.push('site.json > categoryPages: slug "' + cat.slug + '" mag alleen a-z, 0-9 en - bevatten');
		if (!productsFor(cat, products).length) errors.push('site.json > categoryPages > "' + cat.slug + '": geen enkel product past bij dit filter');
		if ((cat.seoTitle || '').length + site.name.length + 3 > 60) warnings.push('site.json > categoryPages > "' + cat.slug + '": de titel wordt met " | ' + site.name + '" te lang; Google kapt af rond 60 tekens');
		if ((cat.seoDescription || '').length > 160) warnings.push('site.json > categoryPages > "' + cat.slug + '": seoDescription is ' + cat.seoDescription.length + ' tekens (richtlijn: max 160)');
	});
	reviews.forEach(function (r) {
		(r.products || []).forEach(function (id) {
			if (!ids.has(id)) errors.push('reviews.json > ' + r.author + ': product "' + id + '" bestaat niet');
		});
	});

	// Een ID in het verkeerde veld breekt niets zichtbaars, er wordt dan alleen stilletjes niets gemeten
	const analytics = site.analytics || {};
	const idFormats = { gtm: ['GTM-', /^GTM-[A-Z0-9]+$/], ga4: ['G-', /^G-[A-Z0-9]+$/], googleAds: ['AW-', /^AW-\d+$/] };
	Object.keys(idFormats).forEach(function (key) {
		if (analytics[key] && !idFormats[key][1].test(analytics[key])) warnings.push('site.json > analytics.' + key + ': "' + analytics[key] + '" is geen geldig ID (dat begint met ' + idFormats[key][0] + ')');
	});
	if (!(site.backend && site.backend.url)) warnings.push('site.json > backend.url ontbreekt: bestellingen en formulieren kunnen dan nergens heen');
	if (analytics.gtm && !analytics.ga4 && !analytics.googleAds) warnings.push('site.json > analytics: zonder ga4 of googleAds vraagt de cookiemelding nergens toestemming voor, dus tags in Tag Manager die toestemming nodig hebben starten nooit');
	if (!analytics.gtm && (analytics.ga4 || analytics.googleAds)) warnings.push('site.json > analytics: Google Analytics en Google Ads worden alleen via Tag Manager geladen; zonder gtm meet de site niets');
	if ('adsConversionLabel' in analytics) warnings.push('site.json > analytics.adsConversionLabel wordt niet meer gebruikt: stel de Google Ads-conversie in Tag Manager in (gebeurtenis generate_lead)');

	return { errors: errors, warnings: warnings, todos: todos };
}

// Introductieprijs ("intro": { "price": 49.95, "until": "2026-12-31" }). Zolang die loopt is dat de echte prijs:
// op de kaart, op de productpagina, in de winkelwagen, in de productfeed en in schema.org. Is de datum voorbij,
// dan rekent de site vanaf de eerstvolgende build vanzelf weer de gewone prijs uit "variants".
// De ACM staat geen doorgestreepte "van"-prijs toe die niet echt is gevraagd; daarom noemt de pagina alleen
// "introductieprijs tot <datum>, daarna <prijs>". Die gewone prijs moet je daarna dus ook echt rekenen.
function applyIntro(products, today) {
	products.forEach(function (product) {
		if (!product.intro) return;
		product.intro.active = product.intro.until >= today; // ISO-datums zijn als tekst te vergelijken
		if (!product.intro.active) return;
		product.variants.forEach(function (variant) {
			variant.regularPrice = variant.price;
			variant.price = product.intro.price;
		});
		if (!product.badge) product.badge = 'Introductieprijs';
	});
}

// Zet ?v=<versie> achter relatieve imports, zodat browsers na een update nooit oude en nieuwe modules mengen
function versionImports(source, version) {
	return source.replace(/(from\s+|import\s+|import\s*\(\s*)(['"])(\.\/[^'"]+?\.js)\2/g, function (m, keyword, quote, spec) {
		return keyword + quote + spec + '?v=' + version + quote;
	});
}

function catalogData(products, images) {
	const catalog = {};
	products.forEach(function (p) {
		catalog[p.id] = {
			name: p.name,
			url: h.productUrl(p),
			image: h.imgPath(images, p.images[0].file, 400, '', true),
			sale: p.sale,
			variants: p.variants || [],
			related: p.related || [],
			personalize: Boolean(p.personalize),
			wish: Boolean(p.wish)
		};
	});
	return catalog;
}

function buildCatalog(products, images) {
	return 'export default ' + JSON.stringify(catalogData(products, images), null, '\t') + ';\n';
}

// Voor de Supabase-functie "formulier" (supabase/functions/formulier): bedrijfsgegevens, de actuele prijzen en de
// productfoto's voor de mails, zodat de bevestiging precies dezelfde prijzen noemt als de site. Eén bron: data/*.json.
// Het e-mailadres staat er net als op de pagina's gecodeerd in (zie mailCode in src/templates/helpers.js).
function buildWinkel(products, images, site) {
	const a = site.address || {};
	const catalogus = catalogData(products, images);
	products.forEach(function (p) { catalogus[p.id].mailImage = 'assets/mail/' + mailImageName(p, images); });
	return JSON.stringify({
		winkel: {
			naam: site.name, eigenaar: site.owner, mail: h.mailCode(site.email), url: site.url, instagram: site.instagram, slogan: site.slogan,
			adres: [a.street, [a.postcode, a.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
			kvk: site.kvk, btw: site.btw, ophaalplaats: site.pickupLocation, levertijd: site.delivery.leadTimeLong
		},
		catalogus: catalogus,
		uploads: site.uploads || null // welke bestanden bij een aanvraag mogen (types, aantal, grootte, bewaartermijn)
	});
}

// Plaatjes voor die mails: het logo als PNG (Gmail toont geen SVG) en per product een kleine JPG van de uitsnede
// (klassiek Outlook toont geen WebP). Een plaatje wordt alleen opnieuw gemaakt als de bron nieuwer is.
function mailImageName(product, images) {
	return path.basename(h.imgPath(images, product.images[0].file, 400, '', true)).replace(/\.\w+$/, '.jpg');
}

async function buildMailImages(products, images) {
	const sharp = require('sharp');
	const dir = path.join(DIST, 'assets/mail');
	fs.mkdirSync(dir, { recursive: true });
	const jobs = [{
		src: path.join(ROOT, 'assets/brand/js-icon.svg'), out: 'logo.png',
		make: function () { return sharp(this.src, { density: 300 }).resize({ width: 88 }).png({ compressionLevel: 9 }); } // 2x van 44x41
	}].concat(products.map(function (p) {
		return {
			src: path.join(DIST, h.imgPath(images, p.images[0].file, 400, '', true)), out: mailImageName(p, images),
			make: function () { return sharp(this.src).resize(120, 150, { fit: 'cover' }).flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }); }
		};
	}));
	for (const job of jobs) {
		const out = path.join(dir, job.out);
		if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(job.src).mtimeMs) continue;
		await job.make().toFile(out);
	}
	const keep = new Set(jobs.map(function (job) { return job.out; }));
	fs.readdirSync(dir).forEach(function (f) { if (!keep.has(f)) fs.rmSync(path.join(dir, f)); });
}

// Het JS-teken voor browsers en Google: de SVG's uit assets/brand, plus PNG's waar SVG niet werkt (app-icoon op de
// iPhone, favicon in de zoekresultaten, logo in de gestructureerde gegevens). Bron is de tegel: teken op Midnight Slate.
async function buildBrandImages() {
	const sharp = require('sharp');
	const src = path.join(ROOT, 'assets/brand');
	const dir = path.join(DIST, 'assets/brand');
	fs.mkdirSync(dir, { recursive: true });
	fs.readdirSync(src).filter(function (f) { return /\.svg$/i.test(f); }).forEach(function (f) {
		fs.copyFileSync(path.join(src, f), path.join(dir, f));
	});
	const tegelPad = path.join(src, 'js-icon-tegel.svg');
	const tegel = fs.readFileSync(tegelPad, 'utf8');
	const vierkant = Buffer.from(tegel.replace('rx="112"', 'rx="0"')); // de iPhone rondt de hoeken zelf af
	const jobs = [
		{ out: 'apple-touch-icon.png', input: vierkant, size: 180 },
		{ out: 'favicon-96.png', input: Buffer.from(tegel), size: 96 }, // Google wil een veelvoud van 48 px
		{ out: 'js-logo-512.png', input: vierkant, size: 512 }
	];
	for (const job of jobs) {
		const out = path.join(dir, job.out);
		if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(tegelPad).mtimeMs) continue;
		await sharp(job.input, { density: 300 }).resize(job.size, job.size).png({ compressionLevel: 9 }).toFile(out);
	}
}

// Productfeed voor Google Merchant Center (dist/feed.xml): één regel per bestelbare variant.
function buildFeed(products, images, site) {
	function x(value) { return h.esc(value).replace(/'/g, '&apos;'); }
	const items = [];
	products.filter(function (p) { return p.sale === 'cart'; }).forEach(function (p) {
		p.variants.forEach(function (v) {
			const multi = p.variants.length > 1;
			items.push('\t\t<item>\n'
				+ '\t\t\t<g:id>' + x(p.id + (multi ? '-' + v.id : '')) + '</g:id>\n'
				+ (multi ? '\t\t\t<g:item_group_id>' + x(p.id) + '</g:item_group_id>\n' : '')
				+ '\t\t\t<g:title>' + x(p.name + (multi ? ' – ' + v.label : '')) + '</g:title>\n'
				+ '\t\t\t<g:description>' + x(p.description.join(' ')) + '</g:description>\n'
				+ '\t\t\t<g:link>' + x(site.url + '/' + h.productUrl(p)) + '</g:link>\n'
				+ '\t\t\t<g:image_link>' + x(site.url + '/' + h.imgPath(images, p.images[0].file, 1200, '', true)) + '</g:image_link>\n'
				+ p.images.slice(1, 10).map(function (image) { return '\t\t\t<g:additional_image_link>' + x(site.url + '/' + h.imgPath(images, image.file, 1200, '', true)) + '</g:additional_image_link>\n'; }).join('')
				+ '\t\t\t<g:price>' + v.price.toFixed(2) + ' EUR</g:price>\n'
				+ '\t\t\t<g:availability>in_stock</g:availability>\n'
				+ '\t\t\t<g:condition>new</g:condition>\n'
				+ '\t\t\t<g:brand>' + x(site.name) + '</g:brand>\n'
				+ '\t\t\t<g:identifier_exists>no</g:identifier_exists>\n'
				+ '\t\t\t<g:product_type>' + x(site.types[p.type].label) + '</g:product_type>\n'
				+ (p.material ? '\t\t\t<g:material>' + x(p.material) + '</g:material>\n' : '')
				+ '\t\t</item>');
		});
	});
	return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n\t<channel>\n'
		+ '\t\t<title>' + x(site.name) + '</title>\n\t\t<link>' + x(site.url) + '</link>\n\t\t<description>' + x(site.slogan) + '</description>\n'
		+ items.join('\n') + '\n\t</channel>\n</rss>\n';
}

async function build() {
	const started = Date.now();
	const site = readJson('data/site.json');
	const products = readJson('data/products.json');
	const reviews = readJson('data/reviews.json');

	const today = new Date().toISOString().slice(0, 10);
	const report = validate(products, reviews, site); // eerst controleren, daarna pas prijzen aanpassen
	if (report.errors.length) {
		console.error('\nBuild gestopt, los eerst deze fouten op:\n - ' + report.errors.join('\n - ') + '\n');
		process.exit(1);
	}
	applyIntro(products, today);

	// 1. Afbeeldingen (incrementeel)
	const ogFor = products.map(function (p) { return p.images[0].file; }).concat(site.defaultOgImage);
	// Elke productfoto krijgt een uitsnede met het product in het midden (zie "subject" in products.json)
	const crops = {};
	products.forEach(function (p) {
		p.images.forEach(function (image) {
			crops[image.file] = { subject: image.subject || null, background: image.background || null, fill: image.fill || null };
		});
	});
	// Alleen foto's die de site echt toont worden verwerkt en meegestuurd
	const used = products.flatMap(function (p) { return p.images.map(function (image) { return image.file; }); })
		.concat(products.filter(function (p) { return p.video; }).map(function (p) { return p.video.poster; })) // voorbeeldbeeld van de video
		.concat(site.defaultOgImage, site.homeImages.hero.file, site.homeImages.about.file)
		.concat(site.portfolio.projects.map(function (p) { return p.file; }));
	const imageResult = await processImages({
		srcDir: path.join(ROOT, 'assets'),
		outDir: path.join(DIST, 'assets/img'),
		ogDir: path.join(DIST, 'assets/og'),
		ogFor: ogFor,
		only: used,
		crops: crops,
		frame: site.productFrame
	});
	const images = imageResult.manifest;

	// 2. Oude gegenereerde bestanden opruimen (de afbeeldingen blijven staan)
	['css', 'js', 'producten'].forEach(function (dir) {
		fs.rmSync(path.join(DIST, dir), { recursive: true, force: true });
	});

	// 3. CSS en JS, met een versienummer tegen verouderde browsercache
	const css = CSS_FILES.map(function (f) { return read('src/css/' + f); }).join('\n');
	const jsFiles = fs.readdirSync(path.join(ROOT, 'src/js')).filter(function (f) { return f.endsWith('.js'); });
	const catalog = buildCatalog(products, images);
	const hash = crypto.createHash('md5').update(css).update(catalog);
	jsFiles.forEach(function (f) { hash.update(read('src/js/' + f)); });
	// De 3D-modules (src/3d/) worden met Three.js erbij gebundeld tot één compact bestand per module.
	// De site laadt ze pas wanneer ze nodig zijn, zodat gewone pagina's er niet zwaarder van worden.
	const bundles = fs.readdirSync(path.join(ROOT, 'src/3d')).filter(function (f) { return f.endsWith('.js'); });
	bundles.forEach(function (f) { hash.update(read('src/3d/' + f)); });
	hash.update(JSON.parse(read('node_modules/three/package.json')).version);
	const version = hash.digest('hex').slice(0, 8);

	write('css/styles.css', css);
	write('js/catalog.js', catalog);
	write('js/winkel.json', buildWinkel(products, images, site));
	jsFiles.forEach(function (f) { write('js/' + f, versionImports(read('src/js/' + f), version)); });
	if (bundles.length) {
		require('esbuild').buildSync({
			entryPoints: bundles.map(function (f) { return path.join(ROOT, 'src/3d', f); }),
			outdir: path.join(DIST, 'js'),
			bundle: true, minify: true, format: 'esm', target: 'es2020', legalComments: 'eof', logLevel: 'warning'
		});
	}

	// 4. Statische bestanden
	fs.readdirSync(path.join(ROOT, 'assets')).filter(function (f) { return /\.svg$/i.test(f); }).forEach(function (f) {
		fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(DIST, 'assets', f));
	});
	await buildBrandImages();

	// Video's worden niet door de build gecomprimeerd (daar is ffmpeg voor nodig): "npm run video" maakt de
	// webversie in assets/video/, hier gaat alleen de kopie naar dist/
	const videoDir = path.join(ROOT, 'assets/video');
	if (fs.existsSync(videoDir)) {
		fs.mkdirSync(path.join(DIST, 'assets/video'), { recursive: true });
		fs.readdirSync(videoDir).filter(function (f) { return /\.(mp4|webm)$/i.test(f); }).forEach(function (f) {
			fs.copyFileSync(path.join(videoDir, f), path.join(DIST, 'assets/video', f));
		});
	}

	fs.mkdirSync(path.join(DIST, 'assets/fonts'), { recursive: true });
	fs.readdirSync(path.join(ROOT, 'assets/fonts')).filter(function (f) { return /\.(woff2|json)$/i.test(f); }).forEach(function (f) { // .json = lettertype voor de 3D-letters
		fs.copyFileSync(path.join(ROOT, 'assets/fonts', f), path.join(DIST, 'assets/fonts', f));
	});

	await buildMailImages(products, images);

	// 5. Pagina's
	const byId = {};
	products.forEach(function (p) { byId[p.id] = p; });
	const ctx = {
		site: site, products: products, reviews: reviews, images: images, byId: byId,
		version: version, year: new Date().getFullYear(),
		fonts: PRELOAD_FONTS,
		partials: {
			header: read('src/partials/header.html'),
			footer: read('src/partials/footer.html'),
			curtain: read('src/partials/curtain.html'),
			cart: read('src/partials/cart.html')
		}
	};

	const pages = [homePage(ctx, read('src/pages/index.html')), shopPage(ctx)]
		.concat((site.categoryPages || []).map(function (cat) { return categoryPage(cat, ctx); }))
		.concat([checkoutPage(ctx), thanksPage(ctx), printServicePage(ctx, read('src/pages/3d-printservice.html')), privacyPage(ctx, read('src/pages/privacy.html')), termsPage(ctx, read('src/pages/voorwaarden.html')), notFoundPage(ctx), newsletterPage(ctx), repliedPage(ctx)])
		.concat(products.map(function (p) { return productPage(p, ctx); }));
	pages.forEach(function (page) { write(page.path, layout(page, ctx)); });

	// 6. sitemap.xml en robots.txt
	write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
		+ pages.filter(function (p) { return !p.noindex; }).map(function (p) {
			return '\t<url><loc>' + site.url + '/' + (p.path === 'index.html' ? '' : p.path) + '</loc><lastmod>' + today + '</lastmod></url>';
		}).join('\n') + '\n</urlset>\n');
	write('feed.xml', buildFeed(products, images, site));
	write('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: ' + site.url + '/sitemap.xml\n');

	// 7. Verslag
	console.log('\n✓ ' + pages.length + ' pagina\'s gebouwd in dist/ (' + products.length + ' producten, versie ' + version + ')');
	console.log('✓ Afbeeldingen: ' + imageResult.processed + ' nieuw verwerkt, ' + imageResult.total + ' totaal');
	if (report.warnings.length) console.log('\nWaarschuwingen:\n - ' + report.warnings.join('\n - '));
	// Een introductieprijs is een belofte met een datum: laat zien wanneer hij afloopt of dat hij voorbij is
	products.filter(function (p) { return p.intro; }).forEach(function (p) {
		const days = Math.round((new Date(p.intro.until) - new Date(today)) / 86400000);
		if (!p.intro.active) console.log('\nDe introductieprijs van de ' + p.name + ' is voorbij (' + p.intro.until + '): de site rekent nu ' + h.euro(p.variants[0].price) + '.');
		else if (days <= 14) console.log('\nLet op: de introductieprijs van de ' + p.name + ' loopt nog ' + days + ' dag(en), tot ' + p.intro.until + '. Daarna wordt het vanzelf ' + h.euro(p.variants[0].regularPrice) + '.');
	});
	const address = site.address || {};
	if (!address.street && !address.onRequest) {
		console.log('\n⚠ WETTELIJK VERPLICHT: vul je vestigingsadres in bij data/site.json > address (street en postcode).\n  Nu staat alleen "' + (address.city || '') + '" in de footer, de privacyverklaring en de algemene voorwaarden.');
	} else if (address.street && !address.postcode) {
		console.log('\nLet op: bij data/site.json > address ontbreekt je postcode nog. Het adres staat nu als "' + address.street + ', ' + (address.city || '') + '" op de site.');
	}
	if (report.todos.length) console.log('\nNog in te vullen in data/products.json:\n - ' + report.todos.join('\n - '));
	console.log('\nKlaar in ' + ((Date.now() - started) / 1000).toFixed(1) + 's. Zet je wijzigingen op GitHub (branch main) om ze live te zetten.\n');
}

build().catch(function (error) {
	console.error('\nBuild mislukt: ' + error.message + '\n');
	process.exit(1);
});
