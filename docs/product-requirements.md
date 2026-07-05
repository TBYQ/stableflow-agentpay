# Product Requirements

## Product Name

StableFlow AgentPay

## One-line Pitch

AI-agent-ready payment infrastructure on Flare with payment intents, on-chain confirmation, ledger reconciliation, and signed webhooks.

## Target Hackathon

Flare Summer Signal

Recommended bounty direction:

```text
Interoperable Asset Products
```

## Target Users

### AI Agent Builders

Builders who need agents to access paid APIs, datasets, tools, reports, or services after payment is confirmed.

### SaaS API Providers

Small teams that want to sell paid API access with on-chain confirmation and webhook-based service unlocks.

### Freelancers and Service Providers

Independent builders who want testnet payment links, audit trails, and automatic confirmation for digital work.

## Problem Statement

AI agents can call tools, but paid access still needs a payment operations layer.

A wallet transfer alone does not provide enough infrastructure for a real service provider. The service provider still needs to know:

- Which payment belongs to which service request
- Whether the transaction is confirmed
- Whether the service should be unlocked
- Whether a ledger entry was created
- Whether a webhook was delivered
- What happened in plain language

StableFlow AgentPay fills this gap.

## Product Scope

The MVP supports this end-to-end flow:

1. Create a service request for a paid digital service.
2. Create a payment intent for that service request.
3. Pay on Flare Coston2 through MetaMask.
4. Emit `PaymentRecorded` from a Solidity contract.
5. Verify the transaction receipt from the Go backend.
6. Mark the payment intent as paid.
7. Create a ledger entry.
8. Deliver or locally record a signed webhook event.
9. Generate a short payment summary.

## Implemented Features

### Service Request

Represents a paid service request initiated by an agent, user, or client application.

Current fields:

```text
id
service_id
description
status
created_at
```

### Payment Intent

Represents the payable object that ties backend state to an on-chain transaction.

Current statuses:

```text
pending_payment
paid
failed
expired
```

Current behavior:

- Created through the Go API
- Validates amount, asset, chain id, and service request
- Can be confirmed once with a transaction hash
- Allows idempotent confirmation with the same transaction hash
- Rejects confirmation with a different transaction after paid

### On-chain Payment Recording

The Solidity contract `StableFlowPayment` accepts native C2FLR payments and emits:

```text
PaymentRecorded(paymentIntentHash, paymentIntentId, payer, amount, asset, serviceId, chainId, recordedAt)
```

The contract prevents duplicate recording for the same `paymentIntentId`.

### Chain Receipt Verification

The backend verifies a submitted transaction hash by calling Flare Coston2 JSON-RPC:

```text
eth_getTransactionReceipt
```

It parses the `PaymentRecorded` log and only confirms the payment if the event `paymentIntentId` matches the backend payment intent.

### Ledger Reconciliation

After payment confirmation, the backend writes a ledger entry with:

```text
payment_intent_id
tx_hash
amount
asset
chain_id
entry_type
created_at
```

### Signed Webhooks

After payment confirmation, the backend creates a `payment.paid` webhook event.

Supported modes:

```text
local  -> sign and record the event without sending HTTP
http   -> send a signed HTTP POST to webhook_url
```

### Payment Summary

The current implementation uses a template-based summary generator. A real AI API can replace this adapter later without changing the domain model.

## Non-goals

The MVP intentionally does not include:

- Mainnet funds
- Custody
- User login
- Merchant accounts
- Production database
- Complex DeFi strategy
- Cross-chain settlement
- Full autonomous agent wallet management
- Production webhook retry queue

## Success Criteria

The project is successful for the hackathon if a judge can see:

- Public GitHub repository
- Clear README and docs
- DDD-oriented Go backend
- Solidity contract with tests
- Flare Coston2 deployment path
- MetaMask demo UI
- Payment intent lifecycle
- Receipt-based payment confirmation
- Ledger entry creation
- Signed webhook event
- Payment summary
- Short demo video

## Resume Value

This project demonstrates:

- Backend system design
- Payment infrastructure thinking
- DDD and Clean Architecture in Go
- EVM integration
- Flare Coston2 transaction verification
- Webhook signatures
- Ledger reconciliation
- Practical AI-agent payment workflow
