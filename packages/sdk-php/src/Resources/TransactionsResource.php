<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

class TransactionsResource
{
    public function __construct(private KangOpenBanking $client) {}

    /**
     * @param array{from?: string, to?: string, page?: int, per_page?: int} $params
     * @return array<string, mixed>
     */
    public function list(string $accountId, array $params = []): array
    {
        $query = array_filter([
            'account_id' => $accountId,
            'from' => $params['from'] ?? null,
            'to' => $params['to'] ?? null,
            'page' => isset($params['page']) ? (string) $params['page'] : null,
            'per_page' => isset($params['per_page']) ? (string) $params['per_page'] : null,
        ]);

        return $this->client->request('GET', 'aisp-transactions', null, $query);
    }
}
