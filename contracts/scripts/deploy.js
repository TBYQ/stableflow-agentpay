const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error(
      "No deployer account found. Set COSTON2_PRIVATE_KEY in contracts/.env for Coston2 deployments."
    );
  }

  console.log("Deploying StableFlow contracts with:", deployer.address);
  console.log("Network:", hre.network.name);

  const registry = new hre.ethers.Contract(
    "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019",
    ["function getContractAddressByName(string) view returns (address)"],
    hre.ethers.provider
  );
  const assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
  const assetManager = new hre.ethers.Contract(
    assetManagerAddress,
    ["function fAsset() view returns (address)"],
    hre.ethers.provider
  );
  const fxrpAddress = await assetManager.fAsset();
  const settlementRecipient = process.env.STABLEFLOW_SETTLEMENT_RECIPIENT;
  if (!settlementRecipient) {
    throw new Error(
      "Set STABLEFLOW_SETTLEMENT_RECIPIENT in contracts/.env to a dedicated merchant test wallet before deploying."
    );
  }
  if (settlementRecipient.toLowerCase() === deployer.address.toLowerCase()) {
    throw new Error(
      "STABLEFLOW_SETTLEMENT_RECIPIENT must differ from the deployment wallet. A payment to yourself is rejected by FTestXRP."
    );
  }

  console.log("FXRP Asset Manager:", assetManagerAddress);
  console.log("FXRP resolved through registry:", fxrpAddress);
  console.log("Settlement recipient:", settlementRecipient);

  const StableFlowPayment = await hre.ethers.getContractFactory("StableFlowPayment");
  const stableFlowPayment = await StableFlowPayment.deploy(fxrpAddress, settlementRecipient);
  await stableFlowPayment.waitForDeployment();

  const paymentAddress = await stableFlowPayment.getAddress();
  console.log("StableFlowPayment deployed to:", paymentAddress);

  const StableFlowFDCPaymentProof = await hre.ethers.getContractFactory("StableFlowFDCPaymentProof");
  const stableFlowFDCProof = await StableFlowFDCPaymentProof.deploy();
  await stableFlowFDCProof.waitForDeployment();
  console.log("StableFlowFDCPaymentProof deployed to:", await stableFlowFDCProof.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
