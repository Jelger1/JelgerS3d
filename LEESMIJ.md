# JelgerS3D.nl

De site is pure HTML, CSS en JavaScript. Alle pagina's worden gegenereerd uit één
centrale bron: `data/products.json`. Je hoeft dus nooit meer per product HTML te schrijven.

## Dagelijks gebruik

| Wat wil je? | Hoe? |
| --- | --- |
| De site lokaal bekijken | Dubbelklik `start.bat`. De site opent op http://localhost:3000 en ververst de build bij elke wijziging. |
| Controleren of alles klopt | Dubbelklik `build.bat`. Die bouwt de site in `dist/` en controleert alle links. |
| Wijzigingen online zetten | Zet je wijzigingen op GitHub in de branch `main` (push, of pas een bestand aan op github.com). GitHub bouwt en publiceert de site dan automatisch; na ongeveer een minuut staat het op jelgers3d.nl. |

De map `dist/` hoef je nooit te uploaden: GitHub bouwt hem zelf (zie `.github/workflows/deploy.yml`).
Ging er iets mis? Kijk op https://github.com/Jelger1/JelgerS3d/actions of de laatste run groen is.

## Een product toevoegen

1. Zet de foto's in `assets/` (JPG of PNG, gewoon het origineel uit de camera).
   De build maakt er zelf kleine WebP-versies en een preview-afbeelding voor WhatsApp/Instagram van.
2. Kopieer in `data/products.json` een bestaand product en pas het aan:
   - `id`: wordt de URL (`producten/<id>.html`). Alleen kleine letters, cijfers en streepjes.
   - `type`: `vaas`, `lamp`, `beeld`, `sleutelhanger` of `lightbox` (nieuwe types voeg je toe in `data/site.json`).
   - `collection`: `design`, `limburg` of `maatwerk`.
   - `sale`: hoe het product verkocht wordt:
     - `cart`: gewoon in de winkelwagen (minstens één variant met prijs nodig)
     - `request`: op aanvraag, met `priceFrom` als vanaf-prijs
     - `external`: link naar een andere webshop (`externalUrl`)
     - `soon`: zichtbaar, maar nog niet te bestellen
   - `variants`: één variant met leeg `label` voor een product zonder keuzes, of meerdere met elk een `label`.
   - `images`: de eerste foto is de hoofdfoto. Schrijf bij elke foto een beschrijvende `alt`.
     Geef met `subject` aan waar het product in de foto staat (zie hieronder).
   - `seo`: titel (max. 65 tekens) en omschrijving (max. 160 tekens) voor Google.
   - `related`: id's van producten onder "Past erbij".
3. Draai `build.bat`. De build controleert je data en vertelt in gewoon Nederlands wat er mist of niet klopt.

### Extra's die een product kan hebben

- **Introductieprijs** (`"intro": { "price": 49.95, "until": "2026-12-31" }`): zolang die datum niet voorbij is,
  rekent de hele site die prijs (kaarten, winkelwagen, Google-feed) en staat er bij de prijs *"Introductieprijs tot
  en met … Daarna €…"*. De gewone prijs blijft in `variants` staan; na de einddatum pakt de eerstvolgende build die
  vanzelf weer op. Een doorgestreepte "van"-prijs gebruikt de site bewust niet: dat mag alleen als je die prijs de
  30 dagen ervoor echt hebt gevraagd (regels van de ACM). Reken na de einddatum dus ook echt de gewone prijs.
- **Kleurwens of andere wens** (`"wish": { "label": …, "placeholder": …, "hint": … }`): zet een tekstveld bij de
  koopknop. Wat de klant invult (max. 40 tekens) komt in de winkelwagen te staan en in je bestelmail onder
  "WENS VAN DE KLANT".
- **Video** (`"video": { "file": …, "poster": …, "heading": …, "alt": … }`): onderaan de productpagina. De video
  wordt pas gedownload als de bezoeker op play drukt. Maak de webversie eerst met
  `npm run video -- <bestand in assets/> <naam> <seconde voor het voorbeeldbeeld>`; dat maakt een kleine 720p-versie
  in `assets/video/` plus een voorbeeldbeeld. Daar is ffmpeg voor nodig; de build zelf heeft dat niet nodig.

### Het product netjes in het midden: `subject`

