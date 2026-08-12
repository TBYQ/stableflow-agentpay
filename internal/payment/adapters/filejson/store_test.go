package filejson_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/filejson"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

func TestStorePersistsPaymentIntents(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "stableflow.json")

	store, err := filejson.NewStore(path)
	if err != nil {
		t.Fatalf("new store: %v", err)
	}

	now := time.Date(2026, 8, 6, 10, 0, 0, 0, time.UTC)
	request, err := domain.NewServiceRequest("sr_001", "market-research-agent", "premium-market-report", "Paid report", now)
	if err != nil {
		t.Fatalf("new service request: %v", err)
	}
	if err := store.SaveServiceRequest(ctx, request); err != nil {
		t.Fatalf("save service request: %v", err)
	}

	intent, err := domain.NewPaymentIntent("pi_001", request.ID, "0.001", "C2FLR", 114, "0xabc", "https://example.com/webhook", now)
	if err != nil {
		t.Fatalf("new payment intent: %v", err)
	}
	if err := store.SavePaymentIntent(ctx, intent); err != nil {
		t.Fatalf("save payment intent: %v", err)
	}

	reopened, err := filejson.NewStore(path)
	if err != nil {
		t.Fatalf("reopen store: %v", err)
	}
	got, err := reopened.GetPaymentIntent(ctx, intent.ID)
	if err != nil {
		t.Fatalf("get payment intent: %v", err)
	}
	if got.ID != intent.ID || got.Amount != intent.Amount {
		t.Fatalf("unexpected intent after reload: %+v", got)
	}
}
