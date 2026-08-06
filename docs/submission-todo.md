# Submission TODO

This document is the practical checklist for turning StableFlow AgentPay into a Flare Summer Signal submission.

Current date context:

```text
Today: 2026-08-04
Target hackathon: Flare Summer Signal
Public deadline seen on DoraHacks: 2026-08-14
```

中文注释：这份日期是写文档时的规划快照。真正提交前，请以 DoraHacks 页面当天显示的截止时间和表单要求为准。

## 1. Platform Accounts

### GitHub

Repository:

```text
https://github.com/TBYQ/stableflow-agentpay
```

Current target:

- Keep the repository public.
- Keep README and docs aligned with the actual implementation.
- Never commit private keys, seed phrases, `.env`, API keys, or wallet secrets.

中文注释：GitHub 仓库是评委最先看的技术材料。README 要能解释项目价值，docs 要能证明你知道架构、API、demo 和提交路径。

Before submission, GitHub should show:

- Clear README
- Product docs
- Architecture docs
- API docs
- Solidity contract
- Go backend
- Frontend demo
- Passing test instructions

### DoraHacks

Hackathon page:

```text
https://dorahacks.io/hackathon/flaresummersignal/detail
```

BUIDL submission page:

```text
https://dorahacks.io/hackathon/flaresummersignal/buidl
```

Public DoraHacks search/page information shows submission fields around:

- Project name
- Selected bounty or bounties
- Short product description
- Target user
- Demo link, video, or working app
- GitHub repo or technical materials
- How the project uses Flare
- Smart contract address or deployment details, if applicable
- Short roadmap

Your target bounty:

```text
Interoperable Asset Products
```

Recommended project name:

```text
StableFlow AgentPay
```

中文注释：DoraHacks 上的项目名建议保持和 GitHub/README 一致，减少评委对不上材料的风险。

Recommended short description:

```text
StableFlow AgentPay is payment intent and webhook infrastructure on Flare for paid APIs, SaaS services, and AI agents. It turns a Coston2 payment into a complete payment operations flow with payment intents, receipt verification, ledger reconciliation, signed webhooks, and payment summaries.
```

中文注释：这段可以直接作为提交表单的短描述。中文理解是：项目把 Coston2 付款变成完整的后端支付流程，而不是只做转账。

### Flare Developer Resources

Use these for actual testnet work:

```text
Developer docs: https://dev.flare.network/
Network overview: https://dev.flare.network/network/overview
Faucet: https://faucet.flare.network/
Coston2 explorer: https://coston2-explorer.flare.network/
Coston2 RPC: https://coston2-api.flare.network/ext/C/rpc
Chain ID: 114
Native test token: C2FLR
```

Flare official faucet currently allows requesting Coston2 test assets such as C2FLR. Use a new test wallet only.

中文注释：测试钱包只用于测试网，不要拿真实资产钱包来部署或录 demo。

### MetaMask

Need:

- Install browser extension
- Create or import a test wallet
- Add Flare Coston2
- Request C2FLR from the Flare faucet
- Use this wallet only for testnet work

Network config:

```text
Network name: Flare Coston2 Testnet
RPC URL: https://coston2-api.flare.network/ext/C/rpc
Chain ID: 114
Currency symbol: C2FLR
Explorer: https://coston2-explorer.flare.network
```

中文注释：如果 MetaMask 没有自动添加网络，就按这里手动填。chain id 必须是 114。

### Webhook.site

Purpose:

- Receive the `payment.paid` webhook in the demo.
- Show the signed webhook payload visually in the demo video.

Need:

- Open https://webhook.site/
- Copy the generated webhook URL
- Paste it into the web UI or use it in API calls
- Start backend with HTTP webhook delivery enabled

Backend env:

```text
STABLEFLOW_WEBHOOK_DELIVERY=http
STABLEFLOW_WEBHOOK_SECRET=your-demo-secret
```

