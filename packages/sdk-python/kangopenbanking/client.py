"""KOB API Client — sync + async support via httpx."""

from __future__ import annotations
import hashlib
import hmac
import time
from typing import Any, Dict, List, Optional
from dataclasses import asdict

import httpx

from .types import (
    Account, Balance, Transaction, Beneficiary,
    Charge, Refund, Payout, FeeEstimate,
)
from .global_accounts import GlobalAccountsResource

DEFAULT_BASE_URL = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1"


class KOBError(Exception):
    """API error with structured error response."""

    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self.error_code = body.get("error_code", "UNKNOWN")
        self.error_id = body.get("error_id", "")
        self.error = body.get("error", "")
        super().__init__(f"[{self.error_code}] {body.get('message', self.error)}")


class KangOpenBanking:
    """
    Kang Open Banking API client.

    Usage (sandbox):
        kob = KangOpenBanking(
            client_id="your_id",
            api_key="sbx_your_key",
            environment="sandbox",
        )

    Usage (production):
        kob = KangOpenBanking(
            client_id="your_id",
            client_secret="your_secret",
            environment="production",
        )
    """

    def __init__(
        self,
        client_id: str,
        client_secret: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        environment: str = "sandbox",
        timeout: float = 30.0,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.environment = environment
        self.timeout = timeout
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0
        self._http = httpx.Client(timeout=timeout)

        # Resources
        self.accounts = _AccountsResource(self)
        self.balances = _BalancesResource(self)
        self.transactions = _TransactionsResource(self)
        self.beneficiaries = _BeneficiariesResource(self)
        self.charges = _ChargesResource(self)
        self.refunds = _RefundsResource(self)
        self.payouts = _PayoutsResource(self)
        self.gateway = _GatewayResource(self)
        self.sandbox_tools = _SandboxResource(self)
        self.global_accounts = GlobalAccountsResource(self)

    # --- Auth ---

    def set_access_token(self, token: str, expires_in: Optional[int] = None):
        self._access_token = token
        self._token_expires_at = time.time() + expires_in if expires_in else 0

    def get_token(
        self,
        grant_type: str = "client_credentials",
        scope: str = "accounts payments gateway",
        **kwargs,
    ) -> dict:
        data = {
            "grant_type": grant_type,
            "client_id": self.client_id,
            "scope": scope,
            **kwargs,
        }
        if self.client_secret and "client_secret" not in data:
            data["client_secret"] = self.client_secret

        res = self._http.post(
            f"{self.base_url}/oauth-token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        body = res.json()
        if res.status_code >= 400:
            raise KOBError(res.status_code, body)
        self._access_token = body["access_token"]
        self._token_expires_at = time.time() + body.get("expires_in", 3600)
        return body

    def _ensure_token(self) -> str:
        if self._access_token and (
            self._token_expires_at == 0 or time.time() < self._token_expires_at - 60
        ):
            return self._access_token
        if self.client_secret:
            self.get_token()
            return self._access_token  # type: ignore
        raise RuntimeError(
            "No access token. Call set_access_token() or provide client_secret."
        )

    # --- HTTP ---

    def _request(
        self,
        method: str,
        path: str,
        json: Optional[dict] = None,
        params: Optional[dict] = None,
    ) -> Any:
        url = f"{self.base_url}/{path}"
        headers: Dict[str, str] = {}

        if self.api_key and self.environment == "sandbox":
            headers["X-API-Key"] = self.api_key
        else:
            token = self._ensure_token()
            headers["Authorization"] = f"Bearer {token}"

        res = self._http.request(method, url, json=json, params=params, headers=headers)
        body = res.json()
        if res.status_code >= 400:
            raise KOBError(res.status_code, body)
        return body

    # --- Webhook Verification ---

    @staticmethod
    def verify_webhook_signature(
        payload: str, signature: str, secret: str
    ) -> bool:
        computed = hmac.new(
            secret.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(computed, signature)

    def close(self):
        self._http.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


# --- Resource Classes ---

class _AccountsResource:
    def __init__(self, client: KangOpenBanking):
        self._c = client

    def list(self) -> List[Account]:
        data = self._c._request("GET", "aisp-accounts")
        if isinstance(data, list):
            return [Account(**a) for a in data]
        return [Account(**a) for a in data.get("accounts", data.get("data", []))]

    def get(self, account_id: str) -> Account:
        data = self._c._request("GET", "aisp-accounts", params={"account_id": account_id})
        return Account(**data) if isinstance(data, dict) and "id" in data else Account(**data.get("account", data))


class _BalancesResource:
    def __init__(self, client: KangOpenBanking):
        self._c = client

    def get(self, account_id: str) -> List[Balance]:
        data = self._c._request("GET", "aisp-balances", params={"account_id": account_id})
        items = data if isinstance(data, list) else data.get("balances", data.get("data", []))
        return [Balance(**b) for b in items]


class _TransactionsResource:
    def __init__(self, client: KangOpenBanking):
        self._c = client

    def list(
        self,
        account_id: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> dict:
        params = {"account_id": account_id, "page": str(page), "per_page": str(per_page)}
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date
        return self._c._request("GET", "aisp-transactions", params=params)


class _BeneficiariesResource:
    def __init__(self, client: KangOpenBanking):
        self._c = client

    def list(self, account_id: str) -> List[Beneficiary]:
        data = self._c._request("GET", "aisp-beneficiaries", params={"account_id": account_id})
        items = data if isinstance(data, list) else data.get("beneficiaries", data.get("data", []))
        return [Beneficiary(**b) for b in items]


class _ChargesResource:
    def __init__(self, client: KangOpenBanking):
        self._c = client

    def create(self, **kwargs) -> Charge:
        data = self._c._request("POST", "gateway-charges", json={"action": "create_charge", **kwargs})
        return Charge(**data) if "id" in data else Charge(**data.get("charge", data))

    def get(self, charge_id: str) -> Charge:
        data = self._c._request("POST", "gateway-charges", json={"action": "get_charge", "charge_id": charge_id})
        return Charge(**data) if "id" in data else Charge(**data.get("charge", data))

    def verify(self, charge_id: str) -> Charge:
        data = self._c._request("POST", "gateway-charges", json={"action": "verify_charge", "charge_id": charge_id})
        return Charge(**data) if "id" in data else Charge(**data.get("charge", data))


class _RefundsResource:
    def __init__(self, client: KangOpenBanking):
        self._c = client

    def create(self, charge_id: str, amount: Optional[float] = None, reason: Optional[str] = None) -> Refund:
        body: dict = {"action": "create", "charge_id": charge_id}
        if amount is not None:
            body["amount"] = amount
        if reason:
            body["reason"] = reason
        data = self._c._request("POST", "gateway-refunds", json=body)
        return Refund(**data) if "id" in data else Refund(**data.get("refund", data))


class _PayoutsResource:
    def __init__(self, client: KangOpenBanking):
        self._c = client

    def create(self, **kwargs) -> Payout:
        data = self._c._request("POST", "gateway-payouts", json={"action": "create", **kwargs})
        return Payout(**data) if "id" in data else Payout(**data.get("payout", data))

    def get(self, payout_id: str) -> Payout:
        data = self._c._request("POST", "gateway-payouts", json={"action": "get", "payout_id": payout_id})
        return Payout(**data) if "id" in data else Payout(**data.get("payout", data))


class _GatewayResource:
    def __init__(self, client: KangOpenBanking):
        self._c = client

    def estimate_fee(self, amount: float, channel: str, currency: str = "XAF") -> FeeEstimate:
        data = self._c._request("POST", "gateway-charges", json={
            "action": "fee_estimate", "amount": amount, "channel": channel, "currency": currency,
        })
        return FeeEstimate(**data) if "amount" in data else FeeEstimate(**data.get("estimate", data))


class _SandboxResource:
    def __init__(self, client: KangOpenBanking):
        self._c = client

    def create_account(self, account_holder_name: str, currency: str = "XAF") -> dict:
        return self._c._request("POST", "sandbox-create-account", json={
            "account_holder_name": account_holder_name, "currency": currency,
        })

    def generate_data(self, data_type: str, count: int = 50) -> dict:
        return self._c._request("POST", "sandbox-generate-data", json={
            "type": data_type, "count": count,
        })
