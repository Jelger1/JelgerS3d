// 3D-model van de straatnaam-sleutelhanger (Three.js / WebGL).
// Dit bestand wordt door de build met esbuild gebundeld tot dist/js/keychain-3d.js en pas geladen
// wanneer de ontwerptool in beeld komt. Lukt 3D niet (geen WebGL), dan blijft de 2D-preview staan.
//
// Maten zijn in millimeters, zoals bij een echte print: bord 70 x 22 x 3 mm, letters en rand 0,8 mm opliggend.
import {
	WebGLRenderer, Scene, PerspectiveCamera, Group, Shape, Path, ExtrudeGeometry, TorusGeometry, Mesh,
	MeshStandardMaterial, MeshMatcapMaterial, CanvasTexture, DirectionalLight, HemisphereLight, Color, SRGBColorSpace, NeutralToneMapping, MathUtils
} from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const PLATE = { left: -32, right: 38, half: 11, radius: 3.2, thick: 3 };
const LUG = { x: -34, y: 0, r: 7.5, hole: 2.6 };
const RING = { r: 10, tube: 0.9, tilt: MathUtils.degToRad(64) };
const RAISE = 0.8;                       // hoe ver rand en letters boven het bord uitsteken
// capHeight: hoogte van een hoofdletter als deel van "size" (Arimo: 1409/2048 em, en 1 size = 1,389 em in dit fontformaat)
const TEXT = { size: 9, capHeight: 0.956, maxWidth: 56, centerX: (PLATE.left + PLATE.right) / 2 };
const MODEL_WIDTH = PLATE.right - (LUG.x - 2 * RING.r - RING.tube); // van ring tot rechterrand
const MODEL_CENTER_X = (PLATE.right + (LUG.x - 2 * RING.r - RING.tube)) / 2;
const REST = { yaw: -0.42, pitch: 0.16 }; // de stand waarin het model begint en waarin de download wordt gemaakt
const FRONT = 1.05;                       // verder dan dit (in radialen) blijft het bord niet weggedraaid staan

function roundedRect(shape, x0, y0, x1, y1, r) {
	shape.moveTo(x0 + r, y0);
	shape.lineTo(x1 - r, y0);
	shape.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
	shape.lineTo(x1, y1 - r);
	shape.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
	shape.lineTo(x0 + r, y1);
	shape.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
	return shape;
}

// Het bord met het oog eraan vast, als één doorlopende omtrek, en het gat erin
function plateGeometry() {
	const shape = new Shape();
	const { left, right, half, radius } = PLATE;
	roundedRect(shape, left, -half, right, half, radius);
	// langs de linkerkant omlaag: eerst tot waar het oog begint, dan rond het oog, dan verder omlaag
	const dy = Math.sqrt(LUG.r * LUG.r - Math.pow(left - LUG.x, 2));
	const a = Math.atan2(dy, left - LUG.x);
	shape.lineTo(left, dy);
	shape.absarc(LUG.x, LUG.y, LUG.r, a, Math.PI * 2 - a, false);
	shape.lineTo(left, -half + radius);
	shape.absarc(left + radius, -half + radius, radius, Math.PI, Math.PI * 1.5, false);
	const hole = new Path();
	hole.absarc(LUG.x, LUG.y, LUG.hole, 0, Math.PI * 2, true);
	shape.holes.push(hole);

	const bevel = 0.45;
	const geometry = new ExtrudeGeometry(shape, { depth: PLATE.thick - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 28 });
	geometry.translate(0, 0, -PLATE.thick / 2 + bevel);
	return geometry;
}