Alle productfoto's worden getoond in een vast kader van 4:5. De build snijdt elke foto zo bij dat het
**product in het midden** staat. Daarvoor geef je per foto aan waar het product staat:

```json
{ "file": "Koempel-Eend.jpg", "subject": [8, 50, 62, 88], "alt": "..." }
```

`subject` is `[links, boven, rechts, onder]` in procenten van de foto. In dit voorbeeld begint de eend
op 8% vanaf links en 50% vanaf boven, en eindigt hij op 62% vanaf links en 88% vanaf boven.
Een ruwe schatting is genoeg. Staat het product na het bouwen te klein of te krap in beeld, maak het vak
dan iets kleiner of groter. Klikt een bezoeker op de foto, dan ziet hij altijd de volledige, onbewerkte foto.

- Zonder `subject` snijdt de build vanuit het midden van de foto (je krijgt dan een waarschuwing).
- Studiofoto op een egale achtergrond (zoals de sleutelhangers) waar het product niet in een staand kader past?
  Voeg `"background": "auto"` toe: de achtergrond wordt dan doorgetrokken in plaats van dat het product wordt afgesneden.
- Hoeveel ruimte er rond het product blijft stel je voor de hele site in via `productFrame.fill` in `data/site.json`
  (0.62 = het product vult hooguit 62% van het kader). Per foto afwijken kan met `"fill": 0.5`.

### Ontwerptool: "Maak je eigen sleutelhanger"

De Straatnaam Sleutelhanger is een gewoon product in `data/products.json`, met één extra eigenschap:

```json
"personalize": { "label": "Jouw straatnaam", "placeholder": "Abtenlaan" }
```

Daardoor toont de productpagina een live preview in plaats van de fotogalerij, krijgt de kaart de knop
"Ontwerp de jouwe" en verschijnt de sectie op de homepage vanzelf. Haal je `personalize` weg, dan is het weer een
gewoon product en verdwijnt de sectie op de homepage.

- **Prijs, naam en teksten** pas je aan zoals bij elk ander product.
- **Het 3D-model** (draaibaar met muis, vinger of pijltjestoetsen) staat in `src/3d/keychain-3d.js`. Bovenaan dat
  bestand staan de maten in millimeters (bord 70 x 22 x 3 mm, letters 0,8 mm opliggend), verderop de kleuren en het
  licht. Het gebruikt Three.js, dat met `npm install` vanzelf meekomt; de build bundelt alles tot één bestand
  (`dist/js/keychain-3d.js`, ca. 150 KB) dat alleen wordt opgehaald wanneer de tool in beeld komt. Andere pagina's
  merken er dus niets van. De PNG-download is altijd een render in een vaste stand met de tekst leesbaar.
- **Vangnet in 2D:** zolang het 3D-model laadt, en op apparaten die geen 3D aankunnen, staat er een platte tekening van
  hetzelfde bord. Die staat in `src/js/keychain-sign.js` (daar staat ook de maximale lengte van 32 tekens en welke
  tekens zijn toegestaan).
- **Ander lettertype op het 3D-bord?** Zet het .ttf-bestand in `tools/fonts/`, pas de bestandsnaam aan in
  `tools/make-3d-font.js` en draai `node tools/make-3d-font.js`. Nu is het Arimo Bold (vrije licentie, lijkt op Arial
  en heeft alle accenten zoals é, ë en ö).
- **Bestellen:** de tekst reist mee in de winkelwagen (elke andere tekst is een eigen regel) en staat in je bestelmail
  als `TEKST OP HET PRODUCT: ...`. De knop "Bestel per mail" opent een vooringevulde mail; een bijlage toevoegen kan
  een website niet voor de klant doen, daarom staat in de mail de tip om de gedownloade preview zelf toe te voegen.
- **De productfoto** (`assets/Straatnaam-Sleutelhanger-Ontwerp.png`) is een render van het 3D-model zelf. Heb je een echte
  foto van een geprinte sleutelhanger, zet die dan als eerste in `images`: die is overtuigender.

### Filters in de webshop

De filters maken zichzelf uit de data; je hoeft er niets voor te programmeren.

