"""GlobalAccountsResource — Nium-powered global virtual accounts.

Aligned with OpenAPI v4.50.0 — /v1/gateway/global-accounts*.
"""

from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Union


PayoutPreference = Literal["KANG_WALLET", "MOBILE_MONEY"]
GlobalAccountCurrency = Literal["USD", "EUR", "GBP"]


@dataclass
class NiumGlobalAccount:
    id: str
    currency: str
    bank_name: str
    beneficiary_name: str
    status: str
    mode: str
    iban: Optional[str] = None
    account_number: Optional[str] = None
    routing_code: Optional[str] = None
    bic: Optional[str] = None
    bank_address: Optional[str] = None
    payout_preference_override: Optional[str] = None
    payout_channel_override: Optional[str] = None


@dataclass
class NiumIncomingPayment:
    id: str
    source_amount: float
    source_currency: str
    fx_rate_nium: float
    fx_spread_bps: int
    xaf_gross: float
    xaf_spread_revenue: float
    xaf_withdrawal_fee: float
    xaf_net_credited: float
    routing: str
    status: str
    created_at: str


class GlobalAccountsResource:
    """Issue and manage Nium-powered USD / EUR / GBP receiving accounts."""

    def __init__(self, client):  # type: ignore[no-untyped-def]
        self._c = client

    def create(
        self,
        currency: GlobalAccountCurrency,
        beneficiary_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """POST /v1/gateway/global-accounts — idempotent per (user, currency)."""
        body: Dict[str, Any] = {"currency": currency}
        if beneficiary_name:
            body["beneficiary_name"] = beneficiary_name
        return self._c._request("POST", "nium-create-global-account", json=body)

    def list(self) -> Dict[str, Any]:
        """GET /v1/gateway/global-accounts — accounts, incoming payments, user defaults."""
        return self._c._request("GET", "nium-list-global-accounts")

    def update_payout_preference(
        self,
        scope: Literal["user", "account"],
        *,
        payout_preference: Optional[PayoutPreference] = None,
        payout_channel: Optional[str] = None,
        account_id: Optional[str] = None,
        payout_preference_override: Optional[PayoutPreference] = None,
        payout_channel_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """PATCH /v1/gateway/global-accounts/payout-preference."""
        body: Dict[str, Any] = {"scope": scope}
        if scope == "user":
            if payout_preference is None:
                raise ValueError("payout_preference is required when scope='user'")
            body["payout_preference"] = payout_preference
            if payout_channel is not None:
                body["payout_channel"] = payout_channel
        else:
            if not account_id:
                raise ValueError("account_id is required when scope='account'")
            body["account_id"] = account_id
            body["payout_preference_override"] = payout_preference_override
            body["payout_channel_override"] = payout_channel_override
        return self._c._request("PATCH", "nium-update-payout-preference", json=body)

    @staticmethod
    def verify_webhook_signature(payload: str, signature: str, secret: str) -> bool:
        """Verify the `x-nium-signature` header (HMAC-SHA256 of the raw body)."""
        computed = hmac.new(
            secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(computed, signature)
