# API

The Go backend exposes a small JSON API for the StableFlow AgentPay MVP.

Default local base URL:

```text
http://127.0.0.1:8080
```

## 中文速查

本 API 的主流程是：

```text
创建服务请求 -> 创建支付意图 -> 用户付款 -> 后端确认交易 -> 查看账本/webhook/summary
```

接口用途对照：

```text
POST /v1/service-requests                    创建一个“要购买的服务请求”
POST /v1/payment-intents                     创建一张“待付款单”
GET  /v1/payment-intents/{id}                查看付款单状态
POST /v1/payment-intents/{id}/transaction    本地演示确认，不查链上收据
POST /v1/payment-intents/{id}/chain-transaction  真实查 Flare Coston2 收据后确认
POST /v1/payment-intents/{id}/summary        生成付款摘要
GET  /v1/ledger                              查看入账记录
GET  /v1/webhook-events                      查看 webhook 事件记录
```

Note: the JSON examples below use short readable ids such as `pi_001`. The implementation now generates production-friendlier prefixed ULID ids such as `pi_01K...` to avoid collisions across restarts and repeated Coston2 demos.

Merchant console additions:

```text
GET  /v1/payment-intents
GET  /v1/quote?usd_amount=0.01&asset=C2FLR
POST /v1/demo/seed
```

## Create Service Request

```text
POST /v1/service-requests
```

中文注释：第一步先创建服务请求。它表示“用户或 AI Agent 想买什么服务”，例如付费报告、API 调用权限或数据访问。

Request:

```json
{
  "service_id": "premium-market-report",
  "description": "AI agent requests access to a paid market report"
}
```

Response:

```json
{
  "id": "sr_001",
  "service_id": "premium-market-report",
  "description": "AI agent requests access to a paid market report",
  "status": "created",
  "created_at": "2026-07-05T10:00:00Z"
}
```

## Create Payment Intent

```text
POST /v1/payment-intents
```

中文注释：第二步创建支付意图。Payment Intent 是真正等待付款的对象，它会绑定服务请求、金额、链 ID、合约地址和 webhook 地址。

Request:

```json
{
  "service_request_id": "sr_001",
  "amount": "0.001",
  "asset": "C2FLR",
  "chain_id": 114,
  "payment_contract": "0x0000000000000000000000000000000000000000",
  "webhook_url": "https://webhook.site/your-demo-url"
}
```

Response:

```json
{
  "id": "pi_001",
  "service_request_id": "sr_001",
  "amount": "0.001",
  "asset": "C2FLR",
  "chain_id": 114,
  "status": "pending_payment",
  "payment_contract": "0x0000000000000000000000000000000000000000",
  "webhook_url": "https://webhook.site/your-demo-url",
  "tx_hash": "",
  "created_at": "2026-07-05T10:00:00Z",
  "updated_at": "2026-07-05T10:00:00Z"
}
```

## Get Payment Intent

```text
GET /v1/payment-intents/{id}
```

中文注释：用这个接口查看当前支付状态。常见状态是 `pending_payment` 和 `paid`。

Response:

```json
{
  "id": "pi_001",
  "service_request_id": "sr_001",
  "amount": "0.001",
  "asset": "C2FLR",
  "chain_id": 114,
  "status": "paid",
  "payment_contract": "0x0000000000000000000000000000000000000000",
  "webhook_url": "https://webhook.site/your-demo-url",
  "tx_hash": "0xabc123",
  "created_at": "2026-07-05T10:00:00Z",
  "updated_at": "2026-07-05T10:03:00Z"
}
```

## List Payment Intents

```text
GET /v1/payment-intents
```

The merchant console uses this endpoint to show checkout history. Items are returned newest first.

Response:

```json
{
  "items": [
    {
      "id": "pi_001",
      "service_request_id": "sr_001",
      "amount": "0.001",
      "asset": "C2FLR",
      "chain_id": 114,
      "status": "paid",
      "tx_hash": "0xabc123"
    }
  ]
}
```

## Quote Payment

```text
GET /v1/quote?usd_amount=0.01&asset=C2FLR
```

This is a demo FTSO-style static quote adapter, not a real FTSO price feed. It keeps the product shape ready for a future real Flare quote adapter.

Response:

```json
{
  "usd_amount": "0.01",
  "asset": "C2FLR",
  "amount": "0.001",
  "price_usd": "10",
  "price_source": "demo-ftso-style-static",
  "expires_at": "2026-08-06T10:02:00Z"
}
```

## Seed Demo Data

```text
POST /v1/demo/seed
```

This endpoint creates a service request, payment intent, ledger entry, webhook event, and summary through the local confirmation path. It is for recordings and dashboard demos; it does not replace the real Coston2 receipt verification path.

Request:

```json
{
  "service_id": "premium-market-report",
  "description": "Paid market report access for a merchant checkout demo",
  "usd_amount": "0.01",
  "amount": "0.001",
  "asset": "C2FLR",
  "chain_id": 114,
  "payment_contract": "0x0000000000000000000000000000000000000000",
  "webhook_url": "https://webhook.site/your-demo-url"
}
```

