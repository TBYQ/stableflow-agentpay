const hre = require("hardhat");

async function main() {
  const contractAddress = process.env.STABLEFLOW_PAYMENT_CONTRACT;
  if (!contractAddress) {
    throw new Error("Set STABLEFLOW_PAYMENT_CONTRACT in contracts/.env.");
  }

  const paymentIntentId = process.env.STABLEFLOW_PAYMENT_INTENT_ID || "pi_001";
  const serviceId = process.env.STABLEFLOW_SERVICE_ID || "premium-market-report";
  const amount = process.env.STABLEFLOW_PAYMENT_AMOUNT || "0.001";

  const [payer] = await hre.ethers.getSigners();
  const stableFlowPayment = await hre.ethers.getContractAt(
    "StableFlowPayment",
    contractAddress,
    payer
  );

  console.log("Recording demo payment");
  console.log("payer:", payer.address);
  console.log("paymentIntentId:", paymentIntentId);
  console.log("serviceId:", serviceId);
  console.log("amount:", amount);

  const tx = await stableFlowPayment.recordPayment(paymentIntentId, serviceId, {
    value: hre.ethers.parseEther(amount)
  });

  console.log("tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("confirmed in block:", receipt.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
