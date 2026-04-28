import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

import { corsHeaders } from "../_shared/cors.ts";

// ─── PHP Plugin Files ────────────────────────────────────────────────

const PLUGIN_VERSION = '1.0.0';

const mainPluginFile = `<?php
/**
 * Plugin Name: Woo for Kang
 * Plugin URI: https://kangopenbanking.com/woo-for-kang
 * Description: Accept Mobile Money, Bank Transfers, and Card payments in Cameroon via Kang Open Banking.
 * Version: ${PLUGIN_VERSION}
 * Author: Kang Open Banking
 * Author URI: https://kangopenbanking.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: woo-for-kang
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 8.5
 */

if (!defined('ABSPATH')) exit;

define('WFK_VERSION', '${PLUGIN_VERSION}');
define('WFK_PLUGIN_FILE', __FILE__);
define('WFK_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WFK_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WFK_API_BASE_URL', '${API_BASE_URL}');

// Check WooCommerce dependency
add_action('plugins_loaded', 'wfk_check_woocommerce', 0);

function wfk_check_woocommerce() {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', 'wfk_woocommerce_missing_notice');
        return;
    }
    wfk_init();
}

function wfk_woocommerce_missing_notice() {
    echo '<div class="error"><p><strong>Woo for Kang</strong> requires WooCommerce to be installed and activated.</p></div>';
}

function wfk_init() {
    if (!class_exists('WC_Payment_Gateway')) return;

    require_once WFK_PLUGIN_DIR . 'includes/class-wfk-logger.php';
    require_once WFK_PLUGIN_DIR . 'includes/class-wfk-api-client.php';
    require_once WFK_PLUGIN_DIR . 'includes/class-wfk-payment-gateway.php';
    require_once WFK_PLUGIN_DIR . 'includes/class-wfk-webhook-handler.php';

    add_filter('woocommerce_payment_gateways', 'wfk_add_gateway_class');
    WFK_Webhook_Handler::init();

    // Load text domain
    load_plugin_textdomain('woo-for-kang', false, dirname(plugin_basename(__FILE__)) . '/languages');
}

function wfk_add_gateway_class($gateways) {
    $gateways[] = 'WFK_Payment_Gateway';
    return $gateways;
}

// Activation hook
register_activation_hook(__FILE__, 'wfk_activate');
function wfk_activate() {
    if (!class_exists('WooCommerce')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(__('Woo for Kang requires WooCommerce.', 'woo-for-kang'));
    }
    add_option('wfk_plugin_version', WFK_VERSION);
    add_option('wfk_installed_at', current_time('mysql'));
}

// Deactivation hook
register_deactivation_hook(__FILE__, 'wfk_deactivate');
function wfk_deactivate() {
    wp_clear_scheduled_hook('wfk_transaction_sync');
}

// Plugin action links
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'wfk_action_links');
function wfk_action_links($links) {
    $settings_link = '<a href="' . admin_url('admin.php?page=wc-settings&tab=checkout&section=wfk') . '">' . __('Settings', 'woo-for-kang') . '</a>';
    array_unshift($links, $settings_link);
    return $links;
}
`;

