"""
Phase 3 helpers — additive merchant operations module.

Introduced in kangopenbanking 1.4.0. Does NOT modify any existing
client method or type. Wire onto an existing client instance:

    from kangopenbanking import KangOpenBanking
    from kangopenbanking.phase3 import MerchantOps

    kob = KangOpenBanking(client_id="...", api_key="sbx_...")
    ops = MerchantOps(kob)
    job = ops.exports_transactions(merchant_id="mch_...", from_date="2026-04-01")

Standards cited: PSD2 RTS Art. 36, Stripe API Reference (Reports & Webhooks).
"""

from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional


ExportFormat = Literal["csv", "xlsx", "json"]
ResourceKind = Literal["transactions", "settlements", "fees"]


class MerchantOps:
    """Phase 3 merchant operations — exports, statements, reconciliation,
    API keys, webhook deliveries."""

    def __init__(self, client: Any) -> None:
        self._c = client

    # ─── Exports ────────────────────────────────────────────────────
    def _export(self, resource: ResourceKind, **filters: Any) -> Dict[str, Any]:
        body = {"resource": resource}
        body.update({k: v for k, v in filters.items() if v is not None})
        return self._c._request("POST", "merchant-exports", json=body)

    def exports_transactions(
        self,
        merchant_id: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        environment: Optional[Literal["sandbox", "live"]] = None,
        currency: Optional[str] = None,
        format: ExportFormat = "csv",
    ) -> Dict[str, Any]:
        return self._export("transactions",
                            merchant_id=merchant_id, **{"from": from_date, "to": to_date},
                            environment=environment, currency=currency, format=format)

    def exports_settlements(self, merchant_id: str, **filters: Any) -> Dict[str, Any]:
        return self._export("settlements", merchant_id=merchant_id, **filters)

    def exports_fees(self, merchant_id: str, **filters: Any) -> Dict[str, Any]:
        return self._export("fees", merchant_id=merchant_id, **filters)

    def export_get(self, export_id: str) -> Dict[str, Any]:
        return self._c._request("GET", "merchant-exports", params={"export_id": export_id})

    # ─── Statements ─────────────────────────────────────────────────
    def statement_download(self, merchant_id: str, month: str, format: str = "pdf") -> Dict[str, Any]:
        return self._c._request("GET", "gateway-merchant-statement",
                                params={"merchant_id": merchant_id, "month": month, "format": format})

    # ─── Reconciliation ─────────────────────────────────────────────
    def reconciliation_run(self, merchant_id: str, from_date: str, to_date: str) -> Dict[str, Any]:
        return self._c._request("POST", "gateway-reconciliation-run",
                                json={"merchant_id": merchant_id, "from": from_date, "to": to_date})

    def reconciliation_get(self, run_id: str) -> Dict[str, Any]:
        return self._c._request("GET", "gateway-reconciliation-run", params={"run_id": run_id})

    # ─── Merchant API Keys ──────────────────────────────────────────
    def api_keys_list(self, merchant_id: str) -> List[Dict[str, Any]]:
        data = self._c._request("GET", "gateway-merchant-api-keys",
                                params={"merchant_id": merchant_id})
        return data if isinstance(data, list) else data.get("data", [])

    def api_key_create(self, merchant_id: str, label: str, scopes: List[str],
                        environment: Literal["sandbox", "live"]) -> Dict[str, Any]:
        return self._c._request("POST", "gateway-merchant-api-keys", json={
            "action": "create", "merchant_id": merchant_id,
            "label": label, "scopes": scopes, "environment": environment,
        })

    def api_key_revoke(self, key_id: str) -> Dict[str, Any]:
        return self._c._request("POST", "gateway-merchant-api-keys",
                                json={"action": "revoke", "key_id": key_id})

    def api_key_rotate(self, key_id: str) -> Dict[str, Any]:
        return self._c._request("POST", "gateway-merchant-api-keys",
                                json={"action": "rotate", "key_id": key_id})

    # ─── Merchant Webhooks ──────────────────────────────────────────
    def webhook_endpoints(self, merchant_id: str) -> List[Dict[str, Any]]:
        data = self._c._request("GET", "gateway-webhook-endpoints",
                                params={"merchant_id": merchant_id})
        return data if isinstance(data, list) else data.get("data", [])

    def webhook_deliveries(self, endpoint_id: str, limit: int = 50,
                           status: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {"endpoint_id": endpoint_id, "limit": str(limit)}
        if status:
            params["status"] = status
        data = self._c._request("GET", "gateway-webhook-deliveries", params=params)
        return data if isinstance(data, list) else data.get("data", [])

    def webhook_replay(self, endpoint_id: str, delivery_id: str) -> Dict[str, Any]:
        return self._c._request("POST", "gateway-webhook-replay-delivery",
                                json={"endpoint_id": endpoint_id, "delivery_id": delivery_id})

    def webhook_rotate_secret(self, endpoint_id: str) -> Dict[str, Any]:
        return self._c._request("POST", "gateway-webhook-endpoints",
                                json={"action": "rotate_secret", "endpoint_id": endpoint_id})


__all__ = ["MerchantOps", "ExportFormat", "ResourceKind"]
