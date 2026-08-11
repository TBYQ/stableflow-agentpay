package quote_test

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/quote"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
)

func TestFTSOProviderQuotesFromFlareRegistryAndFeed(t *testing.T) {
	const ftsoAddress = "0xc4e9c78ea53db782e28f28fdf80baf59336b304d"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Method string            `json:"method"`
			Params []json.RawMessage `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatalf("decode rpc request: %v", err)
		}
		if request.Method != "eth_call" || len(request.Params) == 0 {
			t.Fatalf("unexpected RPC request %#v", request)
		}
		var call struct {
			To   string `json:"to"`
			Data string `json:"data"`
		}
		if err := json.Unmarshal(request.Params[0], &call); err != nil {
			t.Fatalf("decode eth_call input: %v", err)
		}

		var result string
		switch strings.ToLower(call.To) {
		case strings.ToLower(quote.DefaultFlareContractRegistry):
			if !strings.HasPrefix(call.Data, "0x82760fca") {
				t.Fatalf("expected Contract Registry method selector, got %s", call.Data)
			}
			result = abiAddressResult(ftsoAddress)
		case ftsoAddress:
			if !strings.HasPrefix(call.Data, "0x93e9f806") {
				t.Fatalf("expected getFeedById selector, got %s", call.Data)
			}
			result = abiFeedResult(big.NewInt(593999), 8, 1786062590)
		default:
			t.Fatalf("unexpected eth_call target %s", call.To)
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"result":  result,
		})
	}))
	defer server.Close()

	provider, err := quote.NewFTSOProvider(server.URL, quote.DefaultFlareContractRegistry, fixedClock{
		now: time.Date(2026, 8, 7, 10, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("new provider: %v", err)
	}

	got, err := provider.QuotePayment(context.Background(), application.QuoteRequest{
		USDAmount: "0.01",
		Asset:     "C2FLR",
	})
	if err != nil {
		t.Fatalf("quote payment: %v", err)
	}
	if got.PriceUSD != "0.00593999" {
		t.Fatalf("expected FLR/USD price 0.00593999, got %s", got.PriceUSD)
	}
	if got.Amount != "1.683505" {
		t.Fatalf("expected 1.683505 C2FLR, got %s", got.Amount)
	}
	if got.PriceSource != "flare-ftso-v2-flr-usd" {
		t.Fatalf("unexpected price source %s", got.PriceSource)
	}
	if got.FeedID != "0x01464c522f55534400000000000000000000000000" {
		t.Fatalf("unexpected feed id %s", got.FeedID)
	}
	if got.PriceUpdatedAt.Unix() != 1786062590 {
		t.Fatalf("unexpected feed timestamp %s", got.PriceUpdatedAt)
	}
}

func TestFTSOProviderQuotesFXRPUsingXRPUSDFeed(t *testing.T) {
	const ftsoAddress = "0xc4e9c78ea53db782e28f28fdf80baf59336b304d"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Params []json.RawMessage `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatalf("decode rpc request: %v", err)
		}
		var call struct {
			To   string `json:"to"`
			Data string `json:"data"`
		}
		if err := json.Unmarshal(request.Params[0], &call); err != nil {
			t.Fatalf("decode eth_call input: %v", err)
		}
		result := abiAddressResult(ftsoAddress)
		if strings.EqualFold(call.To, ftsoAddress) {
			if !strings.Contains(call.Data, "015852502f555344") {
				t.Fatalf("expected XRP/USD feed id, got %s", call.Data)
			}
			result = abiFeedResult(big.NewInt(215000000), 8, 1786062590)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": 1, "result": result})
	}))
	defer server.Close()

	provider, err := quote.NewFTSOProvider(server.URL, quote.DefaultFlareContractRegistry, fixedClock{now: time.Date(2026, 8, 7, 10, 0, 0, 0, time.UTC)})
	if err != nil {
		t.Fatalf("new provider: %v", err)
	}
	got, err := provider.QuotePayment(context.Background(), application.QuoteRequest{USDAmount: "0.01", Asset: "FXRP"})
	if err != nil {
		t.Fatalf("quote payment: %v", err)
	}
	if got.Amount != "0.004651" || got.PriceSource != "flare-ftso-v2-xrp-usd" {
		t.Fatalf("unexpected FXRP quote %#v", got)
	}
}

func abiAddressResult(address string) string {
	address = strings.TrimPrefix(address, "0x")
	return "0x" + strings.Repeat("0", 24) + address
}

func abiFeedResult(value *big.Int, decimals int8, timestamp uint64) string {
	words := make([]byte, 96)
	copy(words[32-len(value.Bytes()):32], value.Bytes())
	words[63] = byte(decimals)
	for index := 95; index >= 64 && timestamp > 0; index-- {
		words[index] = byte(timestamp)
		timestamp >>= 8
	}
	return "0x" + hex.EncodeToString(words)
}
