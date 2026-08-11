const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { AbiCoder, Contract, encodeBytes32String } = require("ethers");

const registryAddress = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
const publicVerifierAPIKey = "00000000-0000-0000-0000-000000000000";
const paymentResponseType =
  "tuple(bytes32 attestationType,bytes32 sourceId,uint64 votingRound,uint64 lowestUsedTimestamp,tuple(bytes32 transactionId,uint256 inUtxo,uint256 utxo) requestBody,tuple(uint64 blockNumber,uint64 blockTimestamp,bytes32 sourceAddressHash,bytes32 sourceAddressesRoot,bytes32 receivingAddressHash,bytes32 intendedReceivingAddressHash,int256 spentAmount,int256 intendedSpentAmount,int256 receivedAmount,int256 intendedReceivedAmount,bytes32 standardPaymentReference,bool oneToOne,uint8 status) responseBody)";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for this FDC step.`);
  return value;
}

function optionalHeader(apiKey) {
  return apiKey ? { "X-API-KEY": apiKey } : {};
}

function bytes32Text(value) {
  return encodeBytes32String(value);
}

function workspaceFile(intentID) {
  const dataDirectory = path.join(__dirname, "..", "data");
  fs.mkdirSync(dataDirectory, { recursive: true });
  return path.join(dataDirectory, `fdc-xrp-${intentID}.json`);
}

async function requestJSON(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`FDC service returned ${response.status}: ${payload.message || payload.error || JSON.stringify(payload)}`);
  }
  return payload;
}

async function resolveRegistryContract(name, abi) {
  const registry = new Contract(
    registryAddress,
    ["function getContractAddressByName(string) view returns (address)"],
    hre.ethers.provider
  );
  return new Contract(await registry.getContractAddressByName(name), abi, hre.ethers.provider);
}

async function prepare(intentID, transactionID) {
  const body = {
    attestationType: bytes32Text("Payment"),
    sourceId: bytes32Text("testXRP"),
    requestBody: { transactionId: transactionID.replace(/^0x/i, ""), inUtxo: "0", utxo: "0" }
  };
  const verifierURL = `${env("FDC_VERIFIER_URL").replace(/\/$/, "")}/xrp/Payment/prepareRequest`;
  const payload = await requestJSON(verifierURL, body, optionalHeader(process.env.FDC_VERIFIER_API_KEY || publicVerifierAPIKey));
  if (payload.status && payload.status !== "VALID") {
    throw new Error(`FDC verifier rejected the XRPL transaction: ${payload.status}`);
  }
  const abiEncodedRequest = payload.abiEncodedRequest || payload.data?.abiEncodedRequest;
  if (!abiEncodedRequest) throw new Error("The FDC verifier response did not include abiEncodedRequest.");

  const state = { intentID, transactionID, abiEncodedRequest, preparedAt: new Date().toISOString() };
  fs.writeFileSync(workspaceFile(intentID), `${JSON.stringify(state, null, 2)}\n`);
  console.log("FDC request prepared:", workspaceFile(intentID));
  console.log("Next: npm run fdc:xrp -- submit", intentID);
}

async function submit(intentID) {
  const file = workspaceFile(intentID);
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error("No deployer account found. Set COSTON2_PRIVATE_KEY in contracts/.env.");
  const feeConfig = await resolveRegistryContract("FdcRequestFeeConfigurations", ["function getRequestFee(bytes) view returns (uint256)"]);
  const fdcHub = await resolveRegistryContract("FdcHub", ["function requestAttestation(bytes) payable"]);
  const fee = await feeConfig.getRequestFee(state.abiEncodedRequest);
  const tx = await fdcHub.connect(signer).requestAttestation(state.abiEncodedRequest, { value: fee });
  const receipt = await tx.wait();
  const systemsManager = await resolveRegistryContract("FlareSystemsManager", ["function getCurrentVotingEpochId() view returns (uint32)"]);
  const votingRound = await systemsManager.getCurrentVotingEpochId({ blockTag: receipt.blockNumber });
  Object.assign(state, {
    submissionTxHash: tx.hash,
    requestFeeWei: fee.toString(),
    votingRound: votingRound.toString(),
    submittedAt: new Date().toISOString()
  });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
  console.log("FDC request submitted:", tx.hash);
  console.log("Voting round:", votingRound.toString());
  console.log("Wait 90-180 seconds, then run: npm run fdc:xrp -- retrieve", intentID);
}

async function retrieve(intentID) {
  const file = workspaceFile(intentID);
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  const payload = await requestJSON(
    `${env("COSTON2_DA_LAYER_URL").replace(/\/$/, "")}/api/v1/fdc/proof-by-request-round-raw`,
    { votingRoundId: state.votingRound, requestBytes: state.abiEncodedRequest },
    optionalHeader(process.env.COSTON2_DA_LAYER_API_KEY)
  );
  const proof = payload.proof || payload.merkleProof || payload.data?.proof;
  const responseHex = payload.response_hex || payload.responseHex || payload.data?.response_hex;
  if (!Array.isArray(proof) || !responseHex) {
    throw new Error("The DA layer response did not include a payment proof and ABI-encoded response.");
  }
  const decoded = AbiCoder.defaultAbiCoder().decode([paymentResponseType], responseHex)[0];
  state.proof = { merkleProof: proof, data: decoded };
  state.retrievedAt = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
  console.log("FDC proof retrieved:", file);
  console.log("Next: npm run fdc:xrp -- register", intentID);
}

async function register(intentID) {
  const file = workspaceFile(intentID);
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!state.proof) throw new Error("No retrieved proof found. Run the retrieve step after the FDC round finalizes.");
  const contractAddress = env("STABLEFLOW_FDC_PROOF_CONTRACT");
  const contract = await hre.ethers.getContractAt("StableFlowFDCPaymentProof", contractAddress);
  const tx = await contract.registerXRPPayment(intentID, state.proof);
  const receipt = await tx.wait();
  state.registrationTxHash = tx.hash;
  state.registeredAt = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
  console.log("FDC XRP payment proof registered:", tx.hash);
  console.log("Block:", receipt.blockNumber);
}

async function main() {
  const [cliStep, cliIntentID, cliTransactionID] = process.argv.slice(2);
  const step = process.env.FDC_STEP || cliStep;
  const intentID = process.env.FDC_PAYMENT_INTENT_ID || cliIntentID;
  const transactionID = process.env.FDC_XRP_TRANSACTION_ID || cliTransactionID;
  if (!step || !intentID) {
    throw new Error("Set FDC_STEP and FDC_PAYMENT_INTENT_ID before running npm run fdc:xrp.");
  }
  if (step === "reference") {
    console.log(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(intentID)));
    return;
  }
  if (step === "prepare") {
    const externalTransactionID = transactionID;
    if (!externalTransactionID) throw new Error("Provide the XRPL transaction id as the third argument or FDC_XRP_TRANSACTION_ID.");
    return prepare(intentID, externalTransactionID);
  }
  if (step === "submit") return submit(intentID);
  if (step === "retrieve") return retrieve(intentID);
  if (step === "register") return register(intentID);
  throw new Error(`Unknown FDC step: ${step}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