- **Type** en **Collectie** komen uit `type` en `collection` van elk product. De namen, en de kop die boven de webshop
  verschijnt als iemand op één type filtert, staan in `data/site.json` onder `types`. Zet sterretjes om het deel
  dat de accentkleur krijgt: `"3D-geprinte *designvazen*"`.
- **Materiaal** verschijnt vanzelf als filter zodra je bij producten `material` invult (bijv. `"PLA"`).
- **Prijs**: de groepen staan in `data/site.json` onder `priceBuckets`.
- Elke filterkeuze staat in de link, bijvoorbeeld `webshop.html?type=vaas` of `webshop.html?collectie=limburg&prijs=tot-10`.
  Zo'n link kun je delen of gebruiken als landingspagina voor een advertentie.

### Homepage, levering en eerlijke conversie

Alles hieronder staat in `data/site.json`:

- `homeUsps`, `homeCategories` en `faq`: de USP-balk, de vier categorietegels en de veelgestelde vragen op de homepage.
- `portfolio`: de sectie "Meer dan 3D" op de homepage (en de footerlink). `url` is het portfolio (jelgersieler.nl),
  `projects` de vier projecten in het raster: titel, tags, korte tekst, foto uit `assets/`, `anchor` (het id van het
  project op het portfolio), `kind` (`web` krijgt een browserbalk, `branding` niet) en optioneel `focus` (welk deel van
  de foto in beeld blijft, bv. `center top`). Houd de teksten gelijk aan wat er op het portfolio staat.
  De doorlopende teksten van de homepage staan in `src/pages/index.html`.
- `delivery` en `shipping`: de teksten over levertijd, verzendkosten en ophalen (productpagina, winkelwagen, afrekenen).
- `deadlines`: de seizoensmelding "Op tijd voor Kerst? Bestel uiterlijk ...". Die verschijnt vanaf `showFrom` en verdwijnt
  vanzelf na `orderBefore`. **Controleer deze data elk jaar**: het is een belofte aan je klant. Liever een dag te ruim dan te krap.
- Wil je een product een label geven, zet dan in `products.json` bijvoorbeeld `"badge": "Nieuw"`. Gebruik alleen labels
  die waar zijn ("Bestseller" alleen als het echt je best verkochte product is).

Reviews: `data/reviews.json` is leeg, dus de site toont geen reviews. Voeg alleen **echte** reviews toe (nepreviews zijn
verboden en de ACM handhaaft daarop). Zodra er reviews in staan, verschijnen ze vanzelf op de homepage, de webshop en
de productpagina van het genoemde product. Formaat per review:
`{ "author": "Naam A.", "rating": 5, "text": "...", "productLabel": "Kami Vase", "products": ["kami-vase"] }`

Bewust niet gebouwd: tellers als "42 keer bekeken" of "nog 2 op voorraad". Zonder echte meetgegevens of voorraad
zouden dat verzonnen cijfers zijn, en dat is misleiding.

### Vindbaar in Google: categoriepagina's

Naast de filterlinks van de webshop zijn er vaste pagina's met een eigen adres, titel en tekst, zoals `vazen.html`
en `limburgse-cadeaus.html`. Die kan Google als losse pagina tonen. Je beheert ze in `data/site.json` onder
`categoryPages`: `filter` bepaalt welke producten erop staan (`type` of `collection`), `intro` is de tekst bovenaan,
`seoTitle` en `seoDescription` zijn wat Google toont. Een nieuwe categorie toevoegen is een blok kopiëren en aanpassen;
de pagina, de link in de footer en de regel in de sitemap komen er vanzelf bij.

`pickupLocation` in `site.json` is de plaats waar klanten kunnen ophalen. Die komt terug op de homepage, de
productpagina's, de winkelwagen, het afrekenen en in de bestelmail.

De build maakt ook `feed.xml` (productfeed voor Google Merchant Center), `sitemap.xml`, `robots.txt`, `404.html`
en `privacy.html` (tekst in `src/pages/privacy.html`).

### Juridisch: adres, privacy, voorwaarden en cookies

- **Vestigingsadres (wettelijk verplicht, art. 3:15d BW):** staat in `data/site.json` onder `address` en komt vanzelf
  in de footer, de privacyverklaring, de algemene voorwaarden en het bedrijfsschema voor Google. Verhuis je of neem je
  een zakelijk adres, dan pas je het alleen daar aan. Wil je het adres ooit níet op de site tonen, laat dan `street` leeg
  en zet `"onRequest": true`: de site toont dan alleen de plaats en zegt dat het volledige adres in de orderbevestiging staat
  (je voldoet dan formeel niet aan de vermeldingsplicht op de website).
