<?php

declare(strict_types=1);

namespace KangOpenBanking\Resources;

use KangOpenBanking\KangOpenBanking;

class PayByBankResource
{
    private KangOpenBanking $client;

    public function __construct(KangOpenBanking $client)
    {
        $this->client = $client;
    }

    /**
     * Create a Pay by Bank intent.
     *
     * @param array{
     *   merchant_id: string,
     *   amount: float,
     *   currency?: string,
     *   redirect_uri: string,
     *   state: string,
     *   description?: string,
     *   creditor_account?: string,
     *   creditor_name?: string,
     *   customer_email?: string
     * } $params
     * @return array{intent_id: string, consent_id: string, authorization_url: string, expires_at: string, status: string}
     */
    public function createIntent(array $params): array
    {
        return $this->client->request('POST', 'pay-by-bank', array_merge($params, ['action' => 'create_intent']));
    }

    /**
     * Get a Pay by Bank intent by ID.
     *
     * @param string $intentId
     * @return array
     */
    public function getIntent(string $intentId): array
    {
        return $this->client->request('POST', 'pay-by-bank', [
            'action' => 'get_intent',
            'intent_id' => $intentId,
        ]);
    }

    /**
     * List payment intents for the authenticated merchant.
     *
     * @param array{status?: string, limit?: int, offset?: int} $params
     * @return array
     */
    public function listIntents(array $params = []): array
    {
        return $this->client->request('POST', 'pay-by-bank', array_merge($params, ['action' => 'list_intents']));
    }

    /**
     * Authorize a Pay by Bank intent (user approval).
     *
     * @param string $intentId
     * @param string $userId
     * @param string|null $debtorAccount
     * @return array
     */
    public function authorize(string $intentId, string $userId, ?string $debtorAccount = null): array
    {
        $body = [
            'action' => 'authorize',
            'intent_id' => $intentId,
            'user_id' => $userId,
        ];
        if ($debtorAccount !== null) {
            $body['debtor_account'] = $debtorAccount;
        }
        return $this->client->request('POST', 'pay-by-bank', $body);
    }

    /**
     * Reject a Pay by Bank intent.
     *
     * @param string $intentId
     * @param string $userId
     * @return array
     */
    public function reject(string $intentId, string $userId): array
    {
        return $this->client->request('POST', 'pay-by-bank', [
            'action' => 'reject',
            'intent_id' => $intentId,
            'user_id' => $userId,
        ]);
    }
}