Response shape is the same as `/transaction`.

## Confirm Payment With Submitted Hash

```text
POST /v1/payment-intents/{id}/transaction
```

This endpoint trusts the submitted tx hash and is useful for early local demos.

中文注释：这个接口不会去链上验证交易，只相信你提交的 tx hash。适合在没有部署合约、没有 C2FLR 测试币、只想演示后端流程时使用。

Request:

```json
{
  "tx_hash": "0xabc123"
}
```

Response:

```json
{
  "payment_intent": {
    "id": "pi_001",
    "status": "paid",
    "tx_hash": "0xabc123"
  },
  "ledger_entry": {
    "id": "le_001",
    "payment_intent_id": "pi_001",
    "tx_hash": "0xabc123",
    "amount": "0.001",
    "asset": "C2FLR",
    "chain_id": 114,
    "entry_type": "payment_confirmed"
  },
  "webhook_event": {
    "id": "evt_001",
    "payment_intent_id": "pi_001",
    "event_type": "payment.paid",
    "status": "delivered"
  },
  "summary": "Payment intent pi_001 was confirmed on chain 114 with transaction 0xabc123..."
}
```

## Confirm Payment From Flare Receipt

```text
POST /v1/payment-intents/{id}/chain-transaction
```

This endpoint verifies the transaction receipt through Flare Coston2 JSON-RPC and parses the `PaymentRecorded` event emitted by `StableFlowPayment`.

The backend confirms the payment only if the event `paymentIntentId` matches the requested backend payment intent id.

中文注释：这是最终 demo 更推荐使用的接口。它会查 Flare Coston2 的交易收据，解析合约事件，并确认事件里的 paymentIntentId 确实等于后端这张 payment intent 的 id。

Request:

```json
{
  "tx_hash": "0xabc123"
}
```

Response shape is the same as `/transaction`.

## Generate Payment Summary

```text
POST /v1/payment-intents/{id}/summary
```

中文注释：生成一段人类可读的付款摘要。当前实现是模板生成，不依赖真实 AI API。

Response:

```json
{
  "payment_intent_id": "pi_001",
  "summary": "Payment intent pi_001 was confirmed on chain 114 with transaction 0xabc123..."
}
```

## List Ledger Entries

```text
GET /v1/ledger
```

中文注释：查看账本记录。支付确认后会生成一条 `payment_confirmed` 类型的 ledger entry。

Response:

```json
{
  "items": [
    {
      "id": "le_001",
      "payment_intent_id": "pi_001",
      "tx_hash": "0xabc123",
      "amount": "0.001",
      "asset": "C2FLR",
      "chain_id": 114,
      "entry_type": "payment_confirmed",
      "created_at": "2026-07-05T10:03:00Z"
    }
  ]
}
```

## List Webhook Events

```text
GET /v1/webhook-events
```

中文注释：查看 webhook 事件记录。即使本地模式不真正发送 HTTP，也会记录签名后的 webhook 事件。

Response:

```json
{
  "items": [
    {
      "id": "evt_001",
      "payment_intent_id": "pi_001",
      "event_type": "payment.paid",
      "delivery_url": "https://webhook.site/your-demo-url",
      "signature": "t=1783160000,v1=...",
      "status": "delivered",
      "created_at": "2026-07-05T10:03:00Z",
      "delivered_at": "2026-07-05T10:03:00Z"
    }
  ]
}
```

## Webhook Payload

When `STABLEFLOW_WEBHOOK_DELIVERY=http`, the backend sends:

中文注释：当后端环境变量设置为 `STABLEFLOW_WEBHOOK_DELIVERY=http` 时，系统会把 `payment.paid` 事件 POST 到 payment intent 里的 `webhook_url`，比如 webhook.site。

```json
{
  "id": "evt_001",
  "type": "payment.paid",
  "created_at": "2026-07-05T10:03:00Z",
  "data": {
    "payment_intent_id": "pi_001",
    "service_request_id": "sr_001",
    "amount": "0.001",
    "asset": "C2FLR",
    "chain_id": 114,
    "tx_hash": "0xabc123",
    "chain": "flare-coston2"
  }
}
```

Headers:

```text
Content-Type: application/json
StableFlow-Event-ID: evt_001
StableFlow-Signature: t=timestamp,v1=hmac_signature
```

中文注释：`StableFlow-Signature` 是 HMAC 签名。真实业务系统收到 webhook 后，可以用共享 secret 验证这个请求是不是 StableFlow 发来的。

## Error Shape

Errors are returned as:

```json
{
  "error": "validation failed: service id is required"
}
```

Common status codes:

```text
400 -> validation error or bad request
404 -> missing entity
409 -> invalid payment status transition
500 -> unexpected server error
```

中文注释：如果接口报错，先看 HTTP 状态码。`400` 多半是请求字段不对，`404` 是 id 找不到，`409` 是状态不允许，比如已经 paid 后又用另一个 tx hash 确认。
