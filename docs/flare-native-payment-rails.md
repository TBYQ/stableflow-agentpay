# Flare Native Payment Rails

This document describes the real Flare-native capabilities in StableFlow AgentPay. It is intentionally specific about what is deployed, what requires a user action, and what must not be represented as complete before a Coston2 transaction exists.

## 1. Two settlement assets

StableFlow has two Coston2 checkout rails:

```text
USD service price
  -> FTSOv2 price quote
  -> C2FLR native payment OR FXRP ERC-20 payment
  -> StableFlowPayment PaymentRecorded event
  -> Go receipt verification
  -> ledger, signed webhook, service unlock
```

`C2FLR` uses the Coston2 native asset. `FXRP` is the FAsset representation of XRP, transferred as an ERC-20 token. The payment contract forwards both assets to the merchant settlement address in the same transaction and emits one normalized `PaymentRecorded` event.

中文说明：这里不是页面上放一个 FXRP 标签。选择 FXRP 后，钱包会先发起 ERC-20 `approve`，确认后再调用 `recordFXRPPayment`；后端会核对订单号、服务 ID、资产、金额和 Chain ID。

## 2. FTSOv2 pricing

The quote provider resolves `FtsoV2` through the Flare Contract Registry at runtime and reads:

| Checkout asset | Live FTSOv2 feed | Quote output |
| --- | --- | --- |
| C2FLR | FLR/USD | C2FLR amount |
| FXRP | XRP/USD | FXRP amount |

The quote API returns the feed ID, price source, feed timestamp, and short expiry. `STABLEFLOW_QUOTE_MODE=static` is only an explicit offline fallback and must not be presented as live pricing.

## 3. FXRP preparation on Coston2

1. Open the official Coston2 faucet and request both C2FLR and FXRP for the dedicated payer test wallet.
2. Create or select a second Coston2 test wallet as the merchant recipient. Before deployment, set `STABLEFLOW_SETTLEMENT_RECIPIENT` in `contracts/.env` to this second address. It must not be the same wallet as `COSTON2_PRIVATE_KEY`: FTestXRP rejects transfers where the payer and recipient are identical.
3. Deploy the current contracts from `contracts/`:

```powershell
npm run deploy:coston2
```

4. Copy the displayed `StableFlowPayment` address into both local environments:

```text
STABLEFLOW_PAYMENT_CONTRACT=0x_deployed_contract
VITE_STABLEFLOW_PAYMENT_CONTRACT=0x_deployed_contract
```

For the deployed Coston2 version in this repository, the payment contract is `0x03236dab5EA8F10b5504940f3750b36d21e6DB7B`.

5. Restart the Go API and Vite dev server after changing either local `.env` file.
6. In the console, choose `FXRP`, create a checkout, connect MetaMask, and approve the FXRP amount when requested. MetaMask then opens a second confirmation for the settlement transaction.

The deployment script resolves `AssetManagerFXRP` and then `fAsset()` through the Flare Contract Registry; it does not hardcode an FXRP token address.

On Coston2, MetaMask currently identifies this token as `FTestXRP` with `6` decimals. Keep the detected value instead of entering `18`: the checkout reads the token's `decimals()` value before approval, and backend receipt verification uses the same six-decimal precision.

## 4. FDC-backed external XRP proof

FDC is a different rail from an FXRP checkout. It validates a payment that happened on the XRP Ledger and stores the verified result on Coston2.

```text
XRPL Testnet payment with 32-byte MemoData
  -> FDC Payment attestation request
  -> FDC voting round finalization
  -> DA Layer proof retrieval
  -> StableFlowFDCPaymentProof verifies proof on Coston2
  -> XRPPaymentProved event
```

`StableFlowFDCPaymentProof` accepts only a valid FDC `Payment` proof from `testXRP`. It requires the XRPL MemoData to equal `keccak256(paymentIntentId)`, rejects failed or zero-value external payments, and prevents a payment intent from being proved twice.

中文说明：FDC 证明不是后端“相信用户贴的 XRP 交易哈希”。合约会调用 Flare 官方 `FdcVerification.verifyPayment`。验证过的 Merkle proof 才能写入记录。

### FDC operator workflow

The FDC process is deliberately an operator script rather than a browser action. The official public verifier key is prefilled in `contracts/.env.example`; any higher-limit DA Layer key must stay in `contracts/.env`, never in the frontend bundle.

1. Generate the exact XRPL memo reference for a payment intent:

```powershell
$env:FDC_STEP = "reference"
$env:FDC_PAYMENT_INTENT_ID = "pi_your_payment_intent"
npm run fdc:xrp
```

2. Send an XRP Ledger Testnet payment with exactly one memo whose `MemoData` is the returned 32-byte value **without** its `0x` prefix (64 hexadecimal characters). Save the XRPL transaction ID.

3. Add the FDC verifier and DA Layer values to `contracts/.env`, then run the lifecycle. `prepare` creates a local file under ignored `contracts/data/`; no proof data is committed.

```powershell
$env:FDC_PAYMENT_INTENT_ID = "pi_your_payment_intent"
$env:FDC_XRP_TRANSACTION_ID = "XRPL_TRANSACTION_ID"
$env:STABLEFLOW_FDC_PROOF_CONTRACT = "0x11615a8cdEeD3887E6E8CadE1431971F8bCDc23C"
$env:FDC_STEP = "prepare"
npm run fdc:xrp
$env:FDC_STEP = "submit"
npm run fdc:xrp
# Wait for the FDC round to finalize, normally around 90-180 seconds.
$env:FDC_STEP = "retrieve"
npm run fdc:xrp
$env:FDC_STEP = "register"
npm run fdc:xrp
```

4. Record the final Coston2 registration transaction and show its `XRPPaymentProved` event in the explorer during the demo.

## 5. Demo claim boundaries

We can truthfully claim all of the following after real Coston2 transactions have been made:

- FTSOv2-backed FLR/USD and XRP/USD quotes.
- C2FLR native checkout and FXRP ERC-20 checkout.
- Backend receipt verification, ledger reconciliation, signed webhook, and service unlock.
- FDC onchain verification of an XRP Ledger Testnet payment after the four FDC operator steps complete.

Do not claim an FDC proof is complete merely because the contract is deployed or an FDC request was submitted. The proof is complete only after `register` succeeds on Coston2.