- **E-mailadres (ook wettelijk verplicht):** staat in `data/site.json` onder `email`. Op de site staat het nergens
  leesbaar in de HTML, zodat robots die het web afstruinen naar adressen het niet vinden. Gebruik in teksten
  `{{emailLink}}` (niet `{{email}}`): de build zet het adres er gecodeerd in en de browser maakt er een gewone, klikbare
  link van (`src/js/mail.js`). Zonder JavaScript staat er "mijn e-mailadres", met een link naar het contactformulier.
- **Privacyverklaring en algemene voorwaarden:** de teksten staan in `src/pages/privacy.html` en
  `src/pages/voorwaarden.html`. Bedrijfsnaam, adres, KvK, btw en e-mail worden ingevuld uit `site.json`.
  Pas je de tekst aan, zet dan ook `legal.updated` in `site.json` op de datum van vandaag.
  Het zijn zorgvuldige basisteksten, geen juridisch advies.
- **Checkbox in formulieren:** alle formulieren hebben een verplichte, nooit vooraf aangevinkte checkbox; het
  akkoord (met datum en tijd) staat in de mail die je ontvangt. Bij het bestelformulier geldt het akkoord ook voor de
  algemene voorwaarden. Wil je de checkbox vervangen door een gewone mededeling, zet dan
  `forms.privacyCheckbox` in `site.json` op `false`.
- **Cookies:** zonder Google-ID's plaatst de site geen enkele tracking- of marketingcookie en verschijnt er dus geen
  cookiemelding (er is dan niets om toestemming voor te vragen). "Cookie-instellingen" in de footer laat altijd zien
  wat er gebruikt wordt. Zodra er ID's zijn ingevuld (nu Tag Manager met Google Analytics, zie hieronder)
  verschijnt de melding met "Weigeren", "Alles accepteren" en "Voorkeuren beheren".

### Bestellen en meten

- `afrekenen.html` verstuurt de bestelling als aanvraag naar Supabase (zie hieronder); daarna komt de klant op
  `bedankt.html`, met het bestelnummer. Die aparte bedanktpagina kun je in Google Ads of Analytics instellen als conversie.
- De site zet meetmomenten klaar in de dataLayer (`view_item`, `add_to_cart`, `begin_checkout`, `generate_lead`, in
  het ecommerce-formaat van GA4). De site verstuurt zelf niets; wat ermee gebeurt, stel je in Tag Manager in.
- **Alles loopt via Google Tag Manager** (`"gtm": "GTM-MQLPSW9X"` in `data/site.json` > `analytics`). De code van
  Tag Manager staat bovenaan de `<head>` en direct na `<body>` van elke pagina. Google Analytics zit ín Tag Manager;
  de site laadt geen eigen gtag.js. `"ga4"` en `"googleAds"` in `site.json` bepalen alleen welke categorieën de
  cookiemelding toont (Statistieken, Marketing) en wat er in de privacyverklaring staat.
  - Direct boven Tag Manager staat de standaardtoestemming (Consent Mode v2): alles geweigerd, of de keuze die de
    bezoeker eerder maakte. Tags van Google houden daar zelf rekening mee. Bij andere tags (zoals de Meta-pixel) stel
    je het in bij de tag: Geavanceerde instellingen > Toestemmingsinstellingen, met `analytics_storage` of `ad_storage`.
  - Na elke keuze in de cookiemelding komt er een dataLayer-event `cookie_consent_update`. Gebruik dat als trigger
    voor tags die pas na toestemming mogen starten.
  - De webshop-meetmomenten in GA4: maak in Tag Manager een trigger "Aangepaste gebeurtenis" met de naam
    `view_item|add_to_cart|begin_checkout|generate_lead` (regex aan) en een tag "Google Analytics: GA4-gebeurtenis" met
    gebeurtenisnaam `{{Event}}` en "E-commercegegevens verzenden" (bron: dataLayer). Markeer `generate_lead` in
    Analytics als belangrijke gebeurtenis: dat is een verstuurde bestelling.
  - De keuze wordt 12 maanden onthouden. Trekt iemand zijn toestemming in, dan verwijdert de site de cookies van
    Google en herlaadt de pagina.
