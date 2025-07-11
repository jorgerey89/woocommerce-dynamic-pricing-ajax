<?php
/**
 * Plugin Name: WooCommerce Dynamic Pricing AJAX
 * Description: Muestra el precio con descuento dinámicamente cuando se selecciona la cantidad del producto usando AJAX
 * Version: 1.1.0
 * Author: Woland
 * Author URI: https://www.woland.es/
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wc-dynamic-pricing-ajax
 * Domain Path: /languages
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('WC_DYNAMIC_PRICING_AJAX_VERSION', '1.1.0');
define('WC_DYNAMIC_PRICING_AJAX_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WC_DYNAMIC_PRICING_AJAX_PLUGIN_URL', plugin_dir_url(__FILE__));

class WC_Dynamic_Pricing_AJAX {
    
    private $cache = array();
    private $cache_ttl = 300; // 5 minutos
    
    public function __construct() {
        add_action('init', array($this, 'init'));
    }
    
    public function init() {
        // Check if WooCommerce is active
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', array($this, 'woocommerce_missing_notice'));
            return;
        }
        
        // Check if WooCommerce Dynamic Pricing is active
        if (!class_exists('WC_Dynamic_Pricing')) {
            add_action('admin_notices', array($this, 'dynamic_pricing_missing_notice'));
            return;
        }
        
        // Enqueue scripts and styles ONLY on product pages
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        
        // AJAX handlers
        add_action('wp_ajax_get_dynamic_price', array($this, 'get_dynamic_price'));
        add_action('wp_ajax_nopriv_get_dynamic_price', array($this, 'get_dynamic_price'));
        
        // Add price display container
        add_action('woocommerce_single_product_summary', array($this, 'add_dynamic_price_container'), 15);
        
        // Add script to handle original price strikethrough
        add_action('wp_footer', array($this, 'add_price_strikethrough_script'));
        
        // Clear cache when product is updated
        add_action('woocommerce_update_product', array($this, 'clear_product_cache'));
        add_action('save_post', array($this, 'clear_cache_on_save'));
    }
    
    public function enqueue_scripts() {
        // OPTIMIZACIÓN: Solo cargar en páginas de producto
        if (!is_product()) {
            return;
        }
        
        global $product;
        
        // OPTIMIZACIÓN: Solo cargar si el producto tiene pricing dinámico
        if (!$this->has_dynamic_pricing($product)) {
            return;
        }
        
        wp_enqueue_script(
            'wc-dynamic-pricing-ajax',
            WC_DYNAMIC_PRICING_AJAX_PLUGIN_URL . 'assets/js/dynamic-pricing-ajax.js',
            array('jquery'),
            WC_DYNAMIC_PRICING_AJAX_VERSION,
            true
        );
        
        // OPTIMIZACIÓN: Configuración del debounce
        wp_localize_script('wc-dynamic-pricing-ajax', 'wc_dynamic_pricing_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('wc_dynamic_pricing_ajax_nonce'),
            'product_id' => get_the_ID(),
            'debounce_delay' => apply_filters('wc_dynamic_pricing_debounce_delay', 300), // 300ms por defecto
            'cache_ttl' => $this->cache_ttl * 1000, // Convertir a milisegundos para JS
            'enable_cache' => apply_filters('wc_dynamic_pricing_enable_cache', true)
        ));
        
        wp_enqueue_style(
            'wc-dynamic-pricing-ajax',
            WC_DYNAMIC_PRICING_AJAX_PLUGIN_URL . 'assets/css/dynamic-pricing-ajax.css',
            array(),
            WC_DYNAMIC_PRICING_AJAX_VERSION
        );
    }
    
    public function add_dynamic_price_container() {
        global $product;
        
        if (!$product) {
            return;
        }
        
        // OPTIMIZACIÓN: Solo mostrar si tiene pricing dinámico
        if (!$this->has_dynamic_pricing($product)) {
            return;
        }
        
        // DISEÑO MODERNIZADO: Nuevo widget con diseño mejorado
        echo '<div id="wc-dynamic-pricing-display" class="wc-dynamic-pricing-container wc-dp-loading">
                <div class="wc-dynamic-pricing-content">
                    <div class="wc-dynamic-pricing-header">
                        <div class="wc-dynamic-pricing-title-section">
                            <div class="wc-dynamic-pricing-icon">💰</div>
                            <div class="wc-dynamic-pricing-title-text">
                                <span class="wc-dynamic-pricing-label">Resumen de compra</span>
                                <span class="wc-dynamic-pricing-subtitle">Información de precio y cantidad</span>
                            </div>
                        </div>
                        <div class="wc-dynamic-pricing-quantity-badge">
                            <span class="quantity-number">1</span> <span class="quantity-text">unidad</span>
                        </div>
                    </div>
                    
                    <div class="wc-dynamic-pricing-prices-grid">
                        <div class="wc-dynamic-pricing-price-item original unit-price">
                            <div class="price-label">Precio por unidad</div>
                            <div class="price-value wc-dynamic-pricing-original-price">Cargando...</div>
                        </div>
                        <div class="wc-dynamic-pricing-price-item discounted" style="display: none;">
                            <div class="price-label">Precio con descuento</div>
                            <div class="price-value wc-dynamic-pricing-price"></div>
                        </div>
                        <div class="wc-dynamic-pricing-price-item total">
                            <div class="price-label">Total de la compra</div>
                            <div class="price-value wc-dynamic-pricing-total-amount">Cargando...</div>
                        </div>
                    </div>
                    
                    <div class="wc-dynamic-pricing-savings-highlight no-discount">
                        <div class="savings-icon">ℹ️</div>
                        <div class="savings-text">Calculando información de precios...</div>
                    </div>
                    
                    <div class="wc-dynamic-pricing-progress-section">
                        <div class="progress-label">Verificando descuentos disponibles...</div>
                        <div class="wc-dynamic-pricing-progress-bar">
                            <div class="progress-fill" style="width: 0%;"></div>
                            <div class="progress-indicator"></div>
                        </div>
                        <div class="progress-text">Cargando información de descuentos...</div>
                    </div>
                </div>
              </div>';
    }
    
    public function add_price_strikethrough_script() {
        if (!is_product()) {
            return;
        }
        
        global $product;
        if (!$this->has_dynamic_pricing($product)) {
            return;
        }
        ?>
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            // Add custom CSS for strikethrough effect
            if (!$('#wc-dynamic-pricing-strikethrough-css').length) {
                $('head').append('<style id="wc-dynamic-pricing-strikethrough-css">.wc-dynamic-pricing-original-strikethrough { text-decoration: line-through !important; opacity: 0.6; }</style>');
            }
        });
        </script>
        <?php
    }
    
    public function get_dynamic_price() {
        // OPTIMIZACIÓN: Verificar nonce más temprano
        if (!wp_verify_nonce($_POST['nonce'], 'wc_dynamic_pricing_ajax_nonce')) {
            wp_send_json_error('Security check failed', 403);
        }
        
        $product_id = intval($_POST['product_id']);
        $quantity = intval($_POST['quantity']);
        
        if (!$product_id || !$quantity) {
            wp_send_json_error('Invalid parameters', 400);
        }
        
        // OPTIMIZACIÓN: Verificar caché primero
        $cache_key = $this->generate_cache_key($product_id, $quantity);
        $cached_result = $this->get_cached_result($cache_key);
        
        if ($cached_result !== false) {
            wp_send_json_success(array_merge($cached_result, array('from_cache' => true)));
        }
        
        $product = wc_get_product($product_id);
        
        if (!$product) {
            wp_send_json_error('Product not found', 404);
        }
        
        $original_price = $product->get_price();
        $discounted_price = $this->calculate_dynamic_price($product, $quantity);
        
        // Debug information
        $debug_info = array(
            'product_id' => $product_id,
            'quantity' => $quantity,
            'original_price' => $original_price,
            'calculated_price' => $discounted_price,
            'cache_key' => $cache_key,
            'from_cache' => false
        );
        
        $response_data = array();
        
        if ($discounted_price && $discounted_price < $original_price) {
            $savings = $original_price - $discounted_price;
            $savings_percentage = round(($savings / $original_price) * 100);
            $total_original = $original_price * $quantity;
            $total_discounted = $discounted_price * $quantity;
            $total_savings = $total_original - $total_discounted;
            
            // ARREGLO: Incluir información de niveles de descuento reales
            $discount_tiers = $this->get_discount_tiers($product);
            
            $response_data = array(
                'original_price' => wc_price($original_price),
                'discounted_price' => wc_price($discounted_price),
                'total_original' => wc_price($total_original),
                'total_discounted' => wc_price($total_discounted),
                'savings' => wc_price($savings),
                'total_savings' => wc_price($total_savings),
                'savings_percentage' => $savings_percentage,
                'quantity' => $quantity,
                'has_discount' => true,
                'discount_tiers' => $discount_tiers,
                'debug' => $debug_info
            );
        } else {
            // ARREGLO: Incluir información básica incluso sin descuento
            $total_price = $original_price * $quantity;
            $discount_tiers = $this->get_discount_tiers($product);
            
            $response_data = array(
                'original_price' => wc_price($original_price),
                'discounted_price' => wc_price($original_price),
                'total_original' => wc_price($total_price),
                'total_discounted' => wc_price($total_price),
                'savings' => wc_price(0),
                'total_savings' => wc_price(0),
                'savings_percentage' => 0,
                'quantity' => $quantity,
                'has_discount' => false,
                'discount_tiers' => $discount_tiers,
                'debug' => array_merge($debug_info, array('no_discount_reason' => 'No pricing rules matched or price not lower'))
            );
        }
        
        // OPTIMIZACIÓN: Guardar en caché
        $this->set_cached_result($cache_key, $response_data);
        
        wp_send_json_success($response_data);
    }
    
    private function calculate_dynamic_price($product, $quantity) {
        if (!class_exists('WC_Dynamic_Pricing')) {
            return false;
        }
        
        // OPTIMIZACIÓN: Caché interno para evitar múltiples consultas de meta
        $product_id = $product->get_id();
        $rules_cache_key = 'pricing_rules_' . $product_id;
        
        if (isset($this->cache[$rules_cache_key])) {
            $pricing_rules = $this->cache[$rules_cache_key];
        } else {
            // Try different meta keys for pricing rules
            $pricing_rules = get_post_meta($product_id, '_pricing_rules', true);
            
            // If not found, try alternative meta key
            if (!$pricing_rules) {
                $pricing_rules = get_post_meta($product_id, '_wc_dynamic_pricing_rules', true);
            }
            
            // OPTIMIZACIÓN: Guardar en caché interno
            $this->cache[$rules_cache_key] = $pricing_rules;
        }
        
        // Debug: Log the pricing rules structure
        error_log('Pricing rules for product ' . $product_id . ': ' . print_r($pricing_rules, true));
        
        if (!$pricing_rules || !is_array($pricing_rules)) {
            return false;
        }
        
        $original_price = $product->get_price();
        $discounted_price = $original_price;
        
        // Navigate through the nested structure
        foreach ($pricing_rules as $rule_set) {
            if (!isset($rule_set['rules']) || !is_array($rule_set['rules'])) {
                continue;
            }
            
            // Process each rule within the set
            foreach ($rule_set['rules'] as $rule) {
                // Check different possible type values
                $rule_type = isset($rule['type']) ? $rule['type'] : '';
                
                if ($rule_type !== 'price_discount') {
                    continue;
                }
                
                // Check if quantity falls within rule range
                $min_quantity = isset($rule['from']) ? intval($rule['from']) : 1;
                $max_quantity = isset($rule['to']) && !empty($rule['to']) ? intval($rule['to']) : PHP_INT_MAX;
                
                if ($quantity >= $min_quantity && $quantity <= $max_quantity) {
                    // Handle comma as decimal separator
                    $discount_amount = $rule['amount'];
                    if (is_string($discount_amount)) {
                        $discount_amount = str_replace(',', '.', $discount_amount);
                    }
                    $discount_amount = floatval($discount_amount);
                    
                    $new_price = $original_price - $discount_amount;
                    
                    // Ensure price doesn't go below 0
                    if ($new_price < 0) {
                        $new_price = 0;
                    }
                    
                    // For bulk mode, we want the best discount
                    if ($new_price < $discounted_price) {
                        $discounted_price = $new_price;
                    }
                }
            }
        }
        
        return $discounted_price !== $original_price ? $discounted_price : false;
    }
    
    private function get_discount_tiers($product) {
        if (!class_exists('WC_Dynamic_Pricing')) {
            return array();
        }
        
        $product_id = $product->get_id();
        $pricing_rules = get_post_meta($product_id, '_pricing_rules', true);
        
        if (!$pricing_rules) {
            $pricing_rules = get_post_meta($product_id, '_wc_dynamic_pricing_rules', true);
        }
        
        if (!$pricing_rules || !is_array($pricing_rules)) {
            return array();
        }
        
        $tiers = array();
        $original_price = $product->get_price();
        
        // Extraer niveles de descuento reales
        foreach ($pricing_rules as $rule_set) {
            if (!isset($rule_set['rules']) || !is_array($rule_set['rules'])) {
                continue;
            }
            
            foreach ($rule_set['rules'] as $rule) {
                $rule_type = isset($rule['type']) ? $rule['type'] : '';
                
                if ($rule_type !== 'price_discount') {
                    continue;
                }
                
                $min_quantity = isset($rule['from']) ? intval($rule['from']) : 1;
                $discount_amount = $rule['amount'];
                
                if (is_string($discount_amount)) {
                    $discount_amount = str_replace(',', '.', $discount_amount);
                }
                $discount_amount = floatval($discount_amount);
                
                $new_price = $original_price - $discount_amount;
                $discount_percentage = round(($discount_amount / $original_price) * 100);
                
                $tiers[] = array(
                    'quantity' => $min_quantity,
                    'discount' => $discount_percentage,
                    'discount_amount' => $discount_amount,
                    'final_price' => $new_price
                );
            }
        }
        
        // Ordenar por cantidad
        usort($tiers, function($a, $b) {
            return $a['quantity'] - $b['quantity'];
        });
        
        return $tiers;
    }
    
    private function has_dynamic_pricing($product) {
        if (!$product) {
            return false;
        }
        
        // OPTIMIZACIÓN: Verificar caché primero
        $product_id = $product->get_id();
        $cache_key = 'has_pricing_' . $product_id;
        
        if (isset($this->cache[$cache_key])) {
            return $this->cache[$cache_key];
        }
        
        $pricing_rules = get_post_meta($product_id, '_pricing_rules', true);
        
        if (!$pricing_rules) {
            $pricing_rules = get_post_meta($product_id, '_wc_dynamic_pricing_rules', true);
        }
        
        $has_pricing = false;
        
        // Check if we have valid pricing rules structure
        if (!empty($pricing_rules) && is_array($pricing_rules)) {
            foreach ($pricing_rules as $rule_set) {
                if (isset($rule_set['rules']) && is_array($rule_set['rules']) && !empty($rule_set['rules'])) {
                    $has_pricing = true;
                    break;
                }
            }
        }
        
        // OPTIMIZACIÓN: Guardar en caché
        $this->cache[$cache_key] = $has_pricing;
        
        return $has_pricing;
    }
    
    // OPTIMIZACIÓN: Sistema de caché con TTL
    private function generate_cache_key($product_id, $quantity) {
        return 'wc_dp_' . $product_id . '_' . $quantity;
    }
    
    private function get_cached_result($cache_key) {
        $transient_key = 'wc_dynamic_pricing_' . $cache_key;
        return get_transient($transient_key);
    }
    
    private function set_cached_result($cache_key, $data) {
        $transient_key = 'wc_dynamic_pricing_' . $cache_key;
        set_transient($transient_key, $data, $this->cache_ttl);
    }
    
    private function clear_cache_for_product($product_id) {
        global $wpdb;
        
        // Limpiar todos los transients relacionados con este producto
        $transient_pattern = '_transient_wc_dynamic_pricing_wc_dp_' . $product_id . '_%';
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
            $transient_pattern
        ));
        
        // Limpiar caché interno
        foreach ($this->cache as $key => $value) {
            if (strpos($key, $product_id) !== false) {
                unset($this->cache[$key]);
            }
        }
    }
    
    public function clear_product_cache($product_id) {
        $this->clear_cache_for_product($product_id);
    }
    
    public function clear_cache_on_save($post_id) {
        if (get_post_type($post_id) === 'product') {
            $this->clear_cache_for_product($post_id);
        }
    }
    
    public function woocommerce_missing_notice() {
        echo '<div class="notice notice-error"><p><strong>WooCommerce Dynamic Pricing AJAX</strong> requiere que WooCommerce esté activado.</p></div>';
    }
    
    public function dynamic_pricing_missing_notice() {
        echo '<div class="notice notice-error"><p><strong>WooCommerce Dynamic Pricing AJAX</strong> requiere que WooCommerce Dynamic Pricing esté activado.</p></div>';
    }
}

// Initialize the plugin
new WC_Dynamic_Pricing_AJAX();