"""KOB QR Merchant Directory helpers (v4.31.x).

Public, unauthenticated. Cursor-paginated auto-fetch with a 5-minute
in-process cache so a partner virtual-card app can call ``qr.directory.list()``
on every scan without thrash.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

FN_BASE = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1"
TTL_S = 5 * 60

_cache: Dict[str, Any] = {"key": None, "ts": 0.0, "data": None}


def _http_get_json(url: str) -> Dict[str, Any]:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        if r.status >= 400:
            raise RuntimeError(f"KOB QR error: HTTP {r.status}")
        return json.loads(r.read().decode("utf-8"))


def _fetch_all(country: Optional[str], category: Optional[str], hard_cap: int) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    cursor: Optional[str] = None
    while len(out) < hard_cap:
        params = {"limit": "100"}
        if country:
            params["country"] = country
        if category:
            params["category"] = category
        if cursor:
            params["cursor"] = cursor
        url = f"{FN_BASE}/merchants-qr-directory?{urllib.parse.urlencode(params)}"
        page = _http_get_json(url)
        out.extend(page.get("data") or [])
        if not page.get("has_more") or not page.get("next_cursor"):
            break
        cursor = page["next_cursor"]
    return out


class _Directory:
    def list(self, country: Optional[str] = None, category: Optional[str] = None,
             hard_cap: int = 1000) -> List[Dict[str, Any]]:
        """Return the full active merchant directory. Cached for 5 minutes."""
        key = f"{country}|{category}|{hard_cap}"
        if _cache["key"] == key and (time.time() - _cache["ts"]) < TTL_S and _cache["data"] is not None:
            return _cache["data"]
        data = _fetch_all(country, category, hard_cap)
        _cache.update(key=key, ts=time.time(), data=data)
        return data

    def sync(self, **kwargs) -> List[Dict[str, Any]]:
        """Force-refresh ignoring the cache."""
        _cache["key"] = None
        return self.list(**kwargs)

    def by_id(self, **kwargs) -> Dict[str, Dict[str, Any]]:
        return {m["merchant_id"]: m for m in self.list(**kwargs)}


class _Merchant:
    def get(self, merchant_id: str, amount: Optional[str] = None, ref: Optional[str] = None) -> Dict[str, Any]:
        params = {"id": merchant_id}
        if amount:
            params["amount"] = amount
        if ref:
            params["ref"] = ref
        url = f"{FN_BASE}/merchants-qr-get?{urllib.parse.urlencode(params)}"
        return _http_get_json(url)


class _QR:
    directory = _Directory()
    merchant = _Merchant()


qr = _QR()