const paymentGatewayFile = `<?php
if (!defined('ABSPATH')) exit;

class WFK_Payment_Gateway extends WC_Payment_Gateway {

    private $api_client;
    private $logger;
    public $api_key;
    public $client_secret;
    public $webhook_secret;
    public $sandbox_mode;
    public $debug;
    public $payment_methods;

    public function __construct() {
        $this->id = 'wfk';
        $this->icon = WFK_PLUGIN_URL . 'assets/icon-128x128.png';
        $this->has_fields = false;
        $this->method_title = __('Kang Open Banking', 'woo-for-kang');
        $this->method_description = __('Accept Mobile Money, Card, and Bank Transfer payments via Kang Open Banking.', 'woo-for-kang');
        $this->supports = array('products', 'refunds');

        $this->init_form_fields();
        $this->init_settings();

        $this->title = $this->get_option('title');
        $this->description = $this->get_option('description');
        $this->enabled = $this->get_option('enabled');
        $this->api_key = $this->get_option('api_key');
        $this->client_secret = $this->get_option('client_secret');
        $this->webhook_secret = $this->get_option('webhook_secret');
        $this->sandbox_mode = 'yes' === $this->get_option('sandbox_mode');
        $this->debug = 'yes' === $this->get_option('debug');
        $this->payment_methods = $this->get_option('payment_methods', array('mobile_money', 'card', 'bank_transfer'));

        $this->logger = new WFK_Logger($this->debug);
        $this->api_client = new WFK_API_Client($this->api_key, $this->client_secret, $this->logger);

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        add_action('woocommerce_thankyou_' . $this->id, array($this, 'thankyou_page'));
    }

    public function init_form_fields() {
        $this->form_fields = array(
            'enabled' => array(
                'title' => __('Enable/Disable', 'woo-for-kang'),
                'label' => __('Enable Kang Open Banking', 'woo-for-kang'),
                'type' => 'checkbox',
                'default' => 'no',
            ),
            'title' => array(
                'title' => __('Title', 'woo-for-kang'),
                'type' => 'text',
                'description' => __('Payment method title shown at checkout.', 'woo-for-kang'),
                'default' => __('Mobile Money / Card / Bank Transfer', 'woo-for-kang'),
                'desc_tip' => true,
            ),
            'description' => array(
                'title' => __('Description', 'woo-for-kang'),
                'type' => 'textarea',
                'description' => __('Payment method description shown at checkout.', 'woo-for-kang'),
                'default' => __('Pay securely using Mobile Money (MTN, Orange), Credit/Debit Card, or Bank Transfer.', 'woo-for-kang'),
                'desc_tip' => true,
            ),
            'api_key' => array(
                'title' => __('API Key', 'woo-for-kang'),
                'type' => 'text',
                'description' => __('Your Kang Open Banking API key from the merchant dashboard.', 'woo-for-kang'),
                'desc_tip' => true,
            ),
            'client_secret' => array(
                'title' => __('Client Secret', 'woo-for-kang'),
                'type' => 'password',
                'description' => __('Your Kang Open Banking client secret.', 'woo-for-kang'),
                'desc_tip' => true,
            ),
            'webhook_secret' => array(
                'title' => __('Webhook Secret', 'woo-for-kang'),
                'type' => 'password',
                'description' => __('Used to verify incoming webhook signatures.', 'woo-for-kang'),
                'desc_tip' => true,
            ),
            'sandbox_mode' => array(
                'title' => __('Sandbox Mode', 'woo-for-kang'),
                'label' => __('Enable sandbox/test mode', 'woo-for-kang'),
                'type' => 'checkbox',
                'description' => __('Use sandbox API for testing. Disable for live payments.', 'woo-for-kang'),
                'default' => 'yes',
                'desc_tip' => true,
            ),
            'payment_methods' => array(
                'title' => __('Payment Methods', 'woo-for-kang'),
                'type' => 'multiselect',
                'class' => 'wc-enhanced-select',
                'description' => __('Select which payment methods to enable.', 'woo-for-kang'),
                'default' => array('mobile_money', 'card', 'bank_transfer'),
                'options' => array(
                    'mobile_money' => __('Mobile Money (MTN, Orange)', 'woo-for-kang'),
                    'card' => __('Credit/Debit Card', 'woo-for-kang'),
                    'bank_transfer' => __('Bank Transfer', 'woo-for-kang'),
                ),
                'desc_tip' => true,
            ),
            'debug' => array(
                'title' => __('Debug Log', 'woo-for-kang'),
                'label' => __('Enable debug logging', 'woo-for-kang'),
                'type' => 'checkbox',
                'description' => sprintf(__('Log events to %s', 'woo-for-kang'), '<code>' . WC_Log_Handler_File::get_log_file_path('wfk') . '</code>'),
                'default' => 'no',
            ),
        );
    }

    public function is_available() {
        if ('yes' !== $this->enabled) return false;
        if (empty($this->api_key) || empty($this->client_secret)) return false;
        return parent::is_available();
    }

    public function process_payment($order_id) {
        $order = wc_get_order($order_id);

        if (!$order) {
            $this->logger->error('Order not found: ' . $order_id);
            wc_add_notice(__('Order not found.', 'woo-for-kang'), 'error');
            return array('result' => 'fail');
        }

        $payment_data = array(
            'api_key' => $this->api_key,
            'amount' => floatval($order->get_total()),
            'currency' => $order->get_currency(),
            'woocommerce_order_id' => $order_id,
            'customer_email' => $order->get_billing_email(),
            'customer_name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
            'customer_phone' => $order->get_billing_phone(),
            'payment_method' => $this->get_selected_payment_method($order),
            'return_url' => $this->get_return_url($order),
            'cancel_url' => $order->get_cancel_order_url(),
            'webhook_url' => WC()->api_request_url('wfk_webhook'),
            'metadata' => array(
                'store_url' => get_site_url(),
                'plugin_version' => WFK_VERSION,
                'woocommerce_version' => WC()->version,
            ),
        );

        $this->logger->info('Processing payment for order ' . $order_id);

        $response = $this->api_client->process_payment($payment_data);

        if (is_wp_error($response)) {
            $this->logger->error('Payment failed: ' . $response->get_error_message());
            wc_add_notice(__('Payment error: ', 'woo-for-kang') . $response->get_error_message(), 'error');
            return array('result' => 'fail');
        }

        if (isset($response['transaction_ref'])) {
            $order->update_meta_data('_wfk_transaction_ref', sanitize_text_field($response['transaction_ref']));
        }
        if (isset($response['payment_url'])) {
            $order->update_meta_data('_wfk_payment_url', esc_url_raw($response['payment_url']));
        }
        $order->save();
        $order->update_status('pending', __('Awaiting Kang Open Banking payment.', 'woo-for-kang'));

        $this->logger->info('Payment initiated for order ' . $order_id . ' — ref: ' . ($response['transaction_ref'] ?? 'N/A'));

        $redirect_url = isset($response['payment_url']) ? $response['payment_url'] : $this->get_return_url($order);

        return array(
            'result' => 'success',
            'redirect' => $redirect_url,
        );
    }

    public function process_refund($order_id, $amount = null, $reason = '') {
        $order = wc_get_order($order_id);
        $transaction_ref = $order->get_meta('_wfk_transaction_ref');

        if (empty($transaction_ref)) {
            return new WP_Error('wfk_refund_error', __('No transaction reference found.', 'woo-for-kang'));
        }

        $response = $this->api_client->process_refund($transaction_ref, $amount, $reason);

        if (is_wp_error($response)) {
            return $response;
        }

        $order->add_order_note(
            sprintf(__('Refund of %s processed via Kang Open Banking. Reason: %s', 'woo-for-kang'), wc_price($amount), $reason)
        );

        return true;
    }

    public function thankyou_page($order_id) {
        $order = wc_get_order($order_id);
        if ($order && 'pending' === $order->get_status()) {
            echo '<p class="wfk-payment-pending">' . esc_html__('Your payment is being processed. You will receive a confirmation once completed.', 'woo-for-kang') . '</p>';
        }
    }

    private function get_selected_payment_method($order) {
        $phone = $order->get_billing_phone();
        $currency = $order->get_currency();
        // Default logic: if phone present and XAF currency, use mobile_money; otherwise card
        if (!empty($phone) && in_array($currency, array('XAF', 'XOF', 'GHS', 'KES', 'UGX', 'TZS', 'RWF'))) {
            return 'mobile_money';
        }
        return 'card';
    }
}
`;

