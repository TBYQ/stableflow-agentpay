# API

The Go backend exposes a small JSON API for the StableFlow AgentPay MVP.

Default local base URL:

```text
http://127.0.0.1:8080
```

## Create Service Request

```text
POST /v1/service-requests
```

Request:

```json
{
  "service_id": "premium-market-report",
  "description": "AI agent requests access to a paid market report"
}
```

Response:

```json
{
  "id": "sr_001",
  "service_id": "premium-market-report",
  "description": "AI agent requests access to a paid market report",
  "status": "created",
  "created_at": "2026-07-05T10:00:00Z"
}
```

## Create Payment Intent

```text
POST /v1/payment-intents
```

Request:

```json
{
  "service_request_id": "sr_001",
  "amount": "0.001",
  "asset": "C2FLR",
  "chain_id": 114,
  "payment_contract": "0x0000000000000000000000000000000000000000",
  "webhook_url": "https://webhook.site/your-demo-url"
}
```

Response:

```json
{
  "id": "pi_001",
  "service_request_id": "sr_001",
  "amount": "0.001",
  "asset": "C2FLR",
  "chain_id": 114,
  "status": "pending_payment",
  "payment_contract": "0x0000000000000000000000000000000000000000",
  "webhook_url": "https://webhook.site/your-demo-url",
  "tx_hash": "",
  "created_at": "2026-07-05T10:00:00Z",
  "updated_at": "2026-07-05T10:00:00Z"
}
```

## Get Payment Intent

```text
GET /v1/payment-intents/{id}
```

Response:

```json
{
  "id": "pi_001",
  "service_request_id": "sr_001",
  "amount": "0.001",
  "asset": "C2FLR",
  "chain_id": 114,
  "status": "paid",
  "payment_contract": "0x0000000000000000000000000000000000000000",
  "webhook_url": "https://webhook.site/your-demo-url",
  "tx_hash": "0xabc123",
  "created_at": "2026-07-05T10:00:00Z",
  "updated_at": "2026-07-05T10:03:00Z"
}
```

## Confirm Payment With Submitted Hash

```text
POST /v1/payment-intents/{id}/transaction
```

This endpoint trusts the submitted tx hash and is useful for early local demos.

Request:

```json
{
  "tx_hash": "0xabc123"
}
```

Response:

```json
{
  "payment_intent": {
    "id": "pi_001",
    "status": "paid",
    "tx_hash": "0xabc123"
  },
  "ledger_entry": {
    "id": "le_001",
    "payment_intent_id": "pi_001",
    "tx_hash": "0xabc123",
    "amount": "0.001",
    "asset": "C2FLR",
    "chain_id": 114,
    "entry_type": "payment_confirmed"
  },
  "webhook_event": {
    "id": "evt_001",
    "payment_intent_id": "pi_001",
    "event_type": "payment.paid",
    "status": "delivered"
  },
  "summary": "Payment intent pi_001 was confirmed on chain 114 with transaction 0xabc123..."
}
```

## Confirm Payment From Flare Receipt

```text
POST /v1/payment-intents/{id}/chain-transaction
```

This endpoint verifies the transaction receipt through Flare Coston2 JSON-RPC and parses the `PaymentRecorded` event emitted by `StableFlowPayment`.

The backend confirms the payment only if the event `paymentIntentId` matches the requested backend payment intent id.

Request:

```json
{
  "tx_hash": "0xabc123"
}
```

Response shape is the same as `/transaction`.

## Generate Payment Summary

```text
POST /v1/payment-intents/{id}/summary
```

Response:

```json
{
  "payment_intent_id": "pi_001",
  "summary": "Payment intent pi_001 was confirmed on chain 114 with transaction 0xabc123..."
}
```

## List Ledger Entries

```text
GET /v1/ledger
```

Response:

```json
{
  "items": [
    {
      "id": "le_001",
      "payment_intent_id": "pi_001",
      "tx_hash": "0xabc123",
      "amount": "0.001",
      "asset": "C2FLR",
      "chain_id": 114,
      "entry_type": "payment_confirmed",
      "created_at": "2026-07-05T10:03:00Z"
    }
  ]
}
```

## List Webhook Events

```text
GET /v1/webhook-events
```

Response:

```json
{
  "items": [
    {
      "id": "evt_001",
      "payment_intent_id": "pi_001",
      "event_type": "payment.paid",
      "delivery_url": "https://webhook.site/your-demo-url",
      "signature": "t=1783160000,v1=...",
      "status": "delivered",
      "created_at": "2026-07-05T10:03:00Z",
      "delivered_at": "2026-07-05T10:03:00Z"
    }
  ]
}
```

## Webhook Payload

When `STABLEFLOW_WEBHOOK_DELIVERY=http`, the backend sends:

```json
{
  "id": "evt_001",
  "type": "payment.paid",
  "created_at": "2026-07-05T10:03:00Z",
  "data": {
    "payment_intent_id": "pi_001",
    "service_request_id": "sr_001",
    "amount": "0.001",
    "asset": "C2FLR",
    "chain_id": 114,
    "tx_hash": "0xabc123",
    "chain": "flare-coston2"
  }
}
```

Headers:

```text
Content-Type: application/json
StableFlow-Event-ID: evt_001
StableFlow-Signature: t=timestamp,v1=hmac_signature
```

## Error Shape

Errors are returned as:

```json
{
  "error": "validation failed: service id is required"
}
```

Common status codes:

```text
400 -> validation error or bad request
404 -> missing entity
409 -> invalid payment status transition
500 -> unexpected server error
```