中文注释：`webhook.site` 是录 demo 很好用的可视化工具。后端发出 webhook 后，可以在网页上直接看到 payload 和签名 header。

### Demo Video Platform

Use one of:

- YouTube unlisted video
- Loom
- Google Drive public video link

Recommendation:

```text
YouTube unlisted
```

The DoraHacks submission should receive a stable public URL.

中文注释：视频链接要保证评委能打开。不要使用需要登录或容易过期的临时链接。

## 2. Implementation Completion Checklist

### Already Implemented

- Go DDD backend
- HTTP API
- Payment intent domain flow
- Ledger entry creation
- Local and HTTP webhook sender
- Template payment summary
- Merchant console with payment intent, ledger, webhook, quote, and unlock views
- Demo JSON persistence adapter
- Demo seed endpoint
- FTSO-style static quote adapter
- Flare Coston2 receipt verifier
- Solidity `StableFlowPayment` contract
- Hardhat tests
- React + Vite + MetaMask merchant UI
- Local tests and frontend build

### Still Needed For A Real Submission

1. Record final demo video.
2. Replace the placeholder webhook URL with a real webhook.site URL if the final video should show an external webhook delivery.
3. Capture webhook.site payload screenshot or screen recording if using HTTP webhook delivery.
4. Submit BUIDL on DoraHacks.

中文注释：这几步是最终提交前的剩余主线。合约地址、真实交易哈希和 explorer 链接已经拿到，接下来最重要的是 demo 视频和 webhook 展示。

Completed Coston2 evidence:

```text
StableFlowPayment contract:
0x09982Cfd1c566f749559c495A1a21843939C9E4b

Example paid transaction:
0xa1f0bd83eee2b84e94c29322c80c90be14989bec5f14e531d00e0e1635ea2ee0

Coston2 explorer:
https://coston2-explorer.flare.network/tx/0xa1f0bd83eee2b84e94c29322c80c90be14989bec5f14e531d00e0e1635ea2ee0
```

## 3. Deployment / Demo Paths

### Minimum Local Demo

This is enough for a first technical recording.

Terminal 1:

```bash
go run ./cmd/stableflow-api
```

Terminal 2:

```bash
cd contracts
npm install
npm test
```

Terminal 3:

```bash
cd web
npm install
npm run dev
```

Use the frontend at:

```text
http://127.0.0.1:5173
```

This proves:

- Backend works
- Frontend works
- Contract compiles and tests

It does not prove a real Flare transaction unless the contract is deployed to Coston2.

中文注释：Minimum Local Demo 可以证明代码能跑，但不能证明真实链上付款。最终参赛最好还是走 Preferred Hackathon Demo。

### Preferred Hackathon Demo

Use this for final submission.

1. Deploy contract:

```bash
cd contracts
cp .env.example .env
npm install
npm run deploy:coston2
```

2. Set backend env:

```text
STABLEFLOW_PAYMENT_CONTRACT=0x_deployed_contract
FLARE_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
STABLEFLOW_WEBHOOK_DELIVERY=http
STABLEFLOW_WEBHOOK_SECRET=demo-secret
```

3. Start backend:

```bash
go run ./cmd/stableflow-api
```

4. Set frontend env:

```text
VITE_API_BASE_URL=http://127.0.0.1:8080
VITE_STABLEFLOW_PAYMENT_CONTRACT=0x_deployed_contract
```

5. Start frontend:

```bash
cd web
npm run dev
```

6. Demo flow:

```text
Create Intent
Connect MetaMask
Pay on Flare
Confirm Backend
Open transaction in Coston2 Explorer
Show webhook.site payload
Show paid status and summary
```

中文注释：这是最终录制推荐流程。录屏时尽量让 MetaMask、前端状态、后端结果、Coston2 explorer 和 webhook.site 都出现。

### Optional Hosted Demo

If time allows:

Frontend:

- Vercel
- Netlify

Backend:

- Render
- Railway
- Fly.io