const apiClientFile = `<?php
if (!defined('ABSPATH')) exit;

class WFK_API_Client {

    private $api_key;
    private $client_secret;
    private $logger;
    private $base_url;

    public function __construct($api_key, $client_secret, $logger) {
        $this->api_key = $api_key;
        $this->client_secret = $client_secret;
        $this->logger = $logger;
        $this->base_url = WFK_API_BASE_URL;
    }

    public function process_payment($payment_data) {
        return $this->make_request('woocommerce-process-payment', $payment_data, 'POST');
    }

    public function process_refund($transaction_ref, $amount, $reason) {
        return $this->make_request('woocommerce-process-payment', array(
            'action' => 'refund',
            'transaction_ref' => $transaction_ref,
            'amount' => $amount,
            'reason' => $reason,
        ), 'POST');
    }

    public function validate_install() {
        return $this->make_request('woocommerce-validate-install', array(
            'api_key' => $this->api_key,
            'plugin_version' => WFK_VERSION,
            'store_url' => get_site_url(),
            'php_version' => phpversion(),
            'wp_version' => get_bloginfo('version'),
            'wc_version' => defined('WC_VERSION') ? WC_VERSION : 'unknown',
        ), 'POST');
    }

    public function sync_transactions($params = array()) {
        return $this->make_request('woocommerce-transaction-sync', $params, 'POST');
    }

    private function make_request($endpoint, $data = array(), $method = 'GET') {
        $url = trailingslashit($this->base_url) . $endpoint;

        $args = array(
            'method' => $method,
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-API-Key' => $this->api_key,
                'X-Plugin-Version' => WFK_VERSION,
                'X-Store-URL' => get_site_url(),
            ),
        );

        if ($method === 'POST' && !empty($data)) {
            $args['body'] = wp_json_encode($data);
        }

        $this->logger->debug('API Request: ' . $method . ' ' . $url);

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            $this->logger->error('API Error: ' . $response->get_error_message());
            return $response;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status_code >= 400) {
            $error_msg = isset($body['message']) ? $body['message'] : 'Unknown API error (HTTP ' . $status_code . ')';
            $this->logger->error('API Error ' . $status_code . ': ' . $error_msg);
            return new WP_Error('wfk_api_error', $error_msg);
        }

        return $body;
    }

    public function verify_webhook_signature($payload, $signature) {
        $computed = hash_hmac('sha256', $payload, $this->client_secret);
        return hash_equals($computed, $signature);
    }
}
`;

