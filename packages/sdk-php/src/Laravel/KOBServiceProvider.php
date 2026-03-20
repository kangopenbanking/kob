<?php

declare(strict_types=1);

namespace KangOpenBanking\Laravel;

use Illuminate\Support\ServiceProvider;
use KangOpenBanking\KangOpenBanking;

class KOBServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../../config/kob.php', 'kob');

        $this->app->singleton(KangOpenBanking::class, function ($app) {
            return new KangOpenBanking([
                'client_id' => config('kob.client_id'),
                'client_secret' => config('kob.client_secret'),
                'api_key' => config('kob.api_key'),
                'base_url' => config('kob.base_url', 'https://api.kangopenbanking.com/functions/v1'),
                'environment' => config('kob.environment', 'sandbox'),
                'timeout' => config('kob.timeout', 30),
            ]);
        });

        $this->app->alias(KangOpenBanking::class, 'kob');
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__ . '/../../config/kob.php' => config_path('kob.php'),
        ], 'kob-config');
    }
}
