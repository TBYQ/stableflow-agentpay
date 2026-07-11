# StableFlow AgentPay

StableFlow AgentPay is AI-agent-ready payment infrastructure on Flare.

It turns a raw on-chain payment into a complete payment operations flow:

```text
Payment Intent -> Flare Coston2 transaction -> receipt verification -> ledger entry -> signed webhook -> payment summary
```

## 中文速读

StableFlow AgentPay 可以理解成“给 AI Agent 和付费数字服务用的链上付款后台”。它不是只做一个转账按钮，而是把一次 Flare Coston2 测试网付款，整理成后端能看懂、能确认、能入账、能发 webhook、能生成摘要的完整流程。

最核心的一句话：

```text
先在后端创建支付意图 -> 用户用 MetaMask 付款 -> 后端验证链上交易 -> 更新订单状态 -> 记账 -> 通知业务系统
```

如果你只想先跑通 demo，可以重点看这几个文件：

- `README.md`: 项目总览、启动方式、测试命令
- `docs/demo-script.md`: 录 demo 时怎么讲
- `docs/submission-todo.md`: 参赛提交前还缺什么
- `docs/api.md`: 后端接口怎么调用

The project is built for **Flare Summer Signal** and is positioned for the **Interoperable Asset Products** bounty. The target use case is simple: AI agents, SaaS APIs, and independent service providers need a reliable way to unlock paid digital services after an on-chain payment is confirmed.

## Why This Exists

Wallet transfers are not enough for real paid services.

中文注释：普通钱包转账只能证明“有人转过钱”，但真实业务还需要知道这笔钱对应哪个服务、是否确认、是否已经解锁服务、有没有记账和通知下游系统。本项目补的是这层“支付运营后台”。

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

中文注释：下面这张流程图就是 demo 的主线。录视频或讲项目时，可以按这个顺序解释，不需要先讲代码细节。

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

中文注释：这里的 `Implemented` 表示仓库里已经写好的能力；`Not implemented yet` 表示为了 hackathon MVP 暂时没做的生产级能力。

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

中文注释：DDD/Clean Architecture 的意思是把“支付状态怎么变、什么时候算支付成功”这些核心规则放在 domain/application 里，不让 HTTP、数据库、前端、链 RPC 这些外部细节污染核心逻辑。

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

中文注释：后端是 Go API。先启动它，前端和链上确认接口才有地方调用。

```bash
go run ./cmd/stableflow-api
```

Default backend URL:

```text
http://127.0.0.1:8080
```

Useful backend environment variables:

中文注释：本地 demo 不一定每个环境变量都要设置。没有真实合约地址时，可以先用本地确认接口 `/transaction` 跑流程；要验证真实 Coston2 交易时才需要 `STABLEFLOW_PAYMENT_CONTRACT`。

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

中文注释：合约目录用 Hardhat。部署到 Coston2 前要准备测试钱包私钥和测试币 C2FLR。私钥只放本地 `.env`，不要提交。

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

中文注释：前端是 React + Vite 的演示界面，负责创建支付意图、连接 MetaMask、调用合约付款、把交易哈希发回后端。

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

中文注释：接口里最重要的是先创建 service request，再创建 payment intent。付款后有两条确认路径：本地演示用 `/transaction`，真实链上收据验证用 `/chain-transaction`。

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

中文注释：对评委讲的时候，不要只说“我做了一个付款按钮”。更强的表达是：这个项目把链上付款变成了后端业务可用的支付流程，包含状态机、账本、webhook、收据验证和摘要。

The strongest judging points are:

- It uses Flare Coston2 for real testnet payment confirmation.
- It keeps the smart contract intentionally small.
- It shows serious backend infrastructure thinking: state machine, ledger, idempotency, webhook signatures, and clean architecture.
- It is easy to explain in a 2-3 minute demo.

## Safety

This project is for testnet demonstration only.

中文注释：这是测试网项目，不处理真实资金。任何 `.env`、私钥、助记词、API key 都不要提交到 Git。

Do not commit:

- `.env`
- private keys
- wallet seed phrases
- API keys
- production secrets
