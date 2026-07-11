# Demo Script

Target length: 2 to 3 minutes.

## 1. Opening

StableFlow AgentPay is AI-agent-ready payment infrastructure on Flare.

It helps AI agents and paid services use payment intents, Flare Coston2 transaction confirmation, ledger reconciliation, signed webhooks, and payment summaries.

中文讲法：

```text
StableFlow AgentPay 是一个面向 AI Agent 和付费数字服务的 Flare 支付基础设施。它不是单纯的钱包转账按钮，而是把一笔 Coston2 链上付款变成后端可确认、可记账、可通知、可追踪的完整支付流程。
```

## 2. Problem

AI agents can call tools and APIs, but paid access needs more than a wallet transfer.

A service provider needs to know:

- What was requested
- Which payment intent was created
- Which chain transaction confirmed the payment
- Whether a ledger entry was created
- Whether the paid service was unlocked
- Whether a webhook was signed and delivered

中文讲法：

```text
AI Agent 可以调用工具和 API，但只靠钱包转账并不能支撑真实的付费服务。服务方还需要知道这笔钱对应哪个请求、交易有没有确认、服务能不能解锁、账本有没有记录，以及 webhook 有没有发出去。
```

## 3. Show The Architecture

Point to the repository structure:

```text
Go backend: DDD payment workflow
Solidity: minimal on-chain payment recording
React UI: MetaMask demo
```

Explain that the smart contract is intentionally small and the backend owns the payment operations workflow.

中文讲法：

```text
这个项目分成三层：Go 后端负责支付工作流，Solidity 合约负责最小的链上付款记录，React 前端负责演示和 MetaMask 交互。我们刻意让合约保持简单，把重点放在支付意图、收据验证、账本和 webhook 这些后端基础设施上。
```

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

中文讲法：

```text
第一步点击 Create Intent。后端会先创建一个服务请求，再创建一张待付款的 payment intent。它的初始状态是 pending_payment。
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

中文讲法：

```text
第二步连接 MetaMask。前端会请求钱包添加或切换到 Flare Coston2 测试网，chain id 是 114，测试币是 C2FLR。
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

中文讲法：

```text
第三步点击 Pay on Flare。用户用 C2FLR 测试币调用 StableFlowPayment 合约，合约记录这次 payment intent，并发出 PaymentRecorded 事件。
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

中文讲法：

```text
第四步点击 Confirm Backend。后端会根据交易哈希去 Flare Coston2 RPC 查询交易收据，解析 PaymentRecorded 事件，确认里面的 paymentIntentId 和后端记录一致，然后把状态改成 paid。
```

### Step 5: Show results

Point to:

- Payment intent status
- Transaction hash
- Ledger entry
- Webhook event
- Payment summary
- Coston2 explorer link

中文讲法：

```text
最后展示结果：payment intent 已经变成 paid，可以看到交易哈希、ledger entry、webhook event、summary，以及 Coston2 explorer 链接。这说明链上付款已经被后端业务系统可靠地确认和记录。
```

## 5. Closing

StableFlow AgentPay turns a simple on-chain payment into a payment operations layer for AI agents and paid services.

The MVP demonstrates:

- Payment intents
- Flare Coston2 transaction confirmation
- Ledger reconciliation
- Signed webhook delivery
- Clean backend architecture

中文讲法：

```text
总结来说，StableFlow AgentPay 把一次简单的链上付款，变成了 AI Agent 和付费服务真正能使用的支付运营层。这个 MVP 展示了 payment intent、Coston2 交易确认、账本、签名 webhook 和清晰的后端架构。
```

## Backup Demo Path

If the testnet, wallet, or faucet is unavailable during recording, use the local confirmation endpoint:

```text
POST /v1/payment-intents/{id}/transaction
```

This still demonstrates the backend payment workflow, but the preferred demo is `/chain-transaction` with a real Flare Coston2 receipt.

中文注释：如果录制时测试网、钱包或 faucet 出问题，可以临时走 `/transaction` 展示后端状态机、ledger、webhook 和 summary。但最终提交更推荐展示 `/chain-transaction`，因为它能证明真实查了 Flare Coston2 收据。
