<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

class BalancesResource
{
    public function __construct(private KangOpenBanking $client) {}

    /** @return array<int, array<string, mixed>> */
    public function get(string $accountId): array
    {
        $data = $this->client->request('GET', 'aisp-balances', null, ['account_id' => $accountId]);
        return is_array($data) && isset($data[0]) ? $data : ($data['balances'] ?? $data['data'] ?? []);
    }
}
