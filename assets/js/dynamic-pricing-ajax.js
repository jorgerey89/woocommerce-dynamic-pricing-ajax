jQuery(document).ready(function($) {
    'use strict';
    
    var $quantityInput = $('input[name="quantity"]');
    var $priceDisplay = $('#wc-dynamic-pricing-display');
    var $priceContainer = $('.wc-dynamic-pricing-price');
    var $originalPriceContainer = $('.wc-dynamic-pricing-original-price');
    var $savingsContainer = $('.wc-dynamic-pricing-savings');
    var $quantityContainer = $('.wc-dynamic-pricing-quantity');
    var $quantityNumber = $('.quantity-number');
    var $quantityPlural = $('.quantity-plural');
    var $debugContainer = $('#wc-dynamic-pricing-debug');
    var $originalProductPrice = $('.price');
    
    // OPTIMIZACIÓN: Variables para control de requests
    var requestTimeout;
    var currentRequest = null;
    var requestCache = {};
    var debounceDelay = wc_dynamic_pricing_ajax.debounce_delay || 300;
    var cacheEnabled = wc_dynamic_pricing_ajax.enable_cache || true;
    var cacheTTL = wc_dynamic_pricing_ajax.cache_ttl || 300000; // 5 minutos en milisegundos
    
    // Debug mode
    var debugMode = $debugContainer.length > 0;
    
    // OPTIMIZACIÓN: Verificar si el plugin está configurado correctamente
    if (typeof wc_dynamic_pricing_ajax === 'undefined') {
        console.error('WC Dynamic Pricing AJAX: Configuration not loaded');
        return;
    }
    
    // Initialize
    if ($quantityInput.length) {
        if (debugMode) {
            $debugContainer.show();
            console.log('WC Dynamic Pricing AJAX: Debug mode enabled');
            console.log('Product ID:', wc_dynamic_pricing_ajax.product_id);
            console.log('Debounce delay:', debounceDelay + 'ms');
            console.log('Cache enabled:', cacheEnabled);
        }
        
        checkInitialQuantity();
        bindEvents();
        
        // OPTIMIZACIÓN: Limpiar caché expirado al inicializar
        if (cacheEnabled) {
            cleanExpiredCache();
        }
    } else {
        console.log('WC Dynamic Pricing AJAX: Quantity input not found');
    }
    
    function bindEvents() {
        // OPTIMIZACIÓN: Usar debounced function para eventos de input
        var debouncedUpdate = debounce(updateDynamicPrice, debounceDelay);
        
        // Quantity input change
        $quantityInput.on('input change keyup', function() {
            debouncedUpdate();
        });
        
        // Quantity buttons (if present)
        $(document).on('click', '.quantity .plus, .quantity .minus', function() {
            // OPTIMIZACIÓN: Delay más corto para clicks directos
            setTimeout(function() {
                debouncedUpdate();
            }, 50);
        });
        
        // Variation change (for variable products)
        $('form.variations_form').on('found_variation', function() {
            // OPTIMIZACIÓN: Limpiar caché cuando cambia la variación
            if (cacheEnabled) {
                requestCache = {};
            }
            setTimeout(function() {
                updateDynamicPrice();
            }, 100);
        });
        
        // Force update on any quantity change
        $(document).on('change', 'input[name="quantity"]', function() {
            debouncedUpdate();
        });
        
        // OPTIMIZACIÓN: Manejar cuando el usuario sale de la página (cancelar requests)
        $(window).on('beforeunload', function() {
            cancelCurrentRequest();
        });
        
        // OPTIMIZACIÓN: Limpiar caché periódicamente
        if (cacheEnabled) {
            setInterval(cleanExpiredCache, 60000); // Cada minuto
        }
    }
    
    // OPTIMIZACIÓN: Función de debounce mejorada
    function debounce(func, wait, immediate) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }
    
    // OPTIMIZACIÓN: Cancelar request actual si existe
    function cancelCurrentRequest() {
        if (currentRequest && currentRequest.readyState !== 4) {
            currentRequest.abort();
            currentRequest = null;
            console.log('WC Dynamic Pricing AJAX: Request cancelled');
        }
    }
    
    // OPTIMIZACIÓN: Sistema de caché con TTL
    function getCacheKey(quantity) {
        return wc_dynamic_pricing_ajax.product_id + '_' + quantity;
    }
    
    function getCachedResult(cacheKey) {
        if (!cacheEnabled) return null;
        
        var cached = requestCache[cacheKey];
        if (cached && (Date.now() - cached.timestamp) < cacheTTL) {
            console.log('WC Dynamic Pricing AJAX: Using cached result for', cacheKey);
            return cached.data;
        }
        
        // Eliminar entrada expirada
        if (cached) {
            delete requestCache[cacheKey];
        }
        
        return null;
    }
    
    function setCachedResult(cacheKey, data) {
        if (!cacheEnabled) return;
        
        requestCache[cacheKey] = {
            data: data,
            timestamp: Date.now()
        };
        
        console.log('WC Dynamic Pricing AJAX: Cached result for', cacheKey);
    }
    
    function cleanExpiredCache() {
        if (!cacheEnabled) return;
        
        var now = Date.now();
        var cleaned = 0;
        
        for (var key in requestCache) {
            if ((now - requestCache[key].timestamp) >= cacheTTL) {
                delete requestCache[key];
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log('WC Dynamic Pricing AJAX: Cleaned', cleaned, 'expired cache entries');
        }
    }
    
    function checkInitialQuantity() {
        var quantity = parseInt($quantityInput.val()) || 1;
        
        // ARREGLO: Mostrar widget inmediatamente con datos básicos
        showInitialWidget(quantity);
        
        // Luego actualizar con datos reales
        updateDynamicPrice();
    }
    
    // NUEVA FUNCIÓN: Mostrar widget inmediatamente al cargar
    function showInitialWidget(quantity) {
        // Obtener precio base del producto (sin AJAX)
        var $originalPrice = $('.price .woocommerce-Price-amount');
        var priceText = '';
        
        if ($originalPrice.length) {
            priceText = $originalPrice.text().trim();
        } else {
            // Fallback si no encuentra el precio
            priceText = 'Cargando...';
        }
        
        // Calcular total básico
        var numericPrice = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
        var totalPrice = isNaN(numericPrice) ? 'Cargando...' : formatPrice(numericPrice * quantity);
        
        // Actualizar cantidad
        updateQuantityDisplay(quantity);
        
        // Datos básicos para mostrar inmediatamente
        var initialData = {
            original_price: priceText,
            quantity: quantity,
            total_discounted: totalPrice,
            has_discount: false // Asumimos que no hay descuento inicialmente
        };
        
        // Mostrar widget básico inmediatamente
        showPriceDisplayBasic(initialData);
        
        console.log('Initial widget shown with basic data');
    }
    
    // NUEVA FUNCIÓN: Formatear precio como WooCommerce
    function formatPrice(amount) {
        // Formato básico - esto debería coincidir con el formato de WooCommerce
        return '€' + amount.toFixed(2).replace('.', ',');
    }
    
    function updateDynamicPrice() {
        var quantity = parseInt($quantityInput.val()) || 1;
        
        // Update quantity display
        updateQuantityDisplay(quantity);
        
        // OPTIMIZACIÓN: Verificar caché primero
        var cacheKey = getCacheKey(quantity);
        var cachedResult = getCachedResult(cacheKey);
        
        if (cachedResult) {
            handleSuccessResponse(cachedResult, true);
            return;
        }
        
        // OPTIMIZACIÓN: Cancelar request anterior
        cancelCurrentRequest();
        
        showLoader();
        
        currentRequest = $.ajax({
            url: wc_dynamic_pricing_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'get_dynamic_price',
                product_id: wc_dynamic_pricing_ajax.product_id,
                quantity: quantity,
                nonce: wc_dynamic_pricing_ajax.nonce
            },
            timeout: 10000, // OPTIMIZACIÓN: Timeout de 10 segundos
            success: function(response) {
                console.log('AJAX Response:', response);
                
                if (response.success) {
                    // OPTIMIZACIÓN: Guardar en caché
                    setCachedResult(cacheKey, response.data);
                    handleSuccessResponse(response.data, false);
                } else {
                    console.log('No discount available:', response.data);
                    hidePriceDisplay();
                    removeStrikethroughFromOriginalPrice();
                }
            },
            error: function(xhr, status, error) {
                // OPTIMIZACIÓN: No mostrar errores de requests cancelados
                if (status === 'abort') {
                    return;
                }
                
                console.log('AJAX Error:', error);
                console.log('Status:', status);
                console.log('Response:', xhr.responseText);
                
                // OPTIMIZACIÓN: Manejar diferentes tipos de error
                if (xhr.status === 0) {
                    console.log('WC Dynamic Pricing AJAX: Network error or request cancelled');
                } else if (xhr.status >= 500) {
                    console.log('WC Dynamic Pricing AJAX: Server error');
                } else {
                    console.log('WC Dynamic Pricing AJAX: Client error');
                }
                
                hidePriceDisplay();
                removeStrikethroughFromOriginalPrice();
            },
            complete: function(xhr, status) {
                // OPTIMIZACIÓN: Limpiar referencia del request
                if (currentRequest === xhr) {
                    currentRequest = null;
                }
                hideLoader();
            }
        });
    }
    
    // OPTIMIZACIÓN: Función separada para manejar respuestas exitosas
    function handleSuccessResponse(data, fromCache) {
        if (data.has_discount) {
            console.log('Discount found, showing price display' + (fromCache ? ' (from cache)' : ''));
            showPriceDisplay(data);
            addStrikethroughToOriginalPrice();
        } else {
            console.log('No discount available, showing basic info' + (fromCache ? ' (from cache)' : ''));
            showPriceDisplayBasic(data);
            removeStrikethroughFromOriginalPrice();
        }
    }
    
    // NUEVA FUNCIÓN: Mostrar widget básico sin descuento
    function showPriceDisplayBasic(data) {
        var $originalPriceContainer = $('.wc-dynamic-pricing-original-price');
        var $priceContainer = $('.wc-dynamic-pricing-price');
        var $totalAmountContainer = $('.wc-dynamic-pricing-total-amount');
        var $savingsHighlight = $('.wc-dynamic-pricing-savings-highlight');
        var $progressSection = $('.wc-dynamic-pricing-progress-section');
        var $titleLabel = $('.wc-dynamic-pricing-label');
        var $subtitle = $('.wc-dynamic-pricing-subtitle');
        
        // ARREGLO: Quitar clase de loading si existe
        $priceDisplay.removeClass('wc-dp-loading');
        
        // Cambiar título cuando no hay descuento
        if ($titleLabel.length) {
            $titleLabel.text('Resumen de compra');
        }
        if ($subtitle.length) {
            $subtitle.text('Información de precio y cantidad');
        }
        
        // ARREGLO: Mostrar precio original y total en modo sin descuento
        var $pricesGrid = $('.wc-dynamic-pricing-prices-grid');
        if ($pricesGrid.length) {
            // Ocultar solo la columna de precio con descuento (ya que no hay descuento)
            var $originalItem = $pricesGrid.find('.wc-dynamic-pricing-price-item.original, .wc-dynamic-pricing-price-item.unit-price');
            var $discountedItem = $pricesGrid.find('.wc-dynamic-pricing-price-item.discounted');
            var $totalItem = $pricesGrid.find('.wc-dynamic-pricing-price-item.total');
            
            // Mostrar precio original y total, ocultar "precio con descuento"
            $originalItem.show();
            $discountedItem.hide();
            $totalItem.show();
            
            // Cambiar los labels para que sean más claros
            $originalItem.find('.price-label').text('Precio por unidad');
            $totalItem.find('.price-label').text('Total de la compra');
            
            // Quitar el tachado del precio original ya que no hay descuento
            $originalItem.removeClass('original').addClass('unit-price');
            
            // Mostrar los precios
            if ($originalPriceContainer.length) {
                $originalPriceContainer.html(data.original_price);
            }
            if ($totalAmountContainer.length) {
                $totalAmountContainer.html(data.total_discounted);
            }
            
            // No aplicar ninguna clase especial, usar el grid normal
        }
        
        // Mostrar mensaje informativo en lugar de descuento
        if ($savingsHighlight.length) {
            $savingsHighlight.show().addClass('no-discount');
            
            // Cambiar icono para modo sin descuento
            var $savingsIcon = $savingsHighlight.find('.savings-icon');
            if ($savingsIcon.length) {
                $savingsIcon.text('ℹ️');
            }
            
            var infoText = 'Precio por unidad: ' + data.original_price;
            if (data.quantity > 1) {
                infoText += '<br><small class="quantity-info">Cantidad: ' + data.quantity + ' unidades</small>';
            }
            
            var $savingsTextElement = $savingsHighlight.find('.savings-text');
            if ($savingsTextElement.length === 0) {
                $savingsHighlight.append('<div class="savings-text"></div>');
                $savingsTextElement = $savingsHighlight.find('.savings-text');
            }
            $savingsTextElement.html(infoText);
        }
        
        // Mostrar progreso hacia descuentos disponibles
        if ($progressSection.length) {
            $progressSection.show();
            updateProgressBar(data);
        }
        
        // El widget ya está visible, no necesitamos fadeIn
        
        setTimeout(function() {
            $('.wc-dynamic-pricing-price-item:visible').addClass('animate-in');
        }, 100);
        
        setTimeout(function() {
            if ($savingsHighlight.length) {
                $savingsHighlight.addClass('animate-in');
            }
        }, 200);
        
        setTimeout(function() {
            if ($progressSection.length) {
                $progressSection.addClass('animate-in');
            }
        }, 300);
    }
    
    // NUEVA FUNCIÓN: Mostrar widget sin descuento pero con total
    function showPriceDisplayNoDiscount(data) {
        console.log('showPriceDisplayNoDiscount data:', data);
        
        var $originalPriceContainer = $('.wc-dynamic-pricing-original-price');
        var $priceContainer = $('.wc-dynamic-pricing-price');
        var $totalAmountContainer = $('.wc-dynamic-pricing-total-amount');
        var $savingsHighlight = $('.wc-dynamic-pricing-savings-highlight');
        var $progressSection = $('.wc-dynamic-pricing-progress-section');
        
        // Mostrar precios (sin descuento)
        $originalPriceContainer.html(data.original_price || data.discounted_price);
        $priceContainer.html(data.discounted_price);
        $totalAmountContainer.html(data.total_discounted);
        
        console.log('Total being displayed (no discount):', data.total_discounted);
        
        // ARREGLO: Solo ocultar si realmente no hay descuento
        if (data.savings_percentage && data.savings_percentage > 0) {
            $savingsHighlight.show();
            var savingsText = 'Ahorras ' + data.savings + ' por unidad (' + data.savings_percentage + '% de descuento)';
            $savingsHighlight.find('.savings-text').html(savingsText);
        } else {
            $savingsHighlight.hide();
        }
        
        // Ocultar progreso solo si no hay descuento
        if (!data.savings_percentage || data.savings_percentage === 0) {
            $progressSection.hide();
        } else {
            $progressSection.show();
            updateProgressBar(data);
        }
        
        // Mostrar el widget
        $priceDisplay.fadeIn(300);
        
        setTimeout(function() {
            $('.wc-dynamic-pricing-price-item').addClass('animate-in');
        }, 100);
        
        if (data.savings_percentage && data.savings_percentage > 0) {
            setTimeout(function() {
                $savingsHighlight.addClass('animate-in');
            }, 200);
            
            setTimeout(function() {
                $progressSection.addClass('animate-in');
            }, 300);
        }
    }
    
    function updateQuantityDisplay(quantity) {
        // DISEÑO MODERNIZADO: Actualizar badge de cantidad con nuevo diseño
        var $quantityBadge = $('.wc-dynamic-pricing-quantity-badge');
        if ($quantityBadge.length) {
            var quantityText = quantity === 1 ? 'unidad' : 'unidades';
            $quantityBadge.html('<span class="quantity-number">' + quantity + '</span> <span class="quantity-text">' + quantityText + '</span>');
            
            // Animación sutil de actualización
            $quantityBadge.addClass('quantity-update');
            setTimeout(function() {
                $quantityBadge.removeClass('quantity-update');
            }, 300);
        }
    }
    
    function createSpinnerHTML() {
        // DISEÑO MODERNIZADO: Spinner más elegante
        return '<div class="wc-dynamic-pricing-spinner-overlay">' +
               '<div class="spinner-content">' +
               '<div class="modern-spinner">' +
               '<div class="spinner-ring"></div>' +
               '<div class="spinner-ring"></div>' +
               '<div class="spinner-ring"></div>' +
               '<div class="spinner-ring"></div>' +
               '</div>' +
               '<div class="spinner-text">Calculando precio...</div>' +
               '<div class="spinner-subtext">Revisando descuentos disponibles</div>' +
               '</div>' +
               '</div>';
    }
    
    function showLoader() {
        // OPTIMIZACIÓN: Reutilizar spinner existente si está disponible
        var $existingSpinner = $priceDisplay.find('.wc-dynamic-pricing-spinner-overlay');
        
        if (!$existingSpinner.length) {
            var spinnerHtml = createSpinnerHTML();
            $priceDisplay.find('.wc-dynamic-pricing-content').append(spinnerHtml);
            $existingSpinner = $priceDisplay.find('.wc-dynamic-pricing-spinner-overlay');
        }
        
        // Mostrar spinner
        $priceDisplay.addClass('loading');
        
        // Animación de entrada suave
        setTimeout(function() {
            $existingSpinner.addClass('active');
        }, 50);
        
        if (debugMode) {
            console.log('WC Dynamic Pricing AJAX: Showing spinner');
        }
    }
    
    function hideLoader() {
        var $spinnerOverlay = $priceDisplay.find('.wc-dynamic-pricing-spinner-overlay');
        
        // Animación de salida suave
        $spinnerOverlay.removeClass('active');
        
        setTimeout(function() {
            $priceDisplay.removeClass('loading');
        }, 300);
        
        if (debugMode) {
            console.log('WC Dynamic Pricing AJAX: Hiding spinner');
        }
    }
    
    function showPriceDisplay(data) {
        // DISEÑO MODERNIZADO: Nuevo sistema de visualización de precios
        var $originalPriceContainer = $('.wc-dynamic-pricing-original-price');
        var $priceContainer = $('.wc-dynamic-pricing-price');
        var $totalAmountContainer = $('.wc-dynamic-pricing-total-amount');
        var $savingsHighlight = $('.wc-dynamic-pricing-savings-highlight');
        var $progressSection = $('.wc-dynamic-pricing-progress-section');
        var $titleLabel = $('.wc-dynamic-pricing-label');
        
        // ARREGLO: Quitar clase de loading
        $priceDisplay.removeClass('wc-dp-loading');
        
        // Actualizar título para mostrar que hay descuento
        $titleLabel.text('Precio con descuento');
        
        // ARREGLO: Restaurar el grid completo cuando hay descuento
        var $pricesGrid = $('.wc-dynamic-pricing-prices-grid');
        if ($pricesGrid.length) {
            // Mostrar todas las columnas
            var $originalItem = $pricesGrid.find('.wc-dynamic-pricing-price-item.original, .wc-dynamic-pricing-price-item.unit-price');
            var $discountedItem = $pricesGrid.find('.wc-dynamic-pricing-price-item.discounted');
            var $totalItem = $pricesGrid.find('.wc-dynamic-pricing-price-item.total');
            
            $originalItem.show();
            $discountedItem.show();
            $totalItem.show();
            
            // Restaurar clases y labels originales
            $originalItem.removeClass('unit-price').addClass('original');
            $originalItem.find('.price-label').text('Precio original');
            $discountedItem.find('.price-label').text('Precio con descuento');
            $totalItem.find('.price-label').text('Total de la compra');
            
            // El grid vuelve automáticamente a las 3 columnas al mostrar todos los elementos
        }
        
        // Mostrar precios en el grid modernizado
        $originalPriceContainer.html(data.original_price);
        $priceContainer.html(data.discounted_price);
        $totalAmountContainer.html(data.total_discounted);
        
        // ARREGLO: Asegurar que el highlight de ahorros se muestre
        $savingsHighlight.show().removeClass('no-discount');
        
        // Restaurar icono para modo con descuento
        $savingsHighlight.find('.savings-icon').text('🎉');
        
        // Highlight de ahorros mejorado
        var savingsText = 'Ahorras ' + data.savings + ' por unidad (' + data.savings_percentage + '% de descuento)';
        if (data.quantity > 1) {
            savingsText += '<br><small class="quantity-info">Total ahorrado: ' + data.total_savings + '</small>';
        }
        
        // ARREGLO: Usar fallback si no encuentra el elemento
        var $savingsTextElement = $savingsHighlight.find('.savings-text');
        if ($savingsTextElement.length === 0) {
            $savingsHighlight.append('<div class="savings-text"></div>');
            $savingsTextElement = $savingsHighlight.find('.savings-text');
        }
        
        $savingsTextElement.html(savingsText);
        
        // Sistema de progreso hacia siguiente descuento
        updateProgressBar(data);
        
        // Mostrar sección de progreso
        $progressSection.show();
        
        // El widget ya está visible, solo actualizamos el contenido
        
        // Animaciones secuenciales para mejor UX
        setTimeout(function() {
            $('.wc-dynamic-pricing-price-item').addClass('animate-in');
        }, 100);
        
        setTimeout(function() {
            $savingsHighlight.addClass('animate-in');
        }, 200);
        
        setTimeout(function() {
            $progressSection.addClass('animate-in');
        }, 300);
        
        animatePriceChange();
    }
    
    // Sistema de progreso hacia descuentos
    function updateProgressBar(data) {
        var $progressBar = $('.wc-dynamic-pricing-progress-bar');
        var $progressFill = $('.progress-fill');
        var $progressText = $('.progress-text');
        var $progressLabel = $('.progress-label');
        
        var currentQuantity = data.quantity;
        var nextTier = getNextDiscountTier(currentQuantity, data.discount_tiers);
        
        if (nextTier) {
            var progress = Math.min((currentQuantity / nextTier.quantity) * 100, 100);
            
            if ($progressFill.length) {
                $progressFill.css('width', progress + '%');
            }
            
            var progressMessage, labelMessage;
            if (data.has_discount) {
                progressMessage = 'Compra ' + (nextTier.quantity - currentQuantity) + ' más para obtener ' + nextTier.discount + '% de descuento';
                labelMessage = 'Progreso hacia el siguiente descuento';
            } else {
                progressMessage = 'Compra ' + (nextTier.quantity - currentQuantity) + ' más para obtener tu primer descuento del ' + nextTier.discount + '%';
                labelMessage = '¡Obtén descuentos comprando más cantidad!';
            }
            
            if ($progressText.length) {
                $progressText.html(progressMessage);
            }
            
            if ($progressLabel.length) {
                $progressLabel.text(labelMessage);
                $progressLabel.show();
            }
            
            if ($progressBar.length) {
                $progressBar.parent().show();
            }
            
            // Animar la barra de progreso
            setTimeout(function() {
                if ($progressFill.length) {
                    $progressFill.addClass('progress-animate');
                }
            }, 400);
        } else {
            // Ya alcanzó el máximo descuento
            if (data.has_discount) {
                if ($progressText.length) $progressText.html('¡Has alcanzado el máximo descuento disponible!');
                if ($progressLabel.length) $progressLabel.text('Máximo descuento alcanzado');
                if ($progressFill.length) $progressFill.css('width', '100%');
                if ($progressLabel.length) $progressLabel.show();
                if ($progressBar.length) $progressBar.parent().show();
            } else {
                // Sin descuento y sin más niveles - ocultar
                if ($progressLabel.length) $progressLabel.hide();
                if ($progressBar.length) $progressBar.parent().hide();
            }
        }
    }
    
    // Lógica de niveles de descuento usando datos reales
    function getNextDiscountTier(currentQuantity, discountTiers) {
        // Si no hay tiers del servidor, usar valores por defecto
        if (!discountTiers || !Array.isArray(discountTiers) || discountTiers.length === 0) {
            var fallbackTiers = [
                { quantity: 2, discount: 10 },
                { quantity: 3, discount: 15 },
                { quantity: 5, discount: 20 },
                { quantity: 10, discount: 25 },
                { quantity: 20, discount: 30 }
            ];
            
            for (var i = 0; i < fallbackTiers.length; i++) {
                if (currentQuantity < fallbackTiers[i].quantity) {
                    return fallbackTiers[i];
                }
            }
            return null;
        }
        
        // Usar los tiers reales del servidor
        for (var i = 0; i < discountTiers.length; i++) {
            if (currentQuantity < discountTiers[i].quantity) {
                return discountTiers[i];
            }
        }
        
        return null; // Ya alcanzó el máximo descuento
    }
    
    function hidePriceDisplay() {
        // DISEÑO MODERNIZADO: Ocultar con animación mejorada
        $('.wc-dynamic-pricing-price-item').removeClass('animate-in');
        $('.wc-dynamic-pricing-savings-highlight').removeClass('animate-in');
        $('.wc-dynamic-pricing-progress-section').removeClass('animate-in');
        
        setTimeout(function() {
            $priceDisplay.fadeOut(300);
        }, 100);
    }
    
    function addStrikethroughToOriginalPrice() {
        // Add strikethrough to the main product price
        var $originalProductPrice = $('.price');
        $originalProductPrice.addClass('wc-dynamic-pricing-original-strikethrough');
        
        // Also add strikethrough to the price in our display
        var $originalPriceContainer = $('.wc-dynamic-pricing-original-price');
        $originalPriceContainer.addClass('wc-dynamic-pricing-original-strikethrough');
    }
    
    function removeStrikethroughFromOriginalPrice() {
        // Remove strikethrough from the main product price
        var $originalProductPrice = $('.price');
        $originalProductPrice.removeClass('wc-dynamic-pricing-original-strikethrough');
        
        // Also remove from our display
        var $originalPriceContainer = $('.wc-dynamic-pricing-original-price');
        $originalPriceContainer.removeClass('wc-dynamic-pricing-original-strikethrough');
    }
    
    // Animation for price changes
    function animatePriceChange() {
        var $priceContainer = $('.wc-dynamic-pricing-price');
        $priceContainer.addClass('price-update');
        setTimeout(function() {
            $priceContainer.removeClass('price-update');
        }, 300);
    }
    
    // OPTIMIZACIÓN: Handle responsive behavior más eficientemente
    function handleResponsive() {
        var isMobile = $(window).width() < 768;
        $priceDisplay.toggleClass('mobile-view', isMobile);
    }
    
    // OPTIMIZACIÓN: Throttled resize handler
    function throttle(func, limit) {
        var inThrottle;
        return function() {
            var args = arguments;
            var context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(function() {
                    inThrottle = false;
                }, limit);
            }
        };
    }
    
    // Initialize responsive behavior
    handleResponsive();
    $(window).on('resize', throttle(handleResponsive, 250));
    
    // OPTIMIZACIÓN: Cleanup on page unload
    $(window).on('beforeunload', function() {
        // Cancelar cualquier request pendiente
        cancelCurrentRequest();
        
        // Limpiar timers
        if (requestTimeout) {
            clearTimeout(requestTimeout);
        }
        
        // Limpiar caché si es muy grande
        if (cacheEnabled && Object.keys(requestCache).length > 50) {
            requestCache = {};
            console.log('WC Dynamic Pricing AJAX: Cache cleared on page unload');
        }
    });
    
    // OPTIMIZACIÓN: Expose cache management functions for debugging
    if (debugMode) {
        window.wcDynamicPricingDebug = {
            getCache: function() {
                return requestCache;
            },
            clearCache: function() {
                requestCache = {};
                console.log('Cache cleared manually');
            },
            getCacheStats: function() {
                var total = Object.keys(requestCache).length;
                var expired = 0;
                var now = Date.now();
                
                for (var key in requestCache) {
                    if (requestCache.hasOwnProperty(key) && (now - requestCache[key].timestamp) >= cacheTTL) {
                        expired++;
                    }
                }
                
                return {
                    total: total,
                    expired: expired,
                    active: total - expired,
                    ttl: cacheTTL / 1000 + 's'
                };
            }
        };
        
        console.log('WC Dynamic Pricing AJAX: Debug functions available in window.wcDynamicPricingDebug');
    }
});