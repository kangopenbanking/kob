"""Type definitions for KOB API responses."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Literal

ChargeChannel = Literal[
    "mobile_money", "card", "bank_transfer", "ussd",
    "paypal", "apple_pay", "google_pay"
]
ChargeStatus = Literal[
    "pending", "processing", "successful", "failed", "cancelled", "refunded"
]


@dataclass
class Account:
    id: str
    account_id: str
    account_holder_name: str
    account_type: str
    account_subtype: str
    currency: str = "XAF"
    identification_scheme: str = ""
    identification_value: str = ""
    nickname: Optional[str] = None
    is_active: bool = True
    institution_id: Optional[str] = None
    data_freshness: Optional[str] = None


@dataclass
class Balance:
    id: str
    account_id: str
    amount: float
    currency: str = "XAF"
    balance_type: str = "closingAvailable"
    credit_debit_indicator: str = "Credit"
    balance_datetime: str = ""


@dataclass
class Transaction:
    id: str
    account_id: str
    amount: float
    currency: str = "XAF"
    credit_debit_indicator: str = "Debit"
    status: str = "booked"
    booking_date: Optional[str] = None
    value_date: Optional[str] = None
    transaction_reference: Optional[str] = None
    merchant_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None


@dataclass
class Beneficiary:
    id: str
    account_id: str
    beneficiary_name: str
    beneficiary_account: str
    bank_code: Optional[str] = None
    currency: str = "XAF"


@dataclass
class Charge:
    id: str
    merchant_id: str
    amount: float
    currency: str
    channel: str
    status: str
    tx_ref: str
    provider: Optional[str] = None
    provider_reference: Optional[str] = None
    created_at: str = ""
    verified_at: Optional[str] = None


@dataclass
class Refund:
    id: str
    charge_id: str
    amount: float
    currency: str
    status: str
    reason: Optional[str] = None
    created_at: str = ""


@dataclass
class Payout:
    id: str
    merchant_id: str
    amount: float
    currency: str
    channel: str
    status: str
    created_at: str = ""


@dataclass
class FeeEstimate:
    amount: float
    fee_amount: float
    net_amount: float
    fee_percentage: str
    fixed_fee: float


# --- Pay by Bank ---
PayByBankStatus = Literal[
    "awaiting_auth", "authorized", "submitted", "processing",
    "completed", "failed", "expired", "rejected"
]


@dataclass
class PayByBankIntent:
    id: str
    merchant_id: str
    consent_id: str
    amount: float
    currency: str
    redirect_uri: str
    state: str
    status: str
    merchant_name: Optional[str] = None
    merchant_logo_url: Optional[str] = None
    debtor_account: Optional[str] = None
    creditor_account: Optional[str] = None
    creditor_name: Optional[str] = None
    description: Optional[str] = None
    expires_at: str = ""
    authorization_url: Optional[str] = None
    customer_email: Optional[str] = None
    customer_user_id: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
