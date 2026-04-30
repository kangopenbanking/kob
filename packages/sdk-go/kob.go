// Package kob is the official Go SDK for Kang Open Banking (KOB).
// Version 1.4.0 — includes Phase 3 MerchantOps (exports, statements,
// reconciliation, api-keys, webhook deliveries).
//
// Usage:
//
//	c := kob.New(kob.Config{
//	    ClientID: "your_client_id",
//	    APIKey:   "sbx_test_xxx",
//	    Env:      kob.Sandbox,
//	})
//	job, err := c.Merchant.ExportTransactions(ctx, kob.ExportFilters{
//	    MerchantID: "mch_uuid",
//	    From:       "2026-04-01",
//	    To:         "2026-04-30",
//	    Format:     "csv",
//	})
package kob

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const defaultBaseURL = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1"

type Environment string

const (
	Sandbox    Environment = "sandbox"
	Production Environment = "production"
)

type Config struct {
	ClientID     string
	ClientSecret string
	APIKey       string
	BaseURL      string
	Env          Environment
	Timeout      time.Duration
	HTTPClient   *http.Client
}

type Client struct {
	cfg      Config
	http     *http.Client
	Merchant *MerchantOps
}

type APIError struct {
	StatusCode int    `json:"-"`
	ErrorCode  string `json:"error_code"`
	Message    string `json:"message"`
	ErrorID    string `json:"error_id"`
}

func (e *APIError) Error() string {
	return fmt.Sprintf("kob: [%d] %s (%s)", e.StatusCode, e.Message, e.ErrorCode)
}

func New(cfg Config) *Client {
	if cfg.BaseURL == "" {
		cfg.BaseURL = defaultBaseURL
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 30 * time.Second
	}
	if cfg.Env == "" {
		cfg.Env = Sandbox
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: cfg.Timeout}
	}
	c := &Client{cfg: cfg, http: httpClient}
	c.Merchant = &MerchantOps{c: c}
	return c
}

// Do performs an authenticated HTTP request against the KOB Functions API.
// Exposed publicly so user code or future resources can build on top.
func (c *Client) Do(ctx context.Context, method, path string, body any, query map[string]string) ([]byte, error) {
	u := fmt.Sprintf("%s/%s", c.cfg.BaseURL, path)
	if len(query) > 0 {
		v := url.Values{}
		for k, val := range query {
			if val != "" {
				v.Set(k, val)
			}
		}
		u = u + "?" + v.Encode()
	}

	var rdr io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		rdr = bytes.NewReader(raw)
	}

	req, err := http.NewRequestWithContext(ctx, method, u, rdr)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.cfg.APIKey != "" && c.cfg.Env == Sandbox {
		req.Header.Set("X-API-Key", c.cfg.APIKey)
	} else if c.cfg.ClientSecret != "" {
		req.Header.Set("Authorization", "Bearer "+c.cfg.ClientSecret)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		ae := &APIError{StatusCode: resp.StatusCode, Message: string(raw)}
		_ = json.Unmarshal(raw, ae)
		return nil, ae
	}
	return raw, nil
}

// ─── Phase 3 — Merchant Ops ──────────────────────────────────────────

type MerchantOps struct{ c *Client }

type ExportFilters struct {
	MerchantID  string `json:"merchant_id"`
	From        string `json:"from,omitempty"`
	To          string `json:"to,omitempty"`
	Environment string `json:"environment,omitempty"`
	Currency    string `json:"currency,omitempty"`
	Format      string `json:"format,omitempty"` // csv | xlsx | json
}

type ExportJob struct {
	ExportID    string `json:"export_id"`
	Status      string `json:"status"`
	Format      string `json:"format"`
	DownloadURL string `json:"download_url,omitempty"`
	ExpiresAt   string `json:"expires_at,omitempty"`
}

func (m *MerchantOps) export(ctx context.Context, resource string, f ExportFilters) (*ExportJob, error) {
	body := map[string]any{
		"resource":     resource,
		"merchant_id":  f.MerchantID,
		"from":         f.From,
		"to":           f.To,
		"environment":  f.Environment,
		"currency":     f.Currency,
		"format":       f.Format,
	}
	raw, err := m.c.Do(ctx, "POST", "merchant-exports", body, nil)
	if err != nil {
		return nil, err
	}
	var out ExportJob
	return &out, json.Unmarshal(raw, &out)
}

func (m *MerchantOps) ExportTransactions(ctx context.Context, f ExportFilters) (*ExportJob, error) {
	return m.export(ctx, "transactions", f)
}
func (m *MerchantOps) ExportSettlements(ctx context.Context, f ExportFilters) (*ExportJob, error) {
	return m.export(ctx, "settlements", f)
}
func (m *MerchantOps) ExportFees(ctx context.Context, f ExportFilters) (*ExportJob, error) {
	return m.export(ctx, "fees", f)
}
func (m *MerchantOps) ExportGet(ctx context.Context, id string) (*ExportJob, error) {
	raw, err := m.c.Do(ctx, "GET", "merchant-exports", nil, map[string]string{"export_id": id})
	if err != nil {
		return nil, err
	}
	var out ExportJob
	return &out, json.Unmarshal(raw, &out)
}

type StatementResponse struct {
	URL       string `json:"url"`
	ExpiresAt string `json:"expires_at"`
}

func (m *MerchantOps) StatementDownload(ctx context.Context, merchantID, month, format string) (*StatementResponse, error) {
	if format == "" {
		format = "pdf"
	}
	raw, err := m.c.Do(ctx, "GET", "gateway-merchant-statement", nil, map[string]string{
		"merchant_id": merchantID, "month": month, "format": format,
	})
	if err != nil {
		return nil, err
	}
	var out StatementResponse
	return &out, json.Unmarshal(raw, &out)
}

