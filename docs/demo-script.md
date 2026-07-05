# Demo Script

Target length: 2 to 3 minutes.

## 1. Opening

StableFlow AgentPay is AI-agent-ready payment infrastructure on Flare.

It helps AI agents and paid services use payment intents, Flare Coston2 transaction confirmation, ledger reconciliation, signed webhooks, and payment summaries.

## 2. Problem

AI agents can call tools and APIs, but paid access needs more than a wallet transfer.

A service provider needs to know:

- What was requested
- Which payment intent was created
- Which chain transaction confirmed the payment
- Whether a ledger entry was created
- Whether the paid service was unlocked
- Whether a webhook was signed and delivered

## 3. Show The Architecture

Point to the repository structure:

```text
Go backend: DDD payment workflow
Solidity: minimal on-chain payment recording
React UI: MetaMask demo
```

Explain that the smart contract is intentionally small and the backend owns the payment operations workflow.

## 4. Live Walkthrough

### Step 1: Create payment intent

Open the web UI and click:

```text
Create Intent
```

Explain:

```text
The backend creates a service request and a payment intent. The payment intent starts as pending_payment.
```

### Step 2: Connect wallet

Click:

```text
Connect MetaMask
```

Explain:

```text
The UI asks MetaMask to add or switch to Flare Coston2, chain id 114.
```

### Step 3: Pay on Flare Coston2

Click:

```text
Pay on Flare
```

Explain:

```text
The user sends a native C2FLR testnet payment to StableFlowPayment.sol.
The contract emits PaymentRecorded with the backend paymentIntentId.
```

### Step 4: Confirm backend

Click:

```text
Confirm Backend
```

Explain:

```text
The backend fetches the transaction receipt from Flare Coston2, parses PaymentRecorded, validates the payment intent id, and marks the intent as paid.
```

### Step 5: Show results

Point to:

- Payment intent status
- Transaction hash
- Ledger entry
- Webhook event
- Payment summary
- Coston2 explorer link

## 5. Closing

StableFlow AgentPay turns a simple on-chain payment into a payment operations layer for AI agents and paid services.

The MVP demonstrates:

- Payment intents
- Flare Coston2 transaction confirmation
- Ledger reconciliation
- Signed webhook delivery
- Clean backend architecture

## Backup Demo Path

If the testnet, wallet, or faucet is unavailable during recording, use the local confirmation endpoint:

```text
POST /v1/payment-intents/{id}/transaction
```

This still demonstrates the backend payment workflow, but the preferred demo is `/chain-transaction` with a real Flare Coston2 receipt.
