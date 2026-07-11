# Build Plan

This document tracks what has been implemented and what remains before a polished Flare Summer Signal submission.

中文注释：这个文件是项目进度表。看它时只需要分三类：`Completed` 已经完成，`Remaining Before Submission` 提交前必须补，`Optional Improvements` 有时间再做。

## Completed

### Documentation and Scope

Done:

- README positioned for Flare Summer Signal
- Product requirements
- Architecture document
- API document
- Demo script
- Build plan

中文注释：文档层已经基本齐全。后续只需要把真实部署地址、交易哈希、demo 视频链接补进去。

### DDD Go Backend

Done:

- `cmd/stableflow-api`
- Domain models
- Application service
- Repository ports
- Webhook sender port
- Chain verifier port
- Summary generator port
- In-memory store
- HTTP API adapter
- Local CORS for Vite demo
- Unit tests

中文注释：Go 后端主流程已经完成。现在的存储是内存版，足够 hackathon demo，但不是生产数据库。

### Payment Workflow

Done:

- Create service request
- Create payment intent
- Confirm payment with submitted tx hash
- Confirm payment with verified Flare receipt
- Create ledger entry
- Create webhook event
- Generate payment summary

中文注释：支付工作流已经能从“创建待付款单”走到“确认付款、记账、发 webhook、生成摘要”。

### Flare / Contract Integration

Done:

- `StableFlowPayment.sol`
- Native C2FLR payment recording
- `PaymentRecorded` event
- Duplicate payment intent protection
- Hardhat config for Coston2
- Deploy script
- Demo payment script
- Solidity tests

中文注释：合约和 Hardhat 脚本已经准备好。还需要真实部署到 Coston2，拿到合约地址。

### Web Demo

Done:

- React + Vite + TypeScript UI
- MetaMask network setup for Coston2
- Create payment intent flow
- Call `recordPayment`
- Submit tx hash to backend
- Display payment state and summary

中文注释：前端已经能串起 demo 动作。最终演示时最重要的是让 MetaMask、Coston2 合约地址和后端环境变量保持一致。

## Verified Locally

The following checks have passed locally:

```text
go test ./...
cd contracts && npm test
cd web && npm run build
browser opened the web UI and Create Intent successfully called the Go API
```

中文注释：这些是之前本地通过的验证项。每次重要改动后建议至少重新跑 `go test ./...`、`contracts npm test` 和 `web npm run build`。

## Remaining Before Submission

### Deploy Contract To Coston2

Needs:

- Funded Coston2 test wallet
- `contracts/.env`
- `COSTON2_PRIVATE_KEY`

中文注释：部署合约是提交前最关键的剩余步骤。私钥只写进 `contracts/.env`，并确认 `.env` 不会被 git 提交。

Command:

```bash
cd contracts
npm run deploy:coston2
```

Output to capture:

```text
StableFlowPayment deployed to: 0x...
```

### Wire Contract Address

Set backend:

```text
STABLEFLOW_PAYMENT_CONTRACT=0x...
```

Set frontend:

```text
VITE_STABLEFLOW_PAYMENT_CONTRACT=0x...
```

中文注释：后端和前端必须使用同一个合约地址，否则前端付款的合约和后端验证的合约对不上。

### Record Real Demo

Preferred demo flow:

```text
Create payment intent
Connect MetaMask
Pay on Flare Coston2
Confirm backend through /chain-transaction
Show ledger/webhook/summary
Open transaction in Coston2 Explorer
```

中文注释：最终 demo 最好展示 explorer 链接，这能让评委看到交易确实发生在 Flare Coston2。

### Prepare DoraHacks Submission

Submission assets:

- GitHub repository
- Demo video
- Short description
- Target users
- How the project uses Flare
- Contract address
- Example transaction hash
- Short roadmap

中文注释：DoraHacks 提交材料里最容易缺的是合约地址、示例交易哈希和 demo 视频链接。录制前先准备好这些信息。

## Optional Improvements

If time remains:

- Replace in-memory store with SQLite or PostgreSQL
- Add background event listener
- Add real AI summary adapter
- Add webhook retry queue
- Add frontend ledger/webhook tables
- Add contract address and transaction hash examples to README
- Add screenshots to docs

中文注释：这些是加分项，不是阻塞提交的项。时间紧时先不要做大改动，优先保证真实 Coston2 demo 能跑通。

## Risk Control

If time becomes tight, keep the core demo:

- Public GitHub repository
- Go API
- Solidity contract
- MetaMask transaction
- Receipt verification
- Ledger entry
- Signed webhook event
- Demo video

Cut first:

- Production database
- Advanced UI polish
- Real AI integration
- Background listener
- Deployment automation

中文注释：风险控制的意思是：如果时间不够，先砍生产级复杂功能，保留能证明项目价值的最短路径。
