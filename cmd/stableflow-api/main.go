package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/chain/flare"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/filejson"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/memory"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/quote"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/summary"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/webhook"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	httpapi "github.com/TBYQ/stableflow-agentpay/internal/payment/ports/httpapi"
)

type paymentStore interface {
	application.ServiceRequestRepository
	application.PaymentIntentRepository
	application.LedgerRepository
	application.WebhookEventRepository
}

func main() {
	var store paymentStore = memory.NewStore()
	if storePath := os.Getenv("STABLEFLOW_STORE_PATH"); storePath != "" {
		fileStore, err := filejson.NewStore(storePath)
		if err != nil {
			log.Fatalf("open JSON store: %v", err)
		}
		store = fileStore
		log.Printf("JSON store enabled at %s", storePath)
	}

	clock := application.SystemClock{}
	quoteProvider, err := newQuoteProvider(clock)
	if err != nil {
		log.Fatalf("configure quote provider: %v", err)
	}
	var webhookSender application.WebhookSender = webhook.NewLocalSigner(envOrDefault("STABLEFLOW_WEBHOOK_SECRET", "dev-secret"))
	if os.Getenv("STABLEFLOW_WEBHOOK_DELIVERY") == "http" {
		webhookSender = webhook.NewHTTPSenderWithAllowedHosts(
			envOrDefault("STABLEFLOW_WEBHOOK_SECRET", "dev-secret"),
			nil,
			strings.Split(os.Getenv("STABLEFLOW_WEBHOOK_HOST_ALLOWLIST"), ","),
		)
	}

	var chainVerifier application.ChainPaymentVerifier
	contractAddress := os.Getenv("STABLEFLOW_PAYMENT_CONTRACT")
	if contractAddress != "" {
		verifier, err := flare.NewReceiptVerifier(envOrDefault("FLARE_RPC_URL", "https://coston2-api.flare.network/ext/C/rpc"), contractAddress)
		if err != nil {
			log.Printf("Flare receipt verifier disabled: %v", err)
		} else {
			chainVerifier = verifier
			log.Printf("Flare receipt verifier enabled for contract %s", contractAddress)
		}
	}

	service := application.NewService(application.Dependencies{
		ServiceRequests: store,
		PaymentIntents:  store,
		Ledger:          store,
		WebhookEvents:   store,
		WebhookSender:   webhookSender,
		ChainVerifier:   chainVerifier,
		Summary:         summary.TemplateGenerator{},
		Quote:           quoteProvider,
		Clock:           clock,
		IDs:             application.NewULIDGenerator(),
	})

	addr := envOrDefault("STABLEFLOW_HTTP_ADDR", ":"+envOrDefault("PORT", "8080"))

	server := httpapi.NewServer(service)
	if staticDir := envOrDefault("STABLEFLOW_STATIC_DIR", "web/dist"); directoryExists(staticDir) {
		server.SetStaticDir(staticDir)
		log.Printf("Serving checkout UI from %s", staticDir)
	}
	log.Printf("StableFlow AgentPay API listening on %s", addr)
	if err := http.ListenAndServe(addr, server.Routes()); err != nil {
		log.Fatal(err)
	}
}

func newQuoteProvider(clock application.Clock) (application.QuoteProvider, error) {
	if os.Getenv("STABLEFLOW_QUOTE_MODE") == "static" {
		log.Printf("Static demo quote provider enabled")
		return quote.NewStaticProvider(
			envOrDefault("STABLEFLOW_DEMO_C2FLR_USD_PRICE", "10"),
			envOrDefault("STABLEFLOW_DEMO_FXRP_USD_PRICE", "2"),
			clock,
		), nil
	}

	provider, err := quote.NewFTSOProvider(
		envOrDefault("FLARE_RPC_URL", "https://coston2-api.flare.network/ext/C/rpc"),
		envOrDefault("STABLEFLOW_FLARE_CONTRACT_REGISTRY", quote.DefaultFlareContractRegistry),
		clock,
	)
	if err != nil {
		return nil, err
	}
	log.Printf("Flare FTSOv2 quote provider enabled for FLR/USD and XRP/USD")
	return provider, nil
}

func envOrDefault(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func directoryExists(path string) bool {
	info, err := os.Stat(filepath.Clean(path))
	return err == nil && info.IsDir()
}
