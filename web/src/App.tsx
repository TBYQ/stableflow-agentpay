import { CheckCircle2, CreditCard, FileText, Send, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { createWalletClient, custom, parseEther } from "viem";
import {
  confirmPaymentWithChainReceipt,
  confirmPaymentWithSubmittedHash,
  createPaymentIntent,
  createServiceRequest,
  PaymentIntent
} from "./api";
import { coston2, requestCoston2Network } from "./flare";
import { stableFlowPaymentABI } from "./stableflowContract";

const defaultContract = import.meta.env.VITE_STABLEFLOW_PAYMENT_CONTRACT || "";

export function App() {
  const [serviceID, setServiceID] = useState("premium-market-report");
  const [description, setDescription] = useState("AI agent requests access to a paid market report");
  const [amount, setAmount] = useState("0.001");
  const [webhookURL, setWebhookURL] = useState("https://webhook.site/your-demo-url");
  const [contractAddress, setContractAddress] = useState(defaultContract);
  const [walletAddress, setWalletAddress] = useState("");
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [txHash, setTxHash] = useState("");
  const [summary, setSummary] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [useChainVerification, setUseChainVerification] = useState(true);

  const explorerTxURL = useMemo(() => {
    if (!txHash) return "";
    return `${coston2.blockExplorers.default.url}/tx/${txHash}`;
  }, [txHash]);

  async function runStep(label: string, fn: () => Promise<void>) {
    setIsBusy(true);
    setEvents((current) => [`${label}...`, ...current]);
    try {
      await fn();
      setEvents((current) => [`${label} completed`, ...current]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEvents((current) => [`${label} failed: ${message}`, ...current]);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateIntent() {
    await runStep("Create payment intent", async () => {
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

      // This is the actual on-chain transaction. The contract emits
      // PaymentRecorded, which the Go backend can verify from the receipt.
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
      setSummary(response.summary);
    });
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Flare Coston2 MVP</p>
          <h1>StableFlow AgentPay</h1>
        </div>
        <div className="network-pill">Chain ID 114 · C2FLR</div>
      </header>

      <section className="grid">
        <div className="panel">
          <div className="panel-title">
            <FileText size={18} />
            <h2>Payment Intent</h2>
          </div>

          <label>
            Service ID
            <input value={serviceID} onChange={(event) => setServiceID(event.target.value)} />
          </label>

          <label>
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </label>

          <label>
            Amount
            <input value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>

          <label>
            Webhook URL
            <input value={webhookURL} onChange={(event) => setWebhookURL(event.target.value)} />
          </label>

          <label>
            Contract Address
            <input value={contractAddress} onChange={(event) => setContractAddress(event.target.value)} />
          </label>

          <button disabled={isBusy} onClick={handleCreateIntent}>
            <CreditCard size={16} />
            Create Intent
          </button>
        </div>

        <div className="panel">
          <div className="panel-title">
            <Wallet size={18} />
            <h2>Wallet & Chain</h2>
          </div>

          <button disabled={isBusy} onClick={handleConnectWallet}>
            <Wallet size={16} />
            Connect MetaMask
          </button>

          <dl className="facts">
            <div>
              <dt>Wallet</dt>
              <dd>{walletAddress || "Not connected"}</dd>
            </div>
            <div>
              <dt>Payment Intent</dt>
              <dd>{paymentIntent?.id || "Not created"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{paymentIntent?.status || "N/A"}</dd>
            </div>
          </dl>

          <button disabled={isBusy || !paymentIntent} onClick={handlePayOnFlare}>
            <Send size={16} />
            Pay on Flare
          </button>

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
            Verify transaction receipt through backend
          </label>

          <button disabled={isBusy || !paymentIntent || !txHash} onClick={handleConfirmBackend}>
            <CheckCircle2 size={16} />
            Confirm Backend
          </button>
        </div>

        <div className="panel wide">
          <div className="panel-title">
            <CheckCircle2 size={18} />
            <h2>Demo State</h2>
          </div>

          {explorerTxURL && (
            <a className="tx-link" href={explorerTxURL} target="_blank" rel="noreferrer">
              Open transaction in Coston2 Explorer
            </a>
          )}

          <pre>{JSON.stringify({ paymentIntent, summary }, null, 2)}</pre>

          <div className="event-log">
            {events.map((event, index) => (
              <p key={`${event}-${index}`}>{event}</p>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
