package webhook

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

type LocalSigner struct {
	secret string
}

func NewLocalSigner(secret string) LocalSigner {
	return LocalSigner{secret: secret}
}

func (s LocalSigner) SendPaymentPaid(ctx context.Context, message application.PaymentPaidMessage) (application.WebhookDelivery, error) {
	if message.WebhookURL == "" {
		return application.WebhookDelivery{
			Status: domain.WebhookFailed,
		}, fmt.Errorf("webhook url is empty")
	}

	payload := fmt.Sprintf(
		"%s|%s|%s|%s|%s|%d|%s",
		message.EventID,
		message.PaymentIntentID,
		message.ServiceRequestID,
		message.Amount,
		message.Asset,
		message.ChainID,
		message.TxHash,
	)

	mac := hmac.New(sha256.New, []byte(s.secret))
	mac.Write([]byte(payload))
	signature := hex.EncodeToString(mac.Sum(nil))

	return application.WebhookDelivery{
		DeliveryURL: message.WebhookURL,
		Signature:   "v1=" + signature,
		Status:      domain.WebhookDelivered,
	}, nil
}
