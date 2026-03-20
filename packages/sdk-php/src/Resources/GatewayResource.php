<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

class GatewayResource
{
    public function __construct(private KangOpenBanking $client) {}

    /** @return array<string, mixed> */
    public function estimateFee(float $amount, string $channel, string $currency = 'XAF'): array
    {
        return $this->client->request('POST', 'gateway-charges', [
            'action' => 'fee_estimate',
            'amount' => $amount,
            'channel' => $channel,
            'currency' => $currency,
        ]);
    }
}
