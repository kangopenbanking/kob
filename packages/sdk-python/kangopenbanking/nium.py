"""Nium extended resources — Beneficiaries, Payouts, Conversions, RFI.

Aligned with OpenAPI v4.52.0 — /v1/gateway/nium/*.
Additive only (Standing Orders 1, 2, 4).
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

NiumCurrency = Literal[
    "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "JPY",
    "INR", "ZAR", "HKD", "CHF", "NZD", "SEK", "NOK", "DKK", "CNY",
]
NiumAccountKind = Literal["virtual", "global"]


class BeneficiariesResource:
    def __init__(self, client):
        self._c = client

    def list(self) -> Dict[str, Any]:
        return self._c._request("GET", "nium-beneficiaries")

    def create(
        self,
        *,
        beneficiary_name: str,
        account_number: str,
        currency: str,
        bic: Optional[str] = None,
        iban: Optional[str] = None,
        bank_name: Optional[str] = None,
        country: Optional[str] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "beneficiary_name": beneficiary_name,
            "account_number": account_number,
            "currency": currency,
        }
        for k, v in (("bic", bic), ("iban", iban), ("bank_name", bank_name), ("country", country)):
            if v is not None:
                body[k] = v
        return self._c._request("POST", "nium-beneficiaries", json=body)


class PayoutsResource:
    def __init__(self, client):
        self._c = client

    def list(self) -> Dict[str, Any]:
        return self._c._request("GET", "nium-payouts")

    def create(
        self,
        *,
        beneficiary_id: str,
        source_currency: str,
        destination_currency: str,
        source_amount: float,
        purpose_code: str,
        idempotency_key: str,
    ) -> Dict[str, Any]:
        body = {
            "beneficiary_id": beneficiary_id,
            "source_currency": source_currency,
            "destination_currency": destination_currency,
            "source_amount": source_amount,
            "purpose_code": purpose_code,
            "idempotency_key": idempotency_key,
        }
        return self._c._request(
            "POST", "nium-payouts", json=body,
            headers={"Idempotency-Key": idempotency_key},
        )


class ConversionsResource:
    def __init__(self, client):
        self._c = client

    def list(self) -> Dict[str, Any]:
        return self._c._request("GET", "nium-conversions")

    def create(
        self,
        *,
        from_currency: str,
        to_currency: str,
        from_amount: float,
        idempotency_key: str,
    ) -> Dict[str, Any]:
        if from_currency == to_currency:
            raise ValueError("from_currency must differ from to_currency")
        body = {
            "from_currency": from_currency,
            "to_currency": to_currency,
            "from_amount": from_amount,
            "idempotency_key": idempotency_key,
        }
        return self._c._request(
            "POST", "nium-conversions", json=body,
            headers={"Idempotency-Key": idempotency_key},
        )


class RfiResource:
    def __init__(self, client):
        self._c = client

    def list(self, status: Optional[str] = None) -> Dict[str, Any]:
        params = {"status": status} if status else None
        return self._c._request("GET", "nium-rfi", params=params)

    def respond(
        self, *, rfi_id: str, response: str, document_urls: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {"rfi_id": rfi_id, "response": response}
        if document_urls:
            body["document_urls"] = document_urls
        return self._c._request("POST", "nium-rfi", json=body)
