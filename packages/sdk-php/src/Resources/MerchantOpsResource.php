<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

/**
 * Phase 3 helpers — additive merchant operations resource.
 *
 * Introduced in kangopenbanking/php-sdk 1.4.0. Does NOT modify
 * any existing resource. Wire it onto an existing client:
 *
 *   $kob = new KangOpenBanking([...]);
 *   $ops = new MerchantOpsResource($kob);
 *   $job = $ops->exportTransactions(['merchant_id' => 'mch_...', 'from' => '2026-04-01']);
 *
 * Standards cited: PSD2 RTS Art. 36, Stripe API Reference (Reports & Webhooks).
 */
class MerchantOpsResource
{
    public function __construct(private KangOpenBanking $client) {}

    // ─── Exports ─────────────────────────────────────────────────
    /** @param array<string, mixed> $filters */
    private function export(string $resource, array $filters): array
    {
        return $this->client->request('POST', 'merchant-exports',
            array_merge(['resource' => $resource], array_filter($filters, fn($v) => $v !== null))
        );
    }

    /** @param array{merchant_id:string, from?:string, to?:string, environment?:string, currency?:string, format?:string} $f */
    public function exportTransactions(array $f): array { return $this->export('transactions', $f); }
    public function exportSettlements(array $f): array  { return $this->export('settlements', $f); }
    public function exportFees(array $f): array         { return $this->export('fees', $f); }

    public function exportGet(string $exportId): array
    {
        return $this->client->request('GET', 'merchant-exports', null, ['export_id' => $exportId]);
    }

    // ─── Statements ──────────────────────────────────────────────
    public function statementDownload(string $merchantId, string $month, string $format = 'pdf'): array
    {
        return $this->client->request('GET', 'gateway-merchant-statement', null, [
            'merchant_id' => $merchantId, 'month' => $month, 'format' => $format,
        ]);
    }

    // ─── Reconciliation ──────────────────────────────────────────
    public function reconciliationRun(string $merchantId, string $from, string $to): array
    {
        return $this->client->request('POST', 'gateway-reconciliation-run', [
            'merchant_id' => $merchantId, 'from' => $from, 'to' => $to,
        ]);
    }

    public function reconciliationGet(string $runId): array
    {
        return $this->client->request('GET', 'gateway-reconciliation-run', null, ['run_id' => $runId]);
    }

    // ─── Merchant API Keys ───────────────────────────────────────
    public function apiKeysList(string $merchantId): array
    {
        return $this->client->request('GET', 'gateway-merchant-api-keys', null, ['merchant_id' => $merchantId]);
    }

    /** @param string[] $scopes */
    public function apiKeyCreate(string $merchantId, string $label, array $scopes, string $environment): array
    {
        return $this->client->request('POST', 'gateway-merchant-api-keys', [
            'action' => 'create', 'merchant_id' => $merchantId,
            'label' => $label, 'scopes' => $scopes, 'environment' => $environment,
        ]);
    }

    public function apiKeyRevoke(string $keyId): array
    {
        return $this->client->request('POST', 'gateway-merchant-api-keys',
            ['action' => 'revoke', 'key_id' => $keyId]);
    }

    public function apiKeyRotate(string $keyId): array
    {
        return $this->client->request('POST', 'gateway-merchant-api-keys',
            ['action' => 'rotate', 'key_id' => $keyId]);
    }

    // ─── Merchant Webhooks ───────────────────────────────────────
    public function webhookEndpoints(string $merchantId): array
    {
        return $this->client->request('GET', 'gateway-webhook-endpoints', null, ['merchant_id' => $merchantId]);
    }

    public function webhookDeliveries(string $endpointId, int $limit = 50, ?string $status = null): array
    {
        $q = ['endpoint_id' => $endpointId, 'limit' => (string) $limit];
        if ($status !== null) $q['status'] = $status;
        return $this->client->request('GET', 'gateway-webhook-deliveries', null, $q);
    }

    public function webhookReplay(string $endpointId, string $deliveryId): array
    {
        return $this->client->request('POST', 'gateway-webhook-replay-delivery', [
            'endpoint_id' => $endpointId, 'delivery_id' => $deliveryId,
        ]);
    }

    public function webhookRotateSecret(string $endpointId): array
    {
        return $this->client->request('POST', 'gateway-webhook-endpoints', [
            'action' => 'rotate_secret', 'endpoint_id' => $endpointId,
        ]);
    }
}
