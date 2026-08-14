package webhook

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

func TestHTTPSenderRejectsWebhookHostOutsideAllowlist(t *testing.T) {
	sender := NewHTTPSenderWithAllowedHosts("test-secret", nil, []string{"webhook.site"})

	delivery, err := sender.SendPaymentPaid(context.Background(), application.PaymentPaidMessage{
		EventID:          "evt_001",
		PaymentIntentID:  "pi_001",
		ServiceRequestID: "sr_001",
		Amount:           "0.01",
		Asset:            "C2FLR",
		ChainID:          114,
		TxHash:           "0xabc123",
		WebhookURL:       "https://example.com/payment-events",
		CreatedAt:        time.Now(),
	})

	if err == nil || !strings.Contains(err.Error(), "not allowed") {
		t.Fatalf("expected an allowlist error, got %v", err)
	}
	if delivery.Status != domain.WebhookFailed {
		t.Fatalf("expected failed webhook delivery, got %s", delivery.Status)
	}
}
