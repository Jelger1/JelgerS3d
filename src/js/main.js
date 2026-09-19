// Startpunt van alle JavaScript. Elke pagina laadt dit bestand;
// paginaspecifieke onderdelen starten op basis van <body data-page="...">.
import { initUi } from './ui.js';
import { initCartUi } from './cart-ui.js';
import { initLightbox } from './lightbox.js';
import { initRails } from './rail.js';
import { initForms } from './forms.js';
import { initProduct } from './product.js';
import { initRequest } from './request.js';
import { initShop } from './shop.js';
import { initCheckout, initThanks } from './checkout.js';

const page = document.body.dataset.page;

initUi();
initCartUi();
initLightbox();

if (page === 'home') {
	initRails();
	initForms();
}
if (page === 'shop') initShop();
if (page === 'product') {
	initProduct();
	initRequest();
}
if (page === 'checkout') initCheckout();
if (page === 'thanks') initThanks();
