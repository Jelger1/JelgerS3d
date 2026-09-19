// Tekent de straatnaam-sleutelhanger op een canvas: blauw bord, witte rand, witte letters en een sleutelring.
// Dezelfde functie wordt gebruikt voor de live preview én voor de PNG-download, dus wat je ziet is wat je opslaat.
// Alles is getekend in een vast raster van 1200 x 600 en wordt geschaald naar de gevraagde breedte.

const W = 1200, H = 600;
const PLATE = { x: 250, y: 165, w: 880, h: 270, r: 40 };   // het bord
const LUG = { x: 236, y: 300, r: 64, hole: 25 };           // het oog links waar de ring doorheen gaat
const RING = { x: 128, y: 246, r: 121, width: 13 };        // de sleutelring (loopt precies door het oog)
const DEPTH = 11;                                          // zichtbare dikte van de print
const BLUE_TOP = '#2460c2', BLUE_BOTTOM = '#17458f', BLUE_SIDE = '#0e2c61';
const FONT = '700 {size}px "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';

export const MAX_LENGTH = 32;

// Alleen tekens die goed te printen zijn; dubbele spaties worden één spatie
export function cleanText(value) {
	return String(value || '')
		.replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ .,'’&\-]/g, '')
		.replace(/\s+/g, ' ')
		.replace(/^\s+/, '')
		.slice(0, MAX_LENGTH);
}

function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

// Bord + oog als één vorm, met het gat eruit gesneden
function plateShape(ctx, offsetY, fill) {
	ctx.fillStyle = fill;
	roundRect(ctx, PLATE.x, PLATE.y + offsetY, PLATE.w, PLATE.h, PLATE.r);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(LUG.x, LUG.y + offsetY, LUG.r, 0, Math.PI * 2);
	ctx.fill();
}

function ringStroke(ctx, from, to) {
	const metal = ctx.createLinearGradient(RING.x - RING.r, RING.y - RING.r, RING.x + RING.r, RING.y + RING.r);
	metal.addColorStop(0, '#f4f6f8');
	metal.addColorStop(0.35, '#aab2bd');
	metal.addColorStop(0.6, '#e6e9ee');
	metal.addColorStop(1, '#7d8794');
	ctx.lineCap = 'butt';
	ctx.strokeStyle = 'rgba(0,0,0,0.28)';
	ctx.lineWidth = RING.width + 3;
	ctx.beginPath(); ctx.arc(RING.x, RING.y + 3, RING.r, from, to); ctx.stroke();
	ctx.strokeStyle = metal;
	ctx.lineWidth = RING.width;
	ctx.beginPath(); ctx.arc(RING.x, RING.y, RING.r, from, to); ctx.stroke();
	// glanslijntje
	ctx.strokeStyle = 'rgba(255,255,255,0.55)';
	ctx.lineWidth = 2.5;
	ctx.beginPath(); ctx.arc(RING.x, RING.y, RING.r - RING.width / 2 + 3, from, to); ctx.stroke();
}

// text: de straatnaam. options: { placeholder, background } (background = kleur, of leeg voor transparant)
export function drawSign(canvas, text, options) {
	options = options || {};
	const ctx = canvas.getContext('2d');
	const scale = canvas.width / W;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	if (options.background) { ctx.fillStyle = options.background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
	// verticaal centreren als het canvas hoger is dan 2:1 (bv. de vierkante productfoto)
	ctx.setTransform(scale, 0, 0, scale, 0, (canvas.height - H * scale) / 2);

	// 1. De ring ligt achter het bord...
	ringStroke(ctx, 0, Math.PI * 2);

	// 2. ...het bord zelf op een eigen laag, zodat het gat echt doorzichtig is
	const layer = document.createElement('canvas');
	layer.width = canvas.width; layer.height = Math.round(H * scale);
	const l = layer.getContext('2d');
	l.setTransform(scale, 0, 0, scale, 0, 0);
	plateShape(l, DEPTH, BLUE_SIDE); // dikte van de print
	const blue = l.createLinearGradient(0, PLATE.y, 0, PLATE.y + PLATE.h);
	blue.addColorStop(0, BLUE_TOP);
	blue.addColorStop(1, BLUE_BOTTOM);
	plateShape(l, 0, blue);
	// witte rand, net binnen de rand van het bord
	l.strokeStyle = '#ffffff';
	l.lineWidth = 9;
	roundRect(l, PLATE.x + 17, PLATE.y + 17, PLATE.w - 34, PLATE.h - 34, PLATE.r - 14);
	l.stroke();
	// het gat
	l.globalCompositeOperation = 'destination-out';
	l.beginPath(); l.arc(LUG.x, LUG.y, LUG.hole, 0, Math.PI * 2); l.fill();
	l.globalCompositeOperation = 'source-over';
	// randje om het gat voor diepte
	l.strokeStyle = 'rgba(8,24,56,0.55)';
	l.lineWidth = 3;
	l.beginPath(); l.arc(LUG.x, LUG.y + 1.5, LUG.hole + 1, 0, Math.PI * 2); l.stroke();

	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,0.38)';
	ctx.shadowBlur = 26 * scale;
	ctx.shadowOffsetY = 14 * scale;
	ctx.setTransform(1, 0, 0, 1, 0, (canvas.height - H * scale) / 2);
	ctx.drawImage(layer, 0, 0);
	ctx.restore();
	ctx.setTransform(scale, 0, 0, scale, 0, (canvas.height - H * scale) / 2);

	// 3. Het stuk ring dat vóór het oog langs loopt (de rest verdwijnt erachter)
	const atHole = Math.atan2(LUG.y - RING.y, LUG.x - RING.x);
	ringStroke(ctx, atHole, atHole + 0.62);

	// 4. De tekst: gecentreerd, en automatisch kleiner als de naam langer is
	const label = text || options.placeholder || '';
	if (label) {
		const maxWidth = PLATE.w - 150;
		let size = 128;
		ctx.font = FONT.replace('{size}', size);
		const measured = ctx.measureText(label).width;
		if (measured > maxWidth) size = Math.max(44, Math.floor(size * maxWidth / measured));
		ctx.font = FONT.replace('{size}', size);
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.save();
		ctx.globalAlpha = text ? 1 : 0.45; // voorbeeldtekst is lichter dan echte invoer
		ctx.shadowColor = 'rgba(6,20,48,0.55)';
		ctx.shadowBlur = 0;
		ctx.shadowOffsetY = 4 * scale;
		ctx.fillStyle = '#ffffff';
		ctx.fillText(label, PLATE.x + PLATE.w / 2, PLATE.y + PLATE.h / 2 + size * 0.04);
		ctx.restore();
	}
}

// Maakt een PNG van het ontwerp (standaard 2400 x 1200 pixels op een lichte achtergrond)
export function signToBlob(text, options) {
	options = options || {};
	const canvas = document.createElement('canvas');
	canvas.width = options.width || 2400;
	canvas.height = options.height || Math.round(canvas.width / 2);
	drawSign(canvas, text, { background: options.background === undefined ? '#eef1f5' : options.background, placeholder: options.placeholder });
	return new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
}
