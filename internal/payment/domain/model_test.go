package domain

import (
	"errors"
	"testing"
	"time"
)

func TestPaymentIntentConfirm(t *testing.T) {
	now := time.Date(2026, 7, 5, 10, 0, 0, 0, time.UTC)
	intent, err := NewPaymentIntent("pi_001", "sr_001", "1.00", "C2FLR", 114, "0xcontract", "https://example.com/webhook", now)
	if err != nil {
		t.Fatalf("new payment intent: %v", err)
	}

	confirmedAt := now.Add(time.Minute)
	if err := intent.Confirm("0xabc123", confirmedAt); err != nil {
		t.Fatalf("confirm payment: %v", err)
	}

	if intent.Status != PaymentPaid {
		t.Fatalf("expected status %s, got %s", PaymentPaid, intent.Status)
	}
	if intent.TxHash != "0xabc123" {
		t.Fatalf("expected tx hash to be recorded")
	}
	if !intent.UpdatedAt.Equal(confirmedAt) {
		t.Fatalf("expected updated_at to move to confirmation time")
	}
}

func TestPaymentIntentConfirmIsIdempotentForSameTransaction(t *testing.T) {
	now := time.Date(2026, 7, 5, 10, 0, 0, 0, time.UTC)
	intent, err := NewPaymentIntent("pi_001", "sr_001", "1.00", "C2FLR", 114, "", "", now)
	if err != nil {
		t.Fatalf("new payment intent: %v", err)
	}

	if err := intent.Confirm("0xabc123", now); err != nil {
		t.Fatalf("first confirm: %v", err)
	}
	if err := intent.Confirm("0xabc123", now.Add(time.Minute)); err != nil {
		t.Fatalf("second confirm with same tx should be idempotent: %v", err)
	}
}

func TestPaymentIntentRejectsDifferentTransactionAfterPaid(t *testing.T) {
	now := time.Date(2026, 7, 5, 10, 0, 0, 0, time.UTC)
	intent, err := NewPaymentIntent("pi_001", "sr_001", "1.00", "C2FLR", 114, "", "", now)
	if err != nil {
		t.Fatalf("new payment intent: %v", err)
	}

	if err := intent.Confirm("0xabc123", now); err != nil {
		t.Fatalf("first confirm: %v", err)
	}

	err = intent.Confirm("0xdifferent", now.Add(time.Minute))
	if !errors.Is(err, ErrInvalidStatusTransition) {
		t.Fatalf("expected invalid transition error, got %v", err)
	}
}

func TestPaymentIntentRequiresTransactionHash(t *testing.T) {
	now := time.Date(2026, 7, 5, 10, 0, 0, 0, time.UTC)
	intent, err := NewPaymentIntent("pi_001", "sr_001", "1.00", "C2FLR", 114, "", "", now)
	if err != nil {
		t.Fatalf("new payment intent: %v", err)
	}

	err = intent.Confirm(" ", now)
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestLedgerEntryRequiresPaidPaymentIntent(t *testing.T) {
	now := time.Date(2026, 7, 5, 10, 0, 0, 0, time.UTC)
	intent, err := NewPaymentIntent("pi_001", "sr_001", "1.00", "C2FLR", 114, "", "", now)
	if err != nil {
		t.Fatalf("new payment intent: %v", err)
	}

	_, err = NewLedgerEntry("le_001", intent, now)
	if !errors.Is(err, ErrInvalidStatusTransition) {
		t.Fatalf("expected invalid transition error, got %v", err)
	}
}
