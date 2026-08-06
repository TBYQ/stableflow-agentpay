package quote_test

import (
	"context"
	"testing"
	"time"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/quote"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
)

type fixedClock struct {
	now time.Time
}

func (c fixedClock) Now() time.Time {
	return c.now
}

func TestStaticProviderQuotesC2FLR(t *testing.T) {
	provider := quote.NewStaticProvider("10", fixedClock{
		now: time.Date(2026, 8, 6, 10, 0, 0, 0, time.UTC),
	})

	got, err := provider.QuotePayment(context.Background(), application.QuoteRequest{
		USDAmount: "0.01",
		Asset:     "C2FLR",
	})
	if err != nil {
		t.Fatalf("quote payment: %v", err)
	}
	if got.Amount != "0.001" {
		t.Fatalf("expected 0.001 C2FLR, got %s", got.Amount)
	}
	if got.PriceSource != "demo-ftso-style-static" {
		t.Fatalf("unexpected price source %s", got.PriceSource)
	}
}
