package webhook

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

func TestHTTPSenderSendsSignedPaymentPaidWebhook(t *testing.T) {
	var gotSignature string
	var gotPayload paymentPaidPayload

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		gotSignature = r.Header.Get("StableFlow-Signature")
		if gotSignature == "" {
			t.Fatalf("expected StableFlow-Signature header")
		}
		if err := json.NewDecoder(r.Body).Decode(&gotPayload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	sender := NewHTTPSender("test-secret", server.Client())
	delivery, err := sender.SendPaymentPaid(context.Background(), application.PaymentPaidMessage{
		EventID:          "evt_001",
		PaymentIntentID:  "pi_001",
		ServiceRequestID: "sr_001",
		Amount:           "1.00",
		Asset:            "C2FLR",
		ChainID:          114,
		TxHash:           "0xabc123",
		WebhookURL:       server.URL,
		CreatedAt:        time.Date(2026, 7, 5, 10, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("send webhook: %v", err)
	}
	if delivery.Status != domain.WebhookDelivered {
		t.Fatalf("expected delivered status, got %s", delivery.Status)
	}
	if delivery.Signature == "" {
		t.Fatalf("expected delivery signature")
	}
	if gotPayload.ID != "evt_001" {
		t.Fatalf("expected event id evt_001, got %s", gotPayload.ID)
	}
	if gotPayload.Data.PaymentIntentID != "pi_001" {
		t.Fatalf("expected payment intent pi_001, got %s", gotPayload.Data.PaymentIntentID)
	}
	if gotPayload.Data.Chain != "flare-coston2" {
		t.Fatalf("expected flare-coston2 chain, got %s", gotPayload.Data.Chain)
	}
	if gotSignature != delivery.Signature {
		t.Fatalf("header signature should match returned delivery signature")
	}
}
