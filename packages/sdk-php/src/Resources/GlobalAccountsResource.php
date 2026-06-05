<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

/**
 * Nium-powered global virtual accounts (USD / EUR / GBP).
 *
 * Mirrors OpenAPI v4.50.0 — /v1/gateway/global-accounts*.
 */
class GlobalAccountsResource
{
    public function __construct(private KangOpenBanking $client) {}

    /**
     * Create (or re-fetch) a global account. Idempotent per (user, currency).
     *
     * @param array{currency: 'USD'|'EUR'|'GBP', beneficiary_name?: string} $params
     * @return array<string, mixed>  { account: NiumGlobalAccount, reused: bool }
     */
    public function create(array $params): array
    {
        return $this->client->request('POST', 'nium-create-global-account', $params);
    }

    /**
     * List the caller's global accounts, recent incoming payments and user defaults.
     *
     * @return array<string, mixed>
     */
    public function list(): array
    {
        return $this->client->request('GET', 'nium-list-global-accounts');
    }

    /**
     * Update the user-level default OR a per-account override.
     *
     * User scope:
     *   ['scope' => 'user', 'payout_preference' => 'MOBILE_MONEY', 'payout_channel' => '237677123456']
     *
     * Account scope:
     *   ['scope' => 'account', 'account_id' => 'uuid',
     *    'payout_preference_override' => 'KANG_WALLET' | 'MOBILE_MONEY' | null,
     *    'payout_channel_override'    => string | null]
     *
     * @param array<string, mixed> $params
     * @return array<string, mixed>
     */
    public function updatePayoutPreference(array $params): array
    {
        return $this->client->request('PATCH', 'nium-update-payout-preference', $params);
    }

    /**
     * Verify the `x-nium-signature` header (HMAC-SHA256 over the raw request body).
     */
    public static function verifyWebhookSignature(string $payload, string $signature, string $secret): bool
    {
        $computed = hash_hmac('sha256', $payload, $secret);
        return hash_equals($computed, $signature);
    }
}
