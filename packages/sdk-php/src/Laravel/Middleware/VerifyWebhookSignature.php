<?php

declare(strict_types=1);

namespace KangOpenBanking\Laravel\Middleware;

use Closure;
use Illuminate\Http\Request;
use KangOpenBanking\KangOpenBanking;
use Symfony\Component\HttpFoundation\Response;

class VerifyWebhookSignature
{
    /**
     * Verify KOB webhook HMAC-SHA256 signature.
     *
     * Usage in routes:
     *   Route::post('/webhooks/kob', [WebhookController::class, 'handle'])
     *       ->middleware(VerifyWebhookSignature::class);
     */
    public function handle(Request $request, Closure $next): Response
    {
        $signature = $request->header('X-KOB-Signature');
        $secret = config('kob.webhook_secret');

        if (!$signature || !$secret) {
            abort(401, 'Missing webhook signature or secret');
        }

        $payload = $request->getContent();

        if (!KangOpenBanking::verifyWebhookSignature($payload, $signature, $secret)) {
            abort(403, 'Invalid webhook signature');
        }

        return $next($request);
    }
}
