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

### Bestellen en meten

- `afrekenen.html` verstuurt de bestelling als aanvraag naar je mail (Web3Forms); daarna komt de klant op `bedankt.html`.
  Die aparte bedanktpagina kun je in Google Ads of Analytics instellen als conversie.
- De site zet meetmomenten klaar (`view_item`, `add_to_cart`, `begin_checkout`, `generate_lead`).
  Er wordt niets gemeten of verstuurd zolang `analytics` in `data/site.json` leeg is.
- **Google Analytics of Google Ads aanzetten:** vul in `data/site.json` onder `analytics` je ID's in, bijvoorbeeld
  `"ga4": "G-XXXXXXX"`, `"googleAds": "AW-XXXXXXX"` en het conversielabel uit Google Ads bij `adsConversionLabel`.
  Vanaf dat moment verschijnt er vanzelf een cookiemelding. Google wordt pas geladen nadat een bezoeker op
  "Accepteren" klikt; weigeren is net zo makkelijk. Een verstuurde bestelling telt dan als conversie in Google Ads.
  De privacyverklaring past zich automatisch aan.
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
src/css/       styles.css (basis + homepage), components.css, product.css, shop.css (filters), checkout.css
src/js/        losse modules: cart.js (opslag), cart-ui.js, shop.js (filters), checkout.js, request.js, validate.js, ...
tools/         images.js (foto's verkleinen), dev.js (lokale server), check.js (linkcontrole)
build.js       bouwt alles naar dist/
dist/          het eindresultaat. Wordt gegenereerd: pas hier niets handmatig aan.
```
