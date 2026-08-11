package quote

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/TBYQ/stableflow-agentpay/internal/payment/application"
	"github.com/TBYQ/stableflow-agentpay/internal/payment/domain"
)

const (
	// DefaultFlareContractRegistry is the Flare-maintained registry address shared
	// by supported Flare networks. The FTSOv2 address is resolved from it at runtime.
	DefaultFlareContractRegistry = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019"
	flrUSDFeedID                 = "0x01464c522f55534400000000000000000000000000"
	xrpUSDFeedID                 = "0x015852502f55534400000000000000000000000000"
	getContractAddressSelector   = "82760fca"
	getFeedByIDSelector          = "93e9f806"
)

// FTSOProvider converts a USD service price into C2FLR or FXRP using the
// corresponding FTSOv2 block-latency feed on Flare Coston2.
type FTSOProvider struct {
	rpcURL          string
	registryAddress string
	client          *http.Client
	clock           application.Clock
}

func NewFTSOProvider(rpcURL, registryAddress string, clock application.Clock) (*FTSOProvider, error) {
	rpcURL = strings.TrimSpace(rpcURL)
	registryAddress, err := normalizeAddress(registryAddress)
	if err != nil {
		return nil, fmt.Errorf("flare contract registry: %w", err)
	}
	if rpcURL == "" {
		return nil, fmt.Errorf("flare rpc url is required")
	}
	if clock == nil {
		return nil, fmt.Errorf("clock is required")
	}

	return &FTSOProvider{
		rpcURL:          rpcURL,
		registryAddress: registryAddress,
		client:          &http.Client{Timeout: 15 * time.Second},
		clock:           clock,
	}, nil
}

func (p *FTSOProvider) QuotePayment(ctx context.Context, request application.QuoteRequest) (*application.PaymentQuote, error) {
	asset := strings.TrimSpace(request.Asset)
	if asset == "" {
		asset = "C2FLR"
	}
	feed, err := usdFeedForAsset(asset)
	if err != nil {
		return nil, err
	}

	usdAmount := strings.TrimSpace(request.USDAmount)
	if usdAmount == "" {
		usdAmount = "0.01"
	}
	usd, ok := new(big.Rat).SetString(usdAmount)
	if !ok || usd.Sign() <= 0 {
		return nil, fmt.Errorf("%w: usd amount must be positive", domain.ErrValidation)
	}

	ftsoAddress, err := p.resolveFTSOv2(ctx)
	if err != nil {
		return nil, err
	}
	priceValue, decimals, updatedAt, err := p.fetchUSDFeed(ctx, ftsoAddress, feed)
	if err != nil {
		return nil, err
	}

	price := decimalPrice(priceValue, decimals)
	if price.Sign() <= 0 {
		return nil, fmt.Errorf("flare ftso returned a non-positive %s/USD price", feed.Symbol)
	}

	amount := new(big.Rat).Quo(usd, price)
	now := p.clock.Now()
	return &application.PaymentQuote{
		USDAmount:      formatRat(usd, 2),
		Asset:          asset,
		Amount:         formatRat(amount, 6),
		PriceUSD:       formatRat(price, 8),
		PriceSource:    feed.PriceSource,
		FeedID:         feed.ID,
		PriceUpdatedAt: updatedAt,
		ExpiresAt:      now.Add(30 * time.Second),
	}, nil
}

func (p *FTSOProvider) resolveFTSOv2(ctx context.Context) (string, error) {
	result, err := p.ethCall(ctx, p.registryAddress, encodeGetContractAddressByName("FtsoV2"))
	if err != nil {
		return "", fmt.Errorf("resolve FtsoV2 through Flare Contract Registry: %w", err)
	}
	if len(result) != 32 {
		return "", fmt.Errorf("resolve FtsoV2: expected 32-byte address result, got %d bytes", len(result))
	}
	return normalizeAddress("0x" + hex.EncodeToString(result[12:]))
}

type usdFeed struct {
	ID          string
	Symbol      string
	PriceSource string
}

func usdFeedForAsset(asset string) (usdFeed, error) {
	switch strings.ToUpper(strings.TrimSpace(asset)) {
	case "C2FLR", "FLR":
		return usdFeed{ID: flrUSDFeedID, Symbol: "FLR", PriceSource: "flare-ftso-v2-flr-usd"}, nil
	case "FXRP":
		return usdFeed{ID: xrpUSDFeedID, Symbol: "XRP", PriceSource: "flare-ftso-v2-xrp-usd"}, nil
	default:
		return usdFeed{}, fmt.Errorf("%w: quote asset %s is not supported by the Flare FTSO adapter", domain.ErrValidation, asset)
	}
}

