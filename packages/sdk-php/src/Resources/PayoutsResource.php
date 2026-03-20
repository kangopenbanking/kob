<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

class PayoutsResource
{
    public function __construct(private KangOpenBanking $client) {}

    /** @return array<string, mixed> */
    public function create(array $params): array
    {
        return $this->client->request('POST', 'gateway-payouts', array_merge(['action' => 'create'], $params));
    }

    /** @return array<string, mixed> */
    public function get(string $payoutId): array
    {
        return $this->client->request('POST', 'gateway-payouts', [
            'action' => 'get',
            'payout_id' => $payoutId,
        ]);
    }
}
