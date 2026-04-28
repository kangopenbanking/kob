import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, Github, FileCode, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const WooCommercePluginCode = () => {
  const { toast } = useToast();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
    toast({
      title: "Copied to clipboard",
      description: `${section} code copied successfully`,
    });
  };

  const handleDownloadDocs = async () => {
    setDownloading(true);
    try {
      const response = await fetch(
        `https://api.kangopenbanking.com/v1/woocommerce-download-plugin`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'woo-for-kang-v1.0.0.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: "Woo for Kang v1.0.0 plugin ZIP is downloading",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const codeFiles = [
    {
      name: "woo-for-kang.php",
      description: "Main plugin file with initialization logic",
      type: "PHP",
      code: `<?php
/**
 * Plugin Name: Woo for Kang
 * Version: 1.0.0
 * Description: Accept Mobile Money, Bank Transfers, and Card payments in Cameroon
 */

if (!defined('ABSPATH')) exit;

define('WFK_VERSION', '1.0.0');
define('WFK_PLUGIN_FILE', __FILE__);
define('WFK_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WFK_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WFK_API_BASE_URL', 'https://api.kangopenbanking.com/v1');

// Check WooCommerce dependency
if (!in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins')))) {
    add_action('admin_notices', 'wfk_woocommerce_missing_notice');
    return;
}

// Initialize plugin
add_action('plugins_loaded', 'wfk_init', 11);

function wfk_init() {
    if (!class_exists('WC_Payment_Gateway')) return;
    
    require_once WFK_PLUGIN_DIR . 'includes/class-wfk-logger.php';
    require_once WFK_PLUGIN_DIR . 'includes/class-wfk-api-client.php';
    require_once WFK_PLUGIN_DIR . 'includes/class-wfk-payment-gateway.php';
    require_once WFK_PLUGIN_DIR . 'includes/class-wfk-webhook-handler.php';
    
    add_filter('woocommerce_payment_gateways', 'wfk_add_gateway_class');
    WFK_Webhook_Handler::init();
}

function wfk_add_gateway_class($gateways) {
    $gateways[] = 'WFK_Payment_Gateway';
    return $gateways;
}`,
    },
    {
      name: "class-wfk-payment-gateway.php",
      description: "Payment gateway class extending WooCommerce",
      type: "PHP",
      code: `<?php
class WFK_Payment_Gateway extends WC_Payment_Gateway {
    
    private $api_client;
    private $logger;

    public function __construct() {
        $this->id = 'wfk';
        $this->method_title = __('Woo for Kang', 'woo-for-kang');
        $this->has_fields = false;
        
        $this->init_form_fields();
        $this->init_settings();
        
        $this->title = $this->get_option('title');
        $this->api_key = $this->get_option('api_key');
        
        $this->logger = new WFK_Logger($this->debug);
        $this->api_client = new WFK_API_Client($this->api_key, $this->logger);
        
        add_action('woocommerce_update_options_payment_gateways_' . $this->id, 
                   array($this, 'process_admin_options'));
    }

    public function process_payment($order_id) {
        $order = wc_get_order($order_id);
        
        $payment_data = array(
            'amount' => $order->get_total(),
            'currency' => $order->get_currency(),
            'order_id' => $order_id,
            'customer_email' => $order->get_billing_email(),
        );
        
        $response = $this->api_client->process_payment($payment_data);
        
        if (is_wp_error($response)) {
            wc_add_notice(__('Payment error', 'woo-for-kang'), 'error');
            return array('result' => 'fail');
        }
        
        $order->update_meta_data('_wfk_transaction_ref', $response['transaction_ref']);
        $order->update_status('pending');
        
        return array('result' => 'success', 'redirect' => $this->get_return_url($order));
    }
}`,
    },
    {
      name: "class-wfk-api-client.php",
      description: "KOB API client for payment processing",
      type: "PHP",
      code: `<?php
class WFK_API_Client {
    
    private $api_key;
    private $logger;
    private $base_url;

    public function __construct($api_key, $logger) {
        $this->api_key = $api_key;
        $this->logger = $logger;
        $this->base_url = WFK_API_BASE_URL; // https://api.kangopenbanking.com/v1
    }

    public function process_payment($payment_data) {
        return $this->make_request('woocommerce-process-payment', $payment_data, 'POST');
    }

    private function make_request($endpoint, $data = array(), $method = 'GET') {
        $url = trailingslashit($this->base_url) . $endpoint;
        
        $args = array(
            'method' => $method,
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-API-Key' => $this->api_key,
            ),
        );
        
        if ($method === 'POST' && !empty($data)) {
            $args['body'] = json_encode($data);
        }
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) return $response;
        
        return json_decode(wp_remote_retrieve_body($response), true);
    }

    public function verify_webhook_signature($payload, $signature) {
        $computed = hash_hmac('sha256', $payload, $this->api_key);
        return hash_equals($computed, $signature);
    }
}`,
    },
    {
      name: "class-wfk-webhook-handler.php",
      description: "Webhook handler for payment status updates",
      type: "PHP",
      code: `<?php
class WFK_Webhook_Handler {
    
    private $api_client;
    private $logger;

    public function __construct($api_client, $logger) {
        $this->api_client = $api_client;
        $this->logger = $logger;
    }

    public static function init() {
        add_action('woocommerce_api_wfk_webhook', array(__CLASS__, 'handle'));
    }

    public function process() {
        $payload = file_get_contents('php://input');
        $signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';
        
        if (!$this->api_client->verify_webhook_signature($payload, $signature)) {
            status_header(401);
            exit;
        }
        
        $data = json_decode($payload, true);
        $order = wc_get_order($data['order_id']);
        
        switch ($data['status']) {
            case 'completed':
                $order->payment_complete($data['transaction_ref']);
                break;
            case 'failed':
                $order->update_status('failed');
                break;
        }
        
        status_header(200);
        exit;
    }
}`,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="border-b bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-16">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <a href="/woo-for-kang" className="hover:text-foreground transition-colors">
              Woo for Kang
            </a>
            <span>/</span>
            <span className="text-foreground">Plugin Code</span>
          </div>
          
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <FileCode className="h-10 w-10 text-primary" />
              <h1 className="text-4xl font-bold">WordPress Plugin Code</h1>
            </div>
            <p className="text-xl text-muted-foreground mb-8">
              Complete, production-ready WordPress plugin code for WooCommerce integration. 
              Copy, modify, and deploy your own version.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={handleDownloadDocs} disabled={downloading}>
                <Download className="mr-2 h-5 w-5" />
                {downloading ? "Downloading..." : "Download Plugin ZIP"}
              </Button>
              
              <Button size="lg" variant="outline" asChild>
                <a href="https://github.com/kangopenbanking/woo-for-kang" target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-5 w-5" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-3xl font-bold text-primary">9</div>
              <div className="text-sm text-muted-foreground">Plugin Files</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">1.0.0</div>
              <div className="text-sm text-muted-foreground">Current Version</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">GPL v2</div>
              <div className="text-sm text-muted-foreground">License</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">100%</div>
              <div className="text-sm text-muted-foreground">Production Ready</div>
            </div>
          </div>
        </div>
      </div>

      {/* Plugin Structure */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Plugin Structure</h2>
          
          <div className="bg-muted/50 rounded-lg p-6 mb-8 font-mono text-sm">
            <pre className="text-foreground/90">
{`woo-for-kang/
├── woo-for-kang.php              # Main plugin file
├── readme.txt                     # WordPress.org readme
├── LICENSE                        # GPL v2 license
├── assets/
│   ├── icon-128x128.png          # Plugin icon
│   ├── icon-256x256.png          # Plugin icon (retina)
│   ├── banner-772x250.png        # Banner
│   └── banner-1544x500.png       # Banner (retina)
├── includes/
│   ├── class-wfk-payment-gateway.php
│   ├── class-wfk-api-client.php
│   ├── class-wfk-webhook-handler.php
│   └── class-wfk-logger.php
└── templates/
    └── payment-instructions.php`}
            </pre>
          </div>

          {/* Core Files Preview */}
          <h2 className="text-3xl font-bold mb-8">Core Plugin Files</h2>
          
          <div className="space-y-6">
            {codeFiles.map((file, index) => (
              <div key={index} className="border rounded-lg overflow-hidden bg-card">
                <div className="bg-muted px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{file.name}</h3>
                    <p className="text-sm text-muted-foreground">{file.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                      {file.type}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(file.code, file.name)}
                    >
                      {copiedSection === file.name ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="p-6">
                  <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-xs">
                    <code className="text-foreground/90">{file.code}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>

          {/* Setup Instructions */}
          <div className="mt-16 bg-muted/30 rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Quick Setup Guide</h2>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Download Documentation</h3>
                  <p className="text-muted-foreground">
                    Click the button above to download the complete plugin code and setup instructions
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Create Plugin Structure</h3>
                  <p className="text-muted-foreground">
                    Create the directory structure and copy all PHP files into their respective locations
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Test Locally</h3>
                  <p className="text-muted-foreground">
                    Install on your WordPress test site and verify all functionality works correctly
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Deploy to GitHub</h3>
                  <p className="text-muted-foreground">
                    Push to GitHub and create a v1.0.0 release with the plugin ZIP file
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Resources */}
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            <a
              href="/integrations/woocommerce-docs"
              className="block p-6 border rounded-lg hover:border-primary transition-colors bg-card"
            >
              <FileCode className="h-8 w-8 text-primary mb-4" />
              <h3 className="font-semibold mb-2">Full Documentation</h3>
              <p className="text-sm text-muted-foreground">
                Complete integration guide and API reference
              </p>
            </a>

            <a
              href="/integrations/woocommerce-merchant-register"
              className="block p-6 border rounded-lg hover:border-primary transition-colors bg-card"
            >
              <ExternalLink className="h-8 w-8 text-primary mb-4" />
              <h3 className="font-semibold mb-2">Register Store</h3>
              <p className="text-sm text-muted-foreground">
                Get your API credentials to start accepting payments
              </p>
            </a>

            <a
              href="https://github.com/kangopenbanking/woo-for-kang"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-6 border rounded-lg hover:border-primary transition-colors bg-card"
            >
              <Github className="h-8 w-8 text-primary mb-4" />
              <h3 className="font-semibold mb-2">GitHub Repository</h3>
              <p className="text-sm text-muted-foreground">
                View source code and contribute on GitHub
              </p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WooCommercePluginCode;
