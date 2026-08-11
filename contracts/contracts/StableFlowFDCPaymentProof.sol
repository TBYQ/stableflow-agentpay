// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IFdcVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IFdcVerification.sol";
import {IPayment} from "@flarenetwork/flare-periphery-contracts/coston2/IPayment.sol";

/**
 * @title StableFlowFDCPaymentProof
 * @notice Stores only XRP payments that have been verified by Flare Data Connector.
 *
 * A payer places keccak256(paymentIntentId) as the exact 32-byte XRPL MemoData.
 * The FDC proof is then verified on Coston2 before the external XRP payment is
 * accepted as a reconciliation record.
 */
contract StableFlowFDCPaymentProof {
    bytes32 public constant PAYMENT_ATTESTATION_TYPE = bytes32("Payment");
    bytes32 public constant TEST_XRP_SOURCE = bytes32("testXRP");

    struct ExternalPaymentRecord {
        bytes32 transactionId;
        bytes32 paymentReference;
        bytes32 receivingAddressHash;
        int256 receivedAmountDrops;
        uint64 blockNumber;
        uint64 blockTimestamp;
        uint64 votingRound;
        address submittedBy;
    }

    mapping(bytes32 => ExternalPaymentRecord) private records;

    event XRPPaymentProved(
        bytes32 indexed paymentIntentHash,
        string paymentIntentId,
        bytes32 indexed transactionId,
        bytes32 paymentReference,
        bytes32 receivingAddressHash,
        int256 receivedAmountDrops,
        uint64 votingRound,
        uint64 blockTimestamp,
        address indexed submittedBy
    );

    error EmptyPaymentIntentId();
    error PaymentAlreadyProved(bytes32 paymentIntentHash);
    error InvalidFDCProof();
    error UnexpectedAttestationType(bytes32 actual);
    error UnexpectedSource(bytes32 actual);
    error ExternalPaymentFailed(uint8 status);
    error NonPositiveExternalAmount();
    error PaymentReferenceMismatch(bytes32 expected, bytes32 actual);
    error PaymentNotFound(bytes32 paymentIntentHash);

    /**
     * @notice Returns the exact 32-byte reference a payer must put in XRPL MemoData.
     */
    function paymentReferenceFor(string calldata paymentIntentId) public pure returns (bytes32) {
        return keccak256(bytes(paymentIntentId));
    }

    function registerXRPPayment(
        string calldata paymentIntentId,
        IPayment.Proof calldata proof
    ) external returns (bytes32 paymentIntentHash) {
        if (bytes(paymentIntentId).length == 0) {
            revert EmptyPaymentIntentId();
        }
        if (proof.data.attestationType != PAYMENT_ATTESTATION_TYPE) {
            revert UnexpectedAttestationType(proof.data.attestationType);
        }
        if (proof.data.sourceId != TEST_XRP_SOURCE) {
            revert UnexpectedSource(proof.data.sourceId);
        }
        if (!IFdcVerification(ContractRegistry.getFdcVerification()).verifyPayment(proof)) {
            revert InvalidFDCProof();
        }

        IPayment.ResponseBody calldata response = proof.data.responseBody;
        if (response.status != 0) {
            revert ExternalPaymentFailed(response.status);
        }
        if (response.receivedAmount <= 0) {
            revert NonPositiveExternalAmount();
        }

        paymentIntentHash = paymentReferenceFor(paymentIntentId);
        if (records[paymentIntentHash].blockTimestamp != 0) {
            revert PaymentAlreadyProved(paymentIntentHash);
        }
        if (response.standardPaymentReference != paymentIntentHash) {
            revert PaymentReferenceMismatch(paymentIntentHash, response.standardPaymentReference);
        }

        records[paymentIntentHash] = ExternalPaymentRecord({
            transactionId: proof.data.requestBody.transactionId,
            paymentReference: response.standardPaymentReference,
            receivingAddressHash: response.receivingAddressHash,
            receivedAmountDrops: response.receivedAmount,
            blockNumber: response.blockNumber,
            blockTimestamp: response.blockTimestamp,
            votingRound: proof.data.votingRound,
            submittedBy: msg.sender
        });

        emit XRPPaymentProved(
            paymentIntentHash,
            paymentIntentId,
            proof.data.requestBody.transactionId,
            response.standardPaymentReference,
            response.receivingAddressHash,
            response.receivedAmount,
            proof.data.votingRound,
            response.blockTimestamp,
            msg.sender
        );
    }

    function getPaymentByIntentId(
        string calldata paymentIntentId
    ) external view returns (ExternalPaymentRecord memory record) {
        bytes32 paymentIntentHash = paymentReferenceFor(paymentIntentId);
        record = records[paymentIntentHash];
        if (record.blockTimestamp == 0) {
            revert PaymentNotFound(paymentIntentHash);
        }
    }
}
