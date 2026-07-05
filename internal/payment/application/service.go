package application

import (
	"context"
	"errors"
	"fmt"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

type Dependencies struct {
	ServiceRequests ServiceRequestRepository
	PaymentIntents  PaymentIntentRepository
	Ledger          LedgerRepository
	WebhookEvents   WebhookEventRepository
	WebhookSender   WebhookSender
	ChainVerifier   ChainPaymentVerifier
	Summary         SummaryGenerator
	Clock           Clock
	IDs             IDGenerator
}

type Service struct {
	serviceRequests ServiceRequestRepository
	paymentIntents  PaymentIntentRepository
	ledger          LedgerRepository
	webhookEvents   WebhookEventRepository
	webhookSender   WebhookSender
	chainVerifier   ChainPaymentVerifier
	summary         SummaryGenerator
	clock           Clock
	ids             IDGenerator
}

func NewService(deps Dependencies) *Service {
	return &Service{
		serviceRequests: deps.ServiceRequests,
		paymentIntents:  deps.PaymentIntents,
		ledger:          deps.Ledger,
		webhookEvents:   deps.WebhookEvents,
		webhookSender:   deps.WebhookSender,
		chainVerifier:   deps.ChainVerifier,
		summary:         deps.Summary,
		clock:           deps.Clock,
		ids:             deps.IDs,
	}
}

type CreateServiceRequestCommand struct {
	ServiceID   string
	Description string
}

func (s *Service) CreateServiceRequest(ctx context.Context, cmd CreateServiceRequestCommand) (*domain.ServiceRequest, error) {
	request, err := domain.NewServiceRequest(s.ids.NewID("sr"), cmd.ServiceID, cmd.Description, s.clock.Now())
	if err != nil {
		return nil, err
	}
	if err := s.serviceRequests.SaveServiceRequest(ctx, request); err != nil {
		return nil, err
	}
	return request, nil
}

type CreatePaymentIntentCommand struct {
	ServiceRequestID string
	Amount           string
	Asset            string
	ChainID          int64
	PaymentContract  string
	WebhookURL       string
}

func (s *Service) CreatePaymentIntent(ctx context.Context, cmd CreatePaymentIntentCommand) (*domain.PaymentIntent, error) {
	if _, err := s.serviceRequests.GetServiceRequest(ctx, cmd.ServiceRequestID); err != nil {
		return nil, err
	}

	intent, err := domain.NewPaymentIntent(
		s.ids.NewID("pi"),
		cmd.ServiceRequestID,
		cmd.Amount,
		cmd.Asset,
		cmd.ChainID,
		cmd.PaymentContract,
		cmd.WebhookURL,
		s.clock.Now(),
	)
	if err != nil {
		return nil, err
	}
	if err := s.paymentIntents.SavePaymentIntent(ctx, intent); err != nil {
		return nil, err
	}
	return intent, nil
}

func (s *Service) GetPaymentIntent(ctx context.Context, id string) (*domain.PaymentIntent, error) {
	return s.paymentIntents.GetPaymentIntent(ctx, id)
}

type ConfirmPaymentCommand struct {
	PaymentIntentID string
	TxHash          string
}

type ConfirmPaymentFromChainCommand struct {
	PaymentIntentID string
	TxHash          string
}

type ConfirmPaymentResult struct {
	PaymentIntent *domain.PaymentIntent
	LedgerEntry   *domain.LedgerEntry
	WebhookEvent  *domain.WebhookEvent
	Summary       string
	WebhookError  error
	SummaryError  error
}

func (s *Service) ConfirmPaymentFromChain(ctx context.Context, cmd ConfirmPaymentFromChainCommand) (*ConfirmPaymentResult, error) {
	if s.chainVerifier == nil {
		return nil, fmt.Errorf("%w: chain payment verifier is not configured", domain.ErrValidation)
	}

	chainPayment, err := s.chainVerifier.VerifyPayment(ctx, cmd.TxHash)
	if err != nil {
		return nil, err
	}
	if chainPayment.PaymentIntentID != cmd.PaymentIntentID {
		return nil, fmt.Errorf(
			"%w: chain event payment intent %s does not match requested payment intent %s",
			domain.ErrValidation,
			chainPayment.PaymentIntentID,
			cmd.PaymentIntentID,
		)
	}

	return s.ConfirmPayment(ctx, ConfirmPaymentCommand{
		PaymentIntentID: cmd.PaymentIntentID,
		TxHash:          chainPayment.TxHash,
	})
}

func (s *Service) ConfirmPayment(ctx context.Context, cmd ConfirmPaymentCommand) (*ConfirmPaymentResult, error) {
	now := s.clock.Now()

	intent, err := s.paymentIntents.GetPaymentIntent(ctx, cmd.PaymentIntentID)
	if err != nil {
		return nil, err
	}
	if err := intent.Confirm(cmd.TxHash, now); err != nil {
		return nil, err
	}
	if err := s.paymentIntents.SavePaymentIntent(ctx, intent); err != nil {
		return nil, err
	}

	ledgerEntry, err := s.ledger.FindLedgerEntryByPaymentIntent(ctx, intent.ID)
	if err != nil {
		if !errors.Is(err, ErrNotFound) {
			return nil, err
		}

		ledgerEntry, err = domain.NewLedgerEntry(s.ids.NewID("le"), intent, now)
		if err != nil {
			return nil, err
		}
		if err := s.ledger.AppendLedgerEntry(ctx, ledgerEntry); err != nil {
			return nil, err
		}
	}

	summaryText, summaryErr := s.summary.GeneratePaymentSummary(ctx, PaymentSummaryInput{
		PaymentIntent: *intent,
		LedgerEntry:   ledgerEntry,
	})

	eventID := s.ids.NewID("evt")
	delivery, webhookErr := s.webhookSender.SendPaymentPaid(ctx, PaymentPaidMessage{
		EventID:          eventID,
		PaymentIntentID:  intent.ID,
		ServiceRequestID: intent.ServiceRequestID,
		Amount:           intent.Amount,
		Asset:            intent.Asset,
		ChainID:          intent.ChainID,
		TxHash:           intent.TxHash,
		WebhookURL:       intent.WebhookURL,
		CreatedAt:        now,
	})
	if delivery.Status == "" {
		delivery.Status = domain.WebhookFailed
	}

	webhookEvent, err := domain.NewWebhookEvent(
		eventID,
		intent.ID,
		"payment.paid",
		delivery.DeliveryURL,
		delivery.Signature,
		delivery.Status,
		now,
	)
	if err != nil {
		return nil, err
	}
	if err := s.webhookEvents.SaveWebhookEvent(ctx, webhookEvent); err != nil {
		return nil, err
	}

	return &ConfirmPaymentResult{
		PaymentIntent: intent,
		LedgerEntry:   ledgerEntry,
		WebhookEvent:  webhookEvent,
		Summary:       summaryText,
		WebhookError:  webhookErr,
		SummaryError:  summaryErr,
	}, nil
}

func (s *Service) ListLedgerEntries(ctx context.Context) ([]domain.LedgerEntry, error) {
	return s.ledger.ListLedgerEntries(ctx)
}

func (s *Service) ListWebhookEvents(ctx context.Context) ([]domain.WebhookEvent, error) {
	return s.webhookEvents.ListWebhookEvents(ctx)
}

func (s *Service) GeneratePaymentSummary(ctx context.Context, paymentIntentID string) (string, error) {
	intent, err := s.paymentIntents.GetPaymentIntent(ctx, paymentIntentID)
	if err != nil {
		return "", err
	}

	ledgerEntry, err := s.ledger.FindLedgerEntryByPaymentIntent(ctx, paymentIntentID)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return "", err
	}
	if errors.Is(err, ErrNotFound) {
		ledgerEntry = nil
	}

	return s.summary.GeneratePaymentSummary(ctx, PaymentSummaryInput{
		PaymentIntent: *intent,
		LedgerEntry:   ledgerEntry,
	})
}
