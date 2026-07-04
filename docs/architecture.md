# Architecture

## Overview

StableFlow AgentPay is a backend-first payment infrastructure prototype for AI agents and paid services on Flare.

The system uses a simple EVM contract for on-chain payment confirmation and a Go backend for the infrastructure logic around payment state, ledger reconciliation, webhook delivery, and AI summaries.

## System Flow

```text
AI Agent or Service Client
        |
        v
Go API: Create Service Request
        |
        v
Go API: Create Payment Intent
        |
        v
Flare Coston2 Payment Transaction
        |
        v
Solidity Contract Emits PaymentRecorded
        |
        v
Go Event Listener
        |
        v
Payment State Update
        |
        v
Ledger Entry
        |
        v
Signed Webhook Delivery
        |
        v
Paid Service Unlock
        |
        v
AI Payment Summary
```

## Components

### Go API Service

Responsibilities:

- Create agent service requests
- Create payment intents
- Expose payment status
- Store ledger entries
- Trigger webhook delivery
- Provide AI-generated summaries

### Solidity Payment Contract

Responsibilities:

- Accept or record a testnet payment
- Emit a payment event
- Include enough identifiers for backend reconciliation

The MVP contract should stay intentionally small. The product value comes from the complete payment workflow, not from a complex contract.

### Event Listener

Responsibilities:

- Connect to Flare Coston2 RPC
- Subscribe to or poll for payment events
- Match events to payment intents
- Apply idempotent payment status updates
- Create ledger entries

### Ledger

Responsibilities:

- Record confirmed payment facts
- Support demo-friendly payment history
- Make reconciliation visible to judges

### Webhook Delivery

Responsibilities:

- Build a webhook payload
- Sign the payload
- Send it to a mock paid service
- Track delivery status
- Support simple retry behavior

### Demo Web App

Responsibilities:

- Create a payment intent
- Show payment instructions
- Show transaction status
- Show ledger and webhook results

## Data Model Draft

### ServiceRequest

```text
id
service_id
description
status
created_at
```

### PaymentIntent

```text
id
service_request_id
amount
asset
chain_id
status
payment_contract
tx_hash
created_at
updated_at
```

### LedgerEntry

```text
id
payment_intent_id
tx_hash
amount
asset
chain_id
entry_type
created_at
```

### WebhookEvent

```text
id
payment_intent_id
event_type
delivery_url
signature
status
created_at
delivered_at
```

## State Machine

```text
created
  |
  v
pending_payment
  |
  v
paid
  |
  v
webhook_delivered
```

Failure paths:

```text
pending_payment -> expired
pending_payment -> failed
webhook_delivery -> webhook_failed
```

## Hackathon Architecture Principle

Keep the smart contract minimal and make the infrastructure workflow excellent.

The judging story should be:

```text
This is not only a wallet transfer.
This is a payment operations layer for AI agents and paid services.
```
