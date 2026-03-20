<?php

declare(strict_types=1);

namespace KangOpenBanking\Laravel\Facades;

use Illuminate\Support\Facades\Facade;
use KangOpenBanking\KangOpenBanking;

/**
 * @method static array getToken(array $params = [])
 * @method static void setAccessToken(string $token, ?int $expiresIn = null)
 * @method static array request(string $method, string $path, ?array $json = null, ?array $query = null)
 * @method static bool verifyWebhookSignature(string $payload, string $signature, string $secret)
 *
 * @see \KangOpenBanking\KangOpenBanking
 */
class KOB extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return KangOpenBanking::class;
    }
}
