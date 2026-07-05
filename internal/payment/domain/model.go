package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrValidation              = errors.New("validation failed")
	ErrInvalidStatusTransition = errors.New("invalid payment status transition")
)

type ServiceRequestStatus string

const (
	ServiceRequestCreated ServiceRequestStatus = "created"
)

type PaymentStatus string

const (
	PaymentPending PaymentStatus = "pending_payment"
	PaymentPaid    PaymentStatus = "paid"
	PaymentFailed  PaymentStatus = "failed"
	PaymentExpired PaymentStatus = "expired"
)

type WebhookStatus string

const (
	WebhookDelivered WebhookStatus = "delivered"
	WebhookFailed    WebhookStatus = "failed"
)

type ServiceRequest struct {
	ID          string
	ServiceID   string
	Description string
	Status      ServiceRequestStatus
	CreatedAt   time.Time
}

func NewServiceRequest(id, serviceID, description string, now time.Time) (*ServiceRequest, error) {
	if strings.TrimSpace(id) == "" {
		return nil, fmt.Errorf("%w: service request id is required", ErrValidation)
	}
	if strings.TrimSpace(serviceID) == "" {
		return nil, fmt.Errorf("%w: service id is required", ErrValidation)
	}
	if strings.TrimSpace(description) == "" {
		return nil, fmt.Errorf("%w: description is required", ErrValidation)
	}

	return &ServiceRequest{
		ID:          strings.TrimSpace(id),
		ServiceID:   strings.TrimSpace(serviceID),
		Description: strings.TrimSpace(description),
		Status:      ServiceRequestCreated,
		CreatedAt:   now,
	}, nil
}

type PaymentIntent struct {
	ID               string
	ServiceRequestID string
	Amount           string
	Asset            string
	ChainID          int64
	Status           PaymentStatus
	PaymentContract  string
	WebhookURL       string
	TxHash           string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func NewPaymentIntent(id, serviceRequestID, amount, asset string, chainID int64, paymentContract, webhookURL string, now time.Time) (*PaymentIntent, error) {
	if strings.TrimSpace(id) == "" {
		return nil, fmt.Errorf("%w: payment intent id is required", ErrValidation)
	}
	if strings.TrimSpace(serviceRequestID) == "" {
		return nil, fmt.Errorf("%w: service request id is required", ErrValidation)
	}
	if strings.TrimSpace(amount) == "" {
		return nil, fmt.Errorf("%w: amount is required", ErrValidation)
	}
	if strings.TrimSpace(asset) == "" {
		return nil, fmt.Errorf("%w: asset is required", ErrValidation)
	}
	if chainID <= 0 {
		return nil, fmt.Errorf("%w: chain id must be positive", ErrValidation)
	}

	return &PaymentIntent{
		ID:               strings.TrimSpace(id),
		ServiceRequestID: strings.TrimSpace(serviceRequestID),
		Amount:           strings.TrimSpace(amount),
		Asset:            strings.TrimSpace(asset),
		ChainID:          chainID,
		Status:           PaymentPending,
		PaymentContract:  strings.TrimSpace(paymentContract),
		WebhookURL:       strings.TrimSpace(webhookURL),
		CreatedAt:        now,
		UpdatedAt:        now,
	}, nil
}

func (p *PaymentIntent) Confirm(txHash string, now time.Time) error {
	txHash = strings.TrimSpace(txHash)
	if txHash == "" {
		return fmt.Errorf("%w: transaction hash is required", ErrValidation)
	}

	if p.Status == PaymentPaid {
		if strings.EqualFold(p.TxHash, txHash) {
			return nil
		}
		return fmt.Errorf("%w: payment intent %s is already paid with a different transaction", ErrInvalidStatusTransition, p.ID)
	}

	if p.Status != PaymentPending {
		return fmt.Errorf("%w: payment intent %s cannot be confirmed from %s", ErrInvalidStatusTransition, p.ID, p.Status)
	}

	p.Status = PaymentPaid
	p.TxHash = txHash
	p.UpdatedAt = now
	return nil
}

type LedgerEntry struct {
	ID              string
	PaymentIntentID string
	TxHash          string
	Amount          string
	Asset           string
	ChainID         int64
	EntryType       string
	CreatedAt       time.Time
}

func NewLedgerEntry(id string, intent *PaymentIntent, now time.Time) (*LedgerEntry, error) {
	if strings.TrimSpace(id) == "" {
		return nil, fmt.Errorf("%w: ledger entry id is required", ErrValidation)
	}
	if intent == nil {
		return nil, fmt.Errorf("%w: payment intent is required", ErrValidation)
	}
	if intent.Status != PaymentPaid {
		return nil, fmt.Errorf("%w: ledger entry requires a paid payment intent", ErrInvalidStatusTransition)
	}

	return &LedgerEntry{
		ID:              strings.TrimSpace(id),
		PaymentIntentID: intent.ID,
		TxHash:          intent.TxHash,
		Amount:          intent.Amount,
		Asset:           intent.Asset,
		ChainID:         intent.ChainID,
		EntryType:       "payment_confirmed",
		CreatedAt:       now,
	}, nil
}

type WebhookEvent struct {
	ID              string
	PaymentIntentID string
	EventType       string
	DeliveryURL     string
	Signature       string
	Status          WebhookStatus
	CreatedAt       time.Time
	DeliveredAt     *time.Time
}

func NewWebhookEvent(id, paymentIntentID, eventType, deliveryURL, signature string, status WebhookStatus, now time.Time) (*WebhookEvent, error) {
	if strings.TrimSpace(id) == "" {
		return nil, fmt.Errorf("%w: webhook event id is required", ErrValidation)
	}
	if strings.TrimSpace(paymentIntentID) == "" {
		return nil, fmt.Errorf("%w: payment intent id is required", ErrValidation)
	}
	if strings.TrimSpace(eventType) == "" {
		return nil, fmt.Errorf("%w: event type is required", ErrValidation)
	}
	if status != WebhookDelivered && status != WebhookFailed {
		return nil, fmt.Errorf("%w: invalid webhook status", ErrValidation)
	}

	var deliveredAt *time.Time
	if status == WebhookDelivered {
		deliveredAt = &now
	}

	return &WebhookEvent{
		ID:              strings.TrimSpace(id),
		PaymentIntentID: strings.TrimSpace(paymentIntentID),
		EventType:       strings.TrimSpace(eventType),
		DeliveryURL:     strings.TrimSpace(deliveryURL),
		Signature:       strings.TrimSpace(signature),
		Status:          status,
		CreatedAt:       now,
		DeliveredAt:     deliveredAt,
	}, nil
}
