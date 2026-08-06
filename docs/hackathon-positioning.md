# Hackathon Positioning Notes

This document records the submission strategy and competition analysis for StableFlow AgentPay.

Last checked against the Flare Summer Signal page on 2026-08-05. The public page showed an August 14 final submission deadline in the body and a 2026-08-15 03:59 deadline in the header. Before final submission, use the live DoraHacks page as the source of truth.

## 1. What The Prompt Is

Flare Summer Signal is not an AI Agent-only hackathon. The core ask is to build a real product, integration, or useful prototype on Flare.

The two main bounty directions are:

1. Interoperable Asset Products
2. Confidential Compute Apps

StableFlow AgentPay should target:

```text
Interoperable Asset Products
```

The reason is that this bounty includes products that help users move, access, manage, or use assets through Flare. Payment and merchant flows fit this direction.

中文理解：命题并不要求项目必须是 AI Agent。它希望看到基于 Flare 的真实产品或集成。StableFlow 最适合 Interoperable Asset Products，因为我们实现的是支付确认、商户记账、服务解锁和 webhook 通知这一类支付流程。

## 2. Where Our Project Fits

StableFlow AgentPay is best described as:

```text
Flare payment intent and webhook infrastructure for paid APIs, SaaS services, and AI agents.
```

AI agents are one possible user group, but the product value is broader:

- paid API access
- SaaS feature unlocks
- digital service payments
- merchant-style checkout flows
- agent or automation workflows that need payment confirmation

对外可以说：

```text
StableFlow AgentPay 是面向付费 API、SaaS 服务和 AI Agent 的 Flare 支付基础设施。
它把一笔 Coston2 链上付款，变成后端可以验证、入账、通知业务系统并解锁服务的完整支付流程。
```

## 3. What We Have Built

The current MVP proves this chain:

```text
Generate quote
-> Create payment intent
-> Pay with MetaMask on Flare Coston2
-> StableFlowPayment.sol records the payment
-> Go backend verifies the Coston2 transaction receipt
-> Payment intent becomes paid
-> Ledger entry is created
-> Signed webhook is delivered
-> Paid service is unlocked
```

This is more than a payment button. A wallet transfer alone does not tell a backend which service should unlock, whether the transaction was verified, whether the ledger was updated, or whether downstream systems were notified.

Current product and engineering evidence includes:

- deployed Coston2 smart contract
- real MetaMask payment flow
- backend receipt verification instead of trusting the frontend
- merchant console for quote, checkout, payment, ledger, and webhook state
- payment intent lifecycle and service unlock result
- ledger reconciliation and signed webhook delivery
- JSON persistence adapter for repeatable demos
- automated Go, Solidity, and frontend build checks

## 4. What Usually Makes A Hackathon Winner

获奖通常不是只靠某一个点。可以用下面这个经验公式理解：

```text
获奖概率 ≈ 命题契合度 × 可运行程度 × 技术辨识度 × 产品价值 × 演示表达
```

它更接近乘法，而不是加法。某一项接近零，例如项目无法运行、没有真正使用赞助方技术，其他部分再漂亮也很难补回来。

### 4.1 Prompt And Sponsor Fit

评委首先会问：为什么这个项目要建立在 Flare 上？

把普通 Solidity 合约部署到 Coston2 可以证明项目能在 Flare 上运行，但辨识度还不够高。更强的作品会把 Flare 的原生能力变成产品不可替代的一部分，例如：

- FTSO 提供链上价格或时间序列数据
- FDC 验证外部链或互联网中的事件
- FAssets / FXRP 让非智能合约资产参与 Flare 应用

StableFlow 当前使用 Coston2 合约和 RPC 收据验证，基础是成立的。下一步最有价值的技术增强是真实 FTSO 报价，而不是继续增加不相关功能。

### 4.2 A Complete Working Demo

评委通常只有几分钟理解一个项目。强演示应该让下面的链路一眼可见：

```text
真实问题
-> 用户采取操作
-> 发生真实链上交易
-> 后端验证结果
-> 商户收到记账和 webhook
-> 用户获得服务访问权
```

一个稳定跑通的窄 MVP，通常比十个无法完整演示的功能更有说服力。合约地址、交易哈希、Explorer 页面和 webhook 请求都是很好的证据。

### 4.3 Product Value And Originality

“新意”不等于越奇怪越好。更重要的是形成一个清楚的判断：

- 问题是否真实存在
- 现有方案有什么缺口
- 为什么需要链上支付或验证
- 为什么 Flare 特别适合解决它
- 黑客松结束后是否有继续发展的路径

