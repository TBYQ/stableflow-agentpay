package main

import (
	"log"
	"net/http"
	"os"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/chain/flare"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/memory"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/summary"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/webhook"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	httpapi "github.com/TBYQ/stableflow-agentpay/internal/payment/ports/httpapi"
)

func main() {
	store := memory.NewStore()
	var webhookSender application.WebhookSender = webhook.NewLocalSigner(envOrDefault("STABLEFLOW_WEBHOOK_SECRET", "dev-secret"))
	if os.Getenv("STABLEFLOW_WEBHOOK_DELIVERY") == "http" {
		webhookSender = webhook.NewHTTPSender(envOrDefault("STABLEFLOW_WEBHOOK_SECRET", "dev-secret"), nil)
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
		Clock:           application.SystemClock{},
		IDs:             application.NewSequentialIDGenerator(),
	})

	addr := envOrDefault("STABLEFLOW_HTTP_ADDR", ":8080")

	server := httpapi.NewServer(service)
	log.Printf("StableFlow AgentPay API listening on %s", addr)
	if err := http.ListenAndServe(addr, server.Routes()); err != nil {
		log.Fatal(err)
	}
}

func envOrDefault(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
