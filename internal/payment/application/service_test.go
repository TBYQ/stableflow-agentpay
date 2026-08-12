package application_test

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/memory"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/summary"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/adapters/webhook"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

type fixedClock struct {
	now time.Time
}

func (c fixedClock) Now() time.Time {
	return c.now
}

type deterministicIDGenerator struct {
	counters map[string]int
}

func newDeterministicIDGenerator() *deterministicIDGenerator {
	return &deterministicIDGenerator{counters: map[string]int{}}
}

func (g *deterministicIDGenerator) NewID(prefix string) string {
	g.counters[prefix]++
	return fmt.Sprintf("%s_%03d", prefix, g.counters[prefix])
}

func newTestService() (*application.Service, *memory.Store) {
	store := memory.NewStore()
	return newTestServiceWithStore(store, nil), store
}

func newTestServiceWithStore(store *memory.Store, verifier application.ChainPaymentVerifier) *application.Service {
	service := application.NewService(application.Dependencies{
		ServiceRequests: store,
		PaymentIntents:  store,
		Ledger:          store,
		WebhookEvents:   store,
		WebhookSender:   webhook.NewLocalSigner("test-secret"),
		ChainVerifier:   verifier,
		Summary:         summary.TemplateGenerator{},
		Clock: fixedClock{
			now: time.Date(2026, 7, 5, 10, 0, 0, 0, time.UTC),
		},
		IDs: newDeterministicIDGenerator(),
	})
	return service
}

func TestPaymentConfirmationFlowCreatesLedgerWebhookAndSummary(t *testing.T) {
	ctx := context.Background()
	service, _ := newTestService()

	request, err := service.CreateServiceRequest(ctx, application.CreateServiceRequestCommand{
		AgentID:     "market-research-agent",
		ServiceID:   "premium-market-report",
		Description: "AI agent requests access to a paid market report",
	})
	if err != nil {
		t.Fatalf("create service request: %v", err)
	}

	intent, err := service.CreatePaymentIntent(ctx, application.CreatePaymentIntentCommand{
		ServiceRequestID: request.ID,
		Amount:           "1.00",
		Asset:            "C2FLR",
		ChainID:          114,
		PaymentContract:  "0x0000000000000000000000000000000000000000",
		WebhookURL:       "https://example.com/webhooks/stableflow",
	})
	if err != nil {
		t.Fatalf("create payment intent: %v", err)
	}

	result, err := service.ConfirmPayment(ctx, application.ConfirmPaymentCommand{
		PaymentIntentID: intent.ID,
		TxHash:          "0xabc123",
	})
	if err != nil {
		t.Fatalf("confirm payment: %v", err)
	}

	if result.PaymentIntent.Status != domain.PaymentPaid {
		t.Fatalf("expected paid status, got %s", result.PaymentIntent.Status)
	}
	if result.LedgerEntry.PaymentIntentID != intent.ID {
		t.Fatalf("ledger entry should reference payment intent")
	}
	if result.WebhookEvent.Status != domain.WebhookDelivered {
		t.Fatalf("expected delivered webhook, got %s", result.WebhookEvent.Status)
	}
	if result.WebhookEvent.Signature == "" {
		t.Fatalf("expected webhook signature")
	}
	if !strings.Contains(result.Summary, "confirmed") {
		t.Fatalf("expected summary to mention confirmation, got %q", result.Summary)
	}

	ledgerEntries, err := service.ListLedgerEntries(ctx)
	if err != nil {
		t.Fatalf("list ledger: %v", err)
	}
	if len(ledgerEntries) != 1 {
		t.Fatalf("expected one ledger entry, got %d", len(ledgerEntries))
	}

	webhookEvents, err := service.ListWebhookEvents(ctx)
	if err != nil {
		t.Fatalf("list webhook events: %v", err)
	}
	if len(webhookEvents) != 1 {
		t.Fatalf("expected one webhook event, got %d", len(webhookEvents))
	}
}

