# StableFlow AgentPay

StableFlow AgentPay is AI-agent-ready payment infrastructure on Flare.

It turns a raw on-chain payment into a complete payment operations flow:

```text
Payment Intent -> Flare Coston2 transaction -> receipt verification -> ledger entry -> signed webhook -> payment summary
```

The project is built for **Flare Summer Signal** and is positioned for the **Interoperable Asset Products** bounty. The target use case is simple: AI agents, SaaS APIs, and independent service providers need a reliable way to unlock paid digital services after an on-chain payment is confirmed.

## Why This Exists

Wallet transfers are not enough for real paid services.

A practical payment system also needs:

- A backend payment intent
- A clear status lifecycle
- On-chain transaction confirmation
- Idempotent state transitions
- Ledger reconciliation
- Signed webhook delivery
- A readable payment summary for operators or agents

StableFlow AgentPay focuses on this infrastructure layer instead of trying to build a complex DeFi protocol.

## Demo Flow

```text
AI agent requests access to a paid service
        |
        v
Go API creates a service request
        |
        v
Go API creates a payment intent
        |
        v
User pays with MetaMask on Flare Coston2
        |
        v
StableFlowPayment.sol emits PaymentRecorded
        |
        v
Go backend verifies the transaction receipt
        |
        v
Payment intent becomes paid
        |
        v
Ledger entry is created
        |
        v
Signed webhook is delivered or locally recorded
        |
        v
Payment summary is generated
```

## Current Implementation

This repository already includes a working first implementation of the core hackathon flow.

Implemented:

- DDD-oriented Go backend
- Payment intent domain model and status transition rules
- Service request, ledger entry, and webhook event models
- HTTP JSON API
- In-memory persistence adapter
- Local signed webhook adapter
- Real HTTP webhook sender
- Flare Coston2 transaction receipt verifier
- Solidity payment-recording contract
- Hardhat compile, test, deploy, and demo payment scripts
- Minimal React + Vite + MetaMask demo UI
- Unit tests for domain logic, application use cases, webhook delivery, chain log parsing, and Solidity contract behavior

Not implemented yet:

- Production database
- Auth or merchant accounts
- Mainnet deployment
- Background chain event listener
- Real AI API integration
- Production webhook retry queue
- Custody or key management

## Architecture Style

The Go backend follows a lightweight DDD and Clean Architecture style inspired by ThreeDotsLabs' Wild Workouts example.

The important rule is:

```text
Domain logic does not depend on HTTP, storage, Flare RPC, webhook clients, or frontend code.
```

Repository layout:

```text
cmd/stableflow-api/                 HTTP API entrypoint
internal/payment/domain/            Domain models and invariants
internal/payment/application/       Use cases and ports
internal/payment/adapters/memory/   In-memory persistence
internal/payment/adapters/webhook/  Local and HTTP webhook delivery
internal/payment/adapters/summary/  Template payment summary
internal/payment/adapters/chain/    Flare receipt verifier
internal/payment/ports/httpapi/     HTTP JSON adapter
contracts/                          Solidity contract and Hardhat scripts
web/                                MetaMask demo UI
docs/                               Product, architecture, API, demo, and plan docs
```

## Tech Stack

Backend:

- Go
- Standard library HTTP server
- DDD-style internal packages
- In-memory storage for the MVP
- JSON-RPC receipt verification for Flare Coston2

Blockchain:

- Solidity
- Hardhat
- Flare Coston2 Testnet
- Native test asset: C2FLR
- MetaMask

Frontend:

- React
- Vite
- TypeScript
- viem
- lucide-react

## Local Setup

### Backend

```bash
go run ./cmd/stableflow-api
```

Default backend URL:

```text
http://127.0.0.1:8080
```

Useful backend environment variables:

```text
STABLEFLOW_HTTP_ADDR=:8080
STABLEFLOW_WEBHOOK_SECRET=dev-secret
STABLEFLOW_WEBHOOK_DELIVERY=local
FLARE_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
STABLEFLOW_PAYMENT_CONTRACT=0x...
```

Webhook modes:

```text
local  -> sign and record the webhook event without sending HTTP
http   -> send the webhook payload to the configured webhook_url
```

### Contracts

```bash
cd contracts
npm install
cp .env.example .env
npm run compile
npm test
```

Deploy to Flare Coston2:

```bash
cd contracts
npm run deploy:coston2
```

Required for deployment:

```text
COSTON2_PRIVATE_KEY=your_test_wallet_private_key
```

Never commit private keys or seed phrases.

### Frontend

```bash
cd web
npm install
cp .env.example .env
npm run dev
```

Frontend environment:

```text
VITE_API_BASE_URL=http://127.0.0.1:8080
VITE_STABLEFLOW_PAYMENT_CONTRACT=0x...
```

## API Overview

Core endpoints:

```text
POST /v1/service-requests
POST /v1/payment-intents
GET  /v1/payment-intents/{id}
POST /v1/payment-intents/{id}/transaction
POST /v1/payment-intents/{id}/chain-transaction
POST /v1/payment-intents/{id}/summary
GET  /v1/ledger
GET  /v1/webhook-events
```

Two confirmation paths exist:

- `/transaction` trusts a submitted transaction hash and is useful for early local demos.
- `/chain-transaction` verifies the Flare Coston2 transaction receipt and parses the `PaymentRecorded` event.

## Tests

Backend:

```bash
go test ./...
```

Contracts:

```bash
cd contracts
npm test
```

Frontend:

```bash
cd web
npm run build
```

Latest local verification completed:

```text
go test ./...
contracts: npm test
web: npm run build
browser: frontend opened and Create Intent successfully called the Go API
```

## Documentation

- [Product Requirements](docs/product-requirements.md)
- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Demo Script](docs/demo-script.md)
- [Build Plan](docs/build-plan.md)
- [Submission TODO](docs/submission-todo.md)

## Hackathon Submission Story

StableFlow AgentPay is not only a payment button. It is a payment operations layer for AI agents and paid services.

The strongest judging points are:

- It uses Flare Coston2 for real testnet payment confirmation.
- It keeps the smart contract intentionally small.
- It shows serious backend infrastructure thinking: state machine, ledger, idempotency, webhook signatures, and clean architecture.
- It is easy to explain in a 2-3 minute demo.

## Safety

This project is for testnet demonstration only.

Do not commit:

- `.env`
- private keys
- wallet seed phrases
- API keys
- production secrets
