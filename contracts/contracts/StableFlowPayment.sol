// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title StableFlowPayment
 * @notice Payment-recording contract for the StableFlow AgentPay MVP.
 *
 * The contract intentionally does not implement a full checkout, merchant
 * account system, or settlement protocol. Those responsibilities live in the
 * Go backend, where payment intents, ledger reconciliation, webhook delivery,
 * and summaries can evolve faster.
 *
 * It accepts the Coston2 native asset and FXRP, the FAsset representation of
 * XRP on Flare. Both routes emit the same reconciliation event so the backend
 * can verify a checkout without trusting browser-provided payment metadata.
 */
interface IERC20TransferFrom {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract StableFlowPayment {
    string public constant nativeAsset = "C2FLR";
    string public constant fxrpAsset = "FXRP";

    IERC20TransferFrom public immutable fxrp;
    address payable public immutable settlementRecipient;

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
    error InvalidSettlementRecipient();
    error InvalidFXRPToken();
    error FXRPTransferFailed();
    error NativeSettlementFailed();

    constructor(address fxrpToken, address payable merchantRecipient) {
        if (fxrpToken == address(0)) {
            revert InvalidFXRPToken();
        }
        if (merchantRecipient == address(0)) {
            revert InvalidSettlementRecipient();
        }
        fxrp = IERC20TransferFrom(fxrpToken);
        settlementRecipient = merchantRecipient;
    }

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
        if (msg.value == 0) {
            revert ZeroPaymentAmount();
        }

        paymentIntentHash = _recordPayment(paymentIntentId, serviceId, msg.value, nativeAsset);
        (bool sent,) = settlementRecipient.call{value: msg.value}("");
        if (!sent) {
            revert NativeSettlementFailed();
        }
    }

    /**
     * @notice Records an FXRP payment after the payer grants this contract an ERC-20 allowance.
     * @dev FXRP is forwarded to the merchant recipient in the same transaction. The
     * event still originates from this contract, so reconciliation stays uniform.
     */
    function recordFXRPPayment(
        string calldata paymentIntentId,
        string calldata serviceId,
        uint256 amount
    ) external returns (bytes32 paymentIntentHash) {
        if (amount == 0) {
            revert ZeroPaymentAmount();
        }

        paymentIntentHash = _recordPayment(paymentIntentId, serviceId, amount, fxrpAsset);
        if (!fxrp.transferFrom(msg.sender, settlementRecipient, amount)) {
            revert FXRPTransferFailed();
        }
    }

    function _recordPayment(
        string calldata paymentIntentId,
        string calldata serviceId,
        uint256 amount,
        string memory asset
    ) private returns (bytes32 paymentIntentHash) {
        if (bytes(paymentIntentId).length == 0) {
            revert EmptyPaymentIntentId();
        }
        if (bytes(serviceId).length == 0) {
            revert EmptyServiceId();
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
            amount: amount,
            chainId: block.chainid,
            recordedAt: recordedAt
        });

        emit PaymentRecorded(
            paymentIntentHash,
            paymentIntentId,
            msg.sender,
            amount,
            asset,
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
