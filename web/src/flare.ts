import { defineChain } from "viem";

export const coston2 = defineChain({
  id: 114,
  name: "Flare Testnet Coston2",
  nativeCurrency: {
    name: "Coston2 Flare",
    symbol: "C2FLR",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["https://coston2-api.flare.network/ext/C/rpc"]
    }
  },
  blockExplorers: {
    default: {
      name: "Coston2 Explorer",
      url: "https://coston2-explorer.flare.network"
    }
  },
  testnet: true
});

export async function requestCoston2Network() {
  if (!window.ethereum) {
    throw new Error("MetaMask or another EIP-1193 wallet was not found.");
  }

  // wallet_addEthereumChain is the most reliable way to make a demo user land
  // on the exact testnet required by the hackathon.
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: "0x72",
        chainName: coston2.name,
        nativeCurrency: coston2.nativeCurrency,
        rpcUrls: coston2.rpcUrls.default.http,
        blockExplorerUrls: [coston2.blockExplorers.default.url]
      }
    ]
  });
}
