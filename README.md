# StableFlow AgentPay

StableFlow AgentPay is AI-agent-ready payment infrastructure on Flare.

It enables AI agents, SaaS APIs, and small service providers to accept on-chain payments, verify payment status, reconcile ledger entries, and unlock paid services through signed webhooks.

The first hackathon target is **Flare Summer Signal**, with the project positioned for the **Interoperable Asset Products** bounty.

## Problem

AI agents can call tools, APIs, and real-world services, but paid service access still needs a reliable payment layer.

Most teams can build a checkout page, but production-style payment infrastructure also needs:

- Payment intents
- On-chain payment confirmation
- Idempotent status transitions
- Ledger reconciliation
- Signed webhook delivery
- Audit-friendly payment summaries

StableFlow AgentPay focuses on that infrastructure layer.

## Product Idea

StableFlow AgentPay acts like a lightweight Stripe-style payment backend for AI agents and paid services on Flare.

An agent or application creates a payment intent. A user pays on Flare Coston2. A smart contract emits a payment event. The backend listens for that event, updates the payment state, writes a ledger entry, and sends a signed webhook to unlock the paid service.

## Core Flow

1. An AI agent requests access to a paid service.
2. StableFlow creates a payment intent.
3. The user pays through MetaMask on Flare Coston2.
4. A Solidity contract emits a payment confirmation event.
5. The Go backend listens for the event and updates payment status.
6. A ledger entry is created.
7. A signed webhook unlocks the service.
8. AI generates a payment explanation and risk summary.

## Planned MVP

- Create payment intents through a Go API
- Generate a Flare Coston2 payment target
- Record payments through a minimal Solidity contract
- Listen for EVM events from the backend
- Store payment and ledger state
- Deliver signed webhooks to a mock paid service
- Provide an AI-generated payment status summary
- Include a short demo video and clear submission documentation

## Why Flare

Flare is an EVM-compatible Layer 1, which lets this project use common Ethereum tooling while still targeting the Flare ecosystem.

The MVP will use standard EVM primitives first:

- Solidity smart contract
- Flare Coston2 testnet
- MetaMask
- Hardhat or Foundry
- EVM event listener

Future versions can add Flare-native data features such as FTSO or Flare Data Connector when the product needs verified price data or external state.

## Tech Stack

- Go
- PostgreSQL or SQLite for the MVP
- Solidity
- Hardhat or Foundry
- Flare Coston2 Testnet
- MetaMask
- Ethers.js or Viem
- AI API for payment summaries
- Signed webhooks
- Docker

## Repository Plan

```text
api/                 Go backend service
contracts/           Solidity contracts and deployment scripts
web/                 Minimal demo UI
docs/                Product, architecture, API, and demo docs
```

## Documentation

- [Product Requirements](docs/product-requirements.md)
- [Architecture](docs/architecture.md)
- [API Draft](docs/api.md)
- [Demo Script](docs/demo-script.md)
- [Build Plan](docs/build-plan.md)

## Hackathon Focus

- AI agent payments
- Merchant and paid API flows
- Interoperable asset products on Flare
- On-chain payment confirmation
- Backend ledger reconciliation
- Signed webhook delivery
- Developer-friendly payment infrastructure

## Current Status

Planning and documentation phase.

No production funds are involved. The MVP is designed for testnet demonstration only.
