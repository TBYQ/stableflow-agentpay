require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const COSTON2_RPC_URL =
  process.env.COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";

const COSTON2_PRIVATE_KEY = process.env.COSTON2_PRIVATE_KEY;

/**
 * Hardhat keeps network configuration close to the contract code.
 *
 * The Coston2 account is optional so local compile/test commands work even
 * before a developer creates a funded test wallet. Deployment commands will
 * fail clearly if COSTON2_PRIVATE_KEY is missing.
 */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    coston2: {
      url: COSTON2_RPC_URL,
      chainId: 114,
      accounts: COSTON2_PRIVATE_KEY ? [COSTON2_PRIVATE_KEY] : []
    }
  }
};