const webhookHandlerFile = `<?php
if (!defined('ABSPATH')) exit;

class WFK_Webhook_Handler {

    public static function init() {
        add_action('woocommerce_api_wfk_webhook', array(__CLASS__, 'handle'));
    }

    public static function handle() {
        $logger = new WFK_Logger(true);
        $payload = file_get_contents('php://input');

        if (empty($payload)) {
            $logger->error('Webhook: Empty payload');
            status_header(400);
            exit('Empty payload');
        }

        $signature = isset($_SERVER['HTTP_X_WEBHOOK_SIGNATURE']) ? sanitize_text_field($_SERVER['HTTP_X_WEBHOOK_SIGNATURE']) : '';

        // Get gateway settings for secret verification
        $gateway_settings = get_option('woocommerce_wfk_settings', array());
        $webhook_secret = isset($gateway_settings['webhook_secret']) ? $gateway_settings['webhook_secret'] : '';

        if (!empty($webhook_secret)) {
            $computed = hash_hmac('sha256', $payload, $webhook_secret);
            if (!hash_equals($computed, $signature)) {
                $logger->error('Webhook: Invalid signature');
                status_header(401);
                exit('Invalid signature');
            }
        }

        $data = json_decode($payload, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $logger->error('Webhook: Invalid JSON');
            status_header(400);
            exit('Invalid JSON');
        }

        $logger->info('Webhook received: ' . ($data['event_type'] ?? 'unknown'));

        $order_id = isset($data['woocommerce_order_id']) ? absint($data['woocommerce_order_id']) : 0;
        $transaction_ref = isset($data['transaction_ref']) ? sanitize_text_field($data['transaction_ref']) : '';

        if (!$order_id && $transaction_ref) {
            // Look up order by transaction ref
            $orders = wc_get_orders(array(
                'meta_key' => '_wfk_transaction_ref',
                'meta_value' => $transaction_ref,
                'limit' => 1,
            ));
            if (!empty($orders)) {
                $order_id = $orders[0]->get_id();
            }
        }

        if (!$order_id) {
            $logger->error('Webhook: No order found for ref ' . $transaction_ref);
            status_header(404);
            exit('Order not found');
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            $logger->error('Webhook: Order ' . $order_id . ' not found');
            status_header(404);
            exit('Order not found');
        }

        // Idempotency: skip if already processed
        $existing_ref = $order->get_meta('_wfk_transaction_ref');
        if ($existing_ref === $transaction_ref && in_array($order->get_status(), array('processing', 'completed'))) {
            $logger->info('Webhook: Order ' . $order_id . ' already processed');
            status_header(200);
            exit('Already processed');
        }

        $status = isset($data['status']) ? sanitize_text_field($data['status']) : '';
        $amount = isset($data['amount']) ? floatval($data['amount']) : 0;

        switch ($status) {
            case 'completed':
            case 'successful':
                $order->payment_complete($transaction_ref);
                $order->add_order_note(
                    sprintf(__('Payment completed via Kang Open Banking. Transaction ref: %s. Amount: %s', 'woo-for-kang'), $transaction_ref, wc_price($amount))
                );
                $logger->info('Webhook: Order ' . $order_id . ' marked as paid');
                break;

            case 'failed':
                $order->update_status('failed', __('Payment failed via Kang Open Banking.', 'woo-for-kang'));
                $logger->info('Webhook: Order ' . $order_id . ' marked as failed');
                break;

            case 'cancelled':
                $order->update_status('cancelled', __('Payment cancelled via Kang Open Banking.', 'woo-for-kang'));
                $logger->info('Webhook: Order ' . $order_id . ' cancelled');
                break;

            case 'refunded':
                $order->update_status('refunded', sprintf(__('Refund of %s processed via Kang Open Banking.', 'woo-for-kang'), wc_price($amount)));
                $logger->info('Webhook: Order ' . $order_id . ' refunded');
                break;

            default:
                $order->add_order_note(sprintf(__('Kang Open Banking webhook received with status: %s', 'woo-for-kang'), $status));
                $logger->info('Webhook: Order ' . $order_id . ' received status ' . $status);
        }

        status_header(200);
        exit('OK');
    }
}
`;