- **Google Ads:** zet de tags in Tag Manager (conversie op `generate_lead`) en vul `"googleAds": "AW-XXXXXXX"` in.
  Dan komt de categorie Marketing erbij (bezoekers krijgen de vraag opnieuw) en noemt de privacyverklaring Google Ads.
- In de winkelwagen staan onder "Maak het compleet" kleine extra's (tot €15) die bij de inhoud passen. Welke producten
  bij elkaar horen bepaal je met `related` in `products.json`.

Prijs aanpassen? Wijzig alleen de prijs in `products.json` en bouw opnieuw. Winkelwagens van
bezoekers rekenen altijd met de actuele prijs.

### Bestellingen en berichten (Supabase)

Alle formulieren (bestellen, contact, maatwerk, printservice en "laat het me weten") gaan naar één Supabase-functie,
`formulier` (code in `supabase/functions/formulier/`). Die doet per inzending:

1. **Controleren:** verplichte velden, een geldig e-mailadres, en bij een bestelling of de producten en uitvoeringen
   echt bestaan. De prijzen rekent de functie zelf na met `/js/winkel.json` (die maakt de build uit `data/*.json`),
   zodat niemand met een aangepaste aanvraag een lagere prijs in zijn bevestiging krijgt.
2. **Bots tegenhouden**, onzichtbaar voor echte bezoekers:
   - een verborgen veld (honeypot) dat alleen robots invullen;
   - een minimale invultijd van 2 seconden;
   - berichten met meer dan twee links worden als spam opgeslagen, zonder mail;
   - maximaal 5 inzendingen per IP-adres per 10 minuten, en per e-mailadres per dag (zodat niemand via de
     bevestigingsmail een ander kan bestoken).
   Robots krijgen een nep-"verstuurd", zodat ze niet leren om de filters heen te werken.
3. **Opslaan** in de tabel `bestellingen` of `berichten`. In het Supabase-dashboard (Table Editor) zie je alles en zet
   je de `status` (bijvoorbeeld van `nieuw` naar `bevestigd`, `betaald` of `geleverd`).
4. **Mailen** via Resend: een ontvangstbevestiging naar de klant en een overzicht naar jou. Antwoord je op dat overzicht,
   dan gaat je antwoord naar de klant; met de knoppen bovenin mail of bel je de klant meteen. In de tabel zie je met
   `mail_klant` en `mail_eigenaar` of het gelukt is.

De mails hebben de huisstijl van de site: een Midnight Slate-kader met het JS-teken en de naam, een Misty Sage-kaart
met een raspberry-aqua balk, koppen in Syne, tekst in Space Grotesk (Gmail en Outlook tonen Arial) en bij een
bestelling een foto per product. De teksten en de opmaak staan in `supabase/functions/formulier/logica.js`. Het teken
als PNG en de productfoto's als kleine JPG maakt de build in `dist/assets/mail/`, want veel mailprogramma's tonen geen
SVG of WebP.

Bewaartermijnen uit de privacyverklaring worden automatisch nagekomen: elke nacht verwijdert de database berichten na
een jaar en bestellingen na twee jaar (facturen bewaar je in je administratie, niet hier).

**Instellen** (op 20 oktober 2026 gedaan): de migraties in `supabase/migrations/` staan in de database, de functie
`formulier` staat online zonder JWT-controle (`verify_jwt = false`, de website is openbaar) en bij Edge Functions >
Secrets staat `RESEND_API_KEY`. Het domein jelgers3d.nl is bij Resend geverifieerd. Optioneel: `MAIL_VAN` (standaard
`JelgerS3D <bestellingen@jelgers3d.nl>`) en `MAIL_EIGENAAR` (standaard het e-mailadres uit `data/site.json`). Het
adres van de functie staat in `data/site.json` > `backend.url`.

