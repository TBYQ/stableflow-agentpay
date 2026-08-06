import {
  Activity,
  CheckCircle2,
  CreditCard,
  Database,
  ExternalLink,
  FileText,
  PlayCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet,
  Webhook
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, parseEther } from "viem";
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
import { stableFlowPaymentABI } from "./stableflowContract";

const defaultContract = import.meta.env.VITE_STABLEFLOW_PAYMENT_CONTRACT || "";

export function App() {
  const [serviceID, setServiceID] = useState("premium-market-report");
  const [description, setDescription] = useState("Paid market report access for a merchant checkout demo");
  const [usdAmount, setUSDAmount] = useState("0.01");
  const [amount, setAmount] = useState("0.001");
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

  const explorerTxURL = useMemo(() => {
    const hash = txHash || paymentIntent?.tx_hash;
    if (!hash) return "";
    return `${coston2.blockExplorers.default.url}/tx/${hash}`;
  }, [paymentIntent?.tx_hash, txHash]);

  const latestWebhook = webhookEvent || webhookEvents[0] || null;
  const currentLedgerEntry =
    ledgerEntry || ledgerEntries.find((entry) => entry.payment_intent_id === paymentIntent?.id) || null;
  const isPaid = paymentIntent?.status === "paid";

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshQuote(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [usdAmount]);

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
      const nextQuote = await quotePayment(usdAmount, "C2FLR");
      setQuote(nextQuote);
      setAmount(nextQuote.amount);
      if (logEvent) {
        setEvents((current) => [`Quote refreshed: $${nextQuote.usd_amount} -> ${nextQuote.amount} C2FLR`, ...current]);
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
        asset: "C2FLR",
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

      const [account] = await walletClient.getAddresses();
      if (!account) {
        throw new Error("Wallet account not connected.");
      }

      const hash = await walletClient.writeContract({
        account,
        address: contractAddress as `0x${string}`,
        abi: stableFlowPaymentABI,
        functionName: "recordPayment",
        args: [paymentIntent.id, serviceID],
        value: parseEther(amount)
      });

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
    await runStep("Seed demo data", async () => {
      const response = await seedDemoData({
        service_id: serviceID,
        description,
        usd_amount: usdAmount,
        amount,
        asset: "C2FLR",
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

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Flare Coston2 Merchant Console</p>
          <h1>StableFlow AgentPay</h1>
        </div>
        <div className="network-pill">Chain ID 114 · C2FLR</div>
      </header>

      <section className="status-strip">
        <StatusMetric label="Quote" value={quote ? `$${quote.usd_amount} -> ${quote.amount} ${quote.asset}` : "Loading"} />
        <StatusMetric label="Intent" value={paymentIntent?.status || "Not created"} />
        <StatusMetric label="Ledger" value={`${ledgerEntries.length} entries`} />
        <StatusMetric label="Webhook" value={latestWebhook?.status || "No event"} />
      </section>

      <section className="workspace">
        <section className="panel checkout-panel">
          <div className="panel-title">
            <CreditCard size={18} />
            <h2>Checkout Builder</h2>
          </div>

          <div className="form-grid">
            <label>
              Service ID
              <input value={serviceID} onChange={(event) => setServiceID(event.target.value)} />
            </label>

            <label>
              USD price
              <input value={usdAmount} onChange={(event) => setUSDAmount(event.target.value)} />
            </label>
          </div>

          <label>
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </label>

          <div className="form-grid">
            <label>
              C2FLR amount
              <input value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>

            <label>
              Quote source
              <input value={quote?.price_source || "demo-ftso-style-static"} readOnly />
            </label>
          </div>

          <label>
            Webhook URL
            <input value={webhookURL} onChange={(event) => setWebhookURL(event.target.value)} />
          </label>

          <label>
            Contract Address
            <input value={contractAddress} onChange={(event) => setContractAddress(event.target.value)} />
          </label>

          <div className="button-row">
            <button disabled={isBusy} onClick={() => void refreshQuote()}>
              <RefreshCw size={16} />
              Refresh Quote
            </button>
            <button disabled={isBusy} onClick={handleCreateIntent}>
              <CreditCard size={16} />
              Create Checkout
            </button>
          </div>
        </section>

        <section className="panel payment-panel">
          <div className="panel-title">
            <Wallet size={18} />
            <h2>Wallet & Payment</h2>
          </div>

          <div className="button-row">
            <button disabled={isBusy} onClick={handleConnectWallet}>
              <Wallet size={16} />
              Connect MetaMask
            </button>
            <button disabled={isBusy || !paymentIntent} onClick={handlePayOnFlare}>
              <Send size={16} />
              Pay on Flare
            </button>
          </div>

          <dl className="facts">
            <Fact label="Wallet" value={walletAddress || "Not connected"} />
            <Fact label="Payment Intent" value={paymentIntent?.id || "Not created"} />
            <Fact label="Status" value={paymentIntent?.status || "N/A"} />
          </dl>

          <label>
            Transaction Hash
            <input value={txHash} onChange={(event) => setTxHash(event.target.value)} />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={useChainVerification}
              onChange={(event) => setUseChainVerification(event.target.checked)}
            />
            Verify receipt through backend
          </label>

          <div className="button-row">
            <button disabled={isBusy || !paymentIntent || !txHash} onClick={handleConfirmBackend}>
              <CheckCircle2 size={16} />
              Confirm Backend
            </button>
            <button className="secondary" disabled={isBusy} onClick={handleSeedDemoData}>
              <PlayCircle size={16} />
              Seed Demo
            </button>
          </div>
        </section>

        <section className={`panel access-panel ${isPaid ? "paid" : ""}`}>
          <div className="panel-title">
            <ShieldCheck size={18} />
            <h2>Access Outcome</h2>
          </div>

          <div className="unlock-state">
            <CheckCircle2 size={24} />
            <div>
              <strong>{isPaid ? "Premium report unlocked" : "Awaiting payment confirmation"}</strong>
              <span>{isPaid ? serviceID : "Service access remains locked"}</span>
            </div>
          </div>

          <dl className="facts compact">
            <Fact label="Ledger Entry" value={currentLedgerEntry?.id || "Not written"} />
            <Fact label="Webhook Event" value={latestWebhook?.id || "Not delivered"} />
            <Fact label="Summary" value={summary || "No paid summary yet"} />
          </dl>

          {explorerTxURL && (
            <a className="tx-link" href={explorerTxURL} target="_blank" rel="noreferrer">
              <ExternalLink size={15} />
              Open Coston2 transaction
            </a>
          )}
        </section>

        <section className="panel webhook-panel">
          <div className="panel-title">
            <Webhook size={18} />
            <h2>Webhook Inspector</h2>
          </div>

          <dl className="facts compact">
            <Fact label="Event ID" value={latestWebhook?.id || "No event"} />
            <Fact label="Delivery URL" value={latestWebhook?.delivery_url || webhookURL} />
            <Fact label="Signature" value={latestWebhook?.signature || "Not signed yet"} />
            <Fact label="Status" value={latestWebhook?.status || "N/A"} />
          </dl>
        </section>
      </section>

      <section className="dashboard-grid">
        <DataPanel
          icon={<FileText size={18} />}
          title="Payment Intents"
          count={paymentIntents.length}
          isLoading={isLoadingDashboard}
        >
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Tx</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {paymentIntents.map((intent) => (
                <tr key={intent.id}>
                  <td>{intent.id}</td>
                  <td>
                    <span className={`status ${intent.status}`}>{intent.status}</span>
                  </td>
                  <td>
                    {intent.amount} {intent.asset}
                  </td>
                  <td>{shortHash(intent.tx_hash) || "-"}</td>
                  <td>{formatDate(intent.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>

        <DataPanel icon={<Database size={18} />} title="Ledger" count={ledgerEntries.length} isLoading={isLoadingDashboard}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Intent</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.id}</td>
                  <td>{entry.payment_intent_id}</td>
                  <td>
                    {entry.amount} {entry.asset}
                  </td>
                  <td>{entry.entry_type}</td>
                  <td>{formatDate(entry.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>

        <DataPanel
          icon={<Webhook size={18} />}
          title="Webhook Events"
          count={webhookEvents.length}
          isLoading={isLoadingDashboard}
        >
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Intent</th>
                <th>Status</th>
                <th>Signature</th>
                <th>Delivered</th>
              </tr>
            </thead>
            <tbody>
              {webhookEvents.map((event) => (
                <tr key={event.id}>
                  <td>{event.id}</td>
                  <td>{event.payment_intent_id}</td>
                  <td>
                    <span className={`status ${event.status}`}>{event.status}</span>
                  </td>
                  <td>{shortHash(event.signature)}</td>
                  <td>{formatDate(event.delivered_at || event.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>

        <section className="panel activity-panel">
          <div className="panel-title">
            <Activity size={18} />
            <h2>Activity</h2>
          </div>
          <div className="event-log">
            {events.length === 0 ? <p>No local activity yet</p> : events.map((event, index) => <p key={`${event}-${index}`}>{event}</p>)}
          </div>
        </section>
      </section>
    </main>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DataPanel({
  icon,
  title,
  count,
  isLoading,
  children
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  isLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="panel data-panel">
      <div className="panel-title split-title">
        <div>
          {icon}
          <h2>{title}</h2>
        </div>
        <span>{isLoading ? "Loading" : `${count} rows`}</span>
      </div>
      <div className="table-wrap">{children}</div>
    </section>
  );
}

function shortHash(value?: string) {
  if (!value) return "";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
