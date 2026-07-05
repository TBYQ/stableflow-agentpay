package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

type HTTPSender struct {
	secret string
	client *http.Client
	now    func() time.Time
}

func NewHTTPSender(secret string, client *http.Client) HTTPSender {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return HTTPSender{
		secret: secret,
		client: client,
		now:    time.Now,
	}
}

func (s HTTPSender) SendPaymentPaid(ctx context.Context, message application.PaymentPaidMessage) (application.WebhookDelivery, error) {
	if message.WebhookURL == "" {
		return application.WebhookDelivery{Status: domain.WebhookFailed}, fmt.Errorf("webhook url is empty")
	}

	payload := paymentPaidPayload{
		ID:        message.EventID,
		Type:      "payment.paid",
		CreatedAt: message.CreatedAt.UTC().Format(time.RFC3339),
		Data: paymentPaidData{
			PaymentIntentID:  message.PaymentIntentID,
			ServiceRequestID: message.ServiceRequestID,
			Amount:           message.Amount,
			Asset:            message.Asset,
			ChainID:          message.ChainID,
			TxHash:           message.TxHash,
			Chain:            "flare-coston2",
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return application.WebhookDelivery{DeliveryURL: message.WebhookURL, Status: domain.WebhookFailed}, err
	}

	signature := s.sign(body, s.now().UTC())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, message.WebhookURL, bytes.NewReader(body))
	if err != nil {
		return application.WebhookDelivery{DeliveryURL: message.WebhookURL, Status: domain.WebhookFailed}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("StableFlow-Event-ID", message.EventID)
	req.Header.Set("StableFlow-Signature", signature)

	resp, err := s.client.Do(req)
	if err != nil {
		return application.WebhookDelivery{
			DeliveryURL: message.WebhookURL,
			Signature:   signature,
			Status:      domain.WebhookFailed,
		}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return application.WebhookDelivery{
			DeliveryURL: message.WebhookURL,
			Signature:   signature,
			Status:      domain.WebhookFailed,
		}, fmt.Errorf("webhook delivery returned status %d", resp.StatusCode)
	}

	return application.WebhookDelivery{
		DeliveryURL: message.WebhookURL,
		Signature:   signature,
		Status:      domain.WebhookDelivered,
	}, nil
}

func (s HTTPSender) sign(body []byte, ts time.Time) string {
	// The timestamp is part of the signed message so receivers can reject old
	// replayed webhook payloads when they implement verification.
	timestamp := ts.Unix()
	mac := hmac.New(sha256.New, []byte(s.secret))
	mac.Write([]byte(fmt.Sprintf("%d.", timestamp)))
	mac.Write(body)
	return fmt.Sprintf("t=%d,v1=%s", timestamp, hex.EncodeToString(mac.Sum(nil)))
}

type paymentPaidPayload struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	CreatedAt string          `json:"created_at"`
	Data      paymentPaidData `json:"data"`
}

type paymentPaidData struct {
	PaymentIntentID  string `json:"payment_intent_id"`
	ServiceRequestID string `json:"service_request_id"`
	Amount           string `json:"amount"`
	Asset            string `json:"asset"`
	ChainID          int64  `json:"chain_id"`
	TxHash           string `json:"tx_hash"`
	Chain            string `json:"chain"`
}
