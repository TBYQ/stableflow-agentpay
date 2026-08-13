const apiBaseURL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080";

export type ServiceRequest = {
  id: string;
  agent_id: string;
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
  failure_reason?: string;
  created_at: string;
  updated_at: string;
};

export type LedgerEntry = {
  id: string;
  payment_intent_id: string;
  tx_hash: string;
  amount: string;
  asset: string;
  chain_id: number;
  entry_type: string;
  created_at: string;
};

export type WebhookEvent = {
  id: string;
  payment_intent_id: string;
  event_type: string;
  delivery_url: string;
  signature: string;
  status: string;
  created_at: string;
  delivered_at?: string;
};

export type PaymentQuote = {
  usd_amount: string;
  asset: string;
  amount: string;
  price_usd: string;
  price_source: string;
  feed_id?: string;
  price_updated_at: string;
  expires_at: string;
};

export type ConfirmPaymentResponse = {
  payment_intent: PaymentIntent;
  ledger_entry?: LedgerEntry;
  webhook_event?: WebhookEvent;
  summary: string;
};

type ListResponse<T> = {
  items: T[];
};

async function getJSON<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseURL}${path}`);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return response.json();
}

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
  agent_id: string;
  service_id: string;
  description: string;
}) {
  return postJSON<ServiceRequest>("/v1/service-requests", input);
}

export async function listServiceRequests() {
  const response = await getJSON<ListResponse<ServiceRequest>>("/v1/service-requests");
  return response.items;
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

export async function listPaymentIntents() {
  const response = await getJSON<ListResponse<PaymentIntent>>("/v1/payment-intents");
  return response.items;
}

export async function listLedgerEntries() {
  const response = await getJSON<ListResponse<LedgerEntry>>("/v1/ledger");
  return response.items;
}

export async function listWebhookEvents() {
  const response = await getJSON<ListResponse<WebhookEvent>>("/v1/webhook-events");
  return response.items;
}

export async function quotePayment(usdAmount: string, asset = "C2FLR") {
  const query = new URLSearchParams({ usd_amount: usdAmount, asset });
  return getJSON<PaymentQuote>(`/v1/quote?${query.toString()}`);
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

export async function recordPaymentSubmission(paymentIntentId: string, txHash: string) {
  return postJSON<{ payment_intent: PaymentIntent }>(`/v1/payment-intents/${paymentIntentId}/submitted-transaction`, {
    tx_hash: txHash
  });
}

export async function seedDemoData(input: {
  service_id: string;
  description: string;
  usd_amount: string;
  amount: string;
  asset: string;
  chain_id: number;
  payment_contract: string;
  webhook_url: string;
}) {
  return postJSON<ConfirmPaymentResponse>("/v1/demo/seed", input);
}
