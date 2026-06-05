<?php

declare(strict_types=1);

namespace KangOpenBanking;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use KangOpenBanking\Resources\AccountsResource;
use KangOpenBanking\Resources\BalancesResource;
use KangOpenBanking\Resources\TransactionsResource;
use KangOpenBanking\Resources\BeneficiariesResource;
use KangOpenBanking\Resources\ChargesResource;
use KangOpenBanking\Resources\RefundsResource;
use KangOpenBanking\Resources\PayoutsResource;
use KangOpenBanking\Resources\GatewayResource;
use KangOpenBanking\Resources\SandboxResource;
use KangOpenBanking\Resources\WebhooksResource;
use KangOpenBanking\Resources\PayByBankResource;
use KangOpenBanking\Resources\GlobalAccountsResource;
use KangOpenBanking\Exceptions\KOBException;

class KangOpenBanking
{
    private const DEFAULT_BASE_URL = 'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1';
    private const DEFAULT_TIMEOUT = 30;

    private Client $http;
    private string $clientId;
    private ?string $clientSecret;
    private ?string $apiKey;
    private string $baseUrl;
    private string $environment;
    private ?string $accessToken = null;
    private float $tokenExpiresAt = 0;

    public readonly AccountsResource $accounts;
    public readonly BalancesResource $balances;
    public readonly TransactionsResource $transactions;
    public readonly BeneficiariesResource $beneficiaries;
    public readonly ChargesResource $charges;
    public readonly RefundsResource $refunds;
    public readonly PayoutsResource $payouts;
    public readonly GatewayResource $gateway;
    public readonly SandboxResource $sandbox;
    public readonly WebhooksResource $webhooks;
    public readonly PayByBankResource $payByBank;
    public readonly GlobalAccountsResource $globalAccounts;

    /**
     * @param array{
     *   client_id: string,
     *   client_secret?: string,
     *   api_key?: string,
     *   base_url?: string,
     *   environment?: 'sandbox'|'production',
     *   timeout?: int
     * } $config
     */
    public function __construct(array $config)
    {
        $this->clientId = $config['client_id'];
        $this->clientSecret = $config['client_secret'] ?? null;
        $this->apiKey = $config['api_key'] ?? null;
        $this->baseUrl = rtrim($config['base_url'] ?? self::DEFAULT_BASE_URL, '/');
        $this->environment = $config['environment'] ?? 'sandbox';

        $this->http = new Client([
            'timeout' => $config['timeout'] ?? self::DEFAULT_TIMEOUT,
            'http_errors' => false,
        ]);

        $this->accounts = new AccountsResource($this);
        $this->balances = new BalancesResource($this);
        $this->transactions = new TransactionsResource($this);
        $this->beneficiaries = new BeneficiariesResource($this);
        $this->charges = new ChargesResource($this);
        $this->refunds = new RefundsResource($this);
        $this->payouts = new PayoutsResource($this);
        $this->gateway = new GatewayResource($this);
        $this->sandbox = new SandboxResource($this);
        $this->webhooks = new WebhooksResource($this);
        $this->payByBank = new PayByBankResource($this);
        $this->globalAccounts = new GlobalAccountsResource($this);
    }

    /**
     * Set access token manually (e.g. from authorization_code flow).
     */
    public function setAccessToken(string $token, ?int $expiresIn = null): void
    {
        $this->accessToken = $token;
        $this->tokenExpiresAt = $expiresIn ? time() + $expiresIn : 0;
    }

    /**
     * Request an OAuth2 token.
     *
     * @param array<string, string> $params
     * @return array{access_token: string, token_type: string, expires_in: int, scope: string}
     */
    public function getToken(array $params = []): array
    {
        $defaults = [
            'grant_type' => 'client_credentials',
            'client_id' => $this->clientId,
            'scope' => 'accounts balances transactions payments gateway',
        ];

        if ($this->clientSecret && !isset($params['client_secret'])) {
            $defaults['client_secret'] = $this->clientSecret;
        }

        $body = array_merge($defaults, $params);

        $response = $this->http->post("{$this->baseUrl}/oauth-token", [
            'form_params' => $body,
            'headers' => ['Content-Type' => 'application/x-www-form-urlencoded'],
        ]);

        $data = json_decode((string) $response->getBody(), true);

        if ($response->getStatusCode() >= 400) {
            throw new KOBException($response->getStatusCode(), $data ?? []);
        }

        $this->accessToken = $data['access_token'];
        $this->tokenExpiresAt = time() + ($data['expires_in'] ?? 3600);

        return $data;
    }

    /**
     * Ensure a valid access token is available.
     */
    public function ensureToken(): string
    {
        if ($this->accessToken && ($this->tokenExpiresAt === 0.0 || time() < $this->tokenExpiresAt - 60)) {
            return $this->accessToken;
        }

        if ($this->clientSecret) {
            $this->getToken();
            return $this->accessToken;
        }

        throw new \RuntimeException(
            'No access token available. Call setAccessToken() or provide client_secret for auto-refresh.'
        );
    }

    /**
     * Make an authenticated API request.
     *
     * @param string $method HTTP method
     * @param string $path API path (appended to base URL)
     * @param array|null $json Request body (for POST/PUT)
     * @param array<string, string>|null $query Query parameters
     * @return array<string, mixed>
     */
    public function request(string $method, string $path, ?array $json = null, ?array $query = null): array
    {
        $url = "{$this->baseUrl}/{$path}";
        $headers = ['Accept' => 'application/json'];

        if ($this->apiKey && $this->environment === 'sandbox') {
            $headers['X-API-Key'] = $this->apiKey;
        } else {
            $token = $this->ensureToken();
            $headers['Authorization'] = "Bearer {$token}";
        }

        $options = ['headers' => $headers];

        if ($json !== null) {
            $options['json'] = $json;
        }

        if ($query !== null) {
            $options['query'] = array_filter($query, fn($v) => $v !== null);
        }

        $response = $this->http->request($method, $url, $options);
        $data = json_decode((string) $response->getBody(), true);

        if ($response->getStatusCode() >= 400) {
            throw new KOBException($response->getStatusCode(), $data ?? []);
        }

        return $data ?? [];
    }

    /**
     * Build an OAuth2 authorization URL (for PKCE flows).
     */
    public function buildAuthorizationUrl(array $params): string
    {
        $query = http_build_query(array_filter([
            'client_id' => $this->clientId,
            'redirect_uri' => $params['redirect_uri'],
            'response_type' => 'code',
            'scope' => $params['scope'] ?? 'openid accounts payments',
            'state' => $params['state'] ?? null,
            'code_challenge' => $params['code_challenge'] ?? null,
            'code_challenge_method' => $params['code_challenge_method'] ?? 'S256',
        ]));

        return "{$this->baseUrl}/oauth-authorize?{$query}";
    }

    /**
     * Verify a webhook HMAC-SHA256 signature.
     */
    public static function verifyWebhookSignature(string $payload, string $signature, string $secret): bool
    {
        $computed = hash_hmac('sha256', $payload, $secret);
        return hash_equals($computed, $signature);
    }
}
