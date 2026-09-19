// Lokale ontwikkelserver: bouwt de site, serveert dist/ op http://localhost:3000
// en bouwt opnieuw zodra je iets wijzigt in data/, src/ of assets/.
// Gebruik: npm run dev   (of dubbelklik start.bat)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
	'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg',
	'.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8'
};

let building = false, queued = false;

function build() {
	if (building) { queued = true; return; }
	building = true;
	const child = spawn(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'inherit' });
	child.on('exit', function () {
		building = false;
		if (queued) { queued = false; build(); }
	});
}

let timer;
['data', 'src', 'assets'].forEach(function (dir) {
	fs.watch(path.join(ROOT, dir), { recursive: true }, function () {
		clearTimeout(timer);
		timer = setTimeout(build, 200);
	});
});

http.createServer(function (req, res) {
	let pathname = decodeURIComponent(req.url.split('?')[0]);
	if (pathname.endsWith('/')) pathname += 'index.html';
	const file = path.normalize(path.join(DIST, pathname));
	if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }

	fs.readFile(file, function (error, content) {
		if (error) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 - niet gevonden'); return; }
		res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
		res.end(content);
	});
}).listen(PORT, function () {
	console.log('\nJelgerS3D draait op http://localhost:' + PORT + '  (stoppen: Ctrl+C)\n');
});

build();
