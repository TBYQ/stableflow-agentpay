# Hackathon Positioning Notes

These notes capture the current submission strategy for StableFlow AgentPay.

Last checked against the Flare Summer Signal page on 2026-08-05. The public page showed an August 14 final submission deadline in the body and a 2026-08-15 03:59 deadline in the header. Before final submission, use the live DoraHacks page as the source of truth.

## What The Prompt Is

Flare Summer Signal is not an AI Agent-only hackathon. The core ask is to build a real product, integration, or useful prototype on Flare.

The two main bounty directions are:

1. Interoperable Asset Products
2. Confidential Compute Apps

StableFlow AgentPay should target:

```text
Interoperable Asset Products
```

The reason is that this bounty includes products that help users move, access, manage, or use assets through Flare. Payment and merchant flows fit this direction.

中文理解：

```text
这个命题不是要求必须做 AI Agent。
更准确地说，它希望看到基于 Flare 的真实产品或集成。
我们适合报 Interoperable Asset Products，因为我们做的是 Flare 支付确认、商户/服务解锁、webhook 通知这一类支付流。
```

## Where Our Project Fits

StableFlow AgentPay is best described as:

```text
Flare payment intent and webhook infrastructure for paid APIs, SaaS services, and AI agents.
```

This is safer than saying the project is only for AI agents. AI agents are one possible user group, but the product value is broader:

- paid API access
- SaaS feature unlocks
- digital service payments
- merchant-style checkout flows
- agent or automation workflows that need payment confirmation

## What We Have Built

The current MVP proves this chain:

```text
Create payment intent
-> Pay with MetaMask on Flare Coston2
-> StableFlowPayment.sol records the payment
-> Go backend verifies the Coston2 transaction receipt
-> Payment intent becomes paid
-> Ledger entry is created
-> Signed webhook is delivered
-> Payment summary is returned
```

This is more than a payment button. A wallet transfer alone does not tell a backend which service should unlock, whether the transaction was verified, whether the ledger was updated, or whether downstream systems were notified.

## Is It Too Simple

It is a narrow MVP, but it is not uselessly simple.

The strong points are:

- real Coston2 testnet transaction flow
- deployed Solidity contract
- backend receipt verification instead of trusting the frontend
- payment intent status lifecycle
- ledger reconciliation
- signed webhook delivery
- working MetaMask demo
- clean Go backend architecture

The weak points are:

- current payment asset is native C2FLR, not FXRP or FAssets
- data is in memory, not in a production database
- no hosted public demo yet
- no hosted merchant dashboard yet
- no production webhook retry queue
- summary generation is template-based, not a real AI integration

Submission framing should be:

```text
This is a working Coston2 MVP of a payment operations layer.
It proves the full payment confirmation and service unlock flow.
Future work extends it to FXRP/FAssets, hosted deployment, production SQL storage, and production webhook reliability.
```

## What Not To Claim

Do not claim:

- this is a full DeFi protocol
- this already supports FXRP/FAssets payment settlement
- this is a production merchant processor
- this is an autonomous AI Agent
- this handles mainnet funds

Do claim:

- it is a Flare Coston2 payment infrastructure MVP
- it connects on-chain payment to backend business state
- it uses receipt verification, ledger entries, and signed webhooks
- it is designed so additional Flare assets can be added later

## AI Agent Wording

DoraHacks may ask:

```text
Is this BUIDL an AI Agent?
```

Recommended answer:

```text
No
```

Reason:

```text
StableFlow AgentPay is infrastructure that can be used by AI agents, SaaS services, and paid APIs. It is not itself an autonomous AI Agent.
```

Good external wording:

```text
StableFlow AgentPay is Flare payment intent and webhook infrastructure for paid APIs, SaaS services, and AI agents. It turns a Coston2 payment into a backend-verifiable payment flow with receipt verification, ledger reconciliation, signed webhooks, and service unlock summaries.
```

中文对外讲法：

```text
StableFlow AgentPay 是面向付费 API、SaaS 服务和 AI Agent 的 Flare 支付确认与 webhook 基础设施。
它把一笔 Coston2 链上付款，变成后端可以验证、入账、通知业务系统并解锁服务的完整支付流程。
```

## Best Next Improvements

If there is more time before submission, prioritize in this order:

1. Record a clear two to three minute demo video.
2. Show webhook.site receiving the signed `payment.paid` event.
3. Host the frontend and backend so judges can click a public demo.
4. Add a future-facing FXRP/FAssets payment path or documented interface.
5. Replace the static quote adapter with a real FTSO-backed quote adapter.
6. Add production SQL storage and webhook retry delivery.
7. Verify and link the deployed contract if the explorer supports it.

The best upgrade for competitiveness is not adding random features. The best upgrade is making the product feel like a real merchant/payment workflow on Flare.
