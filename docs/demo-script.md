# Demo Script

Target length: 2 to 3 minutes.

## 1. Opening

StableFlow AgentPay is AI-agent-ready payment infrastructure on Flare.

It helps AI agents and paid services use payment intents, on-chain confirmation, ledger reconciliation, and signed webhooks instead of relying on a raw wallet transfer.

## 2. Problem

AI agents can call tools and APIs, but paid access needs a payment operations layer.

For a real service provider, a payment flow needs:

- A payment intent
- A confirmed on-chain transaction
- A backend state transition
- A ledger entry
- A signed webhook
- A clear audit trail

## 3. Walkthrough

Show the service request:

```text
An AI agent requests access to a paid report or paid API.
```

Show the payment intent:

```text
StableFlow creates a payment intent for the request.
```

Show the Flare transaction:

```text
The user pays on Flare Coston2 through MetaMask.
```

Show backend confirmation:

```text
The backend detects the PaymentRecorded event and marks the intent as paid.
```

Show ledger:

```text
A ledger entry is created for reconciliation.
```

Show webhook:

```text
A signed webhook unlocks the paid service.
```

Show AI summary:

```text
The system generates a short payment summary for the service owner or agent.
```

## 4. Why Flare

Flare gives us an EVM-compatible testnet, so the MVP can use Solidity, MetaMask, and standard event listening.

Future versions can use Flare-native data features for verified prices or external state.

## 5. Close

StableFlow AgentPay turns a simple on-chain payment into a complete payment workflow for AI agents and paid services.

The MVP demonstrates the infrastructure pattern: intent, confirmation, reconciliation, webhook, and summary.
