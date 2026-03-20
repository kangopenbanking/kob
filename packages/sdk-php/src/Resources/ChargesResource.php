<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

class ChargesResource
{
    public function __construct(private KangOpenBanking $client) {}

    /** @return array<string, mixed> */
    public function create(array $params): array
    {
        return $this->client->request('POST', 'gateway-charges', array_merge(['action' => 'create_charge'], $params));
    }

    /** @return array<string, mixed> */
    public function get(string $chargeId): array
    {
        return $this->client->request('POST', 'gateway-charges', [
            'action' => 'get_charge',
            'charge_id' => $chargeId,
        ]);
    }

    /** @return array<string, mixed> */
    public function verify(string $chargeId): array
    {
        return $this->client->request('POST', 'gateway-charges', [
            'action' => 'verify_charge',
            'charge_id' => $chargeId,
        ]);
    }

    /** @return array<string, mixed> */
    public function listCharges(array $params = []): array
    {
        return $this->client->request('POST', 'gateway-charges', array_merge(['action' => 'list_charges'], $params));
    }
}
