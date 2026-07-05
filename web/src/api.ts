const apiBaseURL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080";

export type ServiceRequest = {
  id: string;
  service_id: string;
  description: string;
  status: string;
  created_at: string;
};

export type PaymentIntent = {
  id: string;
  service_request_id: string;
  amount: string;
  asset: string;
  chain_id: number;
  status: string;
  payment_contract: string;
  webhook_url: string;
  tx_hash: string;
};

export type ConfirmPaymentResponse = {
  payment_intent: PaymentIntent;
  ledger_entry: unknown;
  webhook_event: unknown;
  summary: string;
};

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseURL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function createServiceRequest(input: {
  service_id: string;
  description: string;
}) {
  return postJSON<ServiceRequest>("/v1/service-requests", input);
}

export async function createPaymentIntent(input: {
  service_request_id: string;
  amount: string;
  asset: string;
  chain_id: number;
  payment_contract: string;
  webhook_url: string;
}) {
  return postJSON<PaymentIntent>("/v1/payment-intents", input);
}

export async function confirmPaymentWithChainReceipt(paymentIntentId: string, txHash: string) {
  return postJSON<ConfirmPaymentResponse>(`/v1/payment-intents/${paymentIntentId}/chain-transaction`, {
    tx_hash: txHash
  });
}

export async function confirmPaymentWithSubmittedHash(paymentIntentId: string, txHash: string) {
  return postJSON<ConfirmPaymentResponse>(`/v1/payment-intents/${paymentIntentId}/transaction`, {
    tx_hash: txHash
  });
}
