document.addEventListener('DOMContentLoaded', function(){
	// Scroll animations
	function initScrollAnimations(){
		var elements = document.querySelectorAll('.services, .showcase, .contact, .card');
		
		var observer = new IntersectionObserver(function(entries){
			entries.forEach(function(entry, index){
				if(entry.isIntersecting){
					setTimeout(function(){
						entry.target.classList.add('animate-on-scroll', 'animated');
						entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
					}, index * 100);
					observer.unobserve(entry.target);
				}
			});
		}, {
			threshold: 0.1,
			rootMargin: '0px 0px -50px 0px'
		});
		
		elements.forEach(function(el){
			el.classList.add('animate-on-scroll');
			observer.observe(el);
		});
	}
	
	// Parallax effect for hero (disabled to prevent overlap)
	function initParallax(){
		// Disabled to prevent hero image from overlapping other sections
	}
	
	// Smooth scroll for navigation links
	document.querySelectorAll('a[href^="#"]').forEach(function(anchor){
		anchor.addEventListener('click', function(e){
			var target = this.getAttribute('href');
			if(target !== '#'){
				e.preventDefault();
				var targetEl = document.querySelector(target);
				if(targetEl){
					targetEl.scrollIntoView({
						behavior: 'smooth',
						block: 'start'
					});
				}
			}
		});
	});
	
	// Add stagger animation to cards
	document.querySelectorAll('.grid').forEach(function(grid){
		var cards = grid.querySelectorAll('.card');
		cards.forEach(function(card, index){
			card.style.animationDelay = (index * 0.1) + 's';
		});
	});
	
	// Initialize animations
	initScrollAnimations();
	initParallax();

		// Nav toggle for small screens (supports multiple toggles and accessibility)
		document.querySelectorAll('.nav-toggle').forEach(function(toggle){
			var targetId = toggle.dataset && toggle.dataset.target ? toggle.dataset.target : toggle.getAttribute('aria-controls');
			var nav = targetId ? document.getElementById(targetId) : document.querySelector('.main-nav');
			if(!nav) return;

			function updateAria(expanded){
				try{ toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false'); }catch(e){}
			}

			toggle.addEventListener('click', function(){
				var isShown = nav.classList.toggle('show');
				updateAria(isShown);
			});

			// Close the menu when a link inside is clicked (mobile behavior)
			nav.querySelectorAll('a').forEach(function(link){
				link.addEventListener('click', function(){
					if(nav.classList.contains('show')){
						nav.classList.remove('show');
						updateAria(false);
					}
				});
			});
		});

	// Modal / lightbox
	var modal = document.getElementById('modal');
	var modalImage = document.getElementById('modal-image');
	var modalTitle = document.getElementById('modal-title');
	var modalClose = document.getElementById('modal-close');

	function openModal(title, src){
		if(!modal) return;
		modal.setAttribute('aria-hidden','false');
		if(modalImage){ modalImage.src = src; modalImage.alt = title; }
		if(modalTitle) modalTitle.textContent = title;
		document.body.style.overflow = 'hidden';
	}
	function closeModal(){
		if(!modal) return;
		modal.setAttribute('aria-hidden','true');
		if(modalImage) modalImage.src = '';
		if(modalTitle) modalTitle.textContent = '';
		document.body.style.overflow = '';
	}

	if(modalClose) modalClose.addEventListener('click', closeModal);
	if(modal) modal.addEventListener('click', function(e){ if(e.target === modal) closeModal(); });
	document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeModal(); });

	// Attach view buttons
	document.querySelectorAll('[data-action="view"]').forEach(function(btn){
		btn.addEventListener('click', function(e){
			var card = e.target.closest('.product-card');
			var title = card && card.dataset ? card.dataset.title : '';
			var src = card && card.dataset ? card.dataset.image : 'assets/placeholder-hero.jpg';
			openModal(title, src);
		});
	});

	// Make all product images clickable to view in modal
	document.querySelectorAll('.product-card .product-thumb').forEach(function(thumb){
		thumb.style.cursor = 'pointer';
		thumb.addEventListener('click', function(e){
			var card = e.target.closest('.product-card');
			if(card){
				var title = card.dataset.title || '';
				var src = card.dataset.image || '';
				openModal(title, src);
			}
		});
	});

	// Carousel functionality with infinite scroll and autoplay
	var carousel = document.querySelector('.carousel');
	if(carousel){
		var track = carousel.querySelector('.carousel-track');
		var prevBtn = carousel.querySelector('.carousel-btn-prev');
		var nextBtn = carousel.querySelector('.carousel-btn-next');
		
		// Get original HTML before any cloning
		var originalHTML = track.innerHTML;
		var tempDiv = document.createElement('div');
		tempDiv.innerHTML = originalHTML;
		var originalCards = Array.from(tempDiv.querySelectorAll('.product-card'));
		
		var currentIndex = 0;
		var autoplayInterval;
		var isTransitioning = false;
		
		function getCardWidth(){
			var card = track.querySelector('.product-card');
			if(!card) return 300;
			var style = window.getComputedStyle(card);
			var width = card.offsetWidth;
			var marginRight = parseFloat(style.marginRight) || 0;
			var gap = parseFloat(window.getComputedStyle(track).gap) || 24;
			return width + gap;
		}
		
		// Clear track and rebuild with clones
		track.innerHTML = '';
		
		// Add clones before
		originalCards.forEach(function(card){
			track.appendChild(card.cloneNode(true));
		});
		
		// Add originals
		tempDiv.innerHTML = originalHTML;
		Array.from(tempDiv.querySelectorAll('.product-card')).forEach(function(card){
			track.appendChild(card.cloneNode(true));
		});
		
		// Add clones after
		tempDiv.innerHTML = originalHTML;
		Array.from(tempDiv.querySelectorAll('.product-card')).forEach(function(card){
			track.appendChild(card.cloneNode(true));
		});
		
		currentIndex = originalCards.length; // Start at middle set
		
		function updateCarousel(animate){
			var cardWidth = getCardWidth();
			if(animate === false){
				track.style.transition = 'none';
			} else {
				track.style.transition = 'transform 0.5s ease';
			}
			var offset = currentIndex * cardWidth;
			track.style.transform = 'translateX(-' + offset + 'px)';
		}
		
		function nextSlide(){
			if(isTransitioning) return;
			isTransitioning = true;
			currentIndex++;
			updateCarousel(true);
			
			setTimeout(function(){
				if(currentIndex >= originalCards.length * 2){
					currentIndex = originalCards.length;
					updateCarousel(false);
				}
				isTransitioning = false;
			}, 500);
		}
		
		function prevSlide(){
			if(isTransitioning) return;
			isTransitioning = true;
			currentIndex--;
			updateCarousel(true);
			
			setTimeout(function(){
				if(currentIndex < originalCards.length){
					currentIndex = originalCards.length * 2 - 1;
					updateCarousel(false);
				}
				isTransitioning = false;
			}, 500);
		}
		
		function startAutoplay(){
			stopAutoplay(); // Clear any existing interval
			autoplayInterval = setInterval(nextSlide, 3500);
		}
		
		function stopAutoplay(){
			if(autoplayInterval){
				clearInterval(autoplayInterval);
				autoplayInterval = null;
			}
		}
		
		if(prevBtn){
			prevBtn.addEventListener('click', function(){
				stopAutoplay();
				prevSlide();
				startAutoplay();
			});
		}
		
		if(nextBtn){
			nextBtn.addEventListener('click', function(){
				stopAutoplay();
				nextSlide();
				startAutoplay();
			});
		}
		
		// Pause autoplay on hover (desktop only)
		if(window.innerWidth > 900){
			carousel.addEventListener('mouseenter', stopAutoplay);
			carousel.addEventListener('mouseleave', startAutoplay);
		}
		
		// Touch support for mobile
		var touchStartX = 0;
		var touchEndX = 0;
		
		carousel.addEventListener('touchstart', function(e){
			touchStartX = e.changedTouches[0].screenX;
			stopAutoplay();
		}, {passive: true});
		
		carousel.addEventListener('touchend', function(e){
			touchEndX = e.changedTouches[0].screenX;
			handleSwipe();
			startAutoplay();
		}, {passive: true});
		
		function handleSwipe(){
			var swipeThreshold = 50;
			if(touchEndX < touchStartX - swipeThreshold){
				nextSlide();
			}
			if(touchEndX > touchStartX + swipeThreshold){
				prevSlide();
			}
		}
		
		// Make all cards clickable
		track.querySelectorAll('.product-card').forEach(function(card){
			card.addEventListener('click', function(){
				var external = card.dataset.external;
				if(external){
					window.open(external, '_blank');
				} else {
					var title = card.dataset.title || '';
					var src = card.dataset.image || '';
					openModal(title, src);
				}
			});
		});
		
		// Setup rotating images for all cards including clones
		setupRotatingImages();
		
		// Handle window resize
		var resizeTimer;
		window.addEventListener('resize', function(){
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(function(){
				updateCarousel(false);
			}, 250);
		});
		
		updateCarousel(false);
		startAutoplay();
	}

	// Rotating images for products (e.g., Kami Lamp)
	function setupRotatingImages(){
		var rotatingCards = document.querySelectorAll('.rotating-images');
		rotatingCards.forEach(function(card){
			var images = card.dataset.images ? JSON.parse(card.dataset.images) : [];
			if(images.length > 1){
				var img = card.querySelector('.product-thumb img');
				var currentImgIndex = 0;
				
				// Only set up rotation if not already set up
				if(!card.dataset.rotationSetup){
					card.dataset.rotationSetup = 'true';
					setInterval(function(){
						currentImgIndex = (currentImgIndex + 1) % images.length;
						if(img){
							img.style.opacity = '0';
							setTimeout(function(){
								img.src = images[currentImgIndex];
								img.style.opacity = '1';
							}, 200);
						}
					}, 2000); // Change image every 2 seconds
				}
			}
		});
	}
	
	// Initialize rotating images
	setupRotatingImages();

	// Shopping Cart
	var cart = [];
	var cartSidebar = document.getElementById('cart-sidebar');
	var cartOverlay = document.getElementById('cart-overlay');
	var cartToggle = document.getElementById('cart-toggle');
	var cartClose = document.getElementById('cart-close');
	var cartItems = document.getElementById('cart-items');
	var cartCount = document.getElementById('cart-count');
	var cartTotalPrice = document.getElementById('cart-total-price');
	var cartCheckout = document.getElementById('cart-checkout');

	function openCart(){
		if(cartSidebar) cartSidebar.setAttribute('aria-hidden', 'false');
		if(cartOverlay) cartOverlay.setAttribute('aria-hidden', 'false');
		document.body.style.overflow = 'hidden';
	}

	function closeCart(){
		if(cartSidebar) cartSidebar.setAttribute('aria-hidden', 'true');
		if(cartOverlay) cartOverlay.setAttribute('aria-hidden', 'true');
		document.body.style.overflow = '';
	}

	function updateCartUI(){
		if(!cartItems) return;
		
		// Update count
		if(cartCount) cartCount.textContent = cart.length;
		
		// Update items
		if(cart.length === 0){
			cartItems.innerHTML = '<div class="cart-empty">Je winkelwagen is leeg</div>';
			if(cartTotalPrice) cartTotalPrice.textContent = '€0,00';
			return;
		}
		
		var html = '';
		var total = 0;
		cart.forEach(function(item, index){
			var price = parseFloat(item.price);
			total += price;
			html += '<div class="cart-item">';
			html += '<img src="' + (item.image || 'assets/placeholder.jpg') + '" alt="' + item.name + '" class="cart-item-image">';
			html += '<div class="cart-item-info">';
			html += '<h5>' + item.name + '</h5>';
			html += '<p class="cart-item-price">€' + price.toFixed(2).replace('.', ',') + '</p>';
			html += '</div>';
			html += '<button class="cart-item-remove" data-index="' + index + '" aria-label="verwijder">✕</button>';
			html += '</div>';
		});
		cartItems.innerHTML = html;
		
		// Update total
		if(cartTotalPrice) cartTotalPrice.textContent = '€' + total.toFixed(2).replace('.', ',');
		
		// Attach remove handlers
		document.querySelectorAll('.cart-item-remove').forEach(function(btn){
			btn.addEventListener('click', function(){
				var index = parseInt(btn.dataset.index);
				cart.splice(index, 1);
				updateCartUI();
			});
		});
	}

	function addToCart(id, name, price, image){
		cart.push({id: id, name: name, price: price, image: image});
		updateCartUI();
		
		// Animate cart icon
		if(cartToggle){
			cartToggle.style.transform = 'scale(1.3)';
			setTimeout(function(){
				cartToggle.style.transform = 'scale(1)';
			}, 300);
		}
		
		// Show notification
		showCartNotification(name);
	}

	function showCartNotification(itemName){
		// Create notification element
		var notification = document.createElement('div');
		notification.className = 'cart-notification';
		notification.innerHTML = '✓ ' + itemName + ' toegevoegd!';
		document.body.appendChild(notification);
		
		// Trigger animation
		setTimeout(function(){
			notification.classList.add('show');
		}, 10);
		
		// Remove after animation
		setTimeout(function(){
			notification.classList.remove('show');
			setTimeout(function(){
				document.body.removeChild(notification);
			}, 300);
		}, 2000);
	}

	// Cart toggle
	if(cartToggle) cartToggle.addEventListener('click', openCart);
	if(cartClose) cartClose.addEventListener('click', closeCart);
	if(cartOverlay) cartOverlay.addEventListener('click', closeCart);

	// Add to cart buttons
	document.querySelectorAll('.btn-add-cart').forEach(function(btn){
		btn.addEventListener('click', function(){
			var card = btn.closest('.product-card');
			var id = btn.dataset.id;
			var name = btn.dataset.name;
			var price = btn.dataset.price;
			var image = card && card.dataset.image ? card.dataset.image : '';
			
			// Check if product has size options
			var sizeOptions = card.querySelector('.product-options');
			if(sizeOptions){
				var selectedRadio = sizeOptions.querySelector('input[type="radio"]:checked');
				if(selectedRadio){
					var size = selectedRadio.value;
					price = selectedRadio.dataset.price;
					name = name + ' (' + size + 'cm)';
					id = id + '-' + size;
				}
			}
			
			addToCart(id, name, price, image);
		});
	});

	// Checkout - send email
	if(cartCheckout){
		cartCheckout.addEventListener('click', function(){
			if(cart.length === 0){
				alert('Je winkelwagen is leeg!');
				return;
			}
			
			// Build order summary
			var orderText = 'BESTELLING VIA JELGERS3D.NL\n\n';
			orderText += 'Producten:\n';
			var total = 0;
			cart.forEach(function(item){
				var price = parseFloat(item.price);
				total += price;
				orderText += '- ' + item.name + ': €' + price.toFixed(2).replace('.', ',') + '\n';
			});
			orderText += '\nTotaal: €' + total.toFixed(2).replace('.', ',') + '\n\n';
			orderText += 'Vul hieronder je gegevens in:\n';
			orderText += 'Naam:\nAdres:\nTelefoon:\n\nOpmerkingen:';
			
			// Create mailto link
			var subject = 'Bestelling JelgerS3D - ' + cart.length + ' item(s)';
			var mailtoLink = 'mailto:sielerjelger@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(orderText);
			
			// Open email client
			window.location.href = mailtoLink;
			
			// Clear cart after a moment
			setTimeout(function(){
				cart = [];
				updateCartUI();
				closeCart();
			}, 1000);
		});
	}

	// Contact form handling - sends via email
	var form = document.getElementById('contact-form');
	var formMsg = document.getElementById('form-msg');
	if(form){
		form.addEventListener('submit', function(e){
			e.preventDefault();
			var name = form.name.value.trim();
			var message = form.message.value.trim();
			if(!name || !message){
				if(formMsg){ formMsg.textContent = 'Vul alle velden in.'; formMsg.style.color = 'crimson'; }
				return;
			}
			
			// Create email content
			var subject = 'Contact aanvraag van ' + name;
			var body = 'Naam: ' + name + '\n\n';
			body += 'Bericht:\n' + message;
			
			// Open email client with pre-filled content
			var mailtoLink = 'mailto:sielerjelger@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
			window.location.href = mailtoLink;
			
			// Show success message
			if(formMsg){ formMsg.textContent = 'Email wordt geopend...'; formMsg.style.color = 'green'; }
			setTimeout(function(){
				form.reset();
				if(formMsg) formMsg.textContent = '';
			}, 2000);
		});
	}

	// year in footer
	var yearEl = document.getElementById('year');
	if(yearEl) yearEl.textContent = new Date().getFullYear();

	// Lightbox request email
	var lightboxBtn = document.querySelector('.lightbox-request-btn');
	if(lightboxBtn){
		lightboxBtn.addEventListener('click', function(e){
			e.preventDefault();
			
			var subject = 'Aanvraag Custom Lightbox - JelgerS3D';
			var body = 'Beste Jelger,\n\n';
			body += 'Ik ben geïnteresseerd in een custom lightbox.\n\n';
			body += '--- Vul hieronder je gegevens in ---\n\n';
			body += 'Naam:\n';
			body += 'Telefoonnummer:\n';
			body += 'E-mailadres:\n\n';
			body += 'Gewenste afmeting (tot 25cm):\n';
			body += 'Gewenste aantal:\n\n';
			body += 'Beschrijving van het ontwerp:\n\n\n';
			body += '--- BELANGRIJK ---\n';
			body += 'Voeg je logo of afbeelding toe als bijlage bij deze email.\n';
			body += 'Ondersteunde formaten: PNG, JPG, PDF, AI, SVG\n\n';
			body += 'Met vriendelijke groet';
			
			var mailtoLink = 'mailto:sielerjelger@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
			window.location.href = mailtoLink;
		});
	}
});