// De witte rand: een afgeronde rechthoek met een iets kleinere rechthoek eruit
function borderGeometry() {
	const inset = 1.7, line = 1.35;
	const outer = new Shape();
	roundedRect(outer, PLATE.left + inset, -PLATE.half + inset, PLATE.right - inset, PLATE.half - inset, PLATE.radius - 0.9);
	outer.lineTo(PLATE.left + inset, -PLATE.half + inset + (PLATE.radius - 0.9));
	outer.absarc(PLATE.left + inset + PLATE.radius - 0.9, -PLATE.half + inset + PLATE.radius - 0.9, PLATE.radius - 0.9, Math.PI, Math.PI * 1.5, false);
	const inner = new Path();
	const i = inset + line, r = Math.max(0.6, PLATE.radius - 0.9 - line);
	roundedRect(inner, PLATE.left + i, -PLATE.half + i, PLATE.right - i, PLATE.half - i, r);
	inner.lineTo(PLATE.left + i, -PLATE.half + i + r);
	inner.absarc(PLATE.left + i + r, -PLATE.half + i + r, r, Math.PI, Math.PI * 1.5, false);
	outer.holes.push(inner);
	const geometry = new ExtrudeGeometry(outer, { depth: RAISE, bevelEnabled: false, curveSegments: 20 });
	geometry.translate(0, 0, PLATE.thick / 2);
	return geometry;
}

// Het glimmende metaal van de ring is een "matcap": een klein plaatje van een gepolijste bol dat over de ring wordt gelegd.
// Dat ziet eruit als echt chroom, maar kost een telefoon vrijwel niets (geen spiegelende omgeving om uit te rekenen).
function chromeTexture() {
	const size = 128, c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d');
	const sky = ctx.createLinearGradient(0, 0, 0, size);
	[[0, '#f4f6f9'], [0.28, '#aab3bf'], [0.46, '#59626e'], [0.53, '#262b33'], [0.63, '#69727e'], [0.86, '#b4bcc7'], [1, '#e2e6ec']].forEach(function (stop) { sky.addColorStop(stop[0], stop[1]); });
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, size, size);
	const glow = ctx.createRadialGradient(size * 0.36, size * 0.26, 0, size * 0.36, size * 0.26, size * 0.3);
	glow.addColorStop(0, 'rgba(255,255,255,0.85)');
	glow.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, size, size);
	const texture = new CanvasTexture(c);
	texture.colorSpace = SRGBColorSpace;
	return texture;
}

// Het opbouwen gebeurt in stapjes met telkens een korte adempauze, zodat de pagina intussen gewoon blijft reageren (typen, scrollen)
function pause() { return new Promise(function (resolve) { setTimeout(resolve, 0); }); }

