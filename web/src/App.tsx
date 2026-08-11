import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  FileText,
  LockKeyhole,
  Radio,
  ReceiptText,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wallet,
  Webhook
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPublicClient, createWalletClient, custom, http, parseEther, parseUnits } from "viem";
import {
  confirmPaymentWithChainReceipt,
  confirmPaymentWithSubmittedHash,
  createPaymentIntent,
  createServiceRequest,
  LedgerEntry,
  listLedgerEntries,
  listPaymentIntents,
  listWebhookEvents,
  PaymentIntent,
  PaymentQuote,
  quotePayment,
  seedDemoData,
  WebhookEvent
} from "./api";
import { coston2, requestCoston2Network } from "./flare";
import { erc20ApprovalABI, stableFlowPaymentABI } from "./stableflowContract";

const defaultContract = import.meta.env.VITE_STABLEFLOW_PAYMENT_CONTRACT || "";

type DataView = "payments" | "ledger" | "webhooks";
type PaymentAsset = "C2FLR" | "FXRP";

export function App() {
  const [serviceID, setServiceID] = useState("premium-market-report");
  const [description, setDescription] = useState("Private market signals, execution notes, and a concise operator brief.");
  const [usdAmount, setUSDAmount] = useState("0.01");
  const [amount, setAmount] = useState("0.001");
  const [paymentAsset, setPaymentAsset] = useState<PaymentAsset>("C2FLR");
  const [webhookURL, setWebhookURL] = useState("https://webhook.site/your-demo-url");
  const [contractAddress, setContractAddress] = useState(defaultContract);
  const [walletAddress, setWalletAddress] = useState("");
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [ledgerEntry, setLedgerEntry] = useState<LedgerEntry | null>(null);
  const [webhookEvent, setWebhookEvent] = useState<WebhookEvent | null>(null);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [txHash, setTxHash] = useState("");
  const [summary, setSummary] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [paymentIntents, setPaymentIntents] = useState<PaymentIntent[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [useChainVerification, setUseChainVerification] = useState(true);
  const [activeView, setActiveView] = useState<DataView>("payments");
  const [showDetails, setShowDetails] = useState(false);

  const explorerTxURL = useMemo(() => {
    const hash = txHash || paymentIntent?.tx_hash;
    return hash ? `${coston2.blockExplorers.default.url}/tx/${hash}` : "";
  }, [paymentIntent?.tx_hash, txHash]);

  const latestWebhook = webhookEvent || webhookEvents[0] || null;
  const isPaid = paymentIntent?.status === "paid";
  const isLiveFTSO = quote?.price_source.startsWith("flare-ftso-v2-") || false;
  const feedAsset = paymentAsset === "FXRP" ? "XRP" : "FLR";
  const quoteValue = quote ? `${quote.amount} ${quote.asset}` : `-- ${paymentAsset}`;
  const statusDetail = events[0] || (isLiveFTSO ? `Live ${feedAsset}/USD feed connected` : "Syncing the live Flare price feed");

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshQuote(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [usdAmount, paymentAsset]);

  async function loadDashboard() {
    setIsLoadingDashboard(true);
    try {
      const [intents, ledger, webhooks] = await Promise.all([
        listPaymentIntents(),
        listLedgerEntries(),
        listWebhookEvents()
      ]);
      setPaymentIntents(intents);
      setLedgerEntries(ledger);
      setWebhookEvents(webhooks);
    } catch (error) {
      setEvents((current) => [`Could not refresh proof records: ${messageFor(error)}`, ...current]);
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function refreshQuote(logEvent = true) {
    try {
      const nextQuote = await quotePayment(usdAmount, paymentAsset);
      setQuote(nextQuote);
      setAmount(nextQuote.amount);
      if (logEvent) {
        setEvents((current) => [`Live quote refreshed: ${nextQuote.amount} ${nextQuote.asset}`, ...current]);
      }
    } catch (error) {
      setEvents((current) => [`Quote unavailable: ${messageFor(error)}`, ...current]);
    }
  }

  async function runStep(label: string, action: () => Promise<void>) {
    setIsBusy(true);
    setEvents((current) => [`${label}...`, ...current]);
    try {
      await action();
      await loadDashboard();
      setEvents((current) => [`${label} complete`, ...current]);
    } catch (error) {
      setEvents((current) => [`${label} failed: ${messageFor(error)}`, ...current]);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateIntent() {
    await runStep("Creating secure checkout", async () => {
      const serviceRequest = await createServiceRequest({ service_id: serviceID, description });
      const intent = await createPaymentIntent({
        service_request_id: serviceRequest.id,
        amount,
        asset: paymentAsset,
        chain_id: coston2.id,
        payment_contract: contractAddress,
        webhook_url: webhookURL
      });
      setPaymentIntent(intent);
      setLedgerEntry(null);
      setWebhookEvent(null);
      setSummary("");
      setTxHash("");
    });
  }

  async function handleConnectWallet() {
    await runStep("Connecting MetaMask", async () => {
      await requestCoston2Network();
      if (!window.ethereum) throw new Error("MetaMask or another EIP-1193 wallet was not found.");
      const addresses = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      setWalletAddress(addresses[0] || "");
    });
  }

  async function handlePayOnFlare() {
    await runStep(`Submitting ${paymentAsset} payment`, async () => {
      if (!paymentIntent) throw new Error("Create a checkout first.");
      if (!contractAddress) throw new Error("Set VITE_STABLEFLOW_PAYMENT_CONTRACT or paste a contract address.");
      if (!window.ethereum) throw new Error("MetaMask or another EIP-1193 wallet was not found.");

      await requestCoston2Network();
      const walletClient = createWalletClient({ chain: coston2, transport: custom(window.ethereum) });
      const publicClient = createPublicClient({ chain: coston2, transport: http(coston2.rpcUrls.default.http[0]) });
      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error("Wallet account not connected.");

      let hash: `0x${string}`;
      if (paymentAsset === "FXRP") {
        const fxrpAddress = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: stableFlowPaymentABI,
          functionName: "fxrp"
        });
        const tokenAmount = parseUnits(amount, 18);
        const approvalHash = await walletClient.writeContract({
          account,
          address: fxrpAddress,
          abi: erc20ApprovalABI,
          functionName: "approve",
          args: [contractAddress as `0x${string}`, tokenAmount]
        });
        setEvents((current) => [`FXRP approval submitted: ${shortHash(approvalHash)}`, ...current]);
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
        hash = await walletClient.writeContract({
          account,
          address: contractAddress as `0x${string}`,
          abi: stableFlowPaymentABI,
          functionName: "recordFXRPPayment",
          args: [paymentIntent.id, serviceID, tokenAmount]
        });
      } else {
        hash = await walletClient.writeContract({
          account,
          address: contractAddress as `0x${string}`,
          abi: stableFlowPaymentABI,
          functionName: "recordPayment",
          args: [paymentIntent.id, serviceID],
          value: parseEther(amount)
        });
      }
      setTxHash(hash);
    });
  }

  async function handleConfirmBackend() {
    await runStep("Verifying onchain receipt", async () => {
      if (!paymentIntent) throw new Error("Create a checkout first.");
      if (!txHash) throw new Error("Submit a Flare transaction first, or paste a transaction hash.");
      const response = useChainVerification
        ? await confirmPaymentWithChainReceipt(paymentIntent.id, txHash)
        : await confirmPaymentWithSubmittedHash(paymentIntent.id, txHash);
      setPaymentIntent(response.payment_intent);
      setLedgerEntry(response.ledger_entry);
      setWebhookEvent(response.webhook_event);
      setSummary(response.summary);
    });
  }

  async function handleSeedDemoData() {
    await runStep("Loading completed demo", async () => {
      const response = await seedDemoData({
        service_id: serviceID,
        description,
        usd_amount: usdAmount,
        amount,
        asset: paymentAsset,
        chain_id: coston2.id,
        payment_contract: contractAddress,
        webhook_url: webhookURL
      });
      setPaymentIntent(response.payment_intent);
      setLedgerEntry(response.ledger_entry);
      setWebhookEvent(response.webhook_event);
      setTxHash(response.payment_intent.tx_hash);
      setSummary(response.summary);
    });
  }

  async function handlePrimaryAction() {
    if (!paymentIntent) return handleCreateIntent();
    if (!walletAddress) return handleConnectWallet();
    if (!txHash) return handlePayOnFlare();
    if (!isPaid) return handleConfirmBackend();
  }

  const primaryAction = !paymentIntent
    ? { label: "Create secure checkout", icon: <ReceiptText size={18} /> }
    : !walletAddress
      ? { label: "Connect MetaMask", icon: <Wallet size={18} /> }
      : !txHash
        ? { label: paymentAsset === "FXRP" ? `Approve & pay ${quoteValue}` : `Pay ${quoteValue}`, icon: <Send size={18} /> }
        : !isPaid
          ? { label: "Verify payment", icon: <ShieldCheck size={18} /> }
          : { label: "Payment complete", icon: <CheckCircle2 size={18} /> };

  return (
    <div className="checkout-page">
      <header className="checkout-topbar">
        <a className="brand" href="#checkout" aria-label="StableFlow checkout">
          <span className="brand-glyph"><Radio size={19} /></span>
          <span><strong>StableFlow</strong><small>AgentPay</small></span>
        </a>
        <div className="topbar-status">
          <span className="network-chip"><span className="signal-dot" />Flare Coston2</span>
          <span className="chain-chip">Chain {coston2.id}</span>
        </div>
      </header>

      <main className="checkout-shell" id="checkout">
        <section className="service-stage" aria-labelledby="service-heading">
          <div className="stage-eyebrow"><Sparkles size={14} /> Agent commerce request</div>
          <h1 id="service-heading">Premium Market<br />Intelligence</h1>
          <p className="stage-intro">A structured brief for an agent that needs market context before it acts.</p>

          <div className="report-art" aria-label="Premium market intelligence report preview">
            <div className="report-art-top"><span>STABLEFLOW</span><span>ISSUE 01</span></div>
            <div className="report-art-body">
              <span>LIVE</span>
              <strong>MARKET<br />SIGNALS</strong>
              <div className="signal-bars"><i /><i /><i /><i /><i /></div>
            </div>
            <div className="report-art-footer"><span>Flare verified data</span><span>01</span></div>
          </div>

          <div className="service-inclusions">
            <p>Included in this request</p>
            <ul>
              <li><Check size={16} /> Live FTSOv2 reference price</li>
              <li><Check size={16} /> Reconciled onchain payment receipt</li>
              <li><Check size={16} /> Signed delivery webhook</li>
            </ul>
          </div>
        </section>

        <section className="checkout-sheet" aria-labelledby="checkout-heading">
          <div className="sheet-header">
            <div>
              <span className="sheet-kicker">Secure checkout</span>
              <h2 id="checkout-heading">Review and pay</h2>
            </div>
            <div className={`feed-chip ${isLiveFTSO ? "is-live" : ""}`}><Radio size={14} />{isLiveFTSO ? "Live FTSO" : "Syncing"}</div>
          </div>

          <div className="checkout-product">
            <div className="mini-report-art"><span>LIVE</span><strong>MARKET<br />SIGNALS</strong></div>
            <div className="product-copy">
              <strong>Premium market report</strong>
              <span>{serviceID}</span>
              <small>{description}</small>
            </div>
            <div className="product-price"><span>Request value</span><strong>${usdAmount || "0.00"}</strong></div>
          </div>

          <div className="asset-rail" role="group" aria-label="Settlement asset">
            <div><span>Pay with</span><strong>{paymentAsset === "FXRP" ? "FXRP on Flare" : "C2FLR on Flare"}</strong></div>
            <div className="asset-tabs">
              <button className={paymentAsset === "C2FLR" ? "selected" : ""} type="button" disabled={isBusy} onClick={() => setPaymentAsset("C2FLR")}>C2FLR</button>
              <button className={paymentAsset === "FXRP" ? "selected" : ""} type="button" disabled={isBusy} onClick={() => setPaymentAsset("FXRP")}>FXRP</button>
            </div>
          </div>

          <div className="quote-box">
            <div className="quote-main"><span>Live conversion</span><strong>{quoteValue}</strong><small>{quote ? `$${quote.usd_amount} at $${quote.price_usd} / ${feedAsset}` : "Fetching the Flare price feed"}</small></div>
            <button className="icon-button" type="button" disabled={isBusy} onClick={() => void refreshQuote()} aria-label="Refresh live quote" title="Refresh live quote"><RefreshCw size={17} /></button>
          </div>

          <div className="receipt-lines">
            <div><span>Service request</span><strong>{paymentIntent?.id || "Created after checkout"}</strong></div>
            <div><span>Network fee</span><strong>Shown in wallet</strong></div>
            <div className="receipt-total"><span>Total due</span><strong>{quoteValue}</strong></div>
          </div>

          <div className="wallet-status">
            <div className="wallet-symbol"><Wallet size={18} /></div>
            <div><span>Wallet</span><strong>{walletAddress ? shortHash(walletAddress) : "Not connected"}</strong></div>
            {walletAddress && <span className="connected-mark"><Check size={15} /></span>}
          </div>

          <button className="pay-button" type="button" disabled={isBusy || isPaid} onClick={() => void handlePrimaryAction()}>
            {primaryAction.icon}{primaryAction.label}
          </button>
          <p className="checkout-note">{paymentAsset === "FXRP" && !txHash ? "FXRP uses an approval, then a settlement confirmation." : "The payment receipt is verified before access is unlocked."}</p>

          <div className="checkout-progress" aria-label="Payment progress">
            <ProgressStep complete={Boolean(quote)} active={!paymentIntent} label="Quote" />
            <ProgressStep complete={Boolean(paymentIntent)} active={Boolean(paymentIntent) && !txHash} label="Checkout" />
            <ProgressStep complete={Boolean(txHash)} active={Boolean(txHash) && !isPaid} label="Onchain" />
            <ProgressStep complete={isPaid} active={isPaid} label="Verified" />
          </div>

          <div className={`result-banner ${isPaid ? "success" : ""}`}>
            {isPaid ? <CheckCircle2 size={18} /> : <LockKeyhole size={18} />}
            <div><strong>{isPaid ? "Service access unlocked" : "Access unlocks after verification"}</strong><span>{isPaid ? summary || serviceID : statusDetail}</span></div>
            {explorerTxURL && <a href={explorerTxURL} target="_blank" rel="noreferrer" title="Open transaction in Coston2 Explorer"><ExternalLink size={16} /></a>}
          </div>
        </section>
      </main>

      <section className="proof-panel" aria-labelledby="proof-heading">
        <div className="proof-heading"><div><span>Payment proof</span><h2 id="proof-heading">Everything behind this checkout</h2></div><button className="details-toggle" type="button" onClick={() => setShowDetails((current) => !current)} aria-expanded={showDetails}><Settings2 size={16} />{showDetails ? "Hide details" : "View details"}<ChevronDown size={15} className={showDetails ? "rotated" : ""} /></button></div>
        <div className="proof-summary">
          <ProofFact icon={<CircleDollarSign size={18} />} label="FTSO feed" value={quote?.price_source || "Connecting"} detail={quote ? `${feedAsset}/USD · ${shortHash(quote.feed_id)}` : "Live price source"} />
          <ProofFact icon={<ReceiptText size={18} />} label="Settlement" value={paymentIntent?.status || "Ready to create"} detail={paymentIntent ? shortHash(paymentIntent.id) : `${paymentAsset} checkout`} />
          <ProofFact icon={<Webhook size={18} />} label="Webhook" value={latestWebhook?.status || "Waiting"} detail={latestWebhook?.delivery_url || "Destination chosen at checkout"} />
        </div>

        {showDetails && <div className="proof-details">
          <div className="configuration-grid">
            <label>Service ID<input value={serviceID} onChange={(event) => setServiceID(event.target.value)} /></label>
            <label>USD request value<input value={usdAmount} onChange={(event) => setUSDAmount(event.target.value)} inputMode="decimal" /></label>
            <label className="wide-field">Service description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label>
            <label>Webhook destination<input value={webhookURL} onChange={(event) => setWebhookURL(event.target.value)} /></label>
            <label>Payment contract<input value={contractAddress} onChange={(event) => setContractAddress(event.target.value)} /></label>
            <label>Transaction hash<input value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder="0x..." /></label>
            <label className="verification-toggle"><input type="checkbox" checked={useChainVerification} onChange={(event) => setUseChainVerification(event.target.checked)} />Verify with the Coston2 receipt</label>
          </div>

          <div className="detail-actions">
            <button className="quiet-button" type="button" disabled={isBusy} onClick={() => void handleSeedDemoData()}><Sparkles size={16} />Load completed demo</button>
            <button className="quiet-button" type="button" disabled={isBusy || isLoadingDashboard} onClick={() => void loadDashboard()}><RefreshCw size={16} />Refresh records</button>
          </div>

          <div className="proof-tabs" role="tablist" aria-label="Payment proof records">
            <TabButton active={activeView === "payments"} label="Payments" onClick={() => setActiveView("payments")} />
            <TabButton active={activeView === "ledger"} label="Ledger" onClick={() => setActiveView("ledger")} />
            <TabButton active={activeView === "webhooks"} label="Webhooks" onClick={() => setActiveView("webhooks")} />
          </div>
          <div className="table-wrap">
            {activeView === "payments" && <PaymentIntentTable intents={paymentIntents} />}
            {activeView === "ledger" && <LedgerTable entries={ledgerEntries} />}
            {activeView === "webhooks" && <WebhookTable events={webhookEvents} />}
          </div>
        </div>}
      </section>

      <footer className="checkout-footer"><ShieldCheck size={15} />Coston2 testnet · Onchain receipts are checked by StableFlow before delivery.</footer>
    </div>
  );
}

function ProgressStep({ complete, active, label }: { complete: boolean; active: boolean; label: string }) {
  return <div className={`${complete ? "complete" : ""} ${active ? "active" : ""}`}><span>{complete ? <Check size={13} /> : ""}</span><small>{label}</small></div>;
}

function ProofFact({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <article className="proof-fact"><div className="proof-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} role="tab" aria-selected={active} onClick={onClick}>{label}</button>;
}

function PaymentIntentTable({ intents }: { intents: PaymentIntent[] }) {
  return <table><thead><tr><th>Payment intent</th><th>Status</th><th>Amount</th><th>Transaction</th><th>Created</th></tr></thead><tbody>{intents.length === 0 ? <EmptyRow colSpan={5} label="No payment intents yet" /> : intents.map((intent) => <tr key={intent.id}><td><strong>{intent.id}</strong></td><td><StatusPill value={intent.status} /></td><td>{intent.amount} {intent.asset}</td><td>{shortHash(intent.tx_hash) || "-"}</td><td>{formatDate(intent.created_at)}</td></tr>)}</tbody></table>;
}

function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  return <table><thead><tr><th>Ledger entry</th><th>Payment intent</th><th>Amount</th><th>Type</th><th>Created</th></tr></thead><tbody>{entries.length === 0 ? <EmptyRow colSpan={5} label="No reconciled ledger entries yet" /> : entries.map((entry) => <tr key={entry.id}><td><strong>{entry.id}</strong></td><td>{entry.payment_intent_id}</td><td>{entry.amount} {entry.asset}</td><td>{entry.entry_type}</td><td>{formatDate(entry.created_at)}</td></tr>)}</tbody></table>;
}

function WebhookTable({ events }: { events: WebhookEvent[] }) {
  return <table><thead><tr><th>Webhook event</th><th>Payment intent</th><th>Status</th><th>Signature</th><th>Delivered</th></tr></thead><tbody>{events.length === 0 ? <EmptyRow colSpan={5} label="No webhook events yet" /> : events.map((event) => <tr key={event.id}><td><strong>{event.id}</strong></td><td>{event.payment_intent_id}</td><td><StatusPill value={event.status} /></td><td>{shortHash(event.signature)}</td><td>{formatDate(event.delivered_at || event.created_at)}</td></tr>)}</tbody></table>;
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill ${value}`}>{value}</span>;
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <tr><td className="empty-row" colSpan={colSpan}>{label}</td></tr>;
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function shortHash(value?: string) {
  if (!value) return "";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
