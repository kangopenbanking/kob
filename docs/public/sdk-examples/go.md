# Go

```bash
go get github.com/kangopenbanking/sdk-go
```

## Initialise

```go
client := kob.NewClient(kob.Config{
    ClientID:     os.Getenv("KANG_CLIENT_ID"),
    ClientSecret: os.Getenv("KANG_CLIENT_SECRET"),
    Environment:  kob.Sandbox,
})
```

## Create a charge

```go
charge, err := client.Gateway.Charges.Create(ctx, &kob.ChargeRequest{
    Amount: 50000, Currency: "XAF", Channel: "mobile_money",
    CustomerPhone: "+237670000000", TxRef: uuid.NewString(),
}, kob.WithIdempotencyKey(uuid.NewString()))
```

## Retry with exponential backoff

```go
func withRetry[T any](fn func() (T, error)) (T, error) {
    var zero T
    for i := 0; i < 5; i++ {
        v, err := fn()
        if err == nil { return v, nil }
        var ke *kob.Error
        if !errors.As(err, &ke) || !slices.Contains([]int{429, 500, 502, 503, 504}, ke.Status) || i == 4 {
            return zero, err
        }
        wait := ke.RetryAfter
        if wait == 0 { wait = time.Duration(1<<i) * time.Second }
        time.Sleep(wait)
    }
    return zero, errors.New("unreachable")
}
```

## Verify a webhook

```go
func verify(body []byte, sig, ts, secret string) bool {
    n, _ := strconv.ParseInt(ts, 10, 64)
    if math.Abs(float64(time.Now().Unix()-n)) > 300 { return false }
    h := hmac.New(sha256.New, []byte(secret))
    h.Write([]byte(ts + "." + string(body)))
    return hmac.Equal([]byte(hex.EncodeToString(h.Sum(nil))), []byte(sig))
}
```
