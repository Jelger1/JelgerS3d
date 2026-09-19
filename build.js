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
const h = require('./src/templates/helpers');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SALE_TYPES = ['cart', 'external', 'request', 'soon'];
// Volgorde is van belang: later wint van eerder. Alles wordt samengevoegd tot één css/styles.css.
const CSS_FILES = ['reset.css', 'styles.css', 'components.css', 'product.css'];

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
		if (!(p.images && p.images.length)) errors.push(where + ': minstens één afbeelding nodig');
		(p.images || []).forEach(function (image) {
			if (!fs.existsSync(path.join(ROOT, 'assets', image.file))) errors.push(where + ': afbeelding assets/' + image.file + ' bestaat niet');
			if (!image.alt) warnings.push(where + ': alt-tekst ontbreekt bij ' + image.file);
		});
		if (!p.seo || !p.seo.title || !p.seo.description) errors.push(where + ': seo.title en seo.description zijn verplicht');
		else {
			if (p.seo.title.length > 65) warnings.push(where + ': seo.title is ' + p.seo.title.length + ' tekens (richtlijn: max 65)');
			if (p.seo.description.length > 160) warnings.push(where + ': seo.description is ' + p.seo.description.length + ' tekens (richtlijn: max 160)');
		}
		if (!p.material) todos.push(p.name + ': materiaal');
	});

	products.forEach(function (p) {
		(p.related || []).forEach(function (id) {
			if (!ids.has(id) || id === p.id) errors.push('products.json > "' + p.id + '": related "' + id + '" bestaat niet');
		});
	});
	reviews.forEach(function (r) {
		(r.products || []).forEach(function (id) {
			if (!ids.has(id)) errors.push('reviews.json > ' + r.author + ': product "' + id + '" bestaat niet');
		});
	});

	return { errors: errors, warnings: warnings, todos: todos };
}

// Zet ?v=<versie> achter relatieve imports, zodat browsers na een update nooit oude en nieuwe modules mengen
function versionImports(source, version) {
	return source.replace(/(from\s+|import\s+)(['"])(\.\/[^'"]+?\.js)\2/g, function (m, keyword, quote, spec) {
		return keyword + quote + spec + '?v=' + version + quote;
	});
}

function buildCatalog(products, images) {
	const catalog = {};
	products.forEach(function (p) {
		catalog[p.id] = {
			name: p.name,
			url: h.productUrl(p),
			image: h.imgPath(images, p.images[0].file, 400),
			sale: p.sale,
			variants: p.variants || []
		};
	});
	return 'export default ' + JSON.stringify(catalog, null, '\t') + ';\n';
}

async function build() {
	const started = Date.now();
	const site = readJson('data/site.json');
	const products = readJson('data/products.json');
	const reviews = readJson('data/reviews.json');

	const report = validate(products, reviews, site);
	if (report.errors.length) {
		console.error('\nBuild gestopt, los eerst deze fouten op:\n - ' + report.errors.join('\n - ') + '\n');
		process.exit(1);
	}

	// 1. Afbeeldingen (incrementeel)
	const ogFor = products.map(function (p) { return p.images[0].file; }).concat(site.defaultOgImage);
	// Alleen foto's die de site echt toont worden verwerkt en meegestuurd
	const used = products.flatMap(function (p) { return p.images.map(function (image) { return image.file; }); })
		.concat(site.defaultOgImage, site.homeImages.hero.file, site.homeImages.about.file);
	const imageResult = await processImages({
		srcDir: path.join(ROOT, 'assets'),
		outDir: path.join(DIST, 'assets/img'),
		ogDir: path.join(DIST, 'assets/og'),
		ogFor: ogFor,
		only: used
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
	const version = hash.digest('hex').slice(0, 8);

	write('css/styles.css', css);
	write('js/catalog.js', catalog);
	jsFiles.forEach(function (f) { write('js/' + f, versionImports(read('src/js/' + f), version)); });

	// 4. Statische bestanden
	fs.readdirSync(path.join(ROOT, 'assets')).filter(function (f) { return /\.svg$/i.test(f); }).forEach(function (f) {
		fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(DIST, 'assets', f));
	});

	// 5. Pagina's
	const byId = {};
	products.forEach(function (p) { byId[p.id] = p; });
	const ctx = {
		site: site, products: products, reviews: reviews, images: images, byId: byId,
		version: version, year: new Date().getFullYear(),
		partials: {
			header: read('src/partials/header.html'),
			footer: read('src/partials/footer.html'),
			cart: read('src/partials/cart.html')
		}
	};

	const pages = [homePage(ctx, read('src/pages/index.html')), shopPage(ctx)]
		.concat(products.map(function (p) { return productPage(p, ctx); }));
	pages.forEach(function (page) { write(page.path, layout(page, ctx)); });

	// 6. sitemap.xml en robots.txt
	const today = new Date().toISOString().slice(0, 10);
	write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
		+ pages.filter(function (p) { return !p.noindex; }).map(function (p) {
			return '\t<url><loc>' + site.url + '/' + (p.path === 'index.html' ? '' : p.path) + '</loc><lastmod>' + today + '</lastmod></url>';
		}).join('\n') + '\n</urlset>\n');
	write('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: ' + site.url + '/sitemap.xml\n');

	// 7. Verslag
	console.log('\n✓ ' + pages.length + ' pagina\'s gebouwd in dist/ (' + products.length + ' producten, versie ' + version + ')');
	console.log('✓ Afbeeldingen: ' + imageResult.processed + ' nieuw verwerkt, ' + imageResult.total + ' totaal');
	if (report.warnings.length) console.log('\nWaarschuwingen:\n - ' + report.warnings.join('\n - '));
	if (report.todos.length) console.log('\nNog in te vullen in data/products.json:\n - ' + report.todos.join('\n - '));
	console.log('\nKlaar in ' + ((Date.now() - started) / 1000).toFixed(1) + 's. Upload de inhoud van de map dist/ naar je hosting.\n');
}

build().catch(function (error) {
	console.error('\nBuild mislukt: ' + error.message + '\n');
	process.exit(1);
});
