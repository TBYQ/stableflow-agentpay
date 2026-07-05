# Architecture

## Overview

StableFlow AgentPay is a backend-first payment infrastructure prototype for AI agents and paid services on Flare.

The system is intentionally split into three parts:

```text
Go backend        -> payment operations and business workflow
Solidity contract -> minimal on-chain payment recording
React UI          -> hackathon demo and MetaMask interaction
```

The product value is in the full payment workflow, not in a complex smart contract.

## DDD Style

The Go backend follows a lightweight DDD and Clean Architecture style inspired by the ThreeDotsLabs Wild Workouts example.

The dependency direction is:

```text
HTTP / adapters -> application -> domain
```

Domain code does not import HTTP, SQL, Flare RPC, webhook clients, or frontend code.

## System Flow

```text
AI Agent or Service Client
        |
        v
HTTP API: create service request
        |
        v
HTTP API: create payment intent
        |
        v
React UI calls MetaMask
        |
        v
Flare Coston2 transaction
        |
        v
StableFlowPayment.sol emits PaymentRecorded
        |
        v
HTTP API receives tx hash
        |
        v
Flare receipt verifier parses PaymentRecorded
        |
        v
Application confirms payment intent
        |
        v
Ledger entry is created
        |
        v
Signed webhook event is delivered or recorded
        |
        v
Payment summary is returned
```

## Backend Packages

### `cmd/stableflow-api`

Application entrypoint.

Responsibilities:

- Create in-memory store
- Configure webhook sender
- Configure Flare receipt verifier when a contract address is present
- Start HTTP server

### `internal/payment/domain`

Domain layer.

Responsibilities:

- ServiceRequest model
- PaymentIntent model
- LedgerEntry model
- WebhookEvent model
- Validation
- Payment status transition rules
- Idempotent payment confirmation behavior

This package is the center of the payment domain.

### `internal/payment/application`

Application layer.

Responsibilities:

- Create service requests
- Create payment intents
- Confirm payment from a submitted hash
- Confirm payment from a verified Flare receipt
- Create ledger entries
- Send or record webhook events
- Generate payment summaries

This package defines ports for repositories, webhook sender, chain verifier, summary generator, clock, and ID generator.

### `internal/payment/adapters/memory`

In-memory persistence adapter.

Used for the hackathon MVP so the local demo has no database requirement.

### `internal/payment/adapters/webhook`

Webhook adapter package.

Implementations:

- `LocalSigner`: signs and records webhook delivery without sending HTTP
- `HTTPSender`: sends a signed `payment.paid` webhook to a URL such as webhook.site

### `internal/payment/adapters/summary`

Template summary adapter.

This keeps the current demo deterministic. A real AI API can replace this adapter later.

### `internal/payment/adapters/chain/flare`

Flare receipt verifier.

Responsibilities:

- Call Flare Coston2 JSON-RPC
- Fetch transaction receipt by tx hash
- Parse `PaymentRecorded` ABI log data
- Return the chain payment data to the application layer

The current implementation verifies submitted transaction hashes. A background event listener can be added later.

### `internal/payment/ports/httpapi`

HTTP JSON adapter.

Responsibilities:

- Expose REST-style API endpoints
- Decode request bodies
- Call application use cases
- Return JSON responses
- Provide local-demo CORS headers

## Solidity Contract

Path:

```text
contracts/contracts/StableFlowPayment.sol
```

Responsibilities:

- Accept a native C2FLR payment
- Validate payment intent id and service id
- Prevent duplicate recording for the same payment intent
- Emit `PaymentRecorded`
- Expose `getPaymentByIntentId`

The contract avoids complex merchant, custody, and settlement logic because those are outside the MVP.

## Frontend

Path:

```text
web/
```

Responsibilities:

- Create service request through the Go API
- Create payment intent through the Go API
- Add or switch MetaMask to Flare Coston2
- Call `recordPayment` on the deployed contract
- Send the tx hash back to the backend
- Display payment intent state and summary

## State Machine

Current payment status flow:

```text
pending_payment
        |
        v
paid
```

Reserved states:

```text
failed
expired
```

The domain currently allows repeated confirmation with the same tx hash and rejects a different tx hash after the intent is already paid.

## Data Model

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
webhook_url
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

## Hackathon Architecture Principle

Keep the smart contract minimal and make the infrastructure workflow excellent.

The judging story:

```text
This is not only a wallet transfer.
This is a payment operations layer for AI agents and paid services.
```