**Het portfolio (jelgersieler.nl, JSdesign)** gebruikt dezelfde functie voor zijn contactformulier (met `"site": "portfolio"`
in de aanvraag; de functie accepteert daarom ook aanvragen van jelgersieler.nl). Zo'n bericht staat in de tabel `berichten`
met `site` = `jelgersieler.nl` en krijgt dezelfde spamfilters, limieten, herinneringen en knop "Ik heb gereageerd". De
mails hebben de naam, het adres en het logo van het portfolio en komen van "JSdesign" (zelfde adres als `MAIL_VAN`, of
`MAIL_VAN_PORTFOLIO` als je die bij Secrets zet). Het logo en de lettertypen voor die mails staan op jelgersieler.nl zelf.

**Bijwerken gaat vanzelf:** de GitHub-koppeling van Supabase staat aan. Bij elke push naar `main` voert Supabase nieuwe
bestanden in `supabase/migrations/` uit en zet het de functie uit `supabase/functions/formulier/` online. Wat in de repo
staat, draait dus ook. Een migratie die al met de hand is uitgevoerd, moet in de repo precies dezelfde versie (het getal
vooraan de bestandsnaam) hebben, anders probeert Supabase hem nog een keer.

**Bestanden uploaden** (printservice en Custom Lightbox): bezoekers kiezen of slepen hun bestand in het formulier. Het
gaat rechtstreeks naar de privé opslag van Supabase (Storage > bucket `uploads`). In jouw mail staat per bestand een
downloadlink, die alleen werkt met de handtekening uit die mail. Welke typen, hoeveel en hoe groot, en hoe lang ze
bewaard blijven, staat in `data/site.json` > `uploads` (nu: STL en 3MF voor de printservice, SVG, PNG, JPG, PDF, AI en
EPS voor een logo, tot 50 MB, 6 maanden bewaard). De 50 MB staat ook als limiet op de bucket.

**"Ik heb gereageerd" en herinneringen:** de functie kan niet zien of je in Gmail hebt geantwoord. Tik daarom na het
antwoorden op de knop **Ik heb gereageerd** in de mail (of zet de status in Supabase op iets anders dan `nieuw`). Staat
een bestelling of aanvraag na twee dagen nog open, dan krijg je om 9 uur één herinneringsmail met alles wat openstaat;
na vijf dagen nog één keer, daarna niet meer. Seintjes voor een product dat weer leverbaar is, tellen niet mee.

**Nieuwsbrief:** aanmelden kan onderaan elke pagina, op de bedanktpagina en met een vinkje in de formulieren, altijd met
een bevestigingsmail (dubbele opt-in). Bevestigde adressen staan in Supabase (tabel `nieuwsbrief`, het bewijs van de
toestemming) en als contact in Resend, in het segment **Nieuwsbrief**. Een nieuwsbrief verstuur je in het
Resend-dashboard: Broadcasts > nieuwe broadcast > segment Nieuwsbrief. Resend zet zelf een afmeldlink onderaan en houdt
bij wie zich afmeldt. Beloof op de site alleen wat je doet: daar staat dat je alleen mailt als er iets nieuws is.

**Elk uur** roept de database (pg_cron) de functie aan om oude bestanden en onbevestigde aanmeldingen op te ruimen en om
9 uur de herinnering te versturen.

**Testen:** onderschep in browsertests de aanvragen naar `backend.url`, anders krijg je echte bestellingen en mails.

### Huisstijl: logo, kleuren en lettertypen

De bron is de map `assets/Brand Identity/` (kleurenkaart, mockups) en `assets/Logo/` (alle logovarianten als SVG,
PNG en JPG). Die twee mappen blijven lokaal (samen ruim 30 MB, de site gebruikt ze niet). De site gebruikt alleen de
bestanden in `assets/brand/`:

- `js-icon.svg`: het JS-teken voor een donkere achtergrond (aqua, raspberry en Misty Sage), in de header.
- `js-icon-tegel.svg`: het teken op een Midnight Slate-tegel. Daaruit maakt de build het favicon, het app-icoon voor
  de iPhone en het logo voor Google (`dist/assets/brand/`); het teken voor de mails komt uit `js-icon.svg`.

De kleuren staan bovenaan `src/css/styles.css`: Electric Aqua `#03BCCA` (`--brand`, knoppen en links), Deep Teal
`#029AA6` (`--brand-dark`, hover), Neon Raspberry `#F10067` (`--raspberry`, labels zoals "Nieuw" en het verloop),
Misty Sage `#F3FFFD` (`--soft`, tekst) en Midnight Slate `#080A0D` (`--dark`, achtergrond). Het merkverloop gaat van
raspberry naar aqua (`.highlight`, het accent in koppen).

