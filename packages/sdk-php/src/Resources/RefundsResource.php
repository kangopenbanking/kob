<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

class RefundsResource
{
    public function __construct(private KangOpenBanking $client) {}

    /** @return array<string, mixed> */
    public function create(string $chargeId, ?float $amount = null, ?string $reason = null): array
    {
        $body = ['action' => 'create', 'charge_id' => $chargeId];
        if ($amount !== null) $body['amount'] = $amount;
        if ($reason !== null) $body['reason'] = $reason;

        return $this->client->request('POST', 'gateway-refunds', $body);
    }

    /** @return array<string, mixed> */
    public function get(string $refundId): array
    {
        return $this->client->request('POST', 'gateway-refunds', [
            'action' => 'get',
            'refund_id' => $refundId,
        ]);
    }
}
