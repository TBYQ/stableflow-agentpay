package summary

import (
	"context"
	"fmt"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

type TemplateGenerator struct{}

func (TemplateGenerator) GeneratePaymentSummary(ctx context.Context, input application.PaymentSummaryInput) (string, error) {
	intent := input.PaymentIntent
	if intent.Status != domain.PaymentPaid {
		return fmt.Sprintf("Payment intent %s is currently %s and has not unlocked the service yet.", intent.ID, intent.Status), nil
	}

	return fmt.Sprintf(
		"Payment intent %s was confirmed on chain %d with transaction %s. The paid service is unlocked and a ledger entry is available for reconciliation.",
		intent.ID,
		intent.ChainID,
		intent.TxHash,
	), nil
}