const loggerFile = `<?php
if (!defined('ABSPATH')) exit;

class WFK_Logger {

    private $debug_enabled;
    private $logger;
    private $source = 'wfk';

    public function __construct($debug_enabled = false) {
        $this->debug_enabled = $debug_enabled;
        if (function_exists('wc_get_logger')) {
            $this->logger = wc_get_logger();
        }
    }

    public function debug($message) {
        if ($this->debug_enabled && $this->logger) {
            $this->logger->debug($message, array('source' => $this->source));
        }
    }

    public function info($message) {
        if ($this->logger) {
            $this->logger->info($message, array('source' => $this->source));
        }
    }

    public function warning($message) {
        if ($this->logger) {
            $this->logger->warning($message, array('source' => $this->source));
        }
    }

    public function error($message) {
        if ($this->logger) {
            $this->logger->error($message, array('source' => $this->source));
        }
    }
}
`;

const readmeFile = `=== Woo for Kang ===
Contributors: kangopenbanking
Tags: woocommerce, mobile money, cameroon, payment gateway, xaf
Requires at least: 5.8
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: ${PLUGIN_VERSION}
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Accept Mobile Money (MTN, Orange), Card, and Bank Transfer payments in your WooCommerce store via Kang Open Banking.

== Description ==

Woo for Kang enables WooCommerce merchants in Cameroon and the CEMAC region to accept payments through:

* **Mobile Money** — MTN Mobile Money and Orange Money
* **Card Payments** — Visa, Mastercard via Stripe
* **Bank Transfers** — Direct bank transfers in XAF

= Features =

* One-click installation and setup
* Real-time payment status via webhooks
* Automatic order status updates
* Sandbox mode for testing
* XAF (Central African Franc) native support
* Transaction synchronization
* Comprehensive debug logging
* Full refund support

== Installation ==

1. Upload the plugin files to \\\`/wp-content/plugins/woo-for-kang/\\\` or install through WordPress plugins screen.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Navigate to WooCommerce → Settings → Payments → Kang Open Banking.
4. Enter your API Key and Client Secret from your Kang Open Banking merchant dashboard.
5. Enable your preferred payment methods and save.

== Frequently Asked Questions ==

= Where do I get my API credentials? =

Register your store at https://kangopenbanking.com/integrations/woocommerce-merchant-register to receive your API Key and Client Secret.

= Does this plugin support test/sandbox mode? =

Yes. Enable "Sandbox Mode" in the plugin settings to test with sandbox credentials before going live.

= What currencies are supported? =

The primary currency is XAF (Central African Franc). Multi-currency support is available for international cards.

= How do webhooks work? =

The plugin automatically registers a webhook endpoint. Payment status updates are received in real-time and order statuses are updated accordingly.

== Changelog ==

= ${PLUGIN_VERSION} =
* Initial release
* Mobile Money integration (MTN, Orange)
* Card payment support via Stripe
* Bank transfer support
* Webhook-based order status updates
* Sandbox mode
* Transaction synchronization
* Debug logging

== Upgrade Notice ==

= ${PLUGIN_VERSION} =
Initial release of Woo for Kang.
`;

