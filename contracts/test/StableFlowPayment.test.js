const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("StableFlowPayment", function () {
  async function deployFixture() {
    const [payer] = await ethers.getSigners();
    const StableFlowPayment = await ethers.getContractFactory("StableFlowPayment");
    const contract = await StableFlowPayment.deploy();
    await contract.waitForDeployment();
    return { contract, payer };
  }

  it("records a native payment and emits PaymentRecorded", async function () {
    const { contract, payer } = await deployFixture();

    const tx = contract.recordPayment("pi_001", "premium-market-report", {
      value: ethers.parseEther("0.001")
    });

    await expect(tx)
      .to.emit(contract, "PaymentRecorded")
      .withArgs(
        ethers.keccak256(ethers.toUtf8Bytes("pi_001")),
        "pi_001",
        payer.address,
        ethers.parseEther("0.001"),
        "C2FLR",
        "premium-market-report",
        31337,
        anyValue
      );

    const record = await contract.getPaymentByIntentId("pi_001");
    expect(record.paymentIntentId).to.equal("pi_001");
    expect(record.serviceId).to.equal("premium-market-report");
    expect(record.payer).to.equal(payer.address);
    expect(record.amount).to.equal(ethers.parseEther("0.001"));
  });

  it("rejects duplicate payment intent ids", async function () {
    const { contract } = await deployFixture();

    await contract.recordPayment("pi_001", "premium-market-report", {
      value: ethers.parseEther("0.001")
    });

    await expect(
      contract.recordPayment("pi_001", "premium-market-report", {
        value: ethers.parseEther("0.001")
      })
    ).to.be.revertedWithCustomError(contract, "PaymentAlreadyRecorded");
  });
});
