// Zet een TrueType-font om naar het "typeface.json"-formaat dat Three.js gebruikt voor 3D-letters.
// Alleen nodig als je een ander lettertype op de 3D-sleutelhanger wilt; het resultaat staat al in assets/fonts/.
// Gebruik: node tools/make-3d-font.js
//
// Bron: tools/fonts/Arimo-Bold.ttf (Arimo, SIL Open Font License; zelfde vormen als Arial, met alle Europese tekens).
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const SOURCE = path.join(__dirname, 'fonts', 'Arimo-Bold.ttf');
const TARGET = path.join(__dirname, '..', 'assets', 'fonts', 'arimo-bold.typeface.json');

// Dezelfde tekens die de ontwerptool toelaat (zie cleanText in src/js/keychain-sign.js)
let chars = " .,'’&-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
for (let code = 0xC0; code <= 0xFF; code++) if (code !== 0xD7 && code !== 0xF7) chars += String.fromCharCode(code);

const buffer = fs.readFileSync(SOURCE);
const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const scale = (1000 * 100) / ((font.unitsPerEm || 2048) * 72); // zelfde schaal als de officiële omzetter (facetype.js)
const round = function (n) { return Math.round(n * scale); };

const glyphs = {};
const missing = [];
Array.from(new Set(chars)).forEach(function (char) {
	const glyph = font.charToGlyph(char);
	if (!glyph || (glyph.index === 0 && char !== ' ')) { missing.push(char); return; }
	let outline = '';
	glyph.getPath(0, 0, font.unitsPerEm).commands.forEach(function (c) {
		// opentype.js heeft de y-as naar beneden, Three.js naar boven: daarom -y.
		// Let op de volgorde: bij q en b komt in dit formaat eerst het eindpunt en dan de controlepunten.
		if (c.type === 'M') outline += 'm ' + round(c.x) + ' ' + round(-c.y) + ' ';
		else if (c.type === 'L') outline += 'l ' + round(c.x) + ' ' + round(-c.y) + ' ';
		else if (c.type === 'Q') outline += 'q ' + round(c.x) + ' ' + round(-c.y) + ' ' + round(c.x1) + ' ' + round(-c.y1) + ' ';
		else if (c.type === 'C') outline += 'b ' + round(c.x) + ' ' + round(-c.y) + ' ' + round(c.x1) + ' ' + round(-c.y1) + ' ' + round(c.x2) + ' ' + round(-c.y2) + ' ';
	});
	const box = glyph.getBoundingBox();
	glyphs[char] = { ha: round(glyph.advanceWidth), x_min: round(box.x1), x_max: round(box.x2), o: outline.trim() };
});

const data = {
	glyphs: glyphs,
	familyName: 'Arimo',
	ascender: round(font.ascender),
	descender: round(font.descender),
	underlinePosition: round(font.tables.post.underlinePosition),
	underlineThickness: round(font.tables.post.underlineThickness),
	boundingBox: { yMin: round(font.tables.head.yMin), xMin: round(font.tables.head.xMin), yMax: round(font.tables.head.yMax), xMax: round(font.tables.head.xMax) },
	resolution: 1000,
	original_font_information: { license: 'SIL Open Font License 1.1', source: 'https://github.com/googlefonts/Arimo', style: 'Bold' }
};

fs.mkdirSync(path.dirname(TARGET), { recursive: true });
fs.writeFileSync(TARGET, JSON.stringify(data));
console.log('✓ ' + Object.keys(glyphs).length + ' tekens omgezet naar ' + path.relative(path.join(__dirname, '..'), TARGET)
	+ ' (' + Math.round(fs.statSync(TARGET).size / 1024) + ' KB)' + (missing.length ? '\n  niet in het font: ' + missing.join(' ') : ''));
