package application

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"

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
	Quote           QuoteProvider
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
	quote           QuoteProvider
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
		quote:           deps.Quote,
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

func (s *Service) ListPaymentIntents(ctx context.Context) ([]domain.PaymentIntent, error) {
	return s.paymentIntents.ListPaymentIntents(ctx)
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
	intent, err := s.paymentIntents.GetPaymentIntent(ctx, cmd.PaymentIntentID)
	if err != nil {
		return nil, err
	}
	serviceRequest, err := s.serviceRequests.GetServiceRequest(ctx, intent.ServiceRequestID)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(intent.Asset, chainPayment.Asset) {
		return nil, fmt.Errorf("%w: chain event asset %s does not match payment intent asset %s", domain.ErrValidation, chainPayment.Asset, intent.Asset)
	}
	if intent.ChainID != chainPayment.ChainID {
		return nil, fmt.Errorf("%w: chain event chain id %d does not match payment intent chain id %d", domain.ErrValidation, chainPayment.ChainID, intent.ChainID)
	}
	if serviceRequest.ServiceID != chainPayment.ServiceID {
		return nil, fmt.Errorf("%w: chain event service id %s does not match payment intent service id %s", domain.ErrValidation, chainPayment.ServiceID, serviceRequest.ServiceID)
	}
	expectedAmount, err := paymentAmountBaseUnits(intent.Amount, intent.Asset)
	if err != nil {
		return nil, err
	}
	if chainPayment.AmountWei != expectedAmount.String() {
		return nil, fmt.Errorf("%w: chain event amount %s does not match payment intent amount %s", domain.ErrValidation, chainPayment.AmountWei, expectedAmount.String())
	}

	return s.ConfirmPayment(ctx, ConfirmPaymentCommand{
		PaymentIntentID: cmd.PaymentIntentID,
		TxHash:          chainPayment.TxHash,
	})
}

// paymentAmountBaseUnits converts the quoted decimal amount into the 18-decimal
// representation emitted by both native C2FLR and the Coston2 FXRP ERC-20.
func paymentAmountBaseUnits(amount, asset string) (*big.Int, error) {
	if !strings.EqualFold(asset, "C2FLR") && !strings.EqualFold(asset, "FXRP") {
		return nil, fmt.Errorf("%w: unsupported on-chain payment asset %s", domain.ErrValidation, asset)
	}
	decimalAmount, ok := new(big.Rat).SetString(strings.TrimSpace(amount))
	if !ok || decimalAmount.Sign() <= 0 {
		return nil, fmt.Errorf("%w: payment amount must be a positive decimal", domain.ErrValidation)
	}
	baseUnitScale := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	baseUnits := new(big.Rat).Mul(decimalAmount, new(big.Rat).SetInt(baseUnitScale))
	if !baseUnits.IsInt() {
		return nil, fmt.Errorf("%w: payment amount has more than 18 decimal places", domain.ErrValidation)
	}
	return baseUnits.Num(), nil
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

func (s *Service) QuotePayment(ctx context.Context, request QuoteRequest) (*PaymentQuote, error) {
	if s.quote == nil {
		return nil, fmt.Errorf("%w: quote provider is not configured", domain.ErrValidation)
	}
	return s.quote.QuotePayment(ctx, request)
}

type SeedDemoDataCommand struct {
	ServiceID       string
	Description     string
	USDAmount       string
	Amount          string
	Asset           string
	ChainID         int64
	PaymentContract string
	WebhookURL      string
	TxHash          string
}

func (s *Service) SeedDemoData(ctx context.Context, cmd SeedDemoDataCommand) (*ConfirmPaymentResult, error) {
	serviceID := firstNonEmpty(cmd.ServiceID, "premium-market-report")
	description := firstNonEmpty(cmd.Description, "Paid market report access for a merchant checkout demo")
	asset := firstNonEmpty(cmd.Asset, "C2FLR")
	amount := strings.TrimSpace(cmd.Amount)
	if amount == "" && strings.TrimSpace(cmd.USDAmount) != "" {
		quote, err := s.QuotePayment(ctx, QuoteRequest{
			USDAmount: cmd.USDAmount,
			Asset:     asset,
		})
		if err != nil {
			return nil, err
		}
		amount = quote.Amount
	}
	amount = firstNonEmpty(amount, "0.001")
	chainID := cmd.ChainID
	if chainID == 0 {
		chainID = 114
	}
	txHash := firstNonEmpty(cmd.TxHash, "0xseed000000000000000000000000000000000000000000000000000000000001")

	request, err := s.CreateServiceRequest(ctx, CreateServiceRequestCommand{
		ServiceID:   serviceID,
		Description: description,
	})
	if err != nil {
		return nil, err
	}

	intent, err := s.CreatePaymentIntent(ctx, CreatePaymentIntentCommand{
		ServiceRequestID: request.ID,
		Amount:           amount,
		Asset:            asset,
		ChainID:          chainID,
		PaymentContract:  cmd.PaymentContract,
		WebhookURL:       cmd.WebhookURL,
	})
	if err != nil {
		return nil, err
	}

	return s.ConfirmPayment(ctx, ConfirmPaymentCommand{
		PaymentIntentID: intent.ID,
		TxHash:          txHash,
	})
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

func firstNonEmpty(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}
