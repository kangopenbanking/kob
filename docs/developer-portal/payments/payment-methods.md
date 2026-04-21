# Payment Methods

## Supported Payment Methods

KOB supports multiple payment methods through a unified charge API. The `channel` parameter determines which provider and flow is used.

### Mobile Money (Cameroon / CEMAC)

```json
{
  "channel": "mobile_money",
  "customer_phone": "237677123456",
  "amount": 5000,
  "currency": "XAF"
}
```

**Providers**: MTN Mobile Money, Orange Money
**Flow**: Customer receives a USSD push to approve payment on their phone.

### Card Payments

```json
{
  "channel": "card",
  "customer_email": "john@example.com",
  "amount": 10000,
  "currency": "XAF"
}
```

**Providers**: Stripe (primary), Flutterwave (fallback)
**Flow**: Returns `redirect_url` to hosted checkout page. Supports 3D Secure.

### Bank Transfer

```json
{
  "channel": "bank_transfer",
  "customer_email": "john@example.com",
  "amount": 100000,
  "currency": "XAF"
}
```

**Providers**: Flutterwave
**Flow**: Customer receives bank account details for manual transfer.

### PayPal

```json
{
  "channel": "paypal",
  "customer_email": "john@example.com",
  "amount": 50,
  "currency": "USD"
}
```

**Providers**: PayPal
**Flow**: Returns PayPal approval URL for redirect.

### Apple Pay / Google Pay

```json
{
  "channel": "apple_pay",
  "amount": 2500,
  "currency": "USD"
}
```

**Providers**: Stripe
**Flow**: Requires client-side payment sheet integration.

## Completing the payment

Every `POST /v1/gateway/charges` response now includes a `next_action` block telling you exactly how to finish the payment per channel:

- **Card** → confirm `client_secret` with Stripe.js. See [Card Confirmation](./card-confirmation.md).
- **Bank transfer** → display `account_number` + `reference` to the customer. See [Bank Transfer Instructions](./bank-transfer-instructions.md).
- **Mobile money** → poll `next_action.poll_url` (`/v1/gateway/charges/{id}/verify`) every 3 seconds until status is terminal.
- **PayPal** → redirect the customer to `next_action.approval_url`.
- **USSD** → display `next_action.ussd_code` to the customer; poll for status.

## Test Credentials

See [Sandbox Overview](../sandbox/sandbox-overview.md) for test card numbers, MoMo phone numbers, and bank accounts.
