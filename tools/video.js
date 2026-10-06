// Maakt van een grote video een webversie: assets/<naam>.mp4 -> assets/video/<naam>.mp4 (720p, zonder geluid).
// Daarnaast maakt hij een voorbeeldbeeld (poster) uit de video, dat je in products.json bij "video" opgeeft.
//
// Gebruik:  npm run video -- mijnwerkerslamp_promo.mp4 mijnwerkerslamp-promo 17
//           (bestand in assets/, naam van de webversie, en de seconde waaruit het voorbeeldbeeld komt)
//
// Hiervoor is ffmpeg nodig (https://ffmpeg.org). De build zelf heeft het NIET nodig: die kopieert alleen
// wat er in assets/video/ staat. Zo blijft de online build werken zonder extra software.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const [source, name, posterAt] = process.argv.slice(2);

if (!source || !name) {
	console.error('\nGebruik: npm run video -- <bestand in assets/> <naam webversie> [seconde voor het voorbeeldbeeld]\n');
	process.exit(1);
}

const input = path.join(ROOT, 'assets', source);
if (!fs.existsSync(input)) {
	console.error('\nassets/' + source + ' bestaat niet.\n');
	process.exit(1);
}

function run(args) {
	const result = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
	if (result.error) {
		console.error('\nffmpeg is niet gevonden. Installeer het van https://ffmpeg.org en probeer opnieuw.\n');
		process.exit(1);
	}
	if (result.status !== 0) process.exit(result.status);
}

fs.mkdirSync(path.join(ROOT, 'assets/video'), { recursive: true });
const output = path.join(ROOT, 'assets/video', name + '.mp4');
// 720p is ruim genoeg voor de breedte waarop de video op de site staat; geluid gaat eruit (de video heeft het niet nodig)
run(['-v', 'error', '-i', input, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-crf', '25', '-preset', 'slow',
	'-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', output, '-y']);

const poster = path.join(ROOT, 'assets', name.charAt(0).toUpperCase() + name.slice(1) + '-poster.jpg');
run(['-v', 'error', '-ss', String(Number(posterAt) || 1), '-i', input, '-frames:v', '1', '-q:v', '2', poster, '-y']);

const mb = f => (fs.statSync(f).size / 1048576).toFixed(2) + ' MB';
console.log('\n✓ assets/video/' + name + '.mp4 (' + mb(output) + ', was ' + mb(input) + ')');
console.log('✓ ' + path.relative(ROOT, poster).replace(/\\/g, '/') + ' (' + mb(poster) + ')');
console.log('\nZet ze in data/products.json bij het product:\n  "video": { "file": "' + name + '.mp4", "poster": "' + path.basename(poster) + '", "heading": "...", "alt": "..." }\n');
