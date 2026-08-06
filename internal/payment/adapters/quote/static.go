package quote

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

type StaticProvider struct {
	priceUSD string
	clock    application.Clock
}

func NewStaticProvider(priceUSD string, clock application.Clock) StaticProvider {
	if strings.TrimSpace(priceUSD) == "" {
		priceUSD = "10"
	}
	return StaticProvider{
		priceUSD: strings.TrimSpace(priceUSD),
		clock:    clock,
	}
}

func (p StaticProvider) QuotePayment(ctx context.Context, request application.QuoteRequest) (*application.PaymentQuote, error) {
	asset := strings.TrimSpace(request.Asset)
	if asset == "" {
		asset = "C2FLR"
	}
	if asset != "C2FLR" {
		return nil, fmt.Errorf("%w: quote asset %s is not supported by the demo adapter", domain.ErrValidation, asset)
	}

	usdAmount := strings.TrimSpace(request.USDAmount)
	if usdAmount == "" {
		usdAmount = "0.01"
	}

	usd, ok := new(big.Rat).SetString(usdAmount)
	if !ok || usd.Sign() <= 0 {
		return nil, fmt.Errorf("%w: usd amount must be positive", domain.ErrValidation)
	}
	price, ok := new(big.Rat).SetString(p.priceUSD)
	if !ok || price.Sign() <= 0 {
		return nil, fmt.Errorf("%w: demo C2FLR USD price must be positive", domain.ErrValidation)
	}

	amount := new(big.Rat).Quo(usd, price)
	now := p.clock.Now()
	return &application.PaymentQuote{
		USDAmount:   formatRat(usd, 2),
		Asset:       asset,
		Amount:      formatRat(amount, 6),
		PriceUSD:    formatRat(price, 4),
		PriceSource: "demo-ftso-style-static",
		ExpiresAt:   now.Add(2 * time.Minute),
	}, nil
}

func formatRat(value *big.Rat, precision int) string {
	out := value.FloatString(precision)
	out = strings.TrimRight(out, "0")
	out = strings.TrimRight(out, ".")
	if out == "" {
		return "0"
	}
	return out
}