StableFlow 的新意不在于发明转账，而在于把链上支付接入真实后端业务状态：支付意图、收据验证、记账、通知和服务解锁。

### 4.4 Technical Execution

评委不一定逐行阅读代码，但代码质量会通过演示稳定性和复现难度体现出来。技术材料至少应该证明：

- 合约真实部署并有测试
- 存在真实交易记录
- 后端独立验证交易，而不是相信前端传来的成功状态
- 关键状态能够持久化和查询
- webhook 有签名，业务流程有清楚的状态变化
- README 可以让别人理解并复现项目

好代码是地基，不一定直接抢镜，但它决定演示是否可靠。

### 4.5 Presentation And UI

页面是放大器，不是项目本身。好页面能让评委快速理解状态变化，坏页面会掩盖已有技术成果。

黑客松页面最重要的不是装饰，而是清楚显示：

- 当前步骤和支付状态
- 钱包、网络、金额和合约
- 交易哈希与 Explorer 入口
- ledger、webhook 和服务解锁结果
- 错误、等待和成功反馈

在这些信息已经清楚之后，继续微调颜色和动画的收益通常低于补充真实 Flare 原生集成。

## 5. Practical Evaluation Model

下面是我们内部用于排优先级的经验权重，不是 Flare 官方公布的分数：

| Dimension | Heuristic Weight | StableFlow Status | Interpretation |
| --- | ---: | --- | --- |
| Prompt and Flare fit | 30% | Medium | Coston2 flow is real, but native Flare depth can improve |
| Complete working demo | 25% | Strong | End-to-end payment and service unlock already work |
| Product value and originality | 20% | Medium-strong | Clear merchant problem, but payment infrastructure is competitive |
| Technical execution | 15% | Strong for an MVP | Tests, persistence, receipt verification, ledger, and webhooks exist |
| Presentation and UI | 10% | Medium-strong | Merchant console communicates the workflow; public hosting/video remain |

中文结论：StableFlow 已经跨过“教学 Demo”阶段。当前最大短板不是代码量或页面，而是 Flare 原生技术深度和最终提交材料。

## 6. Current Strengths And Weaknesses

### Strengths

- 真实 Coston2 测试网交易，不是本地假数据流程
- 已部署 Solidity 合约，并有可展示的交易哈希
- 后端验证链上收据，不信任前端声明
- 支付意图、账本、webhook、服务解锁形成闭环
- 商户控制台把链上结果翻译成业务状态
- Go 后端边界清楚，测试和持久化足够支撑 MVP 演示

### Weaknesses

- 当前支付资产仍是原生 C2FLR，不是 FXRP 或 FAssets
- 当前报价是 FTSO-style static adapter，不是真实 FTSO 数据
- JSON 文件持久化适合演示，不是生产数据库
- webhook 没有生产级重试队列和失败恢复机制
- 还没有稳定的公开托管 Demo
- 还缺少最终两到三分钟演示视频

### Honest Submission Framing

```text
This is a working Coston2 MVP of a payment operations layer.
It proves the full quote, payment confirmation, ledger, webhook, and service unlock flow.
Future work extends it with real FTSO quotes, FXRP/FAssets settlement, hosted deployment,
production SQL storage, and production webhook reliability.
```

## 7. What Not To Claim

Do not claim:

- this is a full DeFi protocol
- this already supports FXRP/FAssets payment settlement
- the static quote adapter is a real FTSO integration
- this is a production merchant processor
- this is an autonomous AI Agent
- this handles mainnet funds

Do claim:

- it is a working Flare Coston2 payment infrastructure MVP
- it connects on-chain payment to backend business state
- it verifies receipts and produces ledger entries and signed webhooks
- it demonstrates a merchant and paid-service unlock workflow
- its architecture allows additional Flare assets and data protocols to be added later

## 8. AI Agent Wording

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

## 9. Best Next Improvements

Prioritize in this order:

1. Replace the static quote adapter with a real FTSO-backed quote adapter.
2. Host the frontend and backend so judges can open a public demo.
3. Record a concise two-to-three-minute demo video.
4. Show webhook.site receiving the signed `payment.paid` event.
5. Verify and link the deployed contract if the explorer supports it.
6. Add one coherent FXRP/FAssets or FDC enhancement only if it strengthens the payment story.
7. Add production SQL storage and a webhook retry queue after the hackathon MVP is secure.

Do not add FTSO, FDC, and FAssets as three shallow labels. One real Flare-native integration that materially improves the payment workflow is more convincing than several incomplete integrations.

## 10. One-Sentence Takeaway

```text
新意决定评委愿不愿意继续看，真实 Flare 集成决定项目是否符合命题，完整演示决定评委敢不敢给奖。
```
