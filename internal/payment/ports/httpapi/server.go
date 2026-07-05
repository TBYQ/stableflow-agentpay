package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

type Server struct {
	service *application.Service
}

func NewServer(service *application.Service) *Server {
	return &Server{service: service}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/service-requests", s.handleServiceRequests)
	mux.HandleFunc("/v1/payment-intents", s.handlePaymentIntents)
	mux.HandleFunc("/v1/payment-intents/", s.handlePaymentIntentByID)
	mux.HandleFunc("/v1/ledger", s.handleLedger)
	mux.HandleFunc("/v1/webhook-events", s.handleWebhookEvents)
	return withCORS(mux)
}

type createServiceRequestBody struct {
	ServiceID   string `json:"service_id"`
	Description string `json:"description"`
}

func (s *Server) handleServiceRequests(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var body createServiceRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	request, err := s.service.CreateServiceRequest(r.Context(), application.CreateServiceRequestCommand{
		ServiceID:   body.ServiceID,
		Description: body.Description,
	})
	if err != nil {
		writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, request)
}

type createPaymentIntentBody struct {
	ServiceRequestID string `json:"service_request_id"`
	Amount           string `json:"amount"`
	Asset            string `json:"asset"`
	ChainID          int64  `json:"chain_id"`
	PaymentContract  string `json:"payment_contract"`
	WebhookURL       string `json:"webhook_url"`
}

func (s *Server) handlePaymentIntents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var body createPaymentIntentBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	intent, err := s.service.CreatePaymentIntent(r.Context(), application.CreatePaymentIntentCommand{
		ServiceRequestID: body.ServiceRequestID,
		Amount:           body.Amount,
		Asset:            body.Asset,
		ChainID:          body.ChainID,
		PaymentContract:  body.PaymentContract,
		WebhookURL:       body.WebhookURL,
	})
	if err != nil {
		writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, intent)
}

func (s *Server) handlePaymentIntentByID(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/payment-intents/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusNotFound, "payment intent not found")
		return
	}

	id := parts[0]
	if len(parts) == 1 && r.Method == http.MethodGet {
		intent, err := s.service.GetPaymentIntent(r.Context(), id)
		if err != nil {
			writeDomainError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, intent)
		return
	}

	if len(parts) == 2 && parts[1] == "transaction" && r.Method == http.MethodPost {
		s.handlePaymentTransaction(w, r, id)
		return
	}

	if len(parts) == 2 && parts[1] == "chain-transaction" && r.Method == http.MethodPost {
		s.handleChainPaymentTransaction(w, r, id)
		return
	}

	if len(parts) == 2 && parts[1] == "summary" && r.Method == http.MethodPost {
		summary, err := s.service.GeneratePaymentSummary(r.Context(), id)
		if err != nil {
			writeDomainError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{
			"payment_intent_id": id,
			"summary":           summary,
		})
		return
	}

	writeError(w, http.StatusNotFound, "route not found")
}

type submitTransactionBody struct {
	TxHash string `json:"tx_hash"`
}

func (s *Server) handlePaymentTransaction(w http.ResponseWriter, r *http.Request, id string) {
	var body submitTransactionBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	result, err := s.service.ConfirmPayment(r.Context(), application.ConfirmPaymentCommand{
		PaymentIntentID: id,
		TxHash:          body.TxHash,
	})
	if err != nil {
		writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"payment_intent": result.PaymentIntent,
		"ledger_entry":   result.LedgerEntry,
		"webhook_event":  result.WebhookEvent,
		"summary":        result.Summary,
	})
}

func (s *Server) handleChainPaymentTransaction(w http.ResponseWriter, r *http.Request, id string) {
	var body submitTransactionBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	result, err := s.service.ConfirmPaymentFromChain(r.Context(), application.ConfirmPaymentFromChainCommand{
		PaymentIntentID: id,
		TxHash:          body.TxHash,
	})
	if err != nil {
		writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"payment_intent": result.PaymentIntent,
		"ledger_entry":   result.LedgerEntry,
		"webhook_event":  result.WebhookEvent,
		"summary":        result.Summary,
	})
}

func (s *Server) handleLedger(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	entries, err := s.service.ListLedgerEntries(r.Context())
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": entries})
}

func (s *Server) handleWebhookEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	events, err := s.service.ListWebhookEvents(r.Context())
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": events})
}

func writeDomainError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, application.ErrNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, domain.ErrValidation):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, domain.ErrInvalidStatusTransition):
		writeError(w, http.StatusConflict, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, err.Error())
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The hackathon UI runs on Vite while the Go API runs on :8080.
		// Keep CORS permissive for the local demo; tighten this before any
		// production-style deployment.
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
