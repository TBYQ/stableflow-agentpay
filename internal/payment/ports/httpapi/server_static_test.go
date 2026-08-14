package httpapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRoutesServeStaticCheckoutAndHealthCheck(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(filepath.Join(directory, "index.html"), []byte("stableflow-checkout"), 0o600); err != nil {
		t.Fatalf("write checkout: %v", err)
	}
	if err := os.WriteFile(filepath.Join(directory, "asset.js"), []byte("console.log('stableflow')"), 0o600); err != nil {
		t.Fatalf("write asset: %v", err)
	}

	server := NewServer(nil)
	server.SetStaticDir(directory)
	routes := server.Routes()

	checkout := httptest.NewRecorder()
	routes.ServeHTTP(checkout, httptest.NewRequest(http.MethodGet, "/", nil))
	if checkout.Code != http.StatusOK || !strings.Contains(checkout.Body.String(), "stableflow-checkout") {
		t.Fatalf("expected checkout response, got %d %q", checkout.Code, checkout.Body.String())
	}

	health := httptest.NewRecorder()
	routes.ServeHTTP(health, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if health.Code != http.StatusOK || !strings.Contains(health.Body.String(), `"status":"ok"`) {
		t.Fatalf("expected health response, got %d %q", health.Code, health.Body.String())
	}

	traversal := httptest.NewRecorder()
	routes.ServeHTTP(traversal, httptest.NewRequest(http.MethodGet, "/../go.mod", nil))
	if traversal.Code != http.StatusOK || !strings.Contains(traversal.Body.String(), "stableflow-checkout") {
		t.Fatalf("expected checkout fallback for invalid asset path, got %d %q", traversal.Code, traversal.Body.String())
	}
}
