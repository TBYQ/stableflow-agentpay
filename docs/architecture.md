# Architecture

## Overview

StableFlow AgentPay is a backend-first payment infrastructure prototype for paid APIs, SaaS services, AI agents, and other digital services on Flare.

The system is intentionally split into three parts:

```text
Go backend        -> payment operations and business workflow
Solidity contract -> minimal on-chain payment recording
React UI          -> merchant console and MetaMask interaction
```

The product value is in the full payment workflow, not in a complex smart contract.

中文注释：这个架构的重点是“后端支付工作流优先”。合约只做最小记录，真正体现工程能力的是 Go 后端如何创建支付意图、验证交易、更新状态、记账和发 webhook。

## DDD Style

The Go backend follows a lightweight DDD and Clean Architecture style inspired by the ThreeDotsLabs Wild Workouts example.

The dependency direction is:

```text
HTTP / adapters -> application -> domain
```

Domain code does not import HTTP, SQL, Flare RPC, webhook clients, or frontend code.

中文注释：依赖方向要从外往里走。HTTP、内存存储、Flare RPC、webhook 都是外部 adapter；domain 是最核心的业务规则，不应该知道外面用了什么框架或服务。

## System Flow

中文注释：下面是完整业务链路。理解这张图之后，再看包结构会容易很多。

```text
Merchant or Service Client
        |
        v
HTTP API: quote C2FLR amount
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
Paid service is unlocked and summarized
```

## Backend Packages

### `cmd/stableflow-api`

Application entrypoint.

Responsibilities:

- Create in-memory or JSON file store
- Configure webhook sender
- Configure demo quote provider
- Configure Flare receipt verifier when a contract address is present
- Start HTTP server

中文注释：这是程序启动入口，负责把 store、service、webhook、chain verifier、HTTP server 组装起来。

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

中文注释：domain 是最值得优先读的包。支付状态、字段校验、重复确认同一笔交易是否允许，都应该在这里能看到。

### `internal/payment/application`

Application layer.

Responsibilities:

- Create service requests
- Quote payment amounts
- Create payment intents
- Confirm payment from a submitted hash
- Confirm payment from a verified Flare receipt
- Create ledger entries
- Send or record webhook events
- Generate payment summaries

This package defines ports for repositories, webhook sender, chain verifier, quote provider, summary generator, clock, and ID generator.

中文注释：application 层负责“编排流程”。它不关心数据具体存哪里、webhook 怎么发、链上收据怎么查，只通过接口调用这些能力。

### `internal/payment/adapters/memory`

In-memory persistence adapter.

Used for the hackathon MVP so the local demo has no database requirement.

中文注释：这里是临时内存存储。重启后数据会丢，但 demo 简单、依赖少。以后可以换成 SQLite/PostgreSQL。

### `internal/payment/adapters/filejson`

Optional JSON file persistence adapter.

It is enabled with:

```text
STABLEFLOW_STORE_PATH=data/stableflow.json
```

This keeps payment intents, ledger entries, and webhook events across local demo restarts without adding a SQL dependency.

### `internal/payment/adapters/quote`

Demo quote adapter.

The current provider returns a static FTSO-style quote for USD-to-C2FLR display. A real FTSO adapter can replace it later without changing domain logic.

### `internal/payment/adapters/webhook`

Webhook adapter package.

Implementations:

- `LocalSigner`: signs and records webhook delivery without sending HTTP
- `HTTPSender`: sends a signed `payment.paid` webhook to a URL such as webhook.site

中文注释：`LocalSigner` 适合本地快速演示；`HTTPSender` 适合录视频时把 webhook 发到 webhook.site 展示。

### `internal/payment/adapters/summary`

Template summary adapter.

This keeps the current demo deterministic. A real AI API can replace this adapter later.

中文注释：summary 现在是模板，主要为了稳定。以后要接 AI，只需要替换这个 adapter，不需要重写 domain。

### `internal/payment/adapters/chain/flare`

Flare receipt verifier.

Responsibilities:

- Call Flare Coston2 JSON-RPC
- Fetch transaction receipt by tx hash
- Parse `PaymentRecorded` ABI log data
- Return the chain payment data to the application layer

The current implementation verifies submitted transaction hashes. A background event listener can be added later.

中文注释：当前模式是“前端/用户提交 tx hash，后端再去查收据”。更生产化的做法是加后台监听器，自动扫链上事件。

### `internal/payment/ports/httpapi`

HTTP JSON adapter.

Responsibilities:

- Expose REST-style API endpoints
- Decode request bodies
- Call application use cases
- Return JSON responses
- Provide local-demo CORS headers

中文注释：HTTP 层只做请求/响应适配，不应该把复杂支付逻辑写在 handler 里。

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

中文注释：合约保持小是刻意设计。它不做商户账户、托管、结算等复杂功能，避免 MVP 变成大而难讲的 DeFi 项目。

## Frontend

Path:

```text
web/
```

Responsibilities:

- Request a demo USD-to-C2FLR quote
- Create service request through the Go API
- Create payment intent through the Go API
- Add or switch MetaMask to Flare Coston2
- Call `recordPayment` on the deployed contract
- Send the tx hash back to the backend
- Display checkout status, ledger entries, webhook events, and service unlock result

中文注释：前端主要服务 demo，不是完整商户后台。它负责把用户操作串起来，让评委能看到完整付款和确认结果。

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

中文注释：这叫幂等性。用户重复点确认或网络重试时，同一个 tx hash 不会造成重复入账；但已支付后换另一个 tx hash 会被拒绝。

## Data Model

中文注释：下面是当前核心数据结构。读代码时可以把它们当成系统里的几张“概念表”。

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

Implementation note: ids use a type prefix plus ULID-style value, for example `pi_01K...`, instead of restart-prone sequential ids.

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

中文注释：参赛叙事可以围绕这句话讲：合约小，后端流程完整，这样更容易让评委理解项目价值。

The judging story:

```text
This is not only a wallet transfer.
This is a payment operations layer for paid APIs, SaaS services, AI agents, and other digital services.
```
