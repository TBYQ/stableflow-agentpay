# Build Plan

This document tracks what has been implemented and what remains before a polished Flare Summer Signal submission.

## Completed

### Documentation and Scope

Done:

- README positioned for Flare Summer Signal
- Product requirements
- Architecture document
- API document
- Demo script
- Build plan

### DDD Go Backend

Done:

- `cmd/stableflow-api`
- Domain models
- Application service
- Repository ports
- Webhook sender port
- Chain verifier port
- Summary generator port
- In-memory store
- HTTP API adapter
- Local CORS for Vite demo
- Unit tests

### Payment Workflow

Done:

- Create service request
- Create payment intent
- Confirm payment with submitted tx hash
- Confirm payment with verified Flare receipt
- Create ledger entry
- Create webhook event
- Generate payment summary

### Flare / Contract Integration

Done:

- `StableFlowPayment.sol`
- Native C2FLR payment recording
- `PaymentRecorded` event
- Duplicate payment intent protection
- Hardhat config for Coston2
- Deploy script
- Demo payment script
- Solidity tests

### Web Demo

Done:

- React + Vite + TypeScript UI
- MetaMask network setup for Coston2
- Create payment intent flow
- Call `recordPayment`
- Submit tx hash to backend
- Display payment state and summary

## Verified Locally

The following checks have passed locally:

```text
go test ./...
cd contracts && npm test
cd web && npm run build
browser opened the web UI and Create Intent successfully called the Go API
```

## Remaining Before Submission

### Deploy Contract To Coston2

Needs:

- Funded Coston2 test wallet
- `contracts/.env`
- `COSTON2_PRIVATE_KEY`

Command:

```bash
cd contracts
npm run deploy:coston2
```

Output to capture:

```text
StableFlowPayment deployed to: 0x...
```

### Wire Contract Address

Set backend:

```text
STABLEFLOW_PAYMENT_CONTRACT=0x...
```

Set frontend:

```text
VITE_STABLEFLOW_PAYMENT_CONTRACT=0x...
```

### Record Real Demo

Preferred demo flow:

```text
Create payment intent
Connect MetaMask
Pay on Flare Coston2
Confirm backend through /chain-transaction
Show ledger/webhook/summary
Open transaction in Coston2 Explorer
```

### Prepare DoraHacks Submission

Submission assets:

- GitHub repository
- Demo video
- Short description
- Target users
- How the project uses Flare
- Contract address
- Example transaction hash
- Short roadmap

## Optional Improvements

If time remains:

- Replace in-memory store with SQLite or PostgreSQL
- Add background event listener
- Add real AI summary adapter
- Add webhook retry queue
- Add frontend ledger/webhook tables
- Add contract address and transaction hash examples to README
- Add screenshots to docs

## Risk Control

If time becomes tight, keep the core demo:

- Public GitHub repository
- Go API
- Solidity contract
- MetaMask transaction
- Receipt verification
- Ledger entry
- Signed webhook event
- Demo video

Cut first:

- Production database
- Advanced UI polish
- Real AI integration
- Background listener
- Deployment automation