For the hackathon, hosted deployment is nice but not mandatory if the demo video clearly shows the local flow and the Flare transaction/explorer link.

中文注释：部署线上前端/后端是加分项，不是必须项。时间紧时，清晰的本地录屏 + 真实 Coston2 交易更重要。

## 4. Quality Bar

### Minimum Acceptable

- Public GitHub repo
- Clear README
- Contract compiles and tests pass
- Go tests pass
- Frontend builds
- Demo video shows end-to-end local flow
- DoraHacks form filled completely

中文注释：这是最低交付线。至少要让评委能看懂项目、跑测试、看到 demo。

### Strong Submission

- Contract deployed to Flare Coston2
- Real Coston2 tx hash included
- Backend verifies the receipt through `/chain-transaction`
- Webhook.site receives signed `payment.paid`
- Demo video shows explorer link
- README includes contract address and example tx hash

中文注释：强提交的关键是“真实 Coston2 交易 + 后端收据验证”。这比做更多 UI 更有说服力。

### Excellent Submission

- Hosted frontend
- Hosted backend
- Coston2 contract verified on explorer if possible
- README has screenshots
- Demo video is under 3 minutes and clearly explains the infrastructure value
- DoraHacks submission text is concise and polished

## 5. Final DoraHacks Submission Draft

Project name:

```text
StableFlow AgentPay
```

Selected bounty:

```text
Interoperable Asset Products
```

Short product description:

```text
StableFlow AgentPay is payment intent and webhook infrastructure on Flare for paid APIs, SaaS services, and AI agents. It connects backend payment intents with Coston2 transaction verification, ledger reconciliation, signed webhooks, and payment summaries so paid services can safely unlock digital access after on-chain payment confirmation.
```

Target user:

```text
SaaS API providers, independent digital service providers, merchant-style Flare builders, and AI agent builders that need a reliable on-chain payment confirmation and service unlock workflow.
```

How it uses Flare:

```text
The MVP deploys a Solidity payment-recording contract to Flare Coston2. Users pay with MetaMask using C2FLR. The contract emits PaymentRecorded, and the Go backend verifies the transaction receipt through Flare Coston2 RPC before marking a payment intent as paid, creating a ledger entry, and sending a signed webhook.
```

Technical materials:

```text
GitHub: https://github.com/TBYQ/stableflow-agentpay
Contract address: 0x09982Cfd1c566f749559c495A1a21843939C9E4b
Example transaction hash: 0xa1f0bd83eee2b84e94c29322c80c90be14989bec5f14e531d00e0e1635ea2ee0
Explorer link: https://coston2-explorer.flare.network/tx/0xa1f0bd83eee2b84e94c29322c80c90be14989bec5f14e531d00e0e1635ea2ee0
Demo video: TBD
```

Roadmap:

```text
Next steps include hosted demo deployment, production SQL storage, background event indexing, real AI summary adapter, webhook retry queue, and Flare-native integrations such as real FTSO quotes, FDC proofs, FXRP, and FAssets settlement where useful.
```

中文注释：这份 submission draft 可以直接复制到表单里。合约地址、交易哈希和 explorer 链接已经补好，录完视频后只需要把 `Demo video: TBD` 替换成真实视频链接。

## 6. Final Personal Checklist

Before clicking submit:

- [ ] GitHub repo is public
- [x] README is updated
- [x] Tests pass locally
- [x] Coston2 contract deployed
- [x] Contract address saved
- [x] Example tx hash saved
- [x] Explorer link works
- [ ] Demo video uploaded
- [ ] Webhook demo visible
- [ ] DoraHacks form has GitHub link
- [ ] DoraHacks form has demo video link
- [ ] DoraHacks form explains how Flare is used
- [ ] No secrets committed

中文注释：最后一项非常重要。提交前用 `git status` 和 `.gitignore` 再确认一次，不要把 `.env`、私钥或助记词带进 commit。
