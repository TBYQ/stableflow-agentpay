// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title StableFlowPayment
 * @notice Minimal payment-recording contract for the StableFlow AgentPay MVP.
 *
 * The contract intentionally does not implement a full checkout, merchant
 * account system, or settlement protocol. Those responsibilities live in the
 * Go backend, where payment intents, ledger reconciliation, webhook delivery,
 * and summaries can evolve faster.
 *
 * For the hackathon MVP, this contract provides the one thing the backend needs
 * from Flare Coston2: a real on-chain transaction that emits a stable payment
 * confirmation event.
 */
contract StableFlowPayment {
    string public constant nativeAsset = "C2FLR";

    struct PaymentRecord {
        string paymentIntentId;
        string serviceId;
        address payer;
        uint256 amount;
        uint256 chainId;
        uint256 recordedAt;
    }

    mapping(bytes32 => PaymentRecord) private records;

    event PaymentRecorded(
        bytes32 indexed paymentIntentHash,
        string paymentIntentId,
        address indexed payer,
        uint256 amount,
        string asset,
        string serviceId,
        uint256 chainId,
        uint256 recordedAt
    );

    error EmptyPaymentIntentId();
    error EmptyServiceId();
    error ZeroPaymentAmount();
    error PaymentAlreadyRecorded(bytes32 paymentIntentHash);
    error PaymentNotFound(bytes32 paymentIntentHash);

    /**
     * @notice Records a native C2FLR payment for a backend-created payment intent.
     * @param paymentIntentId The backend payment intent id, for example "pi_001".
     * @param serviceId The paid service identifier, for example "premium-report".
     *
     * The backend watches PaymentRecorded and reconciles the event with its
     * PaymentIntent aggregate. The hash is indexed for efficient filtering,
     * while the original string id is included for readable demos.
     */
    function recordPayment(
        string calldata paymentIntentId,
        string calldata serviceId
    ) external payable returns (bytes32 paymentIntentHash) {
        if (bytes(paymentIntentId).length == 0) {
            revert EmptyPaymentIntentId();
        }
        if (bytes(serviceId).length == 0) {
            revert EmptyServiceId();
        }
        if (msg.value == 0) {
            revert ZeroPaymentAmount();
        }

        paymentIntentHash = keccak256(bytes(paymentIntentId));
        if (records[paymentIntentHash].recordedAt != 0) {
            revert PaymentAlreadyRecorded(paymentIntentHash);
        }

        uint256 recordedAt = block.timestamp;
        records[paymentIntentHash] = PaymentRecord({
            paymentIntentId: paymentIntentId,
            serviceId: serviceId,
            payer: msg.sender,
            amount: msg.value,
            chainId: block.chainid,
            recordedAt: recordedAt
        });

        emit PaymentRecorded(
            paymentIntentHash,
            paymentIntentId,
            msg.sender,
            msg.value,
            nativeAsset,
            serviceId,
            block.chainid,
            recordedAt
        );
    }

    /**
     * @notice Reads a payment by backend payment intent id.
     * @dev Returning a struct keeps the demo script and future UI simple.
     */
    function getPaymentByIntentId(
        string calldata paymentIntentId
    ) external view returns (PaymentRecord memory record) {
        bytes32 paymentIntentHash = keccak256(bytes(paymentIntentId));
        record = records[paymentIntentHash];
        if (record.recordedAt == 0) {
            revert PaymentNotFound(paymentIntentHash);
        }
    }
}
