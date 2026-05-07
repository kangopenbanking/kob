# Ruby / Rails

```ruby
gem 'kangopenbanking'
```

## Initialise

```ruby
kob = KangOpenBanking::Client.new(
  client_id:     ENV.fetch('KANG_CLIENT_ID'),
  client_secret: ENV.fetch('KANG_CLIENT_SECRET'),
  environment:   :sandbox
)
```

## Create a charge

```ruby
charge = kob.gateway.charges.create(
  { amount: 50_000, currency: 'XAF', channel: 'mobile_money',
    customer_phone: '+237670000000', tx_ref: SecureRandom.uuid },
  idempotency_key: SecureRandom.uuid
)
```

## Retry with exponential backoff

```ruby
def with_retry(max: 5)
  attempt = 0
  begin
    yield
  rescue KangOpenBanking::Error => e
    raise unless [429, 500, 502, 503, 504].include?(e.status) && (attempt += 1) < max
    sleep(e.retry_after || [2**attempt, 30].min)
    retry
  end
end
```

## Verify a webhook (Rails)

```ruby
class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def kob
    ts  = request.headers['X-Webhook-Timestamp'].to_i
    sig = request.headers['X-Webhook-Signature']
    return head(:bad_request) if (Time.now.to_i - ts).abs > 300

    body = request.raw_post
    expected = OpenSSL::HMAC.hexdigest('sha256', Rails.application.credentials.kob_webhook_secret, "#{ts}.#{body}")
    return head(:unauthorized) unless ActiveSupport::SecurityUtils.secure_compare(expected, sig)
    head :ok
  end
end
```