func (p *FTSOProvider) fetchUSDFeed(ctx context.Context, ftsoAddress string, feed usdFeed) (*big.Int, int8, time.Time, error) {
	result, err := p.ethCall(ctx, ftsoAddress, encodeGetFeedByID(feed.ID))
	if err != nil {
		return nil, 0, time.Time{}, fmt.Errorf("read %s/USD from Flare FTSOv2: %w", feed.Symbol, err)
	}
	if len(result) != 96 {
		return nil, 0, time.Time{}, fmt.Errorf("read %s/USD: expected 96-byte result, got %d bytes", feed.Symbol, len(result))
	}

	value := new(big.Int).SetBytes(result[:32])
	decimals := int8(result[63])
	timestamp := new(big.Int).SetBytes(result[64:96])
	if !timestamp.IsUint64() || timestamp.Uint64() == 0 {
		return nil, 0, time.Time{}, fmt.Errorf("read %s/USD: invalid feed timestamp", feed.Symbol)
	}
	return value, decimals, time.Unix(int64(timestamp.Uint64()), 0).UTC(), nil
}

func (p *FTSOProvider) ethCall(ctx context.Context, to, data string) ([]byte, error) {
	body, err := json.Marshal(ftsoRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_call",
		Params: []any{
			map[string]string{"to": to, "data": data},
			"latest",
		},
		ID: 1,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.rpcURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("flare rpc returned status %d", resp.StatusCode)
	}

	var rpcResp ftsoRPCResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, err
	}
	if rpcResp.Error != nil {
		return nil, fmt.Errorf("flare rpc error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}
	result := strings.TrimPrefix(strings.TrimSpace(rpcResp.Result), "0x")
	if result == "" || len(result)%2 != 0 {
		return nil, fmt.Errorf("flare rpc returned invalid eth_call data")
	}
	return hex.DecodeString(result)
}

func decimalPrice(value *big.Int, decimals int8) *big.Rat {
	price := new(big.Rat).SetInt(value)
	exponent := int64(decimals)
	if exponent < 0 {
		exponent = -exponent
	}
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(exponent), nil)
	if decimals >= 0 {
		return price.Quo(price, new(big.Rat).SetInt(scale))
	}
	return price.Mul(price, new(big.Rat).SetInt(scale))
}

func encodeGetContractAddressByName(name string) string {
	nameBytes := []byte(name)
	payload := make([]byte, 64+roundToWord(len(nameBytes)))
	copy(payload[:32], abiUint64(32))
	copy(payload[32:64], abiUint64(uint64(len(nameBytes))))
	copy(payload[64:], nameBytes)
	return "0x" + getContractAddressSelector + hex.EncodeToString(payload)
}

func encodeGetFeedByID(feedID string) string {
	feedID = strings.TrimPrefix(strings.TrimSpace(feedID), "0x")
	data, err := hex.DecodeString(feedID)
	if err != nil || len(data) != 21 {
		panic("invalid FTSO feed id")
	}
	payload := make([]byte, 32)
	copy(payload, data)
	return "0x" + getFeedByIDSelector + hex.EncodeToString(payload)
}

func abiUint64(value uint64) []byte {
	word := make([]byte, 32)
	for index := len(word) - 1; index >= 0 && value > 0; index-- {
		word[index] = byte(value)
		value >>= 8
	}
	return word
}

func roundToWord(length int) int {
	return ((length + 31) / 32) * 32
}

func normalizeAddress(value string) (string, error) {
	value = strings.TrimSpace(value)
	if !strings.HasPrefix(value, "0x") && !strings.HasPrefix(value, "0X") {
		value = "0x" + value
	}
	if len(value) != 42 {
		return "", fmt.Errorf("address must contain 20 bytes")
	}
	if _, err := hex.DecodeString(value[2:]); err != nil {
		return "", fmt.Errorf("address must be hexadecimal: %w", err)
	}
	return "0x" + strings.ToLower(value[2:]), nil
}

type ftsoRPCRequest struct {
	JSONRPC string `json:"jsonrpc"`
	Method  string `json:"method"`
	Params  []any  `json:"params"`
	ID      int    `json:"id"`
}

type ftsoRPCResponse struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      int           `json:"id"`
	Result  string        `json:"result"`
	Error   *ftsoRPCError `json:"error"`
}

type ftsoRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}
