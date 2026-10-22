# Huisstijl JelgerS3D

Vastgesteld oktober 2026. Dit is de bron voor de website, mails, socials, video's en print. De visuele samenvatting
staat als `JelgerS3D-huisstijl.pdf` / `.jpg` in `Documents/JelgerS3D`. De naam wordt later JSdesign; dan verandert
alleen het woordmerk (zie "Logo").

## Logo

- **Het teken**: een J en S in elkaar, getekend op een isometrisch raster (lijnen onder 30°), opgebouwd uit drie
  vlakken: aqua (boven), raspberry (blokje) en de J (Misty Sage op donker, Midnight Slate op licht).
- **Bestanden voor de site**: `assets/brand/js-icon.svg` (teken op donker) en `assets/brand/js-icon-tegel.svg`
  (teken op een Midnight Slate-tegel: favicon, app-icoon, logo voor Google).
- **Alle varianten** (SVG, PNG, JPG; volledig logo "DESIGN" en het teken in elke kleur): `assets/Logo/` en de
  brand identity in `assets/Brand Identity/` (beide alleen lokaal).
- **Woordmerk nu**: het teken + "JELGERS3D" in Stevie Sans Medium, kapitalen, spatiëring +6%.
  **Na de naamswissel**: het volledige logo "[teken] DESIGN".
- Het teken nooit hertekenen, vervormen of in andere kleuren zetten; alleen schalen. Op foto's of drukke vlakken de
  tegelversie gebruiken.

## Kleuren

| Naam | Hex | RGB | Rol |
| --- | --- | --- | --- |
| Midnight Slate | `#080A0D` | 8, 10, 13 | achtergrond |
| Misty Sage | `#F3FFFD` | 243, 255, 253 | tekst en lichte vlakken |
| Electric Aqua | `#03BCCA` | 3, 188, 202 | hoofdaccent: knoppen, links, actieve staten |
| Deep Teal | `#029AA6` | 2, 154, 166 | hover en tweede tint aqua |
| Neon Raspberry | `#F10067` | 241, 0, 103 | tweede accent: labels ("Nieuw"), markeringen, verloop |

- **Merkverloop**: raspberry → Deep Teal → aqua → Misty Sage (in koppen kort: raspberry → aqua).
- Afgeleide donkere tinten voor de site: kaart `#101318`, tweede vlak `#151920`, rand `#252B33`, gedempte tekst
  `#98A4A3`. Statuskleuren (groen/rood/geel) staan los van het merk.
- Tekst op raspberry: Midnight Slate (contrast 4,6:1), niet wit.

## Lettertypen

| Rol | Lettertype | Gebruik |
| --- | --- | --- |
| Koppen | **Saira Expanded ExtraBold** (800, breedte 125%) | h1/h2; kleinere koppen Saira 700 op 112%; op mobiel smaller (110%/100%). Spatiëring −1%, zinsopbouw (geen kapitalen). |
| Accent | **Instrument Serif Italic** (400, ±114% van de kop) | één of twee woorden per kop, in het merkverloop ("wie je bent"). Spaarzaam. |
| Tekst | **DM Sans** (400, nadruk 500–700) | lopende tekst en knoppen; minimaal 16 px, regelafstand 1,6. |
| Labels en prijzen | **JetBrains Mono** (500/600) | bovenkopjes, categorieën, prijzen; labels in KAPITALEN met +8% spatiëring. |
| Logo-naam | **Stevie Sans Medium** | alleen de naam naast het teken. |

Saira, Instrument Serif, DM Sans en JetBrains Mono zijn gratis (SIL Open Font License) en staan in `assets/fonts/`.
Stevie Sans is commercieel (Typefolio). Waarom deze combinatie: de J en S van Saira hebben hetzelfde skelet als het
teken (afgeronde rechthoeken met een rechte middenhaal); de cursieve serif geeft het technische teken een warm,
ambachtelijk tegenwicht; de monospace knipoogt naar 3D-printen.

## Grafische elementen

- **Isometrisch raster**: dunne lijnen onder +30° en −30° (Misty Sage op ±5%), zacht uitgevaagd; achter hero's,
  paginakoppen en uitgelichte blokken.
- **Het raspberry-blokje** uit het teken (vorm: `polygon(100% 43.5%, 50.3% 100%, 0 56.5%, 49.7% 0)`) als markering
  voor bovenkopjes en als stapnummer, in de drie tekenkleuren (raspberry, aqua, sage).
- **Logo-onderdelen als lagen** achter foto's (aqua rechtsboven, raspberry linksonder).
- **Schuine randen** aan getinte banden, oplopend zoals de lijnen van het teken.
- **Verlooprand** (raspberry → aqua) bij aanwijzen van kaarten en tegels.
- **"Extruderen"**: knoppen schuiven bij aanwijzen 3 px omhoog met een raspberry-laag eronder, als een 3D-print.
- **Paginaovergang**: drie banden (raspberry, aqua, Midnight Slate) schuiven onder 30° over het scherm; het teken
  klikt in elkaar uit zijn drie delen. Niet bij "minder beweging".

## Beweging

Rustig en vloeiend (ease-in-out), geen verende overshoot. Overgangen tussen pagina's ±0,8 s in, ±1,3 s uit.

## Waar het in de code staat

- Kleuren en lettertypen als variabelen: bovenaan `src/css/styles.css`.
- Lettertype-declaraties: `src/css/fonts.css`.
- Grafische elementen, typografieregels en paginaovergang: `src/css/brand.css`, `src/js/transition.js`,
  `src/partials/curtain.html`.
- Mails: `supabase/functions/formulier/logica.js` (kleuren in `KLEUR`, lettertypen in `KOP`, `LETTER`, `LOGO`).
