package flare

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
)

type ReceiptVerifier struct {
	rpcURL          string
	contractAddress string
	client          *http.Client
}

func NewReceiptVerifier(rpcURL string, contractAddress string) (*ReceiptVerifier, error) {
	rpcURL = strings.TrimSpace(rpcURL)
	contractAddress = normalizeHex(contractAddress)
	if rpcURL == "" {
		return nil, fmt.Errorf("flare rpc url is required")
	}
	if len(contractAddress) != 42 {
		return nil, fmt.Errorf("stableflow payment contract address is invalid")
	}

	return &ReceiptVerifier{
		rpcURL:          rpcURL,
		contractAddress: contractAddress,
		client:          &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func (v *ReceiptVerifier) VerifyPayment(ctx context.Context, txHash string) (*application.RecordedChainPayment, error) {
	txHash = normalizeHex(txHash)
	if len(txHash) != 66 {
		return nil, fmt.Errorf("transaction hash is invalid")
	}

	receipt, err := v.getReceipt(ctx, txHash)
	if err != nil {
		return nil, err
	}
	if receipt == nil {
		return nil, fmt.Errorf("transaction receipt not found")
	}
	if receipt.Status != "0x1" {
		return nil, fmt.Errorf("transaction was not successful")
	}

	for _, log := range receipt.Logs {
		if normalizeHex(log.Address) != v.contractAddress {
			continue
		}
		if len(log.Topics) < 3 {
			continue
		}

		recorded, err := parsePaymentRecordedLog(receipt, log)
		if err != nil {
			return nil, err
		}
		recorded.TxHash = txHash
		return recorded, nil
	}

	return nil, fmt.Errorf("PaymentRecorded event not found in transaction receipt")
}

func (v *ReceiptVerifier) getReceipt(ctx context.Context, txHash string) (*rpcReceipt, error) {
	requestBody := rpcRequest{
		JSONRPC: "2.0",
		Method:  "eth_getTransactionReceipt",
		Params:  []string{txHash},
		ID:      1,
	}

	body, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.rpcURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := v.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("flare rpc returned status %d", resp.StatusCode)
	}

	var rpcResp rpcReceiptResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, err
	}
	if rpcResp.Error != nil {
		return nil, fmt.Errorf("flare rpc error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}

func parsePaymentRecordedLog(receipt *rpcReceipt, log rpcLog) (*application.RecordedChainPayment, error) {
	data, err := hexToBytes(log.Data)
	if err != nil {
		return nil, err
	}

	// PaymentRecorded has these non-indexed ABI fields:
	// string paymentIntentId, uint256 amount, string asset, string serviceId,
	// uint256 chainId, uint256 recordedAt.
	//
	// The first six 32-byte words form the ABI head. Dynamic strings store an
	// offset in the head and their length/content in the tail.
	paymentIntentID, err := abiString(data, 0)
	if err != nil {
		return nil, fmt.Errorf("decode paymentIntentId: %w", err)
	}
	amount, err := abiUint256(data, 1)
	if err != nil {
		return nil, fmt.Errorf("decode amount: %w", err)
	}
	asset, err := abiString(data, 2)
	if err != nil {
		return nil, fmt.Errorf("decode asset: %w", err)
	}
	serviceID, err := abiString(data, 3)
	if err != nil {
		return nil, fmt.Errorf("decode serviceId: %w", err)
	}
	chainID, err := abiUint256(data, 4)
	if err != nil {
		return nil, fmt.Errorf("decode chainId: %w", err)
	}
	recordedAt, err := abiUint256(data, 5)
	if err != nil {
		return nil, fmt.Errorf("decode recordedAt: %w", err)
	}

	blockNumber, err := parseHexUint64(receipt.BlockNumber)
	if err != nil {
		return nil, fmt.Errorf("decode block number: %w", err)
	}

	return &application.RecordedChainPayment{
		PaymentIntentID:   paymentIntentID,
		PaymentIntentHash: normalizeHex(log.Topics[1]),
		Payer:             topicAddress(log.Topics[2]),
		AmountWei:         amount.String(),
		Asset:             asset,
		ServiceID:         serviceID,
		ChainID:           chainID.Int64(),
		BlockNumber:       blockNumber,
		RecordedAt:        time.Unix(recordedAt.Int64(), 0).UTC(),
	}, nil
}

func abiUint256(data []byte, wordIndex int) (*big.Int, error) {
	word, err := abiWord(data, wordIndex)
	if err != nil {
		return nil, err
	}
	return new(big.Int).SetBytes(word), nil
}

func abiString(data []byte, wordIndex int) (string, error) {
	offset, err := abiUint256(data, wordIndex)
	if err != nil {
		return "", err
	}
	start := int(offset.Int64())
	if start < 0 || start+32 > len(data) {
		return "", fmt.Errorf("string offset out of bounds")
	}

	length := int(new(big.Int).SetBytes(data[start : start+32]).Int64())
	contentStart := start + 32
	contentEnd := contentStart + length
	if length < 0 || contentEnd > len(data) {
		return "", fmt.Errorf("string content out of bounds")
	}

	return string(data[contentStart:contentEnd]), nil
}

func abiWord(data []byte, wordIndex int) ([]byte, error) {
	start := wordIndex * 32
	end := start + 32
	if start < 0 || end > len(data) {
		return nil, fmt.Errorf("abi word %d out of bounds", wordIndex)
	}
	return data[start:end], nil
}

func topicAddress(topic string) string {
	topic = normalizeHex(topic)
	if len(topic) != 66 {
		return ""
	}
	return "0x" + topic[len(topic)-40:]
}

func hexToBytes(value string) ([]byte, error) {
	value = strings.TrimPrefix(normalizeHex(value), "0x")
	if value == "" {
		return nil, fmt.Errorf("empty hex value")
	}
	return hex.DecodeString(value)
}

func parseHexUint64(value string) (uint64, error) {
	value = strings.TrimPrefix(normalizeHex(value), "0x")
	if value == "" {
		return 0, nil
	}
	return strconv.ParseUint(value, 16, 64)
}

func normalizeHex(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if !strings.HasPrefix(value, "0x") && !strings.HasPrefix(value, "0X") {
		value = "0x" + value
	}
	return strings.ToLower(value)
}

type rpcRequest struct {
	JSONRPC string   `json:"jsonrpc"`
	Method  string   `json:"method"`
	Params  []string `json:"params"`
	ID      int      `json:"id"`
}

type rpcReceiptResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Result  *rpcReceipt `json:"result"`
	Error   *rpcError   `json:"error"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcReceipt struct {
	Status      string   `json:"status"`
	BlockNumber string   `json:"blockNumber"`
	Logs        []rpcLog `json:"logs"`
}

type rpcLog struct {
	Address string   `json:"address"`
	Topics  []string `json:"topics"`
	Data    string   `json:"data"`
}
