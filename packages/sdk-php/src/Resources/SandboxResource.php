<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

class SandboxResource
{
    public function __construct(private KangOpenBanking $client) {}

    /** @return array<string, mixed> */
    public function createAccount(string $accountHolderName, string $currency = 'XAF'): array
    {
        return $this->client->request('POST', 'sandbox-create-account', [
            'account_holder_name' => $accountHolderName,
            'currency' => $currency,
        ]);
    }

    /** @return array<string, mixed> */
    public function generateData(string $type, int $count = 50): array
    {
        return $this->client->request('POST', 'sandbox-generate-data', [
            'type' => $type,
            'count' => $count,
        ]);
    }
}
