package memory

import (
	"context"
	"sync"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

type Store struct {
	mu              sync.RWMutex
	serviceRequests map[string]domain.ServiceRequest
	paymentIntents  map[string]domain.PaymentIntent
	ledgerEntries   map[string]domain.LedgerEntry
	webhookEvents   map[string]domain.WebhookEvent
}

func NewStore() *Store {
	return &Store{
		serviceRequests: map[string]domain.ServiceRequest{},
		paymentIntents:  map[string]domain.PaymentIntent{},
		ledgerEntries:   map[string]domain.LedgerEntry{},
		webhookEvents:   map[string]domain.WebhookEvent{},
	}
}

func (s *Store) SaveServiceRequest(ctx context.Context, request *domain.ServiceRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.serviceRequests[request.ID] = *request
	return nil
}

func (s *Store) GetServiceRequest(ctx context.Context, id string) (*domain.ServiceRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	request, ok := s.serviceRequests[id]
	if !ok {
		return nil, application.NotFound("service_request", id)
	}
	return clone(&request), nil
}

func (s *Store) SavePaymentIntent(ctx context.Context, intent *domain.PaymentIntent) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.paymentIntents[intent.ID] = *intent
	return nil
}

func (s *Store) GetPaymentIntent(ctx context.Context, id string) (*domain.PaymentIntent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	intent, ok := s.paymentIntents[id]
	if !ok {
		return nil, application.NotFound("payment_intent", id)
	}
	return clone(&intent), nil
}

func (s *Store) AppendLedgerEntry(ctx context.Context, entry *domain.LedgerEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.ledgerEntries[entry.ID] = *entry
	return nil
}

func (s *Store) ListLedgerEntries(ctx context.Context) ([]domain.LedgerEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries := make([]domain.LedgerEntry, 0, len(s.ledgerEntries))
	for _, entry := range s.ledgerEntries {
		entries = append(entries, entry)
	}
	return entries, nil
}

func (s *Store) FindLedgerEntryByPaymentIntent(ctx context.Context, paymentIntentID string) (*domain.LedgerEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, entry := range s.ledgerEntries {
		if entry.PaymentIntentID == paymentIntentID {
			return clone(&entry), nil
		}
	}
	return nil, application.ErrNotFound
}

func (s *Store) SaveWebhookEvent(ctx context.Context, event *domain.WebhookEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.webhookEvents[event.ID] = *event
	return nil
}

func (s *Store) ListWebhookEvents(ctx context.Context) ([]domain.WebhookEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	events := make([]domain.WebhookEvent, 0, len(s.webhookEvents))
	for _, event := range s.webhookEvents {
		events = append(events, event)
	}
	return events, nil
}

func clone[T any](value *T) *T {
	copied := *value
	return &copied
}
