import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Database,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  PlayCircle,
  Radio,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet,
  Webhook
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const [description, setDescription] = useState("Paid market report access for a merchant checkout demo");
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

  const explorerTxURL = useMemo(() => {
    const hash = txHash || paymentIntent?.tx_hash;
    if (!hash) return "";
    return `${coston2.blockExplorers.default.url}/tx/${hash}`;
  }, [paymentIntent?.tx_hash, txHash]);

  const latestWebhook = webhookEvent || webhookEvents[0] || null;
  const currentLedgerEntry =
    ledgerEntry || ledgerEntries.find((entry) => entry.payment_intent_id === paymentIntent?.id) || null;
  const isPaid = paymentIntent?.status === "paid";
  const isLiveFTSO = quote?.price_source.startsWith("flare-ftso-v2-") || false;
  const feedAsset = paymentAsset === "FXRP" ? "XRP" : "FLR";
  const pendingPayments = paymentIntents.filter((intent) => intent.status === "pending_payment").length;
  const deliveredWebhooks = webhookEvents.filter((event) => event.status === "delivered").length;

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
      const message = error instanceof Error ? error.message : String(error);
      setEvents((current) => [`Load dashboard failed: ${message}`, ...current]);
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
        setEvents((current) => [
          `Quote refreshed from ${nextQuote.price_source}: $${nextQuote.usd_amount} -> ${nextQuote.amount} ${nextQuote.asset}`,
          ...current
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEvents((current) => [`Quote failed: ${message}`, ...current]);
    }
  }

  async function runStep(label: string, fn: () => Promise<void>) {
    setIsBusy(true);
    setEvents((current) => [`${label}...`, ...current]);
    try {
      await fn();
      await loadDashboard();
      setEvents((current) => [`${label} completed`, ...current]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEvents((current) => [`${label} failed: ${message}`, ...current]);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateIntent() {
    await runStep("Create checkout", async () => {
      const serviceRequest = await createServiceRequest({
        service_id: serviceID,
        description
      });

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
    await runStep("Connect wallet", async () => {
      await requestCoston2Network();

      if (!window.ethereum) {
        throw new Error("MetaMask or another EIP-1193 wallet was not found.");
      }

      const addresses = (await window.ethereum.request({
        method: "eth_requestAccounts"
      })) as string[];

      setWalletAddress(addresses[0] || "");
    });
  }

  async function handlePayOnFlare() {
    await runStep("Pay on Flare Coston2", async () => {
      if (!paymentIntent) {
        throw new Error("Create a payment intent first.");
      }
      if (!contractAddress) {
        throw new Error("Set VITE_STABLEFLOW_PAYMENT_CONTRACT or paste a contract address.");
      }
      if (!window.ethereum) {
        throw new Error("MetaMask or another EIP-1193 wallet was not found.");
      }

      await requestCoston2Network();

      const walletClient = createWalletClient({
        chain: coston2,
        transport: custom(window.ethereum)
      });
      const publicClient = createPublicClient({ chain: coston2, transport: http(coston2.rpcUrls.default.http[0]) });

      const [account] = await walletClient.getAddresses();
      if (!account) {
        throw new Error("Wallet account not connected.");
      }

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
    await runStep("Confirm backend payment", async () => {
      if (!paymentIntent) {
        throw new Error("Create a payment intent first.");
      }
      if (!txHash) {
        throw new Error("Submit a Flare transaction first, or paste a tx hash.");
      }

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
    await runStep("Load demo transaction", async () => {
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

  function openOperations(view: DataView) {
    setActiveView(view);
    document.getElementById("operations-data")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Radio size={20} />
          </div>
          <div>
            <strong>StableFlow</strong>
            <span>AgentPay Console</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Payment operations">
          <NavItem icon={<LayoutDashboard size={18} />} label="Overview" active onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
          <NavItem icon={<CreditCard size={18} />} label="New checkout" onClick={() => document.getElementById("checkout-composer")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
          <NavItem icon={<ReceiptText size={18} />} label="Payments" onClick={() => openOperations("payments")} />
          <NavItem icon={<Database size={18} />} label="Ledger" onClick={() => openOperations("ledger")} />
          <NavItem icon={<Webhook size={18} />} label="Webhooks" onClick={() => openOperations("webhooks")} />
        </nav>

        <div className="sidebar-footer">
          <div className="network-status">
            <span className="live-dot" />
            <div>
              <strong>Coston2 testnet</strong>
              <span>Chain ID {coston2.id}</span>
            </div>
          </div>
          <p>Flare payment operations</p>
        </div>
      </aside>

      <main className="console-main">
        <header className="workspace-header">
          <div>
            <div className="breadcrumbs">
              <span>Payments</span>
              <ChevronRight size={14} />
              <strong>Operations workspace</strong>
            </div>
            <h1>Payment operations</h1>
            <p>Accept, verify, reconcile, and unlock paid digital services.</p>
          </div>

          <div className="header-actions">
            <div className={`feed-indicator ${isLiveFTSO ? "live" : ""}`}>
              <span className="live-dot" />
              {isLiveFTSO ? "FTSO live feed" : "Quote syncing"}
            </div>
            <button className="button ghost-button" disabled={isBusy} onClick={() => void refreshQuote()}>
              <RefreshCw size={16} />
              Refresh quote
            </button>
            <button className="button primary-button" disabled={isBusy} onClick={() => void handleCreateIntent()}>
              <CreditCard size={16} />
              Create checkout
            </button>
          </div>
        </header>

        <section className="metrics-grid" aria-label="Payment summary">
          <MetricCard icon={<CircleDollarSign size={18} />} label="Quoted payment" value={quote ? `${quote.amount} ${quote.asset}` : "Syncing"} detail={quote ? `$${quote.usd_amount} checkout value` : "Waiting for FTSO"} accent="green" />
          <MetricCard icon={<ReceiptText size={18} />} label="Open intents" value={String(pendingPayments)} detail={`${paymentIntents.length} total checkout records`} accent="gold" />
          <MetricCard icon={<Database size={18} />} label="Ledger entries" value={String(ledgerEntries.length)} detail="Verified payment records" accent="slate" />
          <MetricCard icon={<Webhook size={18} />} label="Webhook delivery" value={`${deliveredWebhooks}/${webhookEvents.length}`} detail={latestWebhook?.status || "No delivery yet"} accent="green" />
        </section>

        <section className="operations-grid">
          <section className="panel composer-panel" id="checkout-composer">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Checkout composer</span>
                <h2>Create a paid service request</h2>
              </div>
              <div className={`source-badge ${isLiveFTSO ? "verified" : ""}`}>
                <Radio size={14} />
                {isLiveFTSO ? "FTSO verified" : "Quote pending"}
              </div>
            </div>

            <div className="form-grid two-columns">
              <label>
                Service ID
                <input value={serviceID} onChange={(event) => setServiceID(event.target.value)} />
              </label>
              <label>
                USD amount
                <input value={usdAmount} onChange={(event) => setUSDAmount(event.target.value)} inputMode="decimal" />
              </label>
            </div>

            <div className="asset-selector" role="group" aria-label="Settlement asset">
              <div>
                <span className="field-label">Settlement asset</span>
                <strong>Choose the checkout rail</strong>
              </div>
              <div className="segmented-control">
                <button
                  className={paymentAsset === "C2FLR" ? "active" : ""}
                  type="button"
                  onClick={() => setPaymentAsset("C2FLR")}
                  disabled={isBusy}
                >
                  C2FLR
                </button>
                <button
                  className={paymentAsset === "FXRP" ? "active" : ""}
                  type="button"
                  onClick={() => setPaymentAsset("FXRP")}
                  disabled={isBusy}
                >
                  FXRP
                </button>
              </div>
            </div>

            <label>
              Service description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </label>

            <div className="quote-ribbon">
              <div>
                <span>Quoted amount</span>
                <strong>{quote ? `${quote.amount} ${quote.asset}` : "Loading"}</strong>
                <small>{quote ? `$${quote.usd_amount} at $${quote.price_usd} / ${feedAsset}` : "Fetching feed data"}</small>
              </div>
              <div>
                <span>Price source</span>
                <strong>{quote?.price_source || "Loading Flare FTSO"}</strong>
                <small>{quote ? `Updated ${formatDate(quote.price_updated_at)}` : ""}</small>
              </div>
              <div>
                <span>Feed ID</span>
                <strong>{quote ? shortHash(quote.feed_id) : "-"}</strong>
                <small>{quote ? `${feedAsset}/USD block-latency feed` : ""}</small>
              </div>
            </div>

            <div className="form-grid two-columns">
              <label>
                {paymentAsset} amount
                <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
              </label>
              <label>
                Contract address
                <input value={contractAddress} onChange={(event) => setContractAddress(event.target.value)} />
              </label>
            </div>

            <label>
              Webhook destination
              <input value={webhookURL} onChange={(event) => setWebhookURL(event.target.value)} />
            </label>

            <div className="composer-footer">
              <p>Quote expires {quote ? formatDate(quote.expires_at) : "after feed sync"}</p>
              <div className="button-row">
                <button className="button ghost-button" disabled={isBusy} onClick={() => void refreshQuote()}>
                  <RefreshCw size={16} />
                  Update quote
                </button>
                <button className="button primary-button" disabled={isBusy} onClick={() => void handleCreateIntent()}>
                  <CreditCard size={16} />
                  Create checkout
                </button>
              </div>
            </div>
          </section>

          <section className="panel execution-panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Payment execution</span>
                <h2>Verify a checkout on Flare</h2>
              </div>
              <span className={`status-pill ${paymentIntent?.status || "neutral"}`}>{paymentIntent?.status || "Not created"}</span>
            </div>

            <ol className="payment-lifecycle">
              <LifecycleItem complete={Boolean(quote)} index="01" title="Quote ready" detail={quote ? quote.price_source : "Waiting for FTSO"} />
              <LifecycleItem complete={Boolean(paymentIntent)} index="02" title="Checkout created" detail={paymentIntent?.id || "No payment intent"} />
              <LifecycleItem complete={Boolean(txHash)} index="03" title="Payment submitted" detail={shortHash(txHash) || "Awaiting wallet signature"} />
              <LifecycleItem complete={isPaid} index="04" title="Backend confirmed" detail={isPaid ? "Receipt verified" : "Awaiting confirmation"} />
            </ol>

            <div className="wallet-block">
              <div>
                <span className="field-label">Connected wallet</span>
                <strong>{shortHash(walletAddress) || "Not connected"}</strong>
              </div>
              <button className="button ghost-button" disabled={isBusy} onClick={() => void handleConnectWallet()}>
                <Wallet size={16} />
                {walletAddress ? "Reconnect" : "Connect MetaMask"}
              </button>
            </div>

            <div className="execution-actions">
              <button className="button primary-button wide-button" disabled={isBusy || !paymentIntent} onClick={() => void handlePayOnFlare()}>
                <Send size={16} />
                Pay {amount || "0"} {paymentAsset}
              </button>
            </div>

            <label>
              Transaction hash
              <input value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder="0x..." />
            </label>

            <div className="verification-row">
              <label className="toggle-label">
                <input type="checkbox" checked={useChainVerification} onChange={(event) => setUseChainVerification(event.target.checked)} />
                <span>Verify receipt through backend</span>
              </label>
              <button className="button confirm-button" disabled={isBusy || !paymentIntent || !txHash} onClick={() => void handleConfirmBackend()}>
                <ShieldCheck size={16} />
                Confirm payment
              </button>
            </div>

            <button className="text-button" disabled={isBusy} onClick={() => void handleSeedDemoData()}>
              <PlayCircle size={16} />
              Load a completed demo transaction
            </button>
          </section>
        </section>

        <section className="outcome-grid">
          <section className={`panel outcome-panel ${isPaid ? "paid" : ""}`}>
            <div className="outcome-icon">
              {isPaid ? <CheckCircle2 size={21} /> : <LockKeyhole size={21} />}
            </div>
            <div>
              <span className="section-kicker">Service access</span>
              <h2>{isPaid ? "Premium report unlocked" : "Access remains locked"}</h2>
              <p>{isPaid ? serviceID : "Payment receipt has not been confirmed."}</p>
            </div>
            {explorerTxURL && (
              <a className="inline-link" href={explorerTxURL} target="_blank" rel="noreferrer">
                Open transaction <ArrowUpRight size={15} />
              </a>
            )}
          </section>

          <section className="panel outcome-panel">
            <div className="outcome-icon webhook-icon">
              <Webhook size={21} />
            </div>
            <div>
              <span className="section-kicker">Webhook delivery</span>
              <h2>{latestWebhook?.status || "No event delivered"}</h2>
              <p>{latestWebhook?.delivery_url || webhookURL}</p>
            </div>
            <span className={`status-pill ${latestWebhook?.status || "neutral"}`}>{latestWebhook?.status || "Pending"}</span>
          </section>
        </section>

        <section className="panel operations-panel" id="operations-data">
          <div className="operations-header">
            <div>
              <span className="section-kicker">Operations data</span>
              <h2>Reconciliation records</h2>
            </div>
            <div className="tabs" role="tablist" aria-label="Operations data">
              <TabButton active={activeView === "payments"} icon={<FileText size={15} />} label="Payments" onClick={() => setActiveView("payments")} />
              <TabButton active={activeView === "ledger"} icon={<Database size={15} />} label="Ledger" onClick={() => setActiveView("ledger")} />
              <TabButton active={activeView === "webhooks"} icon={<Webhook size={15} />} label="Webhooks" onClick={() => setActiveView("webhooks")} />
            </div>
          </div>

          <div className="table-wrap">
            {activeView === "payments" && <PaymentIntentTable intents={paymentIntents} />}
            {activeView === "ledger" && <LedgerTable entries={ledgerEntries} />}
            {activeView === "webhooks" && <WebhookTable events={webhookEvents} />}
          </div>
          <div className="operations-footer">
            <span>{isLoadingDashboard ? "Refreshing records" : `${activeView === "payments" ? paymentIntents.length : activeView === "ledger" ? ledgerEntries.length : webhookEvents.length} records`}</span>
            <button className="text-button compact-button" disabled={isBusy || isLoadingDashboard} onClick={() => void loadDashboard()}>
              <RefreshCw size={15} />
              Refresh data
            </button>
          </div>
        </section>

        <section className="activity-section">
          <div className="activity-heading">
            <Activity size={18} />
            <div>
              <span className="section-kicker">Session activity</span>
              <h2>Recent operator events</h2>
            </div>
          </div>
          <div className="event-log">
            {events.length === 0 ? <p>No operator activity in this session.</p> : events.map((event, index) => <p key={`${event}-${index}`}>{event}</p>)}
          </div>
          <div className="reconciliation-summary">
            <Link2 size={17} />
            <span>{summary || "Payment summary appears after backend confirmation."}</span>
          </div>
        </section>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MetricCard({ icon, label, value, detail, accent }: { icon: React.ReactNode; label: string; value: string; detail: string; accent: "green" | "gold" | "slate" }) {
  return (
    <article className={`metric-card accent-${accent}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function LifecycleItem({ complete, index, title, detail }: { complete: boolean; index: string; title: string; detail: string }) {
  return (
    <li className={complete ? "complete" : ""}>
      <span className="lifecycle-index">{complete ? <CheckCircle2 size={15} /> : index}</span>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </li>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={`tab-button ${active ? "active" : ""}`} role="tab" aria-selected={active} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function PaymentIntentTable({ intents }: { intents: PaymentIntent[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Payment intent</th>
          <th>Status</th>
          <th>Amount</th>
          <th>Transaction</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {intents.length === 0 ? <EmptyRow colSpan={5} label="No payment intents yet" /> : intents.map((intent) => (
          <tr key={intent.id}>
            <td><strong>{intent.id}</strong></td>
            <td><span className={`status-pill ${intent.status}`}>{intent.status}</span></td>
            <td>{intent.amount} {intent.asset}</td>
            <td>{shortHash(intent.tx_hash) || "-"}</td>
            <td>{formatDate(intent.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Ledger entry</th>
          <th>Payment intent</th>
          <th>Amount</th>
          <th>Type</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {entries.length === 0 ? <EmptyRow colSpan={5} label="No reconciled ledger entries yet" /> : entries.map((entry) => (
          <tr key={entry.id}>
            <td><strong>{entry.id}</strong></td>
            <td>{entry.payment_intent_id}</td>
            <td>{entry.amount} {entry.asset}</td>
            <td>{entry.entry_type}</td>
            <td>{formatDate(entry.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WebhookTable({ events }: { events: WebhookEvent[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Webhook event</th>
          <th>Payment intent</th>
          <th>Status</th>
          <th>Signature</th>
          <th>Delivered</th>
        </tr>
      </thead>
      <tbody>
        {events.length === 0 ? <EmptyRow colSpan={5} label="No webhook events yet" /> : events.map((event) => (
          <tr key={event.id}>
            <td><strong>{event.id}</strong></td>
            <td>{event.payment_intent_id}</td>
            <td><span className={`status-pill ${event.status}`}>{event.status}</span></td>
            <td>{shortHash(event.signature)}</td>
            <td>{formatDate(event.delivered_at || event.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <tr><td className="empty-row" colSpan={colSpan}>{label}</td></tr>;
}

function shortHash(value?: string) {
  if (!value) return "";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
