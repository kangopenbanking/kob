<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

/**
 * Nium extended resources — Beneficiaries, Payouts, Conversions, RFI.
 * Aligned with OpenAPI v4.52.0. Additive only.
 */
class NiumResource
{
    public function __construct(private KangOpenBanking $client) {}

    /** @return array<string, mixed> */
    public function listBeneficiaries(): array
    {
        return $this->client->request('GET', 'nium-beneficiaries');
    }

    /**
     * @param array{beneficiary_name:string, account_number:string, currency:string,
     *   bic?:string, iban?:string, bank_name?:string, country?:string} $params
     */
    public function createBeneficiary(array $params): array
    {
        return $this->client->request('POST', 'nium-beneficiaries', $params);
    }

    public function listPayouts(): array
    {
        return $this->client->request('GET', 'nium-payouts');
    }

    /**
     * @param array{beneficiary_id:string, source_currency:string,
     *   destination_currency:string, source_amount:float, purpose_code:string,
     *   idempotency_key:string} $params
     */
    public function createPayout(array $params): array
    {
        return $this->client->request(
            'POST', 'nium-payouts', $params,
            ['Idempotency-Key' => $params['idempotency_key']],
        );
    }

    public function listConversions(): array
    {
        return $this->client->request('GET', 'nium-conversions');
    }

    /**
     * @param array{from_currency:string, to_currency:string,
     *   from_amount:float, idempotency_key:string} $params
     */
    public function createConversion(array $params): array
    {
        if ($params['from_currency'] === $params['to_currency']) {
            throw new \InvalidArgumentException('from_currency must differ from to_currency');
        }
        return $this->client->request(
            'POST', 'nium-conversions', $params,
            ['Idempotency-Key' => $params['idempotency_key']],
        );
    }

    public function listRfi(?string $status = null): array
    {
        $params = $status ? ['status' => $status] : [];
        return $this->client->request('GET', 'nium-rfi', $params);
    }

    /** @param array{rfi_id:string, response:string, document_urls?:array<int,string>} $params */
    public function respondRfi(array $params): array
    {
        return $this->client->request('POST', 'nium-rfi', $params);
    }
}
