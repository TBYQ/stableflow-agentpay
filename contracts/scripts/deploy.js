const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error(
      "No deployer account found. Set COSTON2_PRIVATE_KEY in contracts/.env for Coston2 deployments."
    );
  }

  console.log("Deploying StableFlowPayment with:", deployer.address);
  console.log("Network:", hre.network.name);

  const StableFlowPayment = await hre.ethers.getContractFactory("StableFlowPayment");
  const stableFlowPayment = await StableFlowPayment.deploy();
  await stableFlowPayment.waitForDeployment();

  const address = await stableFlowPayment.getAddress();
  console.log("StableFlowPayment deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