func TestCreatePaymentIntentRequiresExistingServiceRequest(t *testing.T) {
	ctx := context.Background()
	service, _ := newTestService()

	_, err := service.CreatePaymentIntent(ctx, application.CreatePaymentIntentCommand{
		ServiceRequestID: "missing",
		Amount:           "1.00",
		Asset:            "C2FLR",
		ChainID:          114,
	})
	if !errors.Is(err, application.ErrNotFound) {
		t.Fatalf("expected not found error, got %v", err)
	}
}

func TestCreateServiceRequestPersistsAgentIdentity(t *testing.T) {
	ctx := context.Background()
	service, _ := newTestService()

	request, err := service.CreateServiceRequest(ctx, application.CreateServiceRequestCommand{
		AgentID:     "market-research-agent",
		ServiceID:   "premium-market-report",
		Description: "Need a verified market brief before placing an order.",
	})
	if err != nil {
		t.Fatalf("create service request: %v", err)
	}
	if request.AgentID != "market-research-agent" {
		t.Fatalf("expected agent identity to be stored, got %q", request.AgentID)
	}

	requests, err := service.ListServiceRequests(ctx)
	if err != nil {
		t.Fatalf("list service requests: %v", err)
	}
	if len(requests) != 1 || requests[0].ID != request.ID {
		t.Fatalf("expected the created service request to be listed, got %#v", requests)
	}
}

func TestULIDGeneratorCreatesPrefixedNonSequentialIDs(t *testing.T) {
	ids := application.NewULIDGenerator()
	pattern := regexp.MustCompile(`^pi_[0-9A-HJKMNP-TV-Z]{26}$`)

	first := ids.NewID("pi")
	second := ids.NewID("pi")
	if !pattern.MatchString(first) {
		t.Fatalf("expected prefixed ULID, got %s", first)
	}
	if !pattern.MatchString(second) {
		t.Fatalf("expected prefixed ULID, got %s", second)
	}
	if first == second {
		t.Fatalf("expected unique ids, got duplicate %s", first)
	}
}

func TestConfirmPaymentRejectsUnknownPaymentIntent(t *testing.T) {
	ctx := context.Background()
	service, _ := newTestService()

	_, err := service.ConfirmPayment(ctx, application.ConfirmPaymentCommand{
		PaymentIntentID: "missing",
		TxHash:          "0xabc123",
	})
	if !errors.Is(err, application.ErrNotFound) {
		t.Fatalf("expected not found error, got %v", err)
	}
}

func TestConfirmPaymentFromChainUsesVerifiedPaymentIntentID(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()
	service := newTestServiceWithStore(store, fakeChainVerifier{
		paymentIntentID: "pi_001",
		txHash:          "0xabc123",
	})

	request, err := service.CreateServiceRequest(ctx, application.CreateServiceRequestCommand{
		AgentID:     "market-research-agent",
		ServiceID:   "premium-market-report",
		Description: "AI agent requests access to a paid market report",
	})
	if err != nil {
		t.Fatalf("create service request: %v", err)
	}

	intent, err := service.CreatePaymentIntent(ctx, application.CreatePaymentIntentCommand{
		ServiceRequestID: request.ID,
		Amount:           "1.00",
		Asset:            "C2FLR",
		ChainID:          114,
		WebhookURL:       "https://example.com/webhooks/stableflow",
	})
	if err != nil {
		t.Fatalf("create payment intent: %v", err)
	}

	result, err := service.ConfirmPaymentFromChain(ctx, application.ConfirmPaymentFromChainCommand{
		PaymentIntentID: intent.ID,
		TxHash:          "0xabc123",
	})
	if err != nil {
		t.Fatalf("confirm payment from chain: %v", err)
	}

	if result.PaymentIntent.Status != domain.PaymentPaid {
		t.Fatalf("expected paid status, got %s", result.PaymentIntent.Status)
	}
}

