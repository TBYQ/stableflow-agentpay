# Submission TODO

This document is the practical checklist for turning StableFlow AgentPay into a Flare Summer Signal submission.

Current date context:

```text
Today: 2026-07-05
Target hackathon: Flare Summer Signal
Public deadline seen on DoraHacks: 2026-08-14
```

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

Recommended short description:

```text
StableFlow AgentPay is AI-agent-ready payment infrastructure on Flare. It turns a Coston2 payment into a complete payment operations flow with payment intents, receipt verification, ledger reconciliation, signed webhooks, and payment summaries.
```

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

## 2. Implementation Completion Checklist

### Already Implemented

- Go DDD backend
- HTTP API
- Payment intent domain flow
- Ledger entry creation
- Local and HTTP webhook sender
- Template payment summary
- Flare Coston2 receipt verifier
- Solidity `StableFlowPayment` contract
- Hardhat tests
- React + Vite + MetaMask demo UI
- Local tests and frontend build

### Still Needed For A Real Submission

1. Deploy `StableFlowPayment` to Flare Coston2.
2. Save the deployed contract address.
3. Configure backend with the contract address.
4. Configure frontend with the contract address.
5. Get C2FLR test tokens.
6. Execute one real payment through MetaMask.
7. Confirm backend through `/chain-transaction`.
8. Capture:
   - Contract address
   - Example tx hash
   - Coston2 explorer link
   - Webhook.site payload screenshot or screen recording
9. Record final demo video.
10. Submit BUIDL on DoraHacks.

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

## 4. Quality Bar

### Minimum Acceptable

- Public GitHub repo
- Clear README
- Contract compiles and tests pass
- Go tests pass
- Frontend builds
- Demo video shows end-to-end local flow
- DoraHacks form filled completely

### Strong Submission

- Contract deployed to Flare Coston2
- Real Coston2 tx hash included
- Backend verifies the receipt through `/chain-transaction`
- Webhook.site receives signed `payment.paid`
- Demo video shows explorer link
- README includes contract address and example tx hash

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
StableFlow AgentPay is AI-agent-ready payment infrastructure on Flare. It connects backend payment intents with Coston2 transaction verification, ledger reconciliation, signed webhooks, and payment summaries so AI agents and paid services can safely unlock digital access after on-chain payment confirmation.
```

Target user:

```text
AI agent builders, SaaS API providers, and independent digital service providers that need a reliable on-chain payment confirmation and service unlock workflow.
```

How it uses Flare:

```text
The MVP deploys a Solidity payment-recording contract to Flare Coston2. Users pay with MetaMask using C2FLR. The contract emits PaymentRecorded, and the Go backend verifies the transaction receipt through Flare Coston2 RPC before marking a payment intent as paid, creating a ledger entry, and sending a signed webhook.
```

Technical materials:

```text
GitHub: https://github.com/TBYQ/stableflow-agentpay
Contract address: TBD
Example transaction hash: TBD
Demo video: TBD
```

Roadmap:

```text
Next steps include persistent storage, hosted demo deployment, background event indexing, richer merchant dashboard, real AI summary adapter, webhook retry queue, and Flare-native data integrations such as FTSO or FDC where useful.
```

## 6. Final Personal Checklist

Before clicking submit:

- [ ] GitHub repo is public
- [ ] README is updated
- [ ] Tests pass locally
- [ ] Coston2 contract deployed
- [ ] Contract address saved
- [ ] Example tx hash saved
- [ ] Explorer link works
- [ ] Demo video uploaded
- [ ] Webhook demo visible
- [ ] DoraHacks form has GitHub link
- [ ] DoraHacks form has demo video link
- [ ] DoraHacks form explains how Flare is used
- [ ] No secrets committed
