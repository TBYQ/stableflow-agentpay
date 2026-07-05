package main

import (
	"log"
	"net/http"
	"os"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/memory"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/summary"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/webhook"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	httpapi "github.com/TBYQ/stableflow-agentpay/internal/payment/ports/httpapi"
)

func main() {
	store := memory.NewStore()
	service := application.NewService(application.Dependencies{
		ServiceRequests: store,
		PaymentIntents:  store,
		Ledger:          store,
		WebhookEvents:   store,
		WebhookSender:   webhook.NewLocalSigner("dev-secret"),
		Summary:         summary.TemplateGenerator{},
		Clock:           application.SystemClock{},
		IDs:             application.NewSequentialIDGenerator(),
	})

	addr := os.Getenv("STABLEFLOW_HTTP_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	server := httpapi.NewServer(service)
	log.Printf("StableFlow AgentPay API listening on %s", addr)
	if err := http.ListenAndServe(addr, server.Routes()); err != nil {
		log.Fatal(err)
	}
}
