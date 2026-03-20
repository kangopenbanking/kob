<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

class AccountsResource
{
    public function __construct(private KangOpenBanking $client) {}

    /** @return array<int, array<string, mixed>> */
    public function list(): array
    {
        $data = $this->client->request('GET', 'aisp-accounts');
        return is_array($data) && isset($data[0]) ? $data : ($data['accounts'] ?? $data['data'] ?? []);
    }

    /** @return array<string, mixed> */
    public function get(string $accountId): array
    {
        return $this->client->request('GET', 'aisp-accounts', null, ['account_id' => $accountId]);
    }
}
