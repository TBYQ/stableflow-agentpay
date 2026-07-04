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

Builders who need a simple way for agents to access paid APIs, datasets, tools, or services after payment confirmation.

### SaaS API Providers

Small teams that want to sell paid API access with on-chain payment confirmation and webhook-based service unlocks.

### Freelancers and Service Providers

Independent builders who want payment links, audit trails, and automated confirmation for digital services.

## Problem Statement

AI agents can call tools and services, but paid access still needs a reliable payment workflow.

A usable agent payment system needs more than a wallet transfer. It needs a backend state machine, a ledger, transaction verification, retries, signed webhooks, and a clear audit trail.

StableFlow AgentPay provides that missing infrastructure layer.

## MVP Scope

The hackathon MVP should support this end-to-end flow:

1. Create an agent service request.
2. Create a payment intent for that request.
3. Pay through a Flare Coston2 transaction.
4. Confirm the payment from a smart contract event.
5. Mark the payment intent as paid.
6. Write a ledger entry.
7. Deliver a signed webhook to a mock service.
8. Generate a short AI payment summary.

## Core Features

### Payment Intent

Create and track payment intents with explicit lifecycle states.

Expected states:

```text
created
pending_payment
paid
failed
expired
```

### On-chain Payment Confirmation

Use a minimal Solidity contract on Flare Coston2 to record payment data and emit a payment event.

The event should include enough information for the backend to match it to a payment intent.

### Ledger Reconciliation

Create an immutable-style ledger entry after successful payment confirmation.

The MVP ledger can be simple, but it should show the habit of infrastructure thinking:

- Payment intent id
- Transaction hash
- Amount
- Currency or asset
- Chain id
- Timestamp
- Status

### Signed Webhooks

Deliver a webhook after payment is confirmed.

The webhook should include:

- Event id
- Event type
- Payment intent id
- Timestamp
- Signature

### AI Payment Summary

Generate a short summary for the user or service owner:

- What was paid
- Which service was unlocked
- Whether the transaction was confirmed
- Any visible risk or warning

## Non-goals

The MVP will not include:

- Mainnet funds
- Custody
- A full merchant dashboard
- Production compliance tooling
- Complex DeFi strategies
- Cross-chain settlement
- Full autonomous agent key management

## Success Criteria

The project is successful for the hackathon if a judge can see:

- A public GitHub repository with clear documentation
- A working local demo
- A deployed or deployable Flare Coston2 contract
- A payment intent created from the backend
- A testnet payment confirmation event
- A ledger entry created from the event
- A signed webhook delivery
- A short demo video walking through the flow

## Resume Value

This project should demonstrate:

- Backend system design
- Payment infrastructure thinking
- EVM integration
- Event-driven architecture
- Idempotency and reconciliation
- Webhook delivery
- Practical AI integration
