package application

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

var ErrNotFound = errors.New("not found")

func NotFound(resource, id string) error {
	return fmt.Errorf("%w: %s %s", ErrNotFound, resource, id)
}

type ServiceRequestRepository interface {
	SaveServiceRequest(ctx context.Context, request *domain.ServiceRequest) error
	GetServiceRequest(ctx context.Context, id string) (*domain.ServiceRequest, error)
}

type PaymentIntentRepository interface {
	SavePaymentIntent(ctx context.Context, intent *domain.PaymentIntent) error
	GetPaymentIntent(ctx context.Context, id string) (*domain.PaymentIntent, error)
}

type LedgerRepository interface {
	AppendLedgerEntry(ctx context.Context, entry *domain.LedgerEntry) error
	ListLedgerEntries(ctx context.Context) ([]domain.LedgerEntry, error)
	FindLedgerEntryByPaymentIntent(ctx context.Context, paymentIntentID string) (*domain.LedgerEntry, error)
}

type WebhookEventRepository interface {
	SaveWebhookEvent(ctx context.Context, event *domain.WebhookEvent) error
	ListWebhookEvents(ctx context.Context) ([]domain.WebhookEvent, error)
}

type PaymentPaidMessage struct {
	EventID          string
	PaymentIntentID  string
	ServiceRequestID string
	Amount           string
	Asset            string
	ChainID          int64
	TxHash           string
	WebhookURL       string
	CreatedAt        time.Time
}

type WebhookDelivery struct {
	DeliveryURL string
	Signature   string
	Status      domain.WebhookStatus
}

type WebhookSender interface {
	SendPaymentPaid(ctx context.Context, message PaymentPaidMessage) (WebhookDelivery, error)
}

type RecordedChainPayment struct {
	PaymentIntentID   string
	PaymentIntentHash string
	Payer             string
	AmountWei         string
	Asset             string
	ServiceID         string
	ChainID           int64
	TxHash            string
	BlockNumber       uint64
	RecordedAt        time.Time
}

type ChainPaymentVerifier interface {
	VerifyPayment(ctx context.Context, txHash string) (*RecordedChainPayment, error)
}

type PaymentSummaryInput struct {
	PaymentIntent domain.PaymentIntent
	LedgerEntry   *domain.LedgerEntry
}

type SummaryGenerator interface {
	GeneratePaymentSummary(ctx context.Context, input PaymentSummaryInput) (string, error)
}

type Clock interface {
	Now() time.Time
}

type SystemClock struct{}

func (SystemClock) Now() time.Time {
	return time.Now().UTC()
}

type IDGenerator interface {
	NewID(prefix string) string
}

type SequentialIDGenerator struct {
	mu       sync.Mutex
	counters map[string]int
}

func NewSequentialIDGenerator() *SequentialIDGenerator {
	return &SequentialIDGenerator{counters: map[string]int{}}
}

func (g *SequentialIDGenerator) NewID(prefix string) string {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.counters[prefix]++
	return fmt.Sprintf("%s_%03d", prefix, g.counters[prefix])
}
