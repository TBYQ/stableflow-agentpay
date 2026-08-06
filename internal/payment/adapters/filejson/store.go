package filejson

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

type Store struct {
	mu              sync.RWMutex
	path            string
	serviceRequests map[string]domain.ServiceRequest
	paymentIntents  map[string]domain.PaymentIntent
	ledgerEntries   map[string]domain.LedgerEntry
	webhookEvents   map[string]domain.WebhookEvent
}

type snapshot struct {
	ServiceRequests map[string]domain.ServiceRequest `json:"service_requests"`
	PaymentIntents  map[string]domain.PaymentIntent  `json:"payment_intents"`
	LedgerEntries   map[string]domain.LedgerEntry    `json:"ledger_entries"`
	WebhookEvents   map[string]domain.WebhookEvent   `json:"webhook_events"`
}

func NewStore(path string) (*Store, error) {
	store := &Store{
		path:            path,
		serviceRequests: map[string]domain.ServiceRequest{},
		paymentIntents:  map[string]domain.PaymentIntent{},
		ledgerEntries:   map[string]domain.LedgerEntry{},
		webhookEvents:   map[string]domain.WebhookEvent{},
	}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Store) SaveServiceRequest(ctx context.Context, request *domain.ServiceRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.serviceRequests[request.ID] = *request
	return s.persistLocked()
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

func (s *Store) ListServiceRequests(ctx context.Context) ([]domain.ServiceRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	requests := make([]domain.ServiceRequest, 0, len(s.serviceRequests))
	for _, request := range s.serviceRequests {
		requests = append(requests, request)
	}
	sort.Slice(requests, func(i, j int) bool {
		return requests[i].CreatedAt.After(requests[j].CreatedAt)
	})
	return requests, nil
}

func (s *Store) SavePaymentIntent(ctx context.Context, intent *domain.PaymentIntent) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.paymentIntents[intent.ID] = *intent
	return s.persistLocked()
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

func (s *Store) ListPaymentIntents(ctx context.Context) ([]domain.PaymentIntent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	intents := make([]domain.PaymentIntent, 0, len(s.paymentIntents))
	for _, intent := range s.paymentIntents {
		intents = append(intents, intent)
	}
	sort.Slice(intents, func(i, j int) bool {
		return intents[i].CreatedAt.After(intents[j].CreatedAt)
	})
	return intents, nil
}

func (s *Store) AppendLedgerEntry(ctx context.Context, entry *domain.LedgerEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.ledgerEntries[entry.ID] = *entry
	return s.persistLocked()
}

func (s *Store) ListLedgerEntries(ctx context.Context) ([]domain.LedgerEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries := make([]domain.LedgerEntry, 0, len(s.ledgerEntries))
	for _, entry := range s.ledgerEntries {
		entries = append(entries, entry)
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].CreatedAt.After(entries[j].CreatedAt)
	})
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
	return s.persistLocked()
}

func (s *Store) ListWebhookEvents(ctx context.Context) ([]domain.WebhookEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	events := make([]domain.WebhookEvent, 0, len(s.webhookEvents))
	for _, event := range s.webhookEvents {
		events = append(events, event)
	}
	sort.Slice(events, func(i, j int) bool {
		return events[i].CreatedAt.After(events[j].CreatedAt)
	})
	return events, nil
}

func (s *Store) load() error {
	body, err := os.ReadFile(s.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}

	var snap snapshot
	if err := json.Unmarshal(body, &snap); err != nil {
		return err
	}
	if snap.ServiceRequests != nil {
		s.serviceRequests = snap.ServiceRequests
	}
	if snap.PaymentIntents != nil {
		s.paymentIntents = snap.PaymentIntents
	}
	if snap.LedgerEntries != nil {
		s.ledgerEntries = snap.LedgerEntries
	}
	if snap.WebhookEvents != nil {
		s.webhookEvents = snap.WebhookEvents
	}
	return nil
}

func (s *Store) persistLocked() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}

	body, err := json.MarshalIndent(snapshot{
		ServiceRequests: s.serviceRequests,
		PaymentIntents:  s.paymentIntents,
		LedgerEntries:   s.ledgerEntries,
		WebhookEvents:   s.webhookEvents,
	}, "", "  ")
	if err != nil {
		return err
	}

	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, body, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func clone[T any](value *T) *T {
	copied := *value
	return &copied
}
