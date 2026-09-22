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
  wat er gebruikt wordt. Zodra er ID's zijn ingevuld (nu Google Analytics en Tag Manager, zie hieronder) verschijnt
  de melding met "Weigeren", "Alles accepteren" en "Voorkeuren beheren".

### Bestellen en meten

- `afrekenen.html` verstuurt de bestelling als aanvraag naar je mail (Web3Forms); daarna komt de klant op `bedankt.html`.
  Die aparte bedanktpagina kun je in Google Ads of Analytics instellen als conversie.
- De site zet meetmomenten klaar (`view_item`, `add_to_cart`, `begin_checkout`, `generate_lead`).
  Ze gaan pas naar Google als de bezoeker toestemming geeft; zonder ID's in `data/site.json` > `analytics` nooit.
- **Google Analytics en Tag Manager staan aan:** in `data/site.json` onder `analytics` staan `"ga4": "G-0SLM0NK7CF"`
  en `"gtm": "GTM-MQLPSW9X"`. Er wordt niets van Google geladen voordat een bezoeker toestemming geeft; weigeren is net
  zo makkelijk als accepteren, en via "Voorkeuren beheren" kiest de bezoeker per categorie (Statistieken = Analytics,
  Marketing = Google Ads). De keuze wordt 12 maanden onthouden. Trekt iemand zijn toestemming in, dan verwijdert de
  site ook de cookies van Google. De privacyverklaring past zich automatisch aan.
  - Analytics krijgt de meetmomenten hierboven rechtstreeks van de site. Markeer `generate_lead` in Analytics als
    belangrijke gebeurtenis: dat is een verstuurde bestelling.
  - **Tag Manager** is er voor extra tags. Zet daar géén Google Analytics- of Google-tag met `G-0SLM0NK7CF` in (en
    ook geen Google Ads-tags als `googleAds` hieronder is ingevuld), anders telt alles dubbel.
  - Tag Manager laadt pas na toestemming en krijgt via Consent Mode mee waarvoor wel en niet. Tags van Google houden
    daar zelf rekening mee. Bij andere tags (zoals de Meta-pixel) stel je dat in bij de tag: Geavanceerde instellingen >
    Toestemmingsinstellingen (Consent Settings), met `ad_storage` voor advertenties of `analytics_storage` voor
    statistieken. Zolang `googleAds` leeg is bestaat de categorie Marketing niet en blijft `ad_storage` geweigerd.
    Een nieuwe partij hoort ook in de privacyverklaring.
- **Google Ads aanzetten:** vul `"googleAds": "AW-XXXXXXX"` en het conversielabel uit Google Ads bij
  `adsConversionLabel` in. Dan komt de categorie Marketing erbij (bezoekers krijgen de vraag opnieuw) en telt een
  verstuurde bestelling als conversie in Google Ads.
- In de winkelwagen staan onder "Maak het compleet" kleine extra's (tot €15) die bij de inhoud passen. Welke producten
  bij elkaar horen bepaal je met `related` in `products.json`.

Prijs aanpassen? Wijzig alleen de prijs in `products.json` en bouw opnieuw. Winkelwagens van
bezoekers rekenen altijd met de actuele prijs.

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
build.js       bouwt alles naar dist/
dist/          het eindresultaat. Wordt gegenereerd: pas hier niets handmatig aan.
```
