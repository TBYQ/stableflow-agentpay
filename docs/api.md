# API Draft

This document describes the intended API shape for the StableFlow AgentPay MVP.

The API is intentionally small for the hackathon version.

The first Go implementation exposes these endpoints through a standard HTTP adapter. The same application use cases can later be reused by a frontend, CLI, or Flare event listener.

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
  "status": "created"
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
  "amount": "1.00",
  "asset": "C2FLR",
  "chain_id": 114,
  "webhook_url": "https://example.com/webhooks/stableflow"
}
```

Response:

```json
{
  "id": "pi_001",
  "status": "pending_payment",
  "chain": "flare-coston2",
  "payment_contract": "0x0000000000000000000000000000000000000000",
  "payment_reference": "pi_001"
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
  "status": "paid",
  "tx_hash": "0xabc123",
  "ledger_entry_id": "le_001"
}
```

## Submit Transaction Hash

```text
POST /v1/payment-intents/{id}/transaction
```

This endpoint is useful for the first backend milestone if the backend is not yet running a full realtime Flare event subscription.

Request:

```json
{
  "tx_hash": "0xabc123"
}
```

Response:

```json
{
  "id": "pi_001",
  "status": "paid",
  "tx_hash": "0xabc123"
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
      "amount": "1.00",
      "asset": "C2FLR",
      "tx_hash": "0xabc123",
      "entry_type": "payment_confirmed"
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
      "id": "we_001",
      "payment_intent_id": "pi_001",
      "event_type": "payment.paid",
      "status": "delivered"
    }
  ]
}
```

## Generate Payment Summary

```text
POST /v1/payment-intents/{id}/summary
```

Response:

```json
{
  "payment_intent_id": "pi_001",
  "summary": "Payment pi_001 was confirmed on Flare Coston2 and unlocked the premium market report service."
}
```

## Webhook Payload

Example event:

```json
{
  "id": "evt_001",
  "type": "payment.paid",
  "created_at": "2026-07-04T12:00:00Z",
  "data": {
    "payment_intent_id": "pi_001",
    "service_request_id": "sr_001",
    "amount": "1.00",
    "asset": "C2FLR",
    "tx_hash": "0xabc123",
    "chain": "flare-coston2"
  }
}
```

Signature header:

```text
StableFlow-Signature: t=timestamp,v1=hmac_signature
```
