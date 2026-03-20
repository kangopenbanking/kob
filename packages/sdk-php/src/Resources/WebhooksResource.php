<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

class WebhooksResource
{
    public function __construct(private KangOpenBanking $client) {}

    /** @return array<string, mixed> */
    public function register(string $url, array $events): array
    {
        return $this->client->request('POST', 'sandbox-register-webhook', [
            'url' => $url,
            'events' => $events,
        ]);
    }
}
