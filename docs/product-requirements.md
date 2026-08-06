# Product Requirements

## Product Name

StableFlow AgentPay

## One-line Pitch

Payment intent and webhook infrastructure on Flare for paid APIs, SaaS services, and AI agents.

中文注释：这句话是对外介绍用的“电梯 pitch”。中文意思是：StableFlow AgentPay 是面向 AI Agent 的 Flare 支付基础设施，能创建支付意图、验证链上交易、记账，并发送带签名的 webhook。

## Target Hackathon

Flare Summer Signal

Recommended bounty direction:

```text
Interoperable Asset Products
```

## Target Users

### AI Agent Builders

Builders who need agents to access paid APIs, datasets, tools, reports, or services after payment is confirmed.

中文注释：目标用户之一是做 AI Agent 的开发者。Agent 想调用付费 API 或付费数据时，需要一套“付款确认后再放行”的流程。

### SaaS API Providers

Small teams that want to sell paid API access with on-chain confirmation and webhook-based service unlocks.

中文注释：SaaS/API 团队可以用这个项目在链上收测试网付款，然后通过 webhook 触发自己的服务解锁逻辑。

### Freelancers and Service Providers

Independent builders who want testnet payment links, audit trails, and automatic confirmation for digital work.

中文注释：自由职业者或小团队也可以把它理解成“链上付款链接 + 后端确认 + 记录凭证”的原型。

## Problem Statement

AI agents can call tools, but paid access still needs a payment operations layer.

A wallet transfer alone does not provide enough infrastructure for a real service provider. The service provider still needs to know:

- Which payment belongs to which service request
- Whether the transaction is confirmed
- Whether the service should be unlocked
- Whether a ledger entry was created
- Whether a webhook was delivered
- What happened in plain language

StableFlow AgentPay fills this gap. AI agents are one possible user group, but the hackathon positioning is broader: a Flare payment operations layer for paid digital services.

中文注释：痛点不是“怎么转账”，而是“业务系统怎么知道这笔转账能对应到某个服务请求，并且安全地解锁服务”。这就是 payment intent、ledger、webhook 存在的原因。

## Product Scope

The MVP supports this end-to-end flow:

1. Quote a payable C2FLR amount for a paid digital service.
2. Create a service request for that service.
3. Create a payment intent for that service request.
4. Pay on Flare Coston2 through MetaMask.
5. Emit `PaymentRecorded` from a Solidity contract.
6. Verify the transaction receipt from the Go backend.
7. Mark the payment intent as paid.
8. Create a ledger entry.
9. Deliver or locally record a signed webhook event.
10. Unlock the paid service and generate a short payment summary.

中文注释：MVP 的范围就是这 9 步。超出这些的功能，比如登录、商户后台、数据库、正式资金托管，都不是当前版本要解决的。

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

中文注释：Payment Intent 可以理解成“后端生成的一张待付款单”。它把服务请求、金额、链 ID、合约地址、webhook 地址和交易哈希串起来。

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

中文注释：合约不做复杂资金管理，只负责收测试网 C2FLR、记录 payment intent，并发出事件。后端通过这个事件确认付款。

### Chain Receipt Verification

The backend verifies a submitted transaction hash by calling Flare Coston2 JSON-RPC:

```text
eth_getTransactionReceipt
```

It parses the `PaymentRecorded` log and only confirms the payment if the event `paymentIntentId` matches the backend payment intent.

中文注释：这里是项目的关键可信点。后端不是盲信前端传来的交易哈希，而是去 Flare Coston2 RPC 查交易收据，并确认事件里的 paymentIntentId 和后端记录一致。

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

中文注释：现在的 summary 是模板生成，不是真的调用 AI。这样 demo 稳定；以后可以把 summary adapter 换成真实 AI 接口。

### Merchant Console

The React UI now behaves like a small merchant payment console instead of a raw form. It shows checkout creation, quote results, wallet payment actions, service unlock state, payment intents, ledger entries, and webhook events.

### Demo Persistence

The backend can keep local demo state in a JSON file by setting:

```text
STABLEFLOW_STORE_PATH=data/stableflow.json
```

This is not a production database. It is a low-risk persistence adapter for hackathon demos.

## Non-goals

The MVP intentionally does not include:

- Mainnet funds
- Custody
- User login
- Merchant accounts
- Production SQL database
- Complex DeFi strategy
- Cross-chain settlement
- Real FTSO/FDC/FAssets settlement
- Full autonomous agent wallet management
- Production webhook retry queue

中文注释：Non-goals 是“有意不做”的部分。评审问到时可以说：为了 hackathon 聚焦，我们先证明支付确认和后端工作流，生产级账户、托管、数据库和重试队列后续再做。

## Success Criteria

The project is successful for the hackathon if a judge can see:

- Public GitHub repository
- Clear README and docs
- DDD-oriented Go backend
- Solidity contract with tests
- Flare Coston2 deployment path
- MetaMask merchant console
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

中文注释：这部分也可以当成简历项目亮点。重点不是 UI 多复杂，而是你展示了后端系统设计、链上集成、状态机、webhook 签名和账本思维。
