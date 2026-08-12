import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  LockKeyhole,
  Radio,
  ReceiptText,
  RefreshCw,
  Send,
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
  listServiceRequests,
  listWebhookEvents,
  PaymentIntent,
  PaymentQuote,
  quotePayment,
  seedDemoData,
  ServiceRequest,
  WebhookEvent
} from "./api";
import { coston2, requestCoston2Network } from "./flare";
import { erc20ApprovalABI, stableFlowPaymentABI } from "./stableflowContract";

const defaultContract = import.meta.env.VITE_STABLEFLOW_PAYMENT_CONTRACT || "";

type DataView = "requests" | "payments" | "ledger" | "webhooks";
type PaymentAsset = "C2FLR" | "FXRP";

export function App() {
  const [agentID, setAgentID] = useState("market-research-agent");
  const [serviceID, setServiceID] = useState("premium-market-report");
  const [description, setDescription] = useState("Private market signals, execution notes, and a concise operator brief.");
  const [usdAmount, setUSDAmount] = useState("0.01");
  const [amount, setAmount] = useState("0.001");
  const [paymentAsset, setPaymentAsset] = useState<PaymentAsset>("C2FLR");
  const [webhookURL, setWebhookURL] = useState("https://webhook.site/your-demo-url");
  const [contractAddress, setContractAddress] = useState(defaultContract);
  const [walletAddress, setWalletAddress] = useState("");
  const [serviceRequest, setServiceRequest] = useState<ServiceRequest | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [ledgerEntry, setLedgerEntry] = useState<LedgerEntry | null>(null);
  const [webhookEvent, setWebhookEvent] = useState<WebhookEvent | null>(null);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [txHash, setTxHash] = useState("");
  const [summary, setSummary] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [paymentIntents, setPaymentIntents] = useState<PaymentIntent[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [useChainVerification, setUseChainVerification] = useState(true);
  const [activeView, setActiveView] = useState<DataView>("requests");

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
      const [requests, intents, ledger, webhooks] = await Promise.all([
        listServiceRequests(),
        listPaymentIntents(),
        listLedgerEntries(),
        listWebhookEvents()
      ]);
      setServiceRequests(requests);
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

  function resetCheckoutState() {
    setPaymentIntent(null);
    setLedgerEntry(null);
    setWebhookEvent(null);
    setSummary("");
    setTxHash("");
  }

  async function handleCreateAgentRequest() {
    await runStep("Creating agent request", async () => {
      const request = await createServiceRequest({ agent_id: agentID, service_id: serviceID, description });
      setServiceRequest(request);
      resetCheckoutState();
      setActiveView("requests");
    });
  }

  async function handleCreateIntent() {
    await runStep("Creating secure checkout", async () => {
      if (!serviceRequest) throw new Error("Create an agent request first.");
      if (!quote || quote.asset !== paymentAsset) throw new Error("Wait for the live quote for the selected asset.");
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
      setActiveView("payments");
    });
  }

  function handlePaymentAssetChange(asset: PaymentAsset) {
    if (asset === paymentAsset) return;
    setPaymentAsset(asset);
    setQuote(null);
    setAmount("");
    resetCheckoutState();
    setEvents((current) => [`${asset} selected for a new checkout`, ...current]);
  }

  function handleUseServiceRequest(request: ServiceRequest) {
    setServiceRequest(request);
    setAgentID(request.agent_id || "market-research-agent");
    setServiceID(request.service_id);
    setDescription(request.description);
    resetCheckoutState();
    setEvents((current) => [`Agent request selected: ${shortHash(request.id)}`, ...current]);
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
        const fxrpDecimals = await publicClient.readContract({
          address: fxrpAddress,
          abi: erc20ApprovalABI,
          functionName: "decimals"
        });
        const tokenAmount = parseUnits(amount, fxrpDecimals);
        const approvalHash = await walletClient.writeContract({
          account,
          address: fxrpAddress,
          abi: erc20ApprovalABI,
          functionName: "approve",
          args: [contractAddress as `0x${string}`, tokenAmount]
        });
        setEvents((current) => [`FXRP approval submitted (${fxrpDecimals} decimals): ${shortHash(approvalHash)}`, ...current]);
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
      const requests = await listServiceRequests();
      setServiceRequests(requests);
      setServiceRequest(requests.find((request) => request.id === response.payment_intent.service_request_id) || null);
      setActiveView("payments");
    });
  }

  async function handlePrimaryAction() {
    if (!serviceRequest) return handleCreateAgentRequest();
    if (!paymentIntent) return handleCreateIntent();
    if (!walletAddress) return handleConnectWallet();
    if (!txHash) return handlePayOnFlare();
    if (!isPaid) return handleConfirmBackend();
    resetCheckoutState();
    setEvents((current) => ["Ready for a new checkout on this agent request", ...current]);
  }

  const primaryAction = !serviceRequest
    ? { label: "Create agent request", icon: <Bot size={18} /> }
    : !paymentIntent
    ? { label: `Create ${paymentAsset} checkout`, icon: <ReceiptText size={18} /> }
    : !walletAddress
      ? { label: "Connect MetaMask", icon: <Wallet size={18} /> }
      : !txHash
        ? { label: paymentAsset === "FXRP" ? `Approve & pay ${quoteValue}` : `Pay ${quoteValue}`, icon: <Send size={18} /> }
        : !isPaid
          ? { label: "Verify payment", icon: <ShieldCheck size={18} /> }
          : { label: "Start another checkout", icon: <ReceiptText size={18} /> };

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
        <section className="service-hero" aria-labelledby="service-heading">
          <div>
            <div className="stage-eyebrow"><Sparkles size={14} /> Agent commerce request</div>
            <h1 id="service-heading">Premium Market Intelligence</h1>
            <p className="stage-intro">A paid research capability an agent can request, settle on Flare, and unlock only after receipt verification.</p>
          </div>
          <div className="hero-product">
            <div className="mini-report-art"><span>LIVE</span><strong>MARKET<br />SIGNALS</strong></div>
            <div><span>Service capability</span><strong>Verified market brief</strong><small>FTSO reference pricing, onchain settlement, and a signed delivery event.</small></div>
          </div>
        </section>

        <section className="workflow-grid" aria-label="Agent request and settlement workflow">
          <section className="workflow-card request-card" aria-labelledby="request-heading">
            <div className="workflow-card-heading"><div><span className="sheet-kicker">Step 1</span><h2 id="request-heading">Request from an agent</h2></div><span className="step-icon"><Bot size={18} /></span></div>
            <p className="workflow-copy">The agent defines what it needs. StableFlow persists that request before a checkout exists.</p>
            <div className="request-fields">
              <label>Agent ID<input value={agentID} onChange={(event) => setAgentID(event.target.value)} placeholder="market-research-agent" /></label>
              <label>Service ID<input value={serviceID} onChange={(event) => setServiceID(event.target.value)} /></label>
              <label className="wide-field">Request brief<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></label>
            </div>
            <button className="secondary-action" type="button" disabled={isBusy} onClick={() => void handleCreateAgentRequest()}><Bot size={16} />{serviceRequest ? "Create another request" : "Submit agent request"}</button>
            <div className={`request-state ${serviceRequest ? "ready" : ""}`}><FileText size={16} /><div><span>Active request</span><strong>{serviceRequest ? `${shortHash(serviceRequest.id)} - ${serviceRequest.status}` : "No request created yet"}</strong></div></div>
          </section>

          <section className="workflow-card checkout-sheet" aria-labelledby="checkout-heading">
          <div className="sheet-header">
            <div>
              <span className="sheet-kicker">Step 2</span>
              <h2 id="checkout-heading">Settle and verify</h2>
            </div>
            <div className={`feed-chip ${isLiveFTSO ? "is-live" : ""}`}><Radio size={14} />{isLiveFTSO ? "Live FTSO" : "Syncing"}</div>
          </div>

          <div className="checkout-product">
            <div className="product-copy">
              <strong>{serviceRequest ? "Agent request ready for settlement" : "Waiting for an agent request"}</strong>
              <span>{serviceRequest ? shortHash(serviceRequest.id) : "Submit Step 1 to continue"}</span>
              <small>{description}</small>
            </div>
            <div className="product-price"><span>Request value</span><strong>${usdAmount || "0.00"}</strong></div>
          </div>

          <div className="asset-rail" role="group" aria-label="Settlement asset">
            <div><span>Pay with</span><strong>{paymentAsset === "FXRP" ? "FXRP on Flare" : "C2FLR on Flare"}</strong></div>
            <div className="asset-tabs">
              <button className={paymentAsset === "C2FLR" ? "selected" : ""} type="button" disabled={isBusy} onClick={() => handlePaymentAssetChange("C2FLR")}>C2FLR</button>
              <button className={paymentAsset === "FXRP" ? "selected" : ""} type="button" disabled={isBusy} onClick={() => handlePaymentAssetChange("FXRP")}>FXRP</button>
            </div>
          </div>

          <div className="quote-box">
            <div className="quote-main"><span>Live conversion</span><strong>{quoteValue}</strong><small>{quote ? `$${quote.usd_amount} at $${quote.price_usd} / ${feedAsset}` : "Fetching the Flare price feed"}</small></div>
            <button className="icon-button" type="button" disabled={isBusy} onClick={() => void refreshQuote()} aria-label="Refresh live quote" title="Refresh live quote"><RefreshCw size={17} /></button>
          </div>

          <div className="receipt-lines">
            <div><span>Service request</span><strong>{serviceRequest ? shortHash(serviceRequest.id) : "Create in Step 1"}</strong></div>
            <div><span>Payment intent</span><strong>{paymentIntent ? shortHash(paymentIntent.id) : "Created after checkout"}</strong></div>
            <div><span>Network fee</span><strong>Shown in wallet</strong></div>
            <div className="receipt-total"><span>Total due</span><strong>{quoteValue}</strong></div>
          </div>

          <div className="wallet-status">
            <div className="wallet-symbol"><Wallet size={18} /></div>
            <div><span>Wallet</span><strong>{walletAddress ? shortHash(walletAddress) : "Not connected"}</strong></div>
            {walletAddress && <span className="connected-mark"><Check size={15} /></span>}
          </div>

          <button className="pay-button" type="button" disabled={isBusy} onClick={() => void handlePrimaryAction()}>
            {primaryAction.icon}{primaryAction.label}
          </button>
          <p className="checkout-note">{!serviceRequest ? "Create the agent request before generating a checkout." : paymentAsset === "FXRP" && !txHash ? "FXRP uses an approval, then a settlement confirmation." : "The payment receipt is verified before access is unlocked."}</p>

          <div className="checkout-progress" aria-label="Payment progress">
            <ProgressStep complete={Boolean(serviceRequest)} active={!serviceRequest} label="Request" />
            <ProgressStep complete={Boolean(paymentIntent)} active={Boolean(serviceRequest) && !paymentIntent} label="Checkout" />
            <ProgressStep complete={Boolean(txHash)} active={Boolean(txHash) && !isPaid} label="Onchain" />
            <ProgressStep complete={isPaid} active={isPaid} label="Verified" />
          </div>

          <div className={`result-banner ${isPaid ? "success" : ""}`}>
            {isPaid ? <CheckCircle2 size={18} /> : <LockKeyhole size={18} />}
            <div><strong>{isPaid ? "Service access unlocked" : "Access unlocks after verification"}</strong><span>{isPaid ? summary || serviceID : statusDetail}</span></div>
            {explorerTxURL && <a href={explorerTxURL} target="_blank" rel="noreferrer" title="Open transaction in Coston2 Explorer"><ExternalLink size={16} /></a>}
          </div>
        </section>
        </section>
      </main>

      <section className="proof-panel" aria-labelledby="proof-heading">
        <div className="proof-heading"><div><span>Operations log</span><h2 id="proof-heading">Request, settlement, and delivery records</h2></div><button className="quiet-button" type="button" disabled={isBusy || isLoadingDashboard} onClick={() => void loadDashboard()}><RefreshCw size={16} />Refresh records</button></div>
        <div className="proof-summary">
          <ProofFact icon={<Bot size={18} />} label="Agent request" value={serviceRequest?.status || "Ready"} detail={serviceRequest ? `${agentID} - ${shortHash(serviceRequest.id)}` : "Submit a request to begin"} />
          <ProofFact icon={<ReceiptText size={18} />} label="Settlement" value={paymentIntent?.status || "Ready to create"} detail={paymentIntent ? shortHash(paymentIntent.id) : `${paymentAsset} checkout`} />
          <ProofFact icon={<Webhook size={18} />} label="Webhook" value={latestWebhook?.status || "Waiting"} detail={latestWebhook?.delivery_url || "Destination chosen at checkout"} />
        </div>

        <div className="proof-details">
          <div className="configuration-grid">
            <label>USD request value<input value={usdAmount} onChange={(event) => setUSDAmount(event.target.value)} inputMode="decimal" /></label>
            <label className="wide-field">Service description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label>
            <label>Webhook destination<input value={webhookURL} onChange={(event) => setWebhookURL(event.target.value)} /></label>
            <label>Payment contract<input value={contractAddress} onChange={(event) => setContractAddress(event.target.value)} /></label>
            <label>Transaction hash<input value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder="0x..." /></label>
            <label className="verification-toggle"><input type="checkbox" checked={useChainVerification} onChange={(event) => setUseChainVerification(event.target.checked)} />Verify with the Coston2 receipt</label>
          </div>

          <div className="detail-actions">
            <button className="quiet-button" type="button" disabled={isBusy} onClick={() => void handleSeedDemoData()}><Sparkles size={16} />Load completed demo</button>
          </div>

          <div className="proof-tabs" role="tablist" aria-label="Payment proof records">
            <TabButton active={activeView === "requests"} label="Requests" onClick={() => setActiveView("requests")} />
            <TabButton active={activeView === "payments"} label="Payments" onClick={() => setActiveView("payments")} />
            <TabButton active={activeView === "ledger"} label="Ledger" onClick={() => setActiveView("ledger")} />
            <TabButton active={activeView === "webhooks"} label="Webhooks" onClick={() => setActiveView("webhooks")} />
          </div>
          <div className="table-wrap">
            {activeView === "requests" && <ServiceRequestTable requests={serviceRequests} onUse={handleUseServiceRequest} />}
            {activeView === "payments" && <PaymentIntentTable intents={paymentIntents} />}
            {activeView === "ledger" && <LedgerTable entries={ledgerEntries} />}
            {activeView === "webhooks" && <WebhookTable events={webhookEvents} />}
          </div>
        </div>
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

function ServiceRequestTable({ requests, onUse }: { requests: ServiceRequest[]; onUse: (request: ServiceRequest) => void }) {
  return <table><thead><tr><th>Agent</th><th>Service request</th><th>Service</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{requests.length === 0 ? <EmptyRow colSpan={6} label="No agent requests yet" /> : requests.map((request) => <tr key={request.id}><td>{request.agent_id || "legacy-request"}</td><td><strong>{request.id}</strong></td><td>{request.service_id}</td><td><StatusPill value={request.status} /></td><td>{formatDate(request.created_at)}</td><td><button className="table-action" type="button" onClick={() => onUse(request)}>Use <ArrowRight size={13} /></button></td></tr>)}</tbody></table>;
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
