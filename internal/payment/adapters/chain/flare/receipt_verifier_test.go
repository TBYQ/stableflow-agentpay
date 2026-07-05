package flare

import (
	"encoding/hex"
	"math/big"
	"strings"
	"testing"
)

func TestParsePaymentRecordedLog(t *testing.T) {
	data := encodePaymentRecordedData(
		"pi_001",
		big.NewInt(1000000000000000),
		"C2FLR",
		"premium-market-report",
		big.NewInt(114),
		big.NewInt(1783160000),
	)

	recorded, err := parsePaymentRecordedLog(&rpcReceipt{
		BlockNumber: "0x7b",
	}, rpcLog{
		Topics: []string{
			"0xeventtopic",
			"0xpaymentintenthash",
			"0x0000000000000000000000001111111111111111111111111111111111111111",
		},
		Data: "0x" + hex.EncodeToString(data),
	})
	if err != nil {
		t.Fatalf("parse log: %v", err)
	}

	if recorded.PaymentIntentID != "pi_001" {
		t.Fatalf("expected payment intent pi_001, got %s", recorded.PaymentIntentID)
	}
	if recorded.AmountWei != "1000000000000000" {
		t.Fatalf("expected amount wei 1000000000000000, got %s", recorded.AmountWei)
	}
	if recorded.Asset != "C2FLR" {
		t.Fatalf("expected C2FLR, got %s", recorded.Asset)
	}
	if recorded.ServiceID != "premium-market-report" {
		t.Fatalf("expected premium-market-report, got %s", recorded.ServiceID)
	}
	if recorded.ChainID != 114 {
		t.Fatalf("expected chain id 114, got %d", recorded.ChainID)
	}
	if recorded.BlockNumber != 123 {
		t.Fatalf("expected block number 123, got %d", recorded.BlockNumber)
	}
}

func encodePaymentRecordedData(paymentIntentID string, amount *big.Int, asset string, serviceID string, chainID *big.Int, recordedAt *big.Int) []byte {
	head := make([]byte, 0, 6*32)
	tail := []byte{}

	appendStringHead := func(value string) {
		offset := big.NewInt(int64(6*32 + len(tail)))
		head = append(head, word(offset)...)
		tail = append(tail, abiStringTail(value)...)
	}

	appendStringHead(paymentIntentID)
	head = append(head, word(amount)...)
	appendStringHead(asset)
	appendStringHead(serviceID)
	head = append(head, word(chainID)...)
	head = append(head, word(recordedAt)...)

	return append(head, tail...)
}

func abiStringTail(value string) []byte {
	data := []byte(value)
	tail := word(big.NewInt(int64(len(data))))
	tail = append(tail, data...)
	padding := (32 - (len(data) % 32)) % 32
	tail = append(tail, make([]byte, padding)...)
	return tail
}

func word(value *big.Int) []byte {
	out := make([]byte, 32)
	bytes := value.Bytes()
	copy(out[32-len(bytes):], bytes)
	return out
}

func TestTopicAddress(t *testing.T) {
	address := topicAddress("0x0000000000000000000000001111111111111111111111111111111111111111")
	if address != "0x1111111111111111111111111111111111111111" {
		t.Fatalf("unexpected topic address %s", address)
	}
	if strings.Contains(address, "000000000000") {
		t.Fatalf("topic address should not include left padding")
	}
}