export async function createKeychain3D(canvas, options) {
	options = options || {};
	// failIfMajorPerformanceCaveat: op een apparaat zonder bruikbare grafische chip mislukt dit bewust, en blijft de 2D-tekening staan
	const renderer = new WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = NeutralToneMapping; // houdt het blauw echt blauw, ook waar het licht er recht op valt

	const font = await new FontLoader().loadAsync(options.fontUrl);

	const scene = new Scene();
	// Studiolicht: zacht licht van boven, een hoofdlamp linksboven en een zwakke lamp van rechts tegen te harde schaduwkanten
	scene.add(new HemisphereLight(0xffffff, 0x8f9bb0, 2.7));
	const key = new DirectionalLight(0xffffff, 2.5);
	key.position.set(-40, 70, 60);
	scene.add(key);
	const fill = new DirectionalLight(0xffffff, 0.8);
	fill.position.set(60, -10, 40);
	scene.add(fill);

	const camera = new PerspectiveCamera(20, 2, 1, 1000); // smalle lens: weinig vertekening, zoals bij een productfoto
	const model = new Group();
	model.position.x = -MODEL_CENTER_X; // het geheel (ring + bord) in het midden van beeld
	const pivot = new Group();
	pivot.add(model);
	scene.add(pivot);

	const blue = new MeshStandardMaterial({ color: new Color('#1a4fae'), roughness: 0.72, metalness: 0 });
	const white = new MeshStandardMaterial({ color: new Color('#f7f8fa'), roughness: 0.6, metalness: 0 });
	const ghost = new MeshStandardMaterial({ color: new Color('#f7f8fa'), roughness: 0.6, transparent: true, opacity: 0.45 });
	const metal = new MeshMatcapMaterial({ matcap: chromeTexture() });

	await pause();
	model.add(new Mesh(plateGeometry(), blue));
	await pause();
	model.add(new Mesh(borderGeometry(), white));

	// De ring loopt door het gat: het midden ligt één straal links van het gat, en hij staat schuin
	const ring = new Mesh(new TorusGeometry(RING.r, RING.tube, 20, 96), metal);
	ring.position.set(LUG.x - RING.r, LUG.y, 0);
	ring.rotation.x = RING.tilt;
	model.add(ring);

	let textMesh = null;
	function setText(text) {
		const label = text || options.placeholder || '';
		if (textMesh) { model.remove(textMesh); textMesh.geometry.dispose(); textMesh = null; }
		if (!label.trim()) { requestRender(); return; }
		const geometry = new TextGeometry(label, { font: font, size: TEXT.size, depth: RAISE, curveSegments: 6, bevelEnabled: false });
		geometry.computeBoundingBox();
		const box = geometry.boundingBox;
		const width = box.max.x - box.min.x;
		const fit = width > TEXT.maxWidth ? TEXT.maxWidth / width : 1; // lange namen worden automatisch kleiner
		// horizontaal exact gecentreerd; verticaal op de hoogte van de hoofdletters, zodat "g" en "p" de tekst niet optillen
		geometry.translate(-(box.min.x + box.max.x) / 2, -TEXT.size * TEXT.capHeight / 2, 0);
		textMesh = new Mesh(geometry, text ? white : ghost);
		textMesh.scale.set(fit, fit, 1);
		textMesh.position.set(TEXT.centerX, 0, PLATE.thick / 2);
		model.add(textMesh);
		requestRender();
	}

	// ---------- draaien: slepen met muis of vinger, met uitloop; daarvóór wiegt het model rustig ----------
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let yaw = REST.yaw, pitch = REST.pitch, velocity = 0, dragging = false, touched = false, lastX = 0, lastY = 0;
	let visible = true, frame = 0, needsRender = true, ready = false;
	const started = performance.now();

	function requestRender() {
		needsRender = true;
		if (!frame && visible && ready) frame = requestAnimationFrame(tick);
	}

	function tick(now) {
		frame = 0;
		let animating = false;
		if (!touched && !reduced) {
			yaw = REST.yaw + Math.sin((now - started) / 1400) * 0.38;
			pitch = REST.pitch + Math.sin((now - started) / 2100) * 0.06;
			animating = true;
		} else if (!dragging && Math.abs(velocity) > 0.0004) {
			yaw += velocity;
			velocity *= 0.94;
			animating = true;
		} else if (!dragging) {
			// Je mag de achterkant bekijken, maar na het loslaten draait het bord rustig terug tot de tekst weer leesbaar is
			const current = Math.atan2(Math.sin(yaw), Math.cos(yaw));
			const target = MathUtils.clamp(current, -FRONT, FRONT);
			yaw = current;
			if (Math.abs(current - target) > 0.002) {
				yaw = reduced ? target : current + (target - current) * 0.07;
				animating = !reduced;
			}
		}
		if (animating || needsRender) {
			pivot.rotation.set(pitch, yaw, 0);
			renderer.render(scene, camera);
			needsRender = false;
		}
		if (animating && visible) frame = requestAnimationFrame(tick);
	}

	canvas.style.touchAction = 'pan-y'; // verticaal scrollen blijft werken; horizontaal slepen draait het model
	canvas.style.cursor = 'grab';
	canvas.addEventListener('pointerdown', function (event) {
		dragging = true; touched = true; velocity = 0;
		lastX = event.clientX; lastY = event.clientY;
		canvas.setPointerCapture(event.pointerId);
		canvas.style.cursor = 'grabbing';
	});
	canvas.addEventListener('pointermove', function (event) {
		if (!dragging) return;
		const dx = event.clientX - lastX, dy = event.clientY - lastY;
		lastX = event.clientX; lastY = event.clientY;
		velocity = dx * 0.011;
		yaw += velocity;
		pitch = MathUtils.clamp(pitch + dy * 0.008, -0.75, 0.75);
		requestRender();
	});
	function release() { dragging = false; canvas.style.cursor = 'grab'; requestRender(); }
	canvas.addEventListener('pointerup', release);
	canvas.addEventListener('pointercancel', release);
	// Toetsenbord: pijltjes draaien het model
	canvas.tabIndex = 0;
	canvas.addEventListener('keydown', function (event) {
		const step = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[event.key];
		if (!step) return;
		event.preventDefault();
		touched = true; velocity = 0;
		yaw += step[0];
		pitch = MathUtils.clamp(pitch + step[1], -0.75, 0.75);
		requestRender();
	});

	// ---------- formaat: het model past altijd in beeld, ook in het smalle mobiele kader ----------
	function resize() {
		const width = canvas.clientWidth || 600, height = canvas.clientHeight || 300;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setSize(width, height, false);
		frameCamera(width / height);
		requestRender();
	}
	function frameCamera(aspect) {
		camera.aspect = aspect;
		const vfov = MathUtils.degToRad(camera.fov);
		const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
		const forWidth = (MODEL_WIDTH * 1.12 / 2) / Math.tan(hfov / 2);
		const forHeight = (PLATE.half * 2 * 2.6 / 2) / Math.tan(vfov / 2);
		camera.position.set(0, 0, Math.max(forWidth, forHeight));
		camera.lookAt(0, 0, 0);
		camera.updateProjectionMatrix();
	}
	const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
	if (resizeObserver) resizeObserver.observe(canvas); else window.addEventListener('resize', resize);
	const viewObserver = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
		visible = entries[0].isIntersecting; // buiten beeld staat alles stil: dat spaart batterij
		if (visible) requestRender();
	}) : null;
	if (viewObserver) viewObserver.observe(canvas);

	// PNG op een lichte achtergrond. Altijd in de vaste stand met de tekst leesbaar, ook als het model net
	// met de achterkant naar voren is gedraaid: dit plaatje gaat mee met een bestelling.
	// options.pose: { yaw, pitch } voor een andere stand, of 'current' voor de stand op het scherm.
	function toBlob(width, height, options) {
		options = options || {};
		const shot = options.pose === 'current' ? { yaw: yaw, pitch: pitch } : (options.pose || REST);
		const size = { w: canvas.width, h: canvas.height, ratio: renderer.getPixelRatio() };
		renderer.setPixelRatio(1);
		renderer.setSize(width, height, false);
		frameCamera(width / height);
		scene.background = new Color(options.background || '#eef1f5');
		pivot.rotation.set(shot.pitch, shot.yaw, 0);
		renderer.render(scene, camera);
		// toBlob legt het beeld direct vast; daarna meteen terug naar het schermformaat, zodat je op de pagina niets ziet verspringen
		const result = new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
		scene.background = null;
		renderer.setPixelRatio(size.ratio);
		resize();
		pivot.rotation.set(pitch, yaw, 0);
		renderer.render(scene, camera);
		needsRender = false;
		return result;
	}

	// Voor de productfoto: een vaste, mooie stand
	function pose(newYaw, newPitch) { touched = true; velocity = 0; yaw = newYaw; pitch = newPitch; requestRender(); }

	function dispose() {
		if (frame) cancelAnimationFrame(frame);
		if (resizeObserver) resizeObserver.disconnect();
		if (viewObserver) viewObserver.disconnect();
		renderer.dispose();
	}

	resize();
	setText(options.text || '');
	await pause();
	// De grafische chip bereidt het tekenen op de achtergrond voor; pas daarna verschijnt het eerste beeld
	try { await renderer.compileAsync(scene, camera); } catch (e) {}
	ready = true;
	requestRender();
	return { setText: setText, toBlob: toBlob, pose: pose, dispose: dispose };
}
