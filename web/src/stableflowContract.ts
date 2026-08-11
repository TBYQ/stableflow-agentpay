export const stableFlowPaymentABI = [
  {
    type: "function",
    name: "fxrp",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "recordPayment",
    stateMutability: "payable",
    inputs: [
      { name: "paymentIntentId", type: "string" },
      { name: "serviceId", type: "string" }
    ],
    outputs: [{ name: "paymentIntentHash", type: "bytes32" }]
  },
  {
    type: "function",
    name: "recordFXRPPayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentIntentId", type: "string" },
      { name: "serviceId", type: "string" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "paymentIntentHash", type: "bytes32" }]
  },
  {
    type: "event",
    name: "PaymentRecorded",
    inputs: [
      { name: "paymentIntentHash", type: "bytes32", indexed: true },
      { name: "paymentIntentId", type: "string", indexed: false },
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "asset", type: "string", indexed: false },
      { name: "serviceId", type: "string", indexed: false },
      { name: "chainId", type: "uint256", indexed: false },
      { name: "recordedAt", type: "uint256", indexed: false }
    ]
  }
] as const;

export const erc20ApprovalABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;
