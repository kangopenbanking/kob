<?php

namespace KangOpenBanking\Resources;

/**
 * KOB QR Merchant Directory (v4.31.x).
 *
 * Public, unauthenticated. Cursor-paginated auto-fetch with a 5-minute
 * in-process cache so a partner virtual-card app can call
 * QRDirectoryResource::list() on every scan without thrash.
 */
class QRDirectoryResource
{
    private const FN_BASE = 'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1';
    private const TTL = 300;

    private static ?array $cache = null;

    /** @return array<int, array<string, mixed>> */
    public function list(?string $country = null, ?string $category = null, int $hardCap = 1000): array
    {
        $key = sprintf('%s|%s|%d', $country ?? '', $category ?? '', $hardCap);
        if (self::$cache !== null && self::$cache['key'] === $key && (time() - self::$cache['ts']) < self::TTL) {
            return self::$cache['data'];
        }
        $data = $this->fetchAll($country, $category, $hardCap);
        self::$cache = ['key' => $key, 'ts' => time(), 'data' => $data];
        return $data;
    }

    /** Force-refresh ignoring the cache. */
    public function sync(?string $country = null, ?string $category = null, int $hardCap = 1000): array
    {
        self::$cache = null;
        return $this->list($country, $category, $hardCap);
    }

    /** Build merchant_id => merchant map. */
    public function byId(?string $country = null, ?string $category = null): array
    {
        $out = [];
        foreach ($this->list($country, $category) as $m) {
            $out[$m['merchant_id']] = $m;
        }
        return $out;
    }

    /** Generate a static or dynamic EMVCo QR for a single merchant. */
    public function getMerchantQr(string $merchantId, ?string $amount = null, ?string $ref = null): array
    {
        $params = ['id' => $merchantId];
        if ($amount !== null) $params['amount'] = $amount;
        if ($ref !== null)    $params['ref'] = $ref;
        $url = self::FN_BASE . '/merchants-qr-get?' . http_build_query($params);
        return $this->getJson($url);
    }

    private function fetchAll(?string $country, ?string $category, int $hardCap): array
    {
        $out = [];
        $cursor = null;
        while (count($out) < $hardCap) {
            $params = ['limit' => '100'];
            if ($country)  $params['country'] = $country;
            if ($category) $params['category'] = $category;
            if ($cursor)   $params['cursor'] = $cursor;
            $url = self::FN_BASE . '/merchants-qr-directory?' . http_build_query($params);
            $page = $this->getJson($url);
            foreach (($page['data'] ?? []) as $row) $out[] = $row;
            if (empty($page['has_more']) || empty($page['next_cursor'])) break;
            $cursor = $page['next_cursor'];
        }
        return $out;
    }

    private function getJson(string $url): array
    {
        $ctx = stream_context_create([
            'http' => ['header' => "Accept: application/json\r\n", 'timeout' => 15],
        ]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body === false) {
            throw new \RuntimeException("KOB QR directory request failed: $url");
        }
        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('KOB QR directory: invalid JSON response');
        }
        return $decoded;
    }
}