func TestConfirmPaymentFromChainRejectsMismatchedPaymentIntentID(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()
	service := newTestServiceWithStore(store, fakeChainVerifier{
		paymentIntentID: "pi_other",
		txHash:          "0xabc123",
	})

	request, err := service.CreateServiceRequest(ctx, application.CreateServiceRequestCommand{
		AgentID:     "market-research-agent",
		ServiceID:   "premium-market-report",
		Description: "AI agent requests access to a paid market report",
	})
	if err != nil {
		t.Fatalf("create service request: %v", err)
	}

	intent, err := service.CreatePaymentIntent(ctx, application.CreatePaymentIntentCommand{
		ServiceRequestID: request.ID,
		Amount:           "1.00",
		Asset:            "C2FLR",
		ChainID:          114,
	})
	if err != nil {
		t.Fatalf("create payment intent: %v", err)
	}

	_, err = service.ConfirmPaymentFromChain(ctx, application.ConfirmPaymentFromChainCommand{
		PaymentIntentID: intent.ID,
		TxHash:          "0xabc123",
	})
	if !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

type fakeChainVerifier struct {
	paymentIntentID string
	txHash          string
	asset           string
	amountWei       string
	serviceID       string
	chainID         int64
}

func (v fakeChainVerifier) VerifyPayment(ctx context.Context, txHash string) (*application.RecordedChainPayment, error) {
	return &application.RecordedChainPayment{
		PaymentIntentID: v.paymentIntentID,
		TxHash:          v.txHash,
		Asset:           firstNonEmpty(v.asset, "C2FLR"),
		AmountWei:       firstNonEmpty(v.amountWei, "1000000000000000000"),
		ServiceID:       firstNonEmpty(v.serviceID, "premium-market-report"),
		ChainID:         firstChainID(v.chainID, 114),
	}, nil
}

func firstNonEmpty(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func firstChainID(value, fallback int64) int64 {
	if value == 0 {
		return fallback
	}
	return value
}

func TestConfirmPaymentFromChainRejectsMismatchedFXRPAmount(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()
	service := newTestServiceWithStore(store, fakeChainVerifier{
		paymentIntentID: "pi_001",
		txHash:          "0xabc123",
		asset:           "FXRP",
		amountWei:       "999",
	})
	request, err := service.CreateServiceRequest(ctx, application.CreateServiceRequestCommand{AgentID: "market-research-agent", ServiceID: "premium-market-report", Description: "FXRP checkout"})
	if err != nil {
		t.Fatalf("create service request: %v", err)
	}
	intent, err := service.CreatePaymentIntent(ctx, application.CreatePaymentIntentCommand{ServiceRequestID: request.ID, Amount: "1", Asset: "FXRP", ChainID: 114})
	if err != nil {
		t.Fatalf("create payment intent: %v", err)
	}
	_, err = service.ConfirmPaymentFromChain(ctx, application.ConfirmPaymentFromChainCommand{PaymentIntentID: intent.ID, TxHash: "0xabc123"})
	if !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestConfirmPaymentFromChainAcceptsSixDecimalFXRPAmount(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()
	service := newTestServiceWithStore(store, fakeChainVerifier{
		paymentIntentID: "pi_001",
		txHash:          "0xabc123",
		asset:           "FXRP",
		amountWei:       "9893",
	})
	request, err := service.CreateServiceRequest(ctx, application.CreateServiceRequestCommand{AgentID: "market-research-agent", ServiceID: "premium-market-report", Description: "FXRP checkout"})
	if err != nil {
		t.Fatalf("create service request: %v", err)
	}
	intent, err := service.CreatePaymentIntent(ctx, application.CreatePaymentIntentCommand{ServiceRequestID: request.ID, Amount: "0.009893", Asset: "FXRP", ChainID: 114})
	if err != nil {
		t.Fatalf("create payment intent: %v", err)
	}
	result, err := service.ConfirmPaymentFromChain(ctx, application.ConfirmPaymentFromChainCommand{PaymentIntentID: intent.ID, TxHash: "0xabc123"})
	if err != nil {
		t.Fatalf("confirm FXRP payment from chain: %v", err)
	}
	if result.PaymentIntent.Status != domain.PaymentPaid {
		t.Fatalf("expected paid status, got %s", result.PaymentIntent.Status)
	}
}