type ReconciliationRun struct {
	RunID      string `json:"run_id"`
	Status     string `json:"status"`
	Mismatches int    `json:"mismatches,omitempty"`
}

func (m *MerchantOps) ReconciliationRun(ctx context.Context, merchantID, from, to string) (*ReconciliationRun, error) {
	raw, err := m.c.Do(ctx, "POST", "gateway-reconciliation-run", map[string]string{
		"merchant_id": merchantID, "from": from, "to": to,
	}, nil)
	if err != nil {
		return nil, err
	}
	var out ReconciliationRun
	return &out, json.Unmarshal(raw, &out)
}

func (m *MerchantOps) ReconciliationGet(ctx context.Context, runID string) (*ReconciliationRun, error) {
	raw, err := m.c.Do(ctx, "GET", "gateway-reconciliation-run", nil, map[string]string{"run_id": runID})
	if err != nil {
		return nil, err
	}
	var out ReconciliationRun
	return &out, json.Unmarshal(raw, &out)
}

type APIKey struct {
	ID            string   `json:"id"`
	Prefix        string   `json:"prefix"`
	Scopes        []string `json:"scopes"`
	Environment   string   `json:"environment"`
	CreatedAt     string   `json:"created_at"`
	LastUsedAt    string   `json:"last_used_at,omitempty"`
	PlaintextKey  string   `json:"plaintext_key,omitempty"`
}

func (m *MerchantOps) APIKeysList(ctx context.Context, merchantID string) ([]APIKey, error) {
	raw, err := m.c.Do(ctx, "GET", "gateway-merchant-api-keys", nil, map[string]string{"merchant_id": merchantID})
	if err != nil {
		return nil, err
	}
	var out []APIKey
	if json.Unmarshal(raw, &out) != nil {
		var wrap struct{ Data []APIKey `json:"data"` }
		if err := json.Unmarshal(raw, &wrap); err != nil {
			return nil, err
		}
		return wrap.Data, nil
	}
	return out, nil
}

func (m *MerchantOps) APIKeyCreate(ctx context.Context, merchantID, label string, scopes []string, env string) (*APIKey, error) {
	raw, err := m.c.Do(ctx, "POST", "gateway-merchant-api-keys", map[string]any{
		"action": "create", "merchant_id": merchantID,
		"label": label, "scopes": scopes, "environment": env,
	}, nil)
	if err != nil {
		return nil, err
	}
	var out APIKey
	return &out, json.Unmarshal(raw, &out)
}

func (m *MerchantOps) APIKeyRevoke(ctx context.Context, keyID string) error {
	_, err := m.c.Do(ctx, "POST", "gateway-merchant-api-keys", map[string]string{
		"action": "revoke", "key_id": keyID,
	}, nil)
	return err
}

func (m *MerchantOps) APIKeyRotate(ctx context.Context, keyID string) (*APIKey, error) {
	raw, err := m.c.Do(ctx, "POST", "gateway-merchant-api-keys", map[string]string{
		"action": "rotate", "key_id": keyID,
	}, nil)
	if err != nil {
		return nil, err
	}
	var out APIKey
	return &out, json.Unmarshal(raw, &out)
}

type WebhookEndpoint struct {
	ID        string   `json:"id"`
	URL       string   `json:"url"`
	Events    []string `json:"events"`
	IsActive  bool     `json:"is_active"`
	CreatedAt string   `json:"created_at"`
}

type WebhookDelivery struct {
	ID             string `json:"id"`
	EndpointID     string `json:"endpoint_id"`
	EventType      string `json:"event_type"`
	Status         string `json:"status"`
	Attempt        int    `json:"attempt"`
	MaxAttempts    int    `json:"max_attempts"`
	ResponseStatus int    `json:"response_status"`
	CreatedAt      string `json:"created_at"`
}

func (m *MerchantOps) WebhookEndpoints(ctx context.Context, merchantID string) ([]WebhookEndpoint, error) {
	raw, err := m.c.Do(ctx, "GET", "gateway-webhook-endpoints", nil, map[string]string{"merchant_id": merchantID})
	if err != nil {
		return nil, err
	}
	var out []WebhookEndpoint
	return out, json.Unmarshal(raw, &out)
}

func (m *MerchantOps) WebhookDeliveries(ctx context.Context, endpointID, status string, limit int) ([]WebhookDelivery, error) {
	q := map[string]string{"endpoint_id": endpointID}
	if status != "" {
		q["status"] = status
	}
	if limit > 0 {
		q["limit"] = fmt.Sprintf("%d", limit)
	}
	raw, err := m.c.Do(ctx, "GET", "gateway-webhook-deliveries", nil, q)
	if err != nil {
		return nil, err
	}
	var out []WebhookDelivery
	return out, json.Unmarshal(raw, &out)
}

type ReplayResult struct {
	ReplayDeliveryID string `json:"replay_delivery_id"`
	Status           string `json:"status"`
}

func (m *MerchantOps) WebhookReplay(ctx context.Context, endpointID, deliveryID string) (*ReplayResult, error) {
	raw, err := m.c.Do(ctx, "POST", "gateway-webhook-replay-delivery", map[string]string{
		"endpoint_id": endpointID, "delivery_id": deliveryID,
	}, nil)
	if err != nil {
		return nil, err
	}
	var out ReplayResult
	return &out, json.Unmarshal(raw, &out)
}

// VerifyWebhookSignature returns true when the HMAC-SHA256 of payload using
// secret matches the supplied lowercase-hex signature in constant time.
// Mirrors the gateway-webhook-deliver-v2 producer contract.
func VerifyWebhookSignature(payload []byte, signatureHex, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return subtle.ConstantTimeCompare([]byte(signatureHex), []byte(expected)) == 1
}