const uninstallFile = `<?php
/**
 * Woo for Kang Uninstall
 *
 * Fired when the plugin is uninstalled.
 */

if (!defined('WP_UNINSTALL_PLUGIN')) exit;

// Remove plugin options
delete_option('wfk_plugin_version');
delete_option('wfk_installed_at');
delete_option('woocommerce_wfk_settings');

// Clear scheduled hooks
wp_clear_scheduled_hook('wfk_transaction_sync');
`;

const paymentInstructionsTemplate = `<?php
/**
 * Payment instructions template
 *
 * Displayed on the checkout page when Kang Open Banking is selected.
 */

if (!defined('ABSPATH')) exit;
?>
<div class="wfk-payment-instructions">
    <p><?php esc_html_e('You will be redirected to complete your payment securely via Kang Open Banking.', 'woo-for-kang'); ?></p>
    <div class="wfk-payment-methods">
        <p><strong><?php esc_html_e('Available payment methods:', 'woo-for-kang'); ?></strong></p>
        <ul>
            <li>📱 <?php esc_html_e('Mobile Money (MTN, Orange)', 'woo-for-kang'); ?></li>
            <li>💳 <?php esc_html_e('Credit/Debit Card (Visa, Mastercard)', 'woo-for-kang'); ?></li>
            <li>🏦 <?php esc_html_e('Bank Transfer', 'woo-for-kang'); ?></li>
        </ul>
    </div>
    <p class="wfk-security-note">
        🔒 <?php esc_html_e('Your payment is secured with bank-grade encryption.', 'woo-for-kang'); ?>
    </p>
</div>
`;

const licenseFile = `                    GNU GENERAL PUBLIC LICENSE
                       Version 2, June 1991

 Copyright (C) 1989, 1991 Free Software Foundation, Inc.,
 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
`;

// ─── ZIP Generation Utilities ────────────────────────────────────────

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createZip(files: { name: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(contentBytes);

    // Local file header (30 + name + content)
    const localHeader = new Uint8Array(30 + nameBytes.length + contentBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression: stored
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, contentBytes.length, true); // compressed size
    lv.setUint32(22, contentBytes.length, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra field length
    localHeader.set(nameBytes, 30);
    localHeader.set(contentBytes, 30 + nameBytes.length);
    localHeaders.push(localHeader);

    // Central directory header (46 + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, contentBytes.length, true);
    cv.setUint32(24, contentBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0x20, true); // external attr (archive)
    cv.setUint32(42, offset, true); // local header offset
    centralHeader.set(nameBytes, 46);
    centralHeaders.push(centralHeader);

    offset += localHeader.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) centralDirSize += ch.length;

  // End of central directory (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirOffset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + centralDirSize + 22;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const lh of localHeaders) { result.set(lh, pos); pos += lh.length; }
  for (const ch of centralHeaders) { result.set(ch, pos); pos += ch.length; }
  result.set(eocd, pos);

  return result;
}

// ─── Edge Function Handler ───────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log the download
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    let userId: string | undefined;
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await supabase.from('audit_logs').insert({
      action_type: 'plugin_download',
      entity_type: 'woocommerce_plugin',
      entity_id: PLUGIN_VERSION,
      performed_by: userId,
      details: {
        version: PLUGIN_VERSION,
        ip_address: clientIp,
        user_agent: userAgent,
        timestamp: new Date().toISOString(),
      },
      ip_address: clientIp,
    });

    // Build the ZIP
    const pluginFiles = [
      { name: 'woo-for-kang/woo-for-kang.php', content: mainPluginFile },
      { name: 'woo-for-kang/includes/class-wfk-payment-gateway.php', content: paymentGatewayFile },
      { name: 'woo-for-kang/includes/class-wfk-api-client.php', content: apiClientFile },
      { name: 'woo-for-kang/includes/class-wfk-webhook-handler.php', content: webhookHandlerFile },
      { name: 'woo-for-kang/includes/class-wfk-logger.php', content: loggerFile },
      { name: 'woo-for-kang/templates/payment-instructions.php', content: paymentInstructionsTemplate },
      { name: 'woo-for-kang/readme.txt', content: readmeFile },
      { name: 'woo-for-kang/uninstall.php', content: uninstallFile },
      { name: 'woo-for-kang/LICENSE', content: licenseFile },
    ];

    const zipData = createZip(pluginFiles);

    return new Response(zipData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="woo-for-kang-v${PLUGIN_VERSION}.zip"`,
        'Content-Length': zipData.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Error in woocommerce-download-plugin:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate plugin download', message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
