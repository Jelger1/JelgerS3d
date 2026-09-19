// De homepage: vult src/pages/index.html met data (rails, reviews, afbeeldingen).
const h = require('./helpers');
const c = require('./components');

function homePage(ctx, template) {
	const site = ctx.site;

	function rail(collection) {
		const items = ctx.products.filter(function (p) { return p.collection === collection; });
		return c.productRail(items, ctx, { root: '' });
	}

	const values = {
		heroImage: h.img(ctx.images, site.homeImages.hero.file, {
			alt: site.homeImages.hero.alt,
			sizes: '(max-width: 900px) 320px, 460px', eager: true
		}),
		aboutImage: h.img(ctx.images, site.homeImages.about.file, {
			alt: site.homeImages.about.alt,
			sizes: '280px', className: 'about-photo-visible'
		}),
		'rail:design': rail('design'),
		'rail:limburg': rail('limburg'),
		contactKey: h.esc(site.web3forms.contactKey),
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
			address: { '@type': 'PostalAddress', addressRegion: site.region, addressCountry: 'NL' },
			areaServed: { '@type': 'Country', name: 'Nederland' },
			vatID: site.btw,
			sameAs: [site.instagram]
		}, {
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: site.name,
			url: site.url
		}],
		main: main
	};
}

module.exports = homePage;
