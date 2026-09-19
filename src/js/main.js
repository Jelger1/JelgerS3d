// Startpunt van alle JavaScript. Elke pagina laadt dit bestand;
// paginaspecifieke onderdelen starten op basis van <body data-page="...">.
import { initUi } from './ui.js';
import { initCartUi } from './cart-ui.js';
import { initCheckout } from './checkout.js';
import { initLightbox } from './lightbox.js';
import { initRails } from './rail.js';
import { initForms } from './forms.js';
import { initProduct } from './product.js';

const page = document.body.dataset.page;

initUi();
initCartUi();
initCheckout();
initLightbox();

if (page === 'home') {
	initRails();
	initForms();
}
if (page === 'product') initProduct();
