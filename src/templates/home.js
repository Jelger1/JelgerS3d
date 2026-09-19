// De homepage: vult src/pages/index.html met data (USP's, categorieën, rails, FAQ, afbeeldingen).
const h = require('./helpers');
const c = require('./components');

const USP_ICONS = [
	'<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
	'<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
	'<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
	'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>'
];

function homePage(ctx, template) {
	const site = ctx.site;

	function rail(collection) {
		const items = ctx.products.filter(function (p) { return p.collection === collection; });
		return c.productRail(items, ctx, { root: '' });
	}

	const usps = site.homeUsps.map(function (usp, i) {
		return '<li><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + USP_ICONS[i % USP_ICONS.length] + '</svg>'
			+ '<div><strong>' + h.esc(usp.title) + '</strong><span>' + h.esc(usp.text) + '</span></div></li>';
	}).join('\n\t\t');

	const categories = site.homeCategories.map(function (cat) {
		return '<li><a class="category-tile" href="' + h.esc(cat.href) + '">'
			+ h.img(ctx.images, cat.image, { alt: '', sizes: '(max-width: 600px) 45vw, (max-width: 900px) 45vw, 290px', crop: true })
			+ '<span class="category-tile-text"><strong>' + h.esc(cat.label) + '</strong><span>' + h.esc(cat.text) + '</span></span>'
			+ '</a></li>';
	}).join('\n\t\t');

	const faq = site.faq.map(function (item) {
		return '<details class="faq-item"><summary>' + h.esc(item.q) + '</summary><p>' + h.esc(item.a) + '</p></details>';
	}).join('\n\t\t');

	const values = {
		heroImage: h.img(ctx.images, site.homeImages.hero.file, {
			alt: site.homeImages.hero.alt,
			sizes: '(max-width: 900px) 320px, 460px', eager: true
		}),
		aboutImage: h.img(ctx.images, site.homeImages.about.file, {
			alt: site.homeImages.about.alt,
			sizes: '(max-width: 900px) 280px, 380px'
		}),
		customImage: h.img(ctx.images, 'JS3D-LightBox.jpeg', {
			alt: 'Voorbeeld van maatwerk: het JelgerS3D-logo als verlichte lightbox',
			sizes: '(max-width: 900px) 320px, 420px', crop: true
		}),
		usps: usps,
		categories: categories,
		faq: faq,
		'rail:design': rail('design'),
		'rail:limburg': rail('limburg'),
		contactKey: h.esc(site.web3forms.contactKey),
		privacyCheckbox: h.privacyCheckbox(site, '', 'cf-privacy', false),
		reviews: c.reviewsSection(ctx.reviews, 'Wat klanten zeggen')
	};
	Object.keys(site.collections).forEach(function (key) {
		values['collection:' + key + ':label'] = h.esc(site.collections[key].label);
		values['collection:' + key + ':intro'] = h.esc(site.collections[key].intro);
	});

	const main = h.fill(template.replace(/^<!--[\s\S]*?-->\s*/, ''), values);

	return {
		path: 'index.html',
		root: '',
		name: 'home',
		title: site.name + ' – 3D-geprint design uit Limburg | Vazen, lampen & cadeaus',
		description: site.owner + ' ontwerpt en print unieke vazen, lampen en Limburgse cadeaus. Eigen ontwerp, speciaal voor jou gemaakt in Limburg. Ook maatwerk en custom lightboxen.',
		ogImage: ctx.images[site.defaultOgImage].og,
		preload: {
			srcset: ctx.images[site.homeImages.hero.file].variants.map(function (v) { return 'assets/img/' + v.file + ' ' + v.w + 'w'; }).join(', '),
			sizes: '(max-width: 900px) 320px, 460px'
		},
		jsonLd: [{
			'@context': 'https://schema.org',
			'@type': 'Organization',
			name: site.name,
			alternateName: ['Jelger S3D', 'Jelgers3d', 'Jelger 3D'],
			description: site.owner + ' maakt unieke 3D-geprinte ontwerpen met karakter, lokaal gemaakt in Limburg.',
			url: site.url,
			logo: site.url + '/assets/js-3D-LOGO-BIG.svg',
			image: site.url + '/assets/og/' + ctx.images[site.defaultOgImage].og,
			email: site.email,
			founder: { '@type': 'Person', name: site.owner, jobTitle: '3D Designer & Maker' },
			address: { '@type': 'PostalAddress', addressLocality: site.pickupLocation, addressRegion: site.region, addressCountry: 'NL' },
			areaServed: { '@type': 'Country', name: 'Nederland' },
			vatID: site.btw,
			sameAs: [site.instagram]
		}, {
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: site.name,
			url: site.url
		}, {
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: site.faq.map(function (item) {
				return { '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } };
			})
		}],
		main: main
	};
}

module.exports = homePage;