**Lettertypen** (gekozen "optie 2B", de moodboards staan als `Fonts-*.jpg` in `Documents/JelgerS3D`):

- **Saira Expanded ExtraBold** voor de koppen (h1/h2 op 125% breedte, kleinere koppen op 112%, op een telefoon
  smaller). Zijn J en S hebben hetzelfde skelet als het JS-teken: afgeronde rechthoeken met een rechte middenhaal.
- **Instrument Serif Italic** als klassiek accent: de woorden tussen `*sterretjes*` in koppen (`.highlight`).
- **DM Sans** voor alle lopende tekst en knoppen.
- **JetBrains Mono** voor labels (bovenkopjes, categorieën) en prijzen.
- **Stevie Sans** alleen voor de naam naast het teken in de header en de mails (in kapitalen, zoals "DESIGN" in
  het logo).

Saira, Instrument Serif, DM Sans en JetBrains Mono zijn gratis (SIL Open Font License) en staan als WOFF2 in
`assets/fonts/` (Saira en DM Sans zijn variabel en ingeperkt tot de gebruikte gewichten). De declaraties staan in
`src/css/fonts.css`, de variabelen (`--font-display`, `--font-accent`, `--font-body`, `--font-mono`, `--font-logo`)
bovenaan `src/css/styles.css` en de regels per element in `src/css/brand.css`. De originele Stevie Sans-bestanden
(TTF/OTF in `assets/`) blijven lokaal (.gitignore).

**Grafische accenten** (`src/css/brand.css` en de componenten): het isometrische raster waarop het teken gebouwd is
(lijnen onder 30°) achter de hero, de paginakoppen en het maatwerkblok; het raspberry-blokje uit het teken voor elk
bovenkopje en als stapnummer (in raspberry, aqua en Misty Sage); logo-onderdelen achter de hero-foto; schuine randen
aan de getinte band; randen in het merkverloop bij aanwijzen; knoppen die bij aanwijzen een raspberry-laag krijgen.

**Paginaovergang**: klik je naar een andere pagina van de site, dan schuiven drie banden (raspberry, aqua, Midnight
Slate) schuin omhoog en klikt het JS-teken in elkaar; op de nieuwe pagina schuiven ze verder weg. Code:
`src/js/transition.js`, `src/partials/curtain.html` en het einde van `src/css/brand.css`. Wie in zijn systeem
"minder beweging" heeft aangezet, ziet geen overgang. Een link uitzonderen: zet er `data-no-transition` op. Pagina's
worden alvast opgehaald als iemand een link aanwijst (speculation rules in `layout.js`), zodat het snel blijft.

**Naam wijzigen naar JSdesign** (later): pas `name` in `data/site.json` aan en de tekst `JelgerS3D` in
`src/partials/header.html` (daar kan dan ook het volledige logo "JS DESIGN" uit `assets/Logo/SVG/` komen).

## Waar staat wat?

```
data/          products.json, reviews.json, site.json (bedrijfsgegevens, labels, USP's)
assets/        originele foto's en logo's
src/pages/     index.html: de tekst van de homepage
src/partials/  header, footer en winkelwagen (gedeeld door alle pagina's)
src/templates/ de opbouw van de productpagina, de webshop en de productkaart
src/css/       styles.css (basis), components.css, product.css, shop.css (filters), checkout.css, home.css, pages.css, keychain.css
src/js/        losse modules: cart.js (opslag), cart-ui.js, shop.js (filters), checkout.js, request.js, validate.js,
               consent.js (cookies), keychain.js + keychain-sign.js (ontwerptool), ...
src/3d/        keychain-3d.js: het 3D-model van de sleutelhanger (wordt met Three.js gebundeld)
tools/         images.js (foto's verkleinen), dev.js (lokale server), check.js (linkcontrole),
               make-3d-font.js (lettertype voor de 3D-letters)
supabase/      de functie "formulier" (bestellingen en berichten opslaan en mailen) en de database-opzet
build.js       bouwt alles naar dist/
dist/          het eindresultaat. Wordt gegenereerd: pas hier niets handmatig aan.
```
