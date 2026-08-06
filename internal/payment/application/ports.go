package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"sync/atomic"
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
	ListServiceRequests(ctx context.Context) ([]domain.ServiceRequest, error)
}

type PaymentIntentRepository interface {
	SavePaymentIntent(ctx context.Context, intent *domain.PaymentIntent) error
	GetPaymentIntent(ctx context.Context, id string) (*domain.PaymentIntent, error)
	ListPaymentIntents(ctx context.Context) ([]domain.PaymentIntent, error)
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

type QuoteRequest struct {
	USDAmount string
	Asset     string
}

type PaymentQuote struct {
	USDAmount   string    `json:"usd_amount"`
	Asset       string    `json:"asset"`
	Amount      string    `json:"amount"`
	PriceUSD    string    `json:"price_usd"`
	PriceSource string    `json:"price_source"`
	ExpiresAt   time.Time `json:"expires_at"`
}

type QuoteProvider interface {
	QuotePayment(ctx context.Context, request QuoteRequest) (*PaymentQuote, error)
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

type ULIDGenerator struct{}

var fallbackEntropyCounter uint64

func NewULIDGenerator() *ULIDGenerator {
	return &ULIDGenerator{}
}

func (g *ULIDGenerator) NewID(prefix string) string {
	return fmt.Sprintf("%s_%s", prefix, newULID(time.Now().UTC(), prefix))
}

func newULID(now time.Time, prefix string) string {
	var id [16]byte
	millis := uint64(now.UnixMilli())
	id[0] = byte(millis >> 40)
	id[1] = byte(millis >> 32)
	id[2] = byte(millis >> 24)
	id[3] = byte(millis >> 16)
	id[4] = byte(millis >> 8)
	id[5] = byte(millis)

	if _, err := rand.Read(id[6:]); err != nil {
		counter := atomic.AddUint64(&fallbackEntropyCounter, 1)
		digest := sha256.Sum256([]byte(fmt.Sprintf("%s:%d:%d", prefix, now.UnixNano(), counter)))
		copy(id[6:], digest[:10])
	}

	return encodeCrockfordBase32(id)
}

func encodeCrockfordBase32(id [16]byte) string {
	const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

	var out [26]byte
	var acc uint64
	bits := 2 // ULID uses 130 encoded bits: two leading zero bits plus 128 data bits.
	idx := 0
	for _, b := range id {
		acc = (acc << 8) | uint64(b)
		bits += 8
		for bits >= 5 {
			shift := bits - 5
			out[idx] = alphabet[(acc>>shift)&31]
			idx++
			if shift == 0 {
				acc = 0
			} else {
				acc &= (uint64(1) << shift) - 1
			}
			bits = shift
		}
	}

	return string(out[:])
}
